// POST /api/generate/chapter
// 챕터 1개 본문 생성 — 견적 → 잔액 체크 → AI 호출 (streaming) → 요약 → 차감 → 로그
// 응답: NDJSON ReadableStream — {type:"chunk",text:...} | {type:"done",...} | {type:"error",message}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { estimateCost } from "@/lib/cost-estimate";
import { callAIServer, callGeminiStream, type AIModel } from "@/lib/server/ai-server";
import {
  getUser, getProject, updateProjectData,
  deductBalance, logAIUsage, USD_TO_KRW,
} from "@/lib/server/db";
import { SYSTEM_WRITER, chapterPrompt, summaryPrompt } from "@/lib/prompts";
import { rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel Hobby 한계 (Pro 업그레이드 시 300으로)

export async function POST(req: Request) {
  try {
    // 1. 인증
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const userId = session.user.id;

    // 1.5. Rate limit — 사용자당 분당 10회 (자동 일괄 집필 12장 + 여유)
    const rl = rateLimit(`gen:${userId}`, 10, 60_000);
    if (!rl.ok) {
      return NextResponse.json({
        error: "RATE_LIMITED",
        message: `요청이 너무 잦습니다. ${Math.ceil(rl.resetIn / 1000)}초 후 다시 시도하세요.`,
        resetIn: rl.resetIn,
      }, { status: 429 });
    }

    // 2. 입력 파싱
    const body = await req.json().catch(() => ({}));
    const { projectId, chapterIdx, model = "gemini-flash-latest" as AIModel } = body;
    if (!projectId || typeof chapterIdx !== "number") {
      return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    }

    // 3. 프로젝트 로드
    const projectRow = await getProject(projectId, userId);
    if (!projectRow) {
      return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    }
    const project = projectRow.data;
    const ch = project.chapters?.[chapterIdx];
    if (!ch) {
      return NextResponse.json({ error: "CHAPTER_NOT_FOUND" }, { status: 404 });
    }

    // 4. 견적 + 잔액 체크
    const estimate = estimateCost("chapter", project, model);
    const user = await getUser(userId);
    if (!user) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });

    if (user.balance_krw < estimate.minimumBalanceKRW) {
      return NextResponse.json({
        error: "INSUFFICIENT_BALANCE",
        message: `잔액이 부족합니다. ${estimate.minimumBalanceKRW.toLocaleString()}원 이상 충전 후 시도하세요.`,
        required: estimate.minimumBalanceKRW,
        current: user.balance_krw,
        shortfall: estimate.minimumBalanceKRW - user.balance_krw,
        estimate: estimate.breakdown,
      }, { status: 402 });
    }

    // 5. AI 호출 (streaming) + 6. 차감 + 7. 요약 — 모두 ReadableStream 안에서
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: any) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        let fullText = "";
        let bodyUsage: any = null;
        try {
          const gen = callGeminiStream({
            model,
            system: SYSTEM_WRITER,
            user: chapterPrompt(project, chapterIdx, ch.title, ch.subtitle),
            timeoutMs: 55000,
          });
          for await (const evt of gen) {
            if (evt.type === "chunk") {
              fullText += evt.text;
              send({ type: "chunk", text: evt.text });
            } else if (evt.type === "done") {
              bodyUsage = evt.usage;
            }
          }
        } catch (e: any) {
          // 본문 호출 실패 — failed 로그 + error chunk + close
          await logAIUsage({
            userId, task: "chapter", model,
            inputTokens: 0, outputTokens: 0, thoughtsTokens: 0,
            cacheReadTokens: 0, cacheWriteTokens: 0,
            costUSD: 0, costKRW: 0, durationMs: 0,
            projectId, chapterIdx,
            status: "failed", errorMessage: e?.message?.slice(0, 500),
          }).catch(() => {});
          send({ type: "error", message: e?.message || "AI 호출 실패" });
          controller.close();
          return;
        }

        if (!bodyUsage) {
          send({ type: "error", message: "Gemini stream이 usage 없이 끝남" });
          controller.close();
          return;
        }

        // 6. 비용 차감 + 로그
        const costKRW = Math.ceil(bodyUsage.costUSD * USD_TO_KRW);
        const { id: usageId } = await logAIUsage({
          userId, task: "chapter", model,
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
            reason: `${chapterIdx + 1}장 집필 (${model})`,
          });
          newBalance = r.newBalance;
        }

        // 7. 요약 (동기, 실패해도 본문엔 영향 X)
        let summary = "";
        let summaryCostKRW = 0;
        let summaryNewBalance = newBalance;
        try {
          const sumResult = await callAIServer({
            model: "gemini-flash-latest",
            system: "당신은 책 챕터를 200~300자로 압축하는 요약가입니다.",
            user: summaryPrompt(ch.title, fullText),
            maxTokens: 512,
            temperature: 0.3,
            timeoutMs: 25000,
            retries: 1,
          });
          summary = sumResult.text.trim();
          summaryCostKRW = Math.ceil(sumResult.usage.costUSD * USD_TO_KRW);
          const { id: sumUsageId } = await logAIUsage({
            userId, task: "summary", model: "gemini-flash-latest",
            inputTokens: sumResult.usage.inputTokens,
            outputTokens: sumResult.usage.outputTokens,
            thoughtsTokens: sumResult.usage.thoughtsTokens,
            cacheReadTokens: sumResult.usage.cacheReadTokens,
            cacheWriteTokens: sumResult.usage.cacheWriteTokens,
            costUSD: sumResult.usage.costUSD,
            costKRW: summaryCostKRW,
            durationMs: sumResult.usage.durationMs,
            projectId, chapterIdx,
            status: "success",
          });
          if (summaryCostKRW > 0) {
            const r = await deductBalance({
              userId, amountKRW: summaryCostKRW, aiUsageId: sumUsageId,
              reason: `${chapterIdx + 1}장 요약 (gemini-flash-latest)`,
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

        // 8. 프로젝트 업데이트
        const updatedChapters = [...project.chapters];
        updatedChapters[chapterIdx] = { ...ch, content: fullText, summary };
        await updateProjectData(projectId, userId, { ...project, chapters: updatedChapters });

        // 9. done 이벤트 (metadata)
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
    // 마지막 안전망 — try 밖 throw 되어 "An error occurred"가 사용자에게 가는 상황 방지
    console.error("[/api/generate/chapter] uncaught:", e);
    return NextResponse.json({
      error: "INTERNAL_ERROR",
      message: e?.message || String(e),
      stack: process.env.NODE_ENV === "production" ? undefined : e?.stack,
    }, { status: 500 });
  }
}
