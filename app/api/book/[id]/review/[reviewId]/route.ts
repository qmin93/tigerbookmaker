// PATCH /api/book/[id]/review/[reviewId] — 작가가 후기 승인/거절 (auth = 책 owner)
// body: { status: "approved" | "rejected" | "spam" }

import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { auth } from "@/auth";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_STATUSES = new Set(["approved", "rejected", "spam"]);

export async function PATCH(req: Request, { params }: { params: { id: string; reviewId: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  if (!UUID_RE.test(params.id) || !UUID_RE.test(params.reviewId)) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  // 책 소유 확인
  const { rows: bookRows } = await sql<{ user_id: string }>`
    SELECT user_id FROM book_projects WHERE id = ${params.id}
  `;
  if (!bookRows[0]) return NextResponse.json({ error: "BOOK_NOT_FOUND" }, { status: 404 });
  if (bookRows[0].user_id !== session.user.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const newStatus = String((body as any)?.status ?? "");
  if (!VALID_STATUSES.has(newStatus)) {
    return NextResponse.json({ error: "INVALID_STATUS" }, { status: 400 });
  }

  const { rowCount } = await sql`
    UPDATE book_reviews
    SET status = ${newStatus}, updated_at = NOW()
    WHERE id = ${params.reviewId} AND book_id = ${params.id}
  `;
  if (rowCount === 0) return NextResponse.json({ error: "REVIEW_NOT_FOUND" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
