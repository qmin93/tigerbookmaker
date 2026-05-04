// GET /api/series/[id] — 특정 seriesId에 속한 본인 책 목록
// (id 파라미터는 seriesId — UUID/임의 문자열)

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const seriesId = params.id;
  if (!seriesId || seriesId.length > 200) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const { rows } = await sql<{
    id: string;
    topic: string;
    audience: string;
    type: string;
    data: any;
    updated_at: string;
  }>`
    SELECT id, topic, audience, type, data, updated_at
    FROM book_projects
    WHERE user_id = ${session.user.id}
      AND data->'seriesMembership'->>'seriesId' = ${seriesId}
    ORDER BY updated_at DESC
  `;

  if (rows.length === 0) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const books = rows.map(r => {
    const m = r.data?.seriesMembership ?? {};
    const coverImg = r.data?.kmongPackage?.images?.find((i: any) => i.type === "cover");
    return {
      id: r.id,
      topic: r.topic,
      audience: r.audience,
      type: r.type,
      orderInSeries: Number(m.orderInSeries) || 1,
      themeColor: r.data?.themeColor,
      coverBase64: coverImg ? coverImg.base64 : null,
      shareEnabled: r.data?.shareEnabled === true,
      updatedAt: r.updated_at,
    };
  });
  books.sort((a, b) => a.orderInSeries - b.orderInSeries);

  const first = books[0];
  const seriesTitle = rows[0]?.data?.seriesMembership?.seriesTitle || "(제목 없음)";

  return NextResponse.json({
    seriesId,
    seriesTitle,
    bookCount: books.length,
    firstBookId: first?.id,
    books,
  });
}
