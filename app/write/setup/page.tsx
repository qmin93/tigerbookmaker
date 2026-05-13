"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/Header";
import { ProgressBar, STEP_INDEX, type SetupStepKey } from "@/components/write/ProgressBar";
import { AnalyzeStep, type ReferencesSummaryView } from "@/components/write/setup/AnalyzeStep";
import { InterviewStep } from "@/components/write/setup/InterviewStep";
import { StyleStep } from "@/components/write/setup/StyleStep";
import { TocStep } from "@/components/write/setup/TocStep";
import { AutoSaveIndicator } from "@/components/write/AutoSaveIndicator";
import { loadAutoSaved, loadAutoSavedAt } from "@/lib/auto-save";
import type { ThemeColorKey, ToneSetting } from "@/lib/storage";
import type { LayoutKey } from "@/lib/cover-style-map";

const VALID_STEPS: SetupStepKey[] = ["analyze", "interview", "style", "toc"];

function isValidStep(s: string | null): s is SetupStepKey {
  return !!s && (VALID_STEPS as string[]).includes(s);
}

// v3 Phase 1.2 — localStorage 키 prefix (substep별 분리, 부모는 통합 indicator 상태만 관리)
const autoSaveKey = (id: string, step: "analyze" | "interview" | "style") =>
  `tbm-autosave-project-${id}-${step}`;

interface AutoSaveState {
  isSyncing: boolean;
  lastSyncedAt: number | null;
  error: Error | null;
}

