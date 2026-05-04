import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureReferralCode, getReferralStats } from "@/lib/server/referral";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.email) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  await ensureReferralCode(session.user.id, session.user.email);
  const stats = await getReferralStats(session.user.id);
  return NextResponse.json({ stats });
}
