// PATCH /api/chapter/[idx]/content
// 챕터 1개의 content·title·subtitle만 업데이트.
// 전체 chapters 배열을 PUT하면 base64 이미지 때문에 4.5MB Vercel 한도 초과 (FUNCTION_PAYLOAD_TOO_LARGE).
// 본문 수정 흐름(AI 수정 적용·직접 편집 저장)은 이 라우트로.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_CONTENT_LENGTH = 80_000; // 챕터당 최대 8만 자 (안전 마진)
const MAX_TITLE_LENGTH = 200;

export async function PATCH(req: Request, { params }: { params: { idx: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const userId = session.user.id;

  const idx = Number(params.idx);
  if (!Number.isInteger(idx) || idx < 0 || idx > 99) {
    return NextResponse.json({ error: "INVALID_INDEX" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const { projectId, content, title, subtitle } = body ?? {};

  if (typeof projectId !== "string" || !projectId) {
    return NextResponse.json({ error: "INVALID_PROJECT_ID" }, { status: 400 });
  }
  if (content !== undefined && typeof content !== "string") {
    return NextResponse.json({ error: "INVALID_CONTENT" }, { status: 400 });
  }
  if (typeof content === "string" && content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json({ error: "CONTENT_TOO_LONG", message: `최대 ${MAX_CONTENT_LENGTH.toLocaleString()}자` }, { status: 413 });
  }
  if (title !== undefined && (typeof title !== "string" || title.length > MAX_TITLE_LENGTH)) {
    return NextResponse.json({ error: "INVALID_TITLE" }, { status: 400 });
  }
  if (subtitle !== undefined && (typeof subtitle !== "string" || subtitle.length > MAX_TITLE_LENGTH)) {
    return NextResponse.json({ error: "INVALID_SUBTITLE" }, { status: 400 });
  }

  // 프로젝트 권한 검증 + 현재 data 로드
  const { rows } = await sql<{ data: any }>`
    SELECT data FROM book_projects WHERE id = ${projectId} AND user_id = ${userId}
  `;
  const project = rows[0]?.data;
  if (!project) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const chapters = Array.isArray(project.chapters) ? [...project.chapters] : [];
  if (idx >= chapters.length) {
    return NextResponse.json({ error: "CHAPTER_INDEX_OUT_OF_RANGE", message: `chapters length=${chapters.length}` }, { status: 400 });
  }

  // 기존 chapter 객체에서 변경 필드만 덮어씀 — images·기타 필드 보존
  const updated = { ...chapters[idx] };
  if (typeof content === "string") updated.content = content;
  if (typeof title === "string") updated.title = title;
  if (typeof subtitle === "string") updated.subtitle = subtitle;
  chapters[idx] = updated;

  const newData = { ...project, chapters };

  await sql`
    UPDATE book_projects SET data = ${JSON.stringify(newData)}, updated_at = NOW()
    WHERE id = ${projectId} AND user_id = ${userId}
  `;

  return NextResponse.json({ ok: true });
}
