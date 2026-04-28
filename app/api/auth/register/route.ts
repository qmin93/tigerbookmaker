// POST /api/auth/register — 이메일+비밀번호 가입 또는 비번 설정
// 이미 매직링크/Google로 가입된 사용자도 비번 설정 가능

import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import bcrypt from "bcryptjs";
import { isDisposableEmail } from "@/lib/server/rate-limit";
import { rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

// 베타 기간 환영 크레딧 — 책 10권 분량.
// 결제 시스템 활성화(사업자등록 + 토스 가맹점 심사 완료) 후 1000원 복귀.
const SIGNUP_BONUS_KRW = 10000;

export async function POST(req: Request) {
  const { email: rawEmail, password } = await req.json().catch(() => ({}));
  const email = String(rawEmail ?? "").trim().toLowerCase();
  const pw = String(password ?? "");

  if (!email.includes("@") || pw.length < 8) {
    return NextResponse.json({
      error: "INVALID_INPUT",
      message: "이메일 형식 또는 비밀번호 길이(8자 이상)를 확인하세요.",
    }, { status: 400 });
  }
  if (isDisposableEmail(email)) {
    return NextResponse.json({ error: "DISPOSABLE_EMAIL" }, { status: 400 });
  }

  // 어뷰즈 방지 — IP·이메일별 분당 3회
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit(`register:${ip}:${email}`, 3, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const hash = await bcrypt.hash(pw, 12);

  // 기존 유저 확인
  const { rows: existing } = await sql<{ id: string; password_hash: string | null }>`
    SELECT id, password_hash FROM users WHERE email = ${email}
  `;

  if (existing.length > 0) {
    // 이미 비번 있음 → 로그인 유도
    if (existing[0].password_hash) {
      return NextResponse.json({
        error: "ALREADY_REGISTERED",
        message: "이미 가입된 계정입니다. 로그인해주세요.",
      }, { status: 409 });
    }
    // 비번 없음 (매직링크/Google로 가입) → 비번 설정만
    await sql`UPDATE users SET password_hash = ${hash}, updated_at = NOW() WHERE id = ${existing[0].id}`;
    return NextResponse.json({ ok: true, mode: "password_added" });
  }

  // 신규 가입 — users + balance + 보너스 트랜잭션 한 번에
  const { rows: created } = await sql<{ id: string }>`
    INSERT INTO users (email, password_hash, balance_krw, signup_bonus_given, email_verified)
    VALUES (${email}, ${hash}, ${SIGNUP_BONUS_KRW}, TRUE, NOW())
    RETURNING id
  `;
  await sql`
    INSERT INTO balance_transactions (user_id, type, amount_krw, balance_after, reason)
    VALUES (${created[0].id}, 'bonus', ${SIGNUP_BONUS_KRW}, ${SIGNUP_BONUS_KRW}, '베타 환영 크레딧 (책 10권)')
  `;

  return NextResponse.json({ ok: true, mode: "registered" });
}
