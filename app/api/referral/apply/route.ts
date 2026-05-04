// POST /api/referral/apply
// body: { code }
// 호출: 가입 직후 client에서 (cookie/localStorage에 저장된 추천 코드로)

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getReferrerByCode, recordReferralSignup, awardReferralCredits } from "@/lib/server/referral";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { code } = await req.json().catch(() => ({}));
  if (!code || typeof code !== "string") return NextResponse.json({ error: "INVALID_CODE" }, { status: 400 });

  const referrerUserId = await getReferrerByCode(code);
  if (!referrerUserId) return NextResponse.json({ error: "CODE_NOT_FOUND" }, { status: 404 });
  if (referrerUserId === session.user.id) {
    return NextResponse.json({ error: "SELF_REFERRAL" }, { status: 400 });
  }

  await recordReferralSignup({
    referrerUserId,
    referredUserId: session.user.id,
    code,
  });

  const result = await awardReferralCredits(session.user.id);
  return NextResponse.json({ ok: true, ...result });
}
