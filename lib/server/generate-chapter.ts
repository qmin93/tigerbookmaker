// lib/server/generate-chapter.ts
// 챕터 1개 본문 생성의 "비-스트리밍" 코어 로직.
//
// /api/generate/chapter (HTTP streaming) 와 /api/cron/book-generation-worker (백그라운드)
// 양쪽에서 호출. HTTP route는 chunk를 client에 push하면서 fullText 누적,
// worker는 그냥 끝까지 받고 한 번에 저장.
//
// 책임:
//  1. 잔액 체크 (안 되면 throw InsufficientBalanceError)
//  2. RAG 검색 (자료 있으면)
//  3. AI 본문 호출 (fallback chain)
//  4. AI 요약 호출 (fallback chain, 실패해도 본문은 OK)
//  5. 비용 차감 + ai_usage 로그 + project chapters[idx] 업데이트
//
// 가격 정책 (Sang-nim 10x, 2026-05): 본문 1챕터 ₩300 고정 (요약 포함).

import "server-only";
import { callAIServerWithFallback, callStreamWithFallback, type AIModel } from "@/lib/server/ai-server";
import { getModelChain, type Tier } from "@/lib/tiers";
import {
  getUser, getProject, updateProjectData,
  deductBalance, logAIUsage,
} from "@/lib/server/db";
import { SYSTEM_WRITER, chapterPrompt, summaryPrompt } from "@/lib/prompts";
import { ragSearch, hasReferences } from "@/lib/server/rag";

export const FIXED_COST_PER_CHAPTER_KRW = 300;

export class InsufficientBalanceError extends Error {
  required: number;
  current: number;
  constructor(required: number, current: number) {
    super(`Insufficient balance: required ${required}, have ${current}`);
    this.name = "InsufficientBalanceError";
    this.required = required;
    this.current = current;
  }
}

export class ChapterNotFoundError extends Error {
  constructor() {
    super("Chapter not found");
    this.name = "ChapterNotFoundError";
  }
}

export class ProjectNotFoundError extends Error {
  constructor() {
    super("Project not found");
    this.name = "ProjectNotFoundError";
  }
}

export interface GenerateChapterResult {
  fullText: string;
  summary: string;
  actualModel: AIModel;
  costKRW: number;
  newBalance: number;
  ragHadReferences: boolean;
  ragFailed: boolean;
}

export interface GenerateChapterOptions {
  projectId: string;
  userId: string;
  chapterIdx: number;
  explicitModel?: AIModel;
  /** chunk가 도착할 때마다 호출됨 (HTTP streaming route용). worker에서는 미사용. */
  onChunk?: (text: string) => void;
  /** AI 호출 timeout 기본 55s — worker에서는 maxDuration 60s 안에 끝나야 하므로 ~45s 권장. */
  aiTimeoutMs?: number;
}

/**
 * 챕터 1개 본문 생성 — 동기적으로 끝까지 처리.
 *
 * - throw 가능한 에러:
 *   - ProjectNotFoundError / ChapterNotFoundError
 *   - InsufficientBalanceError
 *   - 그 외 AI 호출 실패 — Error
 * - 성공 시: chapters[idx].content + summary 가 DB에 저장된 상태로 반환.
 */
