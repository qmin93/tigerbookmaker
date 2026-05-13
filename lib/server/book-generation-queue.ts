// lib/server/book-generation-queue.ts
// v3 Phase 1.3 — 백그라운드 본문 생성 큐 helper.
//
// 사용자가 /write에서 본문 일괄 생성을 "백그라운드"로 시작하면 이 모듈로 enqueue.
// /api/cron/book-generation-worker 가 매분 1회 polling 하며 SKIP LOCKED로 큐 항목을 claim.

import "server-only";
import { sql } from "@vercel/postgres";

export type BookGenerationJobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export interface BookGenerationJob {
  id: string;
  project_id: string;
  user_id: string;
  status: BookGenerationJobStatus;
  current_chapter_idx: number;
  total_chapters: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

// 사용자당 최대 1개의 활성 작업 (queued OR processing)
export class ActiveJobExistsError extends Error {
  jobId: string;
  status: BookGenerationJobStatus;
  constructor(jobId: string, status: BookGenerationJobStatus) {
    super(`User already has an active generation job (${status})`);
    this.name = "ActiveJobExistsError";
    this.jobId = jobId;
    this.status = status;
  }
}

/**
 * 새 작업을 큐에 등록.
 *
 * - 이미 queued/processing 작업이 있으면 ActiveJobExistsError 던짐 (사용자당 1건 제한).
 * - 같은 프로젝트의 completed/failed/cancelled 작업은 재시도 가능 (block X).
 */
export async function enqueueBookGeneration(opts: {
  projectId: string;
  userId: string;
  totalChapters: number;
}): Promise<{ jobId: string }> {
  const { projectId, userId, totalChapters } = opts;
  if (!Number.isFinite(totalChapters) || totalChapters <= 0) {
    throw new Error("totalChapters must be a positive integer");
  }

  // 동일 사용자에 활성 job 있나 검사
  const { rows: existing } = await sql<{ id: string; status: BookGenerationJobStatus }>`
    SELECT id, status FROM book_generation_jobs
    WHERE user_id = ${userId} AND status IN ('queued', 'processing')
    ORDER BY created_at DESC
    LIMIT 1
  `;
  if (existing.length > 0) {
    throw new ActiveJobExistsError(existing[0].id, existing[0].status);
  }

  const { rows } = await sql<{ id: string }>`
    INSERT INTO book_generation_jobs (project_id, user_id, total_chapters, status, current_chapter_idx)
    VALUES (${projectId}, ${userId}, ${totalChapters}, 'queued', 0)
    RETURNING id
  `;
  return { jobId: rows[0].id };
}

/**
 * 사용자의 가장 최근 "비완료" 작업 (queued / processing / failed) 반환.
 * UI 폴링용 — 진행 중 또는 직전 실패 작업 노출.
 */
export async function getActiveJob(userId: string): Promise<BookGenerationJob | null> {
  const { rows } = await sql<BookGenerationJob>`
    SELECT id, project_id, user_id, status, current_chapter_idx, total_chapters,
           error_message, created_at, updated_at, completed_at
    FROM book_generation_jobs
    WHERE user_id = ${userId}
      AND status IN ('queued', 'processing', 'failed')
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

/**
 * 특정 프로젝트의 최신 작업 (활성 또는 직전 완료) — 상태 폴링 endpoint에서 사용.
 */
export async function getLatestJobForProject(
  projectId: string,
  userId: string,
): Promise<BookGenerationJob | null> {
  const { rows } = await sql<BookGenerationJob>`
    SELECT id, project_id, user_id, status, current_chapter_idx, total_chapters,
           error_message, created_at, updated_at, completed_at
    FROM book_generation_jobs
    WHERE project_id = ${projectId} AND user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

/**
 * 특정 프로젝트의 과거 작업 이력.
 */
export async function getJobHistoryForProject(
  projectId: string,
  userId: string,
  limit = 5,
): Promise<BookGenerationJob[]> {
  const { rows } = await sql<BookGenerationJob>`
    SELECT id, project_id, user_id, status, current_chapter_idx, total_chapters,
           error_message, created_at, updated_at, completed_at
    FROM book_generation_jobs
    WHERE project_id = ${projectId} AND user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows;
}

export async function getJobStatus(jobId: string): Promise<BookGenerationJob | null> {
  const { rows } = await sql<BookGenerationJob>`
    SELECT id, project_id, user_id, status, current_chapter_idx, total_chapters,
           error_message, created_at, updated_at, completed_at
    FROM book_generation_jobs
    WHERE id = ${jobId}
  `;
  return rows[0] ?? null;
}

/**
 * 워커: queued 작업 1건을 processing으로 atomically claim.
 * - FOR UPDATE SKIP LOCKED로 동시 워커 인스턴스의 더블 클레임 방지.
 * - 가장 오래된 queued 작업부터 처리 (FIFO).
 */
export async function claimNextQueuedJob(): Promise<BookGenerationJob | null> {
  // CTE + SKIP LOCKED를 한 SQL로 — atomic하게 SELECT lock + UPDATE.
  const { rows } = await sql<BookGenerationJob>`
    WITH next_job AS (
      SELECT id FROM book_generation_jobs
      WHERE status = 'queued'
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE book_generation_jobs j
    SET status = 'processing', updated_at = NOW()
    FROM next_job
    WHERE j.id = next_job.id
    RETURNING j.id, j.project_id, j.user_id, j.status, j.current_chapter_idx,
              j.total_chapters, j.error_message, j.created_at, j.updated_at, j.completed_at
  `;
  return rows[0] ?? null;
}

/**
 * 작업 진행 상태 업데이트. 완료/실패/취소 시 completed_at도 세팅.
 */
export async function advanceJob(
  jobId: string,
  patch: {
    currentChapterIdx?: number;
    status?: BookGenerationJobStatus;
    errorMessage?: string | null;
  },
): Promise<void> {
  const setCompleted =
    patch.status === "completed" ||
    patch.status === "failed" ||
    patch.status === "cancelled";

  if (patch.currentChapterIdx !== undefined && patch.status !== undefined) {
    if (setCompleted) {
      await sql`
        UPDATE book_generation_jobs
        SET current_chapter_idx = ${patch.currentChapterIdx},
            status = ${patch.status},
            error_message = ${patch.errorMessage ?? null},
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = ${jobId}
      `;
    } else {
      await sql`
        UPDATE book_generation_jobs
        SET current_chapter_idx = ${patch.currentChapterIdx},
            status = ${patch.status},
            error_message = ${patch.errorMessage ?? null},
            updated_at = NOW()
        WHERE id = ${jobId}
      `;
    }
  } else if (patch.currentChapterIdx !== undefined) {
    await sql`
      UPDATE book_generation_jobs
      SET current_chapter_idx = ${patch.currentChapterIdx}, updated_at = NOW()
      WHERE id = ${jobId}
    `;
  } else if (patch.status !== undefined) {
    if (setCompleted) {
      await sql`
        UPDATE book_generation_jobs
        SET status = ${patch.status},
            error_message = ${patch.errorMessage ?? null},
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = ${jobId}
      `;
    } else {
      await sql`
        UPDATE book_generation_jobs
        SET status = ${patch.status},
            error_message = ${patch.errorMessage ?? null},
            updated_at = NOW()
        WHERE id = ${jobId}
      `;
    }
  }
}

/**
 * 사용자 요청으로 작업 취소. queued 또는 processing 상태만 취소 가능.
 */
export async function cancelJob(jobId: string, userId: string): Promise<boolean> {
  const { rowCount } = await sql`
    UPDATE book_generation_jobs
    SET status = 'cancelled', completed_at = NOW(), updated_at = NOW()
    WHERE id = ${jobId}
      AND user_id = ${userId}
      AND status IN ('queued', 'processing')
  `;
  return (rowCount ?? 0) > 0;
}
