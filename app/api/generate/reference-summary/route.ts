// POST /api/generate/reference-summary
// body: { projectId }
// 모든 reference chunks 가져와서 AI에게 요약 시킴 → project.data.referencesSummary 저장

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@vercel/postgres";
import { callAIServer } from "@/lib/server/ai-server";
import { getModelChain, type Tier } from "@/lib/tiers";
import {
  getUser, getProject, updateProjectData,
  deductBalance, logAIUsage, USD_TO_KRW,
} from "@/lib/server/db";
import { referenceSummaryPrompt } from "@/lib/prompts";
import { rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_CHUNKS_FOR_SUMMARY = 30;  // 토큰 한계 — 너무 많으면 sample
// 가격 정책 (Sang-nim 10x 인상, 2026-05): 자료 분석 ₩200 고정
const FIXED_COST_KRW = 200;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const userId = session.user.id;

    const rl = rateLimit(`ref-summary:${userId}`, 5, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "RATE_LIMITED", resetIn: rl.resetIn }, { status: 429 });

    const { projectId } = await req.json().catch(() => ({}));
    if (!projectId) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

    const projectRow = await getProject(projectId, userId);
    if (!projectRow) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    const project = projectRow.data;

    const user = await getUser(userId);
    if (!user) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
    if (user.balance_krw < FIXED_COST_KRW) {
      return NextResponse.json({
        error: "INSUFFICIENT_BALANCE",
        message: `잔액 부족 (자료 분석 ₩${FIXED_COST_KRW} 필요)`,
        current: user.balance_krw,
      }, { status: 402 });
    }

    // 모든 chunks 가져오기 (project 권한 검증된 후)
    const { rows: allChunks } = await sql<{
      content: string;
      filename: string;
      chunk_idx: number;
    }>`
      SELECT rc.content, br.filename, rc.chunk_idx
      FROM reference_chunks rc
      JOIN book_references br ON br.id = rc.reference_id
      WHERE br.project_id = ${projectId}
      ORDER BY br.uploaded_at, rc.chunk_idx
    `;

    if (allChunks.length === 0) {
      return NextResponse.json({ error: "NO_REFERENCES", message: "레퍼런스 먼저 업로드하세요" }, { status: 400 });
    }

    // 너무 많으면 evenly sample
    let chunksForSummary = allChunks;
    if (allChunks.length > MAX_CHUNKS_FOR_SUMMARY) {
      const stride = Math.floor(allChunks.length / MAX_CHUNKS_FOR_SUMMARY);
      chunksForSummary = allChunks.filter((_, i) => i % stride === 0).slice(0, MAX_CHUNKS_FOR_SUMMARY);
    }

    const tier: Tier = (project as any).tier ?? "basic";
    const candidates = getModelChain(tier);
    if (candidates.length === 0) {
      return NextResponse.json({ error: "TIER_UNAVAILABLE" }, { status: 503 });
    }

    const promptText = referenceSummaryPrompt(
      { topic: project.topic, audience: project.audience, type: project.type, targetPages: project.targetPages },
      chunksForSummary.map(c => ({ content: c.content, referenceFilename: c.filename, chunkIdx: c.chunk_idx })),
    );

    let result: any = null;
    let actualModel = candidates[0];
    let lastError: any = null;
    for (const candidate of candidates) {
      try {
        result = await callAIServer({
          model: candidate,
          system: "당신은 한국어 책 분석가입니다. JSON만 출력합니다.",
          user: promptText,
          maxTokens: 2048,
          temperature: 0.4,
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

    let parsed: { keyPoints: string[]; coveredTopics: string[]; gaps: string[] };
    try {
      let txt = result.text.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```\s*$/, "");
      parsed = JSON.parse(txt);
      if (!Array.isArray(parsed.keyPoints) || !Array.isArray(parsed.coveredTopics) || !Array.isArray(parsed.gaps)) {
        throw new Error("missing arrays");
      }
    } catch {
      return NextResponse.json({ error: "INVALID_AI_OUTPUT", raw: result.text.slice(0, 500) }, { status: 502 });
    }

    const summary = {
      keyPoints: parsed.keyPoints.slice(0, 5),
      coveredTopics: parsed.coveredTopics.slice(0, 10),
      gaps: parsed.gaps.slice(0, 7),
      generatedAt: Date.now(),
      basedOnChunkCount: allChunks.length,
    };

    await updateProjectData(projectId, userId, { ...project, referencesSummary: summary });

    // 새 가격 정책: 자료 분석 ₩200 고정 (raw API cost는 cost_usd로만 기록)
    const costKRW = FIXED_COST_KRW;
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
    const r = await deductBalance({
      userId, amountKRW: costKRW, aiUsageId: usageId,
      reason: `자료 요약 (${actualModel})`,
    });
    const newBalance = r.newBalance;

    return NextResponse.json({ ok: true, summary, newBalance, costKRW });
  } catch (e: any) {
    console.error("[/api/generate/reference-summary] uncaught:", e);
    return NextResponse.json({ error: "INTERNAL_ERROR", message: e?.message || String(e) }, { status: 500 });
  }
}
