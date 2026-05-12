// Section — clean-redesign v3 디자인 시스템 (spec 3.3)
// 표준 섹션 컨테이너: max-w-6xl + py + 디바이더 + 옵션 헤더 (eyebrow + title + description).

import type { ReactNode } from "react";

type SectionAccent = "tiger-orange" | "deep-navy" | "emerald";

const ACCENT_TEXT: Record<SectionAccent, string> = {
  "tiger-orange": "text-tiger-orange",
  "deep-navy": "text-deep-navy",
  emerald: "text-emerald-600",
};

const ACCENT_BAR: Record<SectionAccent, string> = {
  "tiger-orange": "bg-tiger-orange",
  "deep-navy": "bg-deep-navy",
  emerald: "bg-emerald-600",
};

export function Section({
  id,
  eyebrow,
  title,
  description,
  accent = "tiger-orange",
  divider = true,
  background,
  className = "",
  children,
}: {
  id?: string;
  eyebrow?: string;
  title?: ReactNode;
  description?: ReactNode;
  accent?: SectionAccent;
  divider?: boolean;
  background?: "base" | "elevated" | "subtle";
  className?: string;
  children?: ReactNode;
}) {
  const bgCls =
    background === "elevated"
      ? "bg-white"
      : background === "subtle"
      ? "bg-soft-sand/30"
      : "";

  return (
    <>
      {divider && <div className="border-t border-gray-200" />}
      <section id={id} className={`py-24 md:py-32 ${bgCls} ${className}`}>
        <div className="max-w-6xl mx-auto px-6">
          {(eyebrow || title || description) && (
            <header className="mb-16">
              {eyebrow && (
                <div
                  className={`inline-flex items-center gap-2 text-xs font-mono uppercase tracking-[0.2em] ${ACCENT_TEXT[accent]}`}
                >
                  <span className={`w-6 h-px ${ACCENT_BAR[accent]}`} />
                  {eyebrow}
                </div>
              )}
              {title && (
                <h2 className="mt-4 text-4xl md:text-5xl font-black tracking-tight text-ink-900">
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-3 text-gray-600 max-w-xl text-base md:text-lg">
                  {description}
                </p>
              )}
            </header>
          )}
          {children}
        </div>
      </section>
    </>
  );
}
