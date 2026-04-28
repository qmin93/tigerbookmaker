"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/Header";

type BatchState =
  | { status: "idle" }
  | { status: "running"; currentIdx: number; total: number; pendingIdxs: number[]; abortController: AbortController; cumulativeCostKRW: number; startedAt: number }
  | { status: "failed"; failedIdx: number; errorMessage: string; cumulativeCostKRW: number; remainingIdxs: number[] }
  | { status: "stopped"; completedCount: number };

interface Chapter {
  id?: string;
  title: string;
  subtitle?: string;
  content: string;
  images: { placeholder: string; dataUrl?: string; alt?: string; caption?: string }[];
}

interface Project {
  id: string;
  topic: string;
  audience: string;
  type: string;
  targetPages: number;
  tier?: "basic" | "pro" | "premium";
  chapters: Chapter[];
}

interface UsageStat {
  inputTokens: number;
  outputTokens: number;
  thoughtsTokens?: number;
  costUSD: number;
  costKRW: number;
  durationMs: number;
}

const MODELS = [
  { id: "gemini-flash-latest", label: "Flash · 책 1권 ~₩200 (권장, 안정)" },
  { id: "gemini-2.5-flash", label: "Flash 2.5 · 503 빈발 (현재 비추)" },
  { id: "gemini-2.5-pro", label: "Pro · 결제 활성화 필요" },
  { id: "claude-sonnet-4-6", label: "Sonnet · API 키 필요 (현재 비활성)" },
] as const;

