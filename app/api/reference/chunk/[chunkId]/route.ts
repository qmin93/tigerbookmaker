// DELETE /api/reference/chunk/[chunkId]
// 단일 chunk 삭제 (book_references row는 유지)
// auth + ownership 확인 후 reference_chunks.id 단건 DELETE

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";

export async function DELETE(_req: Request, { params }: { params: { chunkId: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  // chunk → reference → user_id 검증 (JOIN)
  const { rows: ownerRows } = await sql`
    SELECT c.id, c.reference_id
    FROM reference_chunks c
    JOIN book_references r ON r.id = c.reference_id
    WHERE c.id = ${params.chunkId} AND r.user_id = ${session.user.id}
  `;
  if (ownerRows.length === 0) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const referenceId = ownerRows[0].reference_id;

  // chunk 삭제
  await sql`DELETE FROM reference_chunks WHERE id = ${params.chunkId}`;

  // chunk_count 갱신 (잔여 chunk 수)
  const { rows: countRows } = await sql<{ count: string }>`
    SELECT COUNT(*)::text AS count FROM reference_chunks WHERE reference_id = ${referenceId}
  `;
  const newCount = Number(countRows[0]?.count ?? 0);

  await sql`
    UPDATE book_references
    SET chunk_count = ${newCount}
    WHERE id = ${referenceId}
  `;

  return NextResponse.json({ ok: true, referenceId, newChunkCount: newCount });
}
