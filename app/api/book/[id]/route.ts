// GET /api/book/[id] — 공개 마케팅 데이터 (public, no auth)
// shareEnabled가 true인 책만 응답. /book/[id] 마케팅 페이지용.
// 챕터 본문(content)은 제외 — /share/[id]에서만 읽기 제공.

import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { rows } = await sql`
    SELECT id, topic, audience, type, data, created_at
    FROM book_projects WHERE id = ${params.id}
  `;
  const p = rows[0];
  if (!p) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  if (p.data?.shareEnabled !== true) {
    return NextResponse.json({ error: "PRIVATE", message: "비공개 책입니다." }, { status: 403 });
  }

  // 챕터: 제목·소제목만 (content 제외 — 마케팅 페이지는 읽기 X)
  const chapters = (p.data?.chapters ?? []).map((c: any) => ({
    id: c.id,
    title: c.title,
    subtitle: c.subtitle,
  }));

  // 표지: base64만 (메타 제외)
  const coverImg = p.data?.kmongPackage?.images?.find((i: any) => i.type === "cover");
  const cover = coverImg ? { base64: coverImg.base64 } : null;

  return NextResponse.json({
    id: p.id,
    topic: p.topic,
    audience: p.audience,
    type: p.type,
    cover,
    chapters,
    themeColor: p.data?.themeColor ?? "orange",
    marketingMeta: p.data?.marketingMeta ?? null,
    kmongCopy: p.data?.kmongPackage?.copy ?? null,
    createdAt: p.created_at,
  });
}
