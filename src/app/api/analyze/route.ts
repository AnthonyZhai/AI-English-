import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('audio') as File;
    const durationStr = formData.get('duration') as string;

    if (!file) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    const API_KEY = process.env.DASHSCOPE_API_KEY;
    if (!API_KEY) {
      return NextResponse.json({ error: 'DASHSCOPE_API_KEY not configured' }, { status: 500 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');
    console.log(`[1/2] Audio received: ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB, starting transcription...`);

    // ====================================================
    // Step 1: Use qwen3-omni-flash via DashScope NATIVE API (supports audio input)
    // OpenAI compatible mode does NOT support audio, must use native multimodal endpoint
    // ====================================================
    const asrRes = await fetch(
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen3-omni-flash',
          input: {
            messages: [
              {
                role: 'user',
                content: [
                  { audio: `data:audio/mp3;base64,${base64Audio}` },
                  { text: 'Transcribe this English audio word by word. Output ONLY the raw English transcription text. No timestamps, no labels, no explanations.' },
                ],
              },
            ],
          },
          parameters: {
            result_format: 'message',
          },
        }),
      }
    );

    if (!asrRes.ok) {
      let errText = '';
      try { errText = await asrRes.text(); } catch { errText = '(unable to read)'; }
      console.error('Audio model error:', asrRes.status, errText);
      throw new Error(`Audio transcription failed [${asrRes.status}]: ${errText.substring(0, 300)}`);
    }

    const asrData: any = await asrRes.json();
    // DashScope 原生 API 返回格式: output.choices[0].message.content[0].text
    // 兼容多种可能的返回结构
    let transcriptionText = '';
    if (asrData.output?.choices?.[0]?.message?.content) {
      const content = asrData.output.choices[0].message.content;
      if (typeof content === 'string') {
        transcriptionText = content.trim();
      } else if (Array.isArray(content)) {
        // content 可能是 [{text: "..."}, {audio: "..."}] 的数组
        for (const item of content) {
          if (item.text) transcriptionText += item.text + ' ';
        }
        transcriptionText = transcriptionText.trim();
      }
    } else if (asrData.choices?.[0]?.message?.content) {
      // fallback: OpenAI 兼容格式
      transcriptionText = asrData.choices[0].message.content.trim();
    }

    if (!transcriptionText) {
      console.error('ASR full response:', JSON.stringify(asrData).substring(0, 1000));
      throw new Error('Audio model returned empty transcription');
    }

    console.log(`[1/2] Transcription done! Length: ${transcriptionText.length} chars`);
    console.log(`[1/2] Preview: "${transcriptionText.substring(0, 120)}..."`);

    // ====================================================
    // Step 1.5: Generate word-level timings
    // Use real audio duration from frontend instead of file size estimate
    // ====================================================
    const audioDuration = durationStr ? parseFloat(durationStr) : (arrayBuffer.byteLength / (16 * 1024 / 8));
    const words = transcriptionText.split(/\s+/).filter((w: string) => w.length > 0);
    const avgWordDuration = audioDuration / words.length;

    const rawWordTimings = words.map((word: string, i: number) => ({
      text: word,
      start: parseFloat((i * avgWordDuration).toFixed(3)),
      end: parseFloat(((i + 1) * avgWordDuration).toFixed(3)),
    }));

    console.log(`[1/2] Generated ${rawWordTimings.length} word timings, duration ~${audioDuration.toFixed(1)}s`);

    // ====================================================
    // Step 2: Qwen-Plus vocabulary extraction and translation
    // ====================================================
    console.log(`[2/2] Qwen-Plus analysis starting...`);

    const qwenPrompt = `You are an expert English teacher. Analyze this English text:

"${transcriptionText}"

Task 1: Extract ALL vocabulary worth learning. Categorize each as:
- "high_freq": advanced/academic words
- "school": common exam words
- "phrase": useful multi-word phrases

Task 2: Split the text into logical paragraphs with accurate Chinese translations.

Return ONLY valid JSON (no markdown, no explanation):
{"vocab": {"word": {"translation": "chinese meaning", "category": "high_freq"}}, "paragraphs": [{"en": "english paragraph", "zh": "chinese translation"}]}`;

    const qwenRes = await fetch(
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen-plus',
          messages: [
            { role: 'system', content: 'You must output ONLY valid JSON. No markdown, no explanation.' },
            { role: 'user', content: qwenPrompt },
          ],
        }),
      }
    );

    if (!qwenRes.ok) {
      throw new Error('Qwen API Failed: ' + (await qwenRes.text()).substring(0, 200));
    }

    const qwenData: any = await qwenRes.json();
    let qwenMsg = qwenData.choices[0].message.content.trim();

    // Strip markdown code fences if present
    if (qwenMsg.startsWith('```json')) qwenMsg = qwenMsg.substring(7);
    if (qwenMsg.startsWith('```')) qwenMsg = qwenMsg.substring(3);
    if (qwenMsg.endsWith('```')) qwenMsg = qwenMsg.slice(0, -3);

    let analysisData: any = {};
    try {
      analysisData = JSON.parse(qwenMsg.trim());
    } catch {
      console.error('Qwen JSON parse failed, raw:', qwenMsg.substring(0, 500));
      throw new Error('Qwen returned invalid JSON');
    }

    console.log('Full pipeline completed! Words:', rawWordTimings.length, ', Vocab:', Object.keys(analysisData.vocab || {}).length);

    return NextResponse.json({
      success: true,
      wordTimings: rawWordTimings,
      analysis: analysisData,
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal API Error' }, { status: 500 });
  }
}