// 본문에서 [IMAGE: ...] placeholder 추출
function extractImagePlaceholders(content: string): string[] {
  const m = content.match(/\[IMAGE:[^\]]+\]/g);
  return m ?? [];
}

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const projectId = params.get("id");

  const [project, setProject] = useState<Project | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<typeof MODELS[number]["id"]>("gemini-flash-latest");
  const [balance, setBalance] = useState<number | null>(null);
  const [lastUsage, setLastUsage] = useState<UsageStat | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [editingTitle, setEditingTitle] = useState<number | null>(null);
  const [streamingText, setStreamingText] = useState<string>("");
  const [streamingChapterIdx, setStreamingChapterIdx] = useState<number | null>(null);
  const [batch, setBatch] = useState<BatchState>({ status: "idle" });
  const [editingContent, setEditingContent] = useState<string | null>(null);
  const [imageGenBusy, setImageGenBusy] = useState<string>("");
  const [kmongModalOpen, setKmongModalOpen] = useState(false);
  const [kmongBusy, setKmongBusy] = useState<string>("");
  const [kmongProgress, setKmongProgress] = useState<{
    done: number;
    total: number;
    items: Record<string, "pending" | "done" | "failed">;
  } | null>(null);
  const [titleDraft, setTitleDraft] = useState({ title: "", subtitle: "" });

  useEffect(() => {
    if (!projectId) {
      router.push("/projects");
      return;
    }
    Promise.all([
      fetch(`/api/projects/${projectId}`).then(async r => {
        if (r.status === 401) { setUnauthorized(true); throw new Error("UNAUTHORIZED"); }
        if (!r.ok) throw new Error(`프로젝트 로드 실패 (${r.status})`);
        return r.json();
      }),
      fetch("/api/me").then(r => r.ok ? r.json() : null),
    ])
      .then(([p, me]) => {
        setProject(p);
        if (me) setBalance(me.balance_krw);
      })
      .catch(e => setError(e.message));
  }, [projectId, router]);

  if (unauthorized) {
    return (
      <Center>
        <p className="mb-4 text-gray-600">로그인이 필요합니다.</p>
        <Link href={`/login?redirect=/write?id=${projectId}`} className="px-6 py-3 bg-ink-900 text-white font-bold rounded-lg">로그인</Link>
      </Center>
    );
  }
  if (error) return <Center><p className="text-red-600">{error}</p></Center>;
  if (!project) return <Center>로딩 중...</Center>;

  // ─── DB 동기화: project.data 통째로 PUT ───
  const saveProject = async (next: Project) => {
    const data = {
      topic: next.topic, audience: next.audience, type: next.type, targetPages: next.targetPages,
      chapters: next.chapters,
    };
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });
    if (!res.ok) throw new Error("저장 실패");
    setProject(next);
  };

  const callApi = async (path: string, body: any, label: string) => {
    setLoading(label);
    setError(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // model은 보내지 않음 → 서버가 project.tier 기반 chain 자동 선택
        body: JSON.stringify({ projectId, ...body }),
      });
      const data = await res.json();
      if (res.status === 402) {
        if (confirm(`잔액 부족: ${data.shortfall.toLocaleString()}원 부족합니다. 충전 페이지로 이동할까요?`)) {
          router.push("/billing");
        }
        throw new Error("잔액 부족");
      }
      if (!res.ok) throw new Error(data.message || `요청 실패 (${res.status})`);
      if (data.newBalance !== undefined) setBalance(data.newBalance);
      if (data.usage) setLastUsage({ ...data.usage });
      return data;
    } finally {
      setLoading("");
    }
  };

  // chapter 본문 전용 — NDJSON streaming reader
  const callApiStreaming = async (
    chapterIdx: number,
    label: string,
    signal?: AbortSignal,
  ): Promise<any> => {
    setLoading(label);
    setError(null);
    setStreamingChapterIdx(chapterIdx);
    setStreamingText("");
    try {
      const res = await fetch("/api/generate/chapter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // model 미지정 → 서버가 project.tier 기반 chain 자동 선택
        body: JSON.stringify({ projectId, chapterIdx }),
        signal,
      });
      // 잔액 부족 등 일반 JSON 응답
      if (res.status === 402) {
        const data = await res.json().catch(() => ({}));
        if (confirm(`잔액 부족: ${data.shortfall?.toLocaleString()}원 부족. 충전 페이지로 이동할까요?`)) {
          router.push("/billing");
        }
        throw new Error("잔액 부족");
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `요청 실패 (${res.status})`);
      }
      if (!res.body) throw new Error("응답 body 없음");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";
      let doneMsg: any = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let msg: any;
          try { msg = JSON.parse(trimmed); } catch { continue; }
          if (msg.type === "chunk") {
            accumulated += msg.text;
            setStreamingText(accumulated);
          } else if (msg.type === "done") {
            doneMsg = msg;
          } else if (msg.type === "error") {
            throw new Error(msg.message || "AI 응답 실패");
          }
        }
      }

      if (!doneMsg) throw new Error("Stream이 done 없이 종료됨");
      if (doneMsg.newBalance !== undefined) setBalance(doneMsg.newBalance);
      if (doneMsg.usage) setLastUsage({ ...doneMsg.usage });
      return doneMsg;
    } finally {
      setLoading("");
      setStreamingChapterIdx(null);
      setStreamingText("");
    }
  };

  // 미작성 챕터 수 × 챕터당 평균 (₩20 본문 + ₩2 요약) × 안전마진 30%
  const estimateBatchKRW = (chaptersToWriteCount: number) =>
    Math.ceil(chaptersToWriteCount * 22 * 1.3);

  // 잔액이 충분한지 사전 체크 (true면 OK, false면 alert + false)
  const checkBalanceForBatch = (chaptersToWriteCount: number): boolean => {
    if (balance == null) return true;
    const need = estimateBatchKRW(chaptersToWriteCount);
    if (balance >= need) return true;
    if (confirm(`잔액 부족 — ₩${need.toLocaleString()} 필요, 현재 ₩${balance.toLocaleString()}. 충전 페이지로 이동할까요?`)) {
      router.push("/billing");
    }
    return false;
  };

  const generateToc = async () => {
    try {
      await callApi("/api/generate/toc", {}, "목차 생성 중...");
      const fresh = await fetch(`/api/projects/${projectId}`).then(r => r.json());
      setProject(fresh);
    } catch (e: any) { if (e.message !== "잔액 부족") setError(e.message); }
  };

  const generateChapter = async (idx: number) => {
    setActiveIdx(idx);
    try {
      await callApiStreaming(idx, `${idx + 1}장 집필 중...`);
      const fresh = await fetch(`/api/projects/${projectId}`).then(r => r.json());
      setProject(fresh);
    } catch (e: any) { if (e.message !== "잔액 부족") setError(e.message); }
  };

  const startBatch = async (fromIdx: number = 0) => {
    if (!project) return;
    const pendingIdxs: number[] = [];
    for (let i = fromIdx; i < project.chapters.length; i++) {
      if (!project.chapters[i].content) pendingIdxs.push(i);
    }
    if (pendingIdxs.length === 0) {
      setError("이미 모든 챕터가 작성되었습니다.");
      return;
    }
    if (!checkBalanceForBatch(pendingIdxs.length)) return;
    if (!confirm(`${pendingIdxs.length}장 일괄 집필 (예상 ₩${estimateBatchKRW(pendingIdxs.length).toLocaleString()} 이내). 시작할까요?`)) return;

    const controller = new AbortController();
    let cumulative = 0;
    setBatch({
      status: "running",
      currentIdx: pendingIdxs[0],
      total: pendingIdxs.length,
      pendingIdxs,
      abortController: controller,
      cumulativeCostKRW: 0,
      startedAt: Date.now(),
    });

    for (let i = 0; i < pendingIdxs.length; i++) {
      const idx = pendingIdxs[i];
      if (controller.signal.aborted) break;
      setBatch(s => s.status === "running" ? { ...s, currentIdx: idx } : s);
      setActiveIdx(idx);

      let attempts = 0;
      let lastErr: any = null;
      while (attempts <= 1) {
        try {
          const data = await callApiStreaming(idx, `일괄: ${i + 1}/${pendingIdxs.length}장`, controller.signal);
          const stepCost = (data?.usage?.costKRW ?? 0) + (data?.summaryCostKRW ?? 0);
          cumulative += stepCost;
          setBatch(s => s.status === "running" ? { ...s, cumulativeCostKRW: cumulative } : s);
          lastErr = null;
          break;
        } catch (e: any) {
          lastErr = e;
          if (e?.name === "AbortError" || controller.signal.aborted) {
            lastErr = null;
            break;
          }
          if (e?.message === "잔액 부족") break;
          attempts++;
          if (attempts <= 1) await new Promise(r => setTimeout(r, 2000));
        }
      }

      if (controller.signal.aborted) {
        setBatch({ status: "stopped", completedCount: i });
        const fresh = await fetch(`/api/projects/${projectId}`).then(r => r.json());
        setProject(fresh);
        return;
      }
      if (lastErr) {
        setBatch({
          status: "failed",
          failedIdx: idx,
          errorMessage: lastErr.message ?? String(lastErr),
          cumulativeCostKRW: cumulative,
          remainingIdxs: pendingIdxs.slice(i),
        });
        const fresh = await fetch(`/api/projects/${projectId}`).then(r => r.json());
        setProject(fresh);
        return;
      }
    }

    setBatch({ status: "idle" });
    const fresh = await fetch(`/api/projects/${projectId}`).then(r => r.json());
    setProject(fresh);
  };

  const stopBatch = () => {
    if (batch.status !== "running") return;
    batch.abortController.abort();
  };

  const resumeBatch = () => {
    if (batch.status !== "failed") return;
    startBatch(batch.failedIdx);
  };

  // ─── 목차 편집 ───
  const moveChapter = async (from: number, dir: -1 | 1) => {
    const to = from + dir;
    if (to < 0 || to >= project.chapters.length) return;
    const chapters = [...project.chapters];
    [chapters[from], chapters[to]] = [chapters[to], chapters[from]];
    setActiveIdx(to);
    await saveProject({ ...project, chapters });
  };
  const deleteChapter = async (idx: number) => {
    if (!confirm(`"${project.chapters[idx].title}" 챕터를 삭제할까요? (본문 포함)`)) return;
    const chapters = project.chapters.filter((_, i) => i !== idx);
    setActiveIdx(Math.max(0, Math.min(activeIdx, chapters.length - 1)));
    await saveProject({ ...project, chapters });
  };
  const addChapter = async () => {
    const title = prompt("새 챕터 제목");
    if (!title) return;
    const subtitle = prompt("부제 (선택)") ?? "";
    const chapters = [...project.chapters, { title, subtitle, content: "", images: [] }];
    setActiveIdx(chapters.length - 1);
    await saveProject({ ...project, chapters });
  };
  const startEditTitle = (idx: number) => {
    const c = project.chapters[idx];
    setTitleDraft({ title: c.title, subtitle: c.subtitle ?? "" });
    setEditingTitle(idx);
  };
  const saveTitle = async () => {
    if (editingTitle === null) return;
    const chapters = [...project.chapters];
    chapters[editingTitle] = { ...chapters[editingTitle], title: titleDraft.title, subtitle: titleDraft.subtitle };
    setEditingTitle(null);
    await saveProject({ ...project, chapters });
  };

  // ─── 이미지 업로드 (data URL로 저장) ───
  const uploadImage = async (chapterIdx: number, placeholder: string, file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      setError("이미지 크기는 2MB 이하만 가능합니다.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const chapters = [...project.chapters];
      const ch = { ...chapters[chapterIdx] };
      const images = [...(ch.images ?? [])];
      const existing = images.findIndex(im => im.placeholder === placeholder);
      const caption = placeholder.replace(/^\[IMAGE:\s*/, "").replace(/\]$/, "");
      if (existing >= 0) images[existing] = { placeholder, dataUrl, caption };
      else images.push({ placeholder, dataUrl, caption });
      ch.images = images;
      chapters[chapterIdx] = ch;
      await saveProject({ ...project, chapters });
    };
    reader.readAsDataURL(file);
  };
  const removeImage = async (chapterIdx: number, placeholder: string) => {
    const chapters = [...project.chapters];
    const ch = { ...chapters[chapterIdx] };
    ch.images = (ch.images ?? []).filter(im => im.placeholder !== placeholder);
    chapters[chapterIdx] = ch;
    await saveProject({ ...project, chapters });
  };

  // 한 번 클릭으로 6 이미지 + 1 카피를 순차 생성 (각 ~5초, 총 ~35-50초).
  // 단일 요청이 30초를 절대 못 넘기게 분리 — Vercel 60s 한도와 무관.
  const generateFullKmongPackage = async () => {
    if (!project) return;
    const allDone = project.chapters.length > 0 && project.chapters.every(c => c.content);
    if (!allDone) {
      setError("모든 챕터 본문 작성이 끝나야 크몽 패키지를 생성할 수 있습니다.");
      return;
    }
    if (!confirm("크몽 패키지 — 이미지 6장 + 카피 5종 (~₩30, 약 40초). 진행할까요?")) return;

    setError(null);
    setKmongModalOpen(true);

    const tasks = ["cover", "thumb", "toc", "spec", "audience", "preview", "copy"] as const;
    const initialItems: Record<string, "pending" | "done" | "failed"> = {};
    tasks.forEach(t => initialItems[t] = "pending");
    setKmongProgress({ done: 0, total: tasks.length, items: initialItems });

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      setKmongBusy(`${task} 생성 중... (${i + 1}/${tasks.length})`);
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 35_000);
      try {
        const body = task === "copy"
          ? { projectId }
          : { projectId, regenerateOnly: [task] };
        const res = await fetch("/api/generate/kmong-package", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
        const data = await res.json();
        if (res.status === 402) {
          if (confirm("잔액 부족. 충전 페이지로 이동할까요?")) router.push("/billing");
          setKmongProgress(p => p ? { ...p, items: { ...p.items, [task]: "failed" } } : p);
          break;
        }
        if (!res.ok) throw new Error(data.message || `${task} 실패 (${res.status})`);
        if (data.newBalance != null) setBalance(data.newBalance);
        // 매 단계 project 갱신해서 다음 호출의 base로 사용
        const fresh = await fetch(`/api/projects/${projectId}`).then(r => r.json());
        setProject(fresh);
        setKmongProgress(p => p ? { ...p, done: p.done + 1, items: { ...p.items, [task]: "done" } } : p);
      } catch (e: any) {
        const errMsg = e.name === "AbortError" ? `${task} 시간 초과` : e.message;
        console.error(`[kmong-${task}]`, errMsg);
        setKmongProgress(p => p ? { ...p, done: p.done + 1, items: { ...p.items, [task]: "failed" } } : p);
      } finally {
        clearTimeout(tid);
      }
    }

    setKmongBusy("");
  };

  const generateKmongPackage = async (regenerateOnly?: string[]) => {
    if (!project) return;
    if (!regenerateOnly) {
      const allDone = project.chapters.length > 0 && project.chapters.every(c => c.content);
      if (!allDone) {
        setError("모든 챕터 본문 작성이 끝나야 크몽 패키지를 생성할 수 있습니다.");
        return;
      }
      if (!confirm("크몽 패키지 생성 — 카피 5종 (~₩30). 이미지 6장은 모달에서 개별 [생성] 클릭 (각 ~5초). 진행할까요?")) return;
    }
    setKmongBusy(regenerateOnly ? "이미지 생성 중..." : "카피 생성 중 (약 10초)...");
    setError(null);
    // 90초 client timeout — backend가 hang되어도 무한 대기 X
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 90_000);
    try {
      const res = await fetch("/api/generate/kmong-package", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, regenerateOnly }),
        signal: ctrl.signal,
      });
      const data = await res.json();
      if (res.status === 402) {
        if (confirm(`잔액 부족. 충전 페이지로 이동할까요?`)) router.push("/billing");
        throw new Error("잔액 부족");
      }
      if (!res.ok) throw new Error(data.message || `요청 실패 (${res.status})`);
      if (data.newBalance != null) setBalance(data.newBalance);
      const fresh = await fetch(`/api/projects/${projectId}`).then(r => r.json());
      setProject(fresh);
      setKmongModalOpen(true);
    } catch (e: any) {
      if (e.name === "AbortError") setError("요청 시간 초과 (90초). 새로고침 후 다시 시도해주세요.");
      else if (e.message !== "잔액 부족") setError(e.message);
    } finally {
      clearTimeout(tid);
      setKmongBusy("");
    }
  };

  const downloadKmongPackage = async () => {
    if (!(project as any)?.kmongPackage) return;
    const { buildKmongZip, downloadKmongZip } = await import("@/lib/kmong-package-zip");
    const blob = await buildKmongZip((project as any).kmongPackage, project.topic);
    downloadKmongZip(blob, project.topic);
  };

  const generateChapterImage = async (chapterIdx: number, placeholder: string) => {
    setImageGenBusy(placeholder);
    setError(null);
    try {
      const res = await fetch("/api/generate/chapter-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, chapterIdx, placeholder }),
      });
      const data = await res.json();
      if (res.status === 402) {
        if (confirm(`잔액 부족. 충전 페이지로 이동할까요?`)) router.push("/billing");
        throw new Error("잔액 부족");
      }
      if (!res.ok) throw new Error(data.message || `이미지 생성 실패 (${res.status})`);
      if (data.newBalance != null) setBalance(data.newBalance);
      // fresh project로 동기화
      const fresh = await fetch(`/api/projects/${projectId}`).then(r => r.json());
      setProject(fresh);
    } catch (e: any) {
      if (e.message !== "잔액 부족") setError(e.message);
    } finally {
      setImageGenBusy("");
    }
  };

  const active = project.chapters[activeIdx];
  const placeholders = active ? extractImagePlaceholders(active.content) : [];

  return (
    <>
    <Header />
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-32">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div className="min-w-0 flex-1">
          <Link href="/projects" className="text-sm text-gray-500 hover:text-tiger-orange">← 내 책</Link>
          <h1 className="text-lg sm:text-xl font-black mt-1 line-clamp-2 break-keep">{project.topic}</h1>
          <p className="text-xs text-gray-500">
            {project.audience} · {project.type} · {project.targetPages}쪽
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/export?id=${projectId}`} className="px-4 py-2 bg-ink-900 text-white rounded-lg font-bold text-sm">내보내기 →</Link>
        </div>
      </div>

      {error && (
        <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {project.chapters.length === 0 ? (
        <div className="bg-white p-10 rounded-xl border border-gray-200 text-center">
          <p className="mb-5 text-gray-600">아직 목차가 없습니다. AI가 12개 챕터를 제안합니다.</p>
          <button onClick={generateToc} disabled={!!loading} className="px-6 py-3 bg-tiger-orange text-white rounded-lg font-bold disabled:opacity-50">
            {loading || "목차 생성"}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 lg:gap-6">
          {/* 사이드바 */}
          <aside className="bg-white rounded-xl border border-gray-200 p-3 h-fit">
            {/* 액션 버튼 그룹 — 위에 sticky로 항상 보이게 */}
            <div className="space-y-1 mb-3 pb-3 border-b border-gray-200">
              <button
                onClick={() => startBatch(0)}
                disabled={!!loading || batch.status === "running"}
                className="w-full px-3 py-2.5 bg-tiger-orange text-white rounded-lg text-sm font-bold shadow-glow-orange-sm hover:bg-orange-600 transition disabled:opacity-50 disabled:shadow-none"
              >
                {batch.status === "running"
                  ? `진행 중...${batch.cumulativeCostKRW > 0 ? ` (₩${batch.cumulativeCostKRW.toLocaleString()})` : ""}`
                  : "⚡ 전체 일괄 집필"}
              </button>
              <div className="grid grid-cols-2 gap-1">
                <button onClick={addChapter} disabled={!!loading} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs hover:bg-[#fafafa] hover:border-gray-400 transition">
                  + 챕터 추가
                </button>
                <button onClick={generateToc} disabled={!!loading} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs hover:bg-[#fafafa] hover:border-gray-400 transition">
                  목차 재생성
                </button>
              </div>
              <button
                onClick={generateFullKmongPackage}
                disabled={!!loading || !!kmongBusy || batch.status === "running"}
                className="w-full px-3 py-2 mt-1 border-2 border-tiger-orange text-tiger-orange rounded-lg text-xs font-bold hover:bg-orange-50 transition disabled:opacity-50"
              >
                {kmongBusy || ((project as any).kmongPackage ? "📦 크몽 패키지 (재생성)" : "📦 크몽 패키지 생성")}
              </button>
              {(project as any).kmongPackage && (
                <button
                  onClick={() => setKmongModalOpen(true)}
                  className="w-full px-3 py-1 text-xs text-tiger-orange hover:underline"
                >
                  크몽 패키지 다시 보기
                </button>
              )}
            </div>
            <p className="text-xs font-bold text-gray-500 px-2 py-2">목차 ({project.chapters.length})</p>
            {project.chapters.map((c, i) => (
              <div key={i} className={`group rounded-lg mb-1 transition ${i === activeIdx ? "bg-tiger-orange text-white" : "hover:bg-gray-100"}`}>
                <button onClick={() => {
                  if (editingContent !== null && i !== activeIdx && !confirm("편집 중인 내용이 있습니다. 저장 안 하고 다른 챕터로 이동할까요?")) return;
                  if (i !== activeIdx) setEditingContent(null);
                  setActiveIdx(i);
                }} className="w-full text-left px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{i + 1}.</span>
                    <span className="truncate flex-1">{c.title}</span>
                    {c.content && <span className="text-xs">✓</span>}
                  </div>
                </button>
                <div className={`flex gap-1 px-2 pb-2 text-xs ${i === activeIdx ? "text-white/80" : "text-gray-400 opacity-0 group-hover:opacity-100"}`}>
                  <button onClick={() => moveChapter(i, -1)} disabled={i === 0} className="hover:underline disabled:opacity-30">↑</button>
                  <button onClick={() => moveChapter(i, 1)} disabled={i === project.chapters.length - 1} className="hover:underline disabled:opacity-30">↓</button>
                  <button onClick={() => startEditTitle(i)} className="hover:underline">수정</button>
                  <button onClick={() => deleteChapter(i)} className="hover:underline ml-auto">삭제</button>
                </div>
              </div>
            ))}
          </aside>

          {/* 본문 */}
          <section className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 min-h-[500px]">
            <BatchBanner
              batch={batch}
              onStop={stopBatch}
              onResume={resumeBatch}
              onDismiss={() => setBatch({ status: "idle" })}
            />
            <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-xs text-gray-500">{activeIdx + 1}장 · {active.content ? `${active.content.length.toLocaleString()}자` : "미집필"}</p>
                <h2 className="text-lg sm:text-xl font-black break-keep">{active.title}</h2>
                {active.subtitle && <p className="text-sm text-gray-500 mt-1 break-keep">{active.subtitle}</p>}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {active.content && editingContent === null && (
                  <button
                    onClick={() => setEditingContent(active.content)}
                    disabled={!!loading}
                    className="text-xs px-3 py-1 border border-gray-300 text-ink-900 rounded-lg hover:border-ink-900 transition disabled:opacity-50 whitespace-nowrap"
                  >
                    ✏️ 수정
                  </button>
                )}
                <button onClick={() => generateChapter(activeIdx)} disabled={!!loading || editingContent !== null} className="text-xs px-3 py-1 bg-tiger-orange text-white rounded-lg disabled:opacity-50 whitespace-nowrap">
                  {loading.startsWith(`${activeIdx + 1}`) || loading.includes(`${activeIdx + 1}/`) ? loading : active.content ? "다시 생성" : "집필"}
                </button>
              </div>
            </div>

            {streamingChapterIdx === activeIdx && streamingText ? (
              <div className="rounded-xl border border-tiger-orange/30 bg-orange-50/40 p-5">
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-tiger-orange mb-3">
                  <span className="w-2 h-2 rounded-full bg-tiger-orange animate-pulse" />
                  AI 작성 중... ({streamingText.length.toLocaleString()}자)
                </div>
                <div className="prose max-w-none text-sm whitespace-pre-wrap break-keep text-ink-900">
                  {streamingText}
                  <span className="inline-block w-1.5 h-4 bg-tiger-orange ml-0.5 animate-pulse align-middle" />
                </div>
              </div>
            ) : editingContent !== null ? (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-mono uppercase tracking-wider text-tiger-orange">✏️ 본문 직접 편집</p>
                  <p className="text-xs font-mono text-gray-500">{editingContent.length.toLocaleString()}자</p>
                </div>
                <textarea
                  value={editingContent}
                  onChange={e => setEditingContent(e.target.value)}
                  className="w-full min-h-[500px] p-4 border border-tiger-orange/40 rounded-lg text-sm leading-relaxed font-sans focus:outline-none focus:border-tiger-orange whitespace-pre-wrap break-keep"
                  spellCheck={false}
                />
                <div className="mt-3 flex gap-2 justify-end">
                  <button
                    onClick={() => setEditingContent(null)}
                    className="px-4 py-2 text-sm border border-gray-300 text-ink-900 rounded-lg hover:border-ink-900 transition"
                  >
                    취소
                  </button>
                  <button
                    onClick={async () => {
                      const updated = [...project.chapters];
                      updated[activeIdx] = { ...active, content: editingContent };
                      await saveProject({ ...project, chapters: updated });
                      setEditingContent(null);
                    }}
                    className="px-4 py-2 text-sm bg-tiger-orange text-white font-bold rounded-lg shadow-glow-orange-sm hover:bg-orange-600 transition"
                  >
                    저장
                  </button>
                </div>
              </>
            ) : active.content ? (
              <>
                <div className="prose max-w-none text-sm whitespace-pre-wrap break-keep">
                  {active.content}
                </div>

                {/* 이미지 placeholder 업로드 */}
                {placeholders.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-gray-200">
                    <p className="text-sm font-bold mb-3">📷 이미지 첨부 ({placeholders.length})</p>
                    <div className="space-y-3">
                      {placeholders.map((ph, idx) => {
                        const img = (active.images ?? []).find(im => im.placeholder === ph);
                        const caption = ph.replace(/^\[IMAGE:\s*/, "").replace(/\]$/, "");
                        return (
                          <div key={idx} className="flex gap-3 items-start p-3 bg-[#fafafa] rounded-lg">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-mono text-gray-500 mb-1 break-all">{ph}</p>
                              <p className="text-xs text-gray-600 break-keep">{caption}</p>
                            </div>
                            {img?.dataUrl ? (
                              <div className="flex flex-col gap-1 items-end">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={img.dataUrl} alt={caption} className="w-20 h-20 object-cover rounded" />
                                <div className="flex gap-2">
                                  <button onClick={() => generateChapterImage(activeIdx, ph)} disabled={!!imageGenBusy} className="text-xs text-tiger-orange hover:underline disabled:opacity-50">
                                    재생성
                                  </button>
                                  <button onClick={() => removeImage(activeIdx, ph)} className="text-xs text-red-600 hover:underline">삭제</button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1 items-end">
                                <button
                                  onClick={() => generateChapterImage(activeIdx, ph)}
                                  disabled={!!imageGenBusy}
                                  className="text-xs px-3 py-2 bg-tiger-orange text-white rounded-lg font-bold hover:bg-orange-600 transition disabled:opacity-50 whitespace-nowrap shadow-glow-orange-sm"
                                >
                                  {imageGenBusy === ph ? "생성 중..." : "✨ AI 자동 생성"}
                                </button>
                                <label className="text-[10px] px-2 py-1 text-gray-500 cursor-pointer hover:text-tiger-orange whitespace-nowrap">
                                  또는 직접 업로드
                                  <input
                                    type="file" accept="image/*" className="hidden"
                                    onChange={e => e.target.files?.[0] && uploadImage(activeIdx, ph, e.target.files[0])}
                                  />
                                </label>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-400 mt-3">2MB 이하 이미지. PDF·DOCX 출력 시 본문에 자동 삽입됩니다.</p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center text-gray-400 py-20 text-sm">
                {loading || "이 챕터는 아직 집필 전입니다"}
              </div>
            )}
          </section>
        </div>
      )}

      {/* 챕터 제목 편집 모달 */}
      {editingTitle !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4" onClick={() => setEditingTitle(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-black mb-4">챕터 제목 수정</h3>
            <input
              value={titleDraft.title}
              onChange={e => setTitleDraft({ ...titleDraft, title: e.target.value })}
              placeholder="제목"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg mb-2"
              autoFocus
            />
            <input
              value={titleDraft.subtitle}
              onChange={e => setTitleDraft({ ...titleDraft, subtitle: e.target.value })}
              placeholder="부제 (선택)"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditingTitle(null)} className="px-4 py-2 text-gray-500">취소</button>
              <button onClick={saveTitle} className="px-4 py-2 bg-tiger-orange text-white rounded-lg font-bold">저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 마지막 호출 사용량 */}
      {lastUsage && (
        <div className="fixed bottom-0 left-0 right-0 bg-ink-900 text-white text-xs py-2 px-4">
          <div className="max-w-6xl mx-auto flex items-center gap-2 sm:gap-4 flex-wrap">
            <span className="font-bold">방금</span>
            <span>입 {lastUsage.inputTokens?.toLocaleString()}</span>
            <span>출 {lastUsage.outputTokens?.toLocaleString()}</span>
            {lastUsage.thoughtsTokens ? <span>사고 {lastUsage.thoughtsTokens.toLocaleString()}</span> : null}
            <span className="text-tiger-orange font-bold">₩{lastUsage.costKRW?.toLocaleString()}</span>
            <span className="text-gray-400 hidden sm:inline">{(lastUsage.durationMs / 1000).toFixed(1)}s</span>
            <button onClick={() => setLastUsage(null)} className="ml-auto text-gray-400">✕</button>
          </div>
        </div>
      )}
    {kmongModalOpen && (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setKmongModalOpen(false)}>
        <div className="bg-white rounded-2xl max-w-4xl w-full p-6 md:p-8 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.2em] text-tiger-orange mb-2">
                {kmongProgress && kmongProgress.done < kmongProgress.total ? "크몽 패키지 생성 중" : "크몽 패키지"}
              </p>
              <h2 className="text-2xl font-black tracking-tight text-ink-900">{project.topic}</h2>
            </div>
            <button onClick={() => setKmongModalOpen(false)} className="text-2xl text-gray-400 hover:text-ink-900">×</button>
          </div>

          {/* 진행 바 */}
          {kmongProgress && (
            <div className="mb-6 p-4 rounded-xl bg-orange-50 border border-tiger-orange/30">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-bold text-ink-900">
                  {kmongProgress.done < kmongProgress.total ? "🔨 작업 진행 중" : "✓ 완료"}
                </span>
                <span className="font-mono text-sm text-tiger-orange font-bold">{kmongProgress.done}/{kmongProgress.total}</span>
              </div>
              <div className="w-full h-2 bg-orange-100 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-tiger-orange transition-all duration-300"
                  style={{ width: `${(kmongProgress.done / kmongProgress.total) * 100}%` }}
                />
              </div>
              <div className="flex flex-wrap gap-2 text-[10px] font-mono">
                {Object.entries(kmongProgress.items).map(([k, s]) => (
                  <span key={k} className={
                    s === "done" ? "px-2 py-0.5 bg-green-100 text-green-700 rounded"
                    : s === "failed" ? "px-2 py-0.5 bg-red-100 text-red-700 rounded"
                    : "px-2 py-0.5 bg-gray-100 text-gray-600 rounded animate-pulse"
                  }>
                    {s === "done" ? "✓" : s === "failed" ? "✗" : "⋯"} {k}
                  </span>
                ))}
              </div>
            </div>
          )}

          {(project as any).kmongPackage ? (
          <>
          <button onClick={downloadKmongPackage} className="w-full mb-6 py-3 bg-tiger-orange text-white text-base font-bold rounded-xl shadow-glow-orange-sm hover:bg-orange-600 transition">
            📦 ZIP 다운로드 (이미지 + 카피 + README)
          </button>

          <h3 className="text-sm font-bold text-ink-900 mb-1">이미지 ({(project as any).kmongPackage.images.length}/6)</h3>
          <p className="text-xs text-gray-500 mb-3">생성 실패한 이미지는 [재생성] 버튼으로 개별 재시도.</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
            {(["cover", "thumb", "toc", "spec", "audience", "preview"] as const).map(type => {
              const img = (project as any).kmongPackage?.images.find((i: any) => i.type === type);
              return (
                <div key={type} className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
                  <div className="aspect-square bg-gray-100 flex items-center justify-center">
                    {img ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={`data:image/png;base64,${img.base64}`} alt={type} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-xs text-gray-400 text-center px-2">아직 없음<br/><span className="text-[10px]">↓ [생성] 클릭</span></div>
                    )}
                  </div>
                  <div className="p-2 flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase text-gray-500">{type}</span>
                    <button
                      onClick={() => generateKmongPackage([type])}
                      disabled={!!kmongBusy}
                      className={img
                        ? "text-[10px] text-tiger-orange hover:underline disabled:opacity-50"
                        : "text-[10px] px-2 py-1 bg-tiger-orange text-white rounded font-bold hover:bg-orange-600 disabled:opacity-50"}
                    >
                      {img ? "재생성" : "생성"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <h3 className="text-sm font-bold text-ink-900 mb-3">마케팅 카피</h3>
          <div className="space-y-3">
            {([
              ["크몽 상세 페이지", (project as any).kmongPackage.copy.kmongDescription],
              ["강조 포인트 5", ((project as any).kmongPackage.copy.kmongHighlights ?? []).join("\n• ")],
              ["인스타", (project as any).kmongPackage.copy.instagram],
              ["카톡", (project as any).kmongPackage.copy.kakao],
              ["트위터", (project as any).kmongPackage.copy.twitter],
            ] as const).map(([label, text]) => (
              <div key={label} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono uppercase tracking-wider text-gray-500">{label}</span>
                  <button onClick={() => navigator.clipboard.writeText(text || "")} className="text-[10px] text-tiger-orange hover:underline">복사</button>
                </div>
                <pre className="text-xs whitespace-pre-wrap break-keep text-gray-700 font-sans">{text || "(비어있음)"}</pre>
              </div>
            ))}
          </div>
          </>
          ) : (
            <div className="text-center py-12 text-gray-500 text-sm">
              {kmongProgress ? "첫 작업 완료까지 잠시 기다려주세요..." : "패키지가 없습니다."}
            </div>
          )}
        </div>
      </div>
    )}
    </main>
    </>
  );
}

export default function WritePage() {
  return (
    <Suspense fallback={<Center>로딩 중...</Center>}>
      <Inner />
    </Suspense>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen flex items-center justify-center text-gray-500">{children}</main>;
}

function BatchBanner({
  batch,
  onStop,
  onResume,
  onDismiss,
}: {
  batch: BatchState;
  onStop: () => void;
  onResume: () => void;
  onDismiss: () => void;
}) {
  if (batch.status === "idle") return null;

  if (batch.status === "running") {
    const completed = batch.pendingIdxs.findIndex(i => i === batch.currentIdx);
    const pct = batch.total === 0 ? 0 : Math.round((completed / batch.total) * 100);
    const elapsed = Math.round((Date.now() - batch.startedAt) / 1000);
    return (
      <div className="sticky top-0 z-30 bg-white border border-tiger-orange/30 rounded-xl p-4 mb-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-bold text-ink-900">
            전체 일괄 집필 — {completed + 1}/{batch.total}장
          </div>
          <button onClick={onStop} className="text-xs text-red-600 hover:text-red-700 font-bold">중단</button>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
          <div className="h-full bg-tiger-orange transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex justify-between text-xs font-mono text-gray-500">
          <span>{batch.currentIdx + 1}장 집필 중... ({elapsed}s)</span>
          <span>누적 ₩{batch.cumulativeCostKRW.toLocaleString()}</span>
        </div>
      </div>
    );
  }

  if (batch.status === "failed") {
    return (
      <div className="sticky top-0 z-30 bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-1">
          <div className="text-sm font-bold text-red-700">
            {batch.failedIdx + 1}장에서 중단 — {batch.remainingIdxs.length}장 남음
          </div>
          <div className="flex gap-2">
            <button onClick={onResume} className="px-3 py-1 text-xs bg-tiger-orange text-white font-bold rounded-lg hover:bg-orange-600">
              {batch.failedIdx + 1}장부터 재개
            </button>
            <button onClick={onDismiss} className="px-3 py-1 text-xs border border-red-200 text-red-700 rounded-lg hover:bg-white">
              닫기
            </button>
          </div>
        </div>
        <div className="text-xs text-red-600">{batch.errorMessage}</div>
        <div className="text-[11px] font-mono text-gray-500 mt-1">지금까지 ₩{batch.cumulativeCostKRW.toLocaleString()} 사용</div>
      </div>
    );
  }

  // stopped
  return (
    <div className="sticky top-0 z-30 bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-ink-900">중단됨 — {batch.completedCount}장 완료. 사이드바에서 개별 챕터 이어 작성 가능.</div>
        <button onClick={onDismiss} className="px-3 py-1 text-xs border border-gray-300 text-ink-900 rounded-lg hover:bg-white">닫기</button>
      </div>
    </div>
  );
}
