// app/write/_components/tabs/WritingTab.tsx
// 본문 탭 — 일괄 집필 · 목차 재생성 · 본문 이미지 일괄 · 표지 다양화 · 레이아웃 템플릿
// 실제 컨트롤 children은 page.tsx에서 props로 전달.

"use client";
import type { ReactNode } from "react";

interface Props {
  bulkWritingControls?: ReactNode;
  bulkImageControls?: ReactNode;
  coverVariationsControls?: ReactNode;
  templateSelector?: ReactNode;
}

export function WritingTab({
  bulkWritingControls, bulkImageControls, coverVariationsControls, templateSelector,
}: Props) {
  return (
    <div className="p-3 space-y-4">
      <div id="writing-section-chapters" className="scroll-mt-32 rounded-lg p-1 -m-1">
        <SectionTitle icon="✍️" label="본문 일괄 작업" />
        {bulkWritingControls}
      </div>

      <SectionTitle icon="🖼" label="본문 이미지" />
      {bulkImageControls}

      <div id="writing-section-cover" className="scroll-mt-32 rounded-lg p-1 -m-1">
        <SectionTitle icon="🎨" label="표지 다양화" />
        {coverVariationsControls}
      </div>

      <SectionTitle icon="📐" label="레이아웃 템플릿" />
      {templateSelector}
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
