'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

interface WordTiming { text: string; start: number; end: number; }
interface VocabDef { translation: string; category: string; }
interface ParagraphItem { en: string; zh: string; }
interface AnalysisData { vocab?: Record<string, VocabDef>; paragraphs?: ParagraphItem[]; xiaohongshu_copy?: string; }

interface Props {
  videoFile: File;
  timings: WordTiming[];
  analysis: AnalysisData;
}

/* ====================================================================
   CSS faithfully ported from index.html
   ==================================================================== */
const KARAOKE_CSS = `
  .kp-root * { box-sizing: border-box; }

  .kp-paper-wrapper {
    background-color: #ffffff;
    padding: 20px;
    border-radius: 16px;
    box-shadow: 0 15px 50px rgba(0,0,0,0.5);
  }

  .kp-phone {
    width: 540px; height: 960px;
    background-color: #ffffff;
    display: flex; flex-direction: column;
    overflow: hidden; position: relative;
    border-radius: 12px;
  }

  .kp-top-header {
    display: flex; align-items: center; padding: 12px 15px;
    background: #fff;
  }
  .kp-logo-box {
    background-color: #be2121; color: #fff;
    font-size: 32px; font-weight: 900; padding: 5px 12px;
    margin-right: 15px; letter-spacing: 2px;
    font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
  }
  .kp-title-box { display: flex; flex-direction: column; }
  .kp-title-main {
    font-size: 26px; font-weight: 900; color: #000;
    letter-spacing: 1px; line-height: 1.2;
    font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
  }
  .kp-title-sub {
    font-size: 16px; font-weight: bold; color: #be2121;
    letter-spacing: 1px; margin-top: 2px;
    font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
  }

  .kp-info-bar {
    background-color: #be2121; color: #fff;
    font-size: 11px; display: flex; justify-content: space-between;
    padding: 5px 15px; font-weight: 500;
  }

  .kp-main-area { display: flex; flex: 1; overflow: hidden; }

  .kp-left-col {
    flex: 6.2; display: flex; flex-direction: column;
    border-right: 1px dashed #be2121;
  }
  .kp-video-wrapper {
    width: 100%; height: 42%;
    background: #fff; padding: 10px;
    box-sizing: border-box; position: relative; flex-shrink: 0;
  }
  .kp-video {
    width: 100%; height: 100%; object-fit: cover; object-position: center top;
    border-radius: 8px; cursor: pointer;
  }
  .kp-lyrics-container {
    flex: 1; padding: 15px; overflow-y: auto; scroll-behavior: smooth;
    background: #fff; display: block;
  }
  .kp-lyrics-container::-webkit-scrollbar { width: 0px; }

  .kp-page-container {
    width: 100%;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 20px;
    text-align: justify;
    line-height: 1.8;
    padding-bottom: 200px;
  }

  .kp-word-span {
    display: inline-block;
    vertical-align: top;
    position: relative;
    color: #000;
    transition: color 0.1s;
    margin: 0 1px;
    padding-bottom: 10px;
  }

  .kp-en-container {
    display: inline-block;
    padding: 0px 3px 0px 3px;
    border-bottom: 2px solid transparent;
    border-radius: 4px;
    transition: background-color 0.2s, border-color 0.2s;
    margin-right: 2px;
  }

  .kp-en-text-part {
    color: #000;
    font-size: 20px;
    font-weight: 500;
    letter-spacing: 0;
  }

  .kp-zh-mean {
    position: absolute;
    left: 50%;
    bottom: -13px;
    transform: translateX(-50%);
    font-size: 13px;
    font-weight: bold;
    white-space: nowrap;
    opacity: 0; transition: opacity 0.2s;
    font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
    pointer-events: none;
  }

  /* Active normal word — use text-shadow instead of font-weight to avoid layout shift */
  .kp-word-span.active .kp-en-container {
    border-bottom-color: #000;
    background: rgba(0,0,0,0.05);
    border-radius: 0px;
  }
  .kp-word-span.active .kp-en-text-part {
    text-shadow: 0.4px 0 0 currentColor, -0.4px 0 0 currentColor;
  }
  /* Passed normal word */
  .kp-word-span.passed .kp-en-container {
    border-bottom-color: #000;
    border-radius: 0px;
  }

  /* Vocab words — no font-weight change, use text-shadow for faux-bold */
  .kp-word-span.is-vocab .kp-en-text-part {
    text-shadow: 0.3px 0 0 currentColor, -0.3px 0 0 currentColor;
  }
  .kp-word-span.is-vocab.active .kp-en-text-part {
    text-shadow: 0.6px 0 0 currentColor, -0.6px 0 0 currentColor;
  }

  /* Trailing punctuation after a word */
  .kp-punct {
    font-size: 20px; font-weight: 500; color: #000;
    margin-right: 1px;
  }

  /* high_freq */
  .kp-word-span.is-vocab[data-category="high_freq"] .kp-en-container {
    border: 1px solid #be2121;
    border-bottom: 3px solid #be2121;
    background: #ffffff;
  }
  .kp-word-span.is-vocab[data-category="high_freq"].active .kp-en-container,
  .kp-word-span.is-vocab[data-category="high_freq"].passed .kp-en-container {
    background: #fad8d8;
  }
  .kp-word-span.is-vocab[data-category="high_freq"] .kp-zh-mean { color: #be2121; }
  .kp-word-span.is-vocab[data-category="high_freq"].active .kp-zh-mean,
  .kp-word-span.is-vocab[data-category="high_freq"].passed .kp-zh-mean { opacity: 1; }

  /* school */
  .kp-word-span.is-vocab[data-category="school"] .kp-en-container {
    border: 1px dashed #c94f6c;
    border-bottom: 3px solid #c94f6c;
    background: #ffffff;
  }
  .kp-word-span.is-vocab[data-category="school"].active .kp-en-container,
  .kp-word-span.is-vocab[data-category="school"].passed .kp-en-container {
    background: #fbdde4;
  }
  .kp-word-span.is-vocab[data-category="school"] .kp-zh-mean { color: #c94f6c; }
  .kp-word-span.is-vocab[data-category="school"].active .kp-zh-mean,
  .kp-word-span.is-vocab[data-category="school"].passed .kp-zh-mean { opacity: 1; }

  /* phrase */
  .kp-word-span.is-vocab[data-category="phrase"] .kp-en-container {
    border: 1px dotted #d97706;
    border-bottom: 3px solid #d97706;
    background: #ffffff;
  }
  .kp-word-span.is-vocab[data-category="phrase"].active .kp-en-container,
  .kp-word-span.is-vocab[data-category="phrase"].passed .kp-en-container {
    background: #fcebd1;
  }
  .kp-word-span.is-vocab[data-category="phrase"] .kp-zh-mean { color: #d97706; }
  .kp-word-span.is-vocab[data-category="phrase"].active .kp-zh-mean,
  .kp-word-span.is-vocab[data-category="phrase"].passed .kp-zh-mean { opacity: 1; }

  /* Right column */
  .kp-right-col {
    flex: 3.8; display: flex; flex-direction: column;
    background: #fff; position: relative;
  }

  .kp-cd-mock { text-align: center; padding: 25px 0 10px 0; }
  .kp-cd-circle {
    width: 80px; height: 80px; border-radius: 50%;
    margin: 0 auto; position: relative;
    box-shadow: 2px 5px 10px rgba(0,0,0,0.2);
  }
  .kp-cd-disc {
    width: 100%; height: 100%; border-radius: 50%;
    background: radial-gradient(circle, #ddd 10%, #171717 20%, #111 80%, #333 100%);
    border: 3px solid #eee;
  }
  .kp-cd-wrapper {
    position: relative; width: 80px; height: 80px; margin: 0 auto;
  }
  .kp-cd-wrapper::after {
    content: ''; position: absolute;
    width: 4px; height: 40px; background: #555;
    top: -10px; right: -5px; transform: rotate(30deg);
    transform-origin: top center; border-radius: 2px;
    z-index: 2;
  }
  .kp-cd-disc.spinning { animation: kp-spin 3s linear infinite; }
  @keyframes kp-spin { 100% { transform: rotate(360deg); } }
  .kp-cd-text { font-size: 13px; font-weight: 900; color: #000; margin-top: 10px; }

  .kp-vocab-divider {
    text-align: center; font-size: 14px; color: #be2121;
    font-weight: bold; margin: 15px 0; position: relative;
  }
  .kp-vocab-divider::before, .kp-vocab-divider::after {
    content: ""; position: absolute; top: 50%; width: 20%; height: 1px; background: #be2121;
  }
  .kp-vocab-divider::before { left: 15px; }
  .kp-vocab-divider::after { right: 15px; }

  .kp-vocab-list {
    flex: 1; padding: 0 12px 15px 12px;
    overflow-y: auto; scroll-behavior: smooth;
    list-style: none; margin: 0; display: flex; flex-direction: column; gap: 10px;
  }
  .kp-vocab-list::-webkit-scrollbar { width: 0px; }

  .kp-vocab-item {
    background: #fff; color: #333;
    border-radius: 6px; padding: 10px 12px;
    display: flex; flex-direction: column;
    box-shadow: 0 2px 4px rgba(0,0,0,0.15);
    transition: transform 0.2s, box-shadow 0.2s;
    border-left: 4px solid #be2121;
  }
  .kp-vocab-item.cat-high_freq { border-left: 4px solid #be2121; }
  .kp-vocab-item.cat-high_freq .kp-en-word { color: #be2121; }
  .kp-vocab-item.cat-school { border-left: 4px solid #d16b6b; background: #fffafa; }
  .kp-vocab-item.cat-school .kp-en-word { color: #d16b6b; }
  .kp-vocab-item.cat-phrase { border-left: 4px solid #d97706; background: #fffdf5; }
  .kp-vocab-item.cat-phrase .kp-en-word { color: #d97706; }

  .kp-vocab-item-top { display: flex; justify-content: flex-start; align-items: baseline; margin-bottom: 2px; }
  .kp-vocab-item .kp-en-word { font-weight: 900; font-size: 19px; font-family: Arial, sans-serif; letter-spacing: 0.5px; }
  .kp-vocab-item .kp-zh-word { font-size: 14px; font-weight: 500; color: #444; }

  .kp-para-block { margin-bottom: 30px; }
  .kp-en-para {
    display: flex; flex-wrap: wrap; align-items: flex-end;
    row-gap: 8px; column-gap: 6px; margin-bottom: 10px;
  }
  .kp-zh-para {
    color: #be2121; font-size: 16px; font-weight: bold;
    margin-top: 10px; letter-spacing: 1px; padding-left: 5px;
    border-left: 3px solid #be2121;
    font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
  }

  .kp-rec-dot {
    display: inline-block; width: 10px; height: 10px;
    background: #ff0000; border-radius: 50%;
    animation: kp-blink 1s infinite;
    margin-right: 6px; vertical-align: middle;
  }
  @keyframes kp-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
`;

