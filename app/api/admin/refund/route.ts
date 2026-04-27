// POST /api/admin/refund — 관리자가 결제 환불 처리
// 인증: ADMIN_EMAILS 환경변수 (콤마 구분) 안에 본인 이메일 있어야 함

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@vercel/postgres";
import { sendRefundEmail } from "@/lib/server/email";

export const runtime = "nodejs";

function isAdmin(email?: string | null): boolean {
  const list = (process.env.ADMIN_EMAILS ?? "").split(",").map(s => s.trim().toLowerCase());
  return !!email && list.includes(email.toLowerCase());
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { orderId, refundAmountKRW, reason } = await req.json().catch(() => ({}));
  if (!orderId || typeof refundAmountKRW !== "number" || refundAmountKRW <= 0) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  // 1. 결제 조회
  const { rows: paymentRows } = await sql`
    SELECT p.id, p.user_id, p.toss_key, p.amount_krw, p.bonus_krw, p.status, p.refund_amount,
           p.created_at, u.email AS user_email
    FROM payments p
    JOIN users u ON u.id = p.user_id
    WHERE p.order_id = ${orderId}
  `;
  const payment = paymentRows[0];
  if (!payment) return NextResponse.json({ error: "ORDER_NOT_FOUND" }, { status: 404 });
  if (payment.status === "refunded") return NextResponse.json({ error: "ALREADY_REFUNDED" }, { status: 409 });
  if (payment.status !== "success") return NextResponse.json({ error: "NOT_SUCCESS" }, { status: 409 });
  if (refundAmountKRW > payment.amount_krw) {
    return NextResponse.json({ error: "AMOUNT_EXCEEDS" }, { status: 400 });
  }

  // 2. Toss 환불 API
  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey || !payment.toss_key) {
    return NextResponse.json({ error: "TOSS_NOT_CONFIGURED" }, { status: 500 });
  }
  const tossRes = await fetch(`https://api.tosspayments.com/v1/payments/${payment.toss_key}/cancel`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${Buffer.from(secretKey + ":").toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      cancelReason: reason ?? "고객 요청 환불",
      cancelAmount: refundAmountKRW,
    }),
  });
  const tossData = await tossRes.json();
  if (!tossRes.ok) {
    console.error("[refund] Toss cancel failed", tossData);
    return NextResponse.json({ error: "TOSS_REFUND_FAILED", details: tossData }, { status: 502 });
  }

  // 3. DB 업데이트 + 잔액 차감 (보너스는 우리가 회수)
  // 잔액에서 환불액 + 보너스 비례분 차감 (금액 비례)
  const ratio = refundAmountKRW / payment.amount_krw;
  const bonusReclaim = Math.floor(payment.bonus_krw * ratio);
  const totalDeduct = refundAmountKRW + bonusReclaim;

  // 잔액 부족할 수 있음 — 음수 허용 (관리자 판단)
  const { rows: userRows } = await sql<{ balance_krw: number }>`
    UPDATE users SET balance_krw = balance_krw - ${totalDeduct}, updated_at = NOW()
    WHERE id = ${payment.user_id}
    RETURNING balance_krw
  `;
  const newBalance = userRows[0].balance_krw;

  await sql`
    UPDATE payments
    SET status = 'refunded',
        refunded_at = NOW(),
        refund_amount = ${refundAmountKRW}
    WHERE id = ${payment.id}
  `;

  await sql`
    INSERT INTO balance_transactions (user_id, type, amount_krw, balance_after, payment_id, reason)
    VALUES (${payment.user_id}, 'refund', ${-totalDeduct}, ${newBalance}, ${payment.id},
            ${`환불: ${reason ?? "고객 요청"} (원금 ${refundAmountKRW.toLocaleString()}원 + 보너스 ${bonusReclaim.toLocaleString()}원 회수)`})
  `;

  // 4. 환불 알림 메일
  try {
    await sendRefundEmail({
      to: payment.user_email,
      refundAmount: refundAmountKRW,
      reason: reason ?? "고객 요청",
      orderId,
    });
  } catch (e) {
    console.error("[refund] email failed", e);
  }

  return NextResponse.json({
    success: true,
    refunded: refundAmountKRW,
    bonusReclaimed: bonusReclaim,
    newUserBalance: newBalance,
  });
}