interface QA { q: string; a: string }
interface RestoredDrafts {
  interview?: { history?: QA[] };
  style?: { toneExcerpt?: string };
  analyze?: { refUrlInput?: string; refTextInput?: string; refYoutubeInput?: string };
}

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const projectId = params.get("id");
  const stepParam = params.get("step");

  const [project, setProject] = useState<any>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [referencesSummary, setReferencesSummary] = useState<ReferencesSummaryView | null>(null);
  const [toneSetting, setToneSetting] = useState<ToneSetting | null>(null);
  const [themeColor, setThemeColor] = useState<ThemeColorKey>("orange");
  const [coverLayoutKey, setCoverLayoutKey] = useState<LayoutKey | null>(null);
  const [refCount, setRefCount] = useState<number | null>(null);

  // v3 Phase 1.2 — 자동 저장 indicator 통합 상태 (substep 별 상태를 합쳐서 표시)
  const [autoSaveState, setAutoSaveState] = useState<AutoSaveState>({
    isSyncing: false,
    lastSyncedAt: null,
    error: null,
  });
  // localStorage 에서 복원한 draft (substep에 prop으로 전달)
  const [restoredDrafts, setRestoredDrafts] = useState<RestoredDrafts>({});
  const [restoreToastVisible, setRestoreToastVisible] = useState(false);

  // ──── Project load ────
  useEffect(() => {
    if (!projectId) {
      router.push("/projects");
      return;
    }
    fetch(`/api/projects/${projectId}`)
      .then(async r => {
        if (r.status === 401) {
          router.push(`/login?redirect=/write/setup?id=${projectId}`);
          return;
        }
        if (!r.ok) throw new Error("프로젝트 로드 실패");
        return r.json();
      })
      .then(p => {
        if (!p) return;
        setProject(p);
        if (p.referencesSummary) setReferencesSummary(p.referencesSummary);
        if (p.toneSetting) setToneSetting(p.toneSetting);
        if (p.themeColor) setThemeColor(p.themeColor);
        if (p.coverLayoutKey) setCoverLayoutKey(p.coverLayoutKey as LayoutKey);
      })
      .catch(e => setError(e.message));
  }, [projectId, router]);

  // ──── Balance load ────
  useEffect(() => {
    fetch("/api/me")
      .then(r => (r.ok ? r.json() : null))
      .then(d => d && setBalance(d.balance_krw));
  }, []);

  // ──── v3 Phase 1.2: localStorage 복원 ────
  // /write/setup?id=X 진입 시 localStorage 에 draft가 있으면 substep에 주입.
  // DB의 updated_at 이 localStorage savedAt 보다 옛것이면 → localStorage 우선.
  // (즉 사용자가 마지막으로 입력한 시점이 DB보다 새것이면 그걸 복원)
  useEffect(() => {
    if (!projectId || !project) return;
    // 프로젝트 1회 로드 후에만 비교 — 매번 다시 복원하지 않도록 가드
    if (Object.keys(restoredDrafts).length > 0) return;

    const dbUpdatedAt = project?.updatedAt ? new Date(project.updatedAt).getTime() : 0;
    const drafts: RestoredDrafts = {};
    let didRestore = false;

    // Interview
    const interviewKey = autoSaveKey(projectId, "interview");
    const interviewSaved = loadAutoSaved<{ interviewDraft?: { history?: QA[]; updatedAt?: number } }>(interviewKey);
    const interviewSavedAt = loadAutoSavedAt(interviewKey) ?? 0;
    if (interviewSaved?.interviewDraft?.history && interviewSaved.interviewDraft.history.length > 0) {
      const dbHistory: QA[] = project?.interview?.questions ?? [];
      // localStorage history가 DB보다 더 길거나 (in-progress), localStorage가 더 새것이면 복원
      if (interviewSaved.interviewDraft.history.length > dbHistory.length || interviewSavedAt > dbUpdatedAt) {
        drafts.interview = { history: interviewSaved.interviewDraft.history };
        didRestore = true;
      }
    }

    // Style — toneExcerpt 만 복원 (toneSetting/themeColor/coverLayoutKey 는 DB 캐노니컬)
    const styleKey = autoSaveKey(projectId, "style");
    const styleSaved = loadAutoSaved<{ styleDraft?: { toneExcerpt?: string } }>(styleKey);
    if (styleSaved?.styleDraft?.toneExcerpt && styleSaved.styleDraft.toneExcerpt.trim().length > 0) {
      drafts.style = { toneExcerpt: styleSaved.styleDraft.toneExcerpt };
      didRestore = true;
    }

    // Analyze — draft 입력
    const analyzeKey = autoSaveKey(projectId, "analyze");
    const analyzeSaved = loadAutoSaved<{
      analyzeDraft?: { refUrlInput?: string; refTextInput?: string; refYoutubeInput?: string };
    }>(analyzeKey);
    if (analyzeSaved?.analyzeDraft) {
      const d = analyzeSaved.analyzeDraft;
      if ((d.refUrlInput?.trim() || d.refTextInput?.trim() || d.refYoutubeInput?.trim()) ?? false) {
        drafts.analyze = d;
        didRestore = true;
      }
    }

    setRestoredDrafts(drafts);
    if (didRestore) {
      setRestoreToastVisible(true);
      // 5초 후 자동 사라짐
      setTimeout(() => setRestoreToastVisible(false), 5000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, project]);

  // ──── Reference count probe (for default-redirect logic) ────
  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/reference/list?projectId=${projectId}`)
      .then(r => (r.ok ? r.json() : { references: [] }))
      .then(d => setRefCount((d.references || []).length))
      .catch(() => setRefCount(0));
  }, [projectId]);

  // ──── URL → currentStep + default-redirect ────
  // No ?step: pick best starting step based on project state.
  //   - No references → analyze (자료 업로드 시작점)
  //   - References exist, no summary → analyze (자료 확인 필요)
  //   - References + summary, no interview → interview
  //   - Interview done, no tone → style
  //   - Interview done + tone done → toc
  const defaultStep = useMemo<SetupStepKey | null>(() => {
    if (!project) return null;
    const hasInterview = !!project.interview?.completedAt;
    const hasTone = !!toneSetting;
    const hasCover = !!coverLayoutKey;
    // style 단계는 tone + coverLayoutKey 둘 다 있어야 완료 (Spec PR #3)
    if (hasInterview && hasTone && hasCover) return "toc";
    if (hasInterview && (!hasTone || !hasCover)) return "style";
    // Interview not done
    if ((refCount ?? 0) === 0) return "analyze";
    if (referencesSummary) return "interview";
    return "analyze";
  }, [project, refCount, referencesSummary, toneSetting, coverLayoutKey]);

  const currentStep: SetupStepKey | null = isValidStep(stepParam) ? stepParam : defaultStep;

  // Sync URL if no/invalid ?step (router.replace, not push, so back-button doesn't loop)
  useEffect(() => {
    if (!projectId || !defaultStep) return;
    if (!isValidStep(stepParam)) {
      router.replace(`/write/setup?id=${projectId}&step=${defaultStep}`);
    }
  }, [projectId, stepParam, defaultStep, router]);

  // ──── Step navigation helpers ────
  const goToStep = useCallback(
    (next: SetupStepKey) => {
      if (!projectId) return;
      // 새 substep 으로 가면 indicator 초기화 (새 substep 의 useAutoSave 가 곧 보고)
      setAutoSaveState({ isSyncing: false, lastSyncedAt: null, error: null });
      router.replace(`/write/setup?id=${projectId}&step=${next}`);
    },
    [projectId, router],
  );

  // Completed-step set, used by ProgressBar checkmarks
  const completedSteps = useMemo<SetupStepKey[]>(() => {
    const done: SetupStepKey[] = [];
    if (refCount === 0 || referencesSummary) done.push("analyze");
    if (project?.interview?.completedAt) done.push("interview");
    if (toneSetting && coverLayoutKey) done.push("style");
    return done;
  }, [refCount, referencesSummary, project, toneSetting, coverLayoutKey]);

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

  if (!currentStep) {
    return (
      <main className="min-h-screen bg-[#fafafa]">
        <Header />
        <div className="max-w-2xl mx-auto px-6 py-20 text-center text-gray-500">단계 결정 중...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fafafa]">
      <Header />
      <ProgressBar currentStep={currentStep} completedSteps={completedSteps} />

      {/* v3 Phase 1.2 — 자동 저장 indicator (sticky top, ProgressBar 바로 아래) */}
      <div className="sticky top-[56px] sm:top-[68px] z-20 w-full bg-transparent pointer-events-none">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 flex justify-end -mt-1">
          <div className="pointer-events-auto">
            <AutoSaveIndicator
              isSyncing={autoSaveState.isSyncing}
              lastSyncedAt={autoSaveState.lastSyncedAt}
              error={autoSaveState.error}
            />
          </div>
        </div>
      </div>

      {/* v3 Phase 1.2 — 복원 토스트 */}
      {restoreToastVisible && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-ink-900 text-white px-4 py-2.5 rounded-lg shadow-lg text-xs font-mono flex items-center gap-2 animate-fade-in">
          <span>💾</span>
          <span>이전에 작업하던 내용을 복원했어요</span>
          <button
            onClick={() => setRestoreToastVisible(false)}
            className="ml-2 text-gray-400 hover:text-white"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-6 py-8 md:py-12">
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/projects"
            className="text-xs font-mono uppercase tracking-wider text-gray-500 hover:text-tiger-orange"
          >
            ← 내 책
          </Link>
          <span className="text-xs font-mono text-gray-500">잔액 ₩{balance?.toLocaleString() ?? "—"}</span>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <p className="text-xs font-mono uppercase tracking-wider text-tiger-orange mb-1">집필 중인 책</p>
          <h1 className="text-base font-bold text-ink-900 line-clamp-1">{project.topic}</h1>
          <p className="text-xs text-gray-500 mt-1">
            {project.audience} · {project.type}
          </p>
        </div>

        {currentStep === "analyze" && projectId && (
          <AnalyzeStep
            projectId={projectId}
            referencesSummary={referencesSummary}
            onSummaryChange={setReferencesSummary}
            onBalanceChange={setBalance}
            onError={setError}
            onAdvance={() => goToStep("interview")}
            onAutoSaveState={setAutoSaveState}
            initialDraft={restoredDrafts.analyze}
          />
        )}

        {currentStep === "interview" && projectId && (
          <InterviewStep
            projectId={projectId}
            onBalanceChange={setBalance}
            onError={setError}
            onComplete={() => {
              // Refresh project so interview.completedAt is reflected in completedSteps
              fetch(`/api/projects/${projectId}`)
                .then(r => (r.ok ? r.json() : null))
                .then(p => p && setProject(p))
                .catch(() => {});
              goToStep("style");
            }}
            onAutoSaveState={setAutoSaveState}
            initialHistory={restoredDrafts.interview?.history}
          />
        )}

        {currentStep === "style" && projectId && (
          <StyleStep
            projectId={projectId}
            bookType={project.type}
            themeColor={themeColor}
            toneSetting={toneSetting}
            coverLayoutKey={coverLayoutKey}
            onThemeColorChange={setThemeColor}
            onToneSettingChange={setToneSetting}
            onCoverLayoutChange={setCoverLayoutKey}
            onBalanceChange={setBalance}
            onError={setError}
            onAdvance={() => goToStep("toc")}
            onAutoSaveState={setAutoSaveState}
            initialToneExcerpt={restoredDrafts.style?.toneExcerpt}
          />
        )}

        {currentStep === "toc" && projectId && (
          <TocStep projectId={projectId} onAdvance={() => router.push(`/write?id=${projectId}`)} />
        )}

        {error && (
          <div className="mt-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
        )}

        {/* Step idx reference (helps with debugging) */}
        <div className="sr-only">step-index-{STEP_INDEX[currentStep]}</div>
      </div>
    </main>
  );
}

export default function SetupPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#fafafa] flex items-center justify-center text-gray-500">로딩...</main>
      }
    >
      <Inner />
    </Suspense>
  );
}
