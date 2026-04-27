// POST /api/payment/prepare — Toss 결제 시작 전 orderId 발급
// 응답값으로 클라이언트가 Toss 결제 위젯 호출

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@vercel/postgres";
import { rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

// 충전 단위 — balance-shortfall-decision.md 정책 반영
const VALID_AMOUNTS = new Set([1000, 5000, 10000, 30000, 50000]);

function calcBonus(amountKRW: number): number {
  if (amountKRW >= 50000) return Math.floor(amountKRW * 0.10);
  if (amountKRW >= 30000) return Math.floor(amountKRW * 0.05);
  return 0;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const userId = session.user.id;

  // 결제 시도 어뷰즈 방지 — 분당 5회
  const rl = rateLimit(`pay:${userId}`, 5, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "RATE_LIMITED", resetIn: rl.resetIn }, { status: 429 });

  const { amount } = await req.json().catch(() => ({}));
  if (typeof amount !== "number" || !VALID_AMOUNTS.has(amount)) {
    return NextResponse.json({
      error: "INVALID_AMOUNT",
      message: "충전 단위: 1,000 / 5,000 / 10,000 / 30,000 / 50,000 원만 가능"
    }, { status: 400 });
  }

  const orderId = `tigbk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const bonusKRW = calcBonus(amount);

  await sql`
    INSERT INTO payments (user_id, order_id, amount_krw, bonus_krw, status)
    VALUES (${userId}, ${orderId}, ${amount}, ${bonusKRW}, 'pending')
  `;

  return NextResponse.json({
    orderId,
    amount,
    bonusKRW,
    totalCredit: amount + bonusKRW,
    clientKey: process.env.TOSS_CLIENT_KEY,
    successUrl: `${process.env.NEXTAUTH_URL}/billing/success`,
    failUrl: `${process.env.NEXTAUTH_URL}/billing/fail`,
  });
}
