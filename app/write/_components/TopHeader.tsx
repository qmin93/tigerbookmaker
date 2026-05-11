// app/write/_components/TopHeader.tsx
// 책 제목 · "← 내 책" · 단계 진행률 + 다음 버튼 · 잔액 · 내보내기 (sticky top, 어두운 배경)
//
// 단계: ① 집필 → ② 표지 → ③ 마케팅 → ④ Meta 광고 → 📥 내보내기
// 각 단계 클릭 시 해당 탭+섹션으로 scroll. "다음 →" 누르면 첫 미완료 단계로 자동 이동.
// 다 완료되면 "다음 →" 자리에 "📥 내보내기" 강조 표시.

"use client";
import Link from "next/link";
import type { ProgressItem } from "@/lib/export-bundle";

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
  // 단계 정보
  progressItems?: ProgressItem[];
  currentTab?: string;
  onGoToTab?: (tab: string) => void;
  // confirm용 (변경 없음)
  progressPercent?: number;
  missingItems?: MissingItem[];
}

interface Step {
  num: number;
  emoji: string;
  label: string;
  itemKeys: string[];
  tab: string;
  anchor: string;
}

const STEPS: Step[] = [
  { num: 1, emoji: "✏️", label: "집필",      itemKeys: ["chapters"],                       tab: "writing", anchor: "writing-section-chapters" },
  { num: 2, emoji: "🎨", label: "표지",      itemKeys: ["cover"],                          tab: "writing", anchor: "writing-section-cover" },
  { num: 3, emoji: "📝", label: "마케팅",    itemKeys: ["marketing"],                      tab: "publish", anchor: "publish-section-marketing" },
  { num: 4, emoji: "📣", label: "Meta 광고", itemKeys: ["meta-ad-copy", "meta-ad-images"], tab: "publish", anchor: "publish-section-meta-ads" },
];

function flashHighlight(el: HTMLElement) {
  el.style.transition = "box-shadow 0.3s, background-color 0.3s";
  el.style.boxShadow = "0 0 0 3px rgba(249, 115, 22, 0.6)";
  el.style.backgroundColor = "rgba(255, 247, 237, 0.6)";
  setTimeout(() => { el.style.boxShadow = ""; el.style.backgroundColor = ""; }, 1500);
}

function scrollToAnchor(anchor: string | undefined) {
  if (!anchor) return;
  const el = document.getElementById(anchor);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  flashHighlight(el);
}

