// POST /api/generate/repurpose-kakao
// body: { projectId }
// 응답: { ok, content, newBalance, costKRW }
// Wave 1 — 책 1권 → 카카오톡 채널 메시지 5편 (짧고 후킹)

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { callAIServer } from "@/lib/server/ai-server";
import { getModelChain, type Tier } from "@/lib/tiers";
import { getUser, getProject, updateProjectData, deductBalance, logAIUsage, USD_TO_KRW } from "@/lib/server/db";
import { kakaoChannelPrompt } from "@/lib/prompts";
import { rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

const MIN_BALANCE_KRW = 30;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const userId = session.user.id;

    const rl = rateLimit(`repurpose-kakao:${userId}`, 5, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "RATE_LIMITED", resetIn: rl.resetIn }, { status: 429 });

    const { projectId } = await req.json().catch(() => ({}));
    if (!projectId) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

    const projectRow = await getProject(projectId, userId);
    if (!projectRow) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    const project = projectRow.data;

    const user = await getUser(userId);
    if (!user) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
    if (user.balance_krw < MIN_BALANCE_KRW) {
      return NextResponse.json({
        error: "INSUFFICIENT_BALANCE",
        message: `잔액 부족 (~₩20 필요, 최소 ₩${MIN_BALANCE_KRW})`,
        current: user.balance_krw,
      }, { status: 402 });
    }

    const tier: Tier = (project as any).tier ?? "basic";
    const candidates = getModelChain(tier);
    if (candidates.length === 0) return NextResponse.json({ error: "TIER_UNAVAILABLE" }, { status: 503 });

    const promptText = kakaoChannelPrompt(project as any);

    let result: any = null;
    let actualModel = candidates[0];
    let lastError: any = null;
    for (const candidate of candidates) {
      try {
        result = await callAIServer({
          model: candidate,
          system: "당신은 한국 카카오톡 채널 메시지 카피라이터입니다. 한국어 JSON만 출력합니다.",
          user: promptText,
          maxTokens: 2048,
          temperature: 0.7,
          timeoutMs: 20000,
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
      const txt = result.text.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```\s*$/, "");
      parsed = JSON.parse(txt);
    } catch {
      return NextResponse.json({ error: "INVALID_AI_OUTPUT", raw: result.text.slice(0, 500) }, { status: 502 });
    }

    // sanitize: 10편 max, body 500자 cap
    const messages = (Array.isArray(parsed.messages) ? parsed.messages : [])
      .slice(0, 10)
      .map((m: any, i: number) => ({
        order: Number.isFinite(Number(m?.order)) ? Number(m.order) : i + 1,
        hook: String(m?.hook ?? "").slice(0, 100),
        body: String(m?.body ?? "").slice(0, 500),
        cta: String(m?.cta ?? "").slice(0, 100),
      }))
      .filter((m: any) => m.hook || m.body);

    if (messages.length === 0) {
      return NextResponse.json({ error: "INSUFFICIENT_OUTPUT", message: "AI가 메시지를 생성하지 못함" }, { status: 502 });
    }

    const sanitized = {
      messages,
      generatedAt: Date.now(),
    };

    const existing = (project as any).repurposedContent ?? {};
    await updateProjectData(projectId, userId, {
      ...project,
      repurposedContent: { ...existing, kakao: sanitized },
    });

    const costKRW = Math.ceil(result.usage.costUSD * USD_TO_KRW);
    const log = await logAIUsage({
      userId, task: "edit", model: actualModel,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      thoughtsTokens: result.usage.thoughtsTokens,
      cacheReadTokens: result.usage.cacheReadTokens,
      cacheWriteTokens: result.usage.cacheWriteTokens,
      costUSD: result.usage.costUSD, costKRW,
      durationMs: result.usage.durationMs,
      projectId, status: "success",
    });
    let newBalance = user.balance_krw;
    if (costKRW > 0) {
      const r = await deductBalance({
        userId, amountKRW: costKRW, aiUsageId: log.id,
        reason: `카카오톡 채널 메시지 재가공 (${actualModel})`,
      });
      newBalance = r.newBalance;
    }

    return NextResponse.json({ ok: true, content: sanitized, newBalance, costKRW });
  } catch (e: any) {
    console.error("[/api/generate/repurpose-kakao]", e);
    return NextResponse.json({ error: "INTERNAL_ERROR", message: e?.message || String(e) }, { status: 500 });
  }
}
