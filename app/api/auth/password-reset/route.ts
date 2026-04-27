// POST /api/auth/password-reset
//   { mode: "request", email }    → 재설정 링크 발송
//   { mode: "confirm", token, password } → 비번 재설정

import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import bcrypt from "bcryptjs";
import { Resend } from "resend";
import { rateLimit } from "@/lib/server/rate-limit";
import crypto from "crypto";

export const runtime = "nodejs";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY ?? "missing");
  return _resend;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  if (body.mode === "request") {
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!email.includes("@")) return NextResponse.json({ error: "INVALID_EMAIL" }, { status: 400 });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit(`pwreset:${ip}:${email}`, 3, 10 * 60_000); // 10분 3회
    if (!rl.ok) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });

    // 유저 존재 확인 (있어도/없어도 같은 응답 — 이메일 존재 여부 누출 방지)
    const { rows } = await sql<{ id: string }>`SELECT id FROM users WHERE email = ${email}`;
    if (rows.length > 0) {
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 30 * 60_000); // 30분
      await sql`
        INSERT INTO password_reset_tokens (token, user_id, expires_at)
        VALUES (${token}, ${rows[0].id}, ${expiresAt.toISOString()})
      `;
      const url = `${process.env.NEXTAUTH_URL ?? "https://tigerbookmaker.vercel.app"}/reset-password?token=${token}`;
      try {
        await getResend().emails.send({
          from: process.env.EMAIL_FROM ?? "Tigerbookmaker <onboarding@resend.dev>",
          to: email,
          subject: "[Tigerbookmaker] 비밀번호 재설정 링크",
          html: `
<!DOCTYPE html>
<html><body style="font-family:'Pretendard',system-ui,sans-serif;background:#f9fafb;padding:40px;">
  <div style="max-width:480px;margin:0 auto;background:white;border-radius:16px;padding:32px;border:1px solid #f0f0f0;">
    <div style="font-size:24px;margin-bottom:24px;">🐯 <strong>Tigerbookmaker</strong></div>
    <h1 style="font-size:22px;font-weight:900;margin:0 0 12px;">비밀번호 재설정</h1>
    <p style="color:#4b5563;margin:0 0 24px;">아래 버튼을 눌러 새 비밀번호를 설정하세요. 이 링크는 30분간 유효합니다.</p>
    <a href="${url}" style="display:inline-block;padding:14px 28px;background:#f97316;color:white;text-decoration:none;font-weight:bold;border-radius:12px;">새 비밀번호 설정</a>
    <p style="color:#9ca3af;font-size:12px;margin-top:32px;">본인이 요청하지 않은 경우 이 메일을 무시해도 됩니다.</p>
  </div>
</body></html>`.trim(),
        });
      } catch (e) {
        console.error("[pwreset] email failed", e);
      }
    }
    return NextResponse.json({ ok: true }); // 항상 ok (이메일 존재 여부 숨김)
  }

  if (body.mode === "confirm") {
    const token = String(body.token ?? "");
    const password = String(body.password ?? "");
    if (!token || password.length < 8) {
      return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    }
    const { rows } = await sql<{ user_id: string; expires_at: Date; used_at: Date | null }>`
      SELECT user_id, expires_at, used_at FROM password_reset_tokens WHERE token = ${token}
    `;
    const t = rows[0];
    if (!t) return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 400 });
    if (t.used_at) return NextResponse.json({ error: "USED_TOKEN" }, { status: 400 });
    if (new Date(t.expires_at) < new Date()) return NextResponse.json({ error: "EXPIRED_TOKEN" }, { status: 400 });

    const hash = await bcrypt.hash(password, 12);
    await sql`UPDATE users SET password_hash = ${hash}, updated_at = NOW() WHERE id = ${t.user_id}`;
    await sql`UPDATE password_reset_tokens SET used_at = NOW() WHERE token = ${token}`;
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "INVALID_MODE" }, { status: 400 });
}
