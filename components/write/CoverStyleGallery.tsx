"use client";

/**
 * CoverStyleGallery — 24 표지 템플릿 갤러리 (Spec PR #3, Section 3.4).
 *
 * - 카테고리 chip 필터 (BOLD / EDITORIAL / TECH / CULTURAL / RETRO / SOFT / EXPERIMENTAL / BESTSELLER)
 * - 검색 (label / description 부분일치)
 * - 정렬 (AI 추천순 / 인기순 / 신규순)
 * - 즐겨찾기 (⭐, localStorage `tigerbookmaker_fav_templates` 에 LayoutKey[] 로 저장)
 * - 카드 click → onSelect(templateKey) 후 onClose 호출 (모달 닫기)
 *
 * 모달 형태로 렌더 — open=false 면 null 반환.
 * 부모(StyleStep)에서 open / onClose / onSelect / currentGenre 를 관리한다.
 */

import { useEffect, useMemo, useState } from "react";
import {
  COVER_TEMPLATES,
  getAllTemplateKeys,
} from "@/lib/cover-templates";
import type { CoverCategory, CoverTemplate } from "@/lib/cover-templates/types";
import type { BookGenre, LayoutKey } from "@/lib/cover-style-map";
import { CoverTemplatePreview } from "./CoverTemplatePreview";

const FAV_STORAGE_KEY = "tigerbookmaker_fav_templates";

const CATEGORY_LABELS: Record<CoverCategory, string> = {
  BOLD: "BOLD · 멈춰세움",
  EDITORIAL: "EDITORIAL · 권위",
  TECH: "TECH · 미래",
  CULTURAL: "CULTURAL · 아시아",
  RETRO: "RETRO · 노스탤지어",
  SOFT: "SOFT · 친근",
  EXPERIMENTAL: "EXPERIMENTAL · 독특",
  BESTSELLER: "BESTSELLER · 검증된 톤",
};

type SortKey = "ai-recommended" | "popular" | "new";

interface CoverStyleGalleryProps {
  open: boolean;
  onClose: () => void;
  onSelect: (key: LayoutKey) => void;
  /** 현재 선택된 layoutKey (있으면 카드에 체크 표시). */
  selectedKey?: LayoutKey | null;
  /** 책 장르 — AI 추천순 정렬 시 우선순위에 사용. */
  currentGenre: BookGenre;
}

/** localStorage 에서 즐겨찾기 LayoutKey[] 안전하게 읽기. */
function loadFavorites(): LayoutKey[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FAV_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((k): k is LayoutKey => typeof k === "string");
  } catch {
    return [];
  }
}

function saveFavorites(favs: LayoutKey[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(favs));
  } catch {
    // localStorage 못 쓰면 silently skip (시크릿 모드 등)
  }
}

