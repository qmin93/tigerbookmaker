// 작업 시작 전 토큰·비용 견적 함수
// 잔액 부족 사전 차단에 사용
// 관련: docs/tigerbookmaker/2026-04-24-balance-shortfall-decision.md

import type { BookProject } from "./storage";

export type AIModel =
  | "gemini-2.0-flash"
  | "gemini-2.5-flash"
  | "gemini-flash-latest"
  | "gemini-2.5-pro"
  | "gpt-4o-mini"
  | "gpt-4o"
  | "gpt-4.1-mini"
  | "claude-sonnet-4-6"
  | "claude-haiku-4-5";

export type TaskType = "toc" | "chapter" | "edit" | "batch";

export interface CostEstimate {
  task: TaskType;
  model: AIModel;
  inputTokens: number;
  outputTokens: number;
  thoughtsTokens: number;
  costUSD: number;
  costKRW: number;
  minimumBalanceKRW: number;     // 작업 시작 허용 최소 잔액 (안전마진 포함)
  safetyMarginPercent: number;
  breakdown: string;             // 사용자에게 보여줄 견적 설명
}

// ──────────────────────────────────────────
// 모델별 가격 (USD per 1M tokens, 2026-04 기준)
// ──────────────────────────────────────────
const PRICING: Record<AIModel, { in: number; out: number }> = {
  "gemini-2.0-flash":     { in: 0.075, out: 0.30 },
  "gemini-2.5-flash":     { in: 0.30,  out: 2.50 },
  "gemini-flash-latest":  { in: 0.30,  out: 2.50 },
  "gemini-2.5-pro":       { in: 1.25,  out: 10.00 },
  "gpt-4o-mini":          { in: 0.15,  out: 0.60 },
  "gpt-4o":               { in: 2.50,  out: 10.00 },
  "gpt-4.1-mini":         { in: 0.40,  out: 1.60 },
  "claude-sonnet-4-6":    { in: 3.00,  out: 15.00 },
  "claude-haiku-4-5":     { in: 1.00,  out: 5.00 },
};

// 환율 (분기별 업데이트)
const USD_TO_KRW = 1_380;

// 안전마진 — 모델 출력 변동 + 캐시 히트율 변동 흡수
const SAFETY_MARGIN = 0.20;

// ──────────────────────────────────────────
// 작업별 토큰 예측 공식
// ──────────────────────────────────────────

const SYSTEM_PROMPT_TOKENS = 800;       // SYSTEM_WRITER 길이 기준
const TOC_OUTPUT_PER_CHAPTER = 60;       // 챕터 1개당 JSON 토큰
const CHAPTER_OUTPUT_PER_KOR_CHAR = 1.6; // 한국어 1자 ≈ 1.6 token (UTF-8)
const TARGET_CHAPTER_CHARS = 4_000;      // 목표 4,000자 기준
const CHAPTER_CONTEXT_TOKENS = 400;       // 챕터 프롬프트의 컨텍스트(이전 목차 등)
const EDIT_INPUT_PER_KOR_CHAR = 1.6;
const EDIT_OUTPUT_PER_KOR_CHAR = 1.6;

// Gemini는 thinking tokens 추가 발생 (출력 토큰의 ~70%)
const GEMINI_THOUGHTS_RATIO = 0.7;

// 일괄 집필 시 캐시 히트율 (반복 시스템 프롬프트)
const BATCH_CACHE_HIT_RATIO = 0.7;

// ──────────────────────────────────────────
// 핵심 견적 함수
// ──────────────────────────────────────────

