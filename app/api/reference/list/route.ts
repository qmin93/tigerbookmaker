import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const { rows } = await sql`
    SELECT id, filename, source_type, source_url, total_chars, chunk_count, uploaded_at
    FROM book_references
    WHERE project_id = ${projectId} AND user_id = ${session.user.id}
    ORDER BY uploaded_at DESC
  `;

  return NextResponse.json({
    references: rows.map(r => ({
      id: r.id,
      filename: r.filename,
      sourceType: r.source_type,
      sourceUrl: r.source_url,
      totalChars: r.total_chars,
      chunkCount: r.chunk_count,
      uploadedAt: r.uploaded_at,
    })),
  });
}
