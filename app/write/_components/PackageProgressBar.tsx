// app/write/_components/PackageProgressBar.tsx
// Step-by-step wizard 형태의 패키지 진행 바.
// ① 집필 → ② 표지 → ③ 마케팅 카피 → ④ Meta 광고 → 📥 내보내기
// 각 step은 prominent한 버튼 카드. 완료(주황 ✓) / 진행 차례(노랑 깜빡) / 잠김(회색).
// 클릭 시 해당 탭 + 섹션으로 scroll + highlight.

"use client";
import type { ProgressItem } from "@/lib/export-bundle";

interface Props {
  items: ProgressItem[];
  currentTab: string;
  onGoToTab: (tab: string) => void;
}

function flashHighlight(el: HTMLElement) {
  el.style.transition = "box-shadow 0.3s, background-color 0.3s";
  el.style.boxShadow = "0 0 0 3px rgba(249, 115, 22, 0.6)";
  el.style.backgroundColor = "rgba(255, 247, 237, 0.6)";
  setTimeout(() => {
    el.style.boxShadow = "";
    el.style.backgroundColor = "";
  }, 1500);
}

function scrollToAnchor(anchor: string | undefined) {
  if (!anchor) return;
  const el = document.getElementById(anchor);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  flashHighlight(el);
}

// 5개 항목 → 4단계로 통합 (마케팅 = 마케팅카피만, 광고 = Meta카피+이미지)
interface Step {
  num: number;
  emoji: string;
  label: string;
  itemKeys: string[];   // ProgressItem.key 매핑 (모두 done이면 step 완료)
  tab: string;
  anchor: string;
}

const STEPS: Step[] = [
  { num: 1, emoji: "✏️", label: "집필",       itemKeys: ["chapters"],                          tab: "writing", anchor: "writing-section-chapters" },
  { num: 2, emoji: "🎨", label: "표지",       itemKeys: ["cover"],                             tab: "writing", anchor: "writing-section-cover" },
  { num: 3, emoji: "📝", label: "마케팅",     itemKeys: ["marketing"],                         tab: "publish", anchor: "publish-section-marketing" },
  { num: 4, emoji: "📣", label: "Meta 광고",  itemKeys: ["meta-ad-copy", "meta-ad-images"],    tab: "publish", anchor: "publish-section-meta-ads" },
];

export function PackageProgressBar({ items, currentTab, onGoToTab }: Props) {
  // 각 step의 진행 상태 계산
  const steps = STEPS.map(s => {
    const itemList = s.itemKeys.map(k => items.find(i => i.key === k)).filter(Boolean) as ProgressItem[];
    const doneCount = itemList.filter(i => i.done).length;
    const totalCount = itemList.length;
    return {
      ...s,
      itemList,
      doneCount,
      totalCount,
      done: totalCount > 0 && doneCount === totalCount,
      partial: doneCount > 0 && doneCount < totalCount,
    };
  });

  // 현재 차례 = 첫 번째 미완료 step
  const currentStepIdx = steps.findIndex(s => !s.done);
  const allDone = currentStepIdx === -1;

  const handleClick = (step: typeof steps[number]) => {
    if (step.tab === currentTab) {
      scrollToAnchor(step.anchor);
    } else {
      onGoToTab(step.tab);
      setTimeout(() => scrollToAnchor(step.anchor), 200);
    }
  };

  return (
    <div className="sticky top-[44px] z-20 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-[1600px] mx-auto px-3 py-3 flex items-center gap-1.5 md:gap-2 overflow-x-auto whitespace-nowrap">
        {/* 라벨 */}
        <span className="hidden md:inline text-[11px] font-mono uppercase tracking-wider text-gray-500 flex-shrink-0 mr-1">
          🎯 단계
        </span>

        {steps.map((step, idx) => {
          const isCurrent = !allDone && idx === currentStepIdx;
          const isLocked = !step.done && !isCurrent && idx > currentStepIdx;

          // 단계 카드 색상
          let cardCls = "";
          let numCls = "";
          let labelCls = "";
          let statusText = "";
          let statusCls = "";

          if (step.done) {
            cardCls = "bg-orange-50 border-orange-300 hover:bg-orange-100";
            numCls = "bg-tiger-orange text-white";
            labelCls = "text-ink-900";
            statusText = step.totalCount > 1 ? `완료 ${step.doneCount}/${step.totalCount}` : "✓ 완료";
            statusCls = "text-tiger-orange font-bold";
          } else if (isCurrent) {
            cardCls = "bg-yellow-50 border-yellow-400 hover:bg-yellow-100 ring-2 ring-yellow-400/40 animate-pulse";
            numCls = "bg-yellow-400 text-yellow-900";
            labelCls = "text-yellow-900 font-black";
            statusText = step.partial
              ? `진행 중 ${step.doneCount}/${step.totalCount}`
              : "👉 지금 차례";
            statusCls = "text-yellow-800 font-bold";
          } else if (isLocked) {
            cardCls = "bg-gray-50 border-gray-200 hover:bg-gray-100 opacity-70";
            numCls = "bg-gray-300 text-gray-600";
            labelCls = "text-gray-500";
            statusText = "잠김";
            statusCls = "text-gray-400";
          } else {
            cardCls = "bg-white border-gray-300 hover:border-tiger-orange";
            numCls = "bg-gray-100 text-gray-700";
            labelCls = "text-gray-700";
            statusText = step.totalCount > 1 ? `${step.doneCount}/${step.totalCount}` : "○";
            statusCls = "text-gray-500";
          }

          return (
            <div key={step.num} className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => handleClick(step)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition ${cardCls}`}
                title={`${step.label} — ${statusText}`}
              >
                <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${numCls}`}>
                  {step.done ? "✓" : step.num}
                </span>
                <span className="hidden sm:inline text-base">{step.emoji}</span>
                <div className="text-left leading-tight">
                  <div className={`text-xs sm:text-sm font-bold ${labelCls}`}>{step.label}</div>
                  <div className={`text-[10px] ${statusCls}`}>{statusText}</div>
                </div>
              </button>
              {idx < steps.length - 1 && (
                <span className={`text-gray-300 text-lg flex-shrink-0 ${steps[idx].done ? "text-tiger-orange" : ""}`}>→</span>
              )}
            </div>
          );
        })}

        {/* 마지막: 내보내기 안내 */}
        <span className="text-gray-300 text-lg flex-shrink-0 mx-1">→</span>
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 flex-shrink-0 ${
          allDone
            ? "bg-gradient-to-r from-tiger-orange to-orange-600 border-tiger-orange text-white shadow-glow-orange-sm animate-pulse"
            : "bg-gray-50 border-gray-200 text-gray-400 opacity-70"
        }`}>
          <span className="text-base">📥</span>
          <div className="text-left leading-tight">
            <div className="text-xs sm:text-sm font-bold">내보내기</div>
            <div className="text-[10px] opacity-90">
              {allDone ? "🎉 준비 완료" : "단계 완료 후"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
