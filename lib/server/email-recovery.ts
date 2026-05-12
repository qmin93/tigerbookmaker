// Email Recovery — clean-redesign v3 (spec 3.8)
// A=0 (책 완성자 0건) 단계의 유일하게 작동하는 retention 기능.
// 3 트리거 + 완성 축하 이메일.
//
// 가입만 하고 책 안 만든 사용자: 24h 후
// /new 완료 후 자료 업로드 안 한 사용자: 48h 후
// 챕터 5+개 만들고 7일 멈춘 사용자: 7d 후
// 책 완성 (export) 사용자: 즉시
//
// 호출처: /api/cron/email-recovery (Vercel Cron 매시간 실행)
// 옵트아웃: 모든 메일 푸터에 unsubscribe 링크. users 테이블에 opted_out 컬럼 추가 필요 (다음 마이그레이션).

import "server-only";
import { sql } from "@vercel/postgres";
import { Resend } from "resend";

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

const SITE = "https://tigerbookmaker.vercel.app";

function wrap(body: string, email: string) {
  return `<!DOCTYPE html>
<html><body style="font-family:'Pretendard',system-ui,sans-serif;background:#fafafa;padding:40px;margin:0;">
  <div style="max-width:520px;margin:0 auto;background:white;border-radius:16px;padding:32px;border:1px solid #e5e5e5;">
    <div style="font-size:22px;margin-bottom:24px;">🐯 <strong>Tigerbookmaker</strong></div>
    ${body}
    <p style="color:#a1a1aa;font-size:11px;margin-top:32px;border-top:1px solid #e5e5e5;padding-top:16px;">
      이 메일은 회원가입한 ${escape(email)}로 발송. <a href="${SITE}/profile?settings=email" style="color:#a1a1aa;">메일 수신 거부</a>
    </p>
  </div>
</body></html>`;
}

// ──────────────────────────────────────────
// 트리거 1: 가입 후 24h, 책 미생성
// ──────────────────────────────────────────
async function runTrigger1NoBookYet(): Promise<{ sent: number; skipped: number }> {
  const { rows } = await sql<{ id: string; email: string }>`
    SELECT u.id, u.email
    FROM users u
    WHERE u.created_at < NOW() - INTERVAL '24 hours'
      AND u.created_at > NOW() - INTERVAL '48 hours'
      AND NOT EXISTS (SELECT 1 FROM book_projects bp WHERE bp.user_id = u.id)
      AND NOT EXISTS (
        SELECT 1 FROM email_recovery_log erl
        WHERE erl.user_id = u.id AND erl.trigger_name = 'no_book_yet'
      )
  `;
  return sendBatch(rows, "no_book_yet", (user) => ({
    subject: "₩5,000 크레딧 그대로 있어요 — 1개 자료만 올려보세요",
    html: wrap(`
      <h2 style="font-size:22px;font-weight:900;margin:0 0 16px;color:#171717">막막하시죠? 자료 1개면 시작됩니다.</h2>
      <p style="color:#525252;line-height:1.7">가입 환영해요. 회원님께 드린 <strong>₩5,000 크레딧</strong>이 그대로 있어요.</p>
      <p style="color:#525252;line-height:1.7">책 만들기가 어렵게 느껴진다면 <strong>본인이 가진 자료 1개</strong>만 올려보세요. AI가 핵심 5개 뽑아주고, 그걸로 첫 책의 윤곽이 잡힙니다.</p>
      <p style="margin:24px 0">
        <a href="${SITE}/new" style="display:inline-block;background:#f97316;color:white;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold">📖 첫 책 시작 →</a>
      </p>
    `, user.email),
  }));
}

// ──────────────────────────────────────────
// 트리거 2: /new Step 1 완료, 자료 업로드 안 함 (48h)
// ──────────────────────────────────────────
async function runTrigger2NoReference(): Promise<{ sent: number; skipped: number }> {
  const { rows } = await sql<{ id: string; email: string; topic: string; project_id: string }>`
    SELECT u.id, u.email, bp.topic, bp.id AS project_id
    FROM users u
    JOIN book_projects bp ON bp.user_id = u.id
    WHERE bp.created_at < NOW() - INTERVAL '48 hours'
      AND bp.created_at > NOW() - INTERVAL '96 hours'
      AND NOT EXISTS (SELECT 1 FROM book_references br WHERE br.project_id = bp.id)
      AND NOT EXISTS (
        SELECT 1 FROM email_recovery_log erl
        WHERE erl.user_id = u.id AND erl.project_id = bp.id AND erl.trigger_name = 'no_reference'
      )
  `;
  return sendBatch(rows, "no_reference", (user) => ({
    subject: `"${user.topic}" 자료 없어도 시작 가능해요`,
    html: wrap(`
      <h2 style="font-size:22px;font-weight:900;margin:0 0 16px;color:#171717">자료 없어도 시작할 수 있어요</h2>
      <p style="color:#525252;line-height:1.7">며칠 전에 <strong>"${escape(user.topic)}"</strong> 주제로 시작하셨는데 자료 업로드 단계에서 멈추셨네요.</p>
      <p style="color:#525252;line-height:1.7"><strong>자료 없이도 됩니다.</strong> AI가 인터뷰 질문 5~7개 던지고, 답변만으로도 챕터 12개 짜리 책이 나옵니다.</p>
      <p style="margin:24px 0">
        <a href="${SITE}/write?id=${user.project_id}" style="display:inline-block;background:#f97316;color:white;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold">→ 인터뷰만으로 시작</a>
      </p>
    `, user.email),
  }), (row) => ({ project_id: row.project_id }));
}