export function CoverStyleGallery({
  open,
  onClose,
  onSelect,
  selectedKey,
  currentGenre,
}: CoverStyleGalleryProps) {
  const [category, setCategory] = useState<CoverCategory | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("ai-recommended");
  const [favorites, setFavorites] = useState<LayoutKey[]>([]);

  useEffect(() => {
    if (open) setFavorites(loadFavorites());
  }, [open]);

  // ESC 로 모달 닫기 + body 스크롤 잠금
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = originalOverflow;
    };
  }, [open, onClose]);

  // 등록된 모든 템플릿 (PR #2 v1 = 24개)
  const allTemplates = useMemo<CoverTemplate[]>(() => {
    return getAllTemplateKeys()
      .map(k => COVER_TEMPLATES[k])
      .filter((t): t is CoverTemplate => !!t);
  }, []);

  // 사용 가능한 카테고리 chip (실제 등록된 템플릿만 노출)
  const availableCategories = useMemo<CoverCategory[]>(() => {
    const set = new Set<CoverCategory>();
    allTemplates.forEach(t => set.add(t.category));
    return Array.from(set);
  }, [allTemplates]);

  // 필터 + 검색 + 정렬
  const visibleTemplates = useMemo(() => {
    let list = allTemplates;

    if (category !== "ALL") {
      list = list.filter(t => t.category === category);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        t =>
          t.label.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.key.toLowerCase().includes(q),
      );
    }

    // 정렬
    if (sortKey === "ai-recommended") {
      // 현재 장르에 recommendedFor 매칭 우선 → 그 외 declared 순서 유지
      list = [...list].sort((a, b) => {
        const aMatch = a.recommendedFor.includes(currentGenre) ? 0 : 1;
        const bMatch = b.recommendedFor.includes(currentGenre) ? 0 : 1;
        return aMatch - bMatch;
      });
    } else if (sortKey === "popular") {
      // popularity 추적 전이라 alphabetical 로 stand-in (spec note)
      list = [...list].sort((a, b) => a.label.localeCompare(b.label, "ko"));
    } else {
      // "신규순" — declared 순서 그대로 (getAllTemplateKeys 의 등록 순서)
    }

    return list;
  }, [allTemplates, category, search, sortKey, currentGenre]);

  const toggleFavorite = (key: LayoutKey) => {
    setFavorites(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      saveFavorites(next);
      return next;
    });
  };

  const handlePick = (key: LayoutKey) => {
    onSelect(key);
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="표지 스타일 갤러리"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-5xl my-8 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
          <div>
            <h2 className="text-lg font-bold text-ink-900">표지 스타일 갤러리</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              총 {allTemplates.length}개 템플릿 · 검색·필터·즐겨찾기로 마음에 드는 톤을 찾으세요.
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-gray-600 hover:text-ink-900 border border-gray-300 rounded-lg"
            aria-label="갤러리 닫기"
          >
            닫기 ✕
          </button>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 border-b border-gray-100 space-y-3 bg-gray-50/50">
          {/* 카테고리 chip row */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCategory("ALL")}
              className={`px-3 py-1.5 text-xs font-bold rounded-full transition ${
                category === "ALL"
                  ? "bg-ink-900 text-white"
                  : "bg-white border border-gray-300 text-gray-700 hover:border-ink-900"
              }`}
            >
              전체
            </button>
            {availableCategories.map(c => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-3 py-1.5 text-xs font-bold rounded-full transition ${
                  category === c
                    ? "bg-ink-900 text-white"
                    : "bg-white border border-gray-300 text-gray-700 hover:border-ink-900"
                }`}
              >
                {CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>

          {/* Search + Sort */}
          <div className="flex flex-col md:flex-row gap-2">
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="🔍 템플릿 검색 (예: 미니멀, 사이버펑크, 빈티지)"
              className="flex-1 px-3 py-2 text-xs border border-gray-300 rounded-lg focus:border-tiger-orange focus:outline-none"
            />
            <select
              value={sortKey}
              onChange={e => setSortKey(e.target.value as SortKey)}
              className="px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:border-tiger-orange"
              aria-label="정렬"
            >
              <option value="ai-recommended">AI 추천순</option>
              <option value="popular">인기순</option>
              <option value="new">신규순</option>
            </select>
          </div>
        </div>

        {/* Grid */}
        <div className="px-6 py-5">
          {visibleTemplates.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-500">
              검색 조건에 맞는 템플릿이 없습니다. 다른 키워드로 시도해 보세요.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {visibleTemplates.map(t => {
                const isFav = favorites.includes(t.key);
                const isSelected = selectedKey === t.key;
                const isRecommended = t.recommendedFor.includes(currentGenre);
                return (
                  <div
                    key={t.key}
                    className={`relative bg-white border rounded-xl p-3 transition cursor-pointer hover:shadow-md ${
                      isSelected
                        ? "border-tiger-orange ring-2 ring-tiger-orange/30"
                        : "border-gray-200 hover:border-ink-900"
                    }`}
                    onClick={() => handlePick(t.key)}
                  >
                    {/* 즐겨찾기 + 추천 배지 */}
                    <div className="absolute top-2 left-2 right-2 flex items-start justify-between pointer-events-none z-10">
                      <div className="flex gap-1 pointer-events-auto">
                        <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-gray-500 bg-white/90 px-1.5 py-0.5 rounded">
                          {t.category}
                        </span>
                        {isRecommended && (
                          <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-tiger-orange bg-orange-50 border border-tiger-orange/30 px-1.5 py-0.5 rounded">
                            AI 추천
                          </span>
                        )}
                      </div>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          toggleFavorite(t.key);
                        }}
                        className={`pointer-events-auto text-base leading-none p-1 rounded transition ${
                          isFav ? "text-yellow-500" : "text-gray-300 hover:text-yellow-500"
                        }`}
                        aria-label={isFav ? "즐겨찾기 해제" : "즐겨찾기 추가"}
                        title={isFav ? "즐겨찾기 해제" : "즐겨찾기 추가"}
                      >
                        {isFav ? "★" : "☆"}
                      </button>
                    </div>

                    {/* Preview */}
                    <div className="bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center mb-3 aspect-[3/4]">
                      <CoverTemplatePreview template={t} scale={1.4} />
                    </div>

                    {/* Label */}
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-ink-900 line-clamp-1">{t.label}</h3>
                      <p className="text-[11px] text-gray-600 line-clamp-2 leading-snug">
                        {t.description}
                      </p>
                    </div>

                    {/* Selected indicator */}
                    {isSelected && (
                      <div className="absolute bottom-2 right-2 text-tiger-orange text-lg">
                        ✓
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl text-[11px] text-gray-500 flex flex-wrap items-center justify-between gap-2">
          <span>
            ⭐ 즐겨찾기 {favorites.length}개 · 표시 중 {visibleTemplates.length}개 / 전체{" "}
            {allTemplates.length}개
          </span>
          <span className="text-gray-400">카드를 클릭하면 선택됩니다.</span>
        </div>
      </div>
    </div>
  );
}

export default CoverStyleGallery;
