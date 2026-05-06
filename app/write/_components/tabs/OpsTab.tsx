// app/write/_components/tabs/OpsTab.tsx
// 운영 탭 — 공유 링크·A/B 테스트·매출 입력·크몽 패키지 생성

"use client";
import type { ReactNode } from "react";

interface Props {
  shareToggleBox?: ReactNode;
  abTestBox?: ReactNode;
  revenueBox?: ReactNode;
  kmongPackageBox?: ReactNode;
}

export function OpsTab({ shareToggleBox, abTestBox, revenueBox, kmongPackageBox }: Props) {
  return (
    <div className="p-3 space-y-4">
      <SectionTitle icon="🔓" label="공유 링크" />
      {shareToggleBox}

      <SectionTitle icon="📦" label="크몽 패키지 생성" />
      {kmongPackageBox}

      <SectionTitle icon="⚖️" label="A/B 테스트" />
      {abTestBox}

      <SectionTitle icon="💰" label="매출 입력" />
      {revenueBox}
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
