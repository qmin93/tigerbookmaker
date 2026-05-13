// components/write/ChapterRegenerateButton.tsx
// 자연어 피드백으로 챕터 재생성 — 모달 + 빠른 프리셋.
// v3 Phase 2.3 (2026-05-13).
//
// 비용: ₩300 — 본문 1챕터와 동일.

"use client";

import { useEffect, useState } from "react";

const COST_KRW = 300;

const PRESETS = [
  { key: "shorter", label: "더 짧게", feedback: "전체 분량을 2,000자 정도로 줄이세요. 핵심만 남기고 군더더기 제거." },
  { key: "examples", label: "예시 3개 추가", feedback: "본문에 구체적인 예시 3개를 추가하세요. 각 예시는 실제 상황·인물·수치를 포함." },
  { key: "friendly", label: "톤 친근하게", feedback: "격식체를 줄이고 일상 대화처럼 친근한 톤으로 다시 쓰세요. '~합니다' 대신 '~해요' 위주로." },
  { key: "detailed", label: "더 자세히", feedback: "각 소제목 섹션을 더 자세히 풀어쓰세요. 단계별 설명과 배경 맥락을 추가." },
];

interface Props {
  chapterIdx: number;
  projectId: string;
  /** 본문 100자 미만이면 버튼 비활성 */
  chapterContentLength: number;
  /** 잔액 — 300원 미만이면 비활성 */
  balanceKrw?: number | null;
  /** 성공 시 부모에게 새 본문 전달 (localState·DB는 라우트가 이미 저장함) */
  onSuccess?: (newContent: string, newBalance: number) => void;
  /** 컴팩트 버튼 (chapter content 상단에 인라인) */
  compact?: boolean;
}

export function ChapterRegenerateButton({
  chapterIdx, projectId, chapterContentLength,
  balanceKrw, onSuccess, compact,
}: Props) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tooShort = chapterContentLength < 100;
  const insufficientBalance = balanceKrw != null && balanceKrw < COST_KRW;
  const buttonDisabled = tooShort || insufficientBalance;

  // 모달 열릴 때 textarea autofocus + ESC 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy]);

  const submit = async () => {
    const fb = feedback.trim();
    if (fb.length < 2) {
      setError("피드백을 2자 이상 입력하세요.");
      return;
    }
    if (!confirm(`이 챕터를 재생성합니다. ₩${COST_KRW.toLocaleString()}이 차감됩니다. 계속할까요?\n\n피드백: "${fb.slice(0, 60)}${fb.length > 60 ? "..." : ""}"`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/chapter/${chapterIdx}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, feedback: fb }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        const msg = data?.message ?? data?.error ?? `재생성 실패 (${res.status})`;
        setError(msg);
        return;
      }
      onSuccess?.(data.newContent, data.newBalance);
      setOpen(false);
      setFeedback("");
    } catch (e: any) {
      setError(e?.message ?? "네트워크 오류");
    } finally {
      setBusy(false);
    }
  };

  const applyPreset = (preset: typeof PRESETS[number]) => {
    setFeedback(preset.feedback);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={buttonDisabled}
        title={
          tooShort
            ? "본문이 있는 챕터에서만 사용 가능"
            : insufficientBalance
              ? `잔액 부족 (₩${COST_KRW.toLocaleString()} 필요)`
              : "자연어 피드백으로 챕터 재생성"
        }
        className={
          compact
            ? "px-2.5 py-1 text-xs font-bold bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
            : "px-3 py-1.5 text-xs font-bold bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-50 transition"
        }
      >
        ✨ 자연어로 재생성 (₩{COST_KRW.toLocaleString()})
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => { if (!busy) setOpen(false); }}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-3 border-b border-gray-100">
              <div className="flex items-start gap-3">
                <span className="text-2xl">✨</span>
                <div className="flex-1">
                  <h3 className="text-base font-black tracking-tight text-ink-900">
                    {chapterIdx + 1}장 자연어로 재생성
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    이 챕터 어떻게 바꿀까요? 자연어로 알려주세요.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* presets */}
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-gray-500 mb-2">
                  빠른 프리셋
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.map(p => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => applyPreset(p)}
                      disabled={busy}
                      className="px-2.5 py-1 text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200 rounded hover:bg-orange-100 disabled:opacity-50 transition"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* textarea */}
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-gray-500 mb-1">
                  피드백 (2~500자)
                </label>
                <textarea
                  autoFocus
                  value={feedback}
                  onChange={(e) => { setFeedback(e.target.value); setError(null); }}
                  disabled={busy}
                  rows={4}
                  maxLength={500}
                  placeholder="예: '예시 3개 추가', '톤 친근하게', '한 문장 평균 길이 짧게'"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:border-tiger-orange focus:ring-1 focus:ring-tiger-orange outline-none disabled:bg-gray-50"
                />
                <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1">
                  <span>{feedback.length} / 500</span>
                  {balanceKrw != null && (
                    <span>잔액: ₩{balanceKrw.toLocaleString()}</span>
                  )}
                </div>
              </div>

              {error && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                  {error}
                </div>
              )}

              {/* cost notice */}
              <div className="p-2.5 bg-orange-50 border border-orange-100 rounded text-xs text-orange-700">
                ⚠️ 재생성 비용: <strong>₩{COST_KRW.toLocaleString()}</strong> — 기존 본문이 새 본문으로 교체됩니다.
              </div>

              {/* actions */}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={busy}
                  className="px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50 rounded transition disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={busy || feedback.trim().length < 2}
                  className="px-4 py-1.5 text-xs font-bold bg-tiger-orange text-white rounded hover:bg-orange-600 disabled:opacity-50 transition"
                >
                  {busy ? "재생성 중..." : `재생성 (₩${COST_KRW.toLocaleString()})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
