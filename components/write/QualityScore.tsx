// components/write/QualityScore.tsx
// 챕터별 한국어 자연성 점수 + 개선 제안.
// v3 Phase 2.1 (2026-05-13).
//
// 인라인/컴팩트 모드 둘 다 지원. 기본 collapsed — 토글로 펼침.
// 점수 없으면 "점수 보기 (₩50)" 버튼만. 있으면 점수 + 제안 노출.

"use client";

import { useState } from "react";

export interface QualityScoreData {
  score: number;
  suggestions: string[];
  generatedAt: string;
}

interface Props {
  chapterIdx: number;
  projectId: string;
  /** 본문 길이 — 200자 미만이면 버튼 비활성 */
  chapterContentLength: number;
  /** 캐시된 점수 (있으면 재호출 X, 사용자가 새로 받기 누를 때만 호출) */
  cachedScore?: QualityScoreData | null;
  /** 잔액 — 50 미만이면 버튼 비활성 */
  balanceKrw?: number | null;
  /** AI 호출 성공 시 부모에게 알림 (잔액·캐시 동기화) */
  onScored?: (data: QualityScoreData & { newBalance: number }) => void;
  /** 기본 false — 컴팩트 모드는 score 숫자 + 토글만 (인라인용) */
  compact?: boolean;
}

const COST_KRW = 50;

function scoreColor(score: number): { bg: string; text: string; ring: string; label: string } {
  if (score >= 80) return { bg: "bg-green-50", text: "text-green-700", ring: "ring-green-200", label: "우수" };
  if (score >= 60) return { bg: "bg-orange-50", text: "text-orange-700", ring: "ring-orange-200", label: "보통" };
  return { bg: "bg-red-50", text: "text-red-700", ring: "ring-red-200", label: "재작성 추천" };
}

export function QualityScore({
  chapterIdx, projectId, chapterContentLength,
  cachedScore, balanceKrw, onScored, compact,
}: Props) {
  const [score, setScore] = useState<QualityScoreData | null>(cachedScore ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const tooShort = chapterContentLength < 200;
  const insufficientBalance = balanceKrw != null && balanceKrw < COST_KRW;
  const disabled = busy || tooShort || insufficientBalance;

  const fetchScore = async () => {
    if (disabled) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/chapter/${chapterIdx}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        const msg = data?.message ?? data?.error ?? `점수 호출 실패 (${res.status})`;
        setError(msg);
        return;
      }
      const next: QualityScoreData = {
        score: data.score,
        suggestions: data.suggestions ?? [],
        generatedAt: data.generatedAt,
      };
      setScore(next);
      setExpanded(true);
      onScored?.({ ...next, newBalance: data.newBalance });
    } catch (e: any) {
      setError(e?.message ?? "네트워크 오류");
    } finally {
      setBusy(false);
    }
  };

  // No score yet — show button
  if (!score) {
    return (
      <div className={compact ? "inline-flex items-center gap-2" : "flex items-start gap-2"}>
        <button
          type="button"
          onClick={fetchScore}
          disabled={disabled}
          title={
            tooShort
              ? "본문 200자 이상에서 사용 가능"
              : insufficientBalance
                ? `잔액 부족 (₩${COST_KRW} 필요)`
                : "AI가 한국어 자연성을 0~100점으로 평가"
          }
          className="px-2.5 py-1 text-xs font-bold bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {busy ? "평가 중..." : `📊 점수 보기 (₩${COST_KRW})`}
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    );
  }

  // Has score
  const col = scoreColor(score.score);

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        title={`${col.label} (${score.score}점) — 클릭해서 개선 제안 보기`}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-bold rounded ${col.bg} ${col.text} ring-1 ${col.ring} hover:brightness-95 transition`}
      >
        <span>📊</span>
        <span>{score.score}점</span>
        <span className="text-[10px] opacity-70">{col.label}</span>
      </button>
    );
  }

  return (
    <div className={`rounded-lg border border-gray-200 ${col.bg} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:brightness-95 transition"
      >
        <div className={`flex flex-col items-center justify-center w-12 h-12 rounded ${col.text} bg-white/60 border ${col.ring} ring-0`}>
          <div className="text-xl font-black leading-none">{score.score}</div>
          <div className="text-[8px] font-bold uppercase tracking-wider opacity-70">/100</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-bold ${col.text}`}>
            한국어 자연성: {col.label}
          </div>
          <div className="text-[11px] text-gray-500">
            제안 {score.suggestions.length}개 — 클릭해서 {expanded ? "접기" : "펼치기"}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); fetchScore(); }}
            disabled={disabled}
            className="px-2 py-1 text-[10px] font-bold bg-white text-gray-700 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 transition"
            title={`₩${COST_KRW} — 다시 평가받기`}
          >
            {busy ? "..." : `다시 (₩${COST_KRW})`}
          </button>
          <span className={`text-xs ${col.text}`}>{expanded ? "▾" : "▸"}</span>
        </div>
      </button>

      {expanded && score.suggestions.length > 0 && (
        <div className="px-3 pb-3 pt-1 bg-white/60 border-t border-gray-200">
          <div className="text-[10px] font-mono uppercase tracking-wider text-gray-500 mb-1.5">
            개선 제안
          </div>
          <ul className="space-y-1.5">
            {score.suggestions.map((s, i) => (
              <li key={i} className="flex gap-2 text-xs text-gray-700 leading-snug">
                <span className={`flex-shrink-0 w-4 h-4 rounded-full ${col.bg} ${col.text} text-[9px] font-bold flex items-center justify-center mt-0.5`}>
                  {i + 1}
                </span>
                <span className="min-w-0">{s}</span>
              </li>
            ))}
          </ul>
          {score.generatedAt && (
            <div className="text-[10px] text-gray-400 mt-2">
              {new Date(score.generatedAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}
            </div>
          )}
        </div>
      )}
      {error && (
        <div className="px-3 py-2 bg-red-50 border-t border-red-100 text-xs text-red-600">
          {error}
        </div>
      )}
    </div>
  );
}
