// POST /api/payment/confirm
// Toss 결제 콜백 → 서버에서 paymentKey 검증 후 잔액 충전

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@vercel/postgres";
import { chargeBalance } from "@/lib/server/db";
import { sendReceiptEmail } from "@/lib/server/email";

export const runtime = "nodejs";

interface TossConfirmResponse {
  paymentKey: string;
  orderId: string;
  totalAmount: number;
  status: string;
  method?: string;
  approvedAt?: string;
  failure?: { code: string; message: string };
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const userId = session.user.id;

  const { paymentKey, orderId, amount } = await req.json().catch(() => ({}));
  if (!paymentKey || !orderId || !amount) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  // 1. orderId로 우리 DB의 pending 결제 조회
  const { rows } = await sql`
    SELECT id, user_id, amount_krw, bonus_krw, status
    FROM payments WHERE order_id = ${orderId}
  `;
  const payment = rows[0];
  if (!payment) return NextResponse.json({ error: "ORDER_NOT_FOUND" }, { status: 404 });
  if (payment.user_id !== userId) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (payment.status === "success") {
    return NextResponse.json({ error: "ALREADY_CONFIRMED" }, { status: 409 });
  }
  if (payment.amount_krw !== amount) {
    return NextResponse.json({ error: "AMOUNT_MISMATCH" }, { status: 400 });
  }

  // 2. Toss API로 결제 검증
  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) return NextResponse.json({ error: "TOSS_NOT_CONFIGURED" }, { status: 500 });

  const tossRes = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${Buffer.from(secretKey + ":").toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  });
  const tossData: TossConfirmResponse = await tossRes.json();

  if (!tossRes.ok || tossData.status !== "DONE") {
    await sql`
      UPDATE payments SET status = 'failed', fail_reason = ${tossData.failure?.message ?? "unknown"}
      WHERE id = ${payment.id}
    `;
    return NextResponse.json({
      error: "TOSS_CONFIRM_FAILED",
      message: tossData.failure?.message,
    }, { status: 502 });
  }

  // 3. 결제 성공 → DB 업데이트 + 잔액 충전
  await sql`
    UPDATE payments
    SET status = 'success',
        toss_key = ${tossData.paymentKey},
        method = ${tossData.method ?? null},
        confirmed_at = NOW()
    WHERE id = ${payment.id}
  `;

  const { newBalance } = await chargeBalance({
    userId,
    amountKRW: payment.amount_krw,
    bonusKRW: payment.bonus_krw,
    paymentId: payment.id,
  });

  // 영수증 메일 — 실패해도 결제 자체는 성공 처리 (메일 실패 ≠ 결제 실패)
  try {
    const userEmail = session.user?.email;
    if (userEmail) {
      await sendReceiptEmail({
        to: userEmail,
        amount: payment.amount_krw,
        bonus: payment.bonus_krw,
        totalCredit: payment.amount_krw + payment.bonus_krw,
        newBalance,
        orderId,
        method: tossData.method,
      });
    }
  } catch (e) {
    console.error("[confirm] receipt email failed", e);
  }

  return NextResponse.json({
    success: true,
    newBalance,
    charged: payment.amount_krw,
    bonus: payment.bonus_krw,
    totalCredit: payment.amount_krw + payment.bonus_krw,
  });
}
