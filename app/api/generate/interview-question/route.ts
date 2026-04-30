import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { callAIServer, type AIModel } from "@/lib/server/ai-server";
import { getModelChain, type Tier } from "@/lib/tiers";
import {
  getUser, getProject,
  deductBalance, logAIUsage, USD_TO_KRW,
} from "@/lib/server/db";
import { interviewerPrompt } from "@/lib/prompts";
import { rateLimit } from "@/lib/server/rate-limit";
import { ragSearch } from "@/lib/server/rag";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const userId = session.user.id;

    const rl = rateLimit(`iq:${userId}`, 30, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "RATE_LIMITED", resetIn: rl.resetIn }, { status: 429 });

    const { projectId, history } = await req.json().catch(() => ({}));
    if (!projectId || !Array.isArray(history)) {
      return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    }

    const projectRow = await getProject(projectId, userId);
    if (!projectRow) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    const project = projectRow.data;
    const summary = (project as any).referencesSummary ?? undefined;

    const user = await getUser(userId);
    if (!user) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });

    if (user.balance_krw < 10) {
      return NextResponse.json({
        error: "INSUFFICIENT_BALANCE",
        message: "잔액이 부족합니다 (약 ₩5 필요).",
        current: user.balance_krw,
      }, { status: 402 });
    }

    const tier: Tier = (project as any).tier ?? "basic";
    const candidates = getModelChain(tier);
    if (candidates.length === 0) {
      return NextResponse.json({ error: "TIER_UNAVAILABLE" }, { status: 503 });
    }

    // RAG 검색 — 사용자 마지막 답변 또는 책 주제로 query
    const lastAnswer = history.length > 0 ? history[history.length - 1].a : "";
    const ragQuery = lastAnswer && lastAnswer.trim().length > 20 ? lastAnswer : project.topic;

    let ragChunks: Awaited<ReturnType<typeof ragSearch>> = [];
    try {
      ragChunks = await ragSearch({
        projectId,
        query: ragQuery,
        topN: 3,
        maxDistance: 0.7,
      });
    } catch (e: any) {
      console.warn("[interview-question] RAG search failed:", e?.message);
      // RAG 실패해도 인터뷰는 진행 (degraded mode)
    }

    // 진짜 fallback chain — 첫 candidate 실패 시 다음 vendor로
    let result;
    let actualModel: AIModel = candidates[0];
    let lastError: any = null;
    for (const candidate of candidates) {
      try {
        result = await callAIServer({
          model: candidate,
          system: "당신은 책 작가 인터뷰어입니다. 한국어로 JSON만 출력합니다.",
          user: interviewerPrompt(project, history, ragChunks, summary),
          maxTokens: 1024,
          temperature: 0.8,
          timeoutMs: 15000,
          retries: 0,
        });
        actualModel = candidate;
        break;
      } catch (e: any) {
        lastError = e;
        const msg = String(e?.message ?? "");
        const transient = /\b50[23]\b|UNAVAILABLE|overloaded|timeout|시간 초과|429|quota/i.test(msg);
        if (!transient) {
          return NextResponse.json({ error: "AI_CALL_FAILED", message: msg }, { status: 502 });
        }
      }
    }
    if (!result) {
      return NextResponse.json({ error: "AI_CALL_FAILED", message: lastError?.message ?? "all candidates failed" }, { status: 502 });
    }

    let parsed: any;
    try {
      let txt = result.text.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```\s*$/, "");
      parsed = JSON.parse(txt);
    } catch {
      return NextResponse.json({ error: "INVALID_AI_OUTPUT", raw: result.text.slice(0, 500) }, { status: 502 });
    }

    const costKRW = Math.ceil(result.usage.costUSD * USD_TO_KRW);
    const { id: usageId } = await logAIUsage({
      userId, task: "edit", model: actualModel,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      thoughtsTokens: result.usage.thoughtsTokens,
      cacheReadTokens: result.usage.cacheReadTokens,
      cacheWriteTokens: result.usage.cacheWriteTokens,
      costUSD: result.usage.costUSD,
      costKRW,
      durationMs: result.usage.durationMs,
      projectId, status: "success",
    });
    let newBalance = user.balance_krw;
    if (costKRW > 0) {
      const r = await deductBalance({
        userId, amountKRW: costKRW, aiUsageId: usageId,
        reason: `인터뷰 질문 ${history.length + 1}번 (${actualModel})`,
      });
      newBalance = r.newBalance;
    }

    return NextResponse.json({
      ...parsed,
      newBalance,
      costKRW,
    });
  } catch (e: any) {
    console.error("[/api/generate/interview-question] uncaught:", e);
    return NextResponse.json({
      error: "INTERNAL_ERROR",
      message: e?.message || String(e),
    }, { status: 500 });
  }
}