export async function generateChapter(
  opts: GenerateChapterOptions,
): Promise<GenerateChapterResult> {
  const { projectId, userId, chapterIdx, explicitModel, onChunk } = opts;
  const aiTimeoutMs = opts.aiTimeoutMs ?? 55000;

  // 1. 프로젝트 로드
  const projectRow = await getProject(projectId, userId);
  if (!projectRow) throw new ProjectNotFoundError();
  const project = projectRow.data;
  const ch = project.chapters?.[chapterIdx];
  if (!ch) throw new ChapterNotFoundError();

  // 2. tier 기반 model chain
  const tier: Tier = (project as any).tier ?? "basic";
  let candidates: AIModel[];
  if (explicitModel) {
    candidates = [explicitModel as AIModel];
  } else {
    candidates = getModelChain(tier);
    if (candidates.length === 0) {
      throw new Error(`No models available for tier ${tier}`);
    }
  }

  // 3. 잔액 체크 — 고정 가격 ₩300
  const user = await getUser(userId);
  if (!user) throw new Error("USER_NOT_FOUND");
  const requiredBalanceKRW = FIXED_COST_PER_CHAPTER_KRW;
  if (user.balance_krw < requiredBalanceKRW) {
    throw new InsufficientBalanceError(requiredBalanceKRW, user.balance_krw);
  }

  // 4. RAG 검색 (자료 있으면)
  let chapterChunks: Awaited<ReturnType<typeof ragSearch>> = [];
  let ragHadReferences = false;
  let ragFailed = false;
  try {
    ragHadReferences = await hasReferences(projectId);
    if (ragHadReferences) {
      chapterChunks = await ragSearch({
        projectId,
        query: `${ch.title}${ch.subtitle ? " — " + ch.subtitle : ""}`,
        topN: 4,
        maxDistance: 0.7,
      });
    }
  } catch (e: any) {
    ragFailed = true;
    console.error("[generate-chapter] RAG search FAILED:", {
      projectId, chapterIdx, error: e?.message,
    });
  }

  const toneSetting = (project as any).toneSetting ?? undefined;

  // 5. AI 본문 호출 (streaming, 안에서 fullText 누적)
  let fullText = "";
  let bodyUsage: any = null;
  let actualModel: AIModel = candidates[0];
  try {
    const gen = callStreamWithFallback({
      candidates,
      system: SYSTEM_WRITER,
      user: chapterPrompt(project, chapterIdx, ch.title, ch.subtitle, chapterChunks, toneSetting),
      timeoutMs: aiTimeoutMs,
    });
    for await (const evt of gen) {
      if (evt.model) actualModel = evt.model;
      if (evt.type === "chunk") {
        fullText += evt.text;
        if (onChunk) onChunk(evt.text);
      } else if (evt.type === "done") {
        bodyUsage = evt.usage;
      }
    }
  } catch (e: any) {
    await logAIUsage({
      userId, task: "chapter", model: actualModel,
      inputTokens: 0, outputTokens: 0, thoughtsTokens: 0,
      cacheReadTokens: 0, cacheWriteTokens: 0,
      costUSD: 0, costKRW: 0, durationMs: 0,
      projectId, chapterIdx,
      status: "failed", errorMessage: e?.message?.slice(0, 500),
    }).catch(() => {});
    throw e;
  }

  if (!bodyUsage) {
    throw new Error("AI stream ended without usage info");
  }

  // 6. 비용 차감 + 로그 (고정 ₩300)
  const costKRW = FIXED_COST_PER_CHAPTER_KRW;
  const { id: usageId } = await logAIUsage({
    userId, task: "chapter", model: actualModel,
    inputTokens: bodyUsage.inputTokens,
    outputTokens: bodyUsage.outputTokens,
    thoughtsTokens: bodyUsage.thoughtsTokens,
    cacheReadTokens: 0, cacheWriteTokens: 0,
    costUSD: bodyUsage.costUSD,
    costKRW,
    durationMs: bodyUsage.durationMs,
    projectId, chapterIdx,
    status: "success",
  });
  const { newBalance } = await deductBalance({
    userId, amountKRW: costKRW, aiUsageId: usageId,
    reason: `${chapterIdx + 1}장 집필 (${actualModel})`,
  });

  // 7. 요약 (실패해도 본문은 OK) — fallback chain
  let summary = "";
  const summaryCandidates: AIModel[] = [
    "gemini-flash-latest",
    "gemini-flash-lite-latest",
    "gemini-2.5-flash-lite",
  ];
  const truncatedText = fullText.length > 8000
    ? fullText.slice(0, 6000) + "\n\n[...본문 일부 생략...]"
    : fullText;
  try {
    const sumResult = await callAIServerWithFallback({
      candidates: summaryCandidates,
      system: "당신은 책 챕터를 200~300자로 압축하는 요약가입니다.",
      user: summaryPrompt(ch.title, truncatedText),
      maxTokens: 512,
      temperature: 0.3,
      timeoutMs: 30000,
      retries: 2,
    });
    summary = sumResult.text.trim();
    await logAIUsage({
      userId, task: "summary", model: sumResult.actualModel,
      inputTokens: sumResult.usage.inputTokens,
      outputTokens: sumResult.usage.outputTokens,
      thoughtsTokens: sumResult.usage.thoughtsTokens,
      cacheReadTokens: sumResult.usage.cacheReadTokens,
      cacheWriteTokens: sumResult.usage.cacheWriteTokens,
      costUSD: sumResult.usage.costUSD,
      costKRW: 0,
      durationMs: sumResult.usage.durationMs,
      projectId, chapterIdx,
      status: "success",
    });
  } catch (e: any) {
    await logAIUsage({
      userId, task: "summary", model: "gemini-flash-latest",
      inputTokens: 0, outputTokens: 0, thoughtsTokens: 0,
      cacheReadTokens: 0, cacheWriteTokens: 0,
      costUSD: 0, costKRW: 0, durationMs: 0,
      projectId, chapterIdx,
      status: "failed", errorMessage: e?.message?.slice(0, 500),
    }).catch(() => {});
  }

  // 8. 프로젝트 업데이트 — 최신 data를 다시 fetch (worker가 여러 챕터 처리할 때 중간 변경 보존)
  const freshRow = await getProject(projectId, userId);
  const freshData: any = freshRow?.data ?? project;
  const updatedChapters = [...(freshData.chapters ?? project.chapters)];
  updatedChapters[chapterIdx] = { ...ch, ...updatedChapters[chapterIdx], content: fullText, summary };
  await updateProjectData(projectId, userId, { ...freshData, chapters: updatedChapters });

  return {
    fullText,
    summary,
    actualModel,
    costKRW,
    newBalance,
    ragHadReferences,
    ragFailed,
  };
}

/**
 * 프로젝트 챕터 진행 상황을 한 번에 파악 — worker가 어디부터 처리할지 결정.
 * `content.length > 100` 인 것을 "완성됨"으로 판정 (기존 UI 기준과 일치).
 */
export async function getChapterProgress(
  projectId: string,
  userId: string,
): Promise<{ total: number; completedIdxs: number[]; pendingIdxs: number[] } | null> {
  const projectRow = await getProject(projectId, userId);
  if (!projectRow) return null;
  const chapters: any[] = projectRow.data?.chapters ?? [];
  const total = chapters.length;
  const completedIdxs: number[] = [];
  const pendingIdxs: number[] = [];
  for (let i = 0; i < total; i++) {
    if ((chapters[i]?.content?.length ?? 0) > 100) {
      completedIdxs.push(i);
    } else {
      pendingIdxs.push(i);
    }
  }
  return { total, completedIdxs, pendingIdxs };
}
