// app/write/_components/sections/CoverVariationsBox.tsx
// 📚 표지 다양화 — 3~5종 다른 스타일 자동 생성
// + 사용자 시각 컨셉 직접 입력 + 스타일 방향 (image/typography/hybrid)
// + 이미지 모델 선택 (imagen/openai/DALL-E 3) + AI 컨셉 5종 추천 받기

"use client";

import { useState } from "react";
import { ImageRefineButton } from "@/components/ImageRefineButton";

export interface CoverVariation {
  idx: number;
  style: string;
  base64: string;
  vendor: string;
}

export interface CoverGenerateOptions {
  userConcept?: string;
  styleDirection: "image" | "typography" | "hybrid";
  imageVendor: "imagen" | "openai";
}

interface CoverConcept {
  id: string;
  styleDirection: "image" | "typography" | "hybrid";
  title: string;
  description: string;
  userConcept: string;
}

interface Props {
  projectId: string | null;
  variations: CoverVariation[];
  busy: boolean;
  count: 3 | 5;
  onCountChange: (n: 3 | 5) => void;
  onGenerate: (options: CoverGenerateOptions) => void;
  onSelect: (idx: number) => void;
  onRefined: (idx: number, b64: string) => void;
  onBalanceChange: (b: number) => void;
}

export function CoverVariationsBox(props: Props) {
  const {
    projectId, variations, busy, count, onCountChange,
    onGenerate, onSelect, onRefined, onBalanceChange,
  } = props;

  const [optionsOpen, setOptionsOpen] = useState(false);
  const [userConcept, setUserConcept] = useState("");
  const [styleDirection, setStyleDirection] = useState<"image" | "typography" | "hybrid">("image");
  const [imageVendor, setImageVendor] = useState<"imagen" | "openai">("imagen");

  const [conceptsBusy, setConceptsBusy] = useState(false);
  const [conceptsError, setConceptsError] = useState<string | null>(null);
  const [concepts, setConcepts] = useState<CoverConcept[]>([]);

  // 이미지 클릭 시 큰 미리보기 모달
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const previewVariation = previewIdx !== null ? variations.find(v => v.idx === previewIdx) : null;

  // #16: 표지 후킹 카피 5종 (선택)
  const [headlinesBusy, setHeadlinesBusy] = useState(false);
  const [headlinesError, setHeadlinesError] = useState<string | null>(null);
  const [headlines, setHeadlines] = useState<Array<{ id: string; formula: string; title: string; subtitle?: string }>>([]);

  const fetchHeadlines = async () => {
    if (!projectId) return;
    setHeadlinesBusy(true);
    setHeadlinesError(null);
    try {
      const res = await fetch("/api/generate/cover-headlines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (res.status === 402) {
        setHeadlinesError(`잔액 부족 (₩${data.shortfall ?? 200} 더 필요)`);
        return;
      }
      if (!res.ok) {
        setHeadlinesError(data.message || `생성 실패 (${res.status})`);
        return;
      }
      setHeadlines(data.headlines ?? []);
      if (typeof data.newBalance === "number") onBalanceChange(data.newBalance);
    } catch (e: any) {
      setHeadlinesError(e.message);
    } finally {
      setHeadlinesBusy(false);
    }
  };

  const fetchConcepts = async () => {
    if (!projectId) return;
    setConceptsBusy(true);
    setConceptsError(null);
    try {
      const res = await fetch("/api/generate/cover-concepts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (res.status === 402) {
        setConceptsError(`잔액 부족 (₩${data.shortfall ?? 200} 더 필요). /billing에서 충전하세요.`);
        return;
      }
      if (!res.ok) {
        setConceptsError(data.message || `컨셉 추천 실패 (${res.status})`);
        return;
      }
      setConcepts(data.concepts ?? []);
      if (typeof data.newBalance === "number") onBalanceChange(data.newBalance);
    } catch (e: any) {
      setConceptsError(e.message);
    } finally {
      setConceptsBusy(false);
    }
  };

  const pickConcept = (c: CoverConcept) => {
    setUserConcept(c.userConcept);
    setStyleDirection(c.styleDirection);
    setOptionsOpen(true);
    // 자동 generate까진 안 함 — 사용자가 vendor·count 정하고 직접 누르도록
  };

  const handleGenerate = () => {
    onGenerate({
      userConcept: userConcept.trim() || undefined,
      styleDirection,
      imageVendor,
    });
  };

  return (
    <div className="mb-6 p-4 border border-blue-200 bg-blue-50/60 rounded-xl">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h4 className="text-sm font-bold text-ink-900">📚 표지 다양화 ({count}종 다른 스타일)</h4>
          <p className="text-xs text-gray-600 mt-0.5">시각 컨셉·스타일 방향·모델 직접 선택 가능</p>
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
            onClick={handleGenerate}
            disabled={busy}
            className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-md font-bold hover:bg-blue-700 disabled:opacity-50 transition whitespace-nowrap"
          >
            {busy ? "생성 중..." : variations.length > 0 ? "🔄 다시 생성" : `🎨 ${count}종 생성`}
          </button>
        </div>
      </div>

      {/* 옵션 토글 */}
      <button
        type="button"
        onClick={() => setOptionsOpen(o => !o)}
        className="text-[11px] font-bold text-blue-700 hover:text-blue-900 mb-2 flex items-center gap-1"
      >
        {optionsOpen ? "▼ 옵션 접기" : "▶ ⚙️ 컨셉·스타일·모델 옵션"}
      </button>

      {optionsOpen && (
        <div className="space-y-3 mb-4 p-3 bg-white border border-blue-200 rounded-lg">
          {/* 0. 표지 후킹 카피 5종 — 표지 디자인과 함께 쓰면 강력 */}
          <div className="pb-3 border-b border-blue-100">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-ink-900">📝 표지 후킹 카피 5종 (선택)</label>
              <button
                type="button"
                onClick={fetchHeadlines}
                disabled={headlinesBusy || !projectId}
                className="text-[11px] px-2 py-1 bg-purple-600 text-white rounded font-bold hover:bg-purple-700 disabled:opacity-50"
              >
                {headlinesBusy ? "생성 중..." : "후킹 카피 5종 (~₩200)"}
              </button>
            </div>
            {headlinesError && <p className="text-[11px] text-red-600 mb-2">{headlinesError}</p>}
            {headlines.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 mt-2">
                {headlines.map(h => (
                  <div key={h.id} className="p-2 bg-purple-50 border border-purple-200 rounded text-[11px]">
                    <div className="flex items-start justify-between gap-1 mb-0.5">
                      <span className="font-bold text-ink-900">{h.title}</span>
                      <span className="text-[9px] font-mono px-1 py-0.5 bg-purple-100 text-purple-800 rounded flex-shrink-0">{h.formula}</span>
                    </div>
                    {h.subtitle && <div className="text-[10px] text-gray-600">{h.subtitle}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 1. AI 컨셉 5종 추천 */}
          <div className="pb-3 border-b border-blue-100">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-ink-900">🤖 AI가 시각 컨셉 5개 추천 (선택)</label>
              <button
                type="button"
                onClick={fetchConcepts}
                disabled={conceptsBusy || !projectId}
                className="text-[11px] px-2 py-1 bg-tiger-orange text-white rounded font-bold hover:bg-orange-600 disabled:opacity-50"
              >
                {conceptsBusy ? "추천 중..." : "추천 받기 (~₩200)"}
              </button>
            </div>
            {conceptsError && (
              <p className="text-[11px] text-red-600 mb-2">{conceptsError}</p>
            )}
            {concepts.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                {concepts.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pickConcept(c)}
                    className="text-left p-2 border border-gray-200 rounded-md hover:border-tiger-orange hover:bg-orange-50/50 transition"
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[11px] font-bold text-ink-900">{c.title}</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded">
                        {c.styleDirection === "image" ? "이미지" : c.styleDirection === "typography" ? "타이포" : "하이브리드"}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-600 line-clamp-2">{c.description}</div>
                    <div className="text-[10px] text-tiger-orange font-bold mt-1">→ 이걸로 컨셉 적용</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 2. 사용자 시각 컨셉 직접 입력 */}
          <div>
            <label className="text-[11px] font-bold text-ink-900 mb-1 block">시각 컨셉 (선택, 직접 입력)</label>
            <textarea
              value={userConcept}
              onChange={e => setUserConcept(e.target.value)}
              rows={2}
              maxLength={400}
              placeholder="예: 흰 종이 위 만년필, 잉크가 데이터 코드처럼 흘러나옴 / 검은 산 실루엣 + 작은 별빛"
              className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded resize-none focus:border-tiger-orange focus:outline-none"
            />
            <p className="text-[10px] text-gray-500 mt-0.5">비워두면 AI가 자동 생성. 입력하면 main subject로 강제 반영.</p>
          </div>

          {/* 3. 스타일 방향 */}
          <div>
            <label className="text-[11px] font-bold text-ink-900 mb-1 block">스타일 방향</label>
            <div className="flex gap-1.5 flex-wrap">
              {[
                { v: "image" as const, label: "🖼 이미지 중심", desc: "시각 메타포 메인" },
                { v: "typography" as const, label: "🔠 타이포 중심", desc: "글씨가 메인 (베스트셀러 스타일)" },
                { v: "hybrid" as const, label: "🎯 하이브리드", desc: "글씨 + 작은 일러스트" },
              ].map(opt => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setStyleDirection(opt.v)}
                  className={`text-[11px] px-2.5 py-1.5 rounded-md border font-medium transition ${
                    styleDirection === opt.v
                      ? "bg-ink-900 text-white border-ink-900"
                      : "bg-white text-gray-700 border-gray-300 hover:border-ink-900"
                  }`}
                  title={opt.desc}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4. 이미지 모델 */}
          <div>
            <label className="text-[11px] font-bold text-ink-900 mb-1 block">이미지 모델</label>
            <div className="flex gap-1.5">
              {[
                { v: "imagen" as const, label: "Imagen 4 Fast", desc: "한국어 글자 깔끔, 추상 강함" },
                { v: "openai" as const, label: "DALL-E 3 (gpt-image-1)", desc: "한국어 주제 이해·구체적 묘사 강함" },
              ].map(opt => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setImageVendor(opt.v)}
                  className={`text-[11px] px-2.5 py-1.5 rounded-md border font-medium transition ${
                    imageVendor === opt.v
                      ? "bg-ink-900 text-white border-ink-900"
                      : "bg-white text-gray-700 border-gray-300 hover:border-ink-900"
                  }`}
                  title={opt.desc}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

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
                onClick={() => setPreviewIdx(v.idx)}
                className="aspect-[3/4] w-full rounded-md overflow-hidden border-2 border-transparent hover:border-blue-600 transition relative group bg-gray-100"
                title={`${v.style} — 클릭해서 크게 보기`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`data:image/png;base64,${v.base64}`} alt={v.style} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center">
                  <span className="text-white font-bold text-xs opacity-0 group-hover:opacity-100">🔍 크게 보기</span>
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

      {/* 큰 미리보기 모달 — 이미지 클릭 시 풀사이즈 보기 + 메인 적용 / 다시 생성 */}
      {previewVariation && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewIdx(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-4 md:p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-black text-ink-900">{previewVariation.style}</h3>
                <p className="text-xs text-gray-500 mt-0.5">vendor: {previewVariation.vendor}</p>
              </div>
              <button
                onClick={() => setPreviewIdx(null)}
                className="text-gray-400 hover:text-ink-900 text-2xl"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>
            <div className="bg-gray-50 rounded-lg overflow-hidden mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:image/png;base64,${previewVariation.base64}`}
                alt={previewVariation.style}
                className="w-full h-auto max-h-[60vh] object-contain"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => {
                  if (previewIdx !== null) onSelect(previewIdx);
                  setPreviewIdx(null);
                }}
                className="flex-1 py-2.5 bg-tiger-orange text-white font-bold rounded-lg hover:bg-orange-600 transition"
              >
                ✓ 이 표지로 메인 적용
              </button>
              {projectId && (
                <div className="flex-1">
                  <ImageRefineButton
                    projectId={projectId}
                    imageType="cover"
                    aspectRatio="1:1"
                    onRefined={(b64) => {
                      if (previewIdx !== null) onRefined(previewIdx, b64);
                    }}
                    onBalanceChange={onBalanceChange}
                  />
                </div>
              )}
              <button
                onClick={() => setPreviewIdx(null)}
                className="px-4 py-2.5 border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
