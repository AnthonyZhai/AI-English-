'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { FileAudio, FileVideo, UploadCloud, Loader2 } from 'lucide-react';
import { saveKaraokeData } from '../../lib/karaokeStore';

export default function AudioExtractor() {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [processingState, setProcessingState] = useState<'idle' | 'extracting' | 'uploading' | 'saving' | 'success'>('idle');
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState<string>('');

  // Original video file ref for IndexedDB save
  const videoFileRef = useRef<File | null>(null);

  // Convex hooks
  const generateUploadUrl = useMutation(api.audio.generateUploadUrl);
  const processAudio = useAction(api.audio.processAudio);

  const ffmpegRef = useRef<FFmpeg | null>(null);

  const loadFFmpeg = async () => {
    setIsLoading(true);
    try {
      const ffmpeg = new FFmpeg();
      ffmpegRef.current = ffmpeg;

      ffmpeg.on('log', ({ message }) => { setLog(message); });
      ffmpeg.on('progress', ({ progress }) => { setProgress(progress * 100); });

      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      setLoaded(true);
    } catch (err) {
      console.error('Failed to load FFmpeg', err);
      alert('FFmpeg 加载失败，请检查网络连接！');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadFFmpeg(); }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !loaded || !ffmpegRef.current) return;

    videoFileRef.current = file;
    setProcessingState('extracting');
    setProgress(0);

    const ffmpeg = ffmpegRef.current;

    // Generate unique filenames to avoid FS errors on multiple runs
    const timestamp = Date.now();
    const inputName = `input_${timestamp}.mp4`;
    const outputName = `out_${timestamp}.mp3`;

    try {
      // 1. FFmpeg 提取音频
      await ffmpeg.writeFile(inputName, await fetchFile(file));
      await ffmpeg.exec(['-i', inputName, '-vn', '-acodec', 'libmp3lame', '-q:a', '9', outputName]);

      const fileData = await ffmpeg.readFile(outputName);
      const data = new Uint8Array(fileData as any);
      const audioBlob = new Blob([data.buffer], { type: 'audio/mp3' });

      setProcessingState('uploading');
      console.log('音频提取完成，上传至 Convex Storage，大小:', audioBlob.size);

      // 2. 上传到 Convex Storage
      const uploadUrl = await generateUploadUrl();
      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'audio/mp3' },
        body: audioBlob,
      });

      if (!uploadRes.ok) throw new Error('Failed to upload audio to Convex Storage');
      const { storageId } = await uploadRes.json();
      console.log('Convex Storage 上传完成, storageId:', storageId);

      // 3. 调用 Convex action: qwen-asr + Qwen 词汇分析
      const result = await processAudio({ storageId });

      if (result.success) {
        console.log('qwen-asr + Qwen 全流水线完成！', result);
        setProcessingState('saving');

        // Save to IndexedDB: convert File to ArrayBuffer
        const videoBuffer = await videoFileRef.current!.arrayBuffer();
        await saveKaraokeData({
          videoBuffer,
          videoMimeType: videoFileRef.current!.type || 'video/mp4',
          wordTimings: result.wordTimings,
          analysis: result.analysis,
        });

        setProcessingState('success');
        router.push('/karaoke');
      } else {
        throw new Error('Pipeline returned unsuccessful result');
      }

    } catch (err: any) {
      console.error('Extraction or API Error:', err);
      setProcessingState('idle');
      alert(`处理失败: ${err.message || '未知错误'}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
        <p className="text-sm text-gray-500 font-medium">正在加载浏览器多线程视频切片引擎 (FFmpeg.wasm)...</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-8 bg-white border border-gray-100 shadow-xl rounded-2xl relative overflow-hidden">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          AI 智能视频分析
        </h2>
        <p className="text-gray-500 mt-2 text-sm">无需上传百兆视频，浏览器本地极速抽取音轨</p>
      </div>

      {processingState === 'idle' && (
        <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-gray-300 rounded-xl hover:bg-gray-50 hover:border-blue-400 focus:outline-none transition-all cursor-pointer group">
          <UploadCloud className="w-12 h-12 text-gray-400 group-hover:text-blue-500 transition-colors mb-4" />
          <span className="text-sm font-semibold text-gray-700">点击上传 MP4 视频文件</span>
          <span className="text-xs text-gray-400 mt-2">支持高清大视频，纯本地安全解析</span>
          <input
            type="file"
            accept="video/mp4,video/quicktime"
            className="hidden"
            onChange={handleFileUpload}
            disabled={!loaded}
          />
        </label>
      )}

      {processingState === 'extracting' && (
        <div className="flex flex-col items-center justify-center w-full h-64 border-2 border-blue-100 bg-blue-50 rounded-xl space-y-6">
          <div className="relative">
            <FileVideo className="w-16 h-16 text-blue-300 absolute -left-10 opacity-50 animate-pulse" />
            <Loader2 className="w-16 h-16 text-blue-600 animate-spin relative z-10" />
            <FileAudio className="w-16 h-16 text-blue-400 absolute left-10 opacity-80" />
          </div>
          <div className="w-3/4">
            <div className="flex justify-between text-xs text-blue-600 font-bold mb-1">
              <span>正在黑科技提纯剥离声音...</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
            </div>
          </div>
          <p className="text-xs text-blue-400 font-mono max-w-[80%] text-center truncate">{log || 'Initializing...'}</p>
        </div>
      )}

      {processingState === 'uploading' && (
        <div className="flex flex-col items-center justify-center w-full h-64 border-2 border-indigo-100 bg-indigo-50 rounded-xl space-y-4">
          <div className="relative flex items-center justify-center">
            <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            <FileAudio className="w-8 h-8 text-indigo-600 absolute" />
          </div>
          <h3 className="text-indigo-700 font-semibold">提取成功！qwen-asr 云端识别中...</h3>
          <p className="text-indigo-400 text-xs">Convex Storage → qwen-asr 语音识别 → Qwen 词汇分析</p>
        </div>
      )}

      {(processingState === 'saving' || processingState === 'success') && (
        <div className="flex flex-col items-center justify-center w-full h-64 border-2 border-green-100 bg-green-50 rounded-xl space-y-4">
          <div className="relative flex items-center justify-center">
            <div className="w-16 h-16 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
          </div>
          <h3 className="text-green-700 font-semibold">分析完成！正在跳转卡拉OK页面...</h3>
          <p className="text-green-400 text-xs">Saving data & navigating to /karaoke</p>
        </div>
      )}
    </div>
  );
}