// ──────────────────────────────────────────
// 트리거 3: 챕터 5+개 만들고 7일 멈춤
// ──────────────────────────────────────────
async function runTrigger3StuckMidway(): Promise<{ sent: number; skipped: number }> {
  // chapter 카운트는 book_projects.data jsonb의 chapters 배열 길이로 추정.
  // 마지막 활동 = ai_usage 최근 entry. 7일 이상 없으면 stuck.
  const { rows } = await sql<{ id: string; email: string; topic: string; project_id: string; chapter_count: number }>`
    SELECT u.id, u.email, bp.topic, bp.id AS project_id,
           jsonb_array_length(COALESCE(bp.data->'chapters', '[]'::jsonb)) AS chapter_count
    FROM users u
    JOIN book_projects bp ON bp.user_id = u.id
    WHERE jsonb_array_length(COALESCE(bp.data->'chapters', '[]'::jsonb)) >= 5
      AND NOT EXISTS (
        SELECT 1 FROM ai_usage au
        WHERE au.user_id = u.id AND au.project_id = bp.id
          AND au.created_at > NOW() - INTERVAL '7 days'
      )
      AND NOT EXISTS (
        SELECT 1 FROM email_recovery_log erl
        WHERE erl.user_id = u.id AND erl.project_id = bp.id AND erl.trigger_name = 'stuck_midway'
      )
  `;
  return sendBatch(rows, "stuck_midway", (user) => ({
    subject: `"${user.topic}" 거의 다 됐어요`,
    html: wrap(`
      <h2 style="font-size:22px;font-weight:900;margin:0 0 16px;color:#171717">${user.chapter_count}챕터 완성. 나머지 자동 생성?</h2>
      <p style="color:#525252;line-height:1.7"><strong>"${escape(user.topic)}"</strong>는 챕터 ${user.chapter_count}개까지 완성됐어요. 나머지 챕터도 같은 톤으로 자동 생성됩니다 — 클릭 1회.</p>
      <p style="color:#525252;line-height:1.7">완성 후 크몽 등록 패키지 (제목 · 상세설명 · 키워드 · 가격 추천)까지 자동 생성합니다.</p>
      <p style="margin:24px 0">
        <a href="${SITE}/write?id=${user.project_id}" style="display:inline-block;background:#f97316;color:white;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold">→ 책 마무리하기</a>
      </p>
    `, user.email),
  }), (row) => ({ project_id: row.project_id, meta: { chapter_count: row.chapter_count } }));
}

// ──────────────────────────────────────────
// 공통 발송 + 로깅
// ──────────────────────────────────────────
async function sendBatch<T extends { id: string; email: string }>(
  rows: T[],
  triggerName: string,
  buildEmail: (row: T) => { subject: string; html: string },
  extraLog?: (row: T) => { project_id?: string; meta?: Record<string, unknown> },
): Promise<{ sent: number; skipped: number }> {
  const resend = getResend();
  if (!resend) return { sent: 0, skipped: rows.length };

  let sent = 0;
  let skipped = 0;
  for (const row of rows) {
    try {
      const { subject, html } = buildEmail(row);
      await resend.emails.send({ from: FROM, to: row.email, subject, html });
      const extra = extraLog?.(row);
      await sql`
        INSERT INTO email_recovery_log (user_id, trigger_name, project_id, meta, sent_at)
        VALUES (${row.id}, ${triggerName}, ${extra?.project_id ?? null}, ${JSON.stringify(extra?.meta ?? {})}, NOW())
        ON CONFLICT DO NOTHING
      `;
      sent++;
    } catch (err) {
      console.error(`[email-recovery:${triggerName}]`, row.email, err);
      skipped++;
    }
  }
  return { sent, skipped };
}

// ──────────────────────────────────────────
// 진입점 — cron route에서 호출
// ──────────────────────────────────────────
export async function runEmailRecovery(): Promise<{
  t1: { sent: number; skipped: number };
  t2: { sent: number; skipped: number };
  t3: { sent: number; skipped: number };
}> {
  const [t1, t2, t3] = await Promise.all([
    runTrigger1NoBookYet().catch(e => ({ sent: 0, skipped: 0, error: String(e) })),
    runTrigger2NoReference().catch(e => ({ sent: 0, skipped: 0, error: String(e) })),
    runTrigger3StuckMidway().catch(e => ({ sent: 0, skipped: 0, error: String(e) })),
  ]);
  return { t1, t2, t3 };
}