export function TopHeader({
  topic, balanceKrw, onExport, exportDisabled,
  progressItems, currentTab, onGoToTab,
  progressPercent, missingItems,
}: Props) {
  // 단계별 done 계산
  const stepStatuses = STEPS.map(s => {
    const list = (progressItems ?? []).filter(p => s.itemKeys.includes(p.key));
    const doneCount = list.filter(i => i.done).length;
    return {
      ...s,
      doneCount,
      totalCount: list.length,
      done: list.length > 0 && doneCount === list.length,
    };
  });
  const currentStepIdx = stepStatuses.findIndex(s => !s.done);
  const allDone = currentStepIdx === -1;
  const nextStep = currentStepIdx >= 0 ? stepStatuses[currentStepIdx] : null;

  const goToStep = (s: typeof stepStatuses[number]) => {
    if (s.tab === currentTab) {
      scrollToAnchor(s.anchor);
    } else {
      onGoToTab?.(s.tab);
      setTimeout(() => scrollToAnchor(s.anchor), 200);
    }
  };

  const handleNext = () => {
    if (nextStep) {
      goToStep(nextStep);
    } else {
      onExport?.();
    }
  };

  const handleExport = () => {
    if (typeof progressPercent === "number" && progressPercent < 100 && onExport && missingItems && missingItems.length > 0) {
      const lines = missingItems.map(m => `✗ ${m.label}\n   → ${m.hint}`).join("\n\n");
      const ok = confirm(
        `⚠️ 패키지 ${progressPercent}% — 아직 빠진 자료가 있습니다:\n\n${lines}\n\n` +
        `[취소]를 누르면 위 항목 만든 후 내보낼 수 있습니다.\n` +
        `[확인]을 누르면 지금 상태 그대로 내보내기 페이지로 갑니다.`
      );
      if (!ok) {
        const firstTab = missingItems[0]?.tab;
        if (firstTab && onGoToTab) onGoToTab(firstTab);
        return;
      }
    }
    onExport?.();
  };

  return (
    <header className="sticky top-0 z-30 bg-ink-900 text-white border-b border-ink-800">
      <div className="max-w-[1600px] mx-auto px-3 md:px-4 py-2 flex items-center gap-2 md:gap-3 overflow-x-auto whitespace-nowrap">
        {/* 좌측 — 내 책 + 제목 */}
        <Link
          href="/projects"
          className="text-[10px] font-mono uppercase tracking-wider text-gray-400 hover:text-white py-1 px-1 transition flex-shrink-0"
        >
          ← 내 책
        </Link>
        {topic && (
          <h1 className="hidden lg:block text-xs font-bold tracking-tight truncate text-white max-w-[220px] flex-shrink-0">
            {topic}
          </h1>
        )}
        <span className="hidden md:block text-gray-700 flex-shrink-0">|</span>

        {/* 단계 wizard — 가운데 영역 */}
        {progressItems && progressItems.length > 0 && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {stepStatuses.map((step, idx) => {
              const isCurrent = !allDone && idx === currentStepIdx;
              const isLocked = !step.done && !isCurrent && idx > currentStepIdx;

              let cls = "";
              let numCls = "";
              if (step.done) {
                cls = "bg-tiger-orange/20 border-tiger-orange/40 text-orange-200 hover:bg-tiger-orange/30";
                numCls = "bg-tiger-orange text-white";
              } else if (isCurrent) {
                cls = "bg-yellow-400/20 border-yellow-400 text-yellow-200 hover:bg-yellow-400/30 ring-1 ring-yellow-400/60 animate-pulse";
                numCls = "bg-yellow-400 text-yellow-900";
              } else if (isLocked) {
                cls = "bg-ink-800 border-ink-700 text-gray-500 hover:bg-ink-700 opacity-60";
                numCls = "bg-ink-700 text-gray-500";
              } else {
                cls = "bg-ink-800 border-ink-700 text-gray-300 hover:bg-ink-700";
                numCls = "bg-ink-700 text-gray-300";
              }

              return (
                <div key={step.num} className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => goToStep(step)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded border ${cls} transition`}
                    title={`${step.label} (${step.doneCount}/${step.totalCount})`}
                  >
                    <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${numCls}`}>
                      {step.done ? "✓" : step.num}
                    </span>
                    <span className="hidden sm:inline text-xs font-bold">{step.emoji} {step.label}</span>
                    <span className="sm:hidden text-xs font-bold">{step.emoji}</span>
                  </button>
                  {idx < stepStatuses.length - 1 && (
                    <span className={`text-xs flex-shrink-0 ${stepStatuses[idx].done ? "text-tiger-orange" : "text-gray-600"}`}>→</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 우측 — 다음 버튼 + 잔액 + 내보내기 */}
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          {progressItems && progressItems.length > 0 && (
            allDone ? (
              <button
                type="button"
                onClick={onExport}
                disabled={exportDisabled}
                className="px-3 py-1.5 bg-gradient-to-r from-tiger-orange to-orange-600 text-white text-xs font-bold rounded shadow-glow-orange-sm hover:opacity-90 disabled:opacity-50 transition animate-pulse"
                title="모든 단계 완료! 내보내기로 진행"
              >
                🎉 내보내기 →
              </button>
            ) : nextStep ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-3 py-1.5 bg-yellow-400 text-yellow-900 text-xs font-bold rounded hover:bg-yellow-300 transition"
                title={`다음 단계로: ${nextStep.label}`}
              >
                다음: {nextStep.emoji} {nextStep.label} →
              </button>
            ) : null
          )}
          {balanceKrw != null && (
            <Link
              href="/billing"
              className="hidden md:inline-block text-xs text-gray-300 hover:text-white px-2 py-1 rounded hover:bg-ink-800 transition"
            >
              ₩{balanceKrw.toLocaleString()}
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
