// POST /api/generate/repurpose-blog
// body: { projectId, postCount? }
// 응답: { ok, content, newBalance, costKRW }
// Wave 1 — 책 1권 → 블로그 시리즈 5~10편 (마크다운, SEO 최적화)

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { callAIServer } from "@/lib/server/ai-server";
import { getModelChain, type Tier } from "@/lib/tiers";
import { getUser, getProject, updateProjectData, deductBalance, logAIUsage, USD_TO_KRW } from "@/lib/server/db";
import { blogSeriesPrompt } from "@/lib/prompts";
import { rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

const MIN_BALANCE_KRW = 120;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const userId = session.user.id;

    const rl = rateLimit(`repurpose-blog:${userId}`, 5, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "RATE_LIMITED", resetIn: rl.resetIn }, { status: 429 });

    const body = await req.json().catch(() => ({}));
    const projectId = body?.projectId;
    const postCount = Math.max(3, Math.min(10, Number(body?.postCount) || 5));
    if (!projectId) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

    const projectRow = await getProject(projectId, userId);
    if (!projectRow) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    const project = projectRow.data;

    const user = await getUser(userId);
    if (!user) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
    if (user.balance_krw < MIN_BALANCE_KRW) {
      return NextResponse.json({
        error: "INSUFFICIENT_BALANCE",
        message: `잔액 부족 (~₩100 필요, 최소 ₩${MIN_BALANCE_KRW})`,
        current: user.balance_krw,
      }, { status: 402 });
    }

    const tier: Tier = (project as any).tier ?? "basic";
    const candidates = getModelChain(tier);
    if (candidates.length === 0) return NextResponse.json({ error: "TIER_UNAVAILABLE" }, { status: 503 });

    const promptText = blogSeriesPrompt(project as any, postCount);

    let result: any = null;
    let actualModel = candidates[0];
    let lastError: any = null;
    for (const candidate of candidates) {
      try {
        result = await callAIServer({
          model: candidate,
          system: "당신은 한국 블로그 시리즈 작가입니다. 한국어 JSON만 출력합니다.",
          user: promptText,
          maxTokens: 16000,
          temperature: 0.7,
          timeoutMs: 28000,
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

    // sanitize: posts 10개 max, body 5000자 cap
    const seriesTitle = String(parsed.seriesTitle ?? "").slice(0, 200);
    const posts = (Array.isArray(parsed.posts) ? parsed.posts : [])
      .slice(0, 10)
      .map((p: any, i: number) => ({
        order: Number.isFinite(Number(p?.order)) ? Number(p.order) : i + 1,
        title: String(p?.title ?? "").slice(0, 150),
        body: String(p?.body ?? "").slice(0, 5000),
        excerpt: String(p?.excerpt ?? "").slice(0, 300),
        tags: (Array.isArray(p?.tags) ? p.tags : [])
          .slice(0, 10)
          .map((t: any) => String(t ?? "").trim().slice(0, 30))
          .filter(Boolean),
      }))
      .filter((p: any) => p.title && p.body);

    if (posts.length === 0) {
      return NextResponse.json({ error: "INSUFFICIENT_OUTPUT", message: "AI가 포스트를 생성하지 못함" }, { status: 502 });
    }

    const sanitized = {
      posts,
      seriesTitle: seriesTitle || `${(project as any).topic ?? "책"} 시리즈`,
      generatedAt: Date.now(),
    };

    const existing = (project as any).repurposedContent ?? {};
    await updateProjectData(projectId, userId, {
      ...project,
      repurposedContent: { ...existing, blog: sanitized },
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
        reason: `블로그 시리즈 재가공 (${actualModel})`,
      });
      newBalance = r.newBalance;
    }

    return NextResponse.json({ ok: true, content: sanitized, newBalance, costKRW });
  } catch (e: any) {
    console.error("[/api/generate/repurpose-blog]", e);
    return NextResponse.json({ error: "INTERNAL_ERROR", message: e?.message || String(e) }, { status: 500 });
  }
}
