// GET /api/projects/[id]/generation-status
// v3 Phase 1.3 — UI 폴링용. 백그라운드 본문 생성 작업의 현재 상태 + 과거 이력.
//
// 응답:
// {
//   active: { jobId, status, currentChapterIdx, totalChapters, etaMinutes, errorMessage, createdAt, updatedAt } | null,
//   history: [...past jobs, 최대 5건]
// }
//
// active = status가 queued/processing/failed 중 가장 최신 작업.
//   - failed도 active로 노출 (사용자가 재시도하거나 에러 메시지 볼 수 있게)
//   - completed/cancelled는 active X (history에만 포함).

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@vercel/postgres";
import {
  getLatestJobForProject,
  getJobHistoryForProject,
  type BookGenerationJob,
} from "@/lib/server/book-generation-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ETA_MINUTES_PER_CHAPTER = 2; // 챕터당 ~2분 (보수적 추정)

function formatJobForClient(j: BookGenerationJob, includeEta: boolean) {
  const remaining = Math.max(0, j.total_chapters - j.current_chapter_idx);
  return {
    jobId: j.id,
    status: j.status,
    currentChapterIdx: j.current_chapter_idx,
    totalChapters: j.total_chapters,
    etaMinutes: includeEta ? remaining * ETA_MINUTES_PER_CHAPTER : null,
    errorMessage: j.error_message,
    createdAt: j.created_at,
    updatedAt: j.updated_at,
    completedAt: j.completed_at,
  };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const userId = session.user.id;
  const projectId = params.id;

  // 1. owner check — 프로젝트가 사용자 소유인지 확인
  const { rows: ownership } = await sql<{ id: string }>`
    SELECT id FROM book_projects WHERE id = ${projectId} AND user_id = ${userId}
  `;
  if (ownership.length === 0) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  // 2. 최신 작업 + 이력 fetch
  const latest = await getLatestJobForProject(projectId, userId);
  const history = await getJobHistoryForProject(projectId, userId, 5);

  // active = queued/processing/failed 만. completed/cancelled는 active 아님.
  const active =
    latest && ["queued", "processing", "failed"].includes(latest.status)
      ? formatJobForClient(latest, true)
      : null;

  return NextResponse.json({
    active,
    history: history.map((j) => formatJobForClient(j, false)),
  }, { headers: { "Cache-Control": "no-store" } });
}
