// POST /api/generate/meta-package
// body: { projectId }
// 응답: { ok, metaAdPackage, newBalance, costKRW }

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { callAIServer } from "@/lib/server/ai-server";
import { getModelChain, type Tier } from "@/lib/tiers";
import { getUser, getProject, updateProjectData, deductBalance, logAIUsage, USD_TO_KRW } from "@/lib/server/db";
import { rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

const META_CTAS = ["학습하기", "자세히 알아보기", "구독하기", "신청하기", "무료 체험"];

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const userId = session.user.id;

    const rl = rateLimit(`meta:${userId}`, 5, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "RATE_LIMITED", resetIn: rl.resetIn }, { status: 429 });

    const { projectId } = await req.json().catch(() => ({}));
    if (!projectId) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

    const projectRow = await getProject(projectId, userId);
    if (!projectRow) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    const project = projectRow.data;

    const user = await getUser(userId);
    if (!user) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
    if (user.balance_krw < 50) {
      return NextResponse.json({
        error: "INSUFFICIENT_BALANCE",
        message: "잔액 부족 (~₩40)",
        current: user.balance_krw,
      }, { status: 402 });
    }

    const tier: Tier = (project as any).tier ?? "basic";
    const candidates = getModelChain(tier);
    if (candidates.length === 0) return NextResponse.json({ error: "TIER_UNAVAILABLE" }, { status: 503 });

    // 기존 marketingMeta·kmongCopy 활용 (있으면 더 좋은 결과)
    const tagline = (project as any).marketingMeta?.tagline ?? "";
    const description = (project as any).marketingMeta?.description ?? (project as any).kmongPackage?.copy?.kmongDescription ?? "";

    const promptText = `당신은 Meta(Facebook/Instagram) 광고 카피라이터입니다. 한국어로 광고 카피 패키지를 만듭니다.

[책 정보]
- 주제: ${project.topic}
- 대상 독자: ${project.audience}
- 책 유형: ${project.type}
${tagline ? `- 한 줄 요약: ${tagline}` : ""}
${description ? `- 설명: ${description.slice(0, 500)}` : ""}

[Meta Ads 제약]
- 헤드라인은 정확히 40자 이내
- 본문은 정확히 125자 이내
- CTA는 ["학습하기", "자세히 알아보기", "구독하기", "신청하기", "무료 체험"] 중에서 추천

[작업 — JSON 출력]
{
  "headlines": ["...", "...", "..."],     // 3개, 각 다른 hook (호기심·결과·문제 제시 등)
  "primaryTexts": ["...", "...", "..."],  // 3개, 각 본문 (125자 이하 — 매우 중요)
  "ctaButtons": ["...", "...", "..."],    // Meta 라벨 중 가장 적합한 3개
  "audienceSuggestion": {
    "ageMin": 25,                          // 책 대상에 맞춰 18~65
    "ageMax": 45,
    "interests": ["...", "...", "..."],   // 한글 관심사 키워드 3~5개
    "locations": ["대한민국"]
  }
}

JSON만 출력. 다른 설명 X. 모든 텍스트 한국어.`;

    let result: any = null;
    let actualModel = candidates[0];
    let lastError: any = null;
    for (const candidate of candidates) {
      try {
        result = await callAIServer({
          model: candidate,
          system: "당신은 Meta 광고 카피라이터입니다. 한국어 JSON만 출력합니다.",
          user: promptText,
          maxTokens: 2048,
          temperature: 0.8,
          timeoutMs: 25000,
          retries: 0,
        });
        actualModel = candidate;
        break;
      } catch (e: any) {
        lastError = e;
        const msg = String(e?.message ?? "");
        const transient = /\b50[23]\b|UNAVAILABLE|overloaded|timeout|429|quota/i.test(msg);
        if (!transient) return NextResponse.json({ error: "AI_CALL_FAILED", message: msg }, { status: 502 });
      }
    }
    if (!result) return NextResponse.json({ error: "AI_CALL_FAILED", message: lastError?.message }, { status: 502 });

    let parsed: any;
    try {
      let txt = result.text.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```\s*$/, "");
      parsed = JSON.parse(txt);
    } catch {
      return NextResponse.json({ error: "INVALID_AI_OUTPUT", raw: result.text.slice(0, 500) }, { status: 502 });
    }

    // sanitize + 길이 강제
    const headlines = (Array.isArray(parsed.headlines) ? parsed.headlines : [])
      .slice(0, 3).map((s: any) => String(s ?? "").slice(0, 40)).filter(Boolean);
    const primaryTexts = (Array.isArray(parsed.primaryTexts) ? parsed.primaryTexts : [])
      .slice(0, 3).map((s: any) => String(s ?? "").slice(0, 125)).filter(Boolean);
    const ctaButtons = (Array.isArray(parsed.ctaButtons) ? parsed.ctaButtons : [])
      .slice(0, 5).map((s: any) => String(s ?? "")).filter((s: string) => META_CTAS.includes(s));
    const aud = parsed.audienceSuggestion ?? {};
    const audienceSuggestion = {
      ageMin: Math.max(18, Math.min(65, Number(aud.ageMin) || 25)),
      ageMax: Math.max(18, Math.min(65, Number(aud.ageMax) || 45)),
      interests: (Array.isArray(aud.interests) ? aud.interests : [])
        .slice(0, 5).map((s: any) => String(s ?? "").slice(0, 30)).filter(Boolean),
      locations: Array.isArray(aud.locations) && aud.locations.length > 0
        ? aud.locations.slice(0, 3).map((s: any) => String(s ?? "").slice(0, 50))
        : ["대한민국"],
    };

    if (headlines.length === 0 || primaryTexts.length === 0) {
      return NextResponse.json({ error: "INSUFFICIENT_OUTPUT", message: "AI가 충분한 카피를 생성하지 못함. 다시 시도하세요." }, { status: 502 });
    }

    const metaAdPackage = {
      headlines,
      primaryTexts,
      ctaButtons: ctaButtons.length > 0 ? ctaButtons : ["자세히 알아보기"],
      audienceSuggestion,
      generatedAt: Date.now(),
    };

    await updateProjectData(projectId, userId, { ...project, metaAdPackage });

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
      const r = await deductBalance({ userId, amountKRW: costKRW, aiUsageId: log.id, reason: `Meta 광고 패키지 (${actualModel})` });
      newBalance = r.newBalance;
    }
    return NextResponse.json({ ok: true, metaAdPackage, newBalance, costKRW });
  } catch (e: any) {
    console.error("[/api/generate/meta-package]", e);
    return NextResponse.json({ error: "INTERNAL_ERROR", message: e?.message || String(e) }, { status: 500 });
  }
}
