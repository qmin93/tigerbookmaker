// lib/server/notify-book-completion.ts
// v3 Phase 1.4 — 책 본문 생성 완료/실패 시 사용자에게 이메일로 알림.
// v3 Phase 4.4 — 텔레그램 봇 연결된 사용자에겐 DM도 함께 발송 (베타).
//
// 호출처: app/api/cron/book-generation-worker/route.ts
//  - advanceJob(status='completed') 직후 → 완료 이메일 + 텔레그램 DM
//  - advanceJob(status='failed') 직후   → 실패 이메일 + 텔레그램 DM
//
// 정책:
//  - users.email_notifications_enabled = false 면 이메일 skip (migration 0014로 도입한 컬럼)
//    컬럼이 아직 없는 환경(미적용)에서는 catch로 받아 always-send로 fallback.
//  - RESEND_API_KEY 없으면 이메일 skip (개발 환경).
//  - users.telegram_chat_id NULL 이면 텔레그램 skip.
//  - TELEGRAM_BOT_TOKEN 없으면 텔레그램 skip (sendTelegramDM 내부에서).
//  - 어떤 실패도 throw하지 않음 — 알림은 best-effort.

import "server-only";
import { Resend } from "resend";
import { sql } from "@vercel/postgres";
import { sendTelegramDM, escapeTelegramHtml } from "./telegram-notify";

let _resend: Resend | null = null;
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!_resend) _resend = new Resend(key);
  return _resend;
}

const FROM = process.env.EMAIL_FROM ?? "Tigerbookmaker <onboarding@resend.dev>";
const SITE = "https://tigerbookmaker.vercel.app";

