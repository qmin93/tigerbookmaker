// POST /api/generate/repurpose-instagram
// body: { projectId }
// 응답: { ok, content, newBalance, costKRW }
// Wave 1 — 책 1권 → 인스타 카드뉴스 10장 + 캡션 + 해시태그

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { callAIServer } from "@/lib/server/ai-server";
import { getModelChain, type Tier } from "@/lib/tiers";
import { getUser, getProject, updateProjectData, deductBalance, logAIUsage, USD_TO_KRW } from "@/lib/server/db";
import { instagramCardsPrompt } from "@/lib/prompts";
import { rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

// 가격 정책 (Sang-nim 10x 인상, 2026-05): 인스타 카드뉴스 텍스트 ₩500 고정
const FIXED_COST_KRW = 500;
const MIN_BALANCE_KRW = 500;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const userId = session.user.id;

    const rl = rateLimit(`repurpose-instagram:${userId}`, 5, 60_000);
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
        message: `잔액 부족 (인스타 카드뉴스 ₩${FIXED_COST_KRW} 필요)`,
        current: user.balance_krw,
      }, { status: 402 });
    }

    const tier: Tier = (project as any).tier ?? "basic";
    const candidates = getModelChain(tier);
    if (candidates.length === 0) return NextResponse.json({ error: "TIER_UNAVAILABLE" }, { status: 503 });

    const promptText = instagramCardsPrompt(project as any);

    let result: any = null;
    let actualModel = candidates[0];
    let lastError: any = null;
    for (const candidate of candidates) {
      try {
        result = await callAIServer({
          model: candidate,
          system: "당신은 한국 인스타그램 카드뉴스 콘텐츠 디자이너입니다. 한국어 JSON만 출력합니다.",
          user: promptText,
          maxTokens: 4096,
          temperature: 0.7,
          timeoutMs: 25000,
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

    // sanitize: 10장 max, body 200자 cap
    const cards = (Array.isArray(parsed.cards) ? parsed.cards : [])
      .slice(0, 10)
      .map((c: any, i: number) => ({
        slideNum: Number.isFinite(Number(c?.slideNum)) ? Number(c.slideNum) : i + 1,
        title: String(c?.title ?? "").slice(0, 80),
        body: String(c?.body ?? "").slice(0, 200),
        designNote: String(c?.designNote ?? "").slice(0, 300),
      }))
      .filter((c: any) => c.title || c.body);

    if (cards.length === 0) {
      return NextResponse.json({ error: "INSUFFICIENT_OUTPUT", message: "AI가 카드를 생성하지 못함" }, { status: 502 });
    }

    const caption = String(parsed.caption ?? "").slice(0, 1000);
    const hashtags = (Array.isArray(parsed.hashtags) ? parsed.hashtags : [])
      .slice(0, 20)
      .map((h: any) => {
        const s = String(h ?? "").trim().slice(0, 40);
        return s.startsWith("#") ? s : (s ? `#${s}` : "");
      })
      .filter(Boolean);

    const sanitized = {
      cards,
      caption,
      hashtags,
      generatedAt: Date.now(),
    };

    const existing = (project as any).repurposedContent ?? {};
    await updateProjectData(projectId, userId, {
      ...project,
      repurposedContent: { ...existing, instagram: sanitized },
    });

    // 새 가격 정책: 인스타 카드뉴스 ₩500 고정
    const costKRW = FIXED_COST_KRW;
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
    const r = await deductBalance({
      userId, amountKRW: costKRW, aiUsageId: log.id,
      reason: `인스타 카드뉴스 재가공 (${actualModel})`,
    });
    const newBalance = r.newBalance;

    return NextResponse.json({ ok: true, content: sanitized, newBalance, costKRW });
  } catch (e: any) {
    console.error("[/api/generate/repurpose-instagram]", e);
    return NextResponse.json({ error: "INTERNAL_ERROR", message: e?.message || String(e) }, { status: 500 });
  }
}
