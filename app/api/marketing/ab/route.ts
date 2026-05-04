// /api/marketing/ab
// PUT  — body { projectId, taglineA?, taglineB?, descriptionA?, descriptionB?, enabled? }
//        본인 책 ownership 확인 + abTest 저장.
// GET  ?bookId=...
//        해당 책의 A/B variants + variant별 page_view 카운트 (24h, 7d, 전체).
//
// Wave B5: 마케팅 페이지 A/B 테스트.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@vercel/postgres";
import { getProject, updateProjectData } from "@/lib/server/db";
import { rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const userId = session.user.id;

    const rl = rateLimit(`ab-put:${userId}`, 10, 60_000);
    if (!rl.ok) {
      return NextResponse.json({ error: "RATE_LIMITED", resetIn: rl.resetIn }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    }

    const projectId = String(body.projectId ?? "");
    if (!projectId || !UUID_RE.test(projectId)) {
      return NextResponse.json({ error: "INVALID_PROJECT_ID" }, { status: 400 });
    }

    const projectRow = await getProject(projectId, userId);
    if (!projectRow) {
      return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    }

    const project = projectRow.data ?? {};
    const existing = project.abTest ?? {};

    const sanitized: any = {
      ...existing,
      createdAt: existing.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    };

    if (typeof body.taglineA === "string") sanitized.taglineA = body.taglineA.slice(0, 200);
    if (typeof body.taglineB === "string") sanitized.taglineB = body.taglineB.slice(0, 200);
    if (typeof body.descriptionA === "string") sanitized.descriptionA = body.descriptionA.slice(0, 3000);
    if (typeof body.descriptionB === "string") sanitized.descriptionB = body.descriptionB.slice(0, 3000);
    if (typeof body.enabled === "boolean") sanitized.enabled = body.enabled;

    await updateProjectData(projectId, userId, { ...project, abTest: sanitized });

    return NextResponse.json({ ok: true, abTest: sanitized });
  } catch (e: any) {
    console.error("[/api/marketing/ab PUT] uncaught:", e?.message);
    return NextResponse.json({ error: "INTERNAL_ERROR", message: e?.message || String(e) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const userId = session.user.id;

    const url = new URL(req.url);
    const bookId = String(url.searchParams.get("bookId") ?? "");
    if (!bookId || !UUID_RE.test(bookId)) {
      return NextResponse.json({ error: "INVALID_BOOK_ID" }, { status: 400 });
    }

    const projectRow = await getProject(bookId, userId);
    if (!projectRow) {
      return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    }

    const abTest = projectRow.data?.abTest ?? null;

    // variant별 page_view 카운트 — 24h / 7d / 전체.
    const { rows } = await sql`
      SELECT
        variant_id,
        COUNT(*) FILTER (WHERE visited_at > NOW() - INTERVAL '24 hours')::int AS views_24h,
        COUNT(*) FILTER (WHERE visited_at > NOW() - INTERVAL '7 days')::int   AS views_7d,
        COUNT(*)::int AS views_total
      FROM page_views
      WHERE page_type = 'book'
        AND page_id = ${bookId}
        AND variant_id IS NOT NULL
      GROUP BY variant_id
    `;

    const stats: Record<string, { views24h: number; views7d: number; viewsTotal: number }> = {
      A: { views24h: 0, views7d: 0, viewsTotal: 0 },
      B: { views24h: 0, views7d: 0, viewsTotal: 0 },
    };
    for (const r of rows as any[]) {
      const v = String(r.variant_id ?? "");
      if (v === "A" || v === "B") {
        stats[v] = {
          views24h: Number(r.views_24h ?? 0),
          views7d: Number(r.views_7d ?? 0),
          viewsTotal: Number(r.views_total ?? 0),
        };
      }
    }

    return NextResponse.json({ ok: true, abTest, stats });
  } catch (e: any) {
    console.error("[/api/marketing/ab GET] uncaught:", e?.message);
    return NextResponse.json({ error: "INTERNAL_ERROR", message: e?.message || String(e) }, { status: 500 });
  }
}
