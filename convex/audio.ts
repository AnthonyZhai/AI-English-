import { v } from "convex/values";
import { mutation, action } from "./_generated/server";

// --- Mutation: generate a one-time upload URL for Convex Storage ---
export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});

// --- Action: Groq Whisper ASR + Qwen-Plus vocab pipeline ---
export const processAudio = action({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const GROQ_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_KEY) throw new Error("GROQ_API_KEY not configured in Convex env");
    const DASHSCOPE_KEY = process.env.DASHSCOPE_API_KEY;
    if (!DASHSCOPE_KEY) throw new Error("DASHSCOPE_API_KEY not configured in Convex env");

    // 1. Download audio file bytes from Convex Storage (Groq needs file upload, not URL)
    const audioUrl = await ctx.storage.getUrl(storageId);
    if (!audioUrl) throw new Error("Failed to get storage URL for audio file");
    console.log("[groq] Downloading audio from Convex Storage...");

    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) throw new Error("Failed to download audio from Convex Storage");
    const audioBuffer = await audioRes.arrayBuffer();
    console.log("[groq] Audio downloaded, size:", audioBuffer.byteLength);

    // ============================================================
    // Step 1: Transcribe via Groq Whisper API (synchronous, word timestamps)
    // ============================================================
    console.log("[groq] Sending to Groq Whisper API...");

    const formData = new FormData();
    formData.append("file", new Blob([audioBuffer], { type: "audio/mp3" }), "audio.mp3");
    formData.append("model", "whisper-large-v3");
    formData.append("language", "en");
    formData.append("prompt", "Please add punctuation to the transcription like commas, periods, and question marks.");
    formData.append("response_format", "verbose_json");
    formData.append("timestamp_granularities[]", "word");

    const groqRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${GROQ_KEY}` },
      body: formData,
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text().catch(() => "(unable to read)");
      throw new Error(`Groq Whisper failed [${groqRes.status}]: ${errText.substring(0, 500)}`);
    }

    const groqData: any = await groqRes.json();
    console.log("[groq] Response keys:", Object.keys(groqData));
    console.log("[groq] Full response (truncated):", JSON.stringify(groqData).substring(0, 2000));

    // ============================================================
    // Step 2: Extract word-level timestamps from Groq response
    // ============================================================
    const fullTranscript = (groqData.text || "").trim();
    const wordTimings: { text: string; start: number; end: number }[] = [];
    let foundTimestamps = false;

    // Groq verbose_json returns: { text, segments: [{ words: [{ word, start, end }] }], words: [...] }
    // Try top-level words[] first (Groq with timestamp_granularities[]=word)
    if (Array.isArray(groqData.words) && groqData.words.length > 0) {
      for (const w of groqData.words) {
        if (w.word != null && w.start != null && w.end != null) {
          wordTimings.push({
            text: w.word.trim(),
            start: parseFloat(Number(w.start).toFixed(3)),
            end: parseFloat(Number(w.end).toFixed(3)),
          });
          foundTimestamps = true;
        }
      }
    }

    // Fallback: segments[].words[]
    if (!foundTimestamps && Array.isArray(groqData.segments)) {
      for (const seg of groqData.segments) {
        for (const w of (seg.words || [])) {
          if (w.word != null && w.start != null && w.end != null) {
            wordTimings.push({
              text: w.word.trim(),
              start: parseFloat(Number(w.start).toFixed(3)),
              end: parseFloat(Number(w.end).toFixed(3)),
            });
            foundTimestamps = true;
          }
        }
      }
    }

    // Last resort: even distribution from plain text
    if (!foundTimestamps && fullTranscript) {
      console.warn("[groq] No word-level timestamps found, falling back to even distribution");
      const words = fullTranscript.split(/\s+/).filter((w: string) => w.length > 0);
      let duration = 0;
      if (Array.isArray(groqData.segments) && groqData.segments.length > 0) {
        const lastSeg = groqData.segments[groqData.segments.length - 1];
        duration = lastSeg.end || 0;
      }
      if (duration <= 0) duration = words.length * 0.4;
      const avgDur = duration / words.length;
      for (let i = 0; i < words.length; i++) {
        wordTimings.push({
          text: words[i],
          start: parseFloat((i * avgDur).toFixed(3)),
          end: parseFloat(((i + 1) * avgDur).toFixed(3)),
        });
      }
    }

    console.log(`[groq] Got ${wordTimings.length} word timings (real=${foundTimestamps}), transcript length: ${fullTranscript.length}`);

    // ============================================================
    // Step 3: Qwen-Plus vocabulary extraction and translation
    // ============================================================
    console.log("[Qwen] Starting vocab extraction...");

    const qwenPrompt = `你是一个智能的英语教学专家。
