"use client";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/Header";
import { FIRST_QUESTION } from "@/lib/interview-questions";

interface QA { q: string; a: string }
interface NextQuestion {
  done?: boolean;
  question?: string;
  placeholder?: string;
  hint?: string;
  summary?: string;
}

const MAX_QUESTIONS = 12;

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const projectId = params.get("id");

  const [history, setHistory] = useState<QA[]>([]);
  const [currentQ, setCurrentQ] = useState<NextQuestion>({ ...FIRST_QUESTION });
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [busy, setBusy] = useState<"loading-next" | "saving" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<any>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!projectId) {
      router.push("/projects");
      return;
    }
    fetch(`/api/projects/${projectId}`)
      .then(async r => {
        if (r.status === 401) { router.push(`/login?redirect=/write/setup?id=${projectId}`); return; }
        if (!r.ok) throw new Error("프로젝트 로드 실패");
        return r.json();
      })
      .then(p => {
        if (!p) return;
        setProject(p);
        if (p.interview?.completedAt) {
          router.replace(`/write?id=${projectId}`);
        }
      })
      .catch(e => setError(e.message));
  }, [projectId, router]);

  useEffect(() => {
    fetch("/api/me").then(r => r.ok ? r.json() : null).then(d => d && setBalance(d.balance_krw));
  }, []);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [currentQ]);

  const askNextQuestion = async (newHistory: QA[]) => {
    setBusy("loading-next");
    setError(null);
    try {
      const res = await fetch("/api/generate/interview-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, history: newHistory }),
      });
      const data = await res.json();
      if (res.status === 402) {
        setError("잔액이 부족합니다. 충전 후 다시 시도하거나, '이제 충분' 버튼으로 종료하세요.");
        return;
      }
      if (!res.ok) throw new Error(data.message || `요청 실패 (${res.status})`);
      if (data.newBalance != null) setBalance(data.newBalance);
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
      setError(e.message);
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
    if (!project) return;
    if (skipped && history.length === 0 && !confirm("인터뷰 없이 시작하면 책이 generic해질 수 있습니다. 진짜 건너뛸까요?")) return;
    setBusy("saving");
    setError(null);
    try {
      const finalHistory = currentAnswer.trim() && currentQ.question
        ? [...history, { q: currentQ.question, a: currentAnswer }]
        : history;
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
      router.push(`/write?id=${projectId}`);
    } catch (e: any) {
      setError(e.message);
      setBusy(null);
    }
  };

  if (!project) {
    return (
      <main className="min-h-screen bg-[#fafafa]">
        <Header />
        <div className="max-w-2xl mx-auto px-6 py-20 text-center text-gray-500">
          {error ? <p className="text-red-600">{error}</p> : "프로젝트 로딩 중..."}
        </div>
      </main>
    );
  }

  const currentNum = history.length + 1;
  const showSkipBtn = history.length === 0;
  const showFinishBtn = history.length >= 3 && !aiSummary;
  const isAiDone = !!aiSummary;

  return (
    <main className="min-h-screen bg-[#fafafa]">
      <Header />
      <div className="max-w-3xl mx-auto px-6 py-10 md:py-16">
        <div className="flex items-center justify-between mb-8">
          <Link href="/projects" className="text-xs font-mono uppercase tracking-wider text-gray-500 hover:text-tiger-orange">← 내 책</Link>
          {showSkipBtn && (
            <button
              onClick={() => finishNow(true)}
              disabled={!!busy}
              className="text-xs text-gray-500 hover:text-tiger-orange disabled:opacity-50"
            >
              인터뷰 건너뛰고 시작 →
            </button>
          )}
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between text-xs font-mono text-gray-500 mb-2">
            <span>
              {isAiDone ? `완료 — ${history.length}개 답변 받음` : `질문 ${currentNum} (최대 ${MAX_QUESTIONS})`}
            </span>
            <span>잔액 ₩{balance?.toLocaleString() ?? "—"}</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-tiger-orange transition-all"
              style={{ width: `${Math.min((currentNum / MAX_QUESTIONS) * 100, 100)}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <p className="text-xs font-mono uppercase tracking-wider text-tiger-orange mb-1">집필 중인 책</p>
          <h1 className="text-base font-bold text-ink-900 line-clamp-1">{project.topic}</h1>
          <p className="text-xs text-gray-500 mt-1">{project.audience} · {project.type}</p>
        </div>

        {history.length > 0 && (
          <details open className="mb-6 text-sm">
            <summary className="cursor-pointer text-xs font-mono uppercase tracking-wider text-gray-500 hover:text-tiger-orange mb-2">
              지금까지 답변 ({history.length}개)
            </summary>
            <div className="space-y-3 mt-3">
              {history.map((qa, i) => (
                <div key={i} className="border-l-2 border-gray-200 pl-3">
                  <p className="text-xs font-bold text-gray-700">Q{i + 1}. {qa.q}</p>
                  <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{qa.a || "(건너뜀)"}</p>
                </div>
              ))}
            </div>
          </details>
        )}

        {isAiDone && aiSummary && (
          <div className="bg-orange-50 rounded-2xl border border-tiger-orange/30 p-5 mb-6">
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
              <textarea
                ref={textareaRef}
                value={currentAnswer}
                onChange={e => setCurrentAnswer(e.target.value)}
                onKeyDown={e => {
                  // 빈 상태에서 Enter (Shift 없이) → placeholder 그대로 채움
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
                <span>{currentAnswer === "" && currentQ.placeholder ? "↵ Enter로 예시 그대로 사용" : "(빈 답도 허용)"}</span>
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

        {error && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

        <div className="mt-8 flex items-center justify-between gap-3">
          {showFinishBtn && !isAiDone && (
            <button
              onClick={() => finishNow(false)}
              disabled={!!busy}
              className="px-4 py-2 text-xs border border-gray-300 text-ink-900 rounded-lg hover:border-ink-900 transition disabled:opacity-50"
            >
              이제 충분 — 시작 →
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
              {busy === "saving" ? "저장 중..." : "완료 → 집필 시작"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

export default function SetupPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#fafafa] flex items-center justify-center text-gray-500">로딩...</main>}>
      <Inner />
    </Suspense>
  );
}
