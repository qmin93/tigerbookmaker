// components/write/BookQualityBadge.tsx
// 크몽 통과 가능성 — heuristic 점수 + breakdown.
// v3 Phase 2.2 (2026-05-13).
//
// 마운트 시 /api/book/[id]/quality 1회 GET. 5분 후 자동 refetch (책 진행 따라 점수 ↑).
// 컴팩트 배지 — 클릭하면 breakdown 펼침.

"use client";

import { useEffect, useState } from "react";

interface BreakdownItem {
  criterion: string;
  passed: boolean;
  weight: number;
  detail?: string;
}

interface QualityResult {
  score: number;
  breakdown: BreakdownItem[];
  generatedAt: string;
}

interface Props {
  bookId: string;
  /** auto-refetch 간격 (ms). 기본 5분. 0이면 한 번만. */
  refetchIntervalMs?: number;
}

function badgeColor(score: number): { bg: string; text: string; border: string; label: string; ring: string } {
  if (score >= 80) return { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", label: "통과 유망", ring: "ring-green-200" };
  if (score >= 60) return { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", label: "보완 필요", ring: "ring-orange-200" };
  return { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", label: "추가 작업 필요", ring: "ring-red-200" };
}

export function BookQualityBadge({ bookId, refetchIntervalMs = 5 * 60 * 1000 }: Props) {
  const [data, setData] = useState<QualityResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (cancelled) return;
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/book/${bookId}/quality`, { cache: "no-store" });
        if (cancelled) return;
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(json?.message ?? json?.error ?? `${res.status}`);
          return;
        }
        setData(json);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "네트워크 오류");
      } finally {
        if (!cancelled) setBusy(false);
      }
    };
    load();
    if (refetchIntervalMs > 0) {
      const tid = setInterval(load, refetchIntervalMs);
      return () => {
        cancelled = true;
        clearInterval(tid);
      };
    }
    return () => { cancelled = true; };
  }, [bookId, refetchIntervalMs]);

  if (busy && !data) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-mono text-gray-400">
        <span className="inline-block w-2 h-2 rounded-full bg-gray-300 animate-pulse" />
        평가 중...
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-500" title={error}>
        ⚠ 점수 로드 실패
      </div>
    );
  }

  if (!data) return null;

  const col = badgeColor(data.score);
  const passedCount = data.breakdown.filter(b => b.passed).length;

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        title={`크몽 통과 가능성 ${data.score}% — 클릭해서 기준 확인`}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-md border ${col.bg} ${col.text} ${col.border} hover:brightness-95 transition`}
      >
        <span>📊</span>
        <span className="hidden sm:inline">크몽 통과 가능성</span>
        <span className="sm:hidden">통과</span>
        <span className="font-black">{data.score}%</span>
        <span className="hidden md:inline text-[10px] opacity-80">· {col.label}</span>
        <span className="text-[10px] opacity-60">{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded && (
        <>
          {/* backdrop — 모달 아닌 dropdown 형식 */}
          <div className="fixed inset-0 z-[100]" onClick={() => setExpanded(false)} />
          <div className="absolute right-0 sm:left-0 sm:right-auto top-full mt-2 z-[101] w-[320px] sm:w-[360px] bg-white border border-gray-200 rounded-lg shadow-2xl overflow-hidden">
            <div className={`px-4 py-3 ${col.bg} border-b ${col.border}`}>
              <div className="flex items-center gap-3">
                <div className={`flex flex-col items-center justify-center w-14 h-14 rounded-md bg-white border ${col.border}`}>
                  <div className={`text-2xl font-black leading-none ${col.text}`}>{data.score}</div>
                  <div className="text-[8px] font-bold uppercase tracking-wider text-gray-500">/100</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-black ${col.text}`}>{col.label}</div>
                  <div className="text-[11px] text-gray-600 mt-0.5">
                    {passedCount}/{data.breakdown.length} 기준 통과
                  </div>
                </div>
              </div>
            </div>

            <div className="px-4 py-3 max-h-[400px] overflow-y-auto">
              <div className="text-[10px] font-mono uppercase tracking-wider text-gray-500 mb-2">
                평가 기준 (heuristic)
              </div>
              <ul className="space-y-2">
                {data.breakdown.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs leading-snug">
                    <span
                      className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        b.passed ? "bg-green-100 text-green-700" : "bg-red-50 text-red-600"
                      }`}
                    >
                      {b.passed ? "✓" : "✗"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${b.passed ? "text-gray-800" : "text-gray-700"}`}>
                          {b.criterion}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">+{b.weight}</span>
                      </div>
                      {b.detail && (
                        <div className="text-[11px] text-gray-500 mt-0.5">{b.detail}</div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="text-[10px] text-gray-400 mt-3 pt-2 border-t border-gray-100">
                {new Date(data.generatedAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })} 갱신
                · AI 호출 없는 빠른 평가
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
