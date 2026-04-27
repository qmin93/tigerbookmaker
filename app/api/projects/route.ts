// GET /api/projects — 내 책 목록
// POST /api/projects — 새 프로젝트 생성

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { rows } = await sql`
    SELECT id, topic, audience, type, target_pages, data, created_at, updated_at
    FROM book_projects
    WHERE user_id = ${session.user.id}
    ORDER BY updated_at DESC
  `;
  return NextResponse.json({
    projects: rows.map(r => ({
      id: r.id,
      topic: r.topic,
      audience: r.audience,
      type: r.type,
      targetPages: r.target_pages,
      chapterCount: r.data?.chapters?.length ?? 0,
      writtenCount: (r.data?.chapters ?? []).filter((c: any) => c.content).length,
      updatedAt: r.updated_at,
    })),
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { topic, audience, type, targetPages = 120 } = await req.json().catch(() => ({}));
  if (!topic || !audience || !type) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const data = { topic, audience, type, targetPages, chapters: [] };
  const { rows } = await sql<{ id: string }>`
    INSERT INTO book_projects (user_id, topic, audience, type, target_pages, data)
    VALUES (${session.user.id}, ${topic}, ${audience}, ${type}, ${targetPages}, ${JSON.stringify(data)})
    RETURNING id
  `;
  return NextResponse.json({ id: rows[0].id });
}
