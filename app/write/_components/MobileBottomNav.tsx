// app/write/_components/MobileBottomNav.tsx
// 모바일 하단 5-아이콘 네비. input/textarea focus 시 자동 hide.

"use client";
import { useEffect } from "react";
import type { TabKey } from "../_hooks/useTabState";

interface NavItem {
  key: TabKey;
  icon: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: "chapters", icon: "📚", label: "챕터" },
  { key: "writing", icon: "📝", label: "본문" },
  { key: "publish", icon: "🚀", label: "출간" },
  { key: "extras", icon: "🎁", label: "확장" },
  { key: "ops", icon: "📊", label: "운영" },
];

interface Props {
  active: TabKey;
  setTab: (next: TabKey) => void;
  hints?: Partial<Record<TabKey, boolean>>;
}

export function MobileBottomNav({ active, setTab, hints }: Props) {
  // input/textarea focus 시 키보드와 겹침 방지 — body 클래스 토글
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const handleFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
        document.body.classList.add("write-input-focused");
      }
    };
    const handleFocusOut = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (!document.querySelector("input:focus, textarea:focus, [contenteditable]:focus")) {
          document.body.classList.remove("write-input-focused");
        }
      }, 100);
    };
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
      document.body.classList.remove("write-input-focused");
    };
  }, []);

  return (
    <nav
      aria-label="페이지 탭"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 flex [body.write-input-focused_&]:hidden"
    >
      {NAV_ITEMS.map(item => {
        const isActive = active === item.key;
        const showHint = hints?.[item.key] === true;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[60px] transition ${
              isActive ? "text-tiger-orange font-bold" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <span className="text-xl leading-none">{item.icon}</span>
            <span className="text-[10px] leading-none">{item.label}</span>
            {showHint && (
              <span
                aria-label="새 작업 권장"
                className="absolute top-1.5 right-[35%] w-1.5 h-1.5 rounded-full bg-tiger-orange"
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
