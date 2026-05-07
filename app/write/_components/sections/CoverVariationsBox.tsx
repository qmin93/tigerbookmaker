// app/write/_components/sections/CoverVariationsBox.tsx
// 📚 표지 다양화 — 3~5종 다른 스타일 자동 생성 (Imagen 4 Fast)
// Minimalist · Bold · Photorealistic 등 완전히 다른 컴포지션 — 같은 책·같은 색상.
// 기존엔 크몽 패키지 모달 안에 nested돼 있었으나, WritingTab에 standalone으로 노출하도록 분리.

"use client";

import { ImageRefineButton } from "@/components/ImageRefineButton";

export interface CoverVariation {
  idx: number;
  style: string;
  base64: string;
  vendor: string;
}

interface Props {
  projectId: string | null;
  variations: CoverVariation[];
  busy: boolean;
  count: 3 | 5;
  onCountChange: (n: 3 | 5) => void;
  onGenerate: () => void;
  onSelect: (idx: number) => void;
  onRefined: (idx: number, b64: string) => void;
  onBalanceChange: (b: number) => void;
}

export function CoverVariationsBox(props: Props) {
  const {
    projectId,
    variations,
    busy,
    count,
    onCountChange,
    onGenerate,
    onSelect,
    onRefined,
    onBalanceChange,
  } = props;

  return (
    <div className="mb-6 p-4 border border-blue-200 bg-blue-50/60 rounded-xl">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h4 className="text-sm font-bold text-ink-900">📚 표지 다양화 ({count}종 다른 스타일)</h4>
          <p className="text-xs text-gray-600 mt-0.5">Minimalist · Bold · Photorealistic 등 완전히 다른 컴포지션 — 같은 책·같은 색상</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={count}
            onChange={e => onCountChange(Number(e.target.value) as 3 | 5)}
            disabled={busy}
            className="text-xs px-2 py-1.5 border border-blue-300 rounded-md bg-white"
          >
            <option value={3}>3종 (~₩900)</option>
            <option value={5}>5종 (~₩1,500)</option>
          </select>
          <button
            onClick={onGenerate}
            disabled={busy}
            className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-md font-bold hover:bg-blue-700 disabled:opacity-50 transition whitespace-nowrap"
          >
            {busy ? "생성 중..." : variations.length > 0 ? "🔄 다시 생성" : `🎨 ${count}종 생성`}
          </button>
        </div>
      </div>
      {busy && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-md bg-blue-100 animate-pulse" />
          ))}
        </div>
      )}
      {!busy && variations.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {variations.map(v => (
            <div key={v.idx} className="relative">
              <button
                onClick={() => onSelect(v.idx)}
                className="aspect-[3/4] w-full rounded-md overflow-hidden border-2 border-transparent hover:border-blue-600 transition relative group bg-gray-100"
                title={`${v.style} — 이걸로 선택`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`data:image/png;base64,${v.base64}`} alt={v.style} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center">
                  <span className="text-white font-bold text-xs opacity-0 group-hover:opacity-100">✓ 이걸로</span>
                </div>
                <div className="absolute top-1 left-1 text-[9px] font-mono px-1 py-0.5 bg-white/90 text-blue-700 rounded font-bold">
                  {v.style}
                </div>
              </button>
              {projectId && (
                <div className="absolute top-1 right-1 bg-white/90 rounded px-1 py-0.5 z-20">
                  <ImageRefineButton
                    projectId={projectId}
                    imageType="cover"
                    aspectRatio="1:1"
                    onRefined={(b64) => onRefined(v.idx, b64)}
                    onBalanceChange={onBalanceChange}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
