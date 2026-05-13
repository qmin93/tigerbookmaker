// PWA manifest — 모바일에서 "홈 화면 추가" 가능. Next.js 14 표준.

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tigerbookmaker — 30분에 한 권. AI 전자책",
    short_name: "Tigerbookmaker",
    description:
      "한국어 AI 전자책 30분 자동 집필 — 크몽 부수익 시스템",
    start_url: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#f97316",
    orientation: "portrait",
    lang: "ko-KR",
    categories: ["productivity", "books", "business"],
    icons: [
      {
        src: "/icon",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
