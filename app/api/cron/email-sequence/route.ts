// GET /api/cron/email-sequence — Vercel Cron 호출 (vercel.json에 등록)
// 매시간 실행. 발송 시각 도래한 sequence step 처리.
//
// 시퀀스 (preview_followup):
//  step 1 (D+3): "1장 어떠셨어요? 다음 챕터 미리보기"
//  step 2 (D+7): "후기 한 줄 부탁드려요"
//  step 3 (D+14): "작가의 다음 책 안내"
//
// Vercel Cron 보안: CRON_SECRET 환경변수로 Authorization Bearer 검증.

import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { Resend } from "resend";

export const runtime = "nodejs";
export const maxDuration = 60;

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

interface SequenceStep {
  step: number;
  delayDays: number;
  buildEmail: (book: { id: string; topic: string }, email: string) => { subject: string; html: string };
}

const PREVIEW_FOLLOWUP_STEPS: SequenceStep[] = [
  {
    step: 1,
    delayDays: 3,
    buildEmail: (book, email) => ({
      subject: `[Tigerbookmaker] "${book.topic}" 1장은 어떠셨어요?`,
      html: emailWrap(`
        <h2 style="font-size:22px;font-weight:900;margin:0 0 16px">1장은 어떠셨나요?</h2>
        <p>3일 전에 보내드린 "${escape(book.topic)}" 1장 미리보기, 잘 읽으셨길 바랍니다.</p>
        <p>2장부터는 본문 전체에 단계별 실행 가이드와 사례가 이어집니다.</p>
        <p style="margin:24px 0">
          <a href="https://tigerbookmaker.vercel.app/book/${book.id}" style="display:inline-block;background:#f97316;color:white;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold">📖 전체 책 받기</a>
        </p>
      `, email, book.id),
    }),
  },
  {
    step: 2,
    delayDays: 4,  // step 1 후 4일 = 가입 후 7일
    buildEmail: (book, email) => ({
      subject: `[Tigerbookmaker] "${book.topic}" 한 줄 후기 부탁드립니다`,
      html: emailWrap(`
        <h2 style="font-size:22px;font-weight:900;margin:0 0 16px">읽고 어떠셨나요?</h2>
        <p>"${escape(book.topic)}" 미리보기를 받으신 지 일주일이 지났습니다.</p>
        <p>책이 도움이 되셨다면, 짧은 후기 한 줄 남겨주시면 다른 분들이 책을 선택하는 데 큰 도움이 됩니다.</p>
        <p style="margin:24px 0">
          <a href="https://tigerbookmaker.vercel.app/book/${book.id}#reviews" style="display:inline-block;background:#f97316;color:white;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold">✏️ 후기 한 줄 남기기</a>
        </p>
      `, email, book.id),
    }),
  },
  {
    step: 3,
    delayDays: 7,  // step 2 후 7일 = 가입 후 14일
    buildEmail: (book, email) => ({
      subject: `[Tigerbookmaker] "${book.topic}" 작가의 다음 책 안내`,
      html: emailWrap(`
        <h2 style="font-size:22px;font-weight:900;margin:0 0 16px">감사합니다</h2>
        <p>"${escape(book.topic)}"에 관심 가져주셔서 다시 한 번 감사드립니다.</p>
        <p>저자의 다른 책이나 시리즈를 보고 싶으시면 작가 페이지를 확인해보세요.</p>
        <p style="margin:24px 0">
          <a href="https://tigerbookmaker.vercel.app/book/${book.id}" style="display:inline-block;background:#0a0a0a;color:white;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold">작가 페이지 →</a>
        </p>
      `, email, book.id),
    }),
  },
];

function emailWrap(content: string, email: string, bookId: string): string {
  const unsubUrl = `https://tigerbookmaker.vercel.app/book/${bookId}?unsub=${encodeURIComponent(email)}`;
  return `<!DOCTYPE html><html><body style="font-family:'Apple SD Gothic Neo','Noto Sans KR',sans-serif;background:#fafafa;padding:40px 20px;color:#0a0a0a;line-height:1.7"><div style="max-width:560px;margin:0 auto;background:white;border-radius:16px;padding:32px;border:1px solid #f0f0f0"><div style="font-size:20px;margin-bottom:24px">🐯 <strong>Tigerbookmaker</strong></div>${content}<p style="color:#9ca3af;font-size:11px;border-top:1px solid #f0f0f0;padding-top:16px;margin-top:32px">${escape(email)}으로 발송. <a href="${unsubUrl}" style="color:#9ca3af">메일 그만 받기</a></p></div></body></html>`;
}

export async function GET(req: Request) {
  // Vercel Cron 인증
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const resend = getResend();
  if (!resend) {
    return NextResponse.json({ ok: false, message: "Resend not configured" });
  }

  // 발송 due 항목 조회 (최대 50건/run)
  const { rows: due } = await sql<{
    id: string;
    subscriber_id: string;
    sequence_type: string;
    current_step: number;
    book_id: string;
    book_topic: string;
    email: string;
    unsubscribed_at: string | null;
  }>`
    SELECT
      s.id, s.subscriber_id, s.sequence_type, s.current_step,
      sub.book_id, sub.email, sub.unsubscribed_at,
      bp.topic AS book_topic
    FROM email_sequence_state s
    JOIN book_subscribers sub ON sub.id = s.subscriber_id
    JOIN book_projects bp ON bp.id = sub.book_id
    WHERE s.completed_at IS NULL
      AND s.failed_at IS NULL
      AND s.next_send_at <= NOW()
    ORDER BY s.next_send_at ASC
    LIMIT 50
  `;

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of due) {
    if (row.unsubscribed_at) {
      // 구독 해지됨 — 시퀀스 완료 처리
      await sql`UPDATE email_sequence_state SET completed_at = NOW() WHERE id = ${row.id}`;
      skipped++;
      continue;
    }

    if (row.sequence_type !== "preview_followup") {
      skipped++;
      continue;
    }

    const stepDef = PREVIEW_FOLLOWUP_STEPS.find(s => s.step === row.current_step);
    if (!stepDef) {
      // 잘못된 step → 완료
      await sql`UPDATE email_sequence_state SET completed_at = NOW() WHERE id = ${row.id}`;
      skipped++;
      continue;
    }

    try {
      const { subject, html } = stepDef.buildEmail({ id: row.book_id, topic: row.book_topic }, row.email);
      await resend.emails.send({ from: FROM, to: row.email, subject, html });
      sent++;

      // 다음 step 또는 완료
      const nextStepDef = PREVIEW_FOLLOWUP_STEPS.find(s => s.step === row.current_step + 1);
      if (nextStepDef) {
        await sql`
          UPDATE email_sequence_state
          SET current_step = ${nextStepDef.step},
              next_send_at = NOW() + (${nextStepDef.delayDays} || ' days')::interval
          WHERE id = ${row.id}
        `;
      } else {
        await sql`UPDATE email_sequence_state SET completed_at = NOW() WHERE id = ${row.id}`;
      }
    } catch (e: any) {
      failed++;
      await sql`
        UPDATE email_sequence_state
        SET failed_at = NOW(), fail_reason = ${e?.message?.slice(0, 500) ?? "unknown"}
        WHERE id = ${row.id}
      `;
    }
  }

  return NextResponse.json({
    ok: true,
    processed: due.length,
    sent,
    skipped,
    failed,
  });
}
