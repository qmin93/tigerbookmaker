// components/TemplatePreviewModal.tsx
// [👁 결과 미리보기] 버튼이 띄우는 모달. 현재 챕터 + 선택된 template으로 렌더링.

"use client";
import { useState } from "react";
import { getTemplate, type TemplateKey, type ChapterImage } from "@/lib/templates";
import { getTheme } from "@/lib/theme-colors";
import type { ThemeColorKey } from "@/lib/storage";

interface Props {
  open: boolean;
  onClose: () => void;
  templateKey: TemplateKey | null | undefined;
  themeColor: ThemeColorKey | null | undefined;
  chapter: { title: string; subtitle?: string; content: string; images?: ChapterImage[] };
  chapterIdx: number;
  totalChapters: number;
}

export function TemplatePreviewModal({ open, onClose, templateKey, themeColor, chapter, chapterIdx, totalChapters }: Props) {
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  if (!open) return null;

  const tpl = getTemplate(templateKey);
  const theme = getTheme(themeColor ?? undefined);
  const Render = tpl.Render;

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/70 flex items-stretch justify-center p-2 md:p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[95vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-tiger-orange font-bold">📐 {tpl.label} 미리보기</div>
            <div className="text-sm text-gray-600 mt-0.5">{chapterIdx + 1}장 — {chapter.title}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewport(v => v === "desktop" ? "mobile" : "desktop")}
              className="px-3 py-1.5 text-xs font-bold border border-gray-300 rounded hover:bg-gray-50"
            >
              {viewport === "desktop" ? "📱 모바일 뷰" : "🖥 데스크톱 뷰"}
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-bold bg-gray-900 text-white rounded hover:bg-gray-800"
            >
              닫기
            </button>
          </div>
        </div>

        {/* 본문 영역 */}
        <div className="flex-1 overflow-auto bg-gray-50 p-4 md:p-6">
          <div
            className={`mx-auto bg-white rounded shadow-md transition-all ${viewport === "mobile" ? "max-w-[390px]" : "max-w-3xl"}`}
            style={viewport === "mobile" ? { width: "390px" } : undefined}
          >
            <Render
              chapter={chapter}
              theme={theme}
              chapterIdx={chapterIdx}
              totalChapters={totalChapters}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
