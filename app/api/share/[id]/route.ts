// GET /api/share/[id] — 공유 책 데이터 (public, no auth)
// shareEnabled가 true인 책만 응답. 다른 사용자 책도 봄 가능.

import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { rows } = await sql`
    SELECT id, topic, audience, type, target_pages, data, created_at, updated_at
    FROM book_projects WHERE id = ${params.id}
  `;
  const p = rows[0];
  if (!p) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  if (p.data?.shareEnabled !== true) {
    return NextResponse.json({ error: "NOT_SHARED", message: "비공개 책입니다." }, { status: 403 });
  }

  // public 응답 — kmongPackage.copy / interview / tier 등 민감 정보는 제외
  return NextResponse.json({
    id: p.id,
    topic: p.topic,
    audience: p.audience,
    type: p.type,
    targetPages: p.target_pages,
    chapters: p.data?.chapters ?? [],
    cover: p.data?.kmongPackage?.images?.find((i: any) => i.type === "cover") ?? null,
    shareLinks: p.data?.shareLinks ?? {},
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  });
}
