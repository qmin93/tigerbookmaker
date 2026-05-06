// app/write/_components/ChapterContent.tsx
// 선택된 챕터의 본문 + 컨트롤 버튼 영역.
// 본문 자체 렌더는 children으로 위임.

"use client";
import type { ReactNode } from "react";

interface Props {
  chapterIdx: number;
  totalChapters: number;
  title: string;
  subtitle?: string;
  hasContent: boolean;
  busyGenerating?: boolean;
  onGenerate?: () => void;
  onPreview?: () => void;
  onAIEdit?: () => void;
  onDirectEdit?: () => void;
  onRegenerate?: () => void;
  children?: ReactNode;
  emptyHint?: ReactNode;
}

export function ChapterContent({
  chapterIdx, totalChapters, title, subtitle, hasContent,
  busyGenerating, onGenerate, onPreview, onAIEdit, onDirectEdit, onRegenerate,
  children, emptyHint,
}: Props) {
  return (
    <div className="px-4 md:px-6 py-6 md:py-8 max-w-3xl mx-auto">
      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-gray-400 mb-2">
        CHAPTER {chapterIdx + 1} / {totalChapters}
      </div>
      <h1 className="text-2xl md:text-3xl font-black tracking-tight text-ink-900 leading-tight mb-2">
        {title || "(제목 없음)"}
      </h1>
      {subtitle && (
        <p className="text-base text-gray-600 mb-4">{subtitle}</p>
      )}

      <div className="flex flex-wrap gap-2 mb-5 pb-3 border-b border-gray-100">
        {!hasContent && onGenerate && (
          <button
            type="button"
            onClick={onGenerate}
            disabled={busyGenerating}
            className="px-3 py-1.5 bg-tiger-orange text-white text-xs font-bold rounded hover:bg-orange-600 disabled:opacity-50"
          >
            {busyGenerating ? "생성 중..." : "+ 본문 생성"}
          </button>
        )}
        {hasContent && (
          <>
            {onPreview && (
              <button type="button" onClick={onPreview} className="px-3 py-1.5 bg-tiger-orange text-white text-xs font-bold rounded hover:bg-orange-600">
                👁 결과 미리보기
              </button>
            )}
            {onAIEdit && (
              <button type="button" onClick={onAIEdit} className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs font-bold rounded hover:bg-gray-50">
                💬 AI 수정 요청 (~₩50)
              </button>
            )}
            {onDirectEdit && (
              <button type="button" onClick={onDirectEdit} className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs font-bold rounded hover:bg-gray-50">
                ✏️ 직접 수정
              </button>
            )}
            {onRegenerate && (
              <button type="button" onClick={onRegenerate} disabled={busyGenerating} className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs font-bold rounded hover:bg-gray-50 disabled:opacity-50">
                🔄 다시 생성
              </button>
            )}
          </>
        )}
      </div>

      <div className="prose prose-sm md:prose-base max-w-none text-gray-800">
        {hasContent ? children : (emptyHint ?? (
          <p className="text-gray-400 italic py-8 text-center">아직 본문이 없습니다. [+ 본문 생성] 버튼을 눌러 시작하세요.</p>
        ))}
      </div>
    </div>
  );
}
