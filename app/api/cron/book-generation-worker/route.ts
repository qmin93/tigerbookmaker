// GET /api/cron/book-generation-worker — Vercel Cron (매분 1회)
// v3 Phase 1.3 — 백그라운드 본문 생성 워커.
//
// 동작:
//  1. CRON_SECRET Bearer 검증
//  2. queued 작업 1건을 SKIP LOCKED로 claim (processing 전환)
//  3. 프로젝트 chapters를 current_chapter_idx 부터 순차 처리
//     - 각 챕터 ~30~60s 소요. 시간 budget(50s) 임박하면 다시 queued로 복귀 → 다음 cron tick에서 이어 처리
//     - 잔액 부족이면 failed로 마킹하고 종료
//  4. 모든 챕터 완료 시 status='completed'로 마킹
//  5. AI 호출 자체 실패 시 status='failed' + error_message

import { NextResponse } from "next/server";
import {
  claimNextQueuedJob,
  advanceJob,
  getJobStatus,
} from "@/lib/server/book-generation-queue";
import {
  generateChapter,
  getChapterProgress,
  InsufficientBalanceError,
  ProjectNotFoundError,
  ChapterNotFoundError,
} from "@/lib/server/generate-chapter";
import { sendBookCompletionEmail } from "@/lib/server/notify-book-completion";
import { triggerBookGenerationWorker } from "@/lib/server/trigger-book-generation-worker";

// fire-and-forget: 이메일 실패가 워커 응답을 막지 않게 await 없이 호출.
// 에러는 sendBookCompletionEmail 내부에서 catch + log됨.
function notifyCompletionFireAndForget(opts: {
  userId: string;
  projectId: string;
  status: "completed" | "failed";
  errorMessage?: string;
}) {
  void sendBookCompletionEmail(opts).catch((e) => {
    console.error("[book-generation-worker] notify failure swallowed:", e);
  });
}

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel Hobby 한계
export const dynamic = "force-dynamic";
export const revalidate = 0;

// 1 tick 안에서 챕터 처리에 쓸 수 있는 시간 (ms). 60s 한계에서 마지막 10s는 cleanup용.
const TICK_BUDGET_MS = 50_000;

