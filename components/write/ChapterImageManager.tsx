// 챕터별 이미지 추천 / 개별 생성 UI (spec PR #4 — 본문 이미지 활성화)
//
// /write 페이지의 "챕터별 선택" 모드에서 BulkImageGenerator가 펼쳐서 사용한다.
// 각 챕터 카드:
//   - 현재 이미지 썸네일 (있다면)
//   - "이미지 추천 받기 (₩50)" 버튼 → /api/chapter/[idx]/image-suggestions
//   - 추천이 있으면 1~3개 카드 — "이미지 만들기 (₩300)" / "스킵" 버튼
//   - 누적 비용 표시
//
// 실제 이미지 생성은 기존 /api/generate/chapter-image route를 호출 (placeholder 지정).

"use client";

import { useState } from "react";

export interface ChapterImage {
  placeholder: string;
  dataUrl?: string;
  caption?: string;
  alt?: string;
}

export interface ImageSuggestion {
  position: "start" | "middle" | "end";
  keywords: string;
  description: string;
  placeholder: string;
}

export interface ChapterLite {
  title: string;
  subtitle?: string;
  content: string;
  images?: ChapterImage[];
  imageSuggestions?: ImageSuggestion[];
}

interface Props {
  projectId: string;
  chapters: ChapterLite[];
  /** 부모(write/page)가 가지고 있는 fresh refetch 함수 — 생성 후 호출 */
  onProjectRefresh?: () => void | Promise<void>;
  /** 잔액 변경 콜백 */
  onBalanceChange?: (newBalanceKRW: number) => void;
  /** 잔액 부족 시 충전 페이지 안내 */
  onTopUpNeeded?: (shortfallKRW?: number) => void | Promise<void>;
}

const POSITION_LABEL: Record<ImageSuggestion["position"], string> = {
  start: "챕터 시작",
  middle: "본문 중간",
  end: "챕터 끝",
};

const COST_SUGGEST_KRW = 50;
const COST_IMAGE_KRW = 300;

export default function ChapterImageManager({
  projectId,
  chapters,
  onProjectRefresh,
  onBalanceChange,
  onTopUpNeeded,
}: Props) {
  const [busy, setBusy] = useState<string>("");  // "suggest:0" or "image:0:<placeholder>"
  const [error, setError] = useState<string | null>(null);
  const [spent, setSpent] = useState(0);

  const requestSuggestions = async (chapterIdx: number) => {
    setBusy(`suggest:${chapterIdx}`);
    setError(null);
    try {
      const res = await fetch(`/api/chapter/${chapterIdx}/image-suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (res.status === 402) {
        await onTopUpNeeded?.();
        throw new Error("잔액 부족");
      }
      if (!res.ok) throw new Error(data.message || `추천 실패 (${res.status})`);
      if (data.newBalance != null) onBalanceChange?.(data.newBalance);
      if (data.costKRW) setSpent((s) => s + data.costKRW);
      await onProjectRefresh?.();
    } catch (e: any) {
      if (e.message !== "잔액 부족") setError(e.message);
    } finally {
      setBusy("");
    }
  };

  const generateOne = async (chapterIdx: number, placeholder: string) => {
    setBusy(`image:${chapterIdx}:${placeholder}`);
    setError(null);
    try {
      const res = await fetch("/api/generate/chapter-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, chapterIdx, placeholder }),
      });
      const data = await res.json();
      if (res.status === 402) {
        await onTopUpNeeded?.();
        throw new Error("잔액 부족");
      }
      if (!res.ok) throw new Error(data.message || `이미지 생성 실패 (${res.status})`);
      if (data.newBalance != null) onBalanceChange?.(data.newBalance);
      if (data.costKRW) setSpent((s) => s + data.costKRW);
      await onProjectRefresh?.();
    } catch (e: any) {
      if (e.message !== "잔액 부족") setError(e.message);
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-3">
      {spent > 0 && (
        <div className="text-[11px] text-gray-500 px-1">
          이번 세션 누적 사용: <span className="font-bold text-gray-700">₩{spent.toLocaleString()}</span>
        </div>
      )}
      {error && (
        <div className="px-2 py-1.5 bg-red-50 border border-red-200 rounded text-[11px] text-red-700">
          {error}
        </div>
      )}

      {chapters.map((ch, idx) => {
        const suggestions = ch.imageSuggestions ?? [];
        const images = ch.images ?? [];
        const isSuggesting = busy === `suggest:${idx}`;

        return (
          <div key={idx} className="border border-gray-200 rounded-lg p-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-gray-800 truncate">
                  {idx + 1}장. {ch.title || "제목 없음"}
                </div>
                {ch.subtitle && (
                  <div className="text-[10px] text-gray-500 truncate">{ch.subtitle}</div>
                )}
              </div>
              {suggestions.length === 0 && (
                <button
                  onClick={() => requestSuggestions(idx)}
                  disabled={!!busy}
                  className="shrink-0 px-2 py-1 bg-gray-50 border border-gray-300 rounded text-[10px] hover:bg-gray-100 disabled:opacity-50"
                  title="AI가 챕터 본문 분석해서 이미지 1~3개 추천"
                >
                  {isSuggesting ? "추천 중..." : `🪄 이미지 추천 (₩${COST_SUGGEST_KRW})`}
                </button>
              )}
            </div>

            {/* 현재 이미지 썸네일 */}
            {images.filter((i) => i.dataUrl).length > 0 && (
              <div className="mt-2 flex gap-1.5 flex-wrap">
                {images.filter((i) => i.dataUrl).map((img) => (
                  <div
                    key={img.placeholder}
                    className="relative w-14 h-14 rounded overflow-hidden border border-gray-200"
                    title={img.caption}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.dataUrl!} alt={img.alt ?? ""} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}

            {/* 추천 카드 */}
            {suggestions.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {suggestions.map((s) => {
                  const hasImage = images.find((i) => i.placeholder === s.placeholder)?.dataUrl;
                  const isGenerating = busy === `image:${idx}:${s.placeholder}`;
                  return (
                    <div
                      key={s.placeholder}
                      className={`rounded p-2 border text-[11px] ${
                        hasImage ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] text-gray-500 font-medium">
                            {POSITION_LABEL[s.position]} · <span className="font-mono">{s.keywords}</span>
                          </div>
                          <div className="text-gray-800 mt-0.5">{s.description}</div>
                        </div>
                        {hasImage ? (
                          <span className="shrink-0 text-green-700 text-[10px] font-bold">✓ 완성</span>
                        ) : (
                          <button
                            onClick={() => generateOne(idx, s.placeholder)}
                            disabled={!!busy}
                            className="shrink-0 px-2 py-1 bg-tiger-orange/10 border border-tiger-orange/40 text-tiger-orange rounded text-[10px] font-bold hover:bg-tiger-orange/20 disabled:opacity-50"
                          >
                            {isGenerating ? "생성 중..." : `🖼️ 만들기 (₩${COST_IMAGE_KRW})`}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {suggestions.length === 0 && images.length === 0 && (
              <p className="mt-1.5 text-[10px] text-gray-400">
                추천을 받으면 본문에 자동으로 [IMAGE: …] 자리가 삽입돼요.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