function escape(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrap(title: string, body: string, email: string): string {
  return `<!DOCTYPE html>
<html><body style="font-family:'Pretendard',system-ui,sans-serif;background:#fafafa;padding:40px;margin:0;">
  <div style="max-width:520px;margin:0 auto;background:white;border-radius:16px;padding:32px;border:1px solid #e5e5e5;">
    <div style="font-size:22px;margin-bottom:24px;">🐯 <strong>Tigerbookmaker</strong></div>
    <h1 style="font-size:22px;font-weight:900;margin:0 0 16px;color:#171717;line-height:1.3">${title}</h1>
    ${body}
    <p style="color:#a1a1aa;font-size:11px;margin-top:32px;border-top:1px solid #e5e5e5;padding-top:16px;">
      이 메일은 ${escape(email)}로 발송. <a href="${SITE}/profile?settings=email" style="color:#a1a1aa;">메일 수신 거부</a>
    </p>
  </div>
</body></html>`;
}

interface UserProjectLookup {
  email: string;
  topic: string;
  notifications_enabled: boolean;
  telegram_chat_id: string | null;
}

async function lookupUserAndProject(
  userId: string,
  projectId: string,
): Promise<UserProjectLookup | null> {
  // email_notifications_enabled / telegram_chat_id 컬럼이 아직 적용 안 된 환경 대응:
  // 일단 모두 포함해서 조회 → 실패하면 단계적으로 fallback.
  try {
    const { rows } = await sql<{
      email: string;
      topic: string;
      email_notifications_enabled: boolean | null;
      telegram_chat_id: string | null;
    }>`
      SELECT u.email, bp.topic, u.email_notifications_enabled, u.telegram_chat_id
      FROM users u
      JOIN book_projects bp ON bp.user_id = u.id
      WHERE u.id = ${userId} AND bp.id = ${projectId}
      LIMIT 1
    `;
    if (rows.length === 0) return null;
    return {
      email: rows[0].email,
      topic: rows[0].topic,
      notifications_enabled: rows[0].email_notifications_enabled !== false,
      telegram_chat_id: rows[0].telegram_chat_id ?? null,
    };
  } catch {
    // telegram_chat_id 컬럼이 없을 수도 있음 → email_notifications_enabled만 시도.
    try {
      const { rows } = await sql<{
        email: string;
        topic: string;
        email_notifications_enabled: boolean | null;
      }>`
        SELECT u.email, bp.topic, u.email_notifications_enabled
        FROM users u
        JOIN book_projects bp ON bp.user_id = u.id
        WHERE u.id = ${userId} AND bp.id = ${projectId}
        LIMIT 1
      `;
      if (rows.length === 0) return null;
      return {
        email: rows[0].email,
        topic: rows[0].topic,
        notifications_enabled: rows[0].email_notifications_enabled !== false,
        telegram_chat_id: null,
      };
    } catch {
      // 가장 오래된 환경 — 두 컬럼 모두 없음.
      const { rows } = await sql<{ email: string; topic: string }>`
        SELECT u.email, bp.topic
        FROM users u
        JOIN book_projects bp ON bp.user_id = u.id
        WHERE u.id = ${userId} AND bp.id = ${projectId}
        LIMIT 1
      `;
      if (rows.length === 0) return null;
      return {
        email: rows[0].email,
        topic: rows[0].topic,
        notifications_enabled: true,
        telegram_chat_id: null,
      };
    }
  }
}

function buildTelegramMessage(
  status: "completed" | "failed",
  topic: string,
  projectId: string,
  errorMessage?: string,
): { text: string; url: string; buttonText: string } {
  const safeTopic = escapeTelegramHtml(topic);
  if (status === "completed") {
    const url = `${SITE}/preview?id=${encodeURIComponent(projectId)}`;
    return {
      text:
        `<b>🎉 책이 완성됐어요</b>\n\n` +
        `<b>${safeTopic}</b> 본문 생성이 끝났습니다.\n` +
        `미리보기로 들어가서 챕터별 결과를 확인하세요.`,
      url,
      buttonText: "📖 책 미리보기",
    };
  }
  const url = `${SITE}/write?id=${encodeURIComponent(projectId)}`;
  const reason = errorMessage
    ? `\n\n<i>중단 사유: ${escapeTelegramHtml(errorMessage)}</i>`
    : "";
  return {
    text:
      `<b>⚠️ 책 생성이 중단됐어요</b>\n\n` +
      `<b>${safeTopic}</b> 본문 생성이 일시적으로 멈췄습니다.\n` +
      `진행 상태는 저장돼 있으니 같은 자리에서 이어서 시도할 수 있어요.${reason}`,
    url,
    buttonText: "→ 이어서 만들기",
  };
}

function buildCompletedEmail(topic: string, projectId: string, email: string) {
  const safeTopic = escape(topic);
  const previewUrl = `${SITE}/preview?id=${encodeURIComponent(projectId)}`;
  const subject = `🎉 ${topic} 책이 완성됐어요`;
  const html = wrap(
    `🎉 "${safeTopic}" 본문이 완성됐어요`,
    `
      <p style="color:#525252;line-height:1.7;margin:0 0 12px">
        백그라운드로 돌리던 본문 생성이 끝났습니다. 지금 미리보기로 들어가서 챕터별 결과를 확인해보세요.
      </p>
      <p style="color:#525252;line-height:1.7;margin:0 0 24px">
        <strong>다음 단계:</strong> 표지·광고 만들기 → 크몽 등록 패키지까지 한 번에 완성됩니다.
      </p>
      <p style="margin:24px 0">
        <a href="${previewUrl}" style="display:inline-block;background:#f97316;color:white;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold">📖 책 미리보기 →</a>
      </p>
      <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:24px 0 0">
        마음에 안 드는 챕터는 자연어로 다시 만들 수 있어요 ("더 짧게", "예시 추가" 등).
      </p>
    `,
    email,
  );
  return { subject, html };
}

function buildFailedEmail(
  topic: string,
  projectId: string,
  email: string,
  errorMessage?: string,
) {
  const safeTopic = escape(topic);
  const writeUrl = `${SITE}/write?id=${encodeURIComponent(projectId)}`;
  const subject = `"${topic}" 본문 생성이 중단됐어요 — 이어서 시도하세요`;
  const reasonBlock = errorMessage
    ? `<p style="color:#a1a1aa;font-size:12px;line-height:1.6;margin:12px 0 0;background:#fafafa;padding:12px;border-radius:8px;border:1px solid #f0f0f0">중단 사유: ${escape(errorMessage)}</p>`
    : "";
  const html = wrap(
    `"${safeTopic}" 본문 생성이 중단됐어요`,
    `
      <p style="color:#525252;line-height:1.7;margin:0 0 16px">
        일시적인 문제로 본문 생성이 멈췄습니다. 진행 상태는 저장돼 있으니 같은 자리에서 이어서 시도할 수 있어요.
      </p>
      <p style="margin:24px 0">
        <a href="${writeUrl}" style="display:inline-block;background:#f97316;color:white;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold">→ 이어서 본문 만들기</a>
      </p>
      ${reasonBlock}
      <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:24px 0 0">
        잔액이 부족하거나 자료 인덱싱에 문제가 있는 경우 알림에 사유가 적혀 있을 수 있어요.
      </p>
    `,
    email,
  );
  return { subject, html };
}

/**
 * 책 생성 완료/실패 시 사용자에게 이메일 발송.
 *
 * - userId / projectId / status / errorMessage 받아서 DB 조회 → 발송.
 * - 옵트아웃이면 skip, 환경 미설정이면 skip, 실패해도 throw X.
 */
export async function sendBookCompletionEmail(opts: {
  userId: string;
  projectId: string;
  status: "completed" | "failed";
  errorMessage?: string;
}): Promise<{
  sent: boolean;
  error?: string;
  telegram?: { sent: boolean; error?: string };
}> {
  const { userId, projectId, status, errorMessage } = opts;

  let lookup: UserProjectLookup | null;
  try {
    lookup = await lookupUserAndProject(userId, projectId);
  } catch (e: any) {
    const msg = (e?.message ?? String(e)).slice(0, 200);
    console.error("[notify-book-completion] DB lookup failed:", msg);
    return { sent: false, error: `DB lookup failed: ${msg}` };
  }

  if (!lookup) {
    return { sent: false, error: "user or project not found" };
  }
  if (!lookup.notifications_enabled) {
    // 옵트아웃이라도 텔레그램은 별도 채널로 보낼지 결정 가능.
    // 베타 단계엔 동일 플래그로 모두 옵트아웃 처리 (사용자 기대 일관성).
    return { sent: false, error: "user opted out of notifications" };
  }

  // ── 이메일 발송 ──
  let emailResult: { sent: boolean; error?: string } = { sent: false };
  const resend = getResend();
  if (!resend) {
    emailResult = { sent: false, error: "RESEND_API_KEY not configured" };
  } else if (!lookup.email) {
    emailResult = { sent: false, error: "user has no email" };
  } else {
    const { subject, html } =
      status === "completed"
        ? buildCompletedEmail(lookup.topic, projectId, lookup.email)
        : buildFailedEmail(lookup.topic, projectId, lookup.email, errorMessage);

    try {
      await resend.emails.send({
        from: FROM,
        to: lookup.email,
        subject,
        html,
      });
      emailResult = { sent: true };
    } catch (e: any) {
      const msg = (e?.message ?? String(e)).slice(0, 300);
      console.error("[notify-book-completion] email send failed:", {
        userId,
        projectId,
        status,
        error: msg,
      });
      emailResult = { sent: false, error: msg };
    }
  }

  // ── 텔레그램 DM 발송 (베타, /write v3 Phase 4.4) ──
  let telegramResult: { sent: boolean; error?: string } | undefined;
  if (lookup.telegram_chat_id) {
    const { text, url, buttonText } = buildTelegramMessage(
      status,
      lookup.topic,
      projectId,
      errorMessage,
    );
    telegramResult = await sendTelegramDM({
      chatId: lookup.telegram_chat_id,
      text,
      inlineKeyboard: [[{ text: buttonText, url }]],
    });
    if (!telegramResult.sent) {
      console.warn("[notify-book-completion] telegram DM failed:", {
        userId,
        projectId,
        status,
        error: telegramResult.error,
      });
    }
  }

  return {
    sent: emailResult.sent || !!telegramResult?.sent,
    error: emailResult.error,
    telegram: telegramResult,
  };
}
