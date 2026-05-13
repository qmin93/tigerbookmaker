// POST /api/chapter/[idx]/regenerate
// 자연어 피드백을 받아 챕터 본문을 재생성. "더 짧게", "예시 3개 추가" 등 짧은 자연어 지시.
// chapter-edit과 다른 점:
//   - edit: 기존 본문을 수정 (앞부분 거의 유지)
//   - regenerate: 처음부터 다시 작성 (책 맥락 + 기존 본문 = 추가 context). 더 큰 변화.
// 비용: 챕터 본문 생성과 동일 (₩300 고정).
//
// v3 Phase 2.3 (2026-05-13).
//
// Body: { projectId, feedback: string }
// 응답: { ok, newContent, originalContent, model, costKRW, newBalance }

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/server/rate-limit";
import { callAIServerWithFallback } from "@/lib/server/ai-server";
import { getModelChain, type Tier } from "@/lib/tiers";
import {
  getUser, getProject, updateProjectData,
  deductBalance, logAIUsage,
} from "@/lib/server/db";
import { SYSTEM_WRITER, chapterPrompt } from "@/lib/prompts";
import { ragSearch, hasReferences } from "@/lib/server/rag";
import { FIXED_COST_PER_CHAPTER_KRW } from "@/lib/server/generate-chapter";

export const runtime = "nodejs";
export const maxDuration = 60;

// AIResult + actualModel union (callAIServerWithFallback 리턴 타입)
type AIResultWithModel = Awaited<ReturnType<typeof callAIServerWithFallback>>;

/**
 * 자연어 피드백 + 기존 본문을 chapterPrompt에 덮어쓰는 형태로 prompt 구성.
 * chapterPrompt가 만드는 기본 prompt 뒤에 "재생성 요구" 블록을 붙여 모델이 기존 결과를
 * 단순 다듬기가 아니라 처음부터 새로 쓰되 피드백을 반영하게 함.
 */
function regeneratePromptOverlay(originalContent: string, feedback: string): string {
  // 8000자 초과 시 잘라서 context로 — 토큰 절약
  const truncated = originalContent.length > 4000
    ? originalContent.slice(0, 4000) + "\n\n[...원본 일부 생략 — 참고용]"
    : originalContent;

  return `

[중요 — 재생성 모드]
이 챕터는 이미 한 번 작성됐지만 사용자가 마음에 들지 않아 다시 작성합니다.

[기존 본문 — 참고용 (재사용 금지, 같은 문장 반복 X)]
${truncated}

[사용자 피드백 — 반드시 반영]
"${feedback}"

[재생성 지침]
- 위 피드백을 본문에 명시적으로 반영하세요. 피드백이 "더 짧게"면 분량을 1,800~2,500자로 줄이고, "예시 추가"면 구체 예시 3개를 본문에 삽입하고, "톤 친근하게"면 격식체를 줄이고 일상 어휘로 바꾸세요.
- 기존 본문에 있던 문장을 그대로 베끼지 마세요. 같은 주제·구조라도 표현은 새롭게.
- 기존 본문보다 더 자연스러운 한국어로. 번역투("~할 수 있다", "~라고 할 수 있습니다") 피하기.
- 위 [이 챕터 작성 지침]의 분량·구조·금지사항은 그대로 따르되, 피드백과 충돌하면 피드백을 우선합니다.`;
}

