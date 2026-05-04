// Resend 기반 트랜잭셔널 메일 (영수증·환불 알림·구독자 새 책 알림)
import "server-only";
import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY ?? "missing");
  return _resend;
}
const FROM = process.env.EMAIL_FROM ?? "Tigerbookmaker <onboarding@resend.dev>";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const wrap = (title: string, body: string) => `
<!DOCTYPE html>
<html><body style="font-family:'Pretendard',system-ui,sans-serif;background:#f9fafb;padding:40px;">
  <div style="max-width:480px;margin:0 auto;background:white;border-radius:16px;padding:32px;border:1px solid #f0f0f0;">
    <div style="font-size:24px;margin-bottom:24px;">🐯 <strong>Tigerbookmaker</strong></div>
    <h1 style="font-size:22px;font-weight:900;margin:0 0 16px;">${title}</h1>
    ${body}
    <p style="color:#d1d5db;font-size:11px;margin-top:32px;border-top:1px solid #f0f0f0;padding-top:16px;">
      문의: cs@tigerbookmaker.com<br>
      <a href="https://tigerbookmaker.vercel.app" style="color:#f97316;text-decoration:none;">tigerbookmaker.vercel.app</a>
    </p>
  </div>
</body></html>`.trim();

export async function sendReceiptEmail(opts: {
  to: string;
  amount: number;
  bonus: number;
  totalCredit: number;
  newBalance: number;
  orderId: string;
  method?: string | null;
}) {
  const body = `
    <p style="color:#4b5563;margin:0 0 20px;">결제가 완료되었습니다. 감사합니다.</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr><td style="padding:8px 0;color:#6b7280;">결제 금액</td><td style="text-align:right;font-weight:700;">₩${opts.amount.toLocaleString()}</td></tr>
      ${opts.bonus > 0 ? `<tr><td style="padding:8px 0;color:#f97316;">보너스</td><td style="text-align:right;font-weight:700;color:#f97316;">+₩${opts.bonus.toLocaleString()}</td></tr>` : ""}
      <tr style="border-top:1px solid #f0f0f0;"><td style="padding:8px 0;font-weight:700;">충전 합계</td><td style="text-align:right;font-weight:900;">₩${opts.totalCredit.toLocaleString()}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280;">현재 잔액</td><td style="text-align:right;font-weight:700;color:#f97316;">₩${opts.newBalance.toLocaleString()}</td></tr>
    </table>
    <p style="color:#9ca3af;font-size:12px;margin:0 0 8px;">주문번호: ${opts.orderId}</p>
    ${opts.method ? `<p style="color:#9ca3af;font-size:12px;margin:0 0 20px;">결제 수단: ${opts.method}</p>` : ""}
    <p style="color:#6b7280;font-size:13px;margin:16px 0;">충전 후 7일 내 미사용 잔액은 100% 환불 가능합니다 (보너스 제외).</p>
  `;
  await getResend().emails.send({
    from: FROM, to: opts.to,
    subject: `[Tigerbookmaker] 결제 영수증 — ₩${opts.amount.toLocaleString()}`,
    html: wrap("결제 완료", body),
  });
}

// 구독자 새 책 알림 — Resend batch API로 100건씩 일괄 발송.
// 도메인 verify 안 된 환경에서는 onboarding@resend.dev로 자동 fallback (FROM env).
export async function sendNewBookNotifications(opts: {
  recipients: string[]; // 구독자 이메일 배열
  authorName: string;
  bookTopic: string;
  bookUrl: string;
  profileUrl: string | null;
  customMessage?: string;
}): Promise<{ sentCount: number; failedCount: number }> {
  if (opts.recipients.length === 0) return { sentCount: 0, failedCount: 0 };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sentCount: 0, failedCount: opts.recipients.length };

  const subject = `📖 ${opts.authorName} 새 책 — ${opts.bookTopic}`;
  const safeAuthor = escapeHtml(opts.authorName);
  const safeTopic = escapeHtml(opts.bookTopic);
  const safeMessage =
    typeof opts.customMessage === "string" && opts.customMessage.trim().length > 0
      ? escapeHtml(opts.customMessage.slice(0, 500))
      : "";

  const html = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,Segoe UI,sans-serif;background:#fafafa">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;padding:40px 20px">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#fff;border-radius:16px;border:1px solid #e5e7eb;padding:40px 32px">
        <tr><td>
          <div style="font-family:ui-monospace,monospace;font-size:11px;letter-spacing:0.2em;color:#f97316;text-transform:uppercase;font-weight:700;margin-bottom:12px">📖 새 책 출간</div>
          <h1 style="margin:0 0 8px;font-size:28px;font-weight:900;letter-spacing:-0.02em;color:#0a0a0a;line-height:1.15">${safeTopic}</h1>
          <p style="margin:0 0 20px;color:#6b7280;font-size:14px">by ${safeAuthor}</p>
          ${safeMessage ? `<p style="margin:24px 0;font-size:15px;line-height:1.65;color:#1a1a1a">${safeMessage}</p>` : ""}
          <a href="${opts.bookUrl}" style="display:inline-block;margin-top:24px;padding:14px 28px;background:#f97316;color:#fff;border-radius:10px;text-decoration:none;font-weight:800;font-size:15px">📖 책 보기 →</a>
          ${opts.profileUrl ? `<p style="margin-top:24px;font-size:13px;color:#9ca3af">또는 <a href="${opts.profileUrl}" style="color:#f97316;text-decoration:none">${safeAuthor}의 다른 책 보기</a></p>` : ""}
          <hr style="border:0;border-top:1px solid #e5e7eb;margin:32px 0">
          <p style="font-size:11px;color:#9ca3af;line-height:1.5">
            이 메일은 ${safeAuthor}님 작가 페이지에서 구독한 분께 발송됐습니다.<br>
            🐯 Tigerbookmaker 통해 전달됨.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  let sentCount = 0;
  let failedCount = 0;

  // Resend batch API: 한 번 호출에 최대 100건
  for (let i = 0; i < opts.recipients.length; i += 100) {
    const batch = opts.recipients.slice(i, i + 100);
    const payload = batch.map((to) => ({
      from: FROM,
      to,
      subject,
      html,
    }));
    try {
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) sentCount += batch.length;
      else failedCount += batch.length;
    } catch {
      failedCount += batch.length;
    }
  }

  return { sentCount, failedCount };
}

export async function sendRefundEmail(opts: {
  to: string;
  refundAmount: number;
  reason?: string;
  orderId: string;
}) {
  const body = `
    <p style="color:#4b5563;margin:0 0 20px;">환불이 처리되었습니다.</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr><td style="padding:8px 0;color:#6b7280;">환불 금액</td><td style="text-align:right;font-weight:900;">₩${opts.refundAmount.toLocaleString()}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280;">주문번호</td><td style="text-align:right;color:#9ca3af;font-size:12px;">${opts.orderId}</td></tr>
    </table>
    ${opts.reason ? `<p style="color:#6b7280;font-size:13px;">사유: ${opts.reason}</p>` : ""}
    <p style="color:#6b7280;font-size:13px;margin:16px 0;">결제 수단(카드)으로 영업일 기준 3~5일 내 환불 처리됩니다.</p>
  `;
  await getResend().emails.send({
    from: FROM, to: opts.to,
    subject: `[Tigerbookmaker] 환불 처리 완료 — ₩${opts.refundAmount.toLocaleString()}`,
    html: wrap("환불 처리 완료", body),
  });
}
