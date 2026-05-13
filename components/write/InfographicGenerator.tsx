// 인포그래픽 카드뉴스 생성 UI (spec PR #5)
// /api/generate/infographic 사용 — referencesSummary.keyPoints 5개 → 1080x1080 PNG 5장
// 인스타/트위터 공유용. ₩1,000 (Sharp 기반, AI 호출 X).

"use client";

import { useEffect, useMemo, useState } from "react";

interface InfographicSlide {
  slideNum: number;
  base64: string;
}

type InfographicTemplate = "minimal" | "bold" | "dark";

interface CachedInfographic {
  template: InfographicTemplate;
  slides: InfographicSlide[];
  generatedAt: number;
}

interface InfographicGeneratorProps {
  projectId: string;
  referencesSummary?: { keyPoints?: string[] } | null;
  /** 캐시된 결과 (project.data.infographic) — 있으면 즉시 표시 */
  cached?: CachedInfographic | null;
  /** 잔액 (있으면 잔액 부족 시 버튼 disable) */
  balanceKRW?: number | null;
  /** 잔액 변경 콜백 (생성 후 newBalance) */
  onBalanceChange?: (newBalance: number) => void;
}

const COST_KRW = 1000;
const TARGET_SLIDES = 5;
const TEMPLATES: { key: InfographicTemplate; label: string; desc: string }[] = [
  { key: "bold", label: "Bold", desc: "강렬한 컬러, 광고용" },
  { key: "minimal", label: "Minimal", desc: "깔끔, 본문 친화" },
  { key: "dark", label: "Dark", desc: "어두운 톤, 시네마틱" },
];

