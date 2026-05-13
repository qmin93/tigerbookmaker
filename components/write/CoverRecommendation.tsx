"use client";

/**
 * CoverRecommendation — 책 장르 기반 표지 레이아웃 자동 추천 (Spec PR #3, Section 3.4-A).
 *
 * GENRE_MAP[genre].layouts 의 앞 3개를 카드로 표시한다.
 * 등록되지 않은 LayoutKey 는 "곧 출시" placeholder 로 표시.
 * 카드 click → onSelect(layoutKey).
 * "다른 스타일 보기" 버튼 → onOpenGallery() (전체 갤러리 열기).
 */

import { useMemo } from "react";
import { getMatchForGenre, genreLabelKo } from "@/lib/cover-style-map";
import type { BookGenre, LayoutKey } from "@/lib/cover-style-map";
import { getTemplate } from "@/lib/cover-templates";
import { CoverTemplatePreview } from "./CoverTemplatePreview";

interface CoverRecommendationProps {
  genre: BookGenre;
  selectedKey?: LayoutKey | null;
  onSelect: (key: LayoutKey) => void;
  onOpenGallery: () => void;
}

export function CoverRecommendation({
  genre,
  selectedKey,
  onSelect,
  onOpenGallery,
}: CoverRecommendationProps) {
  const match = useMemo(() => getMatchForGenre(genre), [genre]);
  const recommended = match.layouts.slice(0, 3);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <div>
          <h4 className="text-sm font-bold text-ink-900">
            {genreLabelKo(genre)} 추천 톤
          </h4>
          <p className="text-[11px] text-gray-500 mt-0.5">
            톤: <span className="text-ink-900">{match.tone}</span>
          </p>
        </div>
        <button
          onClick={onOpenGallery}
          className="text-[11px] font-bold text-tiger-orange hover:text-orange-700 underline underline-offset-2"
        >
          다른 스타일 보기 →
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {recommended.map((layoutKey, idx) => {
          const template = getTemplate(layoutKey);
          const isSelected = selectedKey === layoutKey;

          if (!template) {
            // PR #2 v1 에 등록되지 않은 9 LayoutKey 들 — placeholder
            return (
              <div
                key={layoutKey}
                className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-3 flex flex-col"
              >
                <div className="bg-gray-100 rounded-lg aspect-[3/4] flex items-center justify-center mb-2">
                  <span className="text-xs text-gray-400 font-mono">곧 출시</span>
                </div>
                <div className="text-xs font-bold text-gray-500 line-clamp-1">
                  {layoutKey}
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">
                  v1.5 에서 추가 예정
                </div>
              </div>
            );
          }

          return (
            <button
              key={layoutKey}
              onClick={() => onSelect(layoutKey)}
              className={`text-left bg-white border rounded-xl p-3 transition hover:shadow-md ${
                isSelected
                  ? "border-tiger-orange ring-2 ring-tiger-orange/30"
                  : "border-gray-200 hover:border-ink-900"
              }`}
            >
              <div className="relative bg-gray-100 rounded-lg aspect-[3/4] flex items-center justify-center mb-2 overflow-hidden">
                <CoverTemplatePreview template={template} scale={1.4} />
                <span className="absolute top-1 left-1 text-[9px] font-mono font-bold text-white bg-ink-900/70 px-1.5 py-0.5 rounded">
                  #{idx + 1}
                </span>
                {isSelected && (
                  <span className="absolute bottom-1 right-1 text-base text-tiger-orange bg-white rounded-full w-5 h-5 flex items-center justify-center shadow">
                    ✓
                  </span>
                )}
              </div>
              <div className="text-xs font-bold text-ink-900 line-clamp-1">
                {template.label}
              </div>
              <div className="text-[10px] text-gray-500 line-clamp-2 leading-snug mt-0.5">
                {template.description}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default CoverRecommendation;