请从用户提供的英文文本中，完成以下三项任务：

任务一：提取【所有】有学习价值的核心内容（无数量限制），并分为三类：
1. high_freq: 高频核心词汇
2. school: 中高考基础核心词汇
3. phrase: 常用词组/短语（由2-4个单词组成，如 a lot of）

任务二：请根据下方给出的英文原文内容的语义和长短，将其进行合理的分段（比如2-3句话为一段），并给出每一段的精准中文翻译。

任务三：根据上述提取的内容，写一个用于小红书平台的英语学习视频介绍文案。
文案风格要求：
1. 吸引眼的标题（使用Emoji）。
2. 大量使用Emoji表情，活泼可爱的语气。
3. 提炼出几个亮点句子（带中文翻译），和几个高频词汇。
4. 包含合适的互动引导和 #话题标签 （如#英语学习 #英语口语 #每日英语 等）。

【严格返回格式】
你必须返回纯 JSON 格式字典，包含"vocab"、"paragraphs"和"xiaohongshu_copy"三个字段。不要返回任何其他废话，不要包含Markdown记号(如\`\`\`json)。格式如下：
{
  "vocab": {
    "proud": {"translation": "骄傲的", "category": "school"},
    "kind of": {"translation": "有点儿", "category": "phrase"}
  },
  "paragraphs": [
    {
      "en": "This isn't supposed to be a rude question, but do you think before you speak? Because you answer questions so quickly and so comprehensively...",
      "zh": "这并不是一个冒犯的问题，但你在说话前会思考吗？因为你回答问题如此迅速且全面..."
    }
  ],
  "xiaohongshu_copy": "# 🎙️标题\\n\\n文案正文..."
}

以下是需要分析的英文文本：
"${fullTranscript}"`;

    const qwenRes = await fetch(
      "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${DASHSCOPE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "qwen3.5-plus",
          messages: [
            { role: "system", content: "你必须只输出纯JSON，不要包含任何Markdown标记、解释或多余文字。" },
            { role: "user", content: qwenPrompt },
          ],
        }),
      }
    );

    if (!qwenRes.ok) {
      throw new Error("Qwen API Failed: " + (await qwenRes.text()).substring(0, 200));
    }

    const qwenData: any = await qwenRes.json();
    let qwenMsg = qwenData.choices[0].message.content.trim();

    // Strip markdown code fences if present
    if (qwenMsg.startsWith("```json")) qwenMsg = qwenMsg.substring(7);
    if (qwenMsg.startsWith("```")) qwenMsg = qwenMsg.substring(3);
    if (qwenMsg.endsWith("```")) qwenMsg = qwenMsg.slice(0, -3);
    
    console.log("[Qwen] Raw response after stripping markdown:", qwenMsg);

    let analysisData: any = {};
    try {
      analysisData = JSON.parse(qwenMsg.trim());
    } catch {
      console.error("[Qwen] JSON parse failed, raw:", qwenMsg.substring(0, 500));
      throw new Error("Qwen returned invalid JSON");
    }

    console.log(
      "[Done] Pipeline complete! Words:",
      wordTimings.length,
      ", Vocab:",
      Object.keys(analysisData.vocab || {}).length
    );

    // Clean up the uploaded audio file from storage
    await ctx.storage.delete(storageId);

    return {
      success: true,
      wordTimings,
      analysis: analysisData,
    };
  },
});