export default function InfographicGenerator({
  projectId,
  referencesSummary,
  cached,
  balanceKRW,
  onBalanceChange,
}: InfographicGeneratorProps) {
  const [template, setTemplate] = useState<InfographicTemplate>(cached?.template ?? "bold");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slides, setSlides] = useState<InfographicSlide[] | null>(cached?.slides ?? null);
  const [zipBusy, setZipBusy] = useState(false);

  // 캐시 prop이 바뀌면 동기화 (프로젝트 전환 시)
  useEffect(() => {
    setSlides(cached?.slides ?? null);
    if (cached?.template) setTemplate(cached.template);
  }, [cached?.generatedAt, cached?.slides, cached?.template]);

  const keyPoints = referencesSummary?.keyPoints ?? [];
  const hasKeyPoints = keyPoints.filter(s => typeof s === "string" && s.trim().length > 0).length > 0;
  const insufficientBalance = typeof balanceKRW === "number" && balanceKRW < COST_KRW;

  const buttonLabel = useMemo(() => {
    if (busy) return `생성 중... (${slides?.length ?? 0}/${TARGET_SLIDES})`;
    if (slides && slides.length > 0) return `다시 생성 (₩${COST_KRW.toLocaleString()})`;
    return `5장 생성 (₩${COST_KRW.toLocaleString()})`;
  }, [busy, slides]);

  const generate = async () => {
    if (!projectId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/generate/infographic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, template }),
      });
      const d = await res.json();
      if (!res.ok) {
        // 친절 에러 메시지 매핑
        if (d.error === "MISSING_KEYPOINTS") {
          throw new Error(d.message || "먼저 자료 분석 단계에서 핵심 포인트를 추출하세요.");
        }
        if (d.error === "INSUFFICIENT_BALANCE") {
          throw new Error(d.message || `잔액 부족 (~₩${COST_KRW} 필요)`);
        }
        if (d.error === "RATE_LIMITED") {
          throw new Error("너무 자주 요청했습니다. 잠시 후 다시 시도하세요.");
        }
        throw new Error(d.message || `생성 실패 (${res.status})`);
      }
      const list: InfographicSlide[] = Array.isArray(d.infographics) ? d.infographics : [];
      setSlides(list);
      if (typeof d.newBalance === "number" && onBalanceChange) onBalanceChange(d.newBalance);
      if (Array.isArray(d.failedSlides) && d.failedSlides.length > 0) {
        setError(`${d.failedSlides.length}장 생성 실패 (slides: ${d.failedSlides.join(", ")})`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "생성 실패");
    } finally {
      setBusy(false);
    }
  };

  const downloadAllZip = async () => {
    if (!slides || slides.length === 0 || zipBusy) return;
    setZipBusy(true);
    try {
      // 동적 import — 초기 번들 크기 절약
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      for (const s of slides) {
        // base64 → Uint8Array
        const bin = atob(s.base64);
        const len = bin.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
        zip.file(`tigerbookmaker-infographic-${s.slideNum}-of-${TARGET_SLIDES}.png`, bytes);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tigerbookmaker-infographic-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "zip 다운로드 실패");
    } finally {
      setZipBusy(false);
    }
  };

  return (
    <section className="mb-10">
      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-600 font-bold mb-3">
        선택 · 카드뉴스 인포그래픽
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6">
        <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-ink-900 mb-1">📱 인포그래픽 카드뉴스 (인스타·트위터 공유용)</h3>
            <p className="text-sm text-gray-600">
              책 핵심 5개 → 1080×1080 PNG 5장. Sharp 기반 (AI 호출 X) — ~10초 내 생성.
            </p>
          </div>
          <button
            onClick={generate}
            disabled={busy || !projectId || !hasKeyPoints || insufficientBalance}
            className="px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-xl min-h-[44px] hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap"
            title={
              !hasKeyPoints
                ? "먼저 자료 분석 단계에서 핵심 포인트를 추출하세요"
                : insufficientBalance
                ? `잔액 부족 (~₩${COST_KRW.toLocaleString()} 필요)`
                : ""
            }
          >
            {buttonLabel}
          </button>
        </div>

        {/* 템플릿 선택 */}
        <div className="mb-4">
          <div className="text-[11px] font-mono uppercase tracking-wider text-gray-500 mb-2">템플릿</div>
          <div className="grid grid-cols-3 gap-2">
            {TEMPLATES.map(t => {
              const isSelected = template === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTemplate(t.key)}
                  disabled={busy}
                  className={`text-left px-3 py-2 rounded-xl border-2 transition disabled:opacity-50 ${
                    isSelected
                      ? "border-emerald-600 bg-emerald-600/5"
                      : "border-gray-200 bg-white hover:border-emerald-600/40"
                  }`}
                >
                  <div className="font-bold text-ink-900 text-sm">{t.label}</div>
                  <div className="text-[11px] text-gray-500">{t.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 핵심 포인트 미존재 안내 */}
        {!hasKeyPoints && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900 mb-4">
            먼저 자료 분석 단계에서 핵심 포인트가 추출돼야 합니다.{" "}
            <span className="text-amber-700">
              /write/setup → &quot;AI가 자료 정리하기&quot;를 먼저 실행하세요.
            </span>
          </div>
        )}

        {/* 잔액 부족 안내 */}
        {hasKeyPoints && insufficientBalance && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">
            잔액 부족 — 카드뉴스 5장 생성에 ₩{COST_KRW.toLocaleString()}이 필요합니다.
            (현재 잔액: ₩{(balanceKRW ?? 0).toLocaleString()})
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">
            {error}
          </div>
        )}

        {/* 결과 */}
        {slides && slides.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <div className="text-sm text-gray-700">
                <span className="font-bold text-ink-900">{slides.length}장</span>{" "}
                생성됨{cached?.generatedAt ? ` · ${new Date(cached.generatedAt).toLocaleDateString("ko-KR")}` : ""}
              </div>
              <button
                onClick={downloadAllZip}
                disabled={zipBusy}
                className="px-4 py-2 bg-ink-900 text-white text-sm font-bold rounded-lg hover:bg-black disabled:opacity-50"
              >
                {zipBusy ? "압축 중..." : "↓ 전부 zip 다운로드"}
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {slides.map((s) => (
                <div key={s.slideNum} className="space-y-2">
                  <div className="rounded-lg overflow-hidden border border-gray-200 bg-gray-50 aspect-square">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`data:image/png;base64,${s.base64}`}
                      alt={`인포그래픽 ${s.slideNum}/${TARGET_SLIDES}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono text-gray-500">{s.slideNum}/{TARGET_SLIDES}</span>
                    <a
                      href={`data:image/png;base64,${s.base64}`}
                      download={`tigerbookmaker-infographic-${s.slideNum}-of-${TARGET_SLIDES}.png`}
                      className="text-emerald-600 font-bold hover:underline"
                    >
                      ↓ 다운로드
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