export async function POST(req: Request, { params }: { params: { idx: string } }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const userId = session.user.id;

    const idx = Number(params.idx);
    if (!Number.isInteger(idx) || idx < 0 || idx > 99) {
      return NextResponse.json({ error: "INVALID_INDEX" }, { status: 400 });
    }

    // Rate limit — 사용자당 분당 10회 (chapter generate와 동일 정책)
    const rl = rateLimit(`gen:${userId}`, 10, 60_000);
    if (!rl.ok) {
      return NextResponse.json({
        error: "RATE_LIMITED",
        message: `요청이 너무 잦습니다. ${Math.ceil(rl.resetIn / 1000)}초 후 다시 시도하세요.`,
      }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const { projectId, feedback } = body ?? {};
    if (typeof projectId !== "string" || !projectId) {
      return NextResponse.json({ error: "INVALID_INPUT", message: "projectId required" }, { status: 400 });
    }
    const fb = String(feedback ?? "").trim();
    if (fb.length < 2) {
      return NextResponse.json({
        error: "FEEDBACK_TOO_SHORT",
        message: "피드백을 2자 이상 입력하세요. 예: '더 짧게', '예시 3개 추가'",
      }, { status: 400 });
    }
    if (fb.length > 500) {
      return NextResponse.json({
        error: "FEEDBACK_TOO_LONG",
        message: "피드백은 500자 이내로 작성하세요.",
      }, { status: 400 });
    }

    // 프로젝트 + 챕터 검증
    const projectRow = await getProject(projectId, userId);
    if (!projectRow) {
      return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    }
    const project = projectRow.data;
    const ch = project?.chapters?.[idx];
    if (!ch) {
      return NextResponse.json({ error: "CHAPTER_NOT_FOUND" }, { status: 404 });
    }
    const originalContent = typeof ch.content === "string" ? ch.content : "";
    if (originalContent.trim().length < 100) {
      return NextResponse.json({
        error: "CHAPTER_EMPTY",
        message: "재생성할 본문이 없습니다. 먼저 본문을 생성하세요.",
      }, { status: 400 });
    }

    // 잔액 체크
    const user = await getUser(userId);
    if (!user) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
    if (user.balance_krw < FIXED_COST_PER_CHAPTER_KRW) {
      return NextResponse.json({
        error: "INSUFFICIENT_BALANCE",
        message: `잔액 부족. 재생성에 ₩${FIXED_COST_PER_CHAPTER_KRW.toLocaleString()} 필요.`,
        required: FIXED_COST_PER_CHAPTER_KRW,
        current: user.balance_krw,
        shortfall: FIXED_COST_PER_CHAPTER_KRW - user.balance_krw,
      }, { status: 402 });
    }

    // tier 모델 chain
    const tier: Tier = (project as any).tier ?? "basic";
    const candidates = getModelChain(tier);
    if (candidates.length === 0) {
      return NextResponse.json({
        error: "TIER_UNAVAILABLE",
        message: `${tier} 티어 모델을 사용할 수 없습니다.`,
      }, { status: 503 });
    }

    // RAG — chapter title 기준 검색 (피드백을 추가 query로 합치면 검색 정확도 ↓ 가능)
    let chapterChunks: Awaited<ReturnType<typeof ragSearch>> = [];
    try {
      if (await hasReferences(projectId)) {
        chapterChunks = await ragSearch({
          projectId,
          query: `${ch.title}${ch.subtitle ? " — " + ch.subtitle : ""}`,
          topN: 4,
          maxDistance: 0.7,
        });
      }
    } catch (e: any) {
      console.warn("[chapter-regenerate] RAG failed:", e?.message);
    }

    const toneSetting = (project as any).toneSetting ?? undefined;

    // chapterPrompt + regeneratePromptOverlay 합성.
    // 기존 chapterPrompt의 메타데이터 (목차·요약·RAG·톤) 그대로 재사용 — 일관성 보장.
    const basePrompt = chapterPrompt(project, idx, ch.title, ch.subtitle, chapterChunks, toneSetting);
    const fullPrompt = basePrompt + regeneratePromptOverlay(originalContent, fb);

    let aiResult: AIResultWithModel;
    try {
      aiResult = await callAIServerWithFallback({
        candidates,
        system: SYSTEM_WRITER,
        user: fullPrompt,
        maxTokens: 8192,
        temperature: 0.75,  // 재생성은 살짝 더 다양성 ↑
        timeoutMs: 55_000,
        retries: 1,
      });
    } catch (e: any) {
      await logAIUsage({
        userId, task: "chapter", model: candidates[0],
        inputTokens: 0, outputTokens: 0, thoughtsTokens: 0,
        cacheReadTokens: 0, cacheWriteTokens: 0,
        costUSD: 0, costKRW: 0, durationMs: 0,
        projectId, chapterIdx: idx,
        status: "failed", errorMessage: `regenerate: ${e?.message?.slice(0, 400)}`,
      }).catch(() => {});
      return NextResponse.json({
        error: "AI_FAILED",
        message: e?.message ?? "AI 호출 실패",
      }, { status: 502 });
    }

    const newContent = aiResult.text.trim();
    if (newContent.length < 200) {
      return NextResponse.json({
        error: "RESULT_TOO_SHORT",
        message: "재생성 결과가 너무 짧습니다. 잔액 차감 없이 다시 시도하세요.",
        rawLength: newContent.length,
      }, { status: 502 });
    }

    // 비용 차감 + 로그 (고정 ₩300)
    const { id: usageId } = await logAIUsage({
      userId, task: "chapter", model: aiResult.actualModel,
      inputTokens: aiResult.usage.inputTokens,
      outputTokens: aiResult.usage.outputTokens,
      thoughtsTokens: aiResult.usage.thoughtsTokens,
      cacheReadTokens: aiResult.usage.cacheReadTokens,
      cacheWriteTokens: aiResult.usage.cacheWriteTokens,
      costUSD: aiResult.usage.costUSD,
      costKRW: FIXED_COST_PER_CHAPTER_KRW,
      durationMs: aiResult.usage.durationMs,
      projectId, chapterIdx: idx,
      status: "success",
    });
    const { newBalance } = await deductBalance({
      userId, amountKRW: FIXED_COST_PER_CHAPTER_KRW, aiUsageId: usageId,
      reason: `${idx + 1}장 재생성 — "${fb.slice(0, 30)}${fb.length > 30 ? "..." : ""}" (${aiResult.actualModel})`,
    });

    // DB 업데이트 — content만 교체. summary·qualityScore는 stale이므로 제거.
    const freshRow = await getProject(projectId, userId);
    if (freshRow) {
      const freshData: any = freshRow.data ?? project;
      const updatedChapters = [...(freshData.chapters ?? project.chapters)];
      const existingCh = updatedChapters[idx] ?? ch;
      const { qualityScore: _drop, summary: _dropSummary, ...rest } = existingCh;
      updatedChapters[idx] = { ...rest, content: newContent };
      await updateProjectData(projectId, userId, { ...freshData, chapters: updatedChapters });
    }

    return NextResponse.json({
      ok: true,
      newContent,
      originalContent,
      feedback: fb,
      model: aiResult.actualModel,
      newBalance,
      costKRW: FIXED_COST_PER_CHAPTER_KRW,
    });
  } catch (e: any) {
    console.error("[/api/chapter/[idx]/regenerate] uncaught:", e);
    return NextResponse.json({
      error: "INTERNAL_ERROR",
      message: e?.message || String(e),
    }, { status: 500 });
  }
}
