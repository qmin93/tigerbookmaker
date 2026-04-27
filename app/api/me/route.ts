// GET /api/me — 현재 유저 정보 + 잔액 + 활성 티어
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUser } from "@/lib/server/db";
import { getAvailableTiers } from "@/lib/tiers";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const user = await getUser(session.user.id);
  if (!user) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
  return NextResponse.json({
    id: user.id,
    email: user.email,
    balance_krw: user.balance_krw,
    total_charged: user.total_charged,
    total_spent: user.total_spent,
    availableTiers: getAvailableTiers(),
  });
}
