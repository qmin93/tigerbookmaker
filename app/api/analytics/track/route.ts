// POST /api/analytics/track
// body: { pageType: "book" | "profile", pageId: string, variantId?: "A" | "B" }
// IP+UA 해시로 24h 내 dedupe. 인증 불필요 (public visit 추적).
// Wave B5: variantId 지원 — A/B 테스트 활성된 책에서 어느 variant 방문했는지 기록.

import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import crypto from "crypto";

export const runtime = "nodejs";

function getIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    }
    const pageType = String(body.pageType ?? "");
    const pageId = String(body.pageId ?? "").slice(0, 200);
    if (pageType !== "book" && pageType !== "profile") {
      return NextResponse.json({ error: "INVALID_PAGE_TYPE" }, { status: 400 });
    }
    if (!pageId) {
      return NextResponse.json({ error: "INVALID_PAGE_ID" }, { status: 400 });
    }

    // Wave B5: variantId 옵션 — "A" 또는 "B"만 허용. 다른 값은 silently ignore.
    const variantRaw = body.variantId;
    const variantId: string | null =
      variantRaw === "A" || variantRaw === "B" ? variantRaw : null;

    const ip = getIp(req);
    const ua = req.headers.get("user-agent") || "";
    const hash = crypto
      .createHash("sha256")
      .update(`${ip}|${ua}`)
      .digest("hex")
      .slice(0, 32);

    // 24h 내 동일 visitor_hash 있으면 skip (variant 무관 — 같은 사람이 다른 variant 봐도 1회)
    const { rows } = await sql`
      SELECT 1 FROM page_views
      WHERE page_type = ${pageType}
        AND page_id = ${pageId}
        AND visitor_hash = ${hash}
        AND visited_at > NOW() - INTERVAL '24 hours'
      LIMIT 1
    `;
    if (rows.length > 0) {
      return NextResponse.json({ ok: true, deduped: true });
    }

    await sql`
      INSERT INTO page_views (page_type, page_id, visitor_hash, variant_id)
      VALUES (${pageType}, ${pageId}, ${hash}, ${variantId})
    `;
    return NextResponse.json({ ok: true, variantId });
  } catch (e: any) {
    // 방문 추적 실패는 silent — UI에 영향 없게
    return NextResponse.json({ ok: false, error: "TRACK_FAILED" }, { status: 200 });
  }
}
