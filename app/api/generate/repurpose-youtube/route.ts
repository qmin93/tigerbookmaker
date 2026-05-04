// POST /api/generate/repurpose-youtube
// body: { projectId, durationMinutes? }
// 응답: { ok, content, newBalance, costKRW }
// Wave 1 — 책 1권 → 유튜브 쇼츠·릴스 1-3분 대본 + 썸네일 + 챕터 마커

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { callAIServer } from "@/lib/server/ai-server";
import { getModelChain, type Tier } from "@/lib/tiers";
import { getUser, getProject, updateProjectData, deductBalance, logAIUsage, USD_TO_KRW } from "@/lib/server/db";
import { youtubeScriptPrompt } from "@/lib/prompts";
import { rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

// 가격 정책 (Sang-nim 10x 인상, 2026-05): 유튜브 대본 ₩500 고정
const FIXED_COST_KRW = 500;
const MIN_BALANCE_KRW = 500;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const userId = session.user.id;

    const rl = rateLimit(`repurpose-youtube:${userId}`, 5, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "RATE_LIMITED", resetIn: rl.resetIn }, { status: 429 });

    const body = await req.json().catch(() => ({}));
    const projectId = body?.projectId;
    const durationMinutes = Math.max(1, Math.min(3, Number(body?.durationMinutes) || 2));
    if (!projectId) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

    const projectRow = await getProject(projectId, userId);
    if (!projectRow) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    const project = projectRow.data;

    const user = await getUser(userId);
    if (!user) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
    if (user.balance_krw < MIN_BALANCE_KRW) {
      return NextResponse.json({
        error: "INSUFFICIENT_BALANCE",
        message: `잔액 부족 (유튜브 대본 ₩${FIXED_COST_KRW} 필요)`,
        current: user.balance_krw,
      }, { status: 402 });
    }

    const tier: Tier = (project as any).tier ?? "basic";
    const candidates = getModelChain(tier);
    if (candidates.length === 0) return NextResponse.json({ error: "TIER_UNAVAILABLE" }, { status: 503 });

    const promptText = youtubeScriptPrompt(project as any, durationMinutes);

    let result: any = null;
    let actualModel = candidates[0];
    let lastError: any = null;
    for (const candidate of candidates) {
      try {
        result = await callAIServer({
          model: candidate,
          system: "당신은 한국 유튜브 쇼츠·릴스 대본 작가입니다. 한국어 JSON만 출력합니다.",
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

    // sanitize: script 5000자 cap
    const title = String(parsed.title ?? "").slice(0, 100);
    const script = String(parsed.script ?? "").slice(0, 5000);
    const thumbnailConcept = String(parsed.thumbnailConcept ?? "").slice(0, 600);
    const chapterMarkers = (Array.isArray(parsed.chapterMarkers) ? parsed.chapterMarkers : [])
      .slice(0, 10)
      .map((m: any) => ({
        time: String(m?.time ?? "00:00").slice(0, 8),
        label: String(m?.label ?? "").slice(0, 60),
      }))
      .filter((m: any) => m.label);
    const description = String(parsed.description ?? "").slice(0, 800);
    const tags = (Array.isArray(parsed.tags) ? parsed.tags : [])
      .slice(0, 15)
      .map((t: any) => String(t ?? "").trim().slice(0, 30))
      .filter(Boolean);

    if (!script || script.length < 100) {
      return NextResponse.json({ error: "INSUFFICIENT_OUTPUT", message: "AI가 대본을 생성하지 못함" }, { status: 502 });
    }

    const sanitized = {
      title,
      script,
      thumbnailConcept,
      chapterMarkers,
      description,
      tags,
      generatedAt: Date.now(),
    };

    const existing = (project as any).repurposedContent ?? {};
    await updateProjectData(projectId, userId, {
      ...project,
      repurposedContent: { ...existing, youtube: sanitized },
    });

    // 새 가격 정책: 유튜브 대본 ₩500 고정
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
      reason: `유튜브 대본 재가공 (${actualModel})`,
    });
    const newBalance = r.newBalance;

    return NextResponse.json({ ok: true, content: sanitized, newBalance, costKRW });
  } catch (e: any) {
    console.error("[/api/generate/repurpose-youtube]", e);
    return NextResponse.json({ error: "INTERNAL_ERROR", message: e?.message || String(e) }, { status: 500 });
  }
}
