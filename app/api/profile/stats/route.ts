// GET /api/profile/stats — 본인 종합 통계 (auth 필요).
// 응답: { bookCount, balanceKRW, totalCharged, totalSpent, totalPageViews, totalRevenueKRW }
// totalPageViews: 본인 모든 책의 page_views 합계.
// totalRevenueKRW: 본인 모든 책의 data.revenue.netTotalKRW 합계 (사용자 직접 입력 매출).

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const userId = session.user.id;

  // 책 수
  const { rows: bookRows } = await sql<{ c: string }>`
    SELECT COUNT(*)::text AS c FROM book_projects WHERE user_id = ${userId}
  `;
  const bookCount = Number(bookRows[0]?.c ?? 0);

  // 잔액 / 누적 충전 / 누적 사용
  const { rows: userRows } = await sql<{ balance_krw: number; total_charged: number; total_spent: number }>`
    SELECT balance_krw, total_charged, total_spent FROM users WHERE id = ${userId}
  `;
  const balanceKRW = Number(userRows[0]?.balance_krw ?? 0);
  const totalCharged = Number(userRows[0]?.total_charged ?? 0);
  const totalSpent = Number(userRows[0]?.total_spent ?? 0);

  // 본인 모든 책의 직접 입력 매출 합 (data->revenue->netTotalKRW)
  let totalRevenueKRW = 0;
  try {
    const { rows: revRows } = await sql<{ total_revenue: string }>`
      SELECT COALESCE(SUM((data->'revenue'->>'netTotalKRW')::bigint), 0)::text AS total_revenue
      FROM book_projects
      WHERE user_id = ${userId} AND data->'revenue' IS NOT NULL
    `;
    totalRevenueKRW = Number(revRows[0]?.total_revenue ?? 0);
  } catch {
    // ignore (revenue 미설정 책만 있을 때)
  }

  // 본인 모든 책 page_views 합 (page_views 테이블 미적용 시 0)
  let totalPageViews = 0;
  try {
    const { rows: pvRows } = await sql<{ c: string }>`
      SELECT COUNT(*)::text AS c
      FROM page_views pv
      WHERE pv.page_type = 'book'
        AND pv.page_id IN (
          SELECT id::text FROM book_projects WHERE user_id = ${userId}
        )
    `;
    totalPageViews = Number(pvRows[0]?.c ?? 0);
  } catch {
    // ignore
  }

  return NextResponse.json({
    bookCount,
    balanceKRW,
    totalCharged,
    totalSpent,
    totalPageViews,
    totalRevenueKRW,
  });
}
