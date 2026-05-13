// GET /api/analytics/active-users
// /write 흐름 v3 Phase 4.1 — 라이브 카운터 데이터 소스.
// 베타 단계 빈약한 노출을 피하기 위해 "지난 24시간" 활성 사용자를 집계한다 (spec 3.8 + 6.리스크).
//
// 응답 (PII 없음 — 단순 카운트만):
//   activeNow        — 지난 24시간 ai_usage 발생 distinct user 수
//   booksInProgress  — 지난 24시간 업데이트된 book_projects 중 모든 챕터가 완성되지 않은 권 수
//   booksCompleted   — 지난 7일 내 마지막 업데이트된 book_projects 중 모든 챕터에 content 가 있는 권 수
//
// 캐시: revalidate 60s + Cache-Control s-maxage=60. 빈도 높은 polling 으로부터 DB 보호.

import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";
export const revalidate = 60;

export async function GET() {
  // 각 쿼리는 독립 try/catch — 한 쿼리 실패가 다른 카운터까지 0으로 만들지 않게.
  // 최종 fallback 은 0. 빈약 노출 방지는 클라이언트 LiveCounter 에서 처리 (전부 0이면 hide).

  let activeNow = 0;
  try {
    const { rows } = await sql<{ c: string }>`
      SELECT COUNT(DISTINCT user_id)::text AS c
      FROM ai_usage
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `;
    activeNow = Number(rows[0]?.c ?? 0);
  } catch {
    activeNow = 0;
  }

  // 진행 중: 지난 24시간 업데이트된 프로젝트 중, chapters 배열에 content 가 비어있는 항목이 1개 이상.
  // jsonb 사용 — data->'chapters' 가 array. content 가 NULL/빈 문자열이면 미완성으로 간주.
  let booksInProgress = 0;
  try {
    const { rows } = await sql<{ c: string }>`
      SELECT COUNT(*)::text AS c
      FROM book_projects
      WHERE updated_at > NOW() - INTERVAL '24 hours'
        AND (
          jsonb_typeof(data->'chapters') IS DISTINCT FROM 'array'
          OR jsonb_array_length(data->'chapters') = 0
          OR EXISTS (
            SELECT 1
            FROM jsonb_array_elements(data->'chapters') AS ch
            WHERE COALESCE(ch->>'content', '') = ''
          )
        )
    `;
    booksInProgress = Number(rows[0]?.c ?? 0);
  } catch {
    booksInProgress = 0;
  }

  // 완성: 지난 7일 내 업데이트된 프로젝트 중, chapters 배열이 비어있지 않고 모든 항목에 content 가 있는 것.
  let booksCompleted = 0;
  try {
    const { rows } = await sql<{ c: string }>`
      SELECT COUNT(*)::text AS c
      FROM book_projects
      WHERE updated_at > NOW() - INTERVAL '7 days'
        AND jsonb_typeof(data->'chapters') = 'array'
        AND jsonb_array_length(data->'chapters') > 0
        AND NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements(data->'chapters') AS ch
          WHERE COALESCE(ch->>'content', '') = ''
        )
    `;
    booksCompleted = Number(rows[0]?.c ?? 0);
  } catch {
    booksCompleted = 0;
  }

  return NextResponse.json(
    { activeNow, booksInProgress, booksCompleted },
    {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=120",
      },
    },
  );
}
