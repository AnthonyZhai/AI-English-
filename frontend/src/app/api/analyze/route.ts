import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('audio') as File;

    if (!file) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    const API_KEY = process.env.DASHSCOPE_API_KEY || "sk-1d32b7620e834a408de3e05aa9d162ea";
    if (!API_KEY) {
      return NextResponse.json({ error: '请在环境变量中配置 DASHSCOPE_API_KEY' }, { status: 500 });
    }

    console.log(`[1/2] 开始音频听写解析... 大小: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
    
    // ====================================================
    // 纯原生 fetch 调用 阿里 Paraformer-v2
    // 不依赖任何第三方 NPM 包，直接用浏览器的 FormData 规范！
    // ====================================================
    const audioForm = new FormData();
    // 把接收到的前端 File 对象原封不动作为文件塞进去
    audioForm.append('file', file);
    audioForm.append('model', 'paraformer-v2');
    audioForm.append('parameters', JSON.stringify({
        workspace: "default",
        output_format: "json", // 强制 json
        language_hints: ["en", "zh"],
        semantic_sentence_detection: false, 
        word_timestamps: true // 开启豪秒级打点
    }));

    const asrRes = await fetch('https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`
        // fetch 原生 FormData 绝对不能手工设置 Content-Type，让浏览器/Node自动生成带 boundary 的头！
      },
      body: audioForm
    });

    if (!asrRes.ok) {
       throw new Error(`ASR API Failed: ${await asrRes.text()}`);
    }

    const asrData = await asrRes.json();
    
    let transcriptionText = "";
    let rawWordTimings: any[] = [];
    
    // 阿里任务结果提取规则
    if(asrData.output && asrData.output.sentence_results){
       asrData.output.sentence_results.forEach((sentence: any) => {
           transcriptionText += sentence.text + " ";
           if(sentence.words) {
              sentence.words.forEach((w: any) => {
                  rawWordTimings.push({
                      text: w.text,
                      start: parseFloat((w.begin_time / 1000).toFixed(2)),
                      end: parseFloat((w.end_time / 1000).toFixed(2))
                  });
              });
           }
       });
    } else {
        throw new Error("ASR 返回了暂不支持的格式（可能是长音频变成轮询模式了）。" + JSON.stringify(asrData).substring(0, 100));
    }

    // ====================================================
    // 第二步：拿着拼接好的全文 transcriptionText ，召唤 Qwen-Plus 剥离生词
    // ====================================================
    if (!transcriptionText.trim()) {
        throw new Error("没提取到任何说话内容！");
    }
    console.log(`[2/2] 开始大模型语义翻译理解... 识别出英文字数: ${transcriptionText.length}`);

    const qwenPrompt = `你是一个智能英语教学专家。请分析以下英文：\n\n"${transcriptionText}"
\n任务一：提取【所有】有学习价值核心单词和词组，分为 high_freq, school, phrase 三类。
任务二：合理给整段英文按句群切分段落，并提供精准中文。
严格返回JSON格式字典(不可带有markdown标记，务必是纯JSON文本)：{"vocab": {"word":{"translation":"中文","category":"high_freq"}}, "paragraphs": [{"en":"...","zh":"..."}]}`;

    const qwenRes = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: "qwen-plus",
            messages: [
                { role: "system", content: "你必须永远只输出 JSON 格式文本。" },
                { role: "user", content: qwenPrompt }
            ]
        })
    });

    if (!qwenRes.ok) {
       throw new Error(`Qwen API Failed: ${await qwenRes.text()}`);
    }

    const qwenData = await qwenRes.json();
    let qwenMsg = qwenData.choices[0].message.content.trim();
    // 粗暴洗掉可能附带的 markdown json 代码块后缀
    if(qwenMsg.startsWith("```json")) qwenMsg = qwenMsg.substring(7);
    if(qwenMsg.startsWith("```")) qwenMsg = qwenMsg.substring(3);
    if(qwenMsg.endsWith("```")) qwenMsg = qwenMsg.slice(0, -3);
    
    let analysisData = {};
    try {
        analysisData = JSON.parse(qwenMsg.trim());
    } catch(e) {
        console.error("Qwen 返回的 JSON 非法：", qwenMsg);
        throw new Error("Qwen模型发狂乱吐乱码，解析JSON失败！");
    }

    // ----------------------------------------------------
    // 合并组装，送往客户端 React
    // ----------------------------------------------------
    console.log("✅ 阿里云全链路处理竣工并成功解析 JSON ！！！");
    return NextResponse.json({
        success: true,
        wordTimings: rawWordTimings,   // 卡拉OK时间轴组件
        analysis: analysisData         // 新鲜出炉的底色红框和段落翻译
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal API Error' }, { status: 500 });
  }
}
