// /api/projects/[id]
// GET    — 프로젝트 상세 (data 포함)
// PUT    — 프로젝트 데이터 업데이트 (chapters, etc.)
// DELETE — 프로젝트 삭제

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { rows } = await sql`
    SELECT id, topic, audience, type, target_pages, data, created_at, updated_at
    FROM book_projects
    WHERE id = ${params.id} AND user_id = ${session.user.id}
  `;
  const p = rows[0];
  if (!p) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({
    id: p.id,
    topic: p.topic,
    audience: p.audience,
    type: p.type,
    targetPages: p.target_pages,
    chapters: p.data?.chapters ?? [],
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = await req.json();
  // body.data 통째로 받음 (chapters, images, settings 모두)
  const { data } = body;
  if (!data) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const { rowCount } = await sql`
    UPDATE book_projects SET data = ${JSON.stringify(data)}, updated_at = NOW()
    WHERE id = ${params.id} AND user_id = ${session.user.id}
  `;
  if (rowCount === 0) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { rowCount } = await sql`
    DELETE FROM book_projects
    WHERE id = ${params.id} AND user_id = ${session.user.id}
  `;
  if (rowCount === 0) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
