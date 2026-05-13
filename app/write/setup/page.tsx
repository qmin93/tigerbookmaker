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
import type { ThemeColorKey, ToneSetting } from "@/lib/storage";

const VALID_STEPS: SetupStepKey[] = ["analyze", "interview", "style", "toc"];

function isValidStep(s: string | null): s is SetupStepKey {
  return !!s && (VALID_STEPS as string[]).includes(s);
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
  const [refCount, setRefCount] = useState<number | null>(null);

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
      })
      .catch(e => setError(e.message));
  }, [projectId, router]);

  // ──── Balance load ────
  useEffect(() => {
    fetch("/api/me")
      .then(r => (r.ok ? r.json() : null))
      .then(d => d && setBalance(d.balance_krw));
  }, []);

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
    if (hasInterview && hasTone) return "toc";
    if (hasInterview && !hasTone) return "style";
    // Interview not done
    if ((refCount ?? 0) === 0) return "analyze";
    if (referencesSummary) return "interview";
    return "analyze";
  }, [project, refCount, referencesSummary, toneSetting]);

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
      router.replace(`/write/setup?id=${projectId}&step=${next}`);
    },
    [projectId, router],
  );

  // Completed-step set, used by ProgressBar checkmarks
  const completedSteps = useMemo<SetupStepKey[]>(() => {
    const done: SetupStepKey[] = [];
    if (refCount === 0 || referencesSummary) done.push("analyze");
    if (project?.interview?.completedAt) done.push("interview");
    if (toneSetting) done.push("style");
    return done;
  }, [refCount, referencesSummary, project, toneSetting]);

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
          />
        )}

        {currentStep === "style" && projectId && (
          <StyleStep
            projectId={projectId}
            themeColor={themeColor}
            toneSetting={toneSetting}
            onThemeColorChange={setThemeColor}
            onToneSettingChange={setToneSetting}
            onBalanceChange={setBalance}
            onError={setError}
            onAdvance={() => goToStep("toc")}
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
