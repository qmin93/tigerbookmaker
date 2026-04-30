// POST /api/generate/tone-recommend
// body: { projectId, mode: "auto" | "preset" | "reference-book", preset?, excerpt? }
// 응답: { ok, toneSetting, newBalance, costKRW }

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@vercel/postgres";
import { callAIServer } from "@/lib/server/ai-server";
import { getModelChain, type Tier } from "@/lib/tiers";
import {
  getUser, getProject, updateProjectData,
  deductBalance, logAIUsage, USD_TO_KRW,
} from "@/lib/server/db";
import { autoTonePrompt, referenceBookTonePrompt, tonePresetDescriptions } from "@/lib/prompts";
import { rateLimit } from "@/lib/server/rate-limit";
import type { TonePreset, ToneSetting } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const userId = session.user.id;

    const rl = rateLimit(`tone:${userId}`, 10, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "RATE_LIMITED", resetIn: rl.resetIn }, { status: 429 });

    const { projectId, mode, preset, excerpt } = await req.json().catch(() => ({}));
    if (!projectId || !["auto", "preset", "reference-book"].includes(mode)) {
      return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    }

    const projectRow = await getProject(projectId, userId);
    if (!projectRow) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    const project = projectRow.data;

    const user = await getUser(userId);
    if (!user) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });

    let finalTone = "";
    let costKRW = 0;
    let actualModel: any = null;
    let usageId: string | null = null;

    if (mode === "preset") {
      if (!preset || !(preset in tonePresetDescriptions)) {
        return NextResponse.json({ error: "INVALID_PRESET" }, { status: 400 });
      }
      finalTone = tonePresetDescriptions[preset as TonePreset];
      // preset은 AI 호출 X — 비용 0
    } else {
      // auto 또는 reference-book — AI 호출
      if (user.balance_krw < 30) {
        return NextResponse.json({
          error: "INSUFFICIENT_BALANCE",
          message: "잔액 부족 (톤 분석 약 ₩20)",
          current: user.balance_krw,
        }, { status: 402 });
      }

      const tier: Tier = (project as any).tier ?? "basic";
      const candidates = getModelChain(tier);
      if (candidates.length === 0) return NextResponse.json({ error: "TIER_UNAVAILABLE" }, { status: 503 });

      let promptText = "";
      if (mode === "auto") {
        // 레퍼런스 chunks 가져오기 (있으면 활용)
        const { rows: chunks } = await sql<{ content: string; filename: string; chunk_idx: number }>`
          SELECT rc.content, br.filename, rc.chunk_idx
          FROM reference_chunks rc
          JOIN book_references br ON br.id = rc.reference_id
          WHERE br.project_id = ${projectId}
          ORDER BY br.uploaded_at, rc.chunk_idx
          LIMIT 10
        `;
        promptText = autoTonePrompt(
          project,
          chunks.map(c => ({ content: c.content, referenceFilename: c.filename, chunkIdx: c.chunk_idx })),
        );
      } else {
        // reference-book
        const ex = String(excerpt ?? "").trim();
        if (ex.length < 100) {
          return NextResponse.json({ error: "EXCERPT_TOO_SHORT", message: "최소 100자 발췌 필요" }, { status: 400 });
        }
        promptText = referenceBookTonePrompt(ex);
      }

      let result: any = null;
      let lastError: any = null;
      for (const candidate of candidates) {
        try {
          result = await callAIServer({
            model: candidate,
            system: "당신은 책 톤·문체 분석가입니다. 1~2문단의 한국어 finalTone만 출력합니다.",
            user: promptText,
            maxTokens: 800,
            temperature: 0.5,
            timeoutMs: 20000,
            retries: 0,
          });
          actualModel = candidate;
          break;
        } catch (e: any) {
          lastError = e;
          const msg = String(e?.message ?? "");
          const transient = /\b50[23]\b|UNAVAILABLE|overloaded|timeout|429|quota/i.test(msg);
          if (!transient) {
            return NextResponse.json({ error: "AI_CALL_FAILED", message: msg }, { status: 502 });
          }
        }
      }
      if (!result) return NextResponse.json({ error: "AI_CALL_FAILED", message: lastError?.message }, { status: 502 });

      finalTone = result.text.trim();
      costKRW = Math.ceil(result.usage.costUSD * USD_TO_KRW);
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
      usageId = log.id;
    }

    let newBalance = user.balance_krw;
    if (costKRW > 0 && usageId) {
      const r = await deductBalance({
        userId, amountKRW: costKRW, aiUsageId: usageId,
        reason: `톤 분석 (${actualModel ?? mode})`,
      });
      newBalance = r.newBalance;
    }

    const toneSetting: ToneSetting = {
      mode: mode as ToneSetting["mode"],
      ...(mode === "preset" ? { preset: preset as TonePreset } : {}),
      ...(mode === "reference-book" ? { referenceBookExcerpt: String(excerpt).slice(0, 3000) } : {}),
      finalTone,
      generatedAt: Date.now(),
    };

    await updateProjectData(projectId, userId, { ...project, toneSetting });

    return NextResponse.json({ ok: true, toneSetting, newBalance, costKRW });
  } catch (e: any) {
    console.error("[/api/generate/tone-recommend] uncaught:", e);
    return NextResponse.json({ error: "INTERNAL_ERROR", message: e?.message || String(e) }, { status: 500 });
  }
}
