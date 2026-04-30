// POST /api/generate/chapter
// 챕터 1개 본문 생성 — 견적 → 잔액 체크 → AI 호출 (streaming) → 요약 → 차감 → 로그
// 응답: NDJSON ReadableStream — {type:"chunk",text:...} | {type:"done",...} | {type:"error",message}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { estimateCost } from "@/lib/cost-estimate";
import { callAIServer, callAIServerWithFallback, callStreamWithFallback, type AIModel } from "@/lib/server/ai-server";
void callAIServer;
import { getModelChain, type Tier } from "@/lib/tiers";
import {
  getUser, getProject, updateProjectData,
  deductBalance, logAIUsage, USD_TO_KRW,
} from "@/lib/server/db";
import { SYSTEM_WRITER, chapterPrompt, summaryPrompt } from "@/lib/prompts";
import { rateLimit } from "@/lib/server/rate-limit";
import { ragSearch, hasReferences } from "@/lib/server/rag";

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
    const { projectId, chapterIdx, model: explicitModel } = body;
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

    // tier 기반 모델 chain (사용자가 명시 model 보냈으면 그것만 사용)
    const tier: Tier = (project as any).tier ?? "basic";
    let candidates: AIModel[];
    if (explicitModel) {
      candidates = [explicitModel as AIModel];
    } else {
      candidates = getModelChain(tier);
      if (candidates.length === 0) {
        return NextResponse.json({
          error: "TIER_UNAVAILABLE",
          message: `${tier} 티어 사용 가능한 모델이 없습니다. 관리자에게 문의하세요.`,
        }, { status: 503 });
      }
    }
    const model: AIModel = candidates[0]; // 견적용 (실제 호출은 chain 전체)

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

    // 4.5. RAG 자동 주입 — references 있으면 챕터 제목 기반으로 관련 청크 검색
    // (ReadableStream 밖에서 실행해 controller 에러를 회피, 결과는 closure로 전달)
    let chapterChunks: Awaited<ReturnType<typeof ragSearch>> = [];
    try {
      if (await hasReferences(projectId)) {
        chapterChunks = await ragSearch({
          projectId,
          query: `${ch.title}${ch.subtitle ? " — " + ch.subtitle : ""}`,
          topN: 4,
          maxDistance: 0.7,
        });
      }
    } catch (e: any) {
      console.warn("[chapter] RAG search failed:", e?.message);
    }

    // 5. AI 호출 (streaming) + 6. 차감 + 7. 요약 — 모두 ReadableStream 안에서
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: any) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        let fullText = "";
        let bodyUsage: any = null;
        let actualModel: AIModel = candidates[0];
        try {
          const gen = callStreamWithFallback({
            candidates,
            system: SYSTEM_WRITER,
            user: chapterPrompt(project, chapterIdx, ch.title, ch.subtitle, chapterChunks),
            timeoutMs: 55000,
          });
          for await (const evt of gen) {
            if (evt.model) actualModel = evt.model;
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
            userId, task: "chapter", model: actualModel,
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
            reason: `${chapterIdx + 1}장 집필 (${actualModel})`,
          });
          newBalance = r.newBalance;
        }

        // 7. 요약 (동기, 실패해도 본문엔 영향 X) — fallback chain 적용
        // Gemini Flash → Flash Lite → 2.5 Flash Lite 순차 시도. 한 vendor 다운되어도 다음 시도.
        // 본문이 너무 길면 (8000자 초과) 앞 6000자만 prompt에 — token·timeout 안전 마진.
        let summary = "";
        let summaryCostKRW = 0;
        let summaryNewBalance = newBalance;
        const summaryCandidates: AIModel[] = [
          "gemini-flash-latest",
          "gemini-flash-lite-latest",
          "gemini-2.5-flash-lite",
        ];
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
            projectId, chapterIdx,
            status: "success",
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
