import ClientOnlyExtractor from "./components/ClientOnlyExtractor";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-4xl space-y-8">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-4">
            AI 英文精读神器 <span className="text-blue-600">MVP版</span>
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            上传原视频，浏览器将直接切离小体积音频并上传。随后将利用大模型与数据流驱动，最终为您渲染绝美的双排卡拉OK视频。
          </p>
        </header>

        <main>
          {/* 挂载 Client 专用跳过 SSR 的音频提取包围组件 */}
          <ClientOnlyExtractor />
        </main>

        <footer className="text-center text-gray-400 text-sm mt-16 pb-8">
          Powered by Next.js & FFmpeg.wasm & Convex
        </footer>
      </div>
    </div>
  );
}
