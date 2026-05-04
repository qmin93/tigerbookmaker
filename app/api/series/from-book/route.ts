// POST /api/series/from-book — 기존 책에 시리즈 멤버십을 추가하거나 새 시리즈를 생성
// body: { sourceBookId: string, newSeriesTitle?: string, attachToSeriesId?: string }
//
// 동작:
//  - attachToSeriesId가 주어지면: 본인 소유 시리즈 확인 후 그 시리즈 다음 순서로 sourceBook 추가
//  - 그렇지 않고 newSeriesTitle만 주어지면: 새 seriesId 생성, sourceBook을 1번으로 설정
//  - sourceBook이 이미 시리즈 소속이면 그대로 유지하고 멤버십 정보 갱신

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@vercel/postgres";
import { getProject, updateProjectData } from "@/lib/server/db";
import { rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const userId = session.user.id;

  const rl = rateLimit(`series-from-book:${userId}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "RATE_LIMITED", resetIn: rl.resetIn }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const { sourceBookId, newSeriesTitle, attachToSeriesId } = body ?? {};

  if (!sourceBookId || typeof sourceBookId !== "string" || !UUID_RE.test(sourceBookId)) {
    return NextResponse.json({ error: "INVALID_INPUT", message: "sourceBookId 필요" }, { status: 400 });
  }

  const projectRow = await getProject(sourceBookId, userId);
  if (!projectRow) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  let seriesId: string;
  let seriesTitle: string;
  let orderInSeries: number;

  if (attachToSeriesId && typeof attachToSeriesId === "string") {
    // 기존 시리즈에 추가 — 본인 소유 시리즈인지 검증 + 순서 결정
    const { rows } = await sql<{ data: any }>`
      SELECT data FROM book_projects
      WHERE user_id = ${userId}
        AND data->'seriesMembership'->>'seriesId' = ${attachToSeriesId}
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: "SERIES_NOT_FOUND" }, { status: 404 });
    }
    seriesId = attachToSeriesId;
    seriesTitle = rows[0].data?.seriesMembership?.seriesTitle || "(제목 없음)";
    const maxOrder = rows.reduce((m, r) => {
      const o = Number(r.data?.seriesMembership?.orderInSeries) || 0;
      return o > m ? o : m;
    }, 0);
    // sourceBook이 이미 이 시리즈에 있으면 기존 순서 유지
    const existingMembership = (projectRow.data as any)?.seriesMembership;
    if (existingMembership?.seriesId === seriesId) {
      orderInSeries = Number(existingMembership.orderInSeries) || 1;
    } else {
      orderInSeries = maxOrder + 1;
    }
  } else {
    // 새 시리즈 생성
    const title = typeof newSeriesTitle === "string" ? newSeriesTitle.trim().slice(0, 100) : "";
    if (!title) {
      return NextResponse.json({ error: "INVALID_INPUT", message: "newSeriesTitle 또는 attachToSeriesId 필요" }, { status: 400 });
    }
    seriesId = crypto.randomUUID();
    seriesTitle = title;
    orderInSeries = 1;
  }

  const newData = {
    ...(projectRow.data ?? {}),
    seriesMembership: { seriesId, seriesTitle, orderInSeries },
  };
  await updateProjectData(sourceBookId, userId, newData);

  return NextResponse.json({
    ok: true,
    seriesId,
    seriesTitle,
    orderInSeries,
    sourceBookId,
  });
}
