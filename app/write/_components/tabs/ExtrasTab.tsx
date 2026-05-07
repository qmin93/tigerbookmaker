// app/write/_components/tabs/ExtrasTab.tsx
// 콘텐츠 확장 탭 — 오디오북·강의 슬라이드·번역·재가공 5채널

"use client";
import type { ReactNode } from "react";

interface Props {
  audiobookBox?: ReactNode;
  courseSlidesBox?: ReactNode;
  translationBox?: ReactNode;
  repurposeBox?: ReactNode;
}

export function ExtrasTab({ audiobookBox, courseSlidesBox, translationBox, repurposeBox }: Props) {
  return (
    <div className="p-3 space-y-4">
      <SectionTitle icon="📻" label="오디오북" />
      {audiobookBox}

      <SectionTitle icon="🎓" label="강의 슬라이드" />
      {courseSlidesBox}

      <SectionTitle icon="🌐" label="책 번역 (영/일)" />
      {translationBox}

      <SectionTitle icon="📱" label="콘텐츠 재가공 (5채널)" />
      {repurposeBox}
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
