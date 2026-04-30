// POST /api/generate/marketing-meta
// body: { projectId }
// kmongCopy 있으면 변환만 (cost 0). 없으면 AI 호출 (~₩15)
// 응답: { ok, marketingMeta, newBalance, costKRW, source: "kmong" | "ai" }

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { callAIServer } from "@/lib/server/ai-server";
import { getModelChain, type Tier } from "@/lib/tiers";
import {
  getUser, getProject, updateProjectData,
  deductBalance, logAIUsage, USD_TO_KRW,
} from "@/lib/server/db";
import { rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const userId = session.user.id;

    const rl = rateLimit(`mkt:${userId}`, 5, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "RATE_LIMITED", resetIn: rl.resetIn }, { status: 429 });

    const { projectId } = await req.json().catch(() => ({}));
    if (!projectId) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

    const projectRow = await getProject(projectId, userId);
    if (!projectRow) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    const project = projectRow.data;

    // kmongCopy 있으면 그대로 변환 (cost 0)
    const kCopy = (project as any).kmongPackage?.copy;
    if (kCopy?.kmongDescription && Array.isArray(kCopy.kmongHighlights) && kCopy.kmongHighlights.length > 0) {
      const tagline = String(kCopy.kmongHighlights[0] ?? "");
      const description = String(kCopy.kmongDescription ?? "");
      const marketingMeta = {
        tagline: tagline.slice(0, 200),
        description: description.slice(0, 3000),
        generatedAt: Date.now(),
      };
      await updateProjectData(projectId, userId, { ...project, marketingMeta });
      return NextResponse.json({ ok: true, marketingMeta, newBalance: null, costKRW: 0, source: "kmong" });
    }

    // AI 생성
    const user = await getUser(userId);
    if (!user) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
    if (user.balance_krw < 30) {
      return NextResponse.json({
        error: "INSUFFICIENT_BALANCE",
        message: "잔액 부족 (~₩30)",
        current: user.balance_krw,
      }, { status: 402 });
    }

    const tier: Tier = (project as any).tier ?? "basic";
    const candidates = getModelChain(tier);
    if (candidates.length === 0) return NextResponse.json({ error: "TIER_UNAVAILABLE" }, { status: 503 });

    const promptText = `당신은 책 광고 카피라이터입니다.

[책 정보]
- 주제: ${project.topic}
- 대상 독자: ${project.audience}
- 책 유형: ${project.type}
- 챕터: ${(project.chapters || []).slice(0, 8).map((c: any, i: number) => `${i+1}. ${c.title}`).join(", ")}

[작업]
이 책의 마케팅 페이지에 들어갈 한국어 JSON 출력:

{
  "tagline": "한 줄 요약 (50~80자, 호기심 유발)",
  "description": "2~3문단 광고문 (300~500자, 누구를 위한 책 + 무엇을 얻는가 + 다른 책과 차별점)"
}

JSON만 출력. 다른 설명 X.`;

    let result: any = null;
    let actualModel = candidates[0];
    let lastError: any = null;
    for (const candidate of candidates) {
      try {
        result = await callAIServer({
          model: candidate,
          system: "당신은 한국어 책 광고 카피라이터입니다. JSON만 출력합니다.",
          user: promptText,
          maxTokens: 1024,
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

    let parsed: { tagline: string; description: string };
    try {
      let txt = result.text.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```\s*$/, "");
      parsed = JSON.parse(txt);
    } catch {
      return NextResponse.json({ error: "INVALID_AI_OUTPUT", raw: result.text.slice(0, 500) }, { status: 502 });
    }

    const marketingMeta = {
      tagline: String(parsed.tagline ?? "").slice(0, 200),
      description: String(parsed.description ?? "").slice(0, 3000),
      generatedAt: Date.now(),
    };

    await updateProjectData(projectId, userId, { ...project, marketingMeta });

    const costKRW = Math.ceil(result.usage.costUSD * USD_TO_KRW);
    const { id: usageId } = await logAIUsage({
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
        userId, amountKRW: costKRW, aiUsageId: usageId,
        reason: `마케팅 메타 (${actualModel})`,
      });
      newBalance = r.newBalance;
    }

    return NextResponse.json({ ok: true, marketingMeta, newBalance, costKRW, source: "ai" });
  } catch (e: any) {
    console.error("[/api/generate/marketing-meta] uncaught:", e);
    return NextResponse.json({ error: "INTERNAL_ERROR", message: e?.message || String(e) }, { status: 500 });
  }
}
