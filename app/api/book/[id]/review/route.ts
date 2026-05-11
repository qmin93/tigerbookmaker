// /api/book/[id]/review
// POST — 후기 제출 (public, no auth). status='pending'으로 시작.
// GET  — 승인된 후기 목록 (public).

import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { createHash } from "node:crypto";
import { rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function clientIpHash(req: Request): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(ip + (process.env.AUTH_SECRET ?? "salt")).digest("hex").slice(0, 32);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!params.id || !UUID_RE.test(params.id)) {
    return NextResponse.json({ error: "INVALID_BOOK_ID" }, { status: 400 });
  }

  // 책 공개 여부 확인
  const { rows } = await sql<{ data: any }>`SELECT data FROM book_projects WHERE id = ${params.id}`;
  const book = rows[0];
  if (!book) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (book.data?.shareEnabled !== true) {
    return NextResponse.json({ error: "NOT_SHARED" }, { status: 403 });
  }

  const ipHash = clientIpHash(req);
  // 어뷰즈: 동일 IP는 책당 1일 5개까지만
  const rl = rateLimit(`review:${params.id}:${ipHash}`, 5, 24 * 60 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const readerName = String((body as any)?.readerName ?? "").trim().slice(0, 50);
  const readerEmail = String((body as any)?.readerEmail ?? "").trim().slice(0, 255) || null;
  const rating = Number((body as any)?.rating);
  const comment = String((body as any)?.comment ?? "").trim();

  if (!readerName || readerName.length < 1) return NextResponse.json({ error: "INVALID_NAME", message: "이름을 입력해주세요" }, { status: 400 });
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) return NextResponse.json({ error: "INVALID_RATING", message: "별점은 1~5" }, { status: 400 });
  if (comment.length < 10) return NextResponse.json({ error: "COMMENT_TOO_SHORT", message: "후기는 10자 이상" }, { status: 400 });
  if (comment.length > 2000) return NextResponse.json({ error: "COMMENT_TOO_LONG", message: "후기는 2000자 이내" }, { status: 400 });

  await sql`
    INSERT INTO book_reviews (book_id, reader_name, reader_email, rating, comment, ip_hash, status)
    VALUES (${params.id}, ${readerName}, ${readerEmail}, ${Math.floor(rating)}, ${comment}, ${ipHash}, 'pending')
  `;

  return NextResponse.json({
    ok: true,
    message: "후기가 등록되었습니다. 작가 승인 후 페이지에 표시됩니다.",
  });
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!params.id || !UUID_RE.test(params.id)) {
    return NextResponse.json({ error: "INVALID_BOOK_ID" }, { status: 400 });
  }

  const { rows } = await sql<{
    id: string; reader_name: string; rating: number; comment: string; created_at: string;
  }>`
    SELECT id, reader_name, rating, comment, created_at
    FROM book_reviews
    WHERE book_id = ${params.id} AND status = 'approved'
    ORDER BY created_at DESC
    LIMIT 50
  `;

  // 평균 평점 + 분포
  const { rows: stats } = await sql<{ avg_rating: string; count: string }>`
    SELECT
      COALESCE(ROUND(AVG(rating)::numeric, 1), 0)::text AS avg_rating,
      COUNT(*)::text AS count
    FROM book_reviews
    WHERE book_id = ${params.id} AND status = 'approved'
  `;

  return NextResponse.json({
    reviews: rows.map(r => ({
      id: r.id,
      readerName: r.reader_name,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.created_at,
    })),
    averageRating: Number(stats[0]?.avg_rating ?? 0),
    totalCount: Number(stats[0]?.count ?? 0),
  });
}
