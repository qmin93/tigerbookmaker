// GET /api/reference/[id]/chunks
// 응답: { ok, chunks: [{ id, idx, content }] }
// auth + ownership 확인 후 해당 reference의 모든 chunk 반환

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  // ownership 검증 — book_references.user_id 일치 여부
  const { rows: refRows } = await sql`
    SELECT id FROM book_references
    WHERE id = ${params.id} AND user_id = ${session.user.id}
  `;
  if (refRows.length === 0) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const { rows } = await sql`
    SELECT id, chunk_idx, content
    FROM reference_chunks
    WHERE reference_id = ${params.id}
    ORDER BY chunk_idx ASC
  `;

  return NextResponse.json({
    ok: true,
    chunks: rows.map(r => ({
      id: r.id,
      idx: r.chunk_idx,
      content: r.content,
    })),
  });
}
