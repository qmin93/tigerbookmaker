// app/write/_components/TopHeader.tsx
// 책 제목 · "← 내 책" · 단계 진행률 + 다음 버튼 · 잔액 · 내보내기 (sticky top, 어두운 배경)
//
// 단계: ① 집필 → ② 표지 → ③ 마케팅 → ④ Meta 광고 → 📥 내보내기
// 각 단계 클릭 시 해당 탭+섹션으로 scroll. "다음 →" 누르면 첫 미완료 단계로 자동 이동.
// 다 완료되면 "다음 →" 자리에 "📥 내보내기" 강조 표시.

"use client";
import Link from "next/link";
import { useState } from "react";
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
  const [confirmOpen, setConfirmOpen] = useState(false);
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
      setConfirmOpen(true);
      return;
    }
    onExport?.();
  };

  const confirmExportAnyway = () => {
    setConfirmOpen(false);
    onExport?.();
  };

  const goToFirstMissing = () => {
    setConfirmOpen(false);
    const firstTab = missingItems?.[0]?.tab;
    if (firstTab && onGoToTab) onGoToTab(firstTab);
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

        {/* 우측 — 다음 버튼 (미완성 시) / 잔액 / 내보내기 (다 완료면 강조) */}
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          {progressItems && progressItems.length > 0 && !allDone && nextStep && (
            <button
              type="button"
              onClick={handleNext}
              className="px-3 py-1.5 bg-yellow-400 text-yellow-900 text-xs font-bold rounded hover:bg-yellow-300 transition"
              title={`다음 단계로: ${nextStep.label}`}
            >
              다음: {nextStep.emoji} {nextStep.label} →
            </button>
          )}
          {balanceKrw != null && (
            <Link
              href="/billing"
              className="hidden md:inline-block text-xs text-gray-300 hover:text-white px-2 py-1 rounded hover:bg-ink-800 transition"
            >
              ₩{balanceKrw.toLocaleString()}
            </Link>
          )}
          {/* 내보내기 버튼 — 다 완료면 그라디언트·깜빡 / 미완성이면 평범한 흰색 */}
          <button
            type="button"
            onClick={handleExport}
            disabled={exportDisabled || !onExport}
            className={`px-3 py-1.5 text-xs font-bold rounded disabled:opacity-50 transition ${
              allDone
                ? "bg-gradient-to-r from-tiger-orange to-orange-600 text-white shadow-glow-orange-sm hover:opacity-90 animate-pulse"
                : "bg-white text-ink-900 hover:bg-gray-100"
            }`}
            title={allDone ? "🎉 모든 단계 완료 — 내보내기" : "내보내기 (단계 미완성 시 confirm)"}
          >
            {allDone ? "🎉 내보내기 →" : "📥 내보내기"}
          </button>
        </div>
      </div>

      {/* 내보내기 confirm modal — 빠진 자료 안내 */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="bg-white text-ink-900 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* 헤더 — 그라디언트 + 진행률 */}
            <div className="bg-gradient-to-r from-yellow-400 to-orange-400 p-6">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-3xl">⚠️</span>
                <div>
                  <h3 className="text-lg font-black tracking-tight text-yellow-900">패키지 미완성</h3>
                  <p className="text-xs text-yellow-900/80">아직 만들어야 할 자료가 있어요</p>
                </div>
                <div className="ml-auto text-right">
                  <div className="text-2xl font-black text-yellow-900">{progressPercent ?? 0}%</div>
                  <div className="text-[10px] text-yellow-900/80">완성도</div>
                </div>
              </div>
              {typeof progressPercent === "number" && (
                <div className="mt-3 w-full h-2 bg-yellow-900/15 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-900/60 transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              )}
            </div>

            {/* 빠진 항목 리스트 */}
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                아래 자료가 빠져 있어요. 외부 마켓 등록 시 다시 만들어야 할 수 있습니다.
              </p>
              <div className="space-y-2.5 mb-6">
                {missingItems?.map((m, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-xs font-bold">✗</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-gray-900">{m.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{m.hint}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 액션 버튼 */}
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={goToFirstMissing}
                  className="flex-1 py-3 bg-tiger-orange text-white font-bold rounded-lg hover:bg-orange-600 transition shadow-glow-orange-sm"
                >
                  ✨ 만들러 가기
                </button>
                <button
                  onClick={confirmExportAnyway}
                  className="flex-1 py-3 border-2 border-gray-300 text-gray-700 font-bold rounded-lg hover:border-gray-500 hover:bg-gray-50 transition"
                >
                  지금 그대로 내보내기
                </button>
              </div>
              <button
                onClick={() => setConfirmOpen(false)}
                className="w-full mt-2 py-2 text-xs text-gray-400 hover:text-gray-700"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