export async function GET(req: Request) {
  // Vercel Cron 보안
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
  }

  const startedAt = Date.now();
  const elapsed = () => Date.now() - startedAt;

  // 1. queued job 1건 claim — SKIP LOCKED로 동시 워커 더블 클레임 방지
  const job = await claimNextQueuedJob();
  if (!job) {
    return NextResponse.json(
      { ok: true, idle: true, timestamp: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = {
    ok: true as boolean,
    jobId: job.id,
    projectId: job.project_id,
    startedIdx: job.current_chapter_idx,
    processedChapters: 0,
    finalStatus: "processing" as string,
    error: undefined as string | undefined,
  };

  try {
    // 2. 어디서부터 시작할지 — DB 진도 확인 (사용자가 일부 챕터 수동 생성했을 수도)
    const progress = await getChapterProgress(job.project_id, job.user_id);
    if (!progress) {
      await advanceJob(job.id, { status: "failed", errorMessage: "프로젝트를 찾을 수 없음" });
      notifyCompletionFireAndForget({
        userId: job.user_id,
        projectId: job.project_id,
        status: "failed",
        errorMessage: "프로젝트를 찾을 수 없음",
      });
      return NextResponse.json({ ...result, finalStatus: "failed", error: "PROJECT_NOT_FOUND" });
    }
    const { total, pendingIdxs } = progress;

    // 모두 이미 작성되어 있으면 즉시 completed
    if (pendingIdxs.length === 0) {
      await advanceJob(job.id, { status: "completed", currentChapterIdx: total });
      notifyCompletionFireAndForget({
        userId: job.user_id,
        projectId: job.project_id,
        status: "completed",
      });
      return NextResponse.json({ ...result, finalStatus: "completed", processedChapters: 0 });
    }

    // current_chapter_idx 이상의 pending만 처리 (재시작 시 이미 처리한 것 skip)
    const todoIdxs = pendingIdxs.filter((i) => i >= job.current_chapter_idx);
    const idxsToProcess = todoIdxs.length > 0 ? todoIdxs : pendingIdxs;

    // 3. 순차 처리
    for (const idx of idxsToProcess) {
      // 시간 budget 임박? — 다음 tick에서 이어처리
      if (elapsed() > TICK_BUDGET_MS) {
        await advanceJob(job.id, {
          currentChapterIdx: idx, // 다음 tick에서 여기부터
          status: "queued", // 다음 worker tick이 claim할 수 있도록
        });
        result.finalStatus = "queued_continue";
        triggerBookGenerationWorker(); // self-chain — 다음 tick 즉시 시작
        return NextResponse.json(result);
      }

      try {
        await generateChapter({
          projectId: job.project_id,
          userId: job.user_id,
          chapterIdx: idx,
          aiTimeoutMs: 45000, // 워커는 좀 더 보수적 (tick budget 안에 끝나야 함)
        });
        result.processedChapters++;
        // 진도 업데이트 — 다음 챕터로
        await advanceJob(job.id, { currentChapterIdx: idx + 1 });
      } catch (e: any) {
        if (e instanceof InsufficientBalanceError) {
          const errorMessage = `잔액 부족 (${e.required}원 필요, ${e.current}원 보유). ${idx + 1}장에서 중단.`;
          await advanceJob(job.id, {
            status: "failed",
            errorMessage,
          });
          notifyCompletionFireAndForget({
            userId: job.user_id,
            projectId: job.project_id,
            status: "failed",
            errorMessage,
          });
          return NextResponse.json({
            ...result,
            finalStatus: "failed",
            error: "INSUFFICIENT_BALANCE",
          });
        }
        if (e instanceof ProjectNotFoundError || e instanceof ChapterNotFoundError) {
          const errorMessage = `${idx + 1}장 처리 중 ${e.name}. 프로젝트가 삭제되었거나 변경됐습니다.`;
          await advanceJob(job.id, {
            status: "failed",
            errorMessage,
          });
          notifyCompletionFireAndForget({
            userId: job.user_id,
            projectId: job.project_id,
            status: "failed",
            errorMessage,
          });
          return NextResponse.json({ ...result, finalStatus: "failed", error: e.name });
        }
        // 기타 AI 실패 — 큐 자체는 fail 처리 (사용자가 UI에서 재시작 가능)
        const msg = (e?.message ?? String(e)).slice(0, 500);
        console.error("[book-generation-worker] chapter failed:", { jobId: job.id, idx, error: msg });
        const errorMessage = `${idx + 1}장 생성 실패: ${msg}`;
        await advanceJob(job.id, {
          status: "failed",
          errorMessage,
        });
        notifyCompletionFireAndForget({
          userId: job.user_id,
          projectId: job.project_id,
          status: "failed",
          errorMessage,
        });
        return NextResponse.json({ ...result, finalStatus: "failed", error: msg });
      }
    }

    // 4. 모두 처리 완료 — completed
    // 한 번 더 progress 확인 (worker 처리 중 사용자가 수동으로 일부 처리했을 수도)
    const finalProgress = await getChapterProgress(job.project_id, job.user_id);
    if (finalProgress && finalProgress.pendingIdxs.length === 0) {
      await advanceJob(job.id, { status: "completed", currentChapterIdx: finalProgress.total });
      result.finalStatus = "completed";
      notifyCompletionFireAndForget({
        userId: job.user_id,
        projectId: job.project_id,
        status: "completed",
      });
    } else {
      // 아직 pending 있으면 다음 tick으로
      await advanceJob(job.id, {
        status: "queued",
        currentChapterIdx: finalProgress?.pendingIdxs[0] ?? job.current_chapter_idx + result.processedChapters,
      });
      result.finalStatus = "queued_continue";
      triggerBookGenerationWorker(); // self-chain — 다음 tick 즉시 시작
    }
    return NextResponse.json(result);
  } catch (e: any) {
    const msg = (e?.message ?? String(e)).slice(0, 500);
    console.error("[book-generation-worker] uncaught:", e);
    // 작업이 아직 processing이면 failed로 mark — silently
    const current = await getJobStatus(job.id).catch(() => null);
    if (current && current.status === "processing") {
      await advanceJob(job.id, { status: "failed", errorMessage: msg }).catch(() => {});
      notifyCompletionFireAndForget({
        userId: job.user_id,
        projectId: job.project_id,
        status: "failed",
        errorMessage: msg,
      });
    }
    return NextResponse.json({
      ok: false,
      jobId: job.id,
      finalStatus: "failed",
      error: msg,
    }, { status: 500 });
  }
}
