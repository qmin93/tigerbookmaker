// Resend 기반 트랜잭셔널 메일 (영수증·환불 알림)
import "server-only";
import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY ?? "missing");
  return _resend;
}
const FROM = process.env.EMAIL_FROM ?? "Tigerbookmaker <onboarding@resend.dev>";

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
