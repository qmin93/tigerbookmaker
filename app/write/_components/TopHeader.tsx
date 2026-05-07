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
}

export function TopHeader({ topic, balanceKrw, onExport, exportDisabled }: Props) {
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
            onClick={onExport}
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
