"use client";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/Header";
import { INTERVIEW_QUESTIONS } from "@/lib/interview-questions";

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const projectId = params.get("id");

  const [answers, setAnswers] = useState<string[]>(() => INTERVIEW_QUESTIONS.map(() => ""));
  const [currentIdx, setCurrentIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<any>(null);
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
    textareaRef.current?.focus();
  }, [currentIdx]);

  const goNext = () => {
    if (currentIdx < INTERVIEW_QUESTIONS.length - 1) setCurrentIdx(i => i + 1);
  };
  const goPrev = () => {
    if (currentIdx > 0) setCurrentIdx(i => i - 1);
  };
  const setAnswer = (val: string) => {
    setAnswers(prev => {
      const next = [...prev];
      next[currentIdx] = val;
      return next;
    });
  };

  const finish = async (skipped: boolean) => {
    if (!project) return;
    if (skipped && !confirm("인터뷰 없이 시작하면 책이 generic해질 수 있습니다. 진짜 건너뛸까요?")) return;
    setBusy(true);
    setError(null);
    try {
      const interview = {
        questions: INTERVIEW_QUESTIONS.map((q, i) => ({ q: q.question, a: answers[i] ?? "" })),
        completedAt: Date.now(),
        skipped,
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
      setBusy(false);
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

  const total = INTERVIEW_QUESTIONS.length;
  const q = INTERVIEW_QUESTIONS[currentIdx];
  const isLast = currentIdx === total - 1;
  const answeredCount = answers.filter(a => a.trim().length > 0).length;

  return (
    <main className="min-h-screen bg-[#fafafa]">
      <Header />
      <div className="max-w-3xl mx-auto px-6 py-10 md:py-16">
        <div className="flex items-center justify-between mb-8">
          <Link href="/projects" className="text-xs font-mono uppercase tracking-wider text-gray-500 hover:text-tiger-orange">← 내 책</Link>
          <button
            onClick={() => finish(true)}
            disabled={busy}
            className="text-xs text-gray-500 hover:text-tiger-orange disabled:opacity-50"
          >
            인터뷰 건너뛰고 시작 →
          </button>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between text-xs font-mono text-gray-500 mb-2">
            <span>질문 {currentIdx + 1} / {total}</span>
            <span>{answeredCount}/{total} 답변</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-tiger-orange transition-all" style={{ width: `${((currentIdx + 1) / total) * 100}%` }} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <p className="text-xs font-mono uppercase tracking-wider text-tiger-orange mb-1">집필 중인 책</p>
          <h1 className="text-base font-bold text-ink-900 line-clamp-1">{project.topic}</h1>
          <p className="text-xs text-gray-500 mt-1">{project.audience} · {project.type}</p>
        </div>

        <div className="flex gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-tiger-orange flex-shrink-0 flex items-center justify-center text-white text-sm font-bold">
            🐯
          </div>
          <div className="flex-1 bg-white rounded-2xl rounded-tl-sm border border-gray-200 p-4">
            <div className="text-xs font-mono uppercase tracking-wider text-tiger-orange mb-2">Tigerbookmaker</div>
            <p className="text-base text-ink-900 leading-relaxed font-bold">{q.question}</p>
            {q.hint && <p className="text-xs text-gray-500 mt-2 leading-relaxed">{q.hint}</p>}
          </div>
        </div>

        <div className="ml-11">
          <textarea
            ref={textareaRef}
            value={answers[currentIdx]}
            onChange={e => setAnswer(e.target.value)}
            placeholder={q.placeholder}
            rows={5}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm leading-relaxed focus:border-tiger-orange focus:outline-none resize-y"
          />
          <div className="flex items-center justify-between mt-3 text-[11px] font-mono text-gray-500">
            <span>{answers[currentIdx].length.toLocaleString()}자 — 길수록 책 품질↑</span>
            <span>(빈 답도 허용 — 건너뛰기)</span>
          </div>
        </div>

        {error && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

        <div className="mt-8 flex items-center justify-between gap-3">
          <button
            onClick={goPrev}
            disabled={currentIdx === 0 || busy}
            className="px-5 py-2.5 border border-gray-300 text-ink-900 rounded-xl font-bold hover:border-ink-900 transition disabled:opacity-30"
          >
            ← 이전
          </button>
          {!isLast ? (
            <button
              onClick={goNext}
              disabled={busy}
              className="px-6 py-2.5 bg-ink-900 text-white rounded-xl font-bold hover:bg-tiger-orange transition disabled:opacity-50"
            >
              다음 →
            </button>
          ) : (
            <button
              onClick={() => finish(false)}
              disabled={busy}
              className="px-6 py-2.5 bg-tiger-orange text-white rounded-xl font-bold shadow-glow-orange-sm hover:bg-orange-600 transition disabled:opacity-50"
            >
              {busy ? "저장 중..." : "완료 → 집필 시작"}
            </button>
          )}
        </div>

        {currentIdx > 0 && (
          <details className="mt-10 text-sm">
            <summary className="cursor-pointer text-xs font-mono uppercase tracking-wider text-gray-500 hover:text-tiger-orange">지금까지 답변 보기 ({answeredCount}/{total})</summary>
            <div className="mt-3 space-y-3">
              {INTERVIEW_QUESTIONS.slice(0, currentIdx).map((qq, i) => (
                <div key={qq.id} className="border-l-2 border-gray-200 pl-3">
                  <p className="text-xs font-bold text-gray-700">Q{i + 1}. {qq.question}</p>
                  <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{answers[i] || "(건너뜀)"}</p>
                </div>
              ))}
            </div>
          </details>
        )}
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
