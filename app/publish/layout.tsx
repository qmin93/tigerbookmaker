// /publish 메타데이터 — page.tsx가 "use client"라 layout.tsx에서 export.
// SEO + 카톡 공유 카드용.

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "다중 플랫폼 책 등록 — 크몽 · 부크크 · 유페이퍼 자동 패키지",
  description:
    "한국 3개 전자책 플랫폼(크몽·부크크·유페이퍼) 동시 등록 패키지 자동 생성. 제목 · 상세설명 · 카테고리 · 키워드 · 가격 추천 + Meta 광고 이미지 3비율까지.",
  keywords: ["크몽 등록", "부크크 등록", "유페이퍼 등록", "전자책 출판"],
  openGraph: {
    title: "다중 플랫폼 책 등록 — Tigerbookmaker",
    description: "크몽 · 부크크 · 유페이퍼 동시 등록. 제목 · 설명 · 키워드 · 가격 자동.",
  },
};

export default function PublishLayout({ children }: { children: React.ReactNode }) {
  return children;
}
