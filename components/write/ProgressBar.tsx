"use client";

import { useMemo } from "react";

export type SetupStepKey = "analyze" | "interview" | "style" | "toc";

export const SETUP_STEPS: { key: SetupStepKey; label: string; minutes: number }[] = [
  { key: "analyze", label: "자료", minutes: 2 },
  { key: "interview", label: "인터뷰", minutes: 3 },
  { key: "style", label: "톤·색상", minutes: 1 },
  { key: "toc", label: "목차", minutes: 2 },
];

// v3 Phase 3.4 — 진행 격려 메시지. 단계마다 짧은 친근 문구.
// 사용자 인내심 ↑ 동기 ↑ (spec §3.6).
export const ENCOURAGEMENT_BY_STEP: Record<SetupStepKey, string> = {
  analyze: "잘 시작했어요!",
  interview: "절반 가까이",
  style: "마지막 단계까지 5분",
  toc: "마무리 단계",
};

export const STEP_INDEX: Record<SetupStepKey, number> = {
  analyze: 0,
  interview: 1,
  style: 2,
  toc: 3,
};

interface ProgressBarProps {
  currentStep: SetupStepKey;
  /** keys that are already complete (used to render past dots with check) */
  completedSteps?: SetupStepKey[];
  /** override compact (mobile) mode — auto on sm: by default */
  compact?: boolean;
}

/**
 * /write/setup 4-substep ProgressBar (v3 Phase 1.1)
 * Sticky top. 4 horizontal dots — current = tiger-orange, past = check, future = muted.
 */
export function ProgressBar({ currentStep, completedSteps = [], compact }: ProgressBarProps) {
  const currentIdx = STEP_INDEX[currentStep];
  const completedSet = useMemo(() => new Set(completedSteps), [completedSteps]);

  const minutesLeft = useMemo(() => {
    let sum = 0;
    for (let i = currentIdx; i < SETUP_STEPS.length; i++) sum += SETUP_STEPS[i].minutes;
    return sum;
  }, [currentIdx]);

  return (
    <div className="sticky top-0 z-30 w-full bg-white/90 backdrop-blur border-b border-gray-200">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
        {/* dots + connecting lines */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {SETUP_STEPS.map((step, i) => {
            const isCurrent = i === currentIdx;
            const isDone = completedSet.has(step.key) || i < currentIdx;
            const isFuture = !isCurrent && !isDone;

            const dotCls = isCurrent
              ? "bg-tiger-orange text-white border-tiger-orange"
              : isDone
              ? "bg-tiger-orange/90 text-white border-tiger-orange/90"
              : "bg-white text-gray-400 border-gray-300";

            return (
              <div key={step.key} className="flex items-center flex-1 last:flex-none gap-1.5 sm:gap-2">
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center text-[11px] sm:text-xs font-bold transition ${dotCls}`}
                    aria-current={isCurrent ? "step" : undefined}
                    aria-label={`Step ${i + 1}: ${step.label}${isDone ? " (완료)" : isCurrent ? " (진행 중)" : ""}`}
                  >
                    {isDone ? "✓" : i + 1}
                  </div>
                  {!compact && (
                    <span
                      className={`hidden sm:block text-[10px] font-mono tracking-wider whitespace-nowrap ${
                        isFuture ? "text-gray-400" : "text-ink-900"
                      }`}
                    >
                      {step.label}
                    </span>
                  )}
                </div>
                {i < SETUP_STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 rounded ${
                      i < currentIdx || (completedSet.has(step.key) && completedSet.has(SETUP_STEPS[i + 1].key))
                        ? "bg-tiger-orange/70"
                        : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* meta — Step N/4 · 약 K분 남음 */}
        <div className="mt-2 sm:mt-3 flex items-center justify-between text-[10px] sm:text-xs font-mono text-gray-500">
          <span>
            Step {currentIdx + 1}/4
            <span className="hidden sm:inline"> · {SETUP_STEPS[currentIdx].label}</span>
          </span>
          <span>약 {minutesLeft}분 남음</span>
        </div>

        {/* v3 Phase 3.4 — 진행 격려 메시지 (subtle, small) */}
        <div className="mt-1 text-[11px] sm:text-xs text-tiger-orange/90 font-medium">
          {ENCOURAGEMENT_BY_STEP[currentStep]}
        </div>
      </div>
    </div>
  );
}