export function estimateCost(
  task: TaskType,
  project: BookProject,
  model: AIModel,
  options?: { editTargetChars?: number }
): CostEstimate {
  const isGemini = model.startsWith("gemini");
  const price = PRICING[model];
  if (!price) throw new Error(`Unknown model in cost-estimate: ${model}`);

  let inputTokens = 0;
  let outputTokens = 0;

  switch (task) {
    case "toc": {
      // 시스템 + 프로젝트 정보
      inputTokens = SYSTEM_PROMPT_TOKENS + 150;
      // 챕터 12개 가정 시
      const chapterCount = project.chapters.length || 12;
      outputTokens = chapterCount * TOC_OUTPUT_PER_CHAPTER;
      break;
    }

    case "chapter": {
      inputTokens = SYSTEM_PROMPT_TOKENS + CHAPTER_CONTEXT_TOKENS;
      outputTokens = Math.ceil(TARGET_CHAPTER_CHARS * CHAPTER_OUTPUT_PER_KOR_CHAR);
      break;
    }

    case "edit": {
      const targetChars = options?.editTargetChars ?? TARGET_CHAPTER_CHARS;
      // 원본 본문 + 수정 지시
      inputTokens = SYSTEM_PROMPT_TOKENS + Math.ceil(targetChars * EDIT_INPUT_PER_KOR_CHAR) + 200;
      outputTokens = Math.ceil(targetChars * EDIT_OUTPUT_PER_KOR_CHAR);
      break;
    }

    case "batch": {
      // 12 챕터 일괄. 캐시 히트로 시스템 프롬프트 비용 ~30%로 감소
      const chapterCount = project.chapters.length || 12;
      const perChapterIn = SYSTEM_PROMPT_TOKENS + CHAPTER_CONTEXT_TOKENS;
      const perChapterOut = Math.ceil(TARGET_CHAPTER_CHARS * CHAPTER_OUTPUT_PER_KOR_CHAR);
      // 첫 호출 = 풀 비용, 이후는 캐시 히트
      inputTokens = perChapterIn + (chapterCount - 1) * perChapterIn * (1 - BATCH_CACHE_HIT_RATIO);
      outputTokens = perChapterOut * chapterCount;
      break;
    }
  }

  const thoughtsTokens = isGemini ? Math.ceil(outputTokens * GEMINI_THOUGHTS_RATIO) : 0;
  const costUSD = (inputTokens * price.in + (outputTokens + thoughtsTokens) * price.out) / 1_000_000;
  const costKRW = Math.ceil(costUSD * USD_TO_KRW);
  const minimumBalanceKRW = Math.ceil(costKRW * (1 + SAFETY_MARGIN));

  // 사용자에게 보여줄 설명
  const taskNames: Record<TaskType, string> = {
    toc: "목차 생성",
    chapter: "챕터 1개 집필",
    edit: "챕터 수정",
    batch: `${project.chapters.length || 12}챕터 일괄 집필`,
  };
  const breakdown = `${taskNames[task]} · ${model} · 약 ₩${costKRW.toLocaleString()} 차감 예상`;

  return {
    task,
    model,
    inputTokens,
    outputTokens,
    thoughtsTokens,
    costUSD,
    costKRW,
    minimumBalanceKRW,
    safetyMarginPercent: SAFETY_MARGIN * 100,
    breakdown,
  };
}

// ──────────────────────────────────────────
// 잔액 체크 헬퍼
// ──────────────────────────────────────────

export interface BalanceCheckResult {
  ok: boolean;
  required: number;
  current: number;
  shortfall: number;          // 부족분
  estimate: CostEstimate;
}

export function checkBalance(
  currentBalanceKRW: number,
  estimate: CostEstimate
): BalanceCheckResult {
  const ok = currentBalanceKRW >= estimate.minimumBalanceKRW;
  return {
    ok,
    required: estimate.minimumBalanceKRW,
    current: currentBalanceKRW,
    shortfall: ok ? 0 : estimate.minimumBalanceKRW - currentBalanceKRW,
    estimate,
  };
}

// ──────────────────────────────────────────
// 사용 예시
// ──────────────────────────────────────────
//
//   const estimate = estimateCost("batch", project, "gemini-2.5-flash");
//   const check = checkBalance(user.balance_krw, estimate);
//
//   if (!check.ok) {
//     return Response.json({
//       error: "INSUFFICIENT_BALANCE",
//       message: `잔액 부족: ₩${check.shortfall.toLocaleString()} 충전 필요`,
//       estimate: estimate.breakdown,
//       required: check.required,
//       current: check.current,
//     }, { status: 402 });
//   }
//
//   // ...작업 진행...
