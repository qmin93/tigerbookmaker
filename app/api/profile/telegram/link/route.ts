// POST /api/profile/telegram/link
// /write v3 Phase 4.4 — 텔레그램 봇 연결용 1회용 토큰 발급.
// spec: docs/superpowers/specs/2026-05-13-write-flow-v3-design.md §3.3 + §7
//
// 흐름:
//  1. 사용자가 /profile 에서 "텔레그램 연결하기" 클릭
//  2. 본 엔드포인트가 32자 토큰 생성 후 users.telegram_link_token 에 저장
//  3. 사용자가 텔레그램에서 @<bot>에 /link <token> 메시지 전송
//  4. /api/telegram/webhook 가 토큰 조회 → 매칭 시 telegram_chat_id 저장 + 토큰 삭제

import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { randomBytes } from "node:crypto";
import { auth } from "@/auth";

export const runtime = "nodejs";

const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME ?? "tigerbookmaker_bot";

/** 32-char URL-safe token (base64url, 24 bytes → 32 chars). */
function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const userId = session.user.id;

  const token = generateToken();

  try {
    await sql`
      UPDATE users
      SET telegram_link_token = ${token}
      WHERE id = ${userId}
    `;
  } catch (e: any) {
    const msg = (e?.message ?? String(e)).slice(0, 200);
    console.error("[telegram/link] DB update failed:", msg);
    return NextResponse.json(
      { error: "DB_ERROR", message: "토큰 발급 실패. 잠시 후 다시 시도하세요." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    token,
    botUsername: BOT_USERNAME,
    botUrl: `https://t.me/${BOT_USERNAME}?start=${token}`,
    instructions: `텔레그램에서 @${BOT_USERNAME} 봇을 열고 "/link ${token}" 메시지를 보내면 연결됩니다.`,
  });
}

// DELETE /api/profile/telegram/link — 연결 해제 (chat_id 및 token 모두 클리어).
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    await sql`
      UPDATE users
      SET telegram_chat_id = NULL,
          telegram_linked_at = NULL,
          telegram_link_token = NULL
      WHERE id = ${userId}
    `;
  } catch (e: any) {
    const msg = (e?.message ?? String(e)).slice(0, 200);
    console.error("[telegram/link DELETE] DB update failed:", msg);
    return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// GET /api/profile/telegram/link — 현재 연결 상태 조회.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const { rows } = await sql<{
      telegram_chat_id: string | null;
      telegram_linked_at: string | null;
    }>`
      SELECT telegram_chat_id, telegram_linked_at
      FROM users
      WHERE id = ${userId}
      LIMIT 1
    `;
    const row = rows[0];
    return NextResponse.json({
      linked: !!row?.telegram_chat_id,
      linkedAt: row?.telegram_linked_at ?? null,
      botUsername: BOT_USERNAME,
    });
  } catch (e: any) {
    // 컬럼 미적용 환경(0016 마이그레이션 미실행)에선 linked=false fallback.
    const msg = (e?.message ?? String(e)).slice(0, 200);
    console.error("[telegram/link GET] DB lookup failed (fallback to linked=false):", msg);
    return NextResponse.json({
      linked: false,
      linkedAt: null,
      botUsername: BOT_USERNAME,
    });
  }
}
