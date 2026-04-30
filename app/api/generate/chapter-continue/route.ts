// POST /api/generate/chapter-continue
// 작가가 시작한 첫 단락(seedText)에서 AI가 그 톤으로 챕터 끝까지 이어 작성.
// 응답: NDJSON streaming — 기존 chapter route와 동일한 흐름.
// 최종 챕터 본문 = seedText + "\n\n" + AI 생성.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { estimateCost } from "@/lib/cost-estimate";
import { callAIServerWithFallback, callStreamWithFallback, type AIModel } from "@/lib/server/ai-server";
import { getModelChain, type Tier } from "@/lib/tiers";
import {
  getUser, getProject, updateProjectData,
  deductBalance, logAIUsage, USD_TO_KRW,
} from "@/lib/server/db";
import { SYSTEM_WRITER, continueChapterPrompt, summaryPrompt } from "@/lib/prompts";
import { rateLimit } from "@/lib/server/rate-limit";
import { ragSearch, hasReferences } from "@/lib/server/rag";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const userId = session.user.id;

    const rl = rateLimit(`gen:${userId}`, 10, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "RATE_LIMITED", resetIn: rl.resetIn }, { status: 429 });

    const body = await req.json().catch(() => ({}));
    const { projectId, chapterIdx, seedText } = body;
    if (!projectId || typeof chapterIdx !== "number") {
      return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    }
    const seed = String(seedText ?? "").trim();
    if (seed.length < 50) {
      return NextResponse.json({
        error: "SEED_TOO_SHORT",
        message: "이어쓰기는 최소 50자 이상 작성 후 가능합니다.",
      }, { status: 400 });
    }
    if (seed.length > 3000) {
      return NextResponse.json({
        error: "SEED_TOO_LONG",
        message: "이어쓰기 시작 부분은 최대 3000자입니다.",
      }, { status: 400 });
    }

    const projectRow = await getProject(projectId, userId);
    if (!projectRow) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    const project = projectRow.data;
    const ch = project.chapters?.[chapterIdx];
    if (!ch) return NextResponse.json({ error: "CHAPTER_NOT_FOUND" }, { status: 404 });

    const tier: Tier = (project as any).tier ?? "basic";
    const candidates = getModelChain(tier);
    if (candidates.length === 0) {
      return NextResponse.json({ error: "TIER_UNAVAILABLE" }, { status: 503 });
    }
    const model = candidates[0];
    const estimate = estimateCost("chapter", project, model);
    const user = await getUser(userId);
    if (!user) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
    if (user.balance_krw < estimate.minimumBalanceKRW) {
      return NextResponse.json({
        error: "INSUFFICIENT_BALANCE",
        required: estimate.minimumBalanceKRW,
        current: user.balance_krw,
        shortfall: estimate.minimumBalanceKRW - user.balance_krw,
      }, { status: 402 });
    }

    // RAG 자동 주입 — 챕터 제목 + seed 앞 200자 결합 쿼리 (더 구체적인 매칭)
    let chapterChunks: Awaited<ReturnType<typeof ragSearch>> = [];
    try {
      if (await hasReferences(projectId)) {
        const query = `${ch.title}${seed ? "\n" + seed.slice(0, 200) : ""}`;
        chapterChunks = await ragSearch({
          projectId,
          query,
          topN: 4,
          maxDistance: 0.7,
        });
      }
    } catch (e: any) {
      console.warn("[chapter-continue] RAG search failed:", e?.message);
    }

    const toneSetting = (project as any).toneSetting ?? undefined;

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: any) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        let aiText = "";
        let bodyUsage: any = null;
        let actualModel: AIModel = candidates[0];

        // 먼저 작가가 쓴 부분을 frontend에 그대로 emit
        send({ type: "seed", text: seed });

        try {
          const gen = callStreamWithFallback({
            candidates,
            system: SYSTEM_WRITER,
            user: continueChapterPrompt(project, chapterIdx, ch.title, ch.subtitle, seed, chapterChunks, toneSetting),
            timeoutMs: 55000,
          });
          for await (const evt of gen) {
            if (evt.model) actualModel = evt.model;
            if (evt.type === "chunk") {
              aiText += evt.text;
              send({ type: "chunk", text: evt.text });
            } else if (evt.type === "done") {
              bodyUsage = evt.usage;
            }
          }
        } catch (e: any) {
          await logAIUsage({
            userId, task: "chapter", model: actualModel,
            inputTokens: 0, outputTokens: 0, thoughtsTokens: 0,
            cacheReadTokens: 0, cacheWriteTokens: 0,
            costUSD: 0, costKRW: 0, durationMs: 0,
            projectId, chapterIdx,
            status: "failed", errorMessage: `continue: ${e?.message?.slice(0, 400)}`,
          }).catch(() => {});
          send({ type: "error", message: e?.message || "AI 호출 실패" });
          controller.close();
          return;
        }

        if (!bodyUsage) {
          send({ type: "error", message: "AI stream이 usage 없이 끝남" });
          controller.close();
          return;
        }

        // 비용 차감 + 로그
        const costKRW = Math.ceil(bodyUsage.costUSD * USD_TO_KRW);
        const { id: usageId } = await logAIUsage({
          userId, task: "chapter", model: actualModel,
          inputTokens: bodyUsage.inputTokens,
          outputTokens: bodyUsage.outputTokens,
          thoughtsTokens: bodyUsage.thoughtsTokens,
          cacheReadTokens: 0, cacheWriteTokens: 0,
          costUSD: bodyUsage.costUSD,
          costKRW,
          durationMs: bodyUsage.durationMs,
          projectId, chapterIdx,
          status: "success",
        });
        let newBalance = user.balance_krw;
        if (costKRW > 0) {
          const r = await deductBalance({
            userId, amountKRW: costKRW, aiUsageId: usageId,
            reason: `${chapterIdx + 1}장 이어쓰기 (${actualModel})`,
          });
          newBalance = r.newBalance;
        }

        // 최종 본문 = seed + AI
        const fullText = seed + "\n\n" + aiText.trim();

        // 자동 요약 (chapter route와 동일 — fallback chain)
        let summary = "";
        let summaryCostKRW = 0;
        let summaryNewBalance = newBalance;
        const summaryCandidates: AIModel[] = ["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.5-flash-lite"];
        const truncatedText = fullText.length > 8000 ? fullText.slice(0, 6000) + "\n\n[...본문 일부 생략...]" : fullText;
        try {
          const sumResult = await callAIServerWithFallback({
            candidates: summaryCandidates,
            system: "당신은 책 챕터를 200~300자로 압축하는 요약가입니다.",
            user: summaryPrompt(ch.title, truncatedText),
            maxTokens: 512,
            temperature: 0.3,
            timeoutMs: 30000,
            retries: 2,
          });
          summary = sumResult.text.trim();
          summaryCostKRW = Math.ceil(sumResult.usage.costUSD * USD_TO_KRW);
          const { id: sumUsageId } = await logAIUsage({
            userId, task: "summary", model: sumResult.actualModel,
            inputTokens: sumResult.usage.inputTokens,
            outputTokens: sumResult.usage.outputTokens,
            thoughtsTokens: sumResult.usage.thoughtsTokens,
            cacheReadTokens: sumResult.usage.cacheReadTokens,
            cacheWriteTokens: sumResult.usage.cacheWriteTokens,
            costUSD: sumResult.usage.costUSD,
            costKRW: summaryCostKRW,
            durationMs: sumResult.usage.durationMs,
            projectId, chapterIdx, status: "success",
          });
          if (summaryCostKRW > 0) {
            const r = await deductBalance({
              userId, amountKRW: summaryCostKRW, aiUsageId: sumUsageId,
              reason: `${chapterIdx + 1}장 요약 (${sumResult.actualModel})`,
            });
            summaryNewBalance = r.newBalance;
          }
        } catch (e: any) {
          await logAIUsage({
            userId, task: "summary", model: "gemini-flash-latest",
            inputTokens: 0, outputTokens: 0, thoughtsTokens: 0,
            cacheReadTokens: 0, cacheWriteTokens: 0,
            costUSD: 0, costKRW: 0, durationMs: 0,
            projectId, chapterIdx,
            status: "failed", errorMessage: e?.message?.slice(0, 500),
          }).catch(() => {});
        }

        const updatedChapters = [...project.chapters];
        updatedChapters[chapterIdx] = { ...ch, content: fullText, summary };
        await updateProjectData(projectId, userId, { ...project, chapters: updatedChapters });

        send({
          type: "done",
          text: fullText,
          summary,
          usage: { ...bodyUsage, costKRW },
          summaryCostKRW,
          newBalance: summaryNewBalance,
        });
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "X-Accel-Buffering": "no",
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    console.error("[/api/generate/chapter-continue] uncaught:", e);
    return NextResponse.json({
      error: "INTERNAL_ERROR",
      message: e?.message || String(e),
    }, { status: 500 });
  }
}
