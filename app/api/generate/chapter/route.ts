// POST /api/generate/chapter
// 챕터 1개 본문 생성 — 견적 → 잔액 체크 → AI 호출 (streaming) → 요약 → 차감 → 로그
// 응답: NDJSON ReadableStream — {type:"chunk",text:...} | {type:"done",...} | {type:"error",message}
//
// v3 Phase 1.3 (2026-05-13):
//  - 코어 로직을 lib/server/generate-chapter.ts로 추출 (worker와 공유).
//  - ?queue=true (또는 body.queue: true) — 큐 모드: 즉시 enqueue하고 jobId 반환.
//    동기 본문 생성 대신 백그라운드 워커가 처리. UI는 /api/projects/[id]/generation-status로 폴링.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/server/rate-limit";
import { logAIUsage, getProject } from "@/lib/server/db";
import {
  generateChapter,
  InsufficientBalanceError,
  ProjectNotFoundError,
  ChapterNotFoundError,
  FIXED_COST_PER_CHAPTER_KRW,
} from "@/lib/server/generate-chapter";
import {
  enqueueBookGeneration,
  ActiveJobExistsError,
} from "@/lib/server/book-generation-queue";
import { triggerBookGenerationWorker } from "@/lib/server/trigger-book-generation-worker";

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
    const url = new URL(req.url);
    const queueFromQuery = url.searchParams.get("queue") === "true";
    const body = await req.json().catch(() => ({}));
    const { projectId, chapterIdx, model: explicitModel, queue: queueFromBody } = body;
    const queueMode = queueFromQuery || queueFromBody === true;

    if (!projectId) {
      return NextResponse.json({ error: "INVALID_INPUT", message: "projectId required" }, { status: 400 });
    }

    // ─── Queue 모드: 백그라운드 작업으로 등록 ───
    if (queueMode) {
      // 큐 모드는 책 1권 전체 처리 — chapterIdx 무시. total_chapters는 프로젝트에서 읽음.
      const projectRow = await getProject(projectId, userId);
      if (!projectRow) {
        return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
      }
      const chapters: any[] = projectRow.data?.chapters ?? [];
      if (chapters.length === 0) {
        return NextResponse.json({
          error: "NO_CHAPTERS",
          message: "프로젝트에 챕터가 없습니다. 먼저 목차를 생성하세요.",
        }, { status: 400 });
      }
      try {
        const { jobId } = await enqueueBookGeneration({
          projectId,
          userId,
          totalChapters: chapters.length,
        });
        // 워커 즉시 self-trigger (cron 의존 제거). fire-and-forget — 응답을 막지 않음.
        triggerBookGenerationWorker();
        return NextResponse.json({
          ok: true,
          mode: "queue",
          jobId,
          totalChapters: chapters.length,
          message: "백그라운드 본문 생성 시작. 즉시 첫 챕터부터 처리됩니다.",
        });
      } catch (e: any) {
        if (e instanceof ActiveJobExistsError) {
          return NextResponse.json({
            error: "ACTIVE_JOB_EXISTS",
            message: "이미 진행 중인 본문 생성이 있습니다. 완료 후 다시 시도하세요.",
            jobId: e.jobId,
            jobStatus: e.status,
          }, { status: 409 });
        }
        throw e;
      }
    }

    // ─── 기존 동기 모드 (back-compat) ───
    if (typeof chapterIdx !== "number") {
      return NextResponse.json({ error: "INVALID_INPUT", message: "chapterIdx required" }, { status: 400 });
    }

    // 3. 사전 검증 — 프로젝트 & 챕터 존재 확인 (lib 안에서도 검증하지만,
    //    streaming 시작 전에 에러 응답 가능하도록 미리 한 번 더 체크)
    const projectRow = await getProject(projectId, userId);
    if (!projectRow) {
      return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    }
    if (!projectRow.data.chapters?.[chapterIdx]) {
      return NextResponse.json({ error: "CHAPTER_NOT_FOUND" }, { status: 404 });
    }

    // 4. AI 호출 (streaming) — ReadableStream 안에서 lib 호출
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: any) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

        try {
          const result = await generateChapter({
            projectId,
            userId,
            chapterIdx,
            explicitModel,
            onChunk: (text) => send({ type: "chunk", text }),
          });

          if (result.ragFailed && result.ragHadReferences) {
            send({
              type: "warning",
              code: "RAG_FAILED",
              message: "자료 검색이 실패해 일반 본문이 생성됐습니다. 잠시 후 다시 시도하면 자료가 반영됩니다.",
            });
          }

          send({
            type: "done",
            text: result.fullText,
            summary: result.summary,
            usage: { costKRW: result.costKRW },
            summaryCostKRW: 0,
            newBalance: result.newBalance,
          });
          controller.close();
        } catch (e: any) {
          if (e instanceof InsufficientBalanceError) {
            send({
              type: "error",
              code: "INSUFFICIENT_BALANCE",
              message: `잔액이 부족합니다. ${e.required.toLocaleString()}원 이상 충전 후 시도하세요.`,
              required: e.required,
              current: e.current,
              shortfall: e.required - e.current,
              estimate: `본문 1챕터 ₩${FIXED_COST_PER_CHAPTER_KRW.toLocaleString()}`,
            });
          } else if (e instanceof ProjectNotFoundError) {
            send({ type: "error", code: "PROJECT_NOT_FOUND", message: "프로젝트를 찾을 수 없습니다." });
          } else if (e instanceof ChapterNotFoundError) {
            send({ type: "error", code: "CHAPTER_NOT_FOUND", message: "챕터를 찾을 수 없습니다." });
          } else {
            send({ type: "error", message: e?.message ?? "AI 호출 실패" });
          }
          controller.close();
        }
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
    void logAIUsage; // tsc dead-code elim 방지 (logAIUsage는 lib generate-chapter 내부에서 호출됨)
    return NextResponse.json({
      error: "INTERNAL_ERROR",
      message: e?.message || String(e),
      stack: process.env.NODE_ENV === "production" ? undefined : e?.stack,
    }, { status: 500 });
  }
}
