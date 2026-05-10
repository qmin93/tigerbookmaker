// app/write/_components/PackageProgressBar.tsx
// TopHeader 바로 아래 sticky 바 — 패키지 항목 칩으로 노출.
// 클릭 시 해당 탭으로 이동 + 그 안의 섹션으로 scroll + 하이라이트 효과.

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

function flashHighlight(el: HTMLElement) {
  // 짧은 highlight 효과 — 사용자에게 "이 영역이야" 시각 신호
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

export function PackageProgressBar({ items, currentTab, onGoToTab }: Props) {
  const allDone = items.every(i => i.done);

  const handleClick = (item: ProgressItem) => {
    if (item.tab === currentTab) {
      // 이미 같은 탭 → 바로 scroll
      scrollToAnchor(item.anchor);
    } else {
      // 다른 탭 → 탭 이동 후 잠시 후 scroll (DOM 갱신 대기)
      onGoToTab(item.tab);
      setTimeout(() => scrollToAnchor(item.anchor), 200);
    }
  };

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
              <button
                key={item.key}
                type="button"
                onClick={() => handleClick(item)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-orange-50 text-tiger-orange border border-orange-200 hover:bg-orange-100 transition flex-shrink-0"
                title={`완료: ${item.label} — 클릭해서 이동`}
              >
                <span className="font-bold">✓</span>
                <span className="font-medium">{item.label}</span>
              </button>
            );
          }
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleClick(item)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition flex-shrink-0 ${
                onCurrentTab
                  ? "bg-yellow-50 text-yellow-900 border-2 border-yellow-400 hover:bg-yellow-100 animate-pulse"
                  : "bg-white text-gray-700 border border-gray-300 hover:border-tiger-orange hover:text-tiger-orange hover:bg-orange-50"
              }`}
              title={item.hint + " — 클릭하면 해당 영역으로 이동"}
            >
              <span className="text-gray-400">○</span>
              <span>{item.label}</span>
              {!onCurrentTab && (
                <span className="text-[10px] opacity-70 font-mono">→ {TAB_LABEL[item.tab] ?? item.tab}</span>
              )}
              {onCurrentTab && (
                <span className="text-[10px] font-bold">↓ 클릭해서 영역으로</span>
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
