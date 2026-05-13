"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAutoSave } from "@/lib/auto-save";

interface ReferenceItem {
  id: string;
  filename: string;
  sourceType: string;
  chunkCount: number;
  totalChars: number;
}

export interface ReferencesSummaryView {
  keyPoints: string[];
  coveredTopics: string[];
  gaps: string[];
  generatedAt: number;
  basedOnChunkCount: number;
}

interface AnalyzeStepProps {
  projectId: string;
  referencesSummary: ReferencesSummaryView | null;
  onSummaryChange: (s: ReferencesSummaryView | null) => void;
  onBalanceChange: (b: number) => void;
  onError: (msg: string | null) => void;
  /** Called when user clicks "다음 단계 →" */
  onAdvance: () => void;
  /** v3 Phase 1.2: 부모에 자동 저장 상태 보고 (indicator UI용) */
  onAutoSaveState?: (s: { isSyncing: boolean; lastSyncedAt: number | null; error: Error | null }) => void;
  /** 초기 draft (localStorage 복원 시 부모가 주입) */
  initialDraft?: { refUrlInput?: string; refTextInput?: string; refYoutubeInput?: string };
}

export function AnalyzeStep({
  projectId,
  referencesSummary,
  onSummaryChange,
  onBalanceChange,
  onError,
  onAdvance,
  onAutoSaveState,
  initialDraft,
}: AnalyzeStepProps) {
  const [references, setReferences] = useState<ReferenceItem[]>([]);
  const [refUploadBusy, setRefUploadBusy] = useState(false);
  const [refUploadMode, setRefUploadMode] = useState<"none" | "url" | "text" | "youtube">("none");
  const [refUrlInput, setRefUrlInput] = useState(initialDraft?.refUrlInput ?? "");
  const [refTextInput, setRefTextInput] = useState(initialDraft?.refTextInput ?? "");
  const [refYoutubeInput, setRefYoutubeInput] = useState(initialDraft?.refYoutubeInput ?? "");
  const [summaryBusy, setSummaryBusy] = useState(false);

  // v3 Phase 1.2 — draft 텍스트 입력 자동 저장 (DB는 referencesSummary만 sync, draft는 localStorage 전용)
  const autoSaveData = useMemo(
    () => ({
      analyzeDraft: {
        refUrlInput,
        refTextInput,
        refYoutubeInput,
      },
      // canonical → DB sync
      referencesSummary,
    }),
    [refUrlInput, refTextInput, refYoutubeInput, referencesSummary],
  );

  const autoSave = useAutoSave({
    key: `tbm-autosave-project-${projectId}-analyze`,
    data: autoSaveData,
    onSync: async d => {
      // referencesSummary 변경 시에만 DB sync. draft는 localStorage 전용.
      const projRes = await fetch(`/api/projects/${projectId}`);
      if (!projRes.ok) throw new Error(`프로젝트 로드 실패 (${projRes.status})`);
      const project = await projRes.json();
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            ...project,
            referencesSummary: d.referencesSummary,
          },
        }),
      });
      if (!res.ok) throw new Error(`자동 저장 실패 (${res.status})`);
    },
  });

  const lastReportedRef = useRef<string>("");
  useEffect(() => {
    if (!onAutoSaveState) return;
    const sig = `${autoSave.isSyncing}|${autoSave.lastSyncedAt}|${autoSave.error?.message ?? ""}`;
    if (sig === lastReportedRef.current) return;
    lastReportedRef.current = sig;
    onAutoSaveState({ isSyncing: autoSave.isSyncing, lastSyncedAt: autoSave.lastSyncedAt, error: autoSave.error });
  }, [autoSave.isSyncing, autoSave.lastSyncedAt, autoSave.error, onAutoSaveState]);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/reference/list?projectId=${projectId}`)
      .then(r => (r.ok ? r.json() : { references: [] }))
      .then(d => setReferences(d.references || []))
      .catch(() => {});
  }, [projectId]);

  const uploadFileReference = async (file: File) => {
    if (!projectId) return;
    setRefUploadBusy(true);
    onError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("projectId", projectId);
      const res = await fetch("/api/reference/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `업로드 실패 (${res.status})`);
      setReferences(prev => [
        {
          id: data.id,
          filename: data.filename,
          sourceType: data.sourceType,
          chunkCount: data.chunkCount,
          totalChars: data.totalChars,
        },
        ...prev,
      ]);
      setRefUploadMode("none");
    } catch (e: any) {
      onError(e.message);
    } finally {
      setRefUploadBusy(false);
    }
  };

  const uploadYoutubeReference = async () => {
    if (!projectId || !refYoutubeInput.trim()) return;
    setRefUploadBusy(true);
    onError(null);
    try {
      const res = await fetch("/api/reference/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, type: "youtube", url: refYoutubeInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `업로드 실패 (${res.status})`);
      setReferences(prev => [data, ...prev]);
      setRefYoutubeInput("");
      setRefUploadMode("none");
    } catch (e: any) {
      onError(e.message);
    } finally {
      setRefUploadBusy(false);
    }
  };

  const uploadUrlReference = async () => {
    if (!projectId || !refUrlInput.trim()) return;
    setRefUploadBusy(true);
    onError(null);
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
      onError(e.message);
    } finally {
      setRefUploadBusy(false);
    }
  };

  const uploadTextReference = async () => {
    if (!projectId || refTextInput.trim().length < 50) return;
    setRefUploadBusy(true);
    onError(null);
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
      onError(e.message);
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
      onError(e.message);
    }
  };

  const onChunkDeleted = (refId: string, newCount: number) => {
    setReferences(prev => prev.map(r => (r.id === refId ? { ...r, chunkCount: newCount } : r)));
  };

  const generateSummary = async () => {
    if (!projectId || references.length === 0) return;
    setSummaryBusy(true);
    onError(null);
    try {
      const res = await fetch("/api/generate/reference-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `요약 실패 (${res.status})`);
      onSummaryChange(data.summary);
      if (typeof data.newBalance === "number") onBalanceChange(data.newBalance);
    } catch (e: any) {
      onError(e.message);
    } finally {
      setSummaryBusy(false);
    }
  };

  const clearSummary = async () => {
    if (!confirm("요약을 지우고 다시 만들까요?")) return;
    onSummaryChange(null);
    await generateSummary();
  };

  // 자료 0개여도 다음 단계로 갈 수 있음 (인터뷰만 진행 가능). 단 자료가 있으면 요약 완료가 권장.
  const canAdvance = references.length === 0 || !!referencesSummary;

  return (
    <section className="space-y-6">
      <div data-hide-in-micro="header">
        <h2 className="text-lg font-bold text-ink-900">1단계 · 자료 분석</h2>
        <p className="text-xs text-gray-500 mt-1">
          참고 자료를 업로드하고 AI가 핵심을 정리하게 하세요. 자료 없이 인터뷰만으로 진행해도 OK.
        </p>
      </div>

      {/* 레퍼런스 업로드 */}
      <div data-micro-step="0" data-micro-label="자료 업로드" className="p-5 bg-orange-50/50 border border-tiger-orange/30 rounded-xl">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-ink-900">📚 참고 자료 ({references.length})</h3>
          {refUploadMode === "none" && (
            <div className="flex flex-wrap gap-1 justify-end">
              <label className="text-xs px-2 py-1 bg-tiger-orange text-white rounded font-bold cursor-pointer hover:bg-orange-600">
                📄 PDF
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && uploadFileReference(e.target.files[0])}
                  disabled={refUploadBusy}
                />
              </label>
              <button
                onClick={() => setRefUploadMode("url")}
                disabled={refUploadBusy}
                className="text-xs px-2 py-1 border border-tiger-orange text-tiger-orange rounded font-bold hover:bg-orange-100"
              >
                🌐 URL
              </button>
              <button
                onClick={() => setRefUploadMode("text")}
                disabled={refUploadBusy}
                className="text-xs px-2 py-1 border border-tiger-orange text-tiger-orange rounded font-bold hover:bg-orange-100"
              >
                📝 텍스트
              </button>
              <label className="text-xs px-2 py-1 border border-tiger-orange text-tiger-orange rounded font-bold cursor-pointer hover:bg-orange-100">
                📘 DOCX
                <input
                  type="file"
                  accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && uploadFileReference(e.target.files[0])}
                  disabled={refUploadBusy}
                />
              </label>
              <button
                onClick={() => setRefUploadMode("youtube")}
                disabled={refUploadBusy}
                className="text-xs px-2 py-1 border border-tiger-orange text-tiger-orange rounded font-bold hover:bg-orange-100"
              >
                🎬 YouTube
              </button>
              <label className="text-xs px-2 py-1 border border-tiger-orange text-tiger-orange rounded font-bold cursor-pointer hover:bg-orange-100">
                🖼️ 이미지
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && uploadFileReference(e.target.files[0])}
                  disabled={refUploadBusy}
                />
              </label>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-600 mb-3">
          PDF·DOCX·블로그 URL·YouTube 자막·이미지(OCR ₩200)·메모 — 모두 AI가 읽고 인터뷰·목차·본문에 활용합니다. (PDF/DOCX 10MB, 이미지 8MB, 50~50만자 텍스트)
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
            <button
              onClick={uploadUrlReference}
              disabled={refUploadBusy || !refUrlInput.trim()}
              className="text-xs px-3 py-2 bg-tiger-orange text-white rounded font-bold hover:bg-orange-600 disabled:opacity-50"
            >
              가져오기
            </button>
            <button
              onClick={() => {
                setRefUploadMode("none");
                setRefUrlInput("");
              }}
              className="text-xs px-2 py-2 text-gray-500 hover:text-ink-900"
            >
              취소
            </button>
          </div>
        )}

        {refUploadMode === "youtube" && (
          <div className="flex gap-2 mb-3">
            <input
              type="url"
              value={refYoutubeInput}
              onChange={e => setRefYoutubeInput(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              className="flex-1 text-xs px-3 py-2 border border-gray-300 rounded focus:border-tiger-orange focus:outline-none"
            />
            <button
              onClick={uploadYoutubeReference}
              disabled={refUploadBusy || !refYoutubeInput.trim()}
              className="text-xs px-3 py-2 bg-tiger-orange text-white rounded font-bold hover:bg-orange-600 disabled:opacity-50"
            >
              자막 가져오기
            </button>
            <button
              onClick={() => {
                setRefUploadMode("none");
                setRefYoutubeInput("");
              }}
              className="text-xs px-2 py-2 text-gray-500 hover:text-ink-900"
            >
              취소
            </button>
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
              <button
                onClick={uploadTextReference}
                disabled={refUploadBusy || refTextInput.trim().length < 50}
                className="text-xs px-3 py-2 bg-tiger-orange text-white rounded font-bold hover:bg-orange-600 disabled:opacity-50"
              >
                저장
              </button>
              <button
                onClick={() => {
                  setRefUploadMode("none");
                  setRefTextInput("");
                }}
                className="text-xs px-2 py-2 text-gray-500 hover:text-ink-900"
              >
                취소
              </button>
              <span className="text-[10px] text-gray-500 ml-auto">{refTextInput.length}자</span>
            </div>
          </div>
        )}

        {references.length > 0 && (
          <div className="space-y-1.5">
            {references.map(r => (
              <ReferenceRow
                key={r.id}
                reference={r}
                onDelete={() => deleteReference(r.id)}
                onChunkDeleted={newCount => onChunkDeleted(r.id, newCount)}
                setError={onError}
              />
            ))}
          </div>
        )}

        {references.length === 0 && refUploadMode === "none" && !refUploadBusy && (
          <div className="text-center py-4 text-xs text-gray-400">
            참고 자료 없이 인터뷰만 진행해도 OK. 자료 있으면 더 정확한 책이 됩니다.
          </div>
        )}
      </div>

      {/* AI 자료 분석 */}
      {references.length > 0 && (
        <div data-micro-step="1" data-micro-label="AI 요약 확인" className="p-5 bg-yellow-50/50 border border-tiger-orange/40 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-ink-900">🤖 AI 자료 분석</h3>
            {referencesSummary && (
              <button onClick={clearSummary} className="text-[10px] text-gray-400 hover:text-red-600">
                다시 분석
              </button>
            )}
          </div>

          {!referencesSummary && !summaryBusy && (
            <>
              <p className="text-xs text-gray-600 mb-3">
                AI가 모든 자료를 읽고 핵심 5가지 + 빠진 부분을 정리합니다. 그 후 인터뷰는 빈 부분만 짧게 진행됩니다.
                <br />
                <span className="text-tiger-orange font-bold">예상 비용 ₩200</span>
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
                <div className="text-xs font-bold text-ink-900 mb-2">
                  ✅ 자료가 다룬 주제 ({referencesSummary.coveredTopics.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {referencesSummary.coveredTopics.map((t, i) => (
                    <span
                      key={i}
                      className="text-[10px] bg-green-50 text-green-800 px-2 py-0.5 rounded border border-green-200"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-lg p-3">
                <div className="text-xs font-bold text-ink-900 mb-2">
                  ❓ 인터뷰에서 물어볼 부분 ({referencesSummary.gaps.length})
                </div>
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

      <div className="flex justify-end">
        <button
          onClick={onAdvance}
          disabled={!canAdvance}
          className="px-6 py-2.5 bg-tiger-orange text-white rounded-xl font-bold shadow-glow-orange-sm hover:bg-orange-600 transition disabled:opacity-50"
          title={
            references.length > 0 && !referencesSummary
              ? "AI 자료 분석을 먼저 완료하거나, 자료를 모두 지운 후 진행하세요"
              : undefined
          }
        >
          다음 단계 →
        </button>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────
// ReferenceRow — chunk 단위 시각화 + 개별 삭제
// ─────────────────────────────────────────────────────────

function ReferenceRow({
  reference,
  onDelete,
  onChunkDeleted,
  setError,
}: {
  reference: ReferenceItem;
  onDelete: () => void;
  onChunkDeleted: (newChunkCount: number) => void;
  setError: (msg: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [chunks, setChunks] = useState<{ id: string; idx: number; content: string }[] | null>(null);
  const [chunksBusy, setChunksBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const emoji =
    reference.sourceType === "pdf"
      ? "📄"
      : reference.sourceType === "url"
      ? "🌐"
      : reference.sourceType === "docx"
      ? "📘"
      : reference.sourceType === "youtube"
      ? "🎬"
      : reference.sourceType === "image"
      ? "🖼️"
      : "📝";

  const toggle = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (chunks === null) {
      setChunksBusy(true);
      try {
        const res = await fetch(`/api/reference/${reference.id}/chunks`);
        if (!res.ok) throw new Error("chunk 로드 실패");
        const data = await res.json();
        setChunks(data.chunks ?? []);
      } catch (e: any) {
        setError(e.message);
        setOpen(false);
      } finally {
        setChunksBusy(false);
      }
    }
  };

  const deleteChunk = async (chunkId: string) => {
    if (!confirm("이 chunk만 삭제할까요? (참고 자료 본체는 유지됩니다.)")) return;
    setDeletingId(chunkId);
    try {
      const res = await fetch(`/api/reference/chunk/${chunkId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("chunk 삭제 실패");
      const data = await res.json();
      setChunks(prev => (prev ? prev.filter(c => c.id !== chunkId) : prev));
      if (typeof data.newChunkCount === "number") onChunkDeleted(data.newChunkCount);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-white rounded border border-gray-200 text-xs">
      <div className="flex items-center gap-2 p-2">
        <button
          type="button"
          onClick={toggle}
          className="text-gray-400 hover:text-tiger-orange transition w-4 shrink-0"
          title={open ? "접기" : "chunks 보기"}
        >
          {open ? "▼" : "▶"}
        </button>
        <span className="text-base">{emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-ink-900 truncate">{reference.filename}</div>
          <div className="text-[10px] text-gray-500">
            {reference.totalChars.toLocaleString()}자 · {reference.chunkCount} chunks
          </div>
        </div>
        <button
          onClick={toggle}
          className="text-[10px] text-gray-500 hover:text-tiger-orange whitespace-nowrap"
          title="AI가 자료를 어떻게 chunk로 나눴는지 보기"
        >
          👁️ chunks
        </button>
        <button onClick={onDelete} className="text-[10px] text-gray-400 hover:text-red-600">
          삭제
        </button>
      </div>

      {open && (
        <div className="border-t border-gray-100 px-2 py-2 bg-[#fafafa]">
          {chunksBusy && <div className="text-[11px] text-gray-500 text-center py-2">⏳ chunks 불러오는 중...</div>}
          {!chunksBusy && chunks !== null && chunks.length === 0 && (
            <div className="text-[11px] text-gray-500 text-center py-2">
              남은 chunk가 없습니다. (자료 본체를 삭제하세요)
            </div>
          )}
          {!chunksBusy && chunks !== null && chunks.length > 0 && (
            <>
              <p className="text-[10px] text-gray-500 mb-2 leading-relaxed">
                AI가 자료를 {chunks.length}개 chunk로 나눠서 검색·인용에 사용합니다. 잘못 분리됐거나 불필요한 chunk는
                개별 삭제 가능.
              </p>
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {chunks.map(c => (
                  <div key={c.id} className="flex items-start gap-2 p-2 bg-white rounded border border-gray-200">
                    <span className="text-[10px] font-mono text-gray-400 shrink-0 mt-0.5 w-8">#{c.idx}</span>
                    <div className="flex-1 min-w-0 text-[11px] text-ink-900 break-words leading-relaxed line-clamp-4">
                      {c.content}
                    </div>
                    <button
                      onClick={() => deleteChunk(c.id)}
                      disabled={deletingId === c.id}
                      className="text-[10px] text-gray-400 hover:text-red-600 shrink-0 disabled:opacity-50"
                      title="이 chunk만 삭제 (자료 본체는 유지)"
                    >
                      {deletingId === c.id ? "…" : "✗"}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
