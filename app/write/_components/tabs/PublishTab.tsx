// app/write/_components/tabs/PublishTab.tsx
// 출간 준비 탭 — 마케팅 페이지·크몽 가이드·Meta 광고·인포그래픽·미리보기 영상·패키지 추천

"use client";
import type { ReactNode } from "react";

interface Props {
  marketingPageBox?: ReactNode;
  metaAdsBox?: ReactNode;
  packageRecommendationBox?: ReactNode;
  infographicBox?: ReactNode;
  previewVideoBox?: ReactNode;
}

export function PublishTab({
  marketingPageBox, metaAdsBox, packageRecommendationBox, infographicBox, previewVideoBox,
}: Props) {
  return (
    <div className="p-3 space-y-4">
      <SectionTitle icon="🔗" label="마케팅 페이지" />
      {marketingPageBox}

      <SectionTitle icon="📦" label="패키지 추천 (1-click)" />
      {packageRecommendationBox}

      <SectionTitle icon="📣" label="Meta 광고" />
      {metaAdsBox}

      <SectionTitle icon="📚" label="카드뉴스 인포그래픽" />
      {infographicBox}

      <SectionTitle icon="🎬" label="미리보기 영상 frames" />
      {previewVideoBox}
    </div>
  );
}

function SectionTitle({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 px-1 pt-2 first:pt-0">
      {icon} {label}
    </div>
  );
}
