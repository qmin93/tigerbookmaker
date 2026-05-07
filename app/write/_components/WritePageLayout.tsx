// app/write/_components/WritePageLayout.tsx
// 데스크톱: 3-column grid (챕터 300 / 본문 가변 / 도구 380)
// 모바일: 단일 column, 활성 탭에 따라 child만 보임

"use client";
import type { ReactNode } from "react";
import type { TabKey } from "../_hooks/useTabState";

interface Props {
  tab: TabKey;
  chapterList: ReactNode;       // 왼쪽 column / mobile chapters 탭
  chapterContent: ReactNode;    // 가운데 column / mobile writing 탭 (위 절반)
  tabContent: ReactNode;        // 오른쪽 column / mobile 활성 탭 콘텐츠
}

export function WritePageLayout({ tab, chapterList, chapterContent, tabContent }: Props) {
  return (
    <div className="min-h-screen bg-gray-50 pb-16 lg:pb-0">
      {/* Desktop: 3-column grid */}
      <div className="hidden lg:grid lg:grid-cols-[300px_1fr_380px] lg:h-[calc(100vh-49px)]">
        <aside className="border-r border-gray-200 bg-white overflow-y-auto">
          {chapterList}
        </aside>
        <main className="overflow-y-auto bg-white">
          {chapterContent}
        </main>
        <aside className="border-l border-gray-200 bg-gray-50 overflow-y-auto">
          {tabContent}
        </aside>
      </div>

      {/* Mobile: 단일 column, 활성 탭에 따라 다른 child */}
      <div className="lg:hidden">
        {tab === "chapters" && (
          <div className="bg-white min-h-[calc(100vh-49px-64px)]">{chapterList}</div>
        )}
        {tab === "writing" && (
          <>
            <div className="bg-white">{chapterContent}</div>
            <div className="bg-gray-50 border-t border-gray-200">{tabContent}</div>
          </>
        )}
        {(tab === "publish" || tab === "extras" || tab === "ops") && (
          <div className="bg-gray-50 min-h-[calc(100vh-49px-64px)]">{tabContent}</div>
        )}
      </div>
    </div>
  );
}
