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

  // 레퍼런스 업로드 — Phase 1
  const [references, setReferences] = useState<{ id: string; filename: string; sourceType: string; chunkCount: number; totalChars: number }[]>([]);
  const [refUploadBusy, setRefUploadBusy] = useState(false);
  const [refUploadMode, setRefUploadMode] = useState<"none" | "pdf" | "url" | "text">("none");
  const [refUrlInput, setRefUrlInput] = useState("");
  const [refTextInput, setRefTextInput] = useState("");

  // AI 자료 분석 — Phase 2
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [referencesSummary, setReferencesSummary] = useState<{
    keyPoints: string[]; coveredTopics: string[]; gaps: string[];
    generatedAt: number; basedOnChunkCount: number;
  } | null>(null);

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

  // 레퍼런스 목록 로드
  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/reference/list?projectId=${projectId}`)
      .then(r => r.ok ? r.json() : { references: [] })
      .then(d => setReferences(d.references || []))
      .catch(() => {});
  }, [projectId]);

  // project 로드 시 referencesSummary 동기화
  useEffect(() => {
    if (project?.referencesSummary) setReferencesSummary(project.referencesSummary);
  }, [project]);

  const generateSummary = async () => {
    if (!projectId || references.length === 0) return;
    setSummaryBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/generate/reference-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `요약 실패 (${res.status})`);
      setReferencesSummary(data.summary);
      if (typeof data.newBalance === "number") setBalance(data.newBalance);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSummaryBusy(false);
    }
  };

  const clearSummary = async () => {
    if (!confirm("요약을 지우고 다시 만들까요?")) return;
    setReferencesSummary(null);
    await generateSummary();
  };

  const uploadPdfReference = async (file: File) => {
    if (!projectId) return;
    setRefUploadBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("projectId", projectId);
      const res = await fetch("/api/reference/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `업로드 실패 (${res.status})`);
      setReferences(prev => [{
        id: data.id, filename: data.filename, sourceType: data.sourceType,
        chunkCount: data.chunkCount, totalChars: data.totalChars,
      }, ...prev]);
      setRefUploadMode("none");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRefUploadBusy(false);
    }
  };

  const uploadUrlReference = async () => {
    if (!projectId || !refUrlInput.trim()) return;
    setRefUploadBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/reference/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, type: "url", url: refUrlInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `업로드 실패 (${res.status})`);
      setReferences(prev => [data, ...prev]);
      setRefUrlInput("");
      setRefUploadMode("none");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRefUploadBusy(false);
    }
  };

  const uploadTextReference = async () => {
    if (!projectId || refTextInput.trim().length < 50) return;
    setRefUploadBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/reference/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, type: "text", text: refTextInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `업로드 실패 (${res.status})`);
      setReferences(prev => [data, ...prev]);
      setRefTextInput("");
      setRefUploadMode("none");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRefUploadBusy(false);
    }
  };

  const deleteReference = async (id: string) => {
    if (!confirm("이 레퍼런스를 삭제할까요? 해당 내용은 더 이상 인터뷰·목차·본문에 활용되지 않습니다.")) return;
    try {
      const res = await fetch(`/api/reference/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
      setReferences(prev => prev.filter(r => r.id !== id));
    } catch (e: any) {
      setError(e.message);
    }
  };

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

        {/* 레퍼런스 업로드 — Phase 1 */}
        <div className="mb-6 p-5 bg-orange-50/50 border border-tiger-orange/30 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-ink-900">📚 참고 자료 ({references.length})</h3>
            {refUploadMode === "none" && (
              <div className="flex gap-1">
                <label className="text-xs px-2 py-1 bg-tiger-orange text-white rounded font-bold cursor-pointer hover:bg-orange-600">
                  PDF
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={e => e.target.files?.[0] && uploadPdfReference(e.target.files[0])}
                    disabled={refUploadBusy}
                  />
                </label>
                <button onClick={() => setRefUploadMode("url")} disabled={refUploadBusy} className="text-xs px-2 py-1 border border-tiger-orange text-tiger-orange rounded font-bold hover:bg-orange-100">URL</button>
                <button onClick={() => setRefUploadMode("text")} disabled={refUploadBusy} className="text-xs px-2 py-1 border border-tiger-orange text-tiger-orange rounded font-bold hover:bg-orange-100">텍스트</button>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-600 mb-3">
            PDF·블로그 URL·메모 등을 올리면 AI가 정확히 읽고 인터뷰·목차·본문에 활용합니다. (10MB 이하 PDF, 정적 HTML URL, 50~50만자 텍스트)
          </p>

          {refUploadBusy && (
            <div className="p-3 bg-white rounded-lg text-xs text-tiger-orange">⏳ 처리 중... (PDF는 페이지 수에 따라 10~60초)</div>
          )}

          {refUploadMode === "url" && (
            <div className="flex gap-2 mb-3">
              <input
                type="url"
                value={refUrlInput}
                onChange={e => setRefUrlInput(e.target.value)}
                placeholder="https://brunch.co.kr/@..."
                className="flex-1 text-xs px-3 py-2 border border-gray-300 rounded focus:border-tiger-orange focus:outline-none"
              />
              <button onClick={uploadUrlReference} disabled={refUploadBusy || !refUrlInput.trim()} className="text-xs px-3 py-2 bg-tiger-orange text-white rounded font-bold hover:bg-orange-600 disabled:opacity-50">가져오기</button>
              <button onClick={() => { setRefUploadMode("none"); setRefUrlInput(""); }} className="text-xs px-2 py-2 text-gray-500 hover:text-ink-900">취소</button>
            </div>
          )}

          {refUploadMode === "text" && (
            <div className="mb-3">
              <textarea
                value={refTextInput}
                onChange={e => setRefTextInput(e.target.value)}
                placeholder="참고할 텍스트를 붙여넣으세요 (50~500,000자)"
                rows={5}
                className="w-full text-xs px-3 py-2 border border-gray-300 rounded focus:border-tiger-orange focus:outline-none mb-2 resize-y"
              />
              <div className="flex gap-2 items-center">
                <button onClick={uploadTextReference} disabled={refUploadBusy || refTextInput.trim().length < 50} className="text-xs px-3 py-2 bg-tiger-orange text-white rounded font-bold hover:bg-orange-600 disabled:opacity-50">저장</button>
                <button onClick={() => { setRefUploadMode("none"); setRefTextInput(""); }} className="text-xs px-2 py-2 text-gray-500 hover:text-ink-900">취소</button>
                <span className="text-[10px] text-gray-500 ml-auto">{refTextInput.length}자</span>
              </div>
            </div>
          )}

          {references.length > 0 && (
            <div className="space-y-1.5">
              {references.map(r => (
                <div key={r.id} className="flex items-center gap-2 p-2 bg-white rounded border border-gray-200 text-xs">
                  <span className="text-base">
                    {r.sourceType === "pdf" ? "📄" : r.sourceType === "url" ? "🌐" : "📝"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-ink-900 truncate">{r.filename}</div>
                    <div className="text-[10px] text-gray-500">{r.totalChars.toLocaleString()}자 · {r.chunkCount} chunks</div>
                  </div>
                  <button onClick={() => deleteReference(r.id)} className="text-[10px] text-gray-400 hover:text-red-600">삭제</button>
                </div>
              ))}
            </div>
          )}

          {references.length === 0 && refUploadMode === "none" && !refUploadBusy && (
            <div className="text-center py-4 text-xs text-gray-400">
              참고 자료 없이 인터뷰만 진행해도 OK. 자료 있으면 더 정확한 책이 됩니다.
            </div>
          )}
        </div>

        {/* AI 자료 분석 — Phase 2 */}
        {references.length > 0 && (
          <div className="mb-6 p-5 bg-yellow-50/50 border border-tiger-orange/40 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-ink-900">🤖 AI 자료 분석</h3>
              {referencesSummary && (
                <button onClick={clearSummary} className="text-[10px] text-gray-400 hover:text-red-600">다시 분석</button>
              )}
            </div>

            {!referencesSummary && !summaryBusy && (
              <>
                <p className="text-xs text-gray-600 mb-3">
                  AI가 모든 자료를 읽고 핵심 5가지 + 빠진 부분을 정리합니다. 그 후 인터뷰는 빈 부분만 짧게 (5~7개) 진행됩니다.
                  <br/><span className="text-tiger-orange font-bold">예상 비용 ₩20</span>
                </p>
                <button
                  onClick={generateSummary}
                  disabled={summaryBusy}
                  className="w-full px-4 py-3 bg-tiger-orange text-white rounded-lg font-bold hover:bg-orange-600 disabled:opacity-50"
                >
                  🚀 AI가 자료 정리하기
                </button>
              </>
            )}

            {summaryBusy && (
              <div className="p-3 bg-white rounded-lg text-xs text-tiger-orange text-center">
                ⏳ AI가 자료를 읽고 있어요... (10~30초)
              </div>
            )}

            {referencesSummary && (
              <div className="space-y-3">
                <div className="bg-white rounded-lg p-3">
                  <div className="text-xs font-bold text-ink-900 mb-2">📌 핵심 5가지</div>
                  <ol className="text-xs text-gray-700 space-y-1.5 list-decimal list-inside">
                    {referencesSummary.keyPoints.map((k, i) => (
                      <li key={i}>{k}</li>
                    ))}
                  </ol>
                </div>

                <div className="bg-white rounded-lg p-3">
                  <div className="text-xs font-bold text-ink-900 mb-2">✅ 자료가 다룬 주제 ({referencesSummary.coveredTopics.length})</div>
                  <div className="flex flex-wrap gap-1">
                    {referencesSummary.coveredTopics.map((t, i) => (
                      <span key={i} className="text-[10px] bg-green-50 text-green-800 px-2 py-0.5 rounded border border-green-200">{t}</span>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-lg p-3">
                  <div className="text-xs font-bold text-ink-900 mb-2">❓ 인터뷰에서 물어볼 부분 ({referencesSummary.gaps.length})</div>
                  <ul className="text-xs text-gray-700 space-y-1 list-disc list-inside">
                    {referencesSummary.gaps.map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ul>
                </div>

                <div className="text-[10px] text-gray-500 text-center">
                  {new Date(referencesSummary.generatedAt).toLocaleString("ko-KR")} · {referencesSummary.basedOnChunkCount} chunks 기반
                </div>
              </div>
            )}
          </div>
        )}

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
              {currentAnswer === "" && currentQ.placeholder && (
                <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-orange-50 border border-tiger-orange/30 rounded-lg text-xs">
                  <span className="text-tiger-orange font-bold">💡 TIP</span>
                  <span className="text-ink-900">아래 회색 예시가 마음에 들면 <strong className="px-1.5 py-0.5 bg-white border border-tiger-orange/40 rounded font-mono text-tiger-orange">Enter ↵</strong> 한 번 → 그대로 입력됩니다</span>
                </div>
              )}
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
