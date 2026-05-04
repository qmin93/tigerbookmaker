// GET /api/series — 본인 시리즈 목록 (책들을 seriesId 기준 그룹화)
// 시리즈 멤버십은 book_projects.data.seriesMembership JSON에 저장됨 (별도 테이블 X).

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";

interface SeriesGroupBook {
  id: string;
  topic: string;
  audience: string;
  type: string;
  orderInSeries: number;
  themeColor?: string;
  coverBase64?: string | null;
  updatedAt: string;
}

interface SeriesGroup {
  seriesId: string;
  seriesTitle: string;
  bookCount: number;
  // 첫 책(orderInSeries 가장 작은 책)의 정보 — 새 시리즈 책 만들 때 참고용
  firstBookId: string;
  firstBookType: string;
  firstBookThemeColor?: string;
  books: SeriesGroupBook[];
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

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
      AND data ? 'seriesMembership'
    ORDER BY updated_at DESC
  `;

  // 그룹화: seriesId → SeriesGroup
  const groups = new Map<string, SeriesGroup>();
  for (const r of rows) {
    const m = r.data?.seriesMembership;
    if (!m?.seriesId) continue;

    const coverImg = r.data?.kmongPackage?.images?.find((i: any) => i.type === "cover");
    const book: SeriesGroupBook = {
      id: r.id,
      topic: r.topic,
      audience: r.audience,
      type: r.type,
      orderInSeries: Number(m.orderInSeries) || 1,
      themeColor: r.data?.themeColor,
      coverBase64: coverImg ? coverImg.base64 : null,
      updatedAt: r.updated_at,
    };

    const existing = groups.get(m.seriesId);
    if (existing) {
      existing.books.push(book);
      existing.bookCount = existing.books.length;
    } else {
      groups.set(m.seriesId, {
        seriesId: m.seriesId,
        seriesTitle: m.seriesTitle || "(제목 없음)",
        bookCount: 1,
        firstBookId: r.id,
        firstBookType: r.type,
        firstBookThemeColor: r.data?.themeColor,
        books: [book],
      });
    }
  }

  // 각 시리즈에서 정렬 + firstBook 갱신
  const series = Array.from(groups.values()).map(g => {
    g.books.sort((a, b) => a.orderInSeries - b.orderInSeries);
    const first = g.books[0];
    if (first) {
      g.firstBookId = first.id;
      g.firstBookType = first.type;
      g.firstBookThemeColor = first.themeColor;
    }
    return g;
  });

  // 최근 활동 순으로 정렬 (책 가장 최근 updatedAt 기준)
  series.sort((a, b) => {
    const aT = Math.max(...a.books.map(b => new Date(b.updatedAt).getTime()));
    const bT = Math.max(...b.books.map(b => new Date(b.updatedAt).getTime()));
    return bT - aT;
  });

  return NextResponse.json({ series });
}
