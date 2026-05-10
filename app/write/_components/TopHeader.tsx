// app/write/_components/TopHeader.tsx
// 책 제목 · "← 내 책으로" 링크 · 잔액 · 내보내기 버튼 (sticky top)
// 모든 탭에서 공통으로 보임.

"use client";
import Link from "next/link";

interface MissingItem {
  label: string;
  hint: string;
  tab: string;
}

interface Props {
  topic?: string | null;
  balanceKrw?: number | null;
  onExport?: () => void;
  exportDisabled?: boolean;
  // 진행률 (0-100) — 본문/표지/마케팅/Meta 광고 4항목 기준
  progressPercent?: number;
  progressDone?: number;
  progressTotal?: number;
  missingItems?: MissingItem[];   // 빠진 항목 구체 리스트 (label+hint+탭)
  onGoToTab?: (tab: string) => void;  // "지금 가기" 클릭 시 호출
}

export function TopHeader({ topic, balanceKrw, onExport, exportDisabled, progressPercent, progressDone, progressTotal, missingItems, onGoToTab }: Props) {
  const handleExport = () => {
    if (typeof progressPercent === "number" && progressPercent < 100 && onExport && missingItems && missingItems.length > 0) {
      const lines = missingItems.map(m => `✗ ${m.label}\n   → ${m.hint}`).join("\n\n");
      const ok = confirm(
        `⚠️ 패키지 ${progressPercent}% — 아직 빠진 자료가 있습니다:\n\n${lines}\n\n` +
        `[취소]를 누르면 위 항목 만든 후 내보낼 수 있습니다.\n` +
        `[확인]을 누르면 지금 상태 그대로 내보내기 페이지로 갑니다.`
      );
      if (!ok) {
        // 첫 번째 빠진 항목의 탭으로 자동 이동
        const firstTab = missingItems[0]?.tab;
        if (firstTab && onGoToTab) onGoToTab(firstTab);
        return;
      }
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
