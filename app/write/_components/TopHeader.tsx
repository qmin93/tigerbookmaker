// app/write/_components/TopHeader.tsx
// 책 제목 · "← 내 책으로" 링크 · 잔액 · 내보내기 버튼 (sticky top)
// 모든 탭에서 공통으로 보임.

"use client";
import Link from "next/link";

interface Props {
  topic?: string | null;
  balanceKrw?: number | null;
  onExport?: () => void;
  exportDisabled?: boolean;
  // 진행률 (0-100) — 본문/표지/마케팅/Meta 광고 4항목 기준
  progressPercent?: number;
  progressDone?: number;
  progressTotal?: number;
}

export function TopHeader({ topic, balanceKrw, onExport, exportDisabled, progressPercent, progressDone, progressTotal }: Props) {
  const handleExport = () => {
    if (typeof progressPercent === "number" && progressPercent < 100 && onExport) {
      const ok = confirm(
        `⚠️ 패키지가 아직 ${progressPercent}% 완성입니다.\n\n` +
        `빠진 자료(마케팅 카피·Meta 광고 등)가 있으면 외부 마켓 등록 시 다시 만들어야 합니다.\n\n` +
        `그래도 지금 내보내기로 가시겠어요? (publish/extras 탭에서 마저 만들 수 있습니다)`
      );
      if (!ok) return;
    }
    onExport?.();
  };

  return (
    <header className="sticky top-0 z-30 bg-ink-900 text-white border-b border-ink-800">
      <div className="max-w-[1600px] mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/projects"
            className="text-[10px] font-mono uppercase tracking-wider text-gray-400 hover:text-white py-1 px-1 -mx-1 transition flex-shrink-0"
          >
            ← 내 책
          </Link>
          {topic && (
            <h1 className="text-sm md:text-base font-bold tracking-tight truncate text-white">
              {topic}
            </h1>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* 진행률 chip — 패키지 준비 정도 한눈에 */}
          {typeof progressPercent === "number" && (
            <div
              className={`hidden sm:flex items-center gap-1.5 text-[11px] font-mono px-2 py-1 rounded ${
                progressPercent === 100 ? "bg-tiger-orange/20 text-tiger-orange" : "bg-ink-800 text-gray-300"
              }`}
              title={`패키지 ${progressDone ?? 0}/${progressTotal ?? 0} 항목 완료 (본문·표지·마케팅·Meta 광고)`}
            >
              <span className="font-bold">{progressPercent}%</span>
              <span className="opacity-70">패키지</span>
            </div>
          )}
          {balanceKrw != null && (
            <Link
              href="/billing"
              className="hidden sm:inline-block text-xs text-gray-300 hover:text-white px-2 py-1 rounded hover:bg-ink-800 transition"
            >
              잔액 ₩{balanceKrw.toLocaleString()}
            </Link>
          )}
          <button
            type="button"
            onClick={handleExport}
            disabled={exportDisabled || !onExport}
            className="px-3 py-1.5 bg-white text-ink-900 text-xs font-bold rounded hover:bg-gray-100 disabled:opacity-50 transition"
          >
            📥 내보내기
          </button>
        </div>
      </div>
    </header>
  );
}
