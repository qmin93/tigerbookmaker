"use client";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/Header";
import { ImageRefineButton } from "@/components/ImageRefineButton";
import { TemplateSelector } from "@/components/TemplateSelector";
import { TemplatePreviewModal } from "@/components/TemplatePreviewModal";
import type { TemplateKey } from "@/lib/templates";
import type { MetaAdImage } from "@/lib/storage";
import { RepurposeBox } from "./_components/sections/RepurposeBox";
import { MetaAdsBox } from "./_components/sections/MetaAdsBox";
import { MarketingPageBox } from "./_components/sections/MarketingPageBox";
import { CoverVariationsBox } from "./_components/sections/CoverVariationsBox";
import { useTabState } from "./_hooks/useTabState";
import { usePublishHint } from "./_hooks/usePublishHint";
import { TopHeader } from "./_components/TopHeader";
import { calculateProgress } from "@/lib/export-bundle";
import { useNotify } from "@/lib/ui/notify";
import { WritePageLayout } from "./_components/WritePageLayout";
import { MobileBottomNav } from "./_components/MobileBottomNav";
import { ChapterList as ChapterListNew } from "./_components/ChapterList";
import { ChapterContent as ChapterContentNew } from "./_components/ChapterContent";
import { WritingTab } from "./_components/tabs/WritingTab";
import { PublishTab } from "./_components/tabs/PublishTab";
import { ExtrasTab } from "./_components/tabs/ExtrasTab";
import { OpsTab } from "./_components/tabs/OpsTab";
// v3 Phase 2 — 챕터 품질·재생성 + 책 통과 가능성
import { QualityScore, type QualityScoreData } from "@/components/write/QualityScore";
import { ChapterRegenerateButton } from "@/components/write/ChapterRegenerateButton";
import { BookQualityBadge } from "@/components/write/BookQualityBadge";
// v3 Phase 4.2 — 완성 축하 피드 (사회적 증거)
import { CompletionFeed } from "@/components/write/CompletionFeed";

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
  { id: "gemini-flash-latest", label: "Flash · 책 1권 ~₩4,000 (권장, 안정)" },
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
  instagram: "~₩500", youtube: "~₩500", blog: "~₩1,500", email: "~₩1,000", kakao: "~₩300",
};

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const projectId = params.get("id");
  const notify = useNotify();
  // 잔액 부족 시 충전 페이지 이동 confirm — 자주 쓰여서 helper로
  const askTopUp = async (shortfallKRW?: number) => {
    const ok = await notify.confirm({
      title: "잔액 부족",
      emoji: "💳",
      message: shortfallKRW
        ? `${shortfallKRW.toLocaleString()}원 더 필요해요. 충전 페이지로 이동할까요?`
        : "잔액이 부족해요. 충전 페이지로 이동할까요?",
      confirmLabel: "충전하러 가기",
      cancelLabel: "나중에",
      variant: "warn",
    });
    if (ok) router.push("/billing");
    return ok;
  };
  // 단계 완료 toast — 다음 단계 안내 포함
  const toastStepDone = (justDoneLabel: string, nextStepHint?: { label: string; tab: string }) => {
    notify.success({
      title: `✓ ${justDoneLabel} 완성!`,
      message: nextStepHint ? `잘 됐어요. 이어서 ${nextStepHint.label} 만들어 보세요.` : "잘 됐어요.",
      nextStepLabel: nextStepHint ? `${nextStepHint.label} 만들러 가기` : undefined,
      onNextStep: nextStepHint ? () => setTab(nextStepHint.tab as any) : undefined,
      durationMs: 6000,
    });
  };

  // ─── 4-tab 레이아웃 hooks (early return 전 호출 — Rules of Hooks) ───
  const { tab, setTab } = useTabState();

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
  // v3 Phase 1.3 — 백그라운드 본문 생성 큐 상태
  const [queueJob, setQueueJob] = useState<null | {
    jobId: string;
    status: string;
    currentChapterIdx: number;
    totalChapters: number;
    etaMinutes: number | null;
    errorMessage: string | null;
  }>(null);
  const [queueBusy, setQueueBusy] = useState(false);
  const [editingContent, setEditingContent] = useState<string | null>(null);
  const editingTextareaRef = useRef<HTMLTextAreaElement | null>(null);
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
  // Wave: 표지 다양화 — 3종 다른 스타일 (Minimalist / Bold / Photorealistic) 자동 생성.
  // /api/generate/cover-variations 사용. 같은 책+같은 themeColor + 다른 컴포지션.
  const [coverVariations, setCoverVariations] = useState<Array<{ idx: number; style: string; base64: string; vendor: string }>>([]);
  const [coverVariationsBusy, setCoverVariationsBusy] = useState(false);
  const [coverVariationsCount, setCoverVariationsCount] = useState<3 | 5>(3);
  const [continueModal, setContinueModal] = useState<{ chapterIdx: number; seed: string } | null>(null);
  const [continueBusy, setContinueBusy] = useState(false);
  const [editChat, setEditChat] = useState<{
    chapterIdx: number;
    instruction: string;
    proposal: string | null;
    busy: boolean;
  } | null>(null);
  const [previewModal, setPreviewModal] = useState<{ chapterIdx: number } | null>(null);
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
  // marketingEditOpen / marketingForm / copyConfirm — UI-only, MarketingPageBox로 이동됨

  // ─── Meta(FB/IG) 광고 패키지 (Sub-project 5) ───
  const [metaAdPackage, setMetaAdPackage] = useState<any>(null);
  const [metaAdBusy, setMetaAdBusy] = useState(false);
  // metaCopiedIdx — UI-only, MetaAdsBox로 이동됨

  // ─── Meta 광고 이미지 (Part A — 3 비율) ───
  const [metaAdImages, setMetaAdImages] = useState<MetaAdImage[]>([]);
  const [metaImgBusy, setMetaImgBusy] = useState(false);
  // Wave 3: Sharp overlay 템플릿
  const [imageTemplate, setImageTemplate] = useState<"minimal" | "bold" | "story" | "quote" | "cta">("bold");
  // 1-click — 카피 + 이미지 한 번에 (0=idle, 1=copy 단계, 2=image 단계)
  const [metaAllInOneBusy, setMetaAllInOneBusy] = useState<0 | 1 | 2>(0);

  // ─── 콘텐츠 재가공 (Wave 1: 5채널) ───
  // 데이터/생성 상태만 page.tsx 보존 — Bundle/funnel/sync에서 참조.
  // UI 상태(active tab, 복사 표시, 블로그 펼침)는 RepurposeBox 내부.
  const [repurposed, setRepurposed] = useState<any>(null);
  const [repurposeBusy, setRepurposeBusy] = useState<RepurposeChannel | null>(null);

  // ─── 패키지 funnel + 1-click bundle (Wave B1) ───
  type BundleLevel = "publish" | "growth" | "full";
  const [bundleBusy, setBundleBusy] = useState<BundleLevel | null>(null);
  const [bundleProgress, setBundleProgress] = useState<{ step: number; total: number; label: string } | null>(null);

  // ─── 카드뉴스 인포그래픽 (Wave B3) ───
  const [infographic, setInfographic] = useState<{ template: string; slides: { slideNum: number; base64: string }[]; generatedAt: number } | null>(null);
  const [infographicBusy, setInfographicBusy] = useState(false);
  const [infographicTemplate, setInfographicTemplate] = useState<"minimal" | "bold" | "dark">("bold");

  // ─── ⚖️ A/B 테스트 (Wave B5) — 마케팅 페이지 variant ───
  const [abTestForm, setAbTestForm] = useState<{
    taglineA?: string;
    taglineB?: string;
    descriptionA?: string;
    descriptionB?: string;
    enabled?: boolean;
  }>({});
  const [abTestBusy, setAbTestBusy] = useState(false);
  const [abTestSaved, setAbTestSaved] = useState(false);
  const [abTestStats, setAbTestStats] = useState<Record<"A" | "B", { views24h: number; views7d: number; viewsTotal: number }> | null>(null);
  const [abTestStatsBusy, setAbTestStatsBusy] = useState(false);

  // ─── 🎬 미리보기 영상 frames (Wave B6) — 9:16 PNG 5장 ───
  const [previewVideo, setPreviewVideo] = useState<{
    frames: { idx: number; template: string; base64: string }[];
    generatedAt: number;
  } | null>(null);
  const [previewVideoBusy, setPreviewVideoBusy] = useState(false);

  // ─── 📻 오디오북 (TTS, Gemini) ───
  // 책 본문 → 한국어 TTS로 챕터별 WAV → 오디오북.
  // Vercel 60s timeout 때문에 프론트가 chapterIdx 지정해 한 챕터씩 순차 호출.
  type AudiobookChapterUI = {
    chapterIdx: number;
    title: string;
    wavBase64: string;
    durationMs: number;
    voiceName: string;
  };
  const [audiobook, setAudiobook] = useState<{
    chapters: AudiobookChapterUI[];
    voiceName: string;
    generatedAt: number;
  } | null>(null);
  const [audiobookBusy, setAudiobookBusy] = useState(false);
  const [audiobookProgress, setAudiobookProgress] = useState<string | null>(null);

  // ─── 강의 슬라이드 (책 → 10~20장 강사·코치용) ───
  type CourseSlideUI = {
    slideNum: number;
    title: string;
    bullets: string[];
    notes?: string;
    pngBase64?: string;
  };
  const [courseSlides, setCourseSlides] = useState<{
    template: "minimal" | "bold" | "academic";
    slides: CourseSlideUI[];
    generatedAt: number;
  } | null>(null);
  const [courseSlidesBusy, setCourseSlidesBusy] = useState(false);
  const [courseSlideCount, setCourseSlideCount] = useState<8 | 12 | 16 | 20>(12);
  const [courseSlideTemplate, setCourseSlideTemplate] = useState<"minimal" | "bold" | "academic">("minimal");
  const [courseSlideRender, setCourseSlideRender] = useState(false);

  // ─── 🌐 책 번역 (Wave C2) — 한국어 → 영어/일본어 ───
  type TranslationLang = "en" | "ja";
  type TranslationData = {
    language: TranslationLang;
    topic: string;
    audience: string;
    chapters: Array<{ title: string; subtitle?: string; content: string }>;
    generatedAt: number;
  };
  const [translations, setTranslations] = useState<TranslationData[]>([]);
  const [translateLang, setTranslateLang] = useState<TranslationLang>("en");
  const [translateBusy, setTranslateBusy] = useState(false);
  const [translateMsg, setTranslateMsg] = useState<string | null>(null);
  const [translatePreviewLang, setTranslatePreviewLang] = useState<TranslationLang | null>(null);

  // ─── 책별 매출 입력 ("이정도 번다") ───
  // 사용자가 채널별 누적 매출 직접 입력 → /profile에서 비용 vs 매출 ROI 계산.
  type RevenueChannelInput = { channel: string; label?: string; grossKRW: number; feeRate: number };
  const [revenueChannels, setRevenueChannels] = useState<RevenueChannelInput[]>([
    { channel: "kmong", grossKRW: 0, feeRate: 0.20 },
    { channel: "ridi", grossKRW: 0, feeRate: 0.30 },
    { channel: "kyobo", grossKRW: 0, feeRate: 0.30 },
    { channel: "aladdin", grossKRW: 0, feeRate: 0.30 },
    { channel: "direct", grossKRW: 0, feeRate: 0 },
  ]);
  const [revenueBusy, setRevenueBusy] = useState(false);
  const [revenueSavedFlash, setRevenueSavedFlash] = useState(false);

  // ─── 챕터별 사용된 chunks (투명성) ───
  // 챕터 본문 생성 시 사용된 chunks를 저장하지 않으므로, 챕터 title을 query로 ragSearch 다시 실행 → 근사치.
  type ChapterChunk = { filename: string; chunkIdx: number; content: string; distance: number };
  const [chunkUsageOpen, setChunkUsageOpen] = useState<number | null>(null);
  const [chunkUsageData, setChunkUsageData] = useState<Record<number, ChapterChunk[]>>({});
  const [chunkUsageBusy, setChunkUsageBusy] = useState<number | null>(null);

  const loadChunkUsage = async (chapterIdx: number) => {
    if (chunkUsageOpen === chapterIdx) {
      setChunkUsageOpen(null);
      return;
    }
    if (chunkUsageData[chapterIdx]) {
      setChunkUsageOpen(chapterIdx);
      return;
    }
    setChunkUsageBusy(chapterIdx);
    try {
      const res = await fetch(`/api/chapter/${chapterIdx}/chunks?projectId=${projectId}`);
      if (res.ok) {
        const d = await res.json();
        setChunkUsageData(prev => ({ ...prev, [chapterIdx]: d.chunks || [] }));
        setChunkUsageOpen(chapterIdx);
      }
    } catch (e) {
      console.error("loadChunkUsage failed", e);
    } finally {
      setChunkUsageBusy(null);
    }
  };

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

  // infographic sync (Wave B3)
  useEffect(() => {
    if ((project as any)?.infographic) setInfographic((project as any).infographic);
  }, [project]);

  // abTest sync (Wave B5) — 폼에 기존 값 채우고, 활성화돼있으면 stats fetch
  useEffect(() => {
    const ab = (project as any)?.abTest;
    if (ab) {
      setAbTestForm({
        taglineA: ab.taglineA ?? "",
        taglineB: ab.taglineB ?? "",
        descriptionA: ab.descriptionA ?? "",
        descriptionB: ab.descriptionB ?? "",
        enabled: ab.enabled === true,
      });
    }
  }, [project]);

  // previewVideo sync (Wave B6)
  useEffect(() => {
    if ((project as any)?.previewVideo) setPreviewVideo((project as any).previewVideo);
  }, [project]);

  // audiobook sync — project이 로드/갱신될 때 동기화
  useEffect(() => {
    if ((project as any)?.audiobook) setAudiobook((project as any).audiobook);
  }, [project]);

  // courseSlides sync — 강의 슬라이드
  useEffect(() => {
    if ((project as any)?.courseSlides) setCourseSlides((project as any).courseSlides);
  }, [project]);

  // translations sync — Wave C2
  useEffect(() => {
    const tr = (project as any)?.translations;
    if (Array.isArray(tr)) setTranslations(tr);
  }, [project]);

  // 책 번역 호출 — 챕터 8장 정도 처리 후 progress.isComplete=false면 자동 retry
  const handleTranslate = async (language: TranslationLang) => {
    if (translateBusy) return;
    setTranslateBusy(true);
    setTranslateMsg("⏳ 번역 중... (책 분량에 따라 1~3분)");
    try {
      let attempts = 0;
      while (attempts < 4) {
        attempts++;
        const res = await fetch("/api/generate/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, language }),
        });
        const data = await res.json();
        if (!res.ok) {
          setTranslateMsg(`❌ ${data?.message ?? data?.error ?? "실패"}`);
          break;
        }
        if (typeof data?.newBalance === "number") setBalance(data.newBalance);
        if (data?.translation) {
          setTranslations(prev => {
            const filtered = prev.filter(t => t.language !== language);
            return [...filtered, data.translation];
          });
        }
        const prog = data?.progress;
        if (prog?.isComplete) {
          setTranslateMsg(`✅ 완료! ${prog.completed}/${prog.total} 챕터 번역됨`);
          break;
        }
        setTranslateMsg(`⏳ ${prog?.completed ?? "?"}/${prog?.total ?? "?"} 챕터 완료. 계속 진행 중...`);
      }
    } catch (e: any) {
      setTranslateMsg(`❌ ${e?.message ?? "네트워크 오류"}`);
    } finally {
      setTranslateBusy(false);
      setTimeout(() => setTranslateMsg(null), 6000);
    }
  };

  // ─── v3 Phase 1.3: 백그라운드 본문 생성 큐 폴링 ───
  // active job이 있으면 5초마다 status fetch. completed/cancelled면 폴링 종료.
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/generation-status`);
        if (!res.ok) {
          if (!cancelled) timer = setTimeout(tick, 15000); // 에러 시 백오프
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setQueueJob(data.active ?? null);
        // 활성 job이 있고 종료 상태(failed 포함, completed/cancelled는 active=null로 옴) 아니면 계속 폴링
        if (data.active && ["queued", "processing"].includes(data.active.status)) {
          timer = setTimeout(tick, 5000);
        } else if (data.active && data.active.status === "failed") {
          // 실패 시 폴링은 멈추고 노출만 유지 (사용자가 dismiss할 때까지)
          timer = null;
        } else {
          // active=null (completed/cancelled) — 책 최신화 한 번
          fetch(`/api/projects/${projectId}`).then(r => r.ok ? r.json() : null).then(p => {
            if (p && !cancelled) setProject(p);
          }).catch(() => {});
          timer = null;
        }
      } catch {
        if (!cancelled) timer = setTimeout(tick, 15000);
      }
    };

    // 첫 로드 시 한 번 즉시 fetch
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // projectId만 의존 — queueJob 자체는 폴링 내부에서 setState
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const startBackgroundGeneration = async () => {
    if (!projectId || queueBusy) return;
    setQueueBusy(true);
    try {
      const res = await fetch(`/api/generate/chapter?queue=true`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "ACTIVE_JOB_EXISTS") {
          notify.info({ title: "이미 진행 중", message: data.message ?? "다른 본문 생성 작업이 진행 중입니다." });
        } else if (data.error === "NO_CHAPTERS") {
          setError("프로젝트에 챕터가 없습니다. 먼저 목차를 생성하세요.");
        } else {
          setError(data.message ?? data.error ?? "백그라운드 본문 생성 시작 실패");
        }
        return;
      }
      // 즉시 상태 표시 — 첫 polling tick 전 placeholder
      setQueueJob({
        jobId: data.jobId,
        status: "queued",
        currentChapterIdx: 0,
        totalChapters: data.totalChapters,
        etaMinutes: data.totalChapters * 2,
        errorMessage: null,
      });
      notify.success({
        title: "✓ 백그라운드 본문 생성 시작",
        message: `${data.totalChapters}장 처리 시작. 탭 닫아도 진행됩니다. 약 ${data.totalChapters * 2}분 후 완료.`,
        durationMs: 7000,
      });
    } catch (e: any) {
      setError(e?.message ?? "백그라운드 본문 생성 시작 실패");
    } finally {
      setQueueBusy(false);
    }
  };

  // revenue sync — project.revenue가 있으면 입력 폼에 반영. 없는 채널은 0으로 보존.
  useEffect(() => {
    const rev = (project as any)?.revenue;
    if (!rev || !Array.isArray(rev.channels)) return;
    setRevenueChannels(prev => {
      const byChannel = new Map<string, RevenueChannelInput>();
      for (const c of prev) byChannel.set(`${c.channel}::${c.label ?? ""}`, c);
      for (const c of rev.channels) {
        const key = `${c.channel}::${c.label ?? ""}`;
        byChannel.set(key, {
          channel: c.channel,
          label: c.label,
          grossKRW: Number(c.grossKRW) || 0,
          feeRate: typeof c.feeRate === "number" ? c.feeRate : 0,
        });
      }
      return Array.from(byChannel.values());
    });
  }, [project]);

  if (unauthorized) {
    return (
      <Center>
        <p className="mb-4 text-gray-600">로그인이 필요합니다.</p>
        <Link href={`/login?redirect=/write?id=${projectId}`} className="px-6 py-3 bg-ink-900 text-white font-bold rounded-lg">로그인</Link>
      </Center>
    );
  }
  // NOTE: 에러는 페이지 전체 대체 X (이전 버그 — applyChapterEdit 등 부분 실패 시 페이지가 통째로 빈 화면 + 에러만 보였음)
  // 일반 에러는 main return의 inline banner (line ~2874)로 표시. 진짜 fatal 에러만 unauthorized 분기.
  if (!project) return <Center>로딩 중...</Center>;

  // ─── DB 동기화: project.data 통째로 PUT ───
  const saveProject = async (next: Project) => {
    // 이미지 base64(dataUrl)는 PUT 본문에서 제거 — Vercel 함수 4.5MB 한도 초과 방지.
    // 서버는 PUT 시 chapters를 per-chapter 머지해서 기존 images.dataUrl을 보존함.
    const slimChapters = (next.chapters ?? []).map(ch => ({
      ...ch,
      images: Array.isArray(ch.images)
        ? ch.images.map(img => ({ ...img, dataUrl: undefined }))
        : ch.images,
    }));
    const data = {
      topic: next.topic, audience: next.audience, type: next.type, targetPages: next.targetPages,
      chapters: slimChapters,
    };
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });
    if (!res.ok) {
      // 정확한 status + 본문 로그 → 환경별 원인 진단
      let detail = "";
      try {
        const errBody = await res.json();
        detail = errBody?.message || errBody?.error || JSON.stringify(errBody).slice(0, 100);
      } catch {
        detail = await res.text().then(t => t.slice(0, 100)).catch(() => "");
      }
      if (res.status === 401) {
        // 세션 만료 — 로그인으로 자동 안내
        const ok = await notify.confirm({
          title: "로그인 세션 만료",
          emoji: "🔒",
          message: "다시 로그인하시겠어요?",
          confirmLabel: "로그인 페이지로",
          variant: "warn",
        });
        if (ok) router.push(`/login?redirect=/write?id=${projectId}`);
        throw new Error("로그인 만료 — 다시 로그인해주세요");
      }
      console.error("[saveProject] PUT failed", { status: res.status, detail });
      throw new Error(`저장 실패 (${res.status}) ${detail}`);
    }
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
        await askTopUp(data.shortfall);
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
        await askTopUp(data.shortfall);
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
          } else if (msg.type === "warning") {
            // 서버가 보낸 경고 (예: RAG 실패) — 사용자에게 알림으로 띄움
            setError(`⚠️ ${msg.message || msg.code || "경고"}`);
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

  // 새 가격 정책 (Sang-nim 10x 인상, 2026-05): 챕터당 ₩300 고정 (요약 포함)
  const estimateBatchKRW = (chaptersToWriteCount: number) =>
    chaptersToWriteCount * 300;

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
    notify.success({
      title: `✓ 본문 ${pendingIdxs.length}장 완성!`,
      message: "다음은 본문 이미지를 자동 생성해 보세요.",
      nextStepLabel: "본문 이미지 일괄 만들기",
      onNextStep: () => {
        setTab("writing");
        setTimeout(() => document.getElementById("writing-section-chapters")?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
      },
      durationMs: 7000,
    });
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
    const ok = await notify.confirm({
      title: "챕터 삭제",
      emoji: "🗑️",
      message: `"${project.chapters[idx].title}" 챕터를 삭제할까요?\n본문도 함께 삭제됩니다.`,
      confirmLabel: "삭제",
      variant: "danger",
    });
    if (!ok) return;
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
    const ok = await notify.confirm({
      title: "크몽 패키지 일괄 생성",
      emoji: "📦",
      message: "이미지 6장 + 카피 5종 한 번에 생성합니다 (~40초).",
      details: ["이미지 6장 (~₩2,400)", "카피 5종 (~₩500)", "예상 합계 ~₩2,900"],
      confirmLabel: "진행",
    });
    if (!ok) return;

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
          await askTopUp();
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
      const ok = await notify.confirm({
        title: "크몽 카피 5종 생성",
        emoji: "📝",
        message: "카피 5종 먼저 생성. 이미지 6장은 모달에서 개별로.",
        details: ["카피 5종 ~₩500", "이미지 6장은 별도 (각 ₩400, ~5초)"],
        confirmLabel: "진행",
      });
      if (!ok) return;
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
        await askTopUp();
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

  // 표지 다양화 — 3종 다른 스타일 한번에 생성 (~₩900). Imagen 4 Fast.
  const generateCoverVariations = async (options?: {
    userConcept?: string;
    styleDirection?: "image" | "typography" | "hybrid";
    imageVendor?: "imagen" | "openai";
  }) => {
    if (!projectId) return;
    const cnt = coverVariationsCount;
    const estKRW = cnt * 300;
    const ok = await notify.confirm({
      title: `표지 다양화 ${cnt}종`,
      emoji: "🎨",
      message: `같은 책·같은 테마 색상으로 ${cnt}가지 다른 스타일 표지 생성.`,
      details: [`예상 비용 ₩${estKRW.toLocaleString()}`, "Imagen 4 Fast 또는 DALL-E 3"],
      confirmLabel: "생성",
    });
    if (!ok) return;
    setCoverVariationsBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/generate/cover-variations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          count: cnt,
          ...(options?.userConcept ? { userConcept: options.userConcept } : {}),
          ...(options?.styleDirection ? { styleDirection: options.styleDirection } : {}),
          ...(options?.imageVendor ? { imageVendor: options.imageVendor } : {}),
        }),
      });
      const data = await res.json();
      if (res.status === 402) {
        await askTopUp();
        throw new Error("잔액 부족");
      }
      if (!res.ok) throw new Error(data.message || `요청 실패 (${res.status})`);
      if (Array.isArray(data.variations)) {
        setCoverVariations(data.variations);
      }
      if (typeof data.newBalance === "number") setBalance(data.newBalance);
      if (Array.isArray(data.failed) && data.failed.length > 0) {
        setError(`${data.variations?.length ?? 0}/${cnt}장 생성. ${data.failed.length}장 실패.`);
      }
      // 표지 다양화 생성 완료 → 사용자가 마음에 드는 거 골라야 메인 표지가 됨
      const okCount = (data.variations ?? []).length;
      if (okCount > 0) {
        notify.success({
          title: `✓ 표지 ${okCount}종 생성 완료!`,
          message: "이미지 클릭해서 크게 보고, 마음에 드는 거 [✓ 메인 적용] 누르세요.",
          durationMs: 7000,
        });
      }
    } catch (e: any) {
      if (e.message !== "잔액 부족") setError(e.message);
    } finally {
      setCoverVariationsBusy(false);
    }
  };

  // 다양화 결과 중 하나 선택 → PATCH로 메인 cover에 복사
  const selectCoverVariation = async (idx: number) => {
    if (!projectId) return;
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverFromVariation: idx }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `요청 실패 (${res.status})`);
      const fresh = await fetch(`/api/projects/${projectId}`).then(r => r.json());
      setProject(fresh);
      setCoverVariations([]); // 선택 후 그리드 닫기
      notify.success({
        title: "✓ 표지 선택 완료!",
        message: "다음은 마케팅 카피를 만들어 보세요. publish 탭에 있어요.",
        nextStepLabel: "마케팅 카피 만들러 가기",
        onNextStep: () => {
          setTab("publish");
          setTimeout(() => document.getElementById("publish-section-marketing")?.scrollIntoView({ behavior: "smooth", block: "center" }), 200);
        },
        durationMs: 7000,
      });
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
        await askTopUp();
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
        await askTopUp(data.shortfall);
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
        await askTopUp();
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
    if (!editChat?.proposal || !project || !projectId) return;
    setEditChat(c => c ? { ...c, busy: true } : c);
    try {
      // 본문만 patch — 챕터 이미지(base64) 함께 보내면 Vercel 4.5MB 한도 초과.
      const idx = editChat.chapterIdx;
      const newContent = editChat.proposal;
      const res = await fetch(`/api/chapter/${idx}/content`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, content: newContent }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `저장 실패 (${res.status})`);
      }
      // 로컬 state도 업데이트 (서버에 저장된 내용과 동기화)
      const chapters = [...project.chapters];
      chapters[idx] = { ...chapters[idx], content: newContent };
      setProject({ ...project, chapters });
      setEditChat(null);
    } catch (e: any) {
      setError(e?.message || "저장 실패 — 다시 시도해주세요");
      setEditChat(c => c ? { ...c, busy: false } : c);
    }
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
        await askTopUp();
        throw new Error("잔액 부족");
      }
      if (!res.ok) throw new Error(data.message || `요청 실패 (${res.status})`);
      if (data.newBalance != null) setBalance(data.newBalance);
      if (data.marketingMeta) setMarketingMeta(data.marketingMeta);
      // project도 fresh로 동기화 (PATCH 머지 결과 반영)
      const fresh = await fetch(`/api/projects/${projectId}`).then(r => r.json());
      setProject(fresh);
      toastStepDone("마케팅 카피", { label: "Meta 광고", tab: "publish" });
    } catch (e: any) {
      if (e.message !== "잔액 부족") setError(e.message);
    } finally {
      setMarketingBusy(false);
    }
  };

  // openMarketingEditor — MarketingPageBox 내부로 이동됨

  // saveMarketingMeta — form을 인자로 받도록 변경 (MarketingPageBox에서 호출).
  // 반환값: true = 저장 성공(편집 폼 닫음), false = 실패.
  const saveMarketingMeta = async (form: any): Promise<boolean> => {
    if (!projectId) return false;
    setMarketingBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketingMeta: form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `저장 실패 (${res.status})`);
      const merged = data.updates?.marketingMeta ?? { ...(marketingMeta ?? {}), ...form };
      setMarketingMeta(merged);
      const fresh = await fetch(`/api/projects/${projectId}`).then(r => r.json());
      setProject(fresh);
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    } finally {
      setMarketingBusy(false);
    }
  };

  // copyMarketingUrl — clipboard 쓰기만 수행, copyConfirm 토스트는 MarketingPageBox 내부에서 관리.
  // 반환값: true = 복사 성공(박스가 토스트 표시), false = 사용자 취소·복사 실패.
  const copyMarketingUrl = async (): Promise<boolean> => {
    if (!projectId) return false;
    if (!marketingMeta?.tagline && !marketingMeta?.description) {
      const ok = await notify.confirm({
        title: "마케팅 카피 없음",
        emoji: "⚠️",
        message: "방문자에게 책 소개가 보이지 않아 빈 페이지처럼 보일 수 있어요.\n그래도 URL을 복사할까요?",
        confirmLabel: "그래도 복사",
        cancelLabel: "먼저 카피 만들기",
        variant: "warn",
      });
      if (!ok) return false;
    }
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/book/${projectId}`);
      return true;
    } catch (e: any) {
      setError(`URL 복사 실패: ${e.message}`);
      return false;
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
      // project state도 fresh로 동기화 — PackageProgressBar 진행률 갱신 위해
      try {
        const fresh = await fetch(`/api/projects/${projectId}`).then(r => r.json());
        setProject(fresh);
      } catch {}
      toastStepDone("Meta 광고 카피", { label: "Meta 광고 이미지 3장", tab: "publish" });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setMetaAdBusy(false);
    }
  };

  // copyMetaItem — UI-only, MetaAdsBox로 이동됨

  // ─── 1-click: 카피 + 이미지 한 번에 ───
  const generateMetaAllInOne = async () => {
    if (!projectId) return;
    setMetaAllInOneBusy(1);
    setError(null);
    try {
      // 카피 없으면 먼저 생성
      if (!metaAdPackage?.headlines?.length) {
        const r1 = await fetch("/api/generate/meta-package", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId }),
        });
        const d1 = await r1.json();
        if (r1.status === 402) {
          await askTopUp();
          throw new Error("잔액 부족");
        }
        if (!r1.ok) throw new Error(d1.message || "카피 생성 실패");
        setMetaAdPackage(d1.metaAdPackage);
        if (typeof d1.newBalance === "number") setBalance(d1.newBalance);
      }
      setMetaAllInOneBusy(2);
      // 이미지 생성
      const r2 = await fetch("/api/generate/meta-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, template: imageTemplate }),
      });
      const d2 = await r2.json();
      if (r2.status === 402) {
        await askTopUp();
        throw new Error("잔액 부족");
      }
      if (!r2.ok) throw new Error(d2.message || "이미지 생성 실패");
      setMetaAdImages(d2.images || []);
      if (typeof d2.newBalance === "number") setBalance(d2.newBalance);
      // project state도 fresh로 동기화 — PackageProgressBar 진행률 갱신 위해
      try {
        const fresh = await fetch(`/api/projects/${projectId}`).then(r => r.json());
        setProject(fresh);
      } catch {}
    } catch (e: any) {
      setError(e.message);
    } finally {
      setMetaAllInOneBusy(0);
    }
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
      // project state 동기화
      try {
        const fresh = await fetch(`/api/projects/${projectId}`).then(r => r.json());
        setProject(fresh);
      } catch {}
      // 채널별 다음 단계 안내 — 5채널 (instagram → youtube → blog → email → kakao) 완성 시 풀패키지
      const channelLabels: Record<RepurposeChannel, string> = {
        instagram: "📸 인스타", youtube: "📺 유튜브", blog: "📝 블로그", email: "📧 이메일", kakao: "💬 카톡",
      };
      const order: RepurposeChannel[] = ["instagram", "youtube", "blog", "email", "kakao"];
      const fresh: any = await fetch(`/api/projects/${projectId}`).then(r => r.ok ? r.json() : {}).catch(() => ({}));
      const repurposed = fresh?.repurposedContent ?? {};
      const remaining = order.filter(c => !repurposed[c]);
      if (remaining.length > 0) {
        const next = remaining[0];
        notify.success({
          title: `✓ ${channelLabels[channel]} 완성! (${5 - remaining.length}/5 채널)`,
          message: `다음은 ${channelLabels[next]}. 5채널 모두 완성하면 풀 패키지!`,
          durationMs: 6000,
        });
      } else {
        notify.success({
          title: `🎉 풀 패키지 완성! (5/5 채널)`,
          message: "본문·표지·마케팅·광고·5채널 재가공까지 — 진짜 풀패키지. 내보내기로 ZIP!",
          nextStepLabel: "내보내기로",
          onNextStep: () => router.push(`/export?id=${projectId}`),
          durationMs: 10000,
        });
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRepurposeBusy(null);
    }
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
        await askTopUp();
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
      // project state도 fresh로 동기화 — PackageProgressBar의 진행률 갱신 위해
      try {
        const fresh = await fetch(`/api/projects/${projectId}`).then(r => r.json());
        setProject(fresh);
      } catch {}
      const imgCount = (data.images ?? []).length;
      notify.success({
        title: `✓ Meta 광고 이미지 ${imgCount}장 완성!`,
        message: "기본 출간 패키지 완성. 더 풍부하게 — 카드뉴스 5장 만들어 보세요.",
        nextStepLabel: "카드뉴스 만들러 가기",
        onNextStep: () => {
          setTab("publish");
          setTimeout(() => document.getElementById("publish-section-meta-ads")?.scrollIntoView({ behavior: "smooth", block: "end" }), 100);
        },
        durationMs: 8000,
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setMetaImgBusy(false);
    }
  };

  // downloadMetaImage / metaImageLabel — UI-only, MetaAdsBox로 이동됨

  // ─── Wave B3: 카드뉴스 인포그래픽 5장 자동 생성 ───
  const generateInfographic = async () => {
    if (!projectId) return;
    setInfographicBusy(true); setError(null);
    try {
      const res = await fetch("/api/generate/infographic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, template: infographicTemplate }),
      });
      const data = await res.json();
      if (res.status === 402) {
        await askTopUp();
        throw new Error("잔액 부족");
      }
      if (!res.ok) throw new Error(data.message || `인포그래픽 생성 실패 (${res.status})`);
      const next = {
        template: infographicTemplate,
        slides: data.infographics ?? [],
        generatedAt: Date.now(),
      };
      setInfographic(next);
      if (typeof data.newBalance === "number") setBalance(data.newBalance);
      // project state도 동기화 (PackageProgressBar 갱신)
      try {
        const fresh = await fetch(`/api/projects/${projectId}`).then(r => r.json());
        setProject(fresh);
      } catch {}
      notify.success({
        title: `✓ 카드뉴스 ${(data.infographics ?? []).length}장 완성!`,
        message: "다음은 콘텐츠 재가공 — 인스타·유튜브·블로그·이메일·카톡 5채널 자동.",
        nextStepLabel: "콘텐츠 재가공 (extras 탭)",
        onNextStep: () => setTab("extras"),
        durationMs: 7000,
      });
    } catch (e: any) {
      if (e.message !== "잔액 부족") setError(e.message);
    } finally {
      setInfographicBusy(false);
    }
  };

  const downloadInfographicSlide = (slide: { slideNum: number; base64: string }) => {
    const a = document.createElement("a");
    a.href = `data:image/png;base64,${slide.base64}`;
    a.download = `infographic-${slide.slideNum}.png`;
    a.click();
  };

  // ─── Wave B5: A/B 테스트 ───
  const saveAbTest = async () => {
    if (!projectId) return;
    setAbTestBusy(true); setError(null); setAbTestSaved(false);
    try {
      const res = await fetch("/api/marketing/ab", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, ...abTestForm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `저장 실패 (${res.status})`);
      setAbTestSaved(true);
      setTimeout(() => setAbTestSaved(false), 2000);
      // refetch project so abTest sync runs
      const fresh = await fetch(`/api/projects/${projectId}`).then(r => r.json());
      setProject(fresh);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAbTestBusy(false);
    }
  };

  const fetchAbTestStats = async () => {
    if (!projectId) return;
    setAbTestStatsBusy(true);
    try {
      const res = await fetch(`/api/marketing/ab?bookId=${projectId}`);
      const data = await res.json();
      if (res.ok && data.stats) setAbTestStats(data.stats);
    } catch {
      // silent
    } finally {
      setAbTestStatsBusy(false);
    }
  };

  // ─── Wave B6: 미리보기 영상 frames 5장 (9:16) ───
  const generatePreviewVideo = async () => {
    if (!projectId) return;
    setPreviewVideoBusy(true); setError(null);
    try {
      const res = await fetch("/api/generate/preview-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (res.status === 402) {
        await askTopUp();
        throw new Error("잔액 부족");
      }
      if (!res.ok) throw new Error(data.message || `미리보기 영상 frame 생성 실패 (${res.status})`);
      const next = {
        frames: data.frames ?? [],
        generatedAt: Date.now(),
      };
      setPreviewVideo(next);
      if (typeof data.newBalance === "number") setBalance(data.newBalance);
    } catch (e: any) {
      if (e.message !== "잔액 부족") setError(e.message);
    } finally {
      setPreviewVideoBusy(false);
    }
  };

  const downloadPreviewFrame = (frame: { idx: number; base64: string }) => {
    const a = document.createElement("a");
    a.href = `data:image/png;base64,${frame.base64}`;
    a.download = `preview-frame-${frame.idx + 1}.png`;
    a.click();
  };

  // ─── 강의 슬라이드 생성 (책 → 10~20장 outline + 옵션 PNG) ───
  const generateCourseSlides = async () => {
    if (!projectId) return;
    setCourseSlidesBusy(true); setError(null);
    try {
      const res = await fetch("/api/generate/course-slides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          slideCount: courseSlideCount,
          template: courseSlideTemplate,
          renderImages: courseSlideRender,
        }),
      });
      const data = await res.json();
      if (res.status === 402) {
        await askTopUp();
        throw new Error("잔액 부족");
      }
      if (!res.ok) throw new Error(data.message || `강의 슬라이드 생성 실패 (${res.status})`);
      if (data.courseSlides) setCourseSlides(data.courseSlides);
      if (typeof data.newBalance === "number") setBalance(data.newBalance);
    } catch (e: any) {
      if (e.message !== "잔액 부족") setError(e.message);
    } finally {
      setCourseSlidesBusy(false);
    }
  };

  const copyCourseSlide = async (slide: CourseSlideUI) => {
    const lines = [
      `[슬라이드 ${slide.slideNum}] ${slide.title}`,
      "",
      ...slide.bullets.map(b => `• ${b}`),
    ];
    if (slide.notes) {
      lines.push("", "[강사 노트]", slide.notes);
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
    } catch {
      // ignore — older browsers
    }
  };

  const downloadCourseSlidePng = (slide: CourseSlideUI) => {
    if (!slide.pngBase64) return;
    const a = document.createElement("a");
    a.href = `data:image/png;base64,${slide.pngBase64}`;
    a.download = `slide-${String(slide.slideNum).padStart(2, "0")}.png`;
    a.click();
  };

  // ─── 📻 오디오북 — 챕터별 TTS 순차 생성 ───
  // Vercel 60s 한계 때문에 한 챕터씩 호출. 빈 챕터만 채움 (regenerate=false).
  const generateAudiobook = async (regenerateAll = false) => {
    if (!projectId) return;
    const totalChapters = project.chapters?.length ?? 0;
    if (totalChapters === 0) return;

    setAudiobookBusy(true);
    setError(null);
    setAudiobookProgress(`준비 중...`);

    try {
      // 처리할 챕터 idx 결정 (프론트에서 한 챕터씩 호출 위해 명시적 계산).
      const existingSet = new Set(
        (audiobook?.chapters ?? []).map((c) => c.chapterIdx),
      );
      const targetIdxs = regenerateAll
        ? Array.from({ length: totalChapters }, (_, i) => i)
        : Array.from({ length: totalChapters }, (_, i) => i).filter(
            (i) => !existingSet.has(i),
          );

      if (targetIdxs.length === 0) {
        setAudiobookProgress("이미 모든 챕터 생성됨");
        return;
      }

      let lastAudiobook: any = audiobook;
      for (let i = 0; i < targetIdxs.length; i++) {
        const idx = targetIdxs[i];
        setAudiobookProgress(`⏳ ${i + 1}/${targetIdxs.length} 챕터 생성 중...`);
        const res = await fetch("/api/generate/audiobook", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, chapterIdx: idx }),
        });
        const data = await res.json();
        if (res.status === 402) {
          await askTopUp();
          throw new Error("잔액 부족");
        }
        if (!res.ok) throw new Error(data.message || `오디오북 생성 실패 (${res.status})`);
        if (data.audiobook) {
          lastAudiobook = data.audiobook;
          setAudiobook(data.audiobook);
        }
        if (typeof data.newBalance === "number") setBalance(data.newBalance);
      }
      setAudiobookProgress(null);
    } catch (e: any) {
      if (e.message !== "잔액 부족") setError(e.message);
      setAudiobookProgress(null);
    } finally {
      setAudiobookBusy(false);
    }
  };

  const downloadAudio = (c: AudiobookChapterUI) => {
    const a = document.createElement("a");
    a.href = `data:audio/wav;base64,${c.wavBase64}`;
    a.download = `${(c.chapterIdx + 1).toString().padStart(2, "0")}-${c.title.replace(/[\\/:*?"<>|]/g, "_")}.wav`;
    a.click();
  };

  // ─── 책별 매출 저장 ("이정도 번다") ───
  const updateRevenueChannel = (idx: number, patch: Partial<RevenueChannelInput>) => {
    setRevenueChannels(prev => prev.map((c, i) => i === idx ? { ...c, ...patch } : c));
  };
  const saveRevenue = async () => {
    if (!projectId) return;
    setRevenueBusy(true); setError(null);
    try {
      const payload = revenueChannels.map(c => ({
        channel: c.channel,
        ...(c.label ? { label: c.label } : {}),
        grossKRW: Math.max(0, Math.floor(Number(c.grossKRW) || 0)),
        feeRate: Math.max(0, Math.min(1, Number(c.feeRate) || 0)),
      }));
      const res = await fetch(`/api/projects/${projectId}/revenue`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channels: payload }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.message || `매출 저장 실패 (${res.status})`);
      }
      // refresh project
      const fresh = await fetch(`/api/projects/${projectId}`).then(r => r.json());
      setProject(fresh);
      setRevenueSavedFlash(true);
      setTimeout(() => setRevenueSavedFlash(false), 2000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRevenueBusy(false);
    }
  };

  // ─── Wave B1: 1-click bundle (publish/growth/full) ───
  // 순차적으로 필요한 endpoint를 호출. 이미 생성된 항목은 스킵 가능.
  const runBundle = async (level: BundleLevel) => {
    if (!projectId || !project) return;
    setBundleBusy(level);
    setError(null);

    type Step = { label: string; run: () => Promise<void> };
    const steps: Step[] = [];

    // 출간: 마케팅 메타 (있으면 스킵)
    if (!(project as any).marketingMeta?.tagline) {
      steps.push({
        label: "마케팅 카피 생성",
        run: async () => {
          const r = await fetch("/api/generate/marketing-meta", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId }),
          });
          const d = await r.json();
          if (!r.ok) throw new Error(d.message || `마케팅 카피 실패 (${r.status})`);
          if (d.marketingMeta) setMarketingMeta(d.marketingMeta);
          if (typeof d.newBalance === "number") setBalance(d.newBalance);
        },
      });
    }

    if (level === "growth" || level === "full") {
      // Meta 광고 카피
      if (!(project as any).metaAdPackage) {
        steps.push({
          label: "Meta 광고 카피 생성",
          run: async () => {
            const r = await fetch("/api/generate/meta-package", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ projectId }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.message || `Meta 광고 카피 실패 (${r.status})`);
            setMetaAdPackage(d.metaAdPackage);
            if (typeof d.newBalance === "number") setBalance(d.newBalance);
          },
        });
      }
      // Meta 광고 이미지 (3장)
      const existingImgs: any[] = (project as any).metaAdImages ?? [];
      if (!Array.isArray(existingImgs) || existingImgs.length === 0) {
        steps.push({
          label: "Meta 광고 이미지 3장 생성",
          run: async () => {
            const r = await fetch("/api/generate/meta-images", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ projectId, template: imageTemplate }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.message || `Meta 광고 이미지 실패 (${r.status})`);
            setMetaAdImages(d.images ?? []);
            if (typeof d.newBalance === "number") setBalance(d.newBalance);
          },
        });
      }
    }

    if (level === "full") {
      // 콘텐츠 재가공 5채널
      const existingRep: any = (project as any).repurposedContent ?? {};
      const channels: RepurposeChannel[] = ["instagram", "youtube", "blog", "email", "kakao"];
      for (const ch of channels) {
        if (existingRep?.[ch]) continue;
        steps.push({
          label: `${REPURPOSE_LABEL[ch]} 콘텐츠 재가공`,
          run: async () => {
            const r = await fetch(`/api/generate/repurpose-${ch}`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ projectId }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.message || `${REPURPOSE_LABEL[ch]} 실패 (${r.status})`);
            setRepurposed((prev: any) => ({ ...(prev ?? {}), [ch]: d.content }));
            if (typeof d.newBalance === "number") setBalance(d.newBalance);
          },
        });
      }
    }

    if (steps.length === 0) {
      setBundleBusy(null);
      setError("이미 모든 항목이 생성되어 있습니다. 개별 [재생성]을 사용하세요.");
      return;
    }

    try {
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        setBundleProgress({ step: i + 1, total: steps.length, label: s.label });
        await s.run();
      }
      // 완료 후 fresh project 로드
      const fresh = await fetch(`/api/projects/${projectId}`).then(r => r.json());
      setProject(fresh);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBundleBusy(null);
      setBundleProgress(null);
    }
  };

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
    const ok = await notify.confirm({
      title: `이미지 ${jobs.length}개 일괄 생성`,
      emoji: "🖼️",
      message: `예상 소요 ~${jobs.length * 6}초.`,
      confirmLabel: "생성",
    });
    if (!ok) return;
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
          await askTopUp();
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
    notify.success({
      title: "✓ 본문 이미지 일괄 완성!",
      message: "다음은 표지를 만들어 보세요. 표지 다양화에서 5종 비교 가능합니다.",
      nextStepLabel: "표지 만들러 가기",
      onNextStep: () => {
        setTab("writing");
        setTimeout(() => document.getElementById("writing-section-cover")?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
      },
      durationMs: 7000,
    });
  };

  const active = project.chapters[activeIdx];
  const placeholders = active ? extractImagePlaceholders(active.content) : [];

  // 모든 챕터에 누락된 이미지가 있는지 (일괄 버튼 표시용)
  const missingImageCount = project.chapters.reduce((sum, c) => {
    const phs = extractImagePlaceholders(c.content);
    return sum + phs.filter(ph => !c.images?.find(i => i.placeholder === ph)?.dataUrl).length;
  }, 0);

  // TopHeader chip + 내보내기 confirm 용 패키지 진행률 (본문·표지·마케팅·Meta 광고 4항목)
  const projectProgress = calculateProgress(project as any);

  // 빈 책: 목차 생성 안내 (4-tab 레이아웃 진입 전)
  // NOTE: useTabState/usePublishHint hooks는 컴포넌트 최상단으로 이동됨 (line ~85 근처) — Rules of Hooks 준수.
  if (project.chapters.length === 0) {
    return (
      <>
        <Header />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="mb-6">
            <Link href="/projects" className="text-sm text-gray-500 hover:text-tiger-orange">← 내 책</Link>
            <h1 className="text-lg sm:text-xl font-black mt-1 line-clamp-2 break-keep">{project.topic}</h1>
            <p className="text-xs text-gray-500">
              {project.audience} · {project.type} · {project.targetPages}쪽
            </p>
          </div>
          {error && (
            <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}
          <div className="bg-white p-10 rounded-xl border border-gray-200 text-center">
            <p className="mb-5 text-gray-600">아직 목차가 없습니다. AI가 12개 챕터를 제안합니다.</p>
            <button onClick={generateToc} disabled={!!loading} className="px-6 py-3 bg-tiger-orange text-white rounded-lg font-bold disabled:opacity-50">
              {loading || "목차 생성"}
            </button>
          </div>
        </main>
      </>
    );
  }

  // ─── 4-tab 레이아웃 슬롯 변수 (return 전 정의) ───
  // usePublishHint는 실제 hook 아닌 pure function이라 여기서 호출 OK
  const showPublishHint = usePublishHint(project as any);

  // ChapterList(New) chapter mini 데이터
  const chapterListChapters = project.chapters.map((c) => ({
    id: c.id,
    title: c.title,
    subtitle: c.subtitle,
    hasContent: (c.content?.length ?? 0) > 100,
    charCount: c.content?.length ?? 0,
  }));

  // === 본문 탭 슬롯 ===
  // 일괄 집필 + 챕터 추가/목차 재생성 + 본문 이미지 일괄
  // (크몽 패키지 버튼은 kmongPackageBox로 분리됨)
  // v3 Phase 1.3: 백그라운드 큐 상태 시각화 (queued/processing은 진행 중, failed는 에러 표시)
  const queueActive = !!queueJob && ["queued", "processing"].includes(queueJob.status);
  const queueFailed = !!queueJob && queueJob.status === "failed";
  const queuePct = queueJob && queueJob.totalChapters > 0
    ? Math.round((queueJob.currentChapterIdx / queueJob.totalChapters) * 100)
    : 0;

  const bulkWritingControls = (
    <div className="space-y-1">
      <button
        onClick={() => startBatch(0)}
        disabled={!!loading || batch.status === "running" || queueActive}
        className="w-full px-3 py-2.5 bg-tiger-orange text-white rounded-lg text-sm font-bold shadow-glow-orange-sm hover:bg-orange-600 transition disabled:opacity-50 disabled:shadow-none"
      >
        {batch.status === "running"
          ? `진행 중...${batch.cumulativeCostKRW > 0 ? ` (₩${batch.cumulativeCostKRW.toLocaleString()})` : ""}`
          : "⚡ 전체 일괄 집필"}
      </button>
      {/* v3 Phase 1.3 — 백그라운드 본문 생성 큐 */}
      <button
        onClick={startBackgroundGeneration}
        disabled={!!loading || batch.status === "running" || queueBusy || queueActive}
        title="탭을 닫아도 서버에서 계속 처리됩니다. 약 25분 후 완료 알림."
        className="w-full px-3 py-2 bg-ink-900 text-white rounded-lg text-xs font-bold hover:bg-ink-800 transition disabled:opacity-50"
      >
        {queueBusy
          ? "큐 등록 중..."
          : queueActive
            ? `백그라운드 진행 중 — ${queueJob!.currentChapterIdx}/${queueJob!.totalChapters}장 (${queuePct}%)`
            : "🌙 백그라운드로 본문 생성 시작"}
      </button>
      {queueActive && (
        <div className="px-1 py-1 text-[10px] text-gray-500 leading-tight">
          상태: {queueJob!.status === "queued" ? "대기 중 (1분 안에 시작)" : "처리 중"}
          {queueJob!.etaMinutes !== null && queueJob!.etaMinutes > 0 ? ` · 약 ${queueJob!.etaMinutes}분 남음` : ""}
          <br />
          탭 닫아도 OK — 서버가 끝까지 처리합니다.
        </div>
      )}
      {queueFailed && (
        <div className="px-2 py-1.5 bg-red-50 border border-red-200 rounded text-[10px] text-red-700">
          <div className="font-bold mb-0.5">백그라운드 생성 실패</div>
          <div className="leading-tight">{queueJob!.errorMessage ?? "알 수 없는 오류"}</div>
          <button
            onClick={() => setQueueJob(null)}
            className="mt-1 underline hover:no-underline"
          >
            닫기
          </button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-1">
        <button onClick={() => setAddChapterOpen(true)} disabled={!!loading} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs hover:bg-[#fafafa] hover:border-gray-400 transition">
          + 챕터 추가
        </button>
        <button onClick={generateToc} disabled={!!loading} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs hover:bg-[#fafafa] hover:border-gray-400 transition">
          목차 재생성
        </button>
      </div>
    </div>
  );

  const bulkImageControls = (
    <>
      {missingImageCount > 0 ? (
        <button
          onClick={generateAllChapterImages}
          disabled={!!loading || !!imageGenBusy || batch.status === "running"}
          className="w-full px-3 py-2 bg-orange-50 border border-tiger-orange/40 text-tiger-orange rounded-lg text-xs font-bold hover:bg-orange-100 transition disabled:opacity-50"
          title={`본문에 누락된 이미지 ${missingImageCount}개를 한 번에 생성`}
        >
          {imageGenBusy.startsWith("[IMAGE:") ? `🖼️ ${imageGenBusy}` : `🖼️ 본문 이미지 일괄 (${missingImageCount}개)`}
        </button>
      ) : (
        <p className="text-[11px] text-gray-500 px-1">누락된 본문 이미지 없음.</p>
      )}
    </>
  );

  // 표지 다양화 — CoverVariationsBox로 분리. WritingTab에 standalone 노출.
  // 크몽 모달의 동일 블록은 제거됨(중복 방지).
  const coverVariationsControls = (
    <CoverVariationsBox
      projectId={projectId}
      variations={coverVariations}
      busy={coverVariationsBusy}
      count={coverVariationsCount}
      onCountChange={setCoverVariationsCount}
      onGenerate={generateCoverVariations}
      onSelect={selectCoverVariation}
      onRefined={(idx, b64) => {
        setCoverVariations(prev => prev.map(p => (p.idx === idx ? { ...p, base64: b64 } : p)));
      }}
      onBalanceChange={setBalance}
    />
  );

  const templateSelectorBox = (
    <TemplateSelector
      projectId={projectId!}
      current={(project as any)?.template}
      onChange={(newKey) => setProject(p => p ? ({ ...p, template: newKey } as any) : p)}
      disabled={!!loading}
    />
  );

  // === 출간 탭 슬롯 ===
  const marketingPageBoxSlot = (
    <MarketingPageBox
      projectId={projectId}
      project={project}
      marketingMeta={marketingMeta}
      marketingBusy={marketingBusy}
      loading={loading}
      onGenerate={generateMarketingMeta}
      onSave={saveMarketingMeta}
      onCopyUrl={copyMarketingUrl}
    />
  );

  const metaAdsBoxSlot = (
    <MetaAdsBox
      projectId={projectId}
      metaAdPackage={metaAdPackage}
      metaAdImages={metaAdImages}
      metaAdBusy={metaAdBusy}
      metaImgBusy={metaImgBusy}
      metaAllInOneBusy={metaAllInOneBusy}
      imageTemplate={imageTemplate}
      setImageTemplate={setImageTemplate}
      onGeneratePackage={generateMetaPackage}
      onGenerateAllInOne={generateMetaAllInOne}
      onGenerateImages={generateMetaImages}
      onSetMetaAdImages={setMetaAdImages}
      onSetBalance={setBalance}
    />
  );

  // 패키지 추천 funnel + 1-click bundle (Wave B1)
  const packageRecommendationBox = (() => {
    const bookDone = project.chapters.length > 0 && project.chapters.every(c => c.content);
    const marketingDone = !!(project as any).marketingMeta?.tagline;
    const metaDone = !!(project as any).metaAdPackage || (Array.isArray((project as any).metaAdImages) && (project as any).metaAdImages.length > 0);
    const repurposeDone = !!(project as any).repurposedContent && Object.keys((project as any).repurposedContent).length > 0;

    const dots: { label: string; done: boolean; key: string }[] = [
      { key: "book", label: "책 완성", done: bookDone },
      { key: "marketing", label: "마케팅 페이지", done: marketingDone },
      { key: "meta", label: "Meta 광고", done: metaDone },
      { key: "repurpose", label: "콘텐츠 재가공", done: repurposeDone },
    ];
    const nextStep = dots.find(d => !d.done);
    const allDone = !nextStep;

    const bundleCard = (
      level: BundleLevel,
      title: string,
      priceLabel: string,
      desc: string,
      gradient: string,
      tag?: string,
    ) => {
      const isBusy = bundleBusy === level;
      const otherBusy = bundleBusy && bundleBusy !== level;
      return (
        <div className={`relative p-4 rounded-xl bg-gradient-to-br ${gradient} text-white shadow-lg`}>
          {tag && (
            <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-white text-tiger-orange text-[10px] font-black rounded-full shadow">{tag}</div>
          )}
          <div className="text-sm font-black mb-1">{title}</div>
          <div className="text-[11px] opacity-90 mb-3 leading-relaxed break-keep">{desc}</div>
          <div className="text-lg font-black mb-3">{priceLabel}</div>
          <button
            onClick={() => runBundle(level)}
            disabled={!!bundleBusy || !!loading}
            className="w-full px-3 py-2 bg-white/95 text-ink-900 rounded-lg text-xs font-black hover:bg-white transition disabled:opacity-50"
          >
            {isBusy
              ? (bundleProgress ? `⏳ ${bundleProgress.step}/${bundleProgress.total} ${bundleProgress.label}...` : "⏳ 진행 중...")
              : otherBusy ? "다른 패키지 진행 중" : "🚀 한 번에 만들기"}
          </button>
        </div>
      );
    };

    return (
      <div className="p-3 sm:p-4 bg-white rounded-xl border border-gray-200">
        <div className="mb-3 p-3 bg-gradient-to-r from-orange-50 via-yellow-50 to-pink-50 rounded-xl border border-tiger-orange/20">
          <div className="flex items-center gap-2 flex-wrap mb-3">
            {dots.map((d, i) => (
              <div key={d.key} className="flex items-center gap-1.5">
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold ${
                  d.done ? "bg-green-100 text-green-700" : "bg-white text-gray-500 border border-gray-200"
                }`}>
                  <span>{d.done ? "✅" : "⬜"}</span>
                  <span>{d.label}</span>
                </div>
                {i < dots.length - 1 && <span className="text-gray-300">→</span>}
              </div>
            ))}
          </div>
          {!allDone && nextStep && (
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-xs text-ink-900">
                <span className="text-tiger-orange font-bold">다음:</span> {nextStep.label}
              </div>
              <button
                onClick={() => {
                  if (nextStep.key === "marketing") generateMarketingMeta();
                  else if (nextStep.key === "meta") {
                    if (!(project as any).metaAdPackage) generateMetaPackage();
                    else generateMetaImages();
                  } else if (nextStep.key === "repurpose") {
                    const channels: RepurposeChannel[] = ["instagram", "youtube", "blog", "email", "kakao"];
                    const existing: any = (project as any).repurposedContent ?? {};
                    const firstNeed = channels.find(ch => !existing[ch]) ?? "instagram";
                    generateRepurpose(firstNeed);
                  }
                }}
                disabled={!!bundleBusy || !!loading || nextStep.key === "book"}
                className="px-3 py-1.5 bg-tiger-orange text-white rounded-lg text-xs font-black hover:bg-orange-600 transition disabled:opacity-50"
              >
                → 다음: {nextStep.label}
              </button>
            </div>
          )}
          {allDone && (
            <div className="text-xs text-green-700 font-bold">🎉 모든 단계 완료! 풀 패키지 준비됐습니다.</div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2">
          {bundleCard("publish", "🎯 출간 패키지", "약 ₩900", "표지 + EPUB + 마케팅 카피", "from-tiger-orange to-orange-600")}
          {bundleCard("growth", "📈 성장 패키지", "약 ₩2,500", "출간 + Meta 광고 카피·이미지 + 마케팅 페이지", "from-blue-500 to-blue-700", "추천")}
          {bundleCard("full", "🚀 풀 패키지", "약 ₩6,300", "성장 + 5채널 재가공 (인스타·유튜브·블로그·이메일·카톡)", "from-pink-500 to-purple-600")}
        </div>

        {bundleBusy && bundleProgress && (
          <div className="mt-3 p-2.5 bg-orange-50 border border-tiger-orange/30 rounded-lg text-xs text-ink-900">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold">⏳ {bundleProgress.label}</span>
              <span className="font-mono text-gray-500">{bundleProgress.step}/{bundleProgress.total}</span>
            </div>
            <div className="h-1.5 bg-white rounded-full overflow-hidden">
              <div className="h-full bg-tiger-orange transition-all" style={{ width: `${(bundleProgress.step / bundleProgress.total) * 100}%` }} />
            </div>
            <p className="text-[10px] text-gray-500 mt-1.5">완료된 항목은 자동 스킵.</p>
          </div>
        )}
      </div>
    );
  })();

  // 카드뉴스 인포그래픽 — Wave B3
  const infographicBox = (
    <div className="p-3 sm:p-4 bg-white rounded-xl border border-gray-200">
      {!(project as any).referencesSummary?.keyPoints?.length && (
        <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-[11px] text-yellow-800">
          ⚠️ 먼저{" "}
          <Link href={`/write/setup?id=${projectId}`} className="text-tiger-orange font-bold hover:underline">자료 분석</Link>
          이 필요합니다.
        </div>
      )}
      <p className="text-[11px] text-gray-500 mb-2">책의 핵심 5가지 → 1080×1080 PNG 5장</p>
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <span className="text-[11px] font-bold text-gray-600">템플릿:</span>
        {(["minimal", "bold", "dark"] as const).map(t => (
          <button
            key={t}
            onClick={() => setInfographicTemplate(t)}
            disabled={infographicBusy}
            className={`px-2 py-0.5 text-[11px] rounded-full border transition ${
              infographicTemplate === t
                ? "bg-tiger-orange text-white border-tiger-orange font-bold"
                : "bg-white border-gray-200 text-gray-700 hover:border-tiger-orange"
            }`}
          >
            {t === "minimal" ? "🤍 미니멀" : t === "bold" ? "🟧 볼드" : "⬛ 다크"}
          </button>
        ))}
      </div>
      <button
        onClick={generateInfographic}
        disabled={infographicBusy || !((project as any).referencesSummary?.keyPoints?.length)}
        className="w-full px-3 py-2 bg-tiger-orange text-white rounded text-xs font-black hover:bg-orange-600 transition disabled:opacity-50"
      >
        {infographicBusy ? "⏳ 5장 생성 중..." : infographic ? "🔄 다시 생성" : "✨ 5장 생성 (~₩1,000)"}
      </button>
      {infographic && infographic.slides.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] text-gray-500 mb-1.5">{infographic.template} · {new Date(infographic.generatedAt).toLocaleString("ko-KR")}</p>
          <div className="grid grid-cols-3 gap-1.5">
            {infographic.slides.map(slide => (
              <div key={slide.slideNum} className="bg-[#fafafa] rounded p-1 border border-gray-200 relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:image/png;base64,${slide.base64}`}
                  alt={`infographic ${slide.slideNum}`}
                  className="w-full aspect-square object-cover rounded mb-1"
                />
                <div className="flex gap-0.5 items-center">
                  <button
                    onClick={() => downloadInfographicSlide(slide)}
                    className="flex-1 px-1 py-0.5 bg-ink-900 text-white text-[9px] font-bold rounded hover:bg-black transition"
                  >
                    ⬇{slide.slideNum}
                  </button>
                  {projectId && (
                    <ImageRefineButton
                      projectId={projectId}
                      imageType="infographic"
                      aspectRatio="1:1"
                      onRefined={(b64) => {
                        setInfographic(prev => prev ? {
                          ...prev,
                          slides: prev.slides.map(s =>
                            s.slideNum === slide.slideNum ? { ...s, base64: b64 } : s
                          ),
                        } : prev);
                      }}
                      onBalanceChange={setBalance}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // 미리보기 영상 frames — Wave B6
  const previewVideoBox = (
    <div className="p-3 sm:p-4 bg-white rounded-xl border border-gray-200">
      <p className="text-[11px] text-gray-500 mb-2">9:16 PNG 5장 (인스타 릴스 / 유튜브 쇼츠)</p>
      {!project.chapters.some(c => c.content) ? (
        <p className="text-[11px] text-gray-400 italic px-1">먼저 챕터를 1개 이상 집필하세요.</p>
      ) : (
        <button
          onClick={generatePreviewVideo}
          disabled={previewVideoBusy}
          className="w-full px-3 py-2 bg-tiger-orange text-white rounded text-xs font-black hover:bg-orange-600 transition disabled:opacity-50"
        >
          {previewVideoBusy ? "⏳ 5장 생성 중..." : previewVideo ? "🔄 다시 생성" : "🎬 5장 frame 생성 (~₩500)"}
        </button>
      )}
      {previewVideo && previewVideo.frames.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] text-gray-500 mb-1.5">{new Date(previewVideo.generatedAt).toLocaleString("ko-KR")}</p>
          <div className="grid grid-cols-3 gap-1.5">
            {previewVideo.frames.map(frame => (
              <div key={frame.idx} className="bg-[#fafafa] rounded p-1 border border-gray-200 relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:image/png;base64,${frame.base64}`}
                  alt={`preview frame ${frame.idx + 1}`}
                  className="w-full aspect-[9/16] object-cover rounded mb-1 bg-white"
                />
                <div className="flex gap-0.5 items-center">
                  <button
                    onClick={() => downloadPreviewFrame(frame)}
                    className="flex-1 px-1 py-0.5 bg-ink-900 text-white text-[9px] font-bold rounded hover:bg-black transition"
                  >
                    ⬇{frame.idx + 1}
                  </button>
                  {projectId && (
                    <ImageRefineButton
                      projectId={projectId}
                      imageType="video-frame"
                      aspectRatio="9:16"
                      onRefined={(b64) => {
                        setPreviewVideo(prev => prev ? {
                          ...prev,
                          frames: prev.frames.map(f =>
                            f.idx === frame.idx ? { ...f, base64: b64 } : f
                          ),
                        } : prev);
                      }}
                      onBalanceChange={setBalance}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-[10px] text-amber-900 leading-relaxed">
            💡 CapCut · 인스타 릴스 · 프리미어 등에서 import → 12초씩 배치 + 음악 → 1분 영상.
          </div>
        </div>
      )}
    </div>
  );

  // === 확장 탭 슬롯 ===
  // 오디오북
  const audiobookBox = (
    <div className="p-3 sm:p-4 bg-gradient-to-br from-purple-50 to-teal-50 rounded-xl border border-purple-200">
      <p className="text-[11px] text-gray-500 mb-2">한국어 TTS WAV (Gemini · Charon)</p>
      {!project.chapters.some(c => c.content) ? (
        <p className="text-[11px] text-gray-400 italic px-1">먼저 챕터를 1개 이상 집필하세요.</p>
      ) : audiobook?.chapters && audiobook.chapters.length > 0 ? (
        <>
          <div className="space-y-1.5">
            {audiobook.chapters.map((c) => (
              <div key={c.chapterIdx} className="flex items-center gap-1.5 p-1.5 bg-white rounded border border-purple-100">
                <span className="text-[10px] font-bold text-purple-600 w-6 text-center shrink-0">{c.chapterIdx + 1}</span>
                <span className="text-[10px] text-gray-700 truncate flex-1 min-w-0" title={c.title}>{c.title}</span>
                <audio controls className="h-7 shrink-0" style={{ maxWidth: 160 }} src={`data:audio/wav;base64,${c.wavBase64}`} />
                <button
                  onClick={() => downloadAudio(c)}
                  className="text-[10px] px-1 py-0.5 text-purple-600 hover:bg-purple-50 rounded shrink-0"
                  title="WAV 다운"
                >
                  💾
                </button>
              </div>
            ))}
          </div>
          {audiobook.chapters.length < project.chapters.length && (
            <button
              onClick={() => generateAudiobook(false)}
              disabled={audiobookBusy}
              className="mt-2 px-3 py-1.5 bg-purple-500 text-white rounded text-xs font-bold hover:bg-purple-600 transition disabled:opacity-50"
            >
              {audiobookBusy
                ? (audiobookProgress ?? "⏳ 생성 중...")
                : `🎙️ 남은 ${project.chapters.length - audiobook.chapters.length}장 (~₩${((project.chapters.length - audiobook.chapters.length) * 300).toLocaleString()})`}
            </button>
          )}
          <p className="mt-1.5 text-[10px] text-gray-500">
            {new Date(audiobook.generatedAt).toLocaleString("ko-KR")} · {audiobook.chapters.length}/{project.chapters.length}장
          </p>
        </>
      ) : (
        <button
          onClick={() => generateAudiobook(false)}
          disabled={audiobookBusy}
          className="w-full px-3 py-2 bg-purple-500 text-white rounded text-xs font-black hover:bg-purple-600 transition disabled:opacity-50"
        >
          {audiobookBusy
            ? (audiobookProgress ?? "⏳ 생성 중...")
            : `🎙️ 오디오북 생성 (${project.chapters.length}챕터, ~₩${project.chapters.length * 50})`}
        </button>
      )}
    </div>
  );

  // 강의 슬라이드
  const courseSlidesBox = (
    <div className="p-3 sm:p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
      <p className="text-[11px] text-gray-500 mb-2">책 → 강사·코치용 outline</p>
      {!project.chapters.some(c => c.content) ? (
        <p className="text-[11px] text-gray-400 italic px-1">먼저 챕터를 1개 이상 집필하세요.</p>
      ) : !courseSlides ? (
        <>
          <div className="flex items-center gap-1 mb-2 flex-wrap">
            <span className="text-[11px] font-bold text-gray-600">슬라이드:</span>
            {([8, 12, 16, 20] as const).map(n => (
              <button
                key={n}
                onClick={() => setCourseSlideCount(n)}
                disabled={courseSlidesBusy}
                className={`px-2 py-0.5 text-[11px] rounded-full border transition ${
                  courseSlideCount === n
                    ? "bg-blue-600 text-white border-blue-600 font-bold"
                    : "bg-white border-gray-200 text-gray-700 hover:border-blue-500"
                }`}
              >
                {n}장
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 mb-2 flex-wrap">
            <span className="text-[11px] font-bold text-gray-600">템플릿:</span>
            {([
              { id: "minimal" as const, label: "🤍" },
              { id: "bold" as const, label: "⬛" },
              { id: "academic" as const, label: "📘" },
            ]).map(t => (
              <button
                key={t.id}
                onClick={() => setCourseSlideTemplate(t.id)}
                disabled={courseSlidesBusy}
                className={`px-2 py-0.5 text-[11px] rounded-full border transition ${
                  courseSlideTemplate === t.id
                    ? "bg-blue-600 text-white border-blue-600 font-bold"
                    : "bg-white border-gray-200 text-gray-700 hover:border-blue-500"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 mb-2 text-[11px] text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={courseSlideRender}
              onChange={e => setCourseSlideRender(e.target.checked)}
              disabled={courseSlidesBusy}
              className="w-3.5 h-3.5"
            />
            <span>🖼️ 이미지 렌더 <span className="text-gray-500">(+₩{courseSlideCount * 10})</span></span>
          </label>
          <button
            onClick={generateCourseSlides}
            disabled={courseSlidesBusy}
            className="w-full px-3 py-2 bg-blue-600 text-white rounded text-xs font-black hover:bg-blue-700 transition disabled:opacity-50"
          >
            {courseSlidesBusy ? "⏳ 생성 중..." : `🎙️ 슬라이드 생성 (~₩2,000)`}
          </button>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-1 mb-2 flex-wrap">
            <p className="text-[11px] font-bold text-ink-900">
              {courseSlides.slides.length}장 · {courseSlides.template}
            </p>
            <button
              onClick={generateCourseSlides}
              disabled={courseSlidesBusy}
              className="px-2 py-0.5 text-[11px] bg-white border border-blue-300 text-blue-700 rounded font-bold hover:bg-blue-50 transition disabled:opacity-50"
            >
              {courseSlidesBusy ? "⏳" : "🔄 재생성"}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {courseSlides.slides.map(slide => (
              <div
                key={slide.slideNum}
                className="bg-white rounded p-1.5 border border-blue-100 flex flex-col gap-1"
              >
                {slide.pngBase64 && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`data:image/png;base64,${slide.pngBase64}`}
                    alt={`슬라이드 ${slide.slideNum}`}
                    className="w-full aspect-video object-cover rounded border border-gray-200"
                  />
                )}
                <div className="flex items-start gap-1">
                  <span className="text-[9px] font-mono font-bold text-blue-600 mt-0.5 shrink-0">
                    {String(slide.slideNum).padStart(2, "0")}
                  </span>
                  <p className="text-[10px] font-bold text-ink-900 leading-snug line-clamp-2">{slide.title}</p>
                </div>
                <div className="flex items-center gap-0.5 mt-auto">
                  <button
                    onClick={() => copyCourseSlide(slide)}
                    className="flex-1 px-1 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[9px] font-bold rounded transition"
                  >
                    📋
                  </button>
                  {slide.pngBase64 && (
                    <button
                      onClick={() => downloadCourseSlidePng(slide)}
                      className="flex-1 px-1 py-0.5 bg-blue-600 hover:bg-blue-700 text-white text-[9px] font-bold rounded transition"
                    >
                      💾
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] text-gray-500">
            {new Date(courseSlides.generatedAt).toLocaleString("ko-KR")}
          </p>
        </>
      )}
    </div>
  );

  // 책 번역
  const translationBox = (
    <div className="p-3 sm:p-4 bg-indigo-50/60 border border-indigo-300/50 rounded-lg">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
        <span className="text-[11px] text-indigo-700">~₩2,000/책 (전체)</span>
      </div>
      <p className="text-[11px] text-gray-600 mb-2">한국어 책 → 영어 또는 일본어. KDP/Amazon 글로벌 진출용.</p>
      <div className="flex gap-1.5 mb-2">
        {(["en", "ja"] as TranslationLang[]).map(lang => {
          const label = lang === "en" ? "🇺🇸 영어" : "🇯🇵 일본어";
          const active2 = translateLang === lang;
          return (
            <button
              key={lang}
              onClick={() => setTranslateLang(lang)}
              disabled={translateBusy}
              className={`flex-1 px-2 py-1 text-[11px] rounded font-bold border ${
                active2
                  ? "bg-indigo-500 text-white border-indigo-500"
                  : "bg-white text-indigo-700 border-indigo-200 hover:border-indigo-400"
              } disabled:opacity-50`}
            >
              {label}
            </button>
          );
        })}
      </div>
      <button
        onClick={() => handleTranslate(translateLang)}
        disabled={translateBusy || !project?.chapters?.length}
        className="w-full px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded disabled:opacity-50"
      >
        {translateBusy ? "⏳ 번역 중..." : `🌐 책 전체 번역 (~₩2,000)`}
      </button>
      {translateMsg && (
        <div className="mt-2 text-[11px] text-indigo-800 bg-white border border-indigo-200 rounded p-2">
          {translateMsg}
        </div>
      )}
      {translations.length > 0 && (
        <div className="mt-3 space-y-2">
          <div className="text-[10px] font-bold text-indigo-900">완료된 번역</div>
          {translations.map(t => {
            const flag = t.language === "en" ? "🇺🇸" : "🇯🇵";
            const langLabel = t.language === "en" ? "영어" : "일본어";
            const completed = t.chapters?.filter((c: any) => c?.content).length ?? 0;
            const total = project?.chapters?.length ?? 0;
            const isOpen = translatePreviewLang === t.language;
            return (
              <div key={t.language} className="bg-white border border-indigo-200 rounded p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-indigo-900">
                    {flag} {langLabel} — {completed}/{total} 챕터
                  </div>
                  <button
                    onClick={() => setTranslatePreviewLang(isOpen ? null : t.language)}
                    className="text-[10px] text-indigo-600 hover:underline"
                  >
                    {isOpen ? "접기" : "미리보기"}
                  </button>
                </div>
                {isOpen && (
                  <div className="mt-2 max-h-60 overflow-y-auto text-[11px] text-gray-800 space-y-2 border-t border-indigo-100 pt-2">
                    <div><b>Title:</b> {t.topic}</div>
                    <div><b>Audience:</b> {t.audience}</div>
                    {(t.chapters ?? []).slice(0, 3).map((c: any, i: number) => (
                      c?.title ? (
                        <div key={i} className="border-t border-gray-100 pt-1">
                          <div className="font-bold">Ch{i + 1}: {c.title}</div>
                          {c.content && <div className="whitespace-pre-wrap line-clamp-4 text-gray-600">{c.content.slice(0, 400)}...</div>}
                        </div>
                      ) : null
                    ))}
                    {(t.chapters?.length ?? 0) > 3 && (
                      <div className="text-[10px] text-gray-500">… ({(t.chapters?.length ?? 0) - 3}개 챕터 더)</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const repurposeBoxSlot = (
    <RepurposeBox
      project={project}
      repurposed={repurposed}
      repurposeBusy={repurposeBusy}
      onGenerate={generateRepurpose}
    />
  );

  // === 운영 탭 슬롯 ===
  const shareToggleBox = (
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
  );

  const abTestBox = (
    <div className="p-3 sm:p-4 bg-white rounded-xl border border-gray-200">
      <p className="text-[11px] text-gray-500 mb-2">두 마케팅 카피 50/50 분기, cookie sticky</p>
      <div className="grid grid-cols-1 gap-2">
        <div className="p-2 bg-blue-50/50 border border-blue-200 rounded space-y-1.5">
          <div className="text-[11px] font-bold text-blue-700">A variant</div>
          <input
            type="text"
            maxLength={200}
            value={abTestForm.taglineA ?? ""}
            onChange={e => setAbTestForm(f => ({ ...f, taglineA: e.target.value }))}
            placeholder="A 한 줄 소개"
            className="w-full text-[11px] px-1.5 py-1 border border-blue-200 rounded bg-white"
          />
          <textarea
            maxLength={3000}
            rows={2}
            value={abTestForm.descriptionA ?? ""}
            onChange={e => setAbTestForm(f => ({ ...f, descriptionA: e.target.value }))}
            placeholder="A 상세 설명"
            className="w-full text-[11px] px-1.5 py-1 border border-blue-200 rounded bg-white resize-y"
          />
        </div>
        <div className="p-2 bg-purple-50/50 border border-purple-200 rounded space-y-1.5">
          <div className="text-[11px] font-bold text-purple-700">B variant</div>
          <input
            type="text"
            maxLength={200}
            value={abTestForm.taglineB ?? ""}
            onChange={e => setAbTestForm(f => ({ ...f, taglineB: e.target.value }))}
            placeholder="B 한 줄 소개"
            className="w-full text-[11px] px-1.5 py-1 border border-purple-200 rounded bg-white"
          />
          <textarea
            maxLength={3000}
            rows={2}
            value={abTestForm.descriptionB ?? ""}
            onChange={e => setAbTestForm(f => ({ ...f, descriptionB: e.target.value }))}
            placeholder="B 상세 설명"
            className="w-full text-[11px] px-1.5 py-1 border border-purple-200 rounded bg-white resize-y"
          />
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <label className="flex items-center gap-1 text-[11px] text-gray-700">
          <input
            type="checkbox"
            checked={abTestForm.enabled === true}
            onChange={e => setAbTestForm(f => ({ ...f, enabled: e.target.checked }))}
          />
          <span className="font-bold">활성화</span>
        </label>
        <button
          onClick={saveAbTest}
          disabled={abTestBusy}
          className="ml-auto px-3 py-1.5 bg-tiger-orange text-white rounded text-[11px] font-black hover:bg-orange-600 transition disabled:opacity-50"
        >
          {abTestBusy ? "저장 중..." : abTestSaved ? "✓ 저장됨" : "💾 저장"}
        </button>
        <button
          onClick={fetchAbTestStats}
          disabled={abTestStatsBusy}
          className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded text-[11px] font-bold hover:bg-gray-50 transition disabled:opacity-50"
        >
          {abTestStatsBusy ? "조회 중..." : "📊 통계"}
        </button>
      </div>
      {abTestStats && (
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {(["A", "B"] as const).map(v => (
            <div key={v} className={`p-1.5 rounded border ${v === "A" ? "bg-blue-50 border-blue-200" : "bg-purple-50 border-purple-200"}`}>
              <div className={`text-[10px] font-bold ${v === "A" ? "text-blue-700" : "text-purple-700"}`}>{v} 방문</div>
              <div className="text-[10px] text-gray-700 mt-0.5">
                24h: <strong>{abTestStats[v].views24h}</strong> · 7d: <strong>{abTestStats[v].views7d}</strong> · 전체: <strong>{abTestStats[v].viewsTotal}</strong>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const revenueBox = (
    <div className="p-3 sm:p-4 bg-green-50/60 border border-green-300/50 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-gray-600">채널별 누적 매출</span>
        {(() => {
          const net = revenueChannels.reduce(
            (sum, c) => sum + Math.floor((Number(c.grossKRW) || 0) * (1 - (Number(c.feeRate) || 0))),
            0,
          );
          return (
            <span className="text-[11px] font-mono text-green-700 font-bold">
              순매출 ₩{net.toLocaleString()}
            </span>
          );
        })()}
      </div>
      <div className="space-y-1.5">
        {revenueChannels.map((row, i) => {
          const labelMap: Record<string, string> = {
            kmong: "크몽", ridi: "리디", kyobo: "교보", aladdin: "알라딘",
            direct: "직접", other: "기타",
          };
          return (
            <div key={`${row.channel}-${i}`} className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-gray-700 w-10 shrink-0">
                {labelMap[row.channel] ?? row.channel}
              </span>
              <div className="flex items-center gap-0.5 flex-1 min-w-0">
                <span className="text-[10px] text-gray-400">₩</span>
                <input
                  type="number"
                  min={0}
                  max={100_000_000}
                  step={1000}
                  value={row.grossKRW || ""}
                  onChange={e => updateRevenueChannel(i, { grossKRW: Number(e.target.value) || 0 })}
                  placeholder="0"
                  className="flex-1 min-w-0 text-[11px] px-1.5 py-1 border border-gray-200 rounded font-mono focus:border-tiger-orange focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round((Number(row.feeRate) || 0) * 100)}
                  onChange={e => updateRevenueChannel(i, { feeRate: Math.max(0, Math.min(100, Number(e.target.value) || 0)) / 100 })}
                  className="w-10 text-[11px] px-1 py-1 border border-gray-200 rounded font-mono text-right focus:border-tiger-orange focus:outline-none"
                  title="채널 수수료 %"
                />
                <span className="text-[10px] text-gray-400">%</span>
              </div>
            </div>
          );
        })}
      </div>
      <button
        onClick={saveRevenue}
        disabled={revenueBusy}
        className="w-full mt-2 px-2 py-1.5 bg-green-600 text-white rounded text-[11px] font-bold hover:bg-green-700 transition disabled:opacity-50"
      >
        {revenueBusy ? "저장 중..." : revenueSavedFlash ? "✓ 저장됨" : "💾 저장"}
      </button>
      <p className="mt-1.5 text-[10px] text-gray-500 leading-relaxed">
        직접 입력. 자동 추적은 추후 추가 예정.
      </p>
    </div>
  );

  const kmongPackageBox = (
    <div className="space-y-1">
      <button
        onClick={generateFullKmongPackage}
        disabled={!!loading || !!kmongBusy || batch.status === "running"}
        className="w-full px-3 py-2 border-2 border-tiger-orange text-tiger-orange rounded-lg text-xs font-bold hover:bg-orange-50 transition disabled:opacity-50"
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
      <p className="text-[10px] text-gray-500 leading-relaxed">
        ZIP에 표지·썸네일·목차·스펙·독자·미리보기 + 8종 카피 + README 포함.
      </p>
    </div>
  );

  // === 챕터 본문 children: streaming / editing / content / 빈 상태 ===
  const chapterContentChildren = (() => {
    if (streamingChapterIdx === activeIdx && streamingText) {
      return (
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
      );
    }
    if (editingContent !== null) {
      const insertImagePlaceholder = () => {
        const ta = editingTextareaRef.current;
        if (!ta || editingContent === null) return;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const sample = "여기에 이미지 캡션 (예: 계단 오르는 사람의 뒷모습, 햇살 비치는 아침)";
        const placeholder = `\n\n[IMAGE: ${sample}]\n\n`;
        const next = editingContent.slice(0, start) + placeholder + editingContent.slice(end);
        setEditingContent(next);
        // 다음 tick에 캡션 부분만 선택 — 사용자가 바로 타이핑해 덮어쓰기
        setTimeout(() => {
          const captionStart = start + 10; // "\n\n[IMAGE: " 길이
          ta.focus();
          ta.setSelectionRange(captionStart, captionStart + sample.length);
        }, 0);
      };
      return (
        <>
          <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs font-mono uppercase tracking-wider text-tiger-orange">✏️ 본문 직접 편집</p>
            <div className="flex items-center gap-2">
              <button
                onClick={insertImagePlaceholder}
                className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 font-bold transition"
                title="현재 커서 위치에 [IMAGE: 캡션] 자리 삽입. 캡션을 본인 의도에 맞게 수정 후 저장 → 이미지 일괄 생성에서 자동으로 그림"
              >
                📷 이미지 자리 추가
              </button>
              <p className="text-xs font-mono text-gray-500">{editingContent.length.toLocaleString()}자</p>
            </div>
          </div>
          <textarea
            ref={editingTextareaRef}
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
                if (!projectId || editingContent === null) return;
                try {
                  // 본문만 patch — 이미지 base64 같이 안 보내서 payload 작음
                  const res = await fetch(`/api/chapter/${activeIdx}/content`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ projectId, content: editingContent }),
                  });
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.message || `저장 실패 (${res.status})`);
                  }
                  const updated = [...project.chapters];
                  updated[activeIdx] = { ...active, content: editingContent };
                  setProject({ ...project, chapters: updated });
                  setEditingContent(null);
                } catch (e: any) {
                  setError(e?.message || "저장 실패");
                }
              }}
              className="px-4 py-2 text-sm bg-tiger-orange text-white font-bold rounded-lg shadow-glow-orange-sm hover:bg-orange-600 transition"
            >
              저장
            </button>
          </div>
        </>
      );
    }
    if (active.content) {
      return (
        <>
          <div className="prose max-w-none text-sm whitespace-pre-wrap break-keep">
            {active.content}
          </div>
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
                              onClick={async () => {
                                const ok = await notify.confirm({
                                  title: "이미지 자리 제거",
                                  emoji: "🗑️",
                                  message: `이 이미지 자리를 본문에서 제거할까요?\n"${caption.slice(0, 30)}..."`,
                                  confirmLabel: "제거",
                                  variant: "danger",
                                });
                                if (ok) {
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
      );
    }
    // 빈 상태 — empty hint 자리에 표시 (children null이면 ChapterContent emptyHint 사용)
    return null;
  })();

  const chapterEmptyHint = (
    <div className="text-center py-8 px-4">
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
  );

  return (
    <>
      <Header />
      <TopHeader
        topic={project.topic}
        balanceKrw={balance}
        onExport={() => router.push(`/export?id=${projectId}`)}
        exportDisabled={!project.chapters.some(c => c.content)}
        progressItems={projectProgress.details}
        currentTab={tab}
        onGoToTab={(t) => setTab(t as any)}
        progressPercent={projectProgress.percent}
        missingItems={projectProgress.details.filter(d => !d.done).map(d => ({ label: d.label, hint: d.hint, tab: d.tab }))}
      />

      {/* v3 Phase 2.2 — 책 통과 가능성 배지 (heuristic, AI 호출 없음) */}
      {/* v3 Phase 4.2 — 완성 축하 피드 (왼쪽), BookQualityBadge (오른쪽) — 같은 행 공유 */}
      {projectId && (
        <div className="max-w-[1600px] mx-auto px-4 pt-2 flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 max-w-md w-full sm:w-auto">
            <CompletionFeed />
          </div>
          <BookQualityBadge bookId={projectId} />
        </div>
      )}

      {error && (
        <div className="max-w-[1600px] mx-auto px-4 py-2">
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
        </div>
      )}

      <WritePageLayout
        tab={tab}
        chapterList={
          <ChapterListNew
            chapters={chapterListChapters}
            activeIdx={activeIdx}
            onSelect={(idx) => {
              if (editingContent !== null && idx !== activeIdx && !confirm("편집 중인 내용이 있습니다. 저장 안 하고 다른 챕터로 이동할까요?")) return;
              if (idx !== activeIdx) setEditingContent(null);
              setActiveIdx(idx);
            }}
            onAdd={async (title) => {
              setAddChapterDraft({ title, subtitle: "" });
              setAddChapterOpen(true);
            }}
            onEditTitle={(idx) => startEditTitle(idx)}
            disabled={!!loading}
          />
        }
        chapterContent={
          <>
            <BatchBanner
              batch={batch}
              onStop={stopBatch}
              onResume={resumeBatch}
              onDismiss={() => setBatch({ status: "idle" })}
            />
            {active && (
              <>
                <ChapterContentNew
                  chapterIdx={activeIdx}
                  totalChapters={project.chapters.length}
                  title={active.title}
                  subtitle={active.subtitle}
                  hasContent={!!active.content}
                  busyGenerating={streamingChapterIdx === activeIdx || (loading.startsWith(`${activeIdx + 1}`) || loading.includes(`${activeIdx + 1}/`))}
                  onGenerate={!active.content ? () => generateChapter(activeIdx) : undefined}
                  onPreview={active.content ? () => setPreviewModal({ chapterIdx: activeIdx }) : undefined}
                  onAIEdit={active.content && editingContent === null ? () => setEditChat({ chapterIdx: activeIdx, instruction: "", proposal: null, busy: false }) : undefined}
                  onDirectEdit={active.content && editingContent === null ? () => setEditingContent(active.content) : undefined}
                  onRegenerate={active.content && editingContent === null ? () => generateChapter(activeIdx) : undefined}
                  emptyHint={chapterEmptyHint}
                >
                  {chapterContentChildren}
                </ChapterContentNew>

                {/* v3 Phase 2 — 챕터 품질 점수 + 자연어 재생성 */}
                {projectId && active.content && editingContent === null && streamingChapterIdx !== activeIdx && (
                  <div className="max-w-3xl mx-auto px-4 md:px-6 pb-8 space-y-3">
                    <QualityScore
                      chapterIdx={activeIdx}
                      projectId={projectId}
                      chapterContentLength={active.content.length}
                      cachedScore={(active as any).qualityScore as QualityScoreData | undefined}
                      balanceKrw={balance}
                      onScored={(d) => {
                        // 잔액 동기화 + 챕터 캐시 업데이트
                        setBalance(d.newBalance);
                        const chapters = [...project.chapters];
                        chapters[activeIdx] = {
                          ...chapters[activeIdx],
                          qualityScore: { score: d.score, suggestions: d.suggestions, generatedAt: d.generatedAt },
                        } as any;
                        setProject({ ...project, chapters });
                      }}
                    />
                    <div className="flex items-center justify-end">
                      <ChapterRegenerateButton
                        chapterIdx={activeIdx}
                        projectId={projectId}
                        chapterContentLength={active.content.length}
                        balanceKrw={balance}
                        onSuccess={(newContent, newBalance) => {
                          setBalance(newBalance);
                          const chapters = [...project.chapters];
                          // 재생성 시 qualityScore·summary 무효화 (서버도 동일)
                          const { qualityScore: _q, summary: _s, ...rest } = (chapters[activeIdx] as any);
                          chapters[activeIdx] = { ...rest, content: newContent };
                          setProject({ ...project, chapters });
                        }}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        }
        tabContent={
          <>
            {tab === "writing" && (
              <WritingTab
                bulkWritingControls={bulkWritingControls}
                bulkImageControls={bulkImageControls}
                coverVariationsControls={coverVariationsControls}
                templateSelector={templateSelectorBox}
              />
            )}
            {tab === "publish" && (
              <PublishTab
                marketingPageBox={marketingPageBoxSlot}
                metaAdsBox={metaAdsBoxSlot}
                packageRecommendationBox={packageRecommendationBox}
                infographicBox={infographicBox}
                previewVideoBox={previewVideoBox}
              />
            )}
            {tab === "extras" && (
              <ExtrasTab
                audiobookBox={audiobookBox}
                courseSlidesBox={courseSlidesBox}
                translationBox={translationBox}
                repurposeBox={repurposeBoxSlot}
              />
            )}
            {tab === "ops" && (
              <OpsTab
                shareToggleBox={shareToggleBox}
                abTestBox={abTestBox}
                revenueBox={revenueBox}
                kmongPackageBox={kmongPackageBox}
              />
            )}
          </>
        }
      />

      <MobileBottomNav active={tab} setTab={setTab} hints={{ publish: showPublishHint }} />

      {/* === 챕터 추가 inline form (writing 탭에서만 보임) === */}
      {addChapterOpen && tab === "writing" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4" onClick={() => { setAddChapterOpen(false); setAddChapterDraft({ title: "", subtitle: "" }); }}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-black mb-4">챕터 추가</h3>
            <input
              type="text"
              autoFocus
              value={addChapterDraft.title}
              onChange={e => setAddChapterDraft(d => ({ ...d, title: e.target.value }))}
              onKeyDown={e => { if (e.key === "Enter" && addChapterDraft.title.trim()) submitAddChapter(); if (e.key === "Escape") { setAddChapterOpen(false); setAddChapterDraft({ title: "", subtitle: "" }); } }}
              placeholder="챕터 제목 *"
              maxLength={100}
              className="w-full text-sm px-3 py-2 border border-gray-200 rounded mb-2 focus:border-tiger-orange focus:outline-none"
            />
            <input
              type="text"
              value={addChapterDraft.subtitle}
              onChange={e => setAddChapterDraft(d => ({ ...d, subtitle: e.target.value }))}
              onKeyDown={e => { if (e.key === "Enter" && addChapterDraft.title.trim()) submitAddChapter(); if (e.key === "Escape") { setAddChapterOpen(false); setAddChapterDraft({ title: "", subtitle: "" }); } }}
              placeholder="부제 (선택)"
              maxLength={150}
              className="w-full text-sm px-3 py-2 border border-gray-200 rounded mb-4 focus:border-tiger-orange focus:outline-none"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setAddChapterOpen(false); setAddChapterDraft({ title: "", subtitle: "" }); }}
                className="px-4 py-2 text-sm border border-gray-200 rounded hover:bg-gray-50 transition"
              >
                취소
              </button>
              <button
                onClick={submitAddChapter}
                disabled={!addChapterDraft.title.trim() || !!loading}
                className="px-4 py-2 bg-tiger-orange text-white rounded text-sm font-bold hover:bg-orange-600 transition disabled:opacity-50"
              >
                추가
              </button>
            </div>
          </div>
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

      {/* 마지막 호출 사용량 — 모바일에서는 MobileBottomNav (60px) 위로 이동 */}
      {lastUsage && (
        <div className="fixed bottom-[60px] lg:bottom-0 left-0 right-0 bg-ink-900 text-white text-xs py-2 px-4 z-20">
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

          {/* 표지 다양화 (3~5종 다른 스타일) — WritingTab의 CoverVariationsBox로 이동됨 (중복 제거). */}

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
              <p className="text-[10px] text-tiger-orange font-bold mt-1">💰 수정안 요청 1회 ≈ ₩50~150 (챕터 길이·티어 기준)</p>
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
                {editChat.busy ? "AI 작업 중..." : "✨ 수정안 요청 (~₩50)"}
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
                  disabled={editChat.busy}
                  className="flex-1 py-2 bg-tiger-orange text-white rounded-lg text-sm font-bold hover:bg-orange-600 disabled:opacity-50"
                >
                  {editChat.busy ? "저장 중..." : "✓ 챕터 본문에 적용"}
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

    {/* 레이아웃 템플릿 미리보기 모달 */}
    {previewModal && project && (
      <TemplatePreviewModal
        open
        onClose={() => setPreviewModal(null)}
        templateKey={(project as any).template}
        themeColor={(project as any).themeColor}
        chapter={project.chapters[previewModal.chapterIdx]}
        chapterIdx={previewModal.chapterIdx}
        totalChapters={project.chapters.length}
      />
    )}
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

// KmongGuideBox + 헬퍼들(KMONG_CATEGORIES / suggestKmongPriceKRW / suggestKmongKeywords / CopyButton) →
// MarketingPageBox.tsx 내부로 이동됨 (해당 박스 안에서만 사용).
