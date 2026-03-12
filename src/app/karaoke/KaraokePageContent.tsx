'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getLatestKaraokeData } from '../../lib/karaokeStore';
import KaraokePlayer from '../components/KaraokePlayer';

export default function KaraokePageContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [wordTimings, setWordTimings] = useState<any[]>([]);
  const [analysisData, setAnalysisData] = useState<any>({});

  useEffect(() => {
    (async () => {
      try {
        const data = await getLatestKaraokeData();
        if (!data) {
          setError('No karaoke session found. Please process a video first.');
          setLoading(false);
          return;
        }

        // Reconstruct File from ArrayBuffer
        const blob = new Blob([data.videoBuffer], { type: data.videoMimeType });
        const file = new File([blob], 'video.' + (data.videoMimeType.includes('mp4') ? 'mp4' : 'webm'), {
          type: data.videoMimeType,
        });

        setVideoFile(file);
        setWordTimings(data.wordTimings);
        setAnalysisData(data.analysis);
        setLoading(false);
      } catch (err: any) {
        console.error('Failed to load karaoke data:', err);
        setError('Failed to load karaoke data: ' + (err.message || 'Unknown error'));
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#2a2a2a]">
        <div className="w-12 h-12 border-4 border-gray-600 border-t-white rounded-full animate-spin" />
        <p className="text-white mt-4 text-sm">Loading karaoke data from storage...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#2a2a2a] gap-4">
        <p className="text-red-400 text-lg font-semibold">{error}</p>
        <button
          onClick={() => router.push('/')}
          className="px-6 py-2 bg-[#be2121] text-white rounded-lg hover:bg-red-800 transition"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (!videoFile) return null;

  return <KaraokePlayer videoFile={videoFile} timings={wordTimings} analysis={analysisData} />;
}
