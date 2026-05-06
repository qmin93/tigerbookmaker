// 운영자(판매자) 본인 알림 — 결제·환불·기타 비즈니스 이벤트 즉시 푸시.
// 채널: ❶ 이메일(ADMIN_EMAILS, Resend) ❷ 텔레그램(TELEGRAM_BOT_TOKEN+TELEGRAM_OWNER_CHAT_ID)
// 두 채널 모두 try/catch — 알림 실패가 비즈니스 로직을 차단하지 않음.

import "server-only";
import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!_resend) _resend = new Resend(key);
  return _resend;
}

function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

function getTelegramConfig(): { token: string; chatId: string } | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_OWNER_CHAT_ID;
  if (!token || !chatId) return null;
  return { token, chatId };
}

const FROM = process.env.EMAIL_FROM ?? "Tigerbookmaker <onboarding@resend.dev>";

async function sendTelegram(text: string): Promise<void> {
  const cfg = getTelegramConfig();
  if (!cfg) return;
  const url = `https://api.telegram.org/bot${cfg.token}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: cfg.chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Telegram ${res.status}: ${body.slice(0, 200)}`);
  }
}

async function sendOwnerEmail(subject: string, html: string): Promise<void> {
  const resend = getResend();
  if (!resend) return;
  const admins = getAdminEmails();
  if (admins.length === 0) return;
  await resend.emails.send({
    from: FROM,
    to: admins,
    subject: `[운영 알림] ${subject}`,
    html,
  });
}

function escape(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ─── 공개 API ─────────────────────────────────────────

export interface PaymentNotifyArgs {
  amountKRW: number;
  bonusKRW: number;
  totalCreditKRW: number;
  newBalanceKRW: number;
  userEmail: string | null | undefined;
  userId: string;
  orderId: string;
  method?: string | null;
}

export async function notifyOwnerPayment(args: PaymentNotifyArgs): Promise<void> {
  const total = args.amountKRW + args.bonusKRW;
  const tgText =
    `💰 <b>새 결제</b>\n\n` +
    `금액: ₩${args.amountKRW.toLocaleString()}` +
    (args.bonusKRW > 0 ? ` (+ 보너스 ₩${args.bonusKRW.toLocaleString()} = ₩${total.toLocaleString()})` : "") +
    `\n사용자: ${args.userEmail ?? "(이메일 없음)"}` +
    `\n결제수단: ${args.method ?? "-"}` +
    `\n주문ID: <code>${args.orderId}</code>` +
    `\n잔액: ₩${args.newBalanceKRW.toLocaleString()}`;

  const html = `
    <div style="font-family:'Pretendard',system-ui,sans-serif;max-width:480px;">
      <h2 style="margin:0 0 16px;">💰 새 결제</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:#6b7280;">결제 금액</td><td style="text-align:right;font-weight:700;">₩${args.amountKRW.toLocaleString()}</td></tr>
        ${args.bonusKRW > 0 ? `<tr><td style="padding:6px 0;color:#f97316;">보너스</td><td style="text-align:right;font-weight:700;color:#f97316;">+₩${args.bonusKRW.toLocaleString()}</td></tr>` : ""}
        <tr><td style="padding:6px 0;color:#6b7280;">사용자</td><td style="text-align:right;">${escape(args.userEmail ?? "-")}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">결제수단</td><td style="text-align:right;">${escape(args.method ?? "-")}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">주문ID</td><td style="text-align:right;font-family:monospace;font-size:11px;">${escape(args.orderId)}</td></tr>
        <tr style="border-top:1px solid #f0f0f0;"><td style="padding:8px 0;color:#6b7280;">잔액</td><td style="text-align:right;font-weight:900;">₩${args.newBalanceKRW.toLocaleString()}</td></tr>
      </table>
    </div>
  `.trim();

  await Promise.allSettled([
    sendTelegram(tgText).catch(e => console.error("[notify-owner] telegram payment failed", e)),
    sendOwnerEmail(`💰 새 결제 ₩${args.amountKRW.toLocaleString()}`, html).catch(e => console.error("[notify-owner] email payment failed", e)),
  ]);
}

export interface RefundNotifyArgs {
  refundAmountKRW: number;
  bonusReclaimKRW: number;
  newBalanceKRW: number;
  userEmail: string | null | undefined;
  userId: string;
  orderId: string;
  reason?: string | null;
}

export async function notifyOwnerRefund(args: RefundNotifyArgs): Promise<void> {
  const tgText =
    `↩️ <b>환불 처리</b>\n\n` +
    `금액: ₩${args.refundAmountKRW.toLocaleString()}` +
    (args.bonusReclaimKRW > 0 ? ` (+ 보너스 회수 ₩${args.bonusReclaimKRW.toLocaleString()})` : "") +
    `\n사용자: ${args.userEmail ?? "(이메일 없음)"}` +
    `\n사유: ${args.reason ?? "고객 요청"}` +
    `\n주문ID: <code>${args.orderId}</code>` +
    `\n사용자 잔액: ₩${args.newBalanceKRW.toLocaleString()}`;

  const html = `
    <div style="font-family:'Pretendard',system-ui,sans-serif;max-width:480px;">
      <h2 style="margin:0 0 16px;">↩️ 환불 처리</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:#6b7280;">환불 금액</td><td style="text-align:right;font-weight:700;">₩${args.refundAmountKRW.toLocaleString()}</td></tr>
        ${args.bonusReclaimKRW > 0 ? `<tr><td style="padding:6px 0;color:#f97316;">보너스 회수</td><td style="text-align:right;font-weight:700;color:#f97316;">₩${args.bonusReclaimKRW.toLocaleString()}</td></tr>` : ""}
        <tr><td style="padding:6px 0;color:#6b7280;">사용자</td><td style="text-align:right;">${escape(args.userEmail ?? "-")}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">사유</td><td style="text-align:right;">${escape(args.reason ?? "고객 요청")}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">주문ID</td><td style="text-align:right;font-family:monospace;font-size:11px;">${escape(args.orderId)}</td></tr>
        <tr style="border-top:1px solid #f0f0f0;"><td style="padding:8px 0;color:#6b7280;">사용자 잔액</td><td style="text-align:right;font-weight:900;">₩${args.newBalanceKRW.toLocaleString()}</td></tr>
      </table>
    </div>
  `.trim();

  await Promise.allSettled([
    sendTelegram(tgText).catch(e => console.error("[notify-owner] telegram refund failed", e)),
    sendOwnerEmail(`↩️ 환불 ₩${args.refundAmountKRW.toLocaleString()}`, html).catch(e => console.error("[notify-owner] email refund failed", e)),
  ]);
}

// 자유 메시지 — 임시·디버그·기타 운영 알림용
export async function notifyOwnerCustom(subject: string, body: string): Promise<void> {
  const tgText = `🔔 <b>${escape(subject)}</b>\n\n${escape(body)}`;
  const html = `<div style="font-family:'Pretendard',system-ui,sans-serif;max-width:480px;"><h2>🔔 ${escape(subject)}</h2><pre style="white-space:pre-wrap;font-family:inherit;color:#374151;">${escape(body)}</pre></div>`;
  await Promise.allSettled([
    sendTelegram(tgText).catch(e => console.error("[notify-owner] custom telegram failed", e)),
    sendOwnerEmail(subject, html).catch(e => console.error("[notify-owner] custom email failed", e)),
  ]);
}
