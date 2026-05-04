// POST /api/profile/subscribe
// body: { handle: string, email: string }
// 인증 불필요 (public — 독자가 작가 프로필에서 구독).
// UNIQUE (author_user_id, subscriber_email) — 재구독 시 unsubscribed_at = NULL로 reset.

import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getProfileByHandle } from "@/lib/server/profile";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    }

    const handle = String(body.handle ?? "").toLowerCase().trim();
    const email = String(body.email ?? "").trim().toLowerCase().slice(0, 200);

    if (!handle) {
      return NextResponse.json({ error: "INVALID_HANDLE" }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "INVALID_EMAIL", message: "이메일 형식이 올바르지 않습니다." }, { status: 400 });
    }

    const profile = await getProfileByHandle(handle);
    if (!profile) {
      return NextResponse.json({ error: "NOT_FOUND", message: "작가 프로필을 찾을 수 없습니다." }, { status: 404 });
    }

    await sql`
      INSERT INTO email_subscriptions (author_user_id, subscriber_email)
      VALUES (${profile.userId}, ${email})
      ON CONFLICT (author_user_id, subscriber_email)
      DO UPDATE SET unsubscribed_at = NULL, subscribed_at = NOW()
    `;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: "SUBSCRIBE_FAILED", message: e?.message ?? "구독 실패" }, { status: 500 });
  }
}
