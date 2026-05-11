// POST /api/book/[id]/subscribe — 독자가 1장 무료 미리보기 신청
// body: { email }
// 효과:
//  1. book_subscribers에 등록
//  2. Resend로 1장 미리보기 이메일 즉시 발송
//  3. email_sequence_state에 후속 시퀀스 (D+3, D+7) 예약

import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { Resend } from "resend";
import { rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let _resend: Resend | null = null;
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!_resend) _resend = new Resend(key);
  return _resend;
}
const FROM = process.env.EMAIL_FROM ?? "Tigerbookmaker <onboarding@resend.dev>";

function escape(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: "INVALID_BOOK_ID" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const email = String((body as any)?.email ?? "").trim().toLowerCase().slice(0, 255);
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "INVALID_EMAIL", message: "올바른 이메일을 입력해주세요" }, { status: 400 });
  }

  const rl = rateLimit(`subscribe:${params.id}:${email}`, 3, 60 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: "RATE_LIMITED", message: "잠시 후 다시 시도" }, { status: 429 });

  // 책 정보 + 1장 본문
  const { rows: bookRows } = await sql<{ topic: string; data: any; user_id: string }>`
    SELECT topic, data, user_id FROM book_projects WHERE id = ${params.id}
  `;
  const book = bookRows[0];
  if (!book) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (book.data?.shareEnabled !== true) {
    return NextResponse.json({ error: "NOT_SHARED" }, { status: 403 });
  }

  const ch1 = book.data?.chapters?.[0];
  if (!ch1?.content) {
    return NextResponse.json({ error: "NO_CONTENT", message: "1장 본문이 아직 없어요." }, { status: 400 });
  }

  // 구독자 등록 (이미 있으면 무시 — UNIQUE constraint)
  let subscriberId: string;
  try {
    const { rows: subRows } = await sql<{ id: string }>`
      INSERT INTO book_subscribers (book_id, email, source)
      VALUES (${params.id}, ${email}, 'preview')
      ON CONFLICT (book_id, email) DO UPDATE SET unsubscribed_at = NULL
      RETURNING id
    `;
    subscriberId = subRows[0].id;
  } catch (e: any) {
    console.error("[subscribe] insert failed", e?.message);
    return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  }

  // 시퀀스 예약 — D+3, D+7
  try {
    await sql`
      INSERT INTO email_sequence_state (subscriber_id, sequence_type, current_step, next_send_at)
      VALUES (${subscriberId}, 'preview_followup', 1, NOW() + interval '3 days')
      ON CONFLICT (subscriber_id, sequence_type) DO NOTHING
    `;
  } catch (e: any) {
    console.warn("[subscribe] sequence insert failed", e?.message);
  }

  // 즉시 이메일 발송 — 1장 본문
  const resend = getResend();
  if (resend) {
    try {
      const ch1Html = String(ch1.content)
        .split("\n")
        .map(line => {
          const t = line.trim();
          if (!t) return "<br>";
          if (t.startsWith("## ")) return `<h3 style="margin:24px 0 8px">${escape(t.slice(3))}</h3>`;
          return `<p style="margin:0 0 12px;line-height:1.7">${escape(t)}</p>`;
        }).join("");
      const bookUrl = `https://${req.headers.get("host") ?? "tigerbookmaker.vercel.app"}/book/${params.id}`;

      await resend.emails.send({
        from: FROM,
        to: email,
        subject: `[Tigerbookmaker] "${book.topic}" 1장 미리보기`,
        html: `
<!DOCTYPE html><html><body style="font-family:'Apple SD Gothic Neo','Noto Sans KR',sans-serif;background:#fafafa;padding:40px 20px;color:#0a0a0a;">
  <div style="max-width:640px;margin:0 auto;background:white;border-radius:16px;padding:32px;border:1px solid #f0f0f0;">
    <div style="font-size:22px;margin-bottom:24px;">🐯 <strong>Tigerbookmaker</strong></div>
    <h1 style="font-size:24px;font-weight:900;margin:0 0 8px;">${escape(book.topic)}</h1>
    <p style="color:#6b7280;margin:0 0 24px;font-size:14px;">미리보기 — 1장</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
    ${ch1.title ? `<h2 style="font-size:20px;font-weight:800;margin:0 0 16px;">${escape(ch1.title)}</h2>` : ""}
    ${ch1Html}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0;">
    <p style="color:#6b7280;font-size:14px;">2장부터는 책을 다운로드 받아 이어서 읽어주세요.</p>
    <p style="margin:24px 0;">
      <a href="${bookUrl}" style="display:inline-block;background:#f97316;color:white;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold;">
        📖 전체 책 보러가기
      </a>
    </p>
    <p style="color:#9ca3af;font-size:11px;border-top:1px solid #f0f0f0;padding-top:16px;margin-top:32px;">
      이 이메일은 ${escape(email)}이 책 미리보기를 신청했기에 발송되었습니다.<br>
      앞으로 이런 메일을 받지 않으려면 <a href="${bookUrl}?unsub=${encodeURIComponent(email)}" style="color:#9ca3af;">여기를 클릭</a>하세요.
    </p>
  </div>
</body></html>`.trim(),
      });
    } catch (e: any) {
      console.error("[subscribe] email send failed", e?.message);
      return NextResponse.json({
        ok: true,
        message: "구독 완료. 단, 이메일 발송에 실패해 다시 시도가 필요할 수 있어요.",
        warning: "EMAIL_SEND_FAILED",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    message: "1장이 이메일로 발송됐어요. 받은편지함을 확인해주세요.",
  });
}
