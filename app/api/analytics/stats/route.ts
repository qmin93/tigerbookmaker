// GET /api/analytics/stats?pageType=book|profile&pageId=...
// 인증 + ownership 체크 (book id → user_id 일치 / profile handle → user_id 일치).
// 응답: { totalViews, last7days, last30days }

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@vercel/postgres";
import { getProfileByHandle } from "@/lib/server/profile";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const userId = session.user.id;

  const url = new URL(req.url);
  const pageType = url.searchParams.get("pageType") ?? "";
  const pageId = (url.searchParams.get("pageId") ?? "").slice(0, 200);

  if (pageType !== "book" && pageType !== "profile") {
    return NextResponse.json({ error: "INVALID_PAGE_TYPE" }, { status: 400 });
  }
  if (!pageId) {
    return NextResponse.json({ error: "INVALID_PAGE_ID" }, { status: 400 });
  }

  // ownership 체크
  if (pageType === "book") {
    const { rows } = await sql<{ user_id: string }>`
      SELECT user_id FROM book_projects WHERE id = ${pageId}
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    if (rows[0].user_id !== userId) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
  } else {
    const profile = await getProfileByHandle(pageId);
    if (!profile) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    if (profile.userId !== userId) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
  }

  const { rows } = await sql<{ total: string; last7: string; last30: string }>`
    SELECT
      COUNT(*)::text AS total,
      COUNT(*) FILTER (WHERE visited_at > NOW() - INTERVAL '7 days')::text AS last7,
      COUNT(*) FILTER (WHERE visited_at > NOW() - INTERVAL '30 days')::text AS last30
    FROM page_views
    WHERE page_type = ${pageType} AND page_id = ${pageId}
  `;
  const r = rows[0] ?? { total: "0", last7: "0", last30: "0" };
  return NextResponse.json({
    totalViews: Number(r.total),
    last7days: Number(r.last7),
    last30days: Number(r.last30),
  });
}
