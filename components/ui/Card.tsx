// Card — clean-redesign v3 디자인 시스템 (spec 3.3)
// 단일 변형, 페이지별 액센트 보더 옵션.

import type { HTMLAttributes, ReactNode } from "react";

type CardAccent = "none" | "tiger-orange" | "deep-navy" | "emerald" | "soft-sand";

const ACCENT: Record<CardAccent, string> = {
  none: "border-gray-200",
  "tiger-orange": "border-tiger-orange/40 hover:border-tiger-orange",
  "deep-navy": "border-deep-navy/40 hover:border-deep-navy",
  emerald: "border-emerald-600/40 hover:border-emerald-600",
  "soft-sand": "border-soft-sand bg-soft-sand/30",
};

export function Card({
  accent = "none",
  className = "",
  children,
  ...rest
}: {
  accent?: CardAccent;
  className?: string;
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={`rounded-2xl border ${ACCENT[accent]} bg-white p-6 transition ${className}`}
    >
      {children}
    </div>
  );
}
