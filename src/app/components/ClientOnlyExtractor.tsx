'use client';

import dynamic from "next/dynamic";

// 在严格的 "use client" 组件中包裹这层不支持 SSR 的大组件库调用
const AudioExtractor = dynamic(
  () => import("./AudioExtractor"),
  { ssr: false }
);

export default function ClientOnlyExtractor() {
  return <AudioExtractor />;
}