// POST /api/generate/chapter-analyze
// 챕터 본문 출판 품질 진단 — 6 카테고리 점수 + 구체 issue + 개선 제안.
// 결과 DB 저장 X (휘발성, 매번 새로 분석).

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { callAIServerWithFallback, type AIModel } from "@/lib/server/ai-server";
import { getModelChain, type Tier } from "@/lib/tiers";
import { getUser, getProject, deductBalance, logAIUsage, USD_TO_KRW } from "@/lib/server/db";
import { analyzePrompt } from "@/lib/prompts";
import { rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const userId = session.user.id;

    const rl = rateLimit(`gen:${userId}`, 10, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "RATE_LIMITED", resetIn: rl.resetIn }, { status: 429 });

    const body = await req.json().catch(() => ({}));
    const { projectId, chapterIdx } = body;
    if (!projectId || typeof chapterIdx !== "number") {
      return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    }

    const projectRow = await getProject(projectId, userId);
    if (!projectRow) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    const project = projectRow.data;
    const ch = project.chapters?.[chapterIdx];
    if (!ch?.content) {
      return NextResponse.json({ error: "CHAPTER_EMPTY", message: "본문이 있는 챕터에서만 사용 가능합니다." }, { status: 400 });
    }

    const user = await getUser(userId);
    if (!user) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
    if (user.balance_krw < 30) {
      return NextResponse.json({
        error: "INSUFFICIENT_BALANCE",
        message: "잔액 부족 (분석 약 ₩10 필요).",
      }, { status: 402 });
    }

    // Lite 모델 chain — 분석은 비용 작게
    const candidates: AIModel[] = ["gemini-flash-lite-latest", "gemini-2.5-flash-lite", "gemini-flash-latest"];

    let result;
    try {
      result = await callAIServerWithFallback({
        candidates,
        system: "당신은 한국어 출판 편집자입니다. 챕터 본문을 출판 품질 관점에서 진단하고 JSON으로 응답합니다.",
        user: analyzePrompt(project, ch.title, ch.content),
        maxTokens: 2048,
        temperature: 0.2,
        timeoutMs: 25000,
        retries: 1,
      });
    } catch (e: any) {
      await logAIUsage({
        userId, task: "edit", model: candidates[0],
        inputTokens: 0, outputTokens: 0, thoughtsTokens: 0,
        cacheReadTokens: 0, cacheWriteTokens: 0,
        costUSD: 0, costKRW: 0, durationMs: 0,
        projectId, chapterIdx,
        status: "failed", errorMessage: `analyze: ${e?.message?.slice(0, 400)}`,
      }).catch(() => {});
      throw e;
    }

    let txt = result.text.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```\s*$/, "");
    let parsed: any;
    try {
      parsed = JSON.parse(txt);
    } catch {
      const m = txt.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("JSON parse 실패");
      parsed = JSON.parse(m[0]);
    }

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
        reason: `${chapterIdx + 1}장 품질 진단 (${result.actualModel})`,
      });
      newBalance = r.newBalance;
    }

    return NextResponse.json({
      ok: true,
      analysis: parsed,
      newBalance,
      costKRW,
      model: result.actualModel,
    });
  } catch (e: any) {
    console.error("[/api/generate/chapter-analyze] uncaught:", e);
    return NextResponse.json({
      error: "INTERNAL_ERROR",
      message: e?.message || String(e),
    }, { status: 500 });
  }
}
