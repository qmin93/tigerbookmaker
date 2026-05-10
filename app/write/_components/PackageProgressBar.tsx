// app/write/_components/PackageProgressBar.tsx
// TopHeader 바로 아래 sticky 바 — 패키지 항목 4개 칩으로 노출.
// ✓ 표시 (완료) 또는 [만들러 → publish] 형태 (미완성). 클릭 시 해당 탭으로 이동.
// 사용자가 "어디서 뭘 만드는지" 상시 확인 가능.

"use client";
import type { ProgressItem } from "@/lib/export-bundle";

interface Props {
  items: ProgressItem[];
  currentTab: string;
  onGoToTab: (tab: string) => void;
}

const TAB_LABEL: Record<string, string> = {
  writing: "writing",
  publish: "publish",
  extras: "extras",
  ops: "ops",
};

export function PackageProgressBar({ items, currentTab, onGoToTab }: Props) {
  const allDone = items.every(i => i.done);

  return (
    <div className="sticky top-[44px] z-20 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-[1600px] mx-auto px-4 py-2 flex items-center gap-2 overflow-x-auto whitespace-nowrap">
        <span className="text-[11px] font-mono uppercase tracking-wider text-gray-500 flex-shrink-0 hidden md:inline">
          📋 패키지
        </span>
        {items.map(item => {
          const onCurrentTab = item.tab === currentTab;
          if (item.done) {
            return (
              <div
                key={item.key}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-orange-50 text-tiger-orange border border-orange-200 flex-shrink-0"
                title={`완료: ${item.label}`}
              >
                <span className="font-bold">✓</span>
                <span className="font-medium">{item.label}</span>
              </div>
            );
          }
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onGoToTab(item.tab)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition flex-shrink-0 ${
                onCurrentTab
                  ? "bg-yellow-50 text-yellow-900 border-2 border-yellow-400 animate-pulse"
                  : "bg-white text-gray-700 border border-gray-300 hover:border-tiger-orange hover:text-tiger-orange hover:bg-orange-50"
              }`}
              title={item.hint}
            >
              <span className="text-gray-400">○</span>
              <span>{item.label}</span>
              {!onCurrentTab && (
                <span className="text-[10px] opacity-70 font-mono">→ {TAB_LABEL[item.tab] ?? item.tab}</span>
              )}
              {onCurrentTab && (
                <span className="text-[10px] font-bold">↓ 이 탭에서</span>
              )}
            </button>
          );
        })}
        {allDone && (
          <span className="text-[11px] text-tiger-orange font-bold ml-2 flex-shrink-0">
            🎉 풀 패키지 완성 — 내보내기 가능
          </span>
        )}
      </div>
    </div>
  );
}
