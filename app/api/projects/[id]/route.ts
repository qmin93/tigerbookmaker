// /api/projects/[id]
// GET    — 프로젝트 상세 (data 포함)
// PUT    — 프로젝트 데이터 업데이트 (chapters, etc.)
// PATCH  — 부분 업데이트 (현재: themeColor만)
// DELETE — 프로젝트 삭제

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@vercel/postgres";
import { getProject, updateProjectData } from "@/lib/server/db";

export const runtime = "nodejs";

const VALID_THEME_COLORS = ["orange", "blue", "green", "purple", "red", "gray"] as const;
type ThemeColorKey = typeof VALID_THEME_COLORS[number];

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
    kmongPackage: p.data?.kmongPackage,
    interview: p.data?.interview,
    tier: p.data?.tier,
    shareEnabled: p.data?.shareEnabled === true,
    shareLinks: p.data?.shareLinks,
    noImages: p.data?.noImages === true,
    themeColor: p.data?.themeColor ?? "orange",
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { themeColor } = body ?? {};

  // 현재는 themeColor만 허용
  if (typeof themeColor !== "string" || !(VALID_THEME_COLORS as readonly string[]).includes(themeColor)) {
    return NextResponse.json({ error: "INVALID_INPUT", message: "themeColor must be one of: " + VALID_THEME_COLORS.join(", ") }, { status: 400 });
  }

  const project = await getProject(params.id, session.user.id);
  if (!project) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const merged = { ...(project.data ?? {}), themeColor: themeColor as ThemeColorKey };
  await updateProjectData(params.id, session.user.id, merged);
  return NextResponse.json({ ok: true, themeColor });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = await req.json();
  // body.data 통째로 받음 (chapters, images, settings 모두)
  const { data } = body;
  if (!data) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  // 기존 data와 spread merge — 클라이언트가 부분 update해도 나머지 필드 보존.
  // (favorite/archived 토글, chapters만 저장, kmongPackage 단독 update 모두 안전)
  const { rows: existing } = await sql<{ data: any }>`
    SELECT data FROM book_projects WHERE id = ${params.id} AND user_id = ${session.user.id}
  `;
  const existingData = existing[0]?.data ?? {};
  const merged = { ...existingData, ...data };

  const { rowCount } = await sql`
    UPDATE book_projects SET data = ${JSON.stringify(merged)}, updated_at = NOW()
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
