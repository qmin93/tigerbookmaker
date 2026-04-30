// POST /api/generate/chapter-edit
// AI 글쓰기 챗 — 작가가 자연어 지시 ("결말 더 강하게", "통계 추가" 등) → AI가 챕터 새 본문 제안.
// DB 저장 X (사용자가 [적용] 클릭하면 frontend가 별도 PUT으로 저장).

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { callAIServerWithFallback, type AIModel } from "@/lib/server/ai-server";
import { getModelChain, type Tier } from "@/lib/tiers";
import { getUser, getProject, deductBalance, logAIUsage, USD_TO_KRW } from "@/lib/server/db";
import { SYSTEM_WRITER, editPrompt } from "@/lib/prompts";
import { rateLimit } from "@/lib/server/rate-limit";
import { ragSearch, hasReferences } from "@/lib/server/rag";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const userId = session.user.id;

    const rl = rateLimit(`gen:${userId}`, 10, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "RATE_LIMITED", resetIn: rl.resetIn }, { status: 429 });

    const body = await req.json().catch(() => ({}));
    const { projectId, chapterIdx, instruction } = body;
    if (!projectId || typeof chapterIdx !== "number") {
      return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    }
    const inst = String(instruction ?? "").trim();
    if (inst.length < 5) {
      return NextResponse.json({ error: "INSTRUCTION_TOO_SHORT", message: "수정 요청을 5자 이상 작성해주세요." }, { status: 400 });
    }
    if (inst.length > 500) {
      return NextResponse.json({ error: "INSTRUCTION_TOO_LONG", message: "수정 요청은 500자 이내로." }, { status: 400 });
    }

    const projectRow = await getProject(projectId, userId);
    if (!projectRow) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    const project = projectRow.data;
    const ch = project.chapters?.[chapterIdx];
    if (!ch?.content) return NextResponse.json({ error: "CHAPTER_EMPTY", message: "본문이 있는 챕터에서만 사용 가능합니다." }, { status: 400 });

    const tier: Tier = (project as any).tier ?? "basic";
    const candidates = getModelChain(tier);
    if (candidates.length === 0) return NextResponse.json({ error: "TIER_UNAVAILABLE" }, { status: 503 });

    const user = await getUser(userId);
    if (!user) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
    if (user.balance_krw < 50) {
      return NextResponse.json({
        error: "INSUFFICIENT_BALANCE",
        message: "잔액 부족. 챕터 수정에 약 ₩50 이상 필요.",
        current: user.balance_krw,
        shortfall: 50 - user.balance_krw,
      }, { status: 402 });
    }

    // RAG 자동 주입 — 자연어 지시(inst) 자체를 쿼리로 (요청 의도에 가장 가까운 청크)
    let editChunks: Awaited<ReturnType<typeof ragSearch>> = [];
    try {
      if (await hasReferences(projectId)) {
        editChunks = await ragSearch({
          projectId,
          query: inst,
          topN: 3,
          maxDistance: 0.7,
        });
      }
    } catch (e: any) {
      console.warn("[chapter-edit] RAG failed:", e?.message);
    }

    const toneSetting = (project as any).toneSetting ?? undefined;

    let result;
    try {
      result = await callAIServerWithFallback({
        candidates,
        system: SYSTEM_WRITER,
        user: editPrompt(ch.content, inst, editChunks, toneSetting),
        maxTokens: 8192,
        temperature: 0.7,
        timeoutMs: 50000,
        retries: 1,
      });
    } catch (e: any) {
      await logAIUsage({
        userId, task: "edit", model: candidates[0],
        inputTokens: 0, outputTokens: 0, thoughtsTokens: 0,
        cacheReadTokens: 0, cacheWriteTokens: 0,
        costUSD: 0, costKRW: 0, durationMs: 0,
        projectId, chapterIdx,
        status: "failed", errorMessage: `chapter-edit: ${e?.message?.slice(0, 400)}`,
      }).catch(() => {});
      throw e;
    }

    const newContent = result.text.trim();
    const costKRW = Math.ceil(result.usage.costUSD * USD_TO_KRW);
    const { id: usageId } = await logAIUsage({
      userId, task: "edit", model: result.actualModel,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      thoughtsTokens: result.usage.thoughtsTokens,
      cacheReadTokens: 0, cacheWriteTokens: 0,
      costUSD: result.usage.costUSD,
      costKRW,
      durationMs: result.usage.durationMs,
      projectId, chapterIdx,
      status: "success",
    });
    let newBalance = user.balance_krw;
    if (costKRW > 0) {
      const r = await deductBalance({
        userId, amountKRW: costKRW, aiUsageId: usageId,
        reason: `${chapterIdx + 1}장 AI 수정 — "${inst.slice(0, 30)}..." (${result.actualModel})`,
      });
      newBalance = r.newBalance;
    }

    return NextResponse.json({
      ok: true,
      newContent,
      originalContent: ch.content,
      instruction: inst,
      model: result.actualModel,
      newBalance,
      costKRW,
    });
  } catch (e: any) {
    console.error("[/api/generate/chapter-edit] uncaught:", e);
    return NextResponse.json({
      error: "INTERNAL_ERROR",
      message: e?.message || String(e),
    }, { status: 500 });
  }
}