export default function KaraokePlayer({ videoFile, timings, analysis }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lyricsRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const animFrameRef = useRef<number>(0);
  const lastHighlightedVocabRef = useRef<string>('');

  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState('');

  useEffect(() => {
    const url = URL.createObjectURL(videoFile);
    setVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [videoFile]);

  const dict = analysis.vocab || {};
  const paras = analysis.paragraphs || [];
  const xiaohongshuCopy = analysis.xiaohongshu_copy || '';
  
  // Debug log for checking whether the field exists
  console.log("=== KaraokePlayer Debug ===");
  console.log("Analysis Data Received:", analysis);
  console.log("xiaohongshu_copy extracted:", xiaohongshuCopy);

  const today = new Date();
  const dateStr = `${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}.${today.getFullYear()}`;

  const orderedVocabList = useMemo(() => {
    const list: { key: string; text: string; def: VocabDef; start: number }[] = [];
    const seen = new Set<string>();

    let i = 0;
    while (i < timings.length) {
      let matchedSpan = 1;
      let matchedKey: string | null = null;
      let matchedText = '';

      // Look ahead up to 4 words
      for (let span = 4; span >= 1; span--) {
        if (i + span <= timings.length) {
          const wordsSlice = timings.slice(i, i + span).map(w => w?.text ? w.text.toLowerCase().replace(/[^a-z'-]/g, '') : '');
          const candidate = wordsSlice.join(' ');
          if (dict[candidate]) {
            matchedKey = candidate;
            matchedSpan = span;
            matchedText = timings.slice(i, i + span).map(w => w.text).join(' ');
            break;
          }
        }
      }

      if (matchedKey && !seen.has(matchedKey)) {
        seen.add(matchedKey);
        list.push({ key: matchedKey, text: matchedText, def: dict[matchedKey], start: timings[i].start });
      }
      i++;
    }

    for (const [k, v] of Object.entries(dict)) {
      if (!seen.has(k)) list.push({ key: k, text: k, def: v, start: 0 });
    }
    return list;
  }, [timings, dict]);

  const paragraphBlocks = useMemo(() => {
    let cursor = 0;
    return paras.map((p) => {
      const paraWords = p.en.split(/\s+/);
      const targetLen = paraWords.length;

      const blockChars = [];
      for (let i = 0; i < targetLen && cursor < timings.length; i++) {
        blockChars.push(timings[cursor]);
        cursor++;
      }

      // Group timing slices by phrases so they get drawn together
      const groupedChunks = [];
      let i = 0;
      while (i < blockChars.length) {
        let matchedSpan = 1;
        let matchedKey: string | null = null;

        for (let span = 4; span >= 1; span--) {
          if (i + span <= blockChars.length) {
            const wordsSlice = blockChars.slice(i, i + span).map(w => w?.text ? w.text.toLowerCase().replace(/[^a-z'-]/g, '') : '');
            const candidate = wordsSlice.join(' ');
            if (dict[candidate]) {
              matchedKey = candidate;
              matchedSpan = span;
              break;
            }
          }
        }

        if (matchedKey) {
          groupedChunks.push({
            isPhrase: true,
            key: matchedKey,
            timings: blockChars.slice(i, i + matchedSpan)
          });
          i += matchedSpan;
        } else {
          groupedChunks.push({
            isPhrase: false,
            key: blockChars[i]?.text ? blockChars[i].text.toLowerCase().replace(/[^a-z'-]/g, '') : '',
            timings: [blockChars[i]]
          });
          i++;
        }
      }

      return { timingChunks: groupedChunks, zh: p.zh };
    });
  }, [paras, timings, dict]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) videoRef.current.pause();
    else videoRef.current.play();
    setIsPlaying(!isPlaying);
  };

  // ============================================================
  // Use requestAnimationFrame for smooth, high-frequency time updates
  // This replaces the low-frequency onTimeUpdate (~4Hz)
  // ============================================================
  useEffect(() => {
    let rafId: number;
    const tick = () => {
      if (videoRef.current && !videoRef.current.paused) {
        setCurrentTime(videoRef.current.currentTime);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // ============================================================
  // Apply active/passed classes via direct DOM manipulation
  // (like index.html does) for maximum performance + reliability
  // Also handles: auto-scroll lyrics + vocab card scale animation
  // ============================================================
  useEffect(() => {
    const allSpans = document.querySelectorAll('.kp-word-span');
    let currentActiveVocabKey = '';

    // Strategy for active vocab scrolling in DOM:
    // Find the *latest* vocab word that has start <= currentTime
    // This assumes `orderedVocabList` has sequential `start` times.
    let latestVocabKey = '';
    let latestVocabTime = -1;
    for (const v of orderedVocabList) {
      if (v.start <= currentTime && v.start > latestVocabTime) {
         latestVocabTime = v.start;
         latestVocabKey = v.key;
      }
    }
    if (latestVocabKey) {
       currentActiveVocabKey = latestVocabKey;
    }

    allSpans.forEach((span) => {
      const el = span as HTMLElement;
      const start = parseFloat(el.dataset.multiStart || '0');
      const end = parseFloat(el.dataset.multiEnd || '0');

      let newState = '';
      if (currentTime >= start && currentTime <= end) newState = 'active';
      else if (currentTime > end) newState = 'passed';

      const hadActive = el.classList.contains('active');
      const hadPassed = el.classList.contains('passed');

      // Remove old states
      el.classList.remove('active', 'passed');

      if (newState === 'active') {
        el.classList.add('active');

        // Auto-scroll lyrics to active word
        if (!hadActive) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else if (newState === 'passed') {
        el.classList.add('passed');
      }
    });

    // ============================================================
    // Right sidebar: vocab card scale-up animation (from index.html)
    // ============================================================
    if (currentActiveVocabKey && currentActiveVocabKey !== lastHighlightedVocabRef.current) {
      lastHighlightedVocabRef.current = currentActiveVocabKey;
      const vocabEl = document.getElementById('vocab-card-' + currentActiveVocabKey.replace(/[^a-z]/g, ''));
      if (vocabEl) {
        vocabEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        vocabEl.style.transform = 'scale(1.05)';
        vocabEl.style.boxShadow = '0 6px 12px rgba(0,0,0,0.2)';
        setTimeout(() => {
          vocabEl.style.transform = 'scale(1)';
          vocabEl.style.boxShadow = '0 2px 4px rgba(0,0,0,0.15)';
        }, 400);
      }
    }
  }, [currentTime]);

  // ============================================================
  // Export: Pure Canvas Rendering
  // ============================================================
  const exportAbortRef = useRef(false);

  const startRecording = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    exportAbortRef.current = false;
    video.pause();
    video.currentTime = 0;
    setIsPlaying(false);
    setIsRecording(true);
    setRecordingProgress('Preparing...');

    await new Promise(r => setTimeout(r, 300));

    const duration = video.duration;
    if (!duration || !isFinite(duration)) {
      alert('Cannot determine video duration.');
      setIsRecording(false);
      return;
    }

    const FPS = 30; // Increased FPS for smoother canvas output
    const frameInterval = 1 / FPS;
    const totalFrames = Math.ceil(duration * FPS);
    const ctx = canvas.getContext('2d')!;

    // Helper: seek and wait
    const seekTo = (time: number): Promise<void> => {
      return new Promise((resolve) => {
        video.currentTime = Math.min(time, duration);
        const onSeeked = () => { video.removeEventListener('seeked', onSeeked); resolve(); };
        video.addEventListener('seeked', onSeeked);
      });
    };

    // Pre-calculate rendering constants
    const CANVAS_WIDTH = 540;
    const CANVAS_HEIGHT = 960;
    const LEFT_COL_WIDTH = CANVAS_WIDTH * (6.2 / 10);
    const RIGHT_COL_WIDTH = CANVAS_WIDTH * (3.8 / 10);
    const VIDEO_HEIGHT = (CANVAS_HEIGHT - 60 - 20) * 0.42; // Header ~60px, info ~20px

    const drawHeader = (ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, CANVAS_WIDTH, 60);

      // Logo box
      ctx.fillStyle = '#be2121';
      ctx.fillRect(15, 12, 70, 36);
      ctx.fillStyle = '#fff';
      ctx.font = '900 24px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText('时报', 22, 38);

      // Title
      ctx.fillStyle = '#000';
      ctx.font = '900 20px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText('每日全球新闻精听精读', 95, 30);

      ctx.fillStyle = '#be2121';
      ctx.font = 'bold 14px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText('时文精读 | 高效积累8000词', 95, 52);
    };

    const drawInfoBar = (ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = '#be2121';
      ctx.fillRect(0, 60, CANVAS_WIDTH, 20);
      ctx.fillStyle = '#fff';
      ctx.font = '500 11px Arial';
      ctx.fillText(`单词数: ${timings.length}个 | 四六级 | 考研 | 雅思托福`, 15, 74);
      ctx.textAlign = 'right';
      ctx.fillText(`DATE: ${dateStr}`, CANVAS_WIDTH - 15, 74);
      ctx.textAlign = 'left';
    };

    let smoothedVocabScrollY = 0;

    const drawRightSidebar = (ctx: CanvasRenderingContext2D, t: number) => {
      ctx.fillStyle = '#fff';
      ctx.fillRect(LEFT_COL_WIDTH, 80, RIGHT_COL_WIDTH, CANVAS_HEIGHT - 80);

      // --- CD Mock (Spinning) ---
      const cdCenterX = LEFT_COL_WIDTH + RIGHT_COL_WIDTH / 2;
      const cdCenterY = 80 + 25 + 40; // 80(header) + 25(padding) + 40(radius)

      ctx.save();
      // Drop shadow for CD
      ctx.shadowColor = 'rgba(0,0,0,0.2)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 5;

      // Draw the outer CD circle
      ctx.beginPath();
      ctx.arc(cdCenterX, cdCenterY, 40, 0, 2 * Math.PI);
      ctx.fillStyle = '#111'; // Fallback base
      ctx.fill();

      // Clear shadow for internal parts
      ctx.shadowColor = 'transparent';

      ctx.save(); // Save context before spinning parts
      // Apply rotation if playing
      if (isPlaying || isRecording) {
         // 3s per rotation (matches animation: kp-spin 3s linear infinite)
         const rotation = (t % 3) / 3 * (2 * Math.PI);
         ctx.translate(cdCenterX, cdCenterY);
         ctx.rotate(rotation);
         ctx.translate(-cdCenterX, -cdCenterY);
      }

      // Radial gradient for CD surface
      const gradient = ctx.createRadialGradient(cdCenterX, cdCenterY, 0, cdCenterX, cdCenterY, 40);
      gradient.addColorStop(0, '#ddd');
      gradient.addColorStop(0.1, '#171717');
      gradient.addColorStop(0.2, '#111');
      gradient.addColorStop(0.8, '#111');
      gradient.addColorStop(1, '#333');
      ctx.fillStyle = gradient;
      ctx.fill();

      // Outer border
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#eee';
      ctx.stroke();

      // Draw some reflective lines to simulate spinning texture
      ctx.beginPath();
      ctx.moveTo(cdCenterX, cdCenterY - 40);
      ctx.lineTo(cdCenterX, cdCenterY + 40);
      ctx.moveTo(cdCenterX - 40, cdCenterY);
      ctx.lineTo(cdCenterX + 40, cdCenterY);
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore(); // Restore spin
      ctx.restore(); // Restore shadow context

      // --- CD Needle ---
      ctx.save();
      // Draw absolutely fixed at top-right of the CD
      ctx.translate(cdCenterX + 18, cdCenterY - 35);
      ctx.rotate(30 * Math.PI / 180); // 30deg
      ctx.fillStyle = '#555';
      ctx.beginPath();
      ctx.roundRect(-2, -10, 4, 40, 2);
      ctx.fill();
      ctx.restore();

      // CD Text
      ctx.fillStyle = '#000';
      ctx.font = '900 13px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('扫码点读听音频', cdCenterX, cdCenterY + 40 + 20); // 40(radius) + 10(margin) + 10(approx font ascender)

      // Divider
      ctx.fillStyle = '#be2121';
      ctx.font = 'bold 14px Arial';
      ctx.fillText('核心词汇', cdCenterX, 220);

      // Lines
      ctx.beginPath();
      ctx.moveTo(LEFT_COL_WIDTH + 15, 215);
      ctx.lineTo(LEFT_COL_WIDTH + 50, 215);
      ctx.moveTo(CANVAS_WIDTH - 50, 215);
      ctx.lineTo(CANVAS_WIDTH - 15, 215);
      ctx.strokeStyle = '#be2121';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.textAlign = 'left';

      // Vocab List
      let activeVocabIdx = 0;
      for (let i = 0; i < orderedVocabList.length; i++) {
        if (orderedVocabList[i].start <= t) {
          activeVocabIdx = i;
        }
      }

      const viewHeight = CANVAS_HEIGHT - 235;
      const targetVocabScroll = Math.max(0, activeVocabIdx * 55 - (viewHeight / 2));
      smoothedVocabScrollY += (targetVocabScroll - smoothedVocabScrollY) * 0.15;

      ctx.save();
      ctx.beginPath();
      ctx.rect(LEFT_COL_WIDTH, 235, RIGHT_COL_WIDTH, viewHeight);
      ctx.clip();

      let y = 250 - smoothedVocabScrollY;
      orderedVocabList.forEach((item, index) => {
        if (y > CANVAS_HEIGHT) { y += 55; return; }

        let bgColor = '#fff';
        let borderColor = '#be2121';
        let wordColor = '#be2121';

        if (item.def.category === 'school') { borderColor = wordColor = '#d16b6b'; bgColor = '#fffafa'; }
        if (item.def.category === 'phrase') { borderColor = wordColor = '#d97706'; bgColor = '#fffdf5'; }

        // Highlight active vocab simulate DOM scale / shadow
        const isThisActive = index === activeVocabIdx && t >= item.start;

        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.15)';
        ctx.shadowBlur = isThisActive ? 12 : 4;
        ctx.shadowOffsetY = isThisActive ? 4 : 2;

        if (isThisActive) {
           ctx.shadowColor = 'rgba(0,0,0,0.3)';
        }

        // Background
        ctx.fillStyle = bgColor;
        ctx.beginPath();
        const rectW = RIGHT_COL_WIDTH - 30;
        const rectX = LEFT_COL_WIDTH + 15;
        // Simulate scale(1.05) width slightly if active
        // Simplest is to just draw it matching the size
        ctx.roundRect(rectX, y, rectW, 45, 6);
        ctx.fill();

        ctx.shadowColor = 'transparent'; // Remove shadow for rest

        // Border left
        ctx.fillStyle = borderColor;
        ctx.beginPath();
        ctx.roundRect(rectX, y, 4, 45, [6, 0, 0, 6]);
        ctx.fill();

        // Text
        ctx.fillStyle = wordColor;
        ctx.font = '900 19px Arial';
        const cleanText = item.text.replace(/[.,;:!?"')\]]+$/, '');
        ctx.fillText(cleanText, LEFT_COL_WIDTH + 27, y + 20);

        ctx.fillStyle = '#444';
        ctx.font = '500 14px Arial';
        ctx.fillText(item.def.translation, LEFT_COL_WIDTH + 27, y + 38);

        ctx.restore();

        y += 55;
      });
      ctx.restore();
    };

    const drawVideo = (ctx: CanvasRenderingContext2D) => {
       ctx.save();
       ctx.beginPath();
       const vX = 10;
       const vY = 80 + 10; // offset from header/info
       const vW = LEFT_COL_WIDTH - 20;
       const vH = VIDEO_HEIGHT - 20;
       // Rounded corners for video
       ctx.roundRect(vX, vY, vW, vH, 8);
       ctx.clip();

       // Calculate aspect ratio crop (object-fit: cover)
       const vidRatio = video.videoWidth / video.videoHeight;
       const boxRatio = vW / vH;
       let sWidth = video.videoWidth;
       let sHeight = video.videoHeight;
       let sx = 0;
       let sy = 0;

       if (vidRatio > boxRatio) {
           sWidth = video.videoHeight * boxRatio;
           sx = (video.videoWidth - sWidth) / 2;
       } else {
           sHeight = video.videoWidth / boxRatio;
           sy = (video.videoHeight - sHeight) / 2;
       }

       if (video.readyState >= 2) {
           ctx.drawImage(video, sx, sy, sWidth, sHeight, vX, vY, vW, vH);
       } else {
           ctx.fillStyle = '#000';
           ctx.fillRect(vX, vY, vW, vH);
       }
       ctx.restore();

       // Dashed border for left col
       ctx.beginPath();
       ctx.moveTo(LEFT_COL_WIDTH, 80);
       ctx.lineTo(LEFT_COL_WIDTH, CANVAS_HEIGHT);
       ctx.strokeStyle = '#be2121';
       ctx.setLineDash([5, 5]);
       ctx.lineWidth = 1;
       ctx.stroke();
       ctx.setLineDash([]);
    };

    // Pre-calculate lyrics layout
    const LAYOUT_WIDTH = LEFT_COL_WIDTH - 30; // 15px padding each side
    const layout: any[] = [];
    const ctxLayout = document.createElement('canvas').getContext('2d')!;

    // Pass 1: Layout text
    paragraphBlocks.forEach((block, pIdx) => {
        let currentX = 0;
        let currentY = 0;
        let lineHeight = 35; // base line height
        const lines: any[] = [];
        let currentLine: any[] = [];

        ctxLayout.font = '500 20px Arial';

        block.timingChunks.forEach((chunk, cIdx) => {
            const isMultiWord = chunk.timings.length > 1;

            // Calculate total width of entire chunk
            const wordWidgets = chunk.timings.map(w => {
              const punctMatch = w.text.match(/^(.*?[a-zA-Z'-])([.,;:!?"')\]]+)?$/);
              const wordPart = punctMatch ? punctMatch[1] : w.text;
              const punctPart = punctMatch ? (punctMatch[2] || '') : '';
              return { wordPart, punctPart, start: w.start, end: w.end, originalText: w.text };
            });

            const dictKey = (chunk.key || '').toLowerCase();
            const vocabEntry = dict[dictKey];

            // Measure each widget
            const measuredWidgets = wordWidgets.map(w => {
              const wordWidth = ctxLayout.measureText(w.wordPart).width + 6; // +6 for padding
              const punctWidth = w.punctPart ? ctxLayout.measureText(w.punctPart).width + 1 : 0;
              return { ...w, wordWidth, punctWidth, totalWidgetWidth: wordWidth + punctWidth + 2 };
            });

            // Total width of the multi-word chunk
            const totalChunkWidth = measuredWidgets.reduce((acc, curr) => acc + curr.totalWidgetWidth, 0);

            if (currentX + totalChunkWidth > LAYOUT_WIDTH && currentLine.length > 0) {
                // Wrap to next line
                lines.push({ words: currentLine, y: currentY, height: lineHeight });
                currentLine = [];
                currentX = 0;
                currentY += lineHeight + 8; // row gap
            }

            // Assign positions to widgets within the chunk
            const widgetsWithPos = measuredWidgets.map((w, idx) => {
               const pos = {
                 ...w,
                 x: currentX,
                 y: currentY,
                 isVocab: !!vocabEntry,
                 vocabCategory: vocabEntry?.category || '',
                 isFirstInChunk: idx === 0,
                 isLastInChunk: idx === childCount - 1,
                 chunkStart: chunk.timings[0].start,
                 chunkEnd: chunk.timings[chunk.timings.length - 1].end
               };
               currentX += w.totalWidgetWidth;
               return pos;
            });
            const childCount = widgetsWithPos.length;
            widgetsWithPos.forEach((w, idx) => {
                w.isLastInChunk = idx === childCount - 1;
            });

            currentLine.push(...widgetsWithPos);

            // Check if vocab means we need more line height for translation mapping
            if (vocabEntry) {
                lineHeight = Math.max(lineHeight, 45); // Space for Chinese translation
            }

            widgetsWithPos.forEach((posWord) => {
               currentLine.push({
                   ...posWord,
                   x: posWord.x,
                   w: { text: posWord.originalText, start: posWord.start, end: posWord.end },
                   wordPart: posWord.wordPart,
                   punctPart: posWord.punctPart,
                   cleanW: dictKey,
                   vocabEntry: posWord.isFirstInChunk ? vocabEntry : null, // only attach translation to first word item to prevent multiple draws
                   wordWidth: posWord.wordWidth,
                   totalWidth: posWord.totalWidgetWidth,
                   isVocab: !!vocabEntry,
                   chunkStart: posWord.chunkStart,
                   chunkEnd: posWord.chunkEnd,
                   isFirstInChunk: posWord.isFirstInChunk,
                   isLastInChunk: posWord.isLastInChunk
               });
            });
        });

        if (currentLine.length > 0) {
            lines.push({ words: currentLine, y: currentY, height: lineHeight });
            currentY += lineHeight + 8;
        }

        // Add Chinese paragraph
        ctxLayout.font = 'bold 16px "PingFang SC", "Microsoft YaHei", sans-serif';
        const zhLines: any[] = [];
        let zhX = 8; // indent for border
        let zhY = currentY + 10;
        let zhLine = '';

        for (let char of block.zh) {
            const charW = ctxLayout.measureText(char).width;
            if (zhX + charW > LAYOUT_WIDTH) {
                zhLines.push({ text: zhLine, y: zhY });
                zhLine = char;
                zhX = 8 + charW;
                zhY += 24;
            } else {
                zhLine += char;
                zhX += charW;
            }
        }
        if (zhLine) {
            zhLines.push({ text: zhLine, y: zhY });
            zhY += 24;
        }

        layout.push({
            pIdx,
            lines,
            zhLines,
            totalHeight: zhY + 20 // Margin bottom
        });
    });

    const drawLyrics = (ctx: CanvasRenderingContext2D, t: number) => {
        ctx.save();
        const lyricsX = 15;
        let lyricsY = 80 + VIDEO_HEIGHT + 15;

        // Find active word Y to calculate scroll
        let targetScrollY = 0;
        let foundActive = false;

        let activeYCalc = 0;
        layout.forEach(p => {
            p.lines.forEach(l => {
                l.words.forEach(w => {
                    if (t >= w.w.start && t <= w.w.end) {
                        targetScrollY = activeYCalc + l.y;
                        foundActive = true;
                    }
                });
            });
            activeYCalc += p.totalHeight;
        });

        // Smooth scroll simulation
        const viewHeight = CANVAS_HEIGHT - lyricsY;
        const scrollOffset = foundActive ? targetScrollY - (viewHeight / 3) : 0;

        // Clip region
        ctx.beginPath();
        ctx.rect(0, lyricsY, LEFT_COL_WIDTH, viewHeight);
        ctx.clip();

        let currentDrawY = lyricsY - Math.max(0, scrollOffset);

        layout.forEach(p => {
            if (currentDrawY > CANVAS_HEIGHT) return; // Below fold

            p.lines.forEach(l => {
                const lineY = currentDrawY + l.y;
                if (lineY + l.height < lyricsY || lineY > CANVAS_HEIGHT) return; // Culled

                l.words.forEach(w => {
                    const wordX = lyricsX + w.x;
                    const isActive = t >= w.w.start && t <= w.w.end;
                    const isPassed = t > w.w.end;

                    // Draw vocab/active background
                    if (w.vocabEntry) {
                        const cat = w.vocabEntry.category;
                        let bg = '#ffffff';
                        let borderBottom = '#be2121';
                        let borderStroke = '#be2121';
                        let lineDash: number[] = [];

                        if (cat === 'school') { borderBottom = borderStroke = '#c94f6c'; lineDash = [4, 4]; }
                        if (cat === 'phrase') { borderBottom = borderStroke = '#d97706'; lineDash = [2, 2]; }

                        if (isActive || isPassed) {
                            if (cat === 'high_freq') bg = '#fad8d8';
                            if (cat === 'school') bg = '#fbdde4';
                            if (cat === 'phrase') bg = '#fcebd1';
                        }

                        // Draw container
                        ctx.fillStyle = bg;
                        ctx.fillRect(wordX, lineY, w.wordWidth, 24);

                        // Border bottom
                        ctx.fillStyle = borderBottom;
                        ctx.fillRect(wordX, lineY + 24 - 3, w.wordWidth, 3);

                        // Border top/side depending on cat
                        ctx.save();
                        ctx.strokeStyle = borderStroke;
                        ctx.lineWidth = 1;
                        if (lineDash.length > 0) ctx.setLineDash(lineDash);
                        ctx.strokeRect(wordX, lineY, w.wordWidth, 24);
                        ctx.restore();

                        // Chinese Translation if active/passed
                        if (isActive || isPassed) {
                            ctx.fillStyle = borderBottom; // use color
                            ctx.font = 'bold 13px "PingFang SC", "Microsoft YaHei", sans-serif';
                            const zhWidth = ctx.measureText(w.vocabEntry.translation).width;
                            ctx.fillText(w.vocabEntry.translation, wordX + (w.wordWidth/2) - (zhWidth/2), lineY + 38);
                        }
                    } else {
                        if (isActive) {
                            ctx.fillStyle = 'rgba(0,0,0,0.05)';
                            ctx.fillRect(wordX, lineY, w.wordWidth, 24);
                            ctx.fillStyle = '#000';
                            ctx.fillRect(wordX, lineY + 24 - 2, w.wordWidth, 2);
                        } else if (isPassed) {
                            ctx.fillStyle = '#000';
                            ctx.fillRect(wordX, lineY + 24 - 2, w.wordWidth, 2);
                        }
                    }

                    // Draw Word English Text
                    ctx.fillStyle = '#000';
                    ctx.font = '500 20px Arial';

                    // Simulate text-shadow / faux bold
                    if (isActive || w.vocabEntry) {
                        const offset = (w.vocabEntry && isActive) ? 0.6 : (w.vocabEntry ? 0.3 : 0.4);
                        ctx.fillText(w.wordPart, wordX + 3 - offset, lineY + 18);
                        ctx.fillText(w.wordPart, wordX + 3 + offset, lineY + 18);
                    }
                    ctx.fillText(w.wordPart, wordX + 3, lineY + 18);

                    // Draw Punctuation
                    if (w.punctPart) {
                        ctx.fillText(w.punctPart, wordX + w.wordWidth, lineY + 18);
                    }
                });
            });

            // Draw Chinese Paragraph
            p.zhLines.forEach(zl => {
                const zlY = currentDrawY + zl.y;
                if (zlY > lyricsY && zlY < CANVAS_HEIGHT) {
                    ctx.fillStyle = '#be2121';
                    ctx.fillRect(lyricsX, zlY - 14, 3, 16); // left border

                    ctx.font = 'bold 16px "PingFang SC", "Microsoft YaHei", sans-serif';
                    ctx.fillText(zl.text, lyricsX + 8, zlY);
                }
            });

            currentDrawY += p.totalHeight;
        });

        ctx.restore();
    };

    // ---- Pass 1: collect frames offline ----
    const frames: ImageBitmap[] = [];

    for (let i = 0; i <= totalFrames; i++) {
      if (exportAbortRef.current) break;

      const t = Math.min(i * frameInterval, duration);
      await seekTo(t);
      setCurrentTime(t);

      // Let React re-render + DOM settle slightly (although not needed for canvas)
      // await new Promise(r => setTimeout(r, 60));

      // NEW CANVAS RENDER
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      drawHeader(ctx);
      drawInfoBar(ctx);
      drawVideo(ctx);
      drawRightSidebar(ctx, t);
      drawLyrics(ctx, t);

      // Store this frame
      const bmp = await createImageBitmap(canvas);
      frames.push(bmp);

      if (i % 10 === 0) {
        setRecordingProgress(`Pass 1/2 — Rendering frames: ${Math.round((i / totalFrames) * 100)}%`);
      }
    }

    if (exportAbortRef.current || frames.length === 0) {
      setIsRecording(false);
      setRecordingProgress('');
      return;
    }

    // ---- Pass 2: play back frames + audio in real-time ----
    setRecordingProgress('Pass 2/2 — Recording with audio...');

    const canvasEl = canvas as HTMLCanvasElement & { captureStream?: (fps?: number) => MediaStream };
    if (!canvasEl.captureStream) {
      alert('Browser does not support canvas.captureStream().');
      setIsRecording(false);
      return;
    }

    // Draw first frame so canvas stream has content
    ctx.clearRect(0, 0, 540, 960);
    ctx.drawImage(frames[0], 0, 0);

    const canvasStream = canvasEl.captureStream(FPS);

    // Get audio from video
    video.currentTime = 0;
    await new Promise(r => setTimeout(r, 200));
    const videoEl = video as HTMLVideoElement & { captureStream?: (fps?: number) => MediaStream };
    let audioTracks: MediaStreamTrack[] = [];
    if (videoEl.captureStream) {
      audioTracks = videoEl.captureStream().getAudioTracks();
    }

    const combinedStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...audioTracks,
    ]);

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : 'video/webm';

    recordedChunksRef.current = [];
    const recorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: 4_000_000 });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunksRef.current.push(e.data);
    };

    const downloadWhenDone = new Promise<void>((resolve) => {
      recorder.onstop = () => {
        if (!exportAbortRef.current) {
          const blob = new Blob(recordedChunksRef.current, { type: mimeType });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `karaoke-export-${Date.now()}.webm`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
        resolve();
      };
    });

    recorder.start(500);

    // Play audio in sync
    video.currentTime = 0;
    video.play();

    // Draw cached frames at the correct time
    const startWall = performance.now();
    let lastFrameIdx = -1;

    await new Promise<void>((resolve) => {
      const drawLoop = () => {
        if (exportAbortRef.current) { resolve(); return; }

        const elapsed = (performance.now() - startWall) / 1000;
        const frameIdx = Math.min(Math.floor(elapsed * FPS), frames.length - 1);

        if (frameIdx !== lastFrameIdx && frameIdx < frames.length) {
          ctx.clearRect(0, 0, 540, 960);
          ctx.drawImage(frames[frameIdx], 0, 0);
          lastFrameIdx = frameIdx;
        }

        const pct = Math.round((elapsed / duration) * 100);
        setRecordingProgress(`Pass 2/2 — Recording: ${Math.min(pct, 100)}%`);

        if (elapsed >= duration) {
          resolve();
        } else {
          requestAnimationFrame(drawLoop);
        }
      };
      requestAnimationFrame(drawLoop);
    });

    // Stop
    video.pause();
    setIsPlaying(false);
    await new Promise(r => setTimeout(r, 300));
    if (recorder.state === 'recording') recorder.stop();
    await downloadWhenDone;

    // Clean up bitmaps
    frames.forEach(f => f.close());
    setIsRecording(false);
    setRecordingProgress('');
  }, []);

  const stopRecording = useCallback(() => {
    exportAbortRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  return (
    <div className="kp-root" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#2a2a2a', minHeight: '100vh', padding: '30px 0', fontFamily: '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif' }}>
      <style dangerouslySetInnerHTML={{ __html: KARAOKE_CSS }} />

      {/* Hidden canvas for recording */}
      <canvas ref={canvasRef} width={540} height={960} style={{ display: 'none' }} />

      <div style={{ display: 'flex', flexDirection: 'row', gap: '40px', alignItems: 'flex-start', justifyContent: 'center', flexWrap: 'wrap' }}>
        {/* --- Left Column: Video & Controls --- */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Paper wrapper */}
          <div className="kp-paper-wrapper">
            <div className="kp-phone" ref={phoneRef}>
              
              {/* Xiaohongshu 3:4 Mobile Safe Zone Overlay */}
              <div style={{
                position: 'absolute', top: 0, left: 0, width: 540, height: 720,
                border: '4px dashed rgba(255,36,66,0.9)', pointerEvents: 'none', zIndex: 999
              }}>
                <div style={{
                  position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
                  background: 'rgba(255,36,66,0.9)', color: '#fff', fontSize: '14px',
                  padding: '4px 12px', borderRadius: '6px', fontWeight: 'bold', whiteSpace: 'nowrap',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                }}>
                  📸 手机小红书展示安全比例 (3:4)，请截取此虚线框内的所有元素
                </div>
              </div>

          {/* Top header */}
          <div className="kp-top-header">
            <div className="kp-logo-box">时报</div>
            <div className="kp-title-box">
              <div className="kp-title-main">每日全球新闻精听精读</div>
              <div className="kp-title-sub">时文精读 | 高效积累8000词</div>
            </div>
          </div>

          {/* Info bar */}
          <div className="kp-info-bar">
            <span>单词数: {timings.length}个 &nbsp;|&nbsp; 四六级 | 考研 | 雅思托福</span>
            <span>DATE: {dateStr}</span>
          </div>

          {/* Main area */}
          <div className="kp-main-area">
            {/* Left column */}
            <div className="kp-left-col">
              <div className="kp-video-wrapper">
                {videoUrl && (
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    className="kp-video"
                    playsInline
                    onClick={togglePlay}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                  />
                )}
              </div>

              {/* Lyrics */}
              <div className="kp-lyrics-container" ref={lyricsRef}>
                <div className="kp-page-container">
                  {paragraphBlocks.map((block, pIdx) => (
                    <div key={pIdx} className="kp-para-block">
                      <div className="kp-en-para">
                        {block.timingChunks.map((chunk, cIdx) => {
                          const dictKey = (chunk.key || '').toLowerCase();
                          const vocabEntry = dict[dictKey];

                          return (
                            <span
                              key={`${pIdx}-${cIdx}`}
                              className={`kp-word-span${vocabEntry ? ' is-vocab' : ''}`}
                              data-category={vocabEntry?.category || ''}
                              data-multi-start={chunk.timings[0].start}
                              data-multi-end={chunk.timings[chunk.timings.length - 1].end}
                              data-word={dictKey}
                            >
                              <span className="kp-en-container">
                                {chunk.timings.map((w, wIdx) => {
                                  // Strip trailing punctuation from word text
                                  const punctMatch = w.text.match(/^(.*?[a-zA-Z'-])([.,;:!?"')\]]+)?$/);
                                  const wordPart = punctMatch ? punctMatch[1] : w.text;
                                  const punctPart = punctMatch ? (punctMatch[2] || '') : '';

                                  return (
                                    <React.Fragment key={wIdx}>
                                      <span className="kp-en-text-part">{wordPart}</span>
                                      {punctPart && <span className="kp-punct">{punctPart}</span>}
                                      {wIdx < chunk.timings.length - 1 && <span> </span>}
                                    </React.Fragment>
                                  );
                                })}
                              </span>
                              {vocabEntry && (
                                <span className="kp-zh-mean">{vocabEntry.translation}</span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                      <div className="kp-zh-para">{block.zh}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right column */}
            <div className="kp-right-col">
              <div className="kp-cd-mock">
                <div className="kp-cd-wrapper">
                  <div className={`kp-cd-circle kp-cd-disc ${isPlaying ? 'spinning' : ''}`} />
                </div>
              </div>

              <div className="kp-vocab-divider">核心词汇</div>

              <ul className="kp-vocab-list">
                {orderedVocabList.map((item, i) => {
                  // Strip trailing punctuation from vocab display text
                  const cleanText = item.text.replace(/[.,;:!?"')\]]+$/, '');
                  return (
                    <li
                      key={i}
                      id={`vocab-card-${item.key.replace(/[^a-z]/g, '')}`}
                      className={`kp-vocab-item cat-${item.def.category}`}
                    >
                      <div className="kp-vocab-item-top">
                        <span className="kp-en-word">{cleanText}</span>
                      </div>
                      <span className="kp-zh-word">{item.def.translation}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 16, marginTop: 24 }}>
        <button
          onClick={togglePlay}
          disabled={isRecording}
          style={{
            padding: '15px 20px', border: 'none', borderRadius: 8,
            fontSize: 18, fontWeight: 'bold', backgroundColor: '#be2121',
            color: '#fff', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
            opacity: isRecording ? 0.5 : 1,
          }}
        >
          {isPlaying ? '⏸ 暂停' : '▶ 点击播放'}
        </button>

        {!isRecording ? (
          <button
            onClick={startRecording}
            style={{
              padding: '15px 20px', border: 'none', borderRadius: 8,
              fontSize: 18, fontWeight: 'bold', backgroundColor: '#333',
              color: '#fff', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
            }}
          >
            ⬇ 导出视频
          </button>
        ) : (
          <button
            onClick={stopRecording}
            style={{
              padding: '15px 20px', border: 'none', borderRadius: 8,
              fontSize: 18, fontWeight: 'bold', backgroundColor: '#d97706',
              color: '#fff', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
            }}
          >
            ⏹ 停止录制
          </button>
        )}
      </div>

      {isRecording && (
        <div style={{ marginTop: 12, padding: '8px 16px', background: 'rgba(217,119,6,0.9)', color: '#fff', borderRadius: 8, fontSize: 14, fontFamily: 'monospace' }}>
          <span className="kp-rec-dot" />
          {recordingProgress} — 播放完毕后自动下载
        </div>
      )}
      </div> {/* End Left Column */}

      {/* --- Right Column: Xiaohongshu Copy Area --- */}
      {xiaohongshuCopy ? (
        <div style={{ width: '100%', maxWidth: 450, display: 'flex', flexDirection: 'column', background: '#fff', padding: 24, borderRadius: 16, boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
          <h2 style={{ fontSize: 20, fontWeight: 'bold', color: '#be2121', marginBottom: 16, borderBottom: '2px solid #f1f2f6', paddingBottom: 10 }}>📝 小红书爆款文案</h2>
          <textarea
            readOnly
            value={xiaohongshuCopy}
            style={{
              width: '100%', height: 400, padding: 12, borderRadius: 8, border: '1px solid #ddd',
              fontSize: 15, fontFamily: 'sans-serif', color: '#333', resize: 'vertical', lineHeight: 1.5,
              marginBottom: 16, backgroundColor: '#f9f9f9'
            }}
          />
          <button
            onClick={(e) => {
              navigator.clipboard.writeText(xiaohongshuCopy);
              const target = e.currentTarget;
              const oldText = target.textContent;
              target.textContent = '✅ 已复制（去小红书粘贴）！';
              setTimeout(() => { target.textContent = oldText; }, 3000);
            }}
            style={{
              padding: '12px 15px', border: 'none', borderRadius: 8,
              fontSize: 16, fontWeight: 'bold', backgroundColor: '#2b8a3e',
              color: '#fff', cursor: 'pointer', alignSelf: 'stretch',
              boxShadow: '0 4px 10px rgba(43,138,62,0.3)', transition: 'all 0.2s'
            }}
          >
            📋 一键复制小红书文案
          </button>
        </div>
      ) : (
        <div style={{ width: 450, padding: 24, textAlign: 'center', color: '#999', alignSelf: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: 16 }}>
          文案正在生成或未找到...
        </div>
      )}

      </div> {/* End Flex Row Layout */}
    </div>
  );
}
