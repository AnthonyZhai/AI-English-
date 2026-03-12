import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* FFmpeg.wasm 特别需要这两个 Header 来开启允许浏览器内的多线程 (SharedArrayBuffer) */
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
