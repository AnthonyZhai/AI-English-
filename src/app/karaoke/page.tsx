'use client';

import dynamic from 'next/dynamic';

const KaraokePageContent = dynamic(() => import('./KaraokePageContent'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#2a2a2a]">
      <div className="w-12 h-12 border-4 border-gray-600 border-t-white rounded-full animate-spin" />
      <p className="text-white mt-4 text-sm">Loading karaoke data...</p>
    </div>
  ),
});

export default function KaraokePage() {
  return <KaraokePageContent />;
}
