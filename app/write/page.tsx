"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/Header";
import type { MetaAdImage } from "@/lib/storage";

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

// ─── 콘텐츠 재가공 (Wave 1) helpers ───
type RepurposeChannel = "instagram" | "youtube" | "blog" | "email" | "kakao";

const REPURPOSE_EMOJI: Record<RepurposeChannel, string> = {
  instagram: "📱", youtube: "🎬", blog: "📰", email: "📧", kakao: "💬",
};
const REPURPOSE_LABEL: Record<RepurposeChannel, string> = {
  instagram: "인스타", youtube: "유튜브", blog: "블로그", email: "이메일", kakao: "카톡",
};
const REPURPOSE_COST: Record<RepurposeChannel, string> = {
  instagram: "~₩40", youtube: "~₩30", blog: "~₩100", email: "~₩60", kakao: "~₩20",
};

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
  const [coverVariants, setCoverVariants] = useState<string[]>([]);
  const [variantBusy, setVariantBusy] = useState(false);
  const [continueModal, setContinueModal] = useState<{ chapterIdx: number; seed: string } | null>(null);
  const [continueBusy, setContinueBusy] = useState(false);
  const [editChat, setEditChat] = useState<{
    chapterIdx: number;
    instruction: string;
    proposal: string | null;
    busy: boolean;
  } | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  // ConfirmModal — 모바일/Telegram 내장 브라우저가 native confirm() 차단해서 React 모달로 대체
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "default" | "danger" | "warn";
    onConfirm: () => void;
  } | null>(null);

  const showConfirm = (opts: NonNullable<typeof confirmModal>) => setConfirmModal(opts);
  const [titleDraft, setTitleDraft] = useState({ title: "", subtitle: "" });
  const [addChapterOpen, setAddChapterOpen] = useState(false);
  const [addChapterDraft, setAddChapterDraft] = useState({ title: "", subtitle: "" });

  // ─── 마케팅 메타 (tagline / description / authorName / authorBio) ───
  const [marketingMeta, setMarketingMeta] = useState<{
    tagline?: string;
    description?: string;
    authorName?: string;
    authorBio?: string;
  } | null>(null);
  const [marketingBusy, setMarketingBusy] = useState(false);
  const [marketingEditOpen, setMarketingEditOpen] = useState(false);
  const [marketingForm, setMarketingForm] = useState<{
    tagline?: string;
    description?: string;
    authorName?: string;
    authorBio?: string;
  }>({});
  const [copyConfirm, setCopyConfirm] = useState(false);

  // ─── Meta(FB/IG) 광고 패키지 (Sub-project 5) ───
  const [metaAdPackage, setMetaAdPackage] = useState<any>(null);
  const [metaAdBusy, setMetaAdBusy] = useState(false);
  const [metaCopiedIdx, setMetaCopiedIdx] = useState<string | null>(null);

  // ─── Meta 광고 이미지 (Part A — 3 비율) ───
  const [metaAdImages, setMetaAdImages] = useState<MetaAdImage[]>([]);
  const [metaImgBusy, setMetaImgBusy] = useState(false);
  // Wave 3: Sharp overlay 템플릿
  const [imageTemplate, setImageTemplate] = useState<"minimal" | "bold" | "story" | "quote" | "cta">("bold");

  // ─── 콘텐츠 재가공 (Wave 1: 5채널) ───
  const [repurposed, setRepurposed] = useState<any>(null);
  const [activeRepurposeTab, setActiveRepurposeTab] = useState<RepurposeChannel>("instagram");
  const [repurposeBusy, setRepurposeBusy] = useState<RepurposeChannel | null>(null);
  const [repurposeCopiedKey, setRepurposeCopiedKey] = useState<string | null>(null);
  const [expandedBlogPost, setExpandedBlogPost] = useState<number | null>(null);

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

  // marketingMeta sync — project이 로드되거나 갱신될 때마다 동기화
  useEffect(() => {
    if (project) {
      const mm = (project as any).marketingMeta ?? null;
      setMarketingMeta(mm);
    }
  }, [project]);

  // metaAdPackage sync (Sub-project 5)
  useEffect(() => {
    if ((project as any)?.metaAdPackage) setMetaAdPackage((project as any).metaAdPackage);
  }, [project]);

  // metaAdImages sync (Part A)
  useEffect(() => {
    const imgs = (project as any)?.metaAdImages;
    if (Array.isArray(imgs)) setMetaAdImages(imgs);
  }, [project]);

  // repurposedContent sync (Wave 1)
  useEffect(() => {
    if ((project as any)?.repurposedContent) setRepurposed((project as any).repurposedContent);
  }, [project]);

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

  // 잔액이 충분한지 사전 체크 (true면 OK, false면 모달 + false)
  const checkBalanceForBatch = (chaptersToWriteCount: number): boolean => {
    if (balance == null) return true;
    const need = estimateBatchKRW(chaptersToWriteCount);
    if (balance >= need) return true;
    const shortage = need - balance;
    showConfirm({
      title: "🪙 잔액 부족",
      message: `${chaptersToWriteCount}장 일괄 집필에 약 ₩${need.toLocaleString()}이 필요한데 현재 잔액은 ₩${balance.toLocaleString()}입니다. 약 ₩${shortage.toLocaleString()} 부족합니다.\n\n충전 페이지에서 잔액을 늘리거나 한 챕터씩 [다시 생성] 버튼으로 진행할 수 있습니다.`,
      confirmLabel: "충전하러 가기",
      cancelLabel: "다음에",
      variant: "warn",
      onConfirm: () => router.push("/billing"),
    });
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
    showConfirm({
      title: "⚡ 전체 일괄 집필 시작",
      message: `${pendingIdxs.length}장을 한 번에 집필합니다.\n예상 비용: 약 ₩${estimateBatchKRW(pendingIdxs.length).toLocaleString()} 이내\n예상 시간: 약 ${pendingIdxs.length}분 (장당 ~30~60초)\n\n중간에 [정지] 가능, 실패 시 [이어서] 가능합니다.`,
      confirmLabel: "시작하기",
      cancelLabel: "취소",
      onConfirm: () => runBatch(pendingIdxs),
    });
  };

  const runBatch = async (pendingIdxs: number[]) => {
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
  const addChapter = async (titleArg?: string, subtitleArg?: string) => {
    let title = titleArg;
    let subtitle = subtitleArg ?? "";
    if (!title) {
      const t = prompt("새 챕터 제목");
      if (!t) return;
      title = t;
      subtitle = prompt("부제 (선택)") ?? "";
    }
    const chapters = [...project.chapters, { title, subtitle, content: "", images: [] }];
    setActiveIdx(chapters.length - 1);
    await saveProject({ ...project, chapters });
  };
  const submitAddChapter = async () => {
    const title = addChapterDraft.title.trim();
    if (!title) return;
    await addChapter(title, addChapterDraft.subtitle.trim());
    setAddChapterDraft({ title: "", subtitle: "" });
    setAddChapterOpen(false);
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

  // 이미지 + 본문에서 placeholder 자체 제거 (이미지 자체를 책에서 빼기)
  const removeImagePlaceholder = async (chapterIdx: number, placeholder: string) => {
    const chapters = [...project.chapters];
    const ch = { ...chapters[chapterIdx] };
    // 본문에서 placeholder 줄 자체 제거 (앞뒤 빈 줄 정리)
    ch.content = ch.content
      .split("\n")
      .filter(line => line.trim() !== placeholder)
      .join("\n")
      .replace(/\n{3,}/g, "\n\n");
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
      // Cloudflare rate limit 회피 — 각 task 사이 1.5초 간격
      if (i > 0) await new Promise(r => setTimeout(r, 1500));
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

  // 표지 5장 후보 생성 (dryRun, DB 저장 X). 단일 슬롯 재시도 가능.
  const tryGenerateOneVariant = async (slotIdx: number): Promise<string | null> => {
    if (!projectId) return null;
    // 1차 시도 + 1회 retry (rate limit 방어)
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt > 0) await new Promise(r => setTimeout(r, 2000));
        const res = await fetch("/api/generate/kmong-package", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, regenerateOnly: ["cover"], dryRun: true }),
        });
        if (!res.ok) continue;
        const data = await res.json();
        const b64 = data.newImages?.[0]?.base64;
        if (b64) return b64;
      } catch (e: any) {
        console.error(`[cover-variant-${slotIdx}-${attempt}]`, e.message);
      }
    }
    return null;
  };

  const generateCoverVariants = async () => {
    if (!projectId) return;
    setCoverVariants(Array(5).fill("")); // 빈 슬롯 5개
    setVariantBusy(true);
    setError(null);
    let failCount = 0;
    for (let i = 0; i < 5; i++) {
      if (i > 0) await new Promise(r => setTimeout(r, 2500)); // 2.5s 간격 (rate limit ↓)
      const b64 = await tryGenerateOneVariant(i);
      if (b64) {
        setCoverVariants(prev => {
          const next = [...prev];
          next[i] = b64;
          return next;
        });
      } else {
        failCount++;
      }
    }
    setVariantBusy(false);
    if (failCount > 0) setError(`${5 - failCount}/5장 생성. 빈 슬롯 클릭으로 개별 재시도 가능.`);
  };

  const retrySingleVariant = async (slotIdx: number) => {
    if (variantBusy) return;
    setVariantBusy(true);
    setError(null);
    const b64 = await tryGenerateOneVariant(slotIdx);
    if (b64) {
      setCoverVariants(prev => {
        const next = [...prev];
        next[slotIdx] = b64;
        return next;
      });
    } else {
      setError(`${slotIdx + 1}번 슬롯 재생성 실패. 다시 시도하거나 [다시 5장] 버튼 사용.`);
    }
    setVariantBusy(false);
  };

  const selectCoverVariant = async (base64: string) => {
    if (!projectId) return;
    const pkg = (project as any).kmongPackage;
    if (!pkg) return;
    const newImages = pkg.images.filter((i: any) => i.type !== "cover");
    newImages.push({ type: "cover", base64, vendor: "cloudflare", generatedAt: Date.now() });
    const updated = { ...pkg, images: newImages };
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { kmongPackage: updated } }),
      });
      const fresh = await fetch(`/api/projects/${projectId}`).then(r => r.json());
      setProject(fresh);
      setCoverVariants([]);
    } catch (e: any) {
      setError(e.message);
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

  // 작가가 시작한 첫 단락에서 AI가 이어 작성
  const continueChapterAI = async (chapterIdx: number, seed: string) => {
    if (!projectId) return;
    setContinueBusy(true);
    setError(null);
    setStreamingChapterIdx(chapterIdx);
    setStreamingText(seed + "\n\n");
    setActiveIdx(chapterIdx);
    try {
      const res = await fetch("/api/generate/chapter-continue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, chapterIdx, seedText: seed }),
      });
      if (res.status === 402) {
        const data = await res.json().catch(() => ({}));
        if (confirm(`잔액 부족: ₩${data.shortfall?.toLocaleString()} 부족. 충전 페이지로?`)) router.push("/billing");
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
      let accumulated = seed + "\n\n";
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
      if (doneMsg.newBalance != null) setBalance(doneMsg.newBalance);
      const fresh = await fetch(`/api/projects/${projectId}`).then(r => r.json());
      setProject(fresh);
      setContinueModal(null);
    } catch (e: any) {
      if (e.message !== "잔액 부족") setError(e.message);
    } finally {
      setContinueBusy(false);
      setStreamingChapterIdx(null);
      setStreamingText("");
    }
  };

  // AI 글쓰기 챗 — 자연어 지시 → AI 수정안 → 적용/거절
  const askChapterEdit = async () => {
    if (!editChat || !projectId) return;
    setEditChat(c => c ? { ...c, busy: true, proposal: null } : c);
    setError(null);
    try {
      const res = await fetch("/api/generate/chapter-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, chapterIdx: editChat.chapterIdx, instruction: editChat.instruction }),
      });
      const data = await res.json();
      if (res.status === 402) {
        if (confirm(`잔액 부족. 충전 페이지로?`)) router.push("/billing");
        throw new Error("잔액 부족");
      }
      if (!res.ok) throw new Error(data.message || `요청 실패 (${res.status})`);
      if (data.newBalance != null) setBalance(data.newBalance);
      setEditChat(c => c ? { ...c, busy: false, proposal: data.newContent } : c);
    } catch (e: any) {
      if (e.message !== "잔액 부족") setError(e.message);
      setEditChat(c => c ? { ...c, busy: false } : c);
    }
  };

  const applyChapterEdit = async () => {
    if (!editChat?.proposal || !project) return;
    const chapters = [...project.chapters];
    chapters[editChat.chapterIdx] = { ...chapters[editChat.chapterIdx], content: editChat.proposal };
    await saveProject({ ...project, chapters });
    setEditChat(null);
  };

  // ─── 마케팅 메타 핸들러 ───
  const generateMarketingMeta = async () => {
    if (!projectId) return;
    setMarketingBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/generate/marketing-meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (res.status === 402) {
        if (confirm(`잔액 부족. 충전 페이지로 이동할까요?`)) router.push("/billing");
        throw new Error("잔액 부족");
      }
      if (!res.ok) throw new Error(data.message || `요청 실패 (${res.status})`);
      if (data.newBalance != null) setBalance(data.newBalance);
      if (data.marketingMeta) setMarketingMeta(data.marketingMeta);
      // project도 fresh로 동기화 (PATCH 머지 결과 반영)
      const fresh = await fetch(`/api/projects/${projectId}`).then(r => r.json());
      setProject(fresh);
    } catch (e: any) {
      if (e.message !== "잔액 부족") setError(e.message);
    } finally {
      setMarketingBusy(false);
    }
  };

  const openMarketingEditor = () => {
    setMarketingForm({ ...(marketingMeta ?? {}) });
    setMarketingEditOpen(true);
  };

  const saveMarketingMeta = async () => {
    if (!projectId) return;
    setMarketingBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketingMeta: marketingForm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `저장 실패 (${res.status})`);
      const merged = data.updates?.marketingMeta ?? { ...(marketingMeta ?? {}), ...marketingForm };
      setMarketingMeta(merged);
      setMarketingEditOpen(false);
      const fresh = await fetch(`/api/projects/${projectId}`).then(r => r.json());
      setProject(fresh);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setMarketingBusy(false);
    }
  };

  const copyMarketingUrl = async () => {
    if (!projectId) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/book/${projectId}`);
      setCopyConfirm(true);
      setTimeout(() => setCopyConfirm(false), 2000);
    } catch (e: any) {
      setError(`URL 복사 실패: ${e.message}`);
    }
  };

  // ─── Meta 광고 패키지 핸들러 (Sub-project 5) ───
  const generateMetaPackage = async () => {
    if (!projectId) return;
    setMetaAdBusy(true); setError(null);
    try {
      const res = await fetch("/api/generate/meta-package", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `생성 실패 (${res.status})`);
      setMetaAdPackage(data.metaAdPackage);
      if (typeof data.newBalance === "number") setBalance(data.newBalance);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setMetaAdBusy(false);
    }
  };

  const copyMetaItem = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setMetaCopiedIdx(key);
    setTimeout(() => setMetaCopiedIdx(null), 1500);
  };

  // ─── 콘텐츠 재가공 핸들러 (Wave 1) ───
  const generateRepurpose = async (channel: RepurposeChannel) => {
    if (!projectId) return;
    setRepurposeBusy(channel);
    setError(null);
    try {
      const res = await fetch(`/api/generate/repurpose-${channel}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `생성 실패 (${res.status})`);
      setRepurposed((prev: any) => ({ ...(prev ?? {}), [channel]: data.content }));
      if (typeof data.newBalance === "number") setBalance(data.newBalance);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRepurposeBusy(null);
    }
  };

  const copyRepurpose = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setRepurposeCopiedKey(key);
    setTimeout(() => setRepurposeCopiedKey(null), 1500);
  };

  // ─── Meta 광고 이미지 (Part A) — 3 비율 자동 생성 ───
  const generateMetaImages = async (regenerateOnly?: ("feed" | "story" | "link")[]) => {
    if (!projectId) return;
    setMetaImgBusy(true); setError(null);
    try {
      const res = await fetch("/api/generate/meta-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, template: imageTemplate, ...(regenerateOnly ? { regenerateOnly } : {}) }),
      });
      const data = await res.json();
      if (res.status === 402) {
        if (confirm(`잔액 부족: 충전 페이지로 이동할까요?`)) router.push("/billing");
        throw new Error("잔액 부족");
      }
      if (!res.ok) throw new Error(data.message || `이미지 생성 실패 (${res.status})`);
      // 부분 재생성 → 기존 + new 병합. 전체 재생성 → new로 교체.
      if (regenerateOnly && regenerateOnly.length > 0) {
        const replaced = new Set<string>(regenerateOnly);
        setMetaAdImages(prev => [
          ...prev.filter(i => !replaced.has(i.type)),
          ...(data.images ?? []),
        ]);
      } else {
        setMetaAdImages(data.images ?? []);
      }
      if (typeof data.newBalance === "number") setBalance(data.newBalance);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setMetaImgBusy(false);
    }
  };

  const downloadMetaImage = (img: MetaAdImage) => {
    const a = document.createElement("a");
    a.href = `data:image/png;base64,${img.base64}`;
    a.download = `meta-${img.type}-${img.aspectRatio.replace(":", "x")}.png`;
    a.click();
  };

  const metaImageLabel = (type: MetaAdImage["type"]) =>
    type === "feed" ? "피드" : type === "story" ? "스토리" : "링크";

  // 챕터 드래그로 순서 변경
  const handleDragStart = (i: number) => (e: React.DragEvent) => {
    setDragIdx(i);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (i: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragIdx !== null && i !== dragIdx) setDragOverIdx(i);
  };
  const handleDragEnd = () => {
    setDragIdx(null);
    setDragOverIdx(null);
  };
  const handleDrop = (toIdx: number) => async (e: React.DragEvent) => {
    e.preventDefault();
    if (!project || dragIdx === null || dragIdx === toIdx) {
      handleDragEnd();
      return;
    }
    const chapters = [...project.chapters];
    const [moved] = chapters.splice(dragIdx, 1);
    chapters.splice(toIdx, 0, moved);
    // activeIdx 보정
    let newActive = activeIdx;
    if (activeIdx === dragIdx) newActive = toIdx;
    else if (dragIdx < activeIdx && toIdx >= activeIdx) newActive = activeIdx - 1;
    else if (dragIdx > activeIdx && toIdx <= activeIdx) newActive = activeIdx + 1;
    setActiveIdx(newActive);
    handleDragEnd();
    await saveProject({ ...project, chapters });
  };

  // 모든 챕터의 [IMAGE: ...] placeholder 다 모아서 일괄 생성 (이미 dataUrl 있으면 skip)
  const generateAllChapterImages = async () => {
    if (!project) return;
    type Job = { chapterIdx: number; placeholder: string };
    const jobs: Job[] = [];
    project.chapters.forEach((c, ci) => {
      const phs = extractImagePlaceholders(c.content);
      phs.forEach(ph => {
        const existing = c.images?.find(i => i.placeholder === ph);
        if (!existing?.dataUrl) jobs.push({ chapterIdx: ci, placeholder: ph });
      });
    });
    if (jobs.length === 0) {
      setError("이미 모든 이미지가 생성되어 있습니다.");
      return;
    }
    if (!confirm(`총 ${jobs.length}개 이미지를 일괄 생성합니다 (~${jobs.length * 6}초). 진행할까요?`)) return;
    setError(null);
    for (let i = 0; i < jobs.length; i++) {
      const { chapterIdx, placeholder } = jobs[i];
      setImageGenBusy(`${placeholder} (${i + 1}/${jobs.length})`);
      try {
        if (i > 0) await new Promise(r => setTimeout(r, 1500));
        const res = await fetch("/api/generate/chapter-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, chapterIdx, placeholder }),
        });
        const data = await res.json();
        if (res.status === 402) {
          if (confirm(`잔액 부족 (${i + 1}/${jobs.length}에서 멈춤). 충전 페이지로?`)) router.push("/billing");
          break;
        }
        if (!res.ok) {
          console.error(`[batch-img-${i}]`, data.message);
          continue;
        }
        if (data.newBalance != null) setBalance(data.newBalance);
      } catch (e: any) {
        console.error(`[batch-img-${i}]`, e.message);
      }
    }
    // 모든 이미지 생성 후 한 번 fresh
    try {
      const fresh = await fetch(`/api/projects/${projectId}`).then(r => r.json());
      setProject(fresh);
    } catch {}
    setImageGenBusy("");
  };

  const active = project.chapters[activeIdx];
  const placeholders = active ? extractImagePlaceholders(active.content) : [];

  // 모든 챕터에 누락된 이미지가 있는지 (일괄 버튼 표시용)
  const missingImageCount = project.chapters.reduce((sum, c) => {
    const phs = extractImagePlaceholders(c.content);
    return sum + phs.filter(ph => !c.images?.find(i => i.placeholder === ph)?.dataUrl).length;
  }, 0);

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
                <button onClick={() => setAddChapterOpen(true)} disabled={!!loading} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs hover:bg-[#fafafa] hover:border-gray-400 transition">
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
              {missingImageCount > 0 && (
                <button
                  onClick={generateAllChapterImages}
                  disabled={!!loading || !!imageGenBusy || batch.status === "running"}
                  className="w-full px-3 py-2 mt-1 bg-orange-50 border border-tiger-orange/40 text-tiger-orange rounded-lg text-xs font-bold hover:bg-orange-100 transition disabled:opacity-50"
                  title={`본문에 누락된 이미지 ${missingImageCount}개를 한 번에 생성`}
                >
                  {imageGenBusy.startsWith("[IMAGE:") ? `🖼️ ${imageGenBusy}` : `🖼️ 본문 이미지 일괄 (${missingImageCount}개)`}
                </button>
              )}
              {(project as any).kmongPackage && (
                <button
                  onClick={() => setKmongModalOpen(true)}
                  className="w-full px-3 py-1 text-xs text-tiger-orange hover:underline"
                >
                  크몽 패키지 다시 보기
                </button>
              )}
              {/* 공유 링크 토글 — 책 자랑·홍보용 */}
              <div className="mt-2 pt-2 border-t border-gray-100">
                <ShareToggle
                  projectId={projectId!}
                  enabled={(project as any).shareEnabled === true}
                  shareLinks={(project as any).shareLinks ?? {}}
                  onChange={async (patch) => {
                    setProject({ ...(project as any), ...patch });
                    await fetch(`/api/projects/${projectId}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ data: patch }),
                    }).catch(() => {});
                  }}
                />
              </div>

              {/* 마케팅 페이지 — AI 카피 + 편집 + URL 복사 */}
              <div className="mt-2 pt-2 border-t border-gray-100 px-2 pb-1">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-bold text-ink-900">🔗 마케팅 페이지</span>
                  <a
                    href={`/book/${projectId}`}
                    target="_blank"
                    rel="noopener"
                    className="text-xs text-tiger-orange hover:underline"
                  >
                    미리보기 →
                  </a>
                </div>
                {!marketingMeta ? (
                  <button
                    onClick={generateMarketingMeta}
                    disabled={marketingBusy || !!loading}
                    className="w-full px-2 py-1.5 border border-tiger-orange/40 text-tiger-orange rounded-lg text-[11px] font-bold hover:bg-orange-50 transition disabled:opacity-50"
                  >
                    {marketingBusy ? "AI 카피 생성 중..." : "🤖 AI가 마케팅 카피 생성"}
                  </button>
                ) : (
                  <>
                    {marketingMeta.tagline && (
                      <p className="text-[11px] text-gray-700 truncate mb-1.5" title={marketingMeta.tagline}>
                        📌 {marketingMeta.tagline}
                      </p>
                    )}
                    <div className="flex gap-1 text-[11px]">
                      <button
                        onClick={openMarketingEditor}
                        disabled={marketingBusy}
                        className="flex-1 px-2 py-1 border border-gray-200 rounded hover:bg-gray-50 transition disabled:opacity-50"
                      >
                        편집
                      </button>
                      <button
                        onClick={copyMarketingUrl}
                        className="flex-1 px-2 py-1 border border-gray-200 rounded hover:bg-gray-50 transition"
                      >
                        {copyConfirm ? "✓ 복사됨" : "URL 복사"}
                      </button>
                    </div>
                  </>
                )}

                {/* 📦 크몽 등록 가이드 (정적, AI 호출 X) */}
                <KmongGuideBox project={project} />
                {marketingEditOpen && (
                  <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 mb-0.5">한 줄 소개 (tagline)</label>
                      <input
                        type="text"
                        maxLength={200}
                        value={marketingForm.tagline ?? ""}
                        onChange={e => setMarketingForm(f => ({ ...f, tagline: e.target.value }))}
                        className="w-full text-xs px-2 py-1 border border-gray-200 rounded"
                        placeholder="이 책을 한 줄로"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 mb-0.5">상세 설명 (description)</label>
                      <textarea
                        maxLength={3000}
                        rows={4}
                        value={marketingForm.description ?? ""}
                        onChange={e => setMarketingForm(f => ({ ...f, description: e.target.value }))}
                        className="w-full text-xs px-2 py-1 border border-gray-200 rounded resize-y"
                        placeholder="책 소개를 자세히"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 mb-0.5">저자 이름</label>
                      <input
                        type="text"
                        maxLength={50}
                        value={marketingForm.authorName ?? ""}
                        onChange={e => setMarketingForm(f => ({ ...f, authorName: e.target.value }))}
                        className="w-full text-xs px-2 py-1 border border-gray-200 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 mb-0.5">저자 소개</label>
                      <input
                        type="text"
                        maxLength={300}
                        value={marketingForm.authorBio ?? ""}
                        onChange={e => setMarketingForm(f => ({ ...f, authorBio: e.target.value }))}
                        className="w-full text-xs px-2 py-1 border border-gray-200 rounded"
                      />
                    </div>
                    <div className="flex gap-1 pt-1">
                      <button
                        onClick={() => setMarketingEditOpen(false)}
                        disabled={marketingBusy}
                        className="flex-1 px-2 py-1 text-[11px] border border-gray-200 rounded hover:bg-white transition disabled:opacity-50"
                      >
                        취소
                      </button>
                      <button
                        onClick={saveMarketingMeta}
                        disabled={marketingBusy}
                        className="flex-1 px-2 py-1 text-[11px] bg-tiger-orange text-white font-bold rounded hover:bg-orange-600 transition disabled:opacity-50"
                      >
                        {marketingBusy ? "저장 중..." : "저장"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Meta(FB/IG) 광고 패키지 — Sub-project 5 */}
              <div className="mb-3 p-3 bg-blue-50/50 border border-blue-300/40 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-ink-900">🎯 Meta 광고</h3>
                  {metaAdPackage && (
                    <button onClick={generateMetaPackage} disabled={metaAdBusy} className="text-[10px] text-blue-600 hover:underline">🔄 다시</button>
                  )}
                </div>

                {!metaAdPackage && !metaAdBusy && (
                  <button
                    onClick={generateMetaPackage}
                    disabled={metaAdBusy}
                    className="w-full px-3 py-2 bg-blue-500 text-white rounded font-bold hover:bg-blue-600 disabled:opacity-50 text-xs"
                  >
                    🎯 Meta 광고 카피 생성 (~₩40)
                  </button>
                )}

                {metaAdBusy && (
                  <div className="text-xs text-blue-700 text-center py-2">⏳ AI 카피 생성 중...</div>
                )}

                {metaAdPackage && (
                  <div className="space-y-3 text-xs">
                    <div>
                      <div className="font-bold text-ink-900 mb-1">📰 헤드라인 (≤40자)</div>
                      {metaAdPackage.headlines.map((h: string, i: number) => (
                        <div key={i} className="flex items-center gap-2 p-2 bg-white rounded mb-1">
                          <span className="flex-1 break-all">{h}</span>
                          <button onClick={() => copyMetaItem(h, `h${i}`)} className="text-[10px] text-blue-600 hover:underline shrink-0">
                            {metaCopiedIdx === `h${i}` ? "✓ 복사됨" : "복사"}
                          </button>
                        </div>
                      ))}
                    </div>

                    <div>
                      <div className="font-bold text-ink-900 mb-1">📝 본문 (≤125자)</div>
                      {metaAdPackage.primaryTexts.map((p: string, i: number) => (
                        <div key={i} className="flex items-start gap-2 p-2 bg-white rounded mb-1">
                          <span className="flex-1 break-all whitespace-pre-wrap">{p}</span>
                          <button onClick={() => copyMetaItem(p, `p${i}`)} className="text-[10px] text-blue-600 hover:underline shrink-0">
                            {metaCopiedIdx === `p${i}` ? "✓ 복사됨" : "복사"}
                          </button>
                        </div>
                      ))}
                    </div>

                    <div>
                      <div className="font-bold text-ink-900 mb-1">🔘 CTA 버튼</div>
                      <div className="flex flex-wrap gap-1">
                        {metaAdPackage.ctaButtons.map((c: string, i: number) => (
                          <span key={i} className="px-2 py-1 bg-blue-100 text-blue-800 rounded">{c}</span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="font-bold text-ink-900 mb-1">🎯 타겟팅 추천</div>
                      <div className="p-2 bg-white rounded space-y-1">
                        <div>나이: {metaAdPackage.audienceSuggestion?.ageMin}~{metaAdPackage.audienceSuggestion?.ageMax}세</div>
                        <div>관심사: {metaAdPackage.audienceSuggestion?.interests?.join(", ")}</div>
                        <div>지역: {metaAdPackage.audienceSuggestion?.locations?.join(", ")}</div>
                        <button
                          onClick={() => copyMetaItem(JSON.stringify(metaAdPackage.audienceSuggestion, null, 2), "aud")}
                          className="text-[10px] text-blue-600 hover:underline"
                        >
                          {metaCopiedIdx === "aud" ? "✓ 복사됨" : "JSON 복사"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Meta 광고 이미지 (Part A) — 3 비율 자동 생성 */}
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-bold text-ink-900">🖼️ 광고 이미지 (3 비율)</div>
                    {metaAdImages.length > 0 && !metaImgBusy && (
                      <button
                        onClick={() => generateMetaImages()}
                        className="text-[10px] text-blue-600 hover:underline"
                      >
                        🔄 전체 다시
                      </button>
                    )}
                  </div>

                  {/* Wave 3: 디자인 템플릿 picker */}
                  <div className="mb-2">
                    <div className="text-[10px] font-bold text-ink-900 mb-1">디자인 템플릿</div>
                    <div className="flex gap-1 flex-wrap">
                      {[
                        { key: "minimal", label: "🤍 미니멀" },
                        { key: "bold", label: "🔥 강조" },
                        { key: "story", label: "📱 스토리" },
                        { key: "quote", label: "💬 인용" },
                        { key: "cta", label: "🎯 CTA" },
                      ].map(t => (
                        <button
                          key={t.key}
                          onClick={() => setImageTemplate(t.key as any)}
                          className={`text-[10px] px-2 py-1 rounded font-bold ${imageTemplate === t.key ? "bg-blue-500 text-white" : "bg-white border border-blue-200 text-blue-700 hover:border-blue-400"}`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {metaAdImages.length === 0 && !metaImgBusy && (
                    <button
                      onClick={() => generateMetaImages()}
                      disabled={metaImgBusy}
                      className="w-full px-3 py-2 bg-blue-500 text-white rounded font-bold hover:bg-blue-600 disabled:opacity-50 text-xs"
                    >
                      🎨 광고 이미지 3장 생성 (~₩90)
                    </button>
                  )}

                  {metaImgBusy && (
                    <div className="text-xs text-blue-700 text-center py-3">
                      ⏳ 이미지 생성 중... (약 30초)
                      <span className="inline-block ml-1 animate-pulse">···</span>
                    </div>
                  )}

                  {metaAdImages.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {(["feed", "story", "link"] as const).map((type) => {
                        const img = metaAdImages.find((i) => i.type === type);
                        return (
                          <div key={type} className="bg-white rounded border border-blue-200 p-1.5 flex flex-col">
                            <div className="text-[10px] font-bold text-ink-900 mb-1 text-center">
                              {metaImageLabel(type)}{" "}
                              <span className="font-normal text-gray-500">
                                {type === "feed" ? "1:1" : type === "story" ? "9:16" : "16:9"}
                              </span>
                            </div>
                            {img ? (
                              <>
                                <img
                                  src={`data:image/png;base64,${img.base64}`}
                                  alt={`Meta ${type}`}
                                  className="w-full max-h-[150px] object-contain bg-gray-50 rounded"
                                />
                                <div className="flex gap-1 mt-1">
                                  <button
                                    onClick={() => downloadMetaImage(img)}
                                    className="flex-1 text-[10px] px-1 py-0.5 bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
                                  >
                                    💾 다운로드
                                  </button>
                                  <button
                                    onClick={() => generateMetaImages([type])}
                                    disabled={metaImgBusy}
                                    className="flex-1 text-[10px] px-1 py-0.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                                  >
                                    🔄 다시
                                  </button>
                                </div>
                              </>
                            ) : (
                              <div className="flex flex-col items-center justify-center py-3 text-[10px] text-gray-400">
                                <span>없음</span>
                                <button
                                  onClick={() => generateMetaImages([type])}
                                  disabled={metaImgBusy}
                                  className="mt-1 text-blue-600 hover:underline"
                                >
                                  생성
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* 콘텐츠 재가공 — Wave 1 (5채널) */}
              <div className="mb-3 p-3 bg-pink-50/50 border border-pink-300/40 rounded-lg">
                <h3 className="text-sm font-bold text-ink-900 mb-2">📢 콘텐츠 재가공</h3>
                <p className="text-[10px] text-gray-600 mb-3">책 1권 → 5채널 자동 생성</p>

                {/* 5 tabs */}
                <div className="flex gap-1 mb-3 overflow-x-auto">
                  {(["instagram", "youtube", "blog", "email", "kakao"] as RepurposeChannel[]).map(ch => (
                    <button
                      key={ch}
                      onClick={() => setActiveRepurposeTab(ch)}
                      className={`px-2 py-1 text-[11px] rounded font-bold whitespace-nowrap ${
                        activeRepurposeTab === ch
                          ? "bg-pink-500 text-white"
                          : "bg-white border border-pink-200 text-pink-700 hover:border-pink-400"
                      }`}
                    >
                      {REPURPOSE_EMOJI[ch]} {REPURPOSE_LABEL[ch]}
                    </button>
                  ))}
                </div>

                {/* Active tab content */}
                <div>
                  {(!repurposed || !repurposed[activeRepurposeTab]) && repurposeBusy !== activeRepurposeTab && (
                    <button
                      onClick={() => generateRepurpose(activeRepurposeTab)}
                      className="w-full px-3 py-2 bg-pink-500 text-white rounded text-xs font-bold hover:bg-pink-600"
                    >
                      {REPURPOSE_LABEL[activeRepurposeTab]} 생성 ({REPURPOSE_COST[activeRepurposeTab]})
                    </button>
                  )}
                  {repurposeBusy === activeRepurposeTab && (
                    <div className="text-xs text-pink-700 text-center py-2">⏳ 생성 중... (10-20초)</div>
                  )}
                  {repurposed?.[activeRepurposeTab] && (
                    <div>
                      {/* ── Instagram ── */}
                      {activeRepurposeTab === "instagram" && (() => {
                        const ig = repurposed.instagram;
                        return (
                          <div className="space-y-3 text-xs">
                            <div className="grid grid-cols-2 gap-2">
                              {(ig.cards ?? []).map((card: any, i: number) => {
                                const cardKey = `instagram-card-${i}`;
                                const cardText = `${card.title}\n\n${card.body}`;
                                return (
                                  <div key={i} className="p-2 bg-white rounded border border-pink-200">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-[10px] font-bold text-pink-700">slide {card.slideNum ?? i + 1}</span>
                                      <button onClick={() => copyRepurpose(cardText, cardKey)} className="text-[10px] text-pink-600 hover:underline">
                                        {repurposeCopiedKey === cardKey ? "✓ 복사됨" : "복사"}
                                      </button>
                                    </div>
                                    <div className="font-bold text-ink-900 break-words">{card.title}</div>
                                    <div className="text-[11px] text-gray-700 mt-1 whitespace-pre-wrap break-words">{card.body}</div>
                                    {card.designNote && (
                                      <div className="text-[9px] text-gray-400 mt-1 italic">🎨 {card.designNote}</div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            {ig.caption && (
                              <div className="p-2 bg-white rounded border border-pink-200">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="font-bold text-ink-900">📝 캡션</div>
                                  <button onClick={() => copyRepurpose(ig.caption, "instagram-caption")} className="text-[10px] text-pink-600 hover:underline">
                                    {repurposeCopiedKey === "instagram-caption" ? "✓ 복사됨" : "복사"}
                                  </button>
                                </div>
                                <div className="whitespace-pre-wrap break-words text-gray-700">{ig.caption}</div>
                              </div>
                            )}
                            {ig.hashtags && (
                              <div className="p-2 bg-white rounded border border-pink-200">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="font-bold text-ink-900">#️⃣ 해시태그</div>
                                  <button onClick={() => copyRepurpose(Array.isArray(ig.hashtags) ? ig.hashtags.join(" ") : String(ig.hashtags), "instagram-hashtags")} className="text-[10px] text-pink-600 hover:underline">
                                    {repurposeCopiedKey === "instagram-hashtags" ? "✓ 복사됨" : "복사"}
                                  </button>
                                </div>
                                <div className="break-words text-pink-700">
                                  {Array.isArray(ig.hashtags) ? ig.hashtags.join(" ") : String(ig.hashtags)}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* ── YouTube ── */}
                      {activeRepurposeTab === "youtube" && (() => {
                        const yt = repurposed.youtube;
                        return (
                          <div className="space-y-3 text-xs">
                            {yt.title && (
                              <div className="p-2 bg-white rounded border border-pink-200">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="font-bold text-ink-900">🎬 제목</div>
                                  <button onClick={() => copyRepurpose(yt.title, "youtube-title")} className="text-[10px] text-pink-600 hover:underline">
                                    {repurposeCopiedKey === "youtube-title" ? "✓ 복사됨" : "복사"}
                                  </button>
                                </div>
                                <div className="text-sm font-bold text-ink-900 break-words">{yt.title}</div>
                              </div>
                            )}
                            {yt.script && (
                              <div className="p-2 bg-white rounded border border-pink-200">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="font-bold text-ink-900">📋 대본</div>
                                  <button onClick={() => copyRepurpose(yt.script, "youtube-script")} className="text-[10px] text-pink-600 hover:underline">
                                    {repurposeCopiedKey === "youtube-script" ? "✓ 복사됨" : "📋 대본 복사"}
                                  </button>
                                </div>
                                <div className="max-h-[200px] overflow-y-auto whitespace-pre-wrap break-words text-gray-700 text-[11px]">{yt.script}</div>
                              </div>
                            )}
                            {yt.thumbnailConcept && (
                              <div className="p-2 bg-gray-100 rounded">
                                <div className="font-bold text-ink-900 mb-1">🖼️ 썸네일 컨셉</div>
                                <div className="whitespace-pre-wrap break-words text-gray-700">{yt.thumbnailConcept}</div>
                              </div>
                            )}
                            {Array.isArray(yt.chapterMarkers) && yt.chapterMarkers.length > 0 && (
                              <div className="p-2 bg-white rounded border border-pink-200">
                                <div className="font-bold text-ink-900 mb-1">⏱️ 챕터 마커</div>
                                <div className="space-y-0.5">
                                  {yt.chapterMarkers.map((m: any, i: number) => (
                                    <div key={i} className="font-mono text-[11px]">
                                      <span className="text-pink-600">{m.time ?? m.timestamp ?? "00:00"}</span>
                                      <span className="text-gray-400"> → </span>
                                      <span className="text-gray-800">{m.label ?? m.title ?? ""}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {yt.description && (
                              <div className="p-2 bg-white rounded border border-pink-200">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="font-bold text-ink-900">📝 설명</div>
                                  <button onClick={() => copyRepurpose(yt.description, "youtube-desc")} className="text-[10px] text-pink-600 hover:underline">
                                    {repurposeCopiedKey === "youtube-desc" ? "✓ 복사됨" : "복사"}
                                  </button>
                                </div>
                                <div className="whitespace-pre-wrap break-words text-gray-700">{yt.description}</div>
                              </div>
                            )}
                            {yt.tags && (
                              <div className="p-2 bg-white rounded border border-pink-200">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="font-bold text-ink-900">🏷️ 태그</div>
                                  <button onClick={() => copyRepurpose(Array.isArray(yt.tags) ? yt.tags.join(", ") : String(yt.tags), "youtube-tags")} className="text-[10px] text-pink-600 hover:underline">
                                    {repurposeCopiedKey === "youtube-tags" ? "✓ 복사됨" : "복사"}
                                  </button>
                                </div>
                                <div className="break-words text-gray-700">
                                  {Array.isArray(yt.tags) ? yt.tags.join(", ") : String(yt.tags)}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* ── Blog ── */}
                      {activeRepurposeTab === "blog" && (() => {
                        const bl = repurposed.blog;
                        const posts = (bl.posts ?? []).slice().sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
                        return (
                          <div className="space-y-2 text-xs">
                            {bl.seriesTitle && (
                              <div className="p-2 bg-white rounded border border-pink-200">
                                <div className="text-[10px] text-gray-500">시리즈 제목</div>
                                <div className="font-bold text-ink-900 break-words">{bl.seriesTitle}</div>
                              </div>
                            )}
                            {posts.map((post: any, i: number) => {
                              const isOpen = expandedBlogPost === i;
                              const postKey = `blog-post-${i}`;
                              return (
                                <div key={i} className="bg-white rounded border border-pink-200">
                                  <button
                                    onClick={() => setExpandedBlogPost(isOpen ? null : i)}
                                    className="w-full p-2 text-left flex items-start justify-between gap-2"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <div className="text-[10px] text-pink-700 font-bold">Post {post.order ?? i + 1}</div>
                                      <div className="font-bold text-ink-900 break-words">{post.title}</div>
                                    </div>
                                    <span className="text-pink-600 shrink-0">{isOpen ? "▼" : "▶"}</span>
                                  </button>
                                  {isOpen && (
                                    <div className="px-2 pb-2 space-y-2">
                                      {post.excerpt && (
                                        <div className="text-[11px] italic text-gray-600 border-l-2 border-pink-300 pl-2">{post.excerpt}</div>
                                      )}
                                      {Array.isArray(post.tags) && post.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                          {post.tags.map((t: string, ti: number) => (
                                            <span key={ti} className="text-[10px] px-1.5 py-0.5 bg-pink-100 text-pink-800 rounded">#{t}</span>
                                          ))}
                                        </div>
                                      )}
                                      {post.body && (
                                        <div>
                                          <div className="flex items-center justify-between mb-1">
                                            <div className="text-[10px] font-bold text-ink-900">본문</div>
                                            <button onClick={() => copyRepurpose(post.body, postKey)} className="text-[10px] text-pink-600 hover:underline">
                                              {repurposeCopiedKey === postKey ? "✓ 복사됨" : "📋 본문 복사"}
                                            </button>
                                          </div>
                                          <div className="max-h-[240px] overflow-y-auto whitespace-pre-wrap break-words text-[11px] text-gray-700 bg-gray-50 p-2 rounded">{post.body}</div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}

                      {/* ── Email ── */}
                      {activeRepurposeTab === "email" && (() => {
                        const em = repurposed.email;
                        const series = (em.series ?? []).slice().sort((a: any, b: any) => (a.day ?? 0) - (b.day ?? 0));
                        return (
                          <div className="space-y-2 text-xs">
                            {series.map((mail: any, i: number) => {
                              const mailKey = `email-${i}`;
                              const fullText = `제목: ${mail.subject}\n프리헤더: ${mail.preheader}\n\n${mail.body}\n\nCTA: ${mail.cta}`;
                              return (
                                <div key={i} className="p-2 bg-white rounded border border-pink-200">
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="text-[10px] font-bold text-pink-700">Day {mail.day ?? i + 1}</div>
                                    <button onClick={() => copyRepurpose(fullText, mailKey)} className="text-[10px] text-pink-600 hover:underline">
                                      {repurposeCopiedKey === mailKey ? "✓ 복사됨" : "📋 복사"}
                                    </button>
                                  </div>
                                  {mail.subject && <div className="font-bold text-ink-900 break-words">{mail.subject}</div>}
                                  {mail.preheader && <div className="text-[10px] text-gray-500 italic break-words mt-0.5">{mail.preheader}</div>}
                                  {mail.body && <div className="text-[11px] text-gray-700 whitespace-pre-wrap break-words mt-2">{mail.body}</div>}
                                  {mail.cta && (
                                    <div className="mt-2 inline-block px-2 py-1 bg-pink-100 text-pink-800 rounded text-[11px] font-bold">{mail.cta}</div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}

                      {/* ── Kakao ── */}
                      {activeRepurposeTab === "kakao" && (() => {
                        const kk = repurposed.kakao;
                        const messages = (kk.messages ?? []).slice().sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
                        return (
                          <div className="space-y-2 text-xs">
                            {messages.map((msg: any, i: number) => {
                              const msgKey = `kakao-${i}`;
                              const fullText = `${msg.hook}\n\n${msg.body}\n\n${msg.cta}`;
                              return (
                                <div key={i} className="p-2 bg-white rounded border border-pink-200">
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="text-[10px] font-bold text-pink-700">메시지 {msg.order ?? i + 1}</div>
                                    <button onClick={() => copyRepurpose(fullText, msgKey)} className="text-[10px] text-pink-600 hover:underline">
                                      {repurposeCopiedKey === msgKey ? "✓ 복사됨" : "📋 복사"}
                                    </button>
                                  </div>
                                  {msg.hook && <div className="text-sm font-bold text-ink-900 break-words">{msg.hook}</div>}
                                  {msg.body && <div className="text-[11px] text-gray-700 whitespace-pre-wrap break-words mt-1">{msg.body}</div>}
                                  {msg.cta && (
                                    <div className="mt-2 inline-block px-2 py-1 bg-pink-100 text-pink-800 rounded text-[11px] font-bold">{msg.cta}</div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}

                      <button
                        onClick={() => generateRepurpose(activeRepurposeTab)}
                        className="mt-2 text-[10px] text-pink-600 hover:underline"
                      >
                        🔄 다시 생성
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <p className="text-xs font-bold text-gray-500 px-2 py-2 flex items-center justify-between">
              <span>목차 ({project.chapters.length})</span>
              <span className="lg:hidden text-[10px] font-mono text-gray-400">↕ 스크롤</span>
            </p>
            <div className="max-h-[40vh] lg:max-h-none overflow-y-auto -mx-1 px-1">
              {/* 모바일: 본문 빠르게 보이게 챕터 목록만 max-h. lg+에선 풀 표시 */}
            {project.chapters.map((c, i) => (
              <div
                key={i}
                draggable
                onDragStart={handleDragStart(i)}
                onDragOver={handleDragOver(i)}
                onDragLeave={() => setDragOverIdx(null)}
                onDragEnd={handleDragEnd}
                onDrop={handleDrop(i)}
                className={`relative group rounded-lg mb-1 transition ${
                  i === activeIdx ? "bg-tiger-orange text-white" : "hover:bg-gray-100"
                } ${dragIdx === i ? "opacity-40" : ""} ${
                  dragOverIdx === i ? "ring-2 ring-tiger-orange ring-offset-1" : ""
                }`}
              >
                <button onClick={() => {
                  if (editingContent !== null && i !== activeIdx && !confirm("편집 중인 내용이 있습니다. 저장 안 하고 다른 챕터로 이동할까요?")) return;
                  if (i !== activeIdx) setEditingContent(null);
                  setActiveIdx(i);
                }} className="w-full text-left px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs cursor-grab opacity-30 group-hover:opacity-70 transition ${i === activeIdx ? "text-white/70" : "text-gray-400"}`} title="드래그로 순서 변경">⋮⋮</span>
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
                {/* hover tooltip — 챕터 요약 */}
                {(c.subtitle || (c as any).summary) && (
                  <div className="absolute left-full ml-3 top-0 w-72 p-3.5 bg-ink-900 text-white text-xs rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-[60] hidden lg:block">
                    <div className="font-bold mb-1.5 text-tiger-orange text-[10px] uppercase tracking-wider">{i + 1}장 — {c.content ? "집필 완료" : "미집필"}</div>
                    {c.subtitle && <div className="text-white/80 italic mb-2 text-[11px]">{c.subtitle}</div>}
                    {(c as any).summary && (
                      <>
                        <div className="text-[10px] uppercase tracking-wider text-white/50 mb-1">요약</div>
                        <div className="text-white/90 leading-relaxed line-clamp-6">{(c as any).summary}</div>
                      </>
                    )}
                    {!c.content && !(c as any).summary && (
                      <div className="text-white/50 italic text-[11px]">아직 본문 작성 안 됨</div>
                    )}
                    {/* tooltip 화살표 */}
                    <div className="absolute -left-1.5 top-3 w-3 h-3 bg-ink-900 rotate-45" />
                  </div>
                )}
              </div>
            ))}
            </div>
            {/* + 챕터 추가 inline form */}
            {addChapterOpen ? (
              <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
                <input
                  type="text"
                  autoFocus
                  value={addChapterDraft.title}
                  onChange={e => setAddChapterDraft(d => ({ ...d, title: e.target.value }))}
                  onKeyDown={e => { if (e.key === "Enter" && addChapterDraft.title.trim()) submitAddChapter(); if (e.key === "Escape") { setAddChapterOpen(false); setAddChapterDraft({ title: "", subtitle: "" }); } }}
                  placeholder="챕터 제목 *"
                  maxLength={100}
                  className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded focus:border-tiger-orange focus:outline-none"
                />
                <input
                  type="text"
                  value={addChapterDraft.subtitle}
                  onChange={e => setAddChapterDraft(d => ({ ...d, subtitle: e.target.value }))}
                  onKeyDown={e => { if (e.key === "Enter" && addChapterDraft.title.trim()) submitAddChapter(); if (e.key === "Escape") { setAddChapterOpen(false); setAddChapterDraft({ title: "", subtitle: "" }); } }}
                  placeholder="부제 (선택)"
                  maxLength={150}
                  className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded focus:border-tiger-orange focus:outline-none"
                />
                <div className="flex gap-1">
                  <button
                    onClick={submitAddChapter}
                    disabled={!addChapterDraft.title.trim() || !!loading}
                    className="flex-1 px-2 py-1.5 bg-tiger-orange text-white rounded text-xs font-bold hover:bg-orange-600 transition disabled:opacity-50"
                  >
                    추가
                  </button>
                  <button
                    onClick={() => { setAddChapterOpen(false); setAddChapterDraft({ title: "", subtitle: "" }); }}
                    className="px-2 py-1.5 border border-gray-200 rounded text-xs hover:bg-white transition"
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddChapterOpen(true)}
                disabled={!!loading}
                className="mt-2 w-full px-2 py-1.5 border border-dashed border-gray-300 rounded-lg text-xs text-gray-500 hover:bg-[#fafafa] hover:border-tiger-orange hover:text-tiger-orange transition"
              >
                + 챕터 추가
              </button>
            )}
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
                  <>
                    <button
                      onClick={() => setEditChat({ chapterIdx: activeIdx, instruction: "", proposal: null, busy: false })}
                      disabled={!!loading}
                      className="text-xs px-3 py-1 bg-white border-2 border-tiger-orange text-tiger-orange rounded-lg hover:bg-orange-50 transition disabled:opacity-50 whitespace-nowrap font-bold"
                      title="자연어로 AI에게 수정 요청"
                    >
                      💬 AI 수정 요청
                    </button>
                    <button
                      onClick={() => setEditingContent(active.content)}
                      disabled={!!loading}
                      className="text-xs px-3 py-1 border border-gray-300 text-ink-900 rounded-lg hover:border-ink-900 transition disabled:opacity-50 whitespace-nowrap"
                    >
                      ✏️ 직접 수정
                    </button>
                  </>
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
                                <div className="flex gap-2 flex-wrap justify-end">
                                  <button onClick={() => generateChapterImage(activeIdx, ph)} disabled={!!imageGenBusy} className="text-xs text-tiger-orange hover:underline disabled:opacity-50">
                                    재생성
                                  </button>
                                  <label className="text-xs text-gray-600 hover:text-tiger-orange cursor-pointer">
                                    교체
                                    <input
                                      type="file" accept="image/*" className="hidden"
                                      onChange={e => e.target.files?.[0] && uploadImage(activeIdx, ph, e.target.files[0])}
                                    />
                                  </label>
                                  <button onClick={() => removeImage(activeIdx, ph)} className="text-xs text-gray-500 hover:text-orange-600">초기화</button>
                                  <button
                                    onClick={() => {
                                      if (confirm(`이 이미지 자리 자체를 본문에서 제거할까요? "${caption.slice(0, 30)}..."`)) {
                                        removeImagePlaceholder(activeIdx, ph);
                                      }
                                    }}
                                    className="text-xs text-red-600 hover:underline"
                                  >
                                    ✗ 자리 삭제
                                  </button>
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
                                <button
                                  onClick={() => {
                                    if (confirm(`이 이미지 자리 자체를 본문에서 제거할까요? "${caption.slice(0, 30)}..."`)) {
                                      removeImagePlaceholder(activeIdx, ph);
                                    }
                                  }}
                                  className="text-[10px] text-red-500 hover:underline"
                                >
                                  ✗ 자리 삭제
                                </button>
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
              <div className="text-center py-12 px-4">
                <div className="text-5xl mb-4">📝</div>
                <p className="text-gray-500 text-sm mb-6">{loading || "이 챕터는 아직 집필 전입니다"}</p>
                {!loading && (
                  <div className="flex flex-col sm:flex-row gap-2 justify-center max-w-md mx-auto">
                    <button
                      onClick={() => generateChapter(activeIdx)}
                      className="flex-1 px-4 py-3 bg-tiger-orange text-white rounded-lg font-bold text-sm hover:bg-orange-600 transition shadow-glow-orange-sm"
                    >
                      ✨ AI 자동 집필
                    </button>
                    <button
                      onClick={() => setContinueModal({ chapterIdx: activeIdx, seed: "" })}
                      className="flex-1 px-4 py-3 bg-white border-2 border-tiger-orange text-tiger-orange rounded-lg font-bold text-sm hover:bg-orange-50 transition"
                      title="첫 단락을 직접 쓰면 AI가 그 톤으로 이어 작성"
                    >
                      ✏️ 직접 시작 + AI 이어쓰기
                    </button>
                  </div>
                )}
                {!loading && (
                  <p className="text-xs text-gray-400 mt-4 max-w-md mx-auto leading-relaxed">
                    💡 <strong>이어쓰기</strong>는 첫 200~500자만 작가 본인이 쓰면 AI가 그 문체로 챕터 끝까지 완성. 100% AI 책보다 진정성 ↑
                  </p>
                )}
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

          {/* 표지 5장 후보 비교 */}
          <div className="mb-6 p-4 border border-tiger-orange/30 bg-orange-50/60 rounded-xl">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div>
                <h4 className="text-sm font-bold text-ink-900">✨ 표지 5장 후보 비교</h4>
                <p className="text-xs text-gray-600 mt-0.5">5가지 다른 표지 받고 마음에 드는 것 클릭 → 자동 적용</p>
              </div>
              <button
                onClick={generateCoverVariants}
                disabled={variantBusy}
                className="text-xs px-3 py-1.5 bg-tiger-orange text-white rounded-md font-bold hover:bg-orange-600 disabled:opacity-50 transition whitespace-nowrap"
              >
                {variantBusy ? `생성 중 ${coverVariants.length}/5...` : coverVariants.length > 0 ? "🔄 다시 5장" : "✨ 5장 후보 생성"}
              </button>
            </div>
            {coverVariants.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {coverVariants.map((b64, i) => {
                  if (b64) {
                    return (
                      <button
                        key={i}
                        onClick={() => selectCoverVariant(b64)}
                        className="aspect-[3/4] rounded-md overflow-hidden border-2 border-transparent hover:border-tiger-orange transition relative group"
                        title={`표지 후보 ${i + 1} — 클릭하여 선택`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`data:image/png;base64,${b64}`} alt={`variant ${i + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center">
                          <span className="text-white font-bold text-xs opacity-0 group-hover:opacity-100">✓ 이걸로</span>
                        </div>
                        <div className="absolute top-1 left-1 text-[9px] font-mono px-1 bg-white/90 text-tiger-orange rounded">{i + 1}</div>
                      </button>
                    );
                  }
                  // 아직 빈 슬롯 — 작업 중이면 pulse, 끝났으면 재시도 버튼
                  return variantBusy ? (
                    <div key={i} className="aspect-[3/4] rounded-md bg-gray-100 animate-pulse" />
                  ) : (
                    <button
                      key={i}
                      onClick={() => retrySingleVariant(i)}
                      className="aspect-[3/4] rounded-md bg-red-50 border-2 border-dashed border-red-300 hover:border-red-500 hover:bg-red-100 transition flex flex-col items-center justify-center text-red-500 text-[10px] font-bold gap-1 group"
                      title={`${i + 1}번 슬롯 재시도`}
                    >
                      <span className="text-xl">↻</span>
                      <span>{i + 1}번 재시도</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

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

          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold text-ink-900">마케팅 카피 (8종)</h3>
            <div className="flex items-center gap-3">
              <button
                onClick={async () => {
                  if (!projectId) return;
                  setKmongBusy("카피 재생성 중 (~10초)...");
                  setError(null);
                  try {
                    const res = await fetch("/api/generate/kmong-package", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ projectId, regenerateCopyOnly: true }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.message || `재생성 실패 (${res.status})`);
                    if (data.newBalance != null) setBalance(data.newBalance);
                    const fresh = await fetch(`/api/projects/${projectId}`).then(r => r.json());
                    setProject(fresh);
                  } catch (e: any) {
                    setError(e.message);
                  } finally {
                    setKmongBusy("");
                  }
                }}
                disabled={!!kmongBusy}
                className="text-[11px] px-2 py-1 bg-tiger-orange text-white rounded font-bold hover:bg-orange-600 transition disabled:opacity-50"
              >
                🔄 카피 재생성
              </button>
              <span className="text-xs text-gray-400">← 옆으로 스와이프 →</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-3">크몽 등록 + SNS + 콘텐츠 마케팅 채널별 카피. 카드 안 [복사] 버튼으로 즉시 복사.</p>
          <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-3 -mx-2 px-2 scroll-smooth">
            {([
              ["크몽 상세", "📋", (project as any).kmongPackage.copy.kmongDescription, "300~500자 · 판매 페이지 메인"],
              ["강조 포인트 5", "✨", ((project as any).kmongPackage.copy.kmongHighlights ?? []).map((h: string, i: number) => `${i + 1}. ${h}`).join("\n"), "각 30~50자 · bullet 5개"],
              ["인스타", "📷", (project as any).kmongPackage.copy.instagram, "200~400자 · 해시태그 포함"],
              ["카톡", "💬", (project as any).kmongPackage.copy.kakao, "50~80자 · 친구 1:1"],
              ["트위터/X", "🐦", (project as any).kmongPackage.copy.twitter, "280자 이내 · 짧은 후크"],
              ["블로그 후기", "📝", (project as any).kmongPackage.copy.blogReview, "500~800자 · 솔직 후기 톤"],
              ["유튜브 설명", "▶️", (project as any).kmongPackage.copy.youtubeDescription, "300~500자 · 타임스탬프"],
              ["네이버 카페", "🍃", (project as any).kmongPackage.copy.naverCafe, "200~300자 · 정보 공유 톤"],
            ] as const).map(([label, emoji, text, hint]) => (
              <div
                key={label}
                className="flex-shrink-0 w-[300px] md:w-[340px] snap-start border border-gray-200 rounded-xl bg-white flex flex-col"
                style={{ maxHeight: 440 }}
              >
                <div className="flex items-center justify-between p-3 border-b border-gray-100 sticky top-0 bg-white rounded-t-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{emoji}</span>
                    <div>
                      <div className="text-xs font-bold text-ink-900">{label}</div>
                      <div className="text-[10px] text-gray-400">{hint}</div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      navigator.clipboard.writeText(text || "");
                      const btn = e.currentTarget;
                      const orig = btn.textContent;
                      btn.textContent = "✓";
                      setTimeout(() => { btn.textContent = orig; }, 1200);
                    }}
                    className="text-[11px] px-2 py-1 bg-tiger-orange text-white rounded-md font-bold hover:bg-orange-600 transition"
                  >
                    복사
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                  <pre className="text-xs whitespace-pre-wrap break-keep text-gray-700 font-sans leading-relaxed">{text || "(비어있음 — 카피 재생성 필요)"}</pre>
                </div>
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

    {/* AI 글쓰기 챗 — 챕터 본문에 자연어 수정 요청 */}
    {editChat && (
      <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4" onClick={() => !editChat.busy && setEditChat(null)}>
        <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-xl font-black tracking-tight text-ink-900">💬 AI 수정 요청</h3>
              <p className="text-xs text-gray-500 mt-1">{editChat.chapterIdx + 1}장 — {project.chapters[editChat.chapterIdx]?.title}</p>
            </div>
            {!editChat.busy && <button onClick={() => setEditChat(null)} className="text-2xl text-gray-400 hover:text-ink-900">×</button>}
          </div>

          {/* 입력 */}
          <div className="mb-4">
            <label className="text-xs font-bold text-ink-900 mb-1 block">자연어로 수정 요청</label>
            <textarea
              value={editChat.instruction}
              onChange={e => setEditChat(c => c ? { ...c, instruction: e.target.value } : c)}
              disabled={editChat.busy}
              rows={3}
              placeholder="예시:&#10;• '결말이 약해. 다음 장으로 자연스럽게 연결되는 강한 마무리 문단 추가'&#10;• '두 번째 소제목 부분을 더 짧고 강하게'&#10;• '전체적으로 더 친근한 형/누나 톤으로 다시'&#10;• '구체적 숫자·예시 더 추가. 추상적 표현 줄임'"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-tiger-orange focus:outline-none resize-none disabled:bg-gray-50"
            />
            <div className="flex justify-between text-xs mt-1">
              <span className="text-gray-400">{editChat.instruction.length}/500자</span>
              <button
                onClick={askChapterEdit}
                disabled={editChat.busy || editChat.instruction.trim().length < 5 || editChat.instruction.length > 500}
                className="px-4 py-1.5 bg-tiger-orange text-white rounded-lg text-xs font-bold hover:bg-orange-600 disabled:opacity-50"
              >
                {editChat.busy ? "AI 작업 중..." : "✨ 수정안 요청"}
              </button>
            </div>
          </div>

          {/* 진행 중 */}
          {editChat.busy && !editChat.proposal && (
            <div className="p-4 bg-orange-50 border border-tiger-orange/30 rounded-lg text-sm text-ink-900 mb-4">
              ⏳ AI가 챕터 분석 + 새 본문 작성 중... (10~30초)
            </div>
          )}

          {/* 제안 */}
          {editChat.proposal && (
            <div className="border border-tiger-orange/40 rounded-xl p-4 bg-orange-50/40 mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-tiger-orange">📄 AI 수정안 ({editChat.proposal.length.toLocaleString()}자)</span>
                <span className="text-[10px] text-gray-500">아래 [✓ 적용] 시 챕터 본문 교체</span>
              </div>
              <div className="max-h-80 overflow-y-auto p-3 bg-white rounded border border-gray-200 text-sm whitespace-pre-wrap break-keep leading-relaxed">
                {editChat.proposal}
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setEditChat(c => c ? { ...c, proposal: null, instruction: c.instruction } : c)}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-bold hover:bg-gray-50"
                >
                  ↻ 다시 (새 요청)
                </button>
                <button
                  onClick={applyChapterEdit}
                  className="flex-1 py-2 bg-tiger-orange text-white rounded-lg text-sm font-bold hover:bg-orange-600"
                >
                  ✓ 챕터 본문에 적용
                </button>
              </div>
            </div>
          )}

          {/* 참고: 원본 보기 */}
          <details className="text-xs text-gray-500">
            <summary className="cursor-pointer hover:text-ink-900">📜 원본 본문 보기</summary>
            <div className="mt-2 max-h-60 overflow-y-auto p-3 bg-gray-50 rounded text-xs whitespace-pre-wrap break-keep leading-relaxed">
              {project.chapters[editChat.chapterIdx]?.content}
            </div>
          </details>
        </div>
      </div>
    )}

    {/* 챕터 이어쓰기 모달 — 작가가 첫 단락 입력 → AI가 같은 톤으로 이어 */}
    {continueModal && (
      <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4" onClick={() => !continueBusy && setContinueModal(null)}>
        <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-xl font-black tracking-tight text-ink-900">✏️ 직접 시작 + AI 이어쓰기</h3>
              <p className="text-xs text-gray-500 mt-1">{continueModal.chapterIdx + 1}장 — {project.chapters[continueModal.chapterIdx]?.title}</p>
            </div>
            {!continueBusy && (
              <button onClick={() => setContinueModal(null)} className="text-2xl text-gray-400 hover:text-ink-900">×</button>
            )}
          </div>
          <p className="text-sm text-gray-700 mb-4 leading-relaxed">
            챕터의 <strong>첫 단락 (200~500자 권장)</strong>을 직접 써보세요.<br />
            AI가 그 톤·문체·1인칭/3인칭을 그대로 유지하며 챕터를 끝까지 이어 작성합니다.
          </p>
          <textarea
            value={continueModal.seed}
            onChange={e => setContinueModal(m => m ? { ...m, seed: e.target.value } : m)}
            disabled={continueBusy}
            rows={10}
            placeholder={`예시:\n\n월요일 오전 9시, 출근하자마자 가장 먼저 하는 일은 어제의 매출 데이터를 확인하는 것입니다. 엑셀 파일을 열어 거래처별로 정리하고, 입금된 금액과 미수금을 분리합니다. 이 작업이 끝나야 비로소 그날 해야 할 일들이 명확해집니다.\n\n그런데 이 30분 남짓의 시간이, 사실 자동화 한 번이면 사라질 일이라는 걸 깨달은 건 입사 3년 차 때였습니다.`}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:border-tiger-orange focus:outline-none resize-none font-sans leading-relaxed disabled:bg-gray-50"
            style={{ wordBreak: "keep-all" }}
          />
          <div className="flex items-center justify-between mt-2 mb-4 text-xs text-gray-500">
            <span>{continueModal.seed.length}자</span>
            <span>
              {continueModal.seed.length < 50 && <span className="text-red-500">최소 50자 필요</span>}
              {continueModal.seed.length >= 50 && continueModal.seed.length < 200 && <span className="text-amber-600">200자+ 권장 (AI 톤 학습 정확도 ↑)</span>}
              {continueModal.seed.length >= 200 && continueModal.seed.length <= 3000 && <span className="text-green-600">✓ 좋아요</span>}
              {continueModal.seed.length > 3000 && <span className="text-red-500">최대 3000자</span>}
            </span>
          </div>
          {continueBusy && (
            <div className="mb-4 p-3 bg-orange-50 border border-tiger-orange/30 rounded-lg text-sm text-ink-900">
              ⏳ AI가 작가님 톤을 분석하고 이어 작성 중... (30~60초)
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => !continueBusy && setContinueModal(null)}
              disabled={continueBusy}
              className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
            >
              취소
            </button>
            <button
              onClick={() => continueChapterAI(continueModal.chapterIdx, continueModal.seed)}
              disabled={continueBusy || continueModal.seed.trim().length < 50 || continueModal.seed.length > 3000}
              className="flex-1 py-2.5 bg-tiger-orange text-white rounded-lg text-sm font-bold hover:bg-orange-600 transition disabled:opacity-50"
            >
              {continueBusy ? "이어 작성 중..." : "✨ AI 이어쓰기 시작"}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ConfirmModal — native confirm() 대체 (모바일 안정성) */}
    {confirmModal && (
      <div
        className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4"
        onClick={() => setConfirmModal(null)}
      >
        <div
          className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          onClick={e => e.stopPropagation()}
        >
          <h3 className="text-xl font-black tracking-tight text-ink-900 mb-3">{confirmModal.title}</h3>
          <p className="text-sm text-gray-700 whitespace-pre-line mb-6 leading-relaxed">{confirmModal.message}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmModal(null)}
              className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 transition"
            >
              {confirmModal.cancelLabel ?? "취소"}
            </button>
            <button
              onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold text-white transition ${
                confirmModal.variant === "danger" ? "bg-red-600 hover:bg-red-700"
                : confirmModal.variant === "warn" ? "bg-amber-500 hover:bg-amber-600"
                : "bg-tiger-orange hover:bg-orange-600"
              }`}
            >
              {confirmModal.confirmLabel ?? "확인"}
            </button>
          </div>
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

interface ShareLinks {
  kmong?: string;
  ridi?: string;
  kyobo?: string;
  custom?: { label: string; url: string }[];
}

function ShareToggle({
  projectId, enabled, shareLinks, onChange,
}: {
  projectId: string;
  enabled: boolean;
  shareLinks: ShareLinks;
  onChange: (patch: { shareEnabled?: boolean; shareLinks?: ShareLinks }) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [showLinks, setShowLinks] = useState(false);
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/share/${projectId}` : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const updateLink = (key: "kmong" | "ridi" | "kyobo", value: string) => {
    onChange({ shareLinks: { ...shareLinks, [key]: value.trim() || undefined } });
  };

  const linkCount =
    (shareLinks.kmong ? 1 : 0) +
    (shareLinks.ridi ? 1 : 0) +
    (shareLinks.kyobo ? 1 : 0) +
    (shareLinks.custom?.length ?? 0);

  return (
    <div>
      <label className="flex items-center justify-between gap-2 px-2 py-1.5 cursor-pointer text-xs">
        <span className="font-bold text-ink-900">🔗 공유 링크 활성</span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={e => onChange({ shareEnabled: e.target.checked })}
          className="w-4 h-4 accent-tiger-orange"
        />
      </label>
      {enabled && (
        <div className="px-2 pb-2">
          <div className="flex gap-1">
            <input
              type="text"
              readOnly
              value={shareUrl}
              onClick={e => (e.target as HTMLInputElement).select()}
              className="flex-1 text-[10px] font-mono px-2 py-1 bg-gray-50 border border-gray-200 rounded text-ink-900 truncate"
            />
            <button
              onClick={copy}
              className="px-2 py-1 bg-tiger-orange text-white text-[10px] font-bold rounded hover:bg-orange-600 whitespace-nowrap"
            >
              {copied ? "✓" : "복사"}
            </button>
          </div>
          <button
            onClick={() => setShowLinks(s => !s)}
            className="mt-2 w-full text-[10px] text-tiger-orange hover:underline text-left"
          >
            🛒 구매 링크 {linkCount > 0 ? `(${linkCount})` : "추가"} {showLinks ? "▲" : "▼"}
          </button>
          {showLinks && (
            <div className="mt-1.5 space-y-1.5 pl-2 border-l-2 border-tiger-orange/20">
              <LinkField label="크몽" value={shareLinks.kmong ?? ""} onSave={v => updateLink("kmong", v)} placeholder="https://kmong.com/gig/..." />
              <LinkField label="리디" value={shareLinks.ridi ?? ""} onSave={v => updateLink("ridi", v)} placeholder="https://ridibooks.com/..." />
              <LinkField label="교보" value={shareLinks.kyobo ?? ""} onSave={v => updateLink("kyobo", v)} placeholder="https://kyobobook.co.kr/..." />
              <p className="text-[9px] text-gray-400 leading-tight pt-1">공유 페이지 마지막에 [구매] 버튼으로 노출됩니다.</p>
            </div>
          )}
          <p className="text-[10px] text-gray-500 mt-2 leading-tight">로그인 없이 누구나 책 읽을 수 있음. SNS·블로그 공유 OK.</p>
        </div>
      )}
    </div>
  );
}

function LinkField({ label, value, onSave, placeholder }: { label: string; value: string; onSave: (v: string) => void; placeholder: string }) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  // 외부에서 value 바뀌면 sync
  useEffect(() => { setDraft(value); }, [value]);

  return (
    <div className="flex items-center gap-1">
      <span className="w-8 text-[10px] font-bold text-gray-600">{label}</span>
      <input
        type="url"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== value) {
            setSaving(true);
            onSave(draft);
            setTimeout(() => setSaving(false), 600);
          }
        }}
        placeholder={placeholder}
        className="flex-1 text-[10px] px-2 py-1 bg-white border border-gray-200 rounded focus:border-tiger-orange focus:outline-none truncate"
      />
      {saving && <span className="text-[9px] text-tiger-orange">✓</span>}
    </div>
  );
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

// ─────────────────────────────────────────────────────────
// 📦 크몽 등록 가이드 — 정적 추천 (카테고리/가격/제목/설명/키워드)
// AI 호출 없음. 책 type / topic / targetPages / 기존 카피 활용.
// ─────────────────────────────────────────────────────────

const KMONG_CATEGORIES: Record<string, string> = {
  "자기계발서": "취업·이직 > 자기계발 / 동기부여",
  "재테크": "비즈니스 코칭 > 재테크·자산관리",
  "에세이": "전자책·소책자 > 에세이",
  "실용서": "비즈니스 코칭 > 실용·노하우",
  "매뉴얼": "비즈니스 코칭 > 매뉴얼·가이드",
  "웹소설": "전자책·소책자 > 소설·시",
  "전문서": "비즈니스 코칭 > 전문 분야",
};

function suggestKmongPriceKRW(targetPages: number): number {
  if (!targetPages || targetPages < 50) return 3000;
  if (targetPages < 100) return 5000;
  if (targetPages < 200) return 10000;
  return 15000;
}

function suggestKmongKeywords(project: any): string[] {
  const fromCopy: string[] = Array.isArray(project?.kmongPackage?.copy?.kmongHighlights)
    ? project.kmongPackage.copy.kmongHighlights.slice(0, 5).map((s: string) => String(s).trim()).filter(Boolean)
    : [];
  if (fromCopy.length > 0) return fromCopy;
  // fallback — 챕터 제목 첫 5개에서 추출
  const fromChapters = (project?.chapters ?? [])
    .slice(0, 5)
    .map((c: any) => String(c?.title ?? "").trim())
    .filter(Boolean);
  return fromChapters.length > 0 ? fromChapters : [project?.topic ?? "전자책"];
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        navigator.clipboard.writeText(text || "").then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }).catch(() => {});
      }}
      className="text-[10px] px-1.5 py-0.5 border border-gray-200 rounded hover:bg-white transition shrink-0"
      title="복사"
    >
      {copied ? "✓" : "📋 복사"}
    </button>
  );
}

function KmongGuideBox({ project }: { project: any }) {
  const [open, setOpen] = useState(false);

  const type = project?.type ?? "";
  const category = KMONG_CATEGORIES[type] ?? "전자책·소책자 > 기타";
  const targetPages = Number(project?.targetPages ?? 0);
  const price = suggestKmongPriceKRW(targetPages);
  const title =
    project?.marketingMeta?.tagline ||
    project?.kmongPackage?.copy?.kmongTitle ||
    project?.topic ||
    "(제목 미지정)";
  const description =
    project?.kmongPackage?.copy?.kmongDescription ||
    project?.marketingMeta?.description ||
    "(상세 설명 미작성 — '🤖 AI가 마케팅 카피 생성' 또는 '📦 크몽 패키지 생성' 후 자동 채워집니다.)";
  const keywords = suggestKmongKeywords(project);

  return (
    <div className="mt-2 p-2 bg-yellow-50/60 border border-yellow-300/60 rounded-lg">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between text-left"
      >
        <span className="text-xs font-bold text-ink-900">📦 크몽 등록 가이드</span>
        <span className="text-[10px] text-gray-500">{open ? "접기 ▲" : "펼치기 ▼"}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2 text-[11px]">
          <div className="flex items-start gap-2">
            <div className="w-16 shrink-0 text-gray-500 font-bold">카테고리</div>
            <div className="flex-1 break-keep text-ink-900">{category}</div>
            <CopyButton text={category} />
          </div>
          <div className="flex items-start gap-2">
            <div className="w-16 shrink-0 text-gray-500 font-bold">추천가</div>
            <div className="flex-1 text-ink-900">
              ₩{price.toLocaleString()}
              <span className="ml-1 text-[10px] text-gray-500">({targetPages || "?"}쪽 기준)</span>
            </div>
            <CopyButton text={String(price)} />
          </div>
          <div className="flex items-start gap-2">
            <div className="w-16 shrink-0 text-gray-500 font-bold">제목</div>
            <div className="flex-1 break-keep text-ink-900 line-clamp-3">{title}</div>
            <CopyButton text={title} />
          </div>
          <div className="flex items-start gap-2">
            <div className="w-16 shrink-0 text-gray-500 font-bold">상세</div>
            <div className="flex-1 break-keep text-ink-900 line-clamp-4 whitespace-pre-wrap">{description}</div>
            <CopyButton text={description} />
          </div>
          <div className="flex items-start gap-2">
            <div className="w-16 shrink-0 text-gray-500 font-bold">키워드</div>
            <div className="flex-1 flex flex-wrap gap-1">
              {keywords.map((k, i) => (
                <span key={i} className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px] text-ink-900">{k}</span>
              ))}
            </div>
            <CopyButton text={keywords.join(", ")} />
          </div>
          <div className="pt-1">
            <a
              href="https://kmong.com/register/service"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block w-full text-center px-2 py-1.5 bg-yellow-500 text-white rounded text-[11px] font-bold hover:bg-yellow-600 transition"
            >
              🔗 크몽에 새 서비스 등록
            </a>
          </div>
          <p className="text-[10px] text-gray-500 leading-relaxed pt-1">
            추천값은 정적 매핑입니다. 크몽 화면의 실제 카테고리·정책에 맞춰 수정해 사용하세요.
          </p>
        </div>
      )}
    </div>
  );
}
