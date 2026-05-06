// POST /api/admin/test-notify — 운영자 본인 알림 채널 점검용 (1회 발송)
// 인증: ADMIN_EMAILS 환경변수 안에 본인 이메일 있어야 함
// 사용: curl -X POST https://...vercel.app/api/admin/test-notify (로그인 세션 필요)

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { notifyOwnerCustom } from "@/lib/server/notify-owner";

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

  const channels = {
    telegram: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_OWNER_CHAT_ID),
    email: !!(process.env.RESEND_API_KEY && process.env.ADMIN_EMAILS),
  };

  await notifyOwnerCustom(
    "알림 점검",
    `Tigerbookmaker 운영자 알림 채널 테스트입니다.\n\n` +
    `시각: ${new Date().toISOString()}\n` +
    `텔레그램: ${channels.telegram ? "✅ 설정됨" : "❌ 미설정 (TELEGRAM_BOT_TOKEN/CHAT_ID)"}\n` +
    `이메일: ${channels.email ? "✅ 설정됨" : "❌ 미설정 (RESEND_API_KEY/ADMIN_EMAILS)"}`
  );

  return NextResponse.json({
    success: true,
    channels,
    message: "알림 발송 시도 완료. 텔레그램·이메일 확인하세요.",
  });
}
