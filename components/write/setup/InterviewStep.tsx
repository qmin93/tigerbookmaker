"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FIRST_QUESTION } from "@/lib/interview-questions";
import { useAutoSave } from "@/lib/auto-save";

interface QA {
  q: string;
  a: string;
}
interface NextQuestion {
  done?: boolean;
  question?: string;
  placeholder?: string;
  hint?: string;
  summary?: string;
}

/** v3 Phase 1.1: 기존 12 → 7 로 축소 (자료 분석이 빈 부분만 채우게 진행) */
const MAX_QUESTIONS = 7;

interface InterviewStepProps {
  projectId: string;
  onBalanceChange: (b: number) => void;
  onError: (msg: string | null) => void;
  /** Called when interview is complete (saved) — parent navigates to next step */
  onComplete: () => void;
  /** v3 Phase 1.2: 부모에 자동 저장 상태 보고 (indicator UI용) */
  onAutoSaveState?: (s: { isSyncing: boolean; lastSyncedAt: number | null; error: Error | null }) => void;
  /** 초기 history (localStorage 복원 시 부모가 주입) */
  initialHistory?: QA[];
}

export function InterviewStep({
  projectId,
  onBalanceChange,
  onError,
  onComplete,
  onAutoSaveState,
  initialHistory,
}: InterviewStepProps) {
  const [history, setHistory] = useState<QA[]>(initialHistory ?? []);
  const [currentQ, setCurrentQ] = useState<NextQuestion>({ ...FIRST_QUESTION });
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [busy, setBusy] = useState<"loading-next" | "saving" | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [currentQ]);

  // v3 Phase 1.2 — 인터뷰 history + currentAnswer 자동 저장
  // history는 DB에 in-progress 저장 (완료 전에 탭 닫혀도 다음 방문 시 이어쓰기)
  // currentAnswer 는 localStorage only (draft → DB 저장 시점은 submitAnswer)
  // Note: updatedAt 같은 매 렌더 변하는 필드는 포함하지 않음 — content-only 변경 감지를 위해.
  const autoSaveData = useMemo(
    () => ({
      interviewDraft: {
        history,
        currentAnswer,
        currentQuestion: currentQ.question ?? null,
        currentPlaceholder: currentQ.placeholder ?? null,
        currentHint: currentQ.hint ?? null,
      },
    }),
    [history, currentAnswer, currentQ.question, currentQ.placeholder, currentQ.hint],
  );

  const autoSave = useAutoSave({
    key: `tbm-autosave-project-${projectId}-interview`,
    data: autoSaveData,
    enabled: !aiSummary, // 인터뷰 완료 후엔 자동 저장 멈춤 (finishNow가 명시적 저장)
    onSync: async d => {
      // history만 DB에 머지 — currentAnswer는 draft 이므로 DB에 안 보냄
      const projRes = await fetch(`/api/projects/${projectId}`);
      if (!projRes.ok) throw new Error(`프로젝트 로드 실패 (${projRes.status})`);
      const project = await projRes.json();
      const existingInterview = project.interview ?? {};
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            ...project,
            interview: {
              ...existingInterview,
              questions: d.interviewDraft.history,
              // completedAt 은 finishNow 에서만 설정 — in-progress 표시
              inProgress: true,
              updatedAt: Date.now(),
            },
          },
        }),
      });
      if (!res.ok) throw new Error(`자동 저장 실패 (${res.status})`);
    },
  });

  // 자동 저장 상태를 부모(setup/page.tsx)에 보고 — AutoSaveIndicator 렌더에 사용
  const lastReportedRef = useRef<string>("");
  useEffect(() => {
    if (!onAutoSaveState) return;
    const sig = `${autoSave.isSyncing}|${autoSave.lastSyncedAt}|${autoSave.error?.message ?? ""}`;
    if (sig === lastReportedRef.current) return;
    lastReportedRef.current = sig;
    onAutoSaveState({ isSyncing: autoSave.isSyncing, lastSyncedAt: autoSave.lastSyncedAt, error: autoSave.error });
  }, [autoSave.isSyncing, autoSave.lastSyncedAt, autoSave.error, onAutoSaveState]);

  const askNextQuestion = async (newHistory: QA[]) => {
    setBusy("loading-next");
    onError(null);
    try {
      const res = await fetch("/api/generate/interview-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, history: newHistory }),
      });
      const data = await res.json();
      if (res.status === 402) {
        onError("잔액이 부족합니다. 충전 후 다시 시도하거나, '이제 충분' 버튼으로 종료하세요.");
        return;
      }
      if (!res.ok) throw new Error(data.message || `요청 실패 (${res.status})`);
      if (data.newBalance != null) onBalanceChange(data.newBalance);
      if (data.done) {
        setAiSummary(data.summary || "충분히 끌어냈습니다. 시작하세요.");
        setCurrentQ({});
      } else {
        setCurrentQ({
          question: data.question,
          placeholder: data.placeholder,
          hint: data.hint,
        });
        setCurrentAnswer("");
      }
    } catch (e: any) {
      onError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const submitAnswer = async () => {
    if (!currentQ.question) return;
    const newHistory = [...history, { q: currentQ.question, a: currentAnswer }];
    setHistory(newHistory);
    if (newHistory.length >= MAX_QUESTIONS) {
      setAiSummary("최대 질문 수 도달. 시작하세요.");
      setCurrentQ({});
      return;
    }
    await askNextQuestion(newHistory);
  };

  const finishNow = async (skipped: boolean) => {
    if (skipped && history.length === 0 && !confirm("인터뷰 없이 시작하면 책이 generic해질 수 있습니다. 진짜 건너뛸까요?")) return;
    setBusy("saving");
    onError(null);
    try {
      // load latest project state then patch interview
      const projRes = await fetch(`/api/projects/${projectId}`);
      if (!projRes.ok) throw new Error(`프로젝트 로드 실패 (${projRes.status})`);
      const project = await projRes.json();

      const finalHistory =
        currentAnswer.trim() && currentQ.question ? [...history, { q: currentQ.question, a: currentAnswer }] : history;
      const interview = {
        questions: finalHistory,
        completedAt: Date.now(),
        skipped,
        aiDriven: true,
      };
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { ...project, interview } }),
      });
      if (!res.ok) throw new Error(`저장 실패 (${res.status})`);
      onComplete();
    } catch (e: any) {
      onError(e.message);
      setBusy(null);
    }
  };

  const currentNum = history.length + 1;
  const showSkipBtn = history.length === 0;
  const showFinishBtn = history.length >= 3 && !aiSummary;
  const isAiDone = !!aiSummary;

  return (
    <section className="space-y-6">
      <div data-hide-in-micro="header" className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-ink-900">2단계 · AI 인터뷰</h2>
          <p className="text-xs text-gray-500 mt-1">
            AI가 빈 부분만 짧게 묻습니다 (최대 {MAX_QUESTIONS}개). 답이 길수록 책 품질이 올라갑니다.
          </p>
        </div>
        {showSkipBtn && (
          <button
            onClick={() => finishNow(true)}
            disabled={!!busy}
            className="text-xs text-gray-500 hover:text-tiger-orange disabled:opacity-50 whitespace-nowrap"
          >
            인터뷰 건너뛰기 →
          </button>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between text-xs font-mono text-gray-500 mb-2">
          <span>{isAiDone ? `완료 — ${history.length}개 답변 받음` : `질문 ${currentNum} (최대 ${MAX_QUESTIONS})`}</span>
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-tiger-orange transition-all"
            style={{ width: `${Math.min((currentNum / MAX_QUESTIONS) * 100, 100)}%` }}
          />
        </div>
      </div>

      {history.length > 0 && (
        <details data-hide-in-micro="history" open className="text-sm">
          <summary className="cursor-pointer text-xs font-mono uppercase tracking-wider text-gray-500 hover:text-tiger-orange mb-2">
            지금까지 답변 ({history.length}개)
          </summary>
          <div className="space-y-3 mt-3">
            {history.map((qa, i) => (
              <div key={i} className="border-l-2 border-gray-200 pl-3">
                <p className="text-xs font-bold text-gray-700">
                  Q{i + 1}. {qa.q}
                </p>
                <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{qa.a || "(건너뜀)"}</p>
              </div>
            ))}
          </div>
        </details>
      )}

      {isAiDone && aiSummary && (
        <div className="bg-orange-50 rounded-2xl border border-tiger-orange/30 p-5">
          <div className="text-xs font-mono uppercase tracking-wider text-tiger-orange mb-2">🐯 AI 판단</div>
          <p className="text-sm text-ink-900 leading-relaxed">{aiSummary}</p>
        </div>
      )}

      {!isAiDone && currentQ.question && (
        <>
          <div className="flex gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-tiger-orange flex-shrink-0 flex items-center justify-center text-white text-sm font-bold">
              🐯
            </div>
            <div className="flex-1 bg-white rounded-2xl rounded-tl-sm border border-gray-200 p-4">
              <div className="text-xs font-mono uppercase tracking-wider text-tiger-orange mb-2">Tigerbookmaker</div>
              <p className="text-base text-ink-900 leading-relaxed font-bold">{currentQ.question}</p>
              {currentQ.hint && <p className="text-xs text-gray-500 mt-2 leading-relaxed">{currentQ.hint}</p>}
            </div>
          </div>

          <div className="ml-11">
            {currentAnswer === "" && currentQ.placeholder && (
              <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-orange-50 border border-tiger-orange/30 rounded-lg text-xs">
                <span className="text-tiger-orange font-bold">💡 TIP</span>
                <span className="text-ink-900">
                  아래 회색 예시가 마음에 들면{" "}
                  <strong className="px-1.5 py-0.5 bg-white border border-tiger-orange/40 rounded font-mono text-tiger-orange">
                    Enter ↵
                  </strong>{" "}
                  한 번 → 그대로 입력됩니다
                </span>
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={currentAnswer}
              onChange={e => setCurrentAnswer(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey && currentAnswer === "" && currentQ.placeholder) {
                  e.preventDefault();
                  setCurrentAnswer(currentQ.placeholder);
                }
              }}
              placeholder={currentQ.placeholder}
              rows={5}
              disabled={busy === "loading-next"}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm leading-relaxed focus:border-tiger-orange focus:outline-none resize-y disabled:bg-gray-50"
            />
            <div className="flex items-center justify-between mt-3 text-[11px] font-mono text-gray-500">
              <span>{currentAnswer.length.toLocaleString()}자 — 길수록 책 품질↑</span>
              <span>(빈 답도 허용)</span>
            </div>
          </div>
        </>
      )}

      {busy === "loading-next" && (
        <div className="ml-11 mt-4 text-sm text-gray-500 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-tiger-orange animate-pulse" />
          AI가 다음 질문 생각 중...
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        {showFinishBtn && !isAiDone && (
          <button
            onClick={() => finishNow(false)}
            disabled={!!busy}
            className="px-4 py-2 text-xs border border-gray-300 text-ink-900 rounded-lg hover:border-ink-900 transition disabled:opacity-50"
          >
            이제 충분 — 종료 →
          </button>
        )}
        <div className="flex-1" />
        {!isAiDone ? (
          <button
            onClick={submitAnswer}
            disabled={!!busy || !currentQ.question}
            className="px-6 py-2.5 bg-tiger-orange text-white rounded-xl font-bold shadow-glow-orange-sm hover:bg-orange-600 transition disabled:opacity-50"
          >
            {busy === "loading-next" ? "다음 질문 생성 중..." : "다음 →"}
          </button>
        ) : (
          <button
            onClick={() => finishNow(false)}
            disabled={!!busy}
            className="px-6 py-2.5 bg-tiger-orange text-white rounded-xl font-bold shadow-glow-orange-sm hover:bg-orange-600 transition disabled:opacity-50"
          >
            {busy === "saving" ? "저장 중..." : "다음 단계 →"}
          </button>
        )}
      </div>
    </section>
  );
}
