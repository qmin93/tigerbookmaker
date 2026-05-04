// GET /api/analytics/timeseries?days=30
// 본인 모든 책 + 프로필의 일별 방문수 합계 (최근 N일, KST 기준).
// 응답: { ok, data: [{ date: "2026-04-15", bookViews: 12, profileViews: 3 }, ...], days }

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const userId = session.user.id;

  const url = new URL(req.url);
  const daysRaw = Number(url.searchParams.get("days") ?? 30);
  const days = Math.max(7, Math.min(90, Number.isFinite(daysRaw) ? daysRaw : 30));

  // 본인 프로필 handle
  const { rows: profileRows } = await sql<{ handle: string }>`
    SELECT handle FROM user_profiles WHERE user_id = ${userId}
  `;
  const handle = profileRows[0]?.handle;

  // 책 방문 일별 집계 (KST) — book_projects JOIN 으로 본인 책만 필터.
  // page_views.page_id (TEXT) ↔ book_projects.id (UUID) 캐스팅.
  const bookViewsByDay: Record<string, number> = {};
  {
    const { rows } = await sql<{ d: string; cnt: number }>`
      SELECT to_char(pv.visited_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS d,
             COUNT(*)::int AS cnt
      FROM page_views pv
      INNER JOIN book_projects bp ON bp.id::text = pv.page_id
      WHERE pv.page_type = 'book'
        AND bp.user_id = ${userId}
        AND pv.visited_at > NOW() - (${days}::int * INTERVAL '1 day')
      GROUP BY d
      ORDER BY d
    `;
    for (const r of rows) bookViewsByDay[r.d] = r.cnt;
  }

  // 프로필 방문 일별 (KST)
  const profileViewsByDay: Record<string, number> = {};
  if (handle) {
    const { rows } = await sql<{ d: string; cnt: number }>`
      SELECT to_char(visited_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS d,
             COUNT(*)::int AS cnt
      FROM page_views
      WHERE page_type = 'profile'
        AND page_id = ${handle}
        AND visited_at > NOW() - (${days}::int * INTERVAL '1 day')
      GROUP BY d
      ORDER BY d
    `;
    for (const r of rows) profileViewsByDay[r.d] = r.cnt;
  }

  // N일 일자 모두 채움 (0 포함, KST 날짜 기준)
  const data: Array<{ date: string; bookViews: number; profileViews: number }> = [];
  // KST = UTC+9. 현재 KST 자정을 기준으로 N일치 일자 생성.
  const nowMs = Date.now();
  const KST_OFFSET = 9 * 60 * 60 * 1000;
  const todayKstMs = Math.floor((nowMs + KST_OFFSET) / 86400000) * 86400000;
  for (let i = days - 1; i >= 0; i--) {
    const dayMs = todayKstMs - i * 86400000;
    const d = new Date(dayMs).toISOString().slice(0, 10);
    data.push({
      date: d,
      bookViews: bookViewsByDay[d] ?? 0,
      profileViews: profileViewsByDay[d] ?? 0,
    });
  }

  return NextResponse.json({ ok: true, data, days });
}
