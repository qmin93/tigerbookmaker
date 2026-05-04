// POST /api/profile/notify-subscribers
// body: { bookId: string, message?: string }
// 본인 구독자 모두에게 새 책 알림 이메일 발송 (Resend batch).
// 응답: { ok, sentCount, failedCount, total }

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@vercel/postgres";
import { isEmailConfigured, sendNewBookNotifications } from "@/lib/server/email";

export const runtime = "nodejs";
export const maxDuration = 30;

const SUBSCRIBER_HARD_CAP = 1000;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await req.json().catch(() => ({} as any));
  const bookId = typeof body?.bookId === "string" ? body.bookId : null;
  const message = typeof body?.message === "string" ? body.message : "";
  if (!bookId) {
    return NextResponse.json({ error: "INVALID_INPUT", message: "bookId 필수" }, { status: 400 });
  }

  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: "EMAIL_NOT_CONFIGURED", message: "메일 발송 미설정 (관리자 문의)" },
      { status: 503 },
    );
  }

  // 책 ownership + share 상태 확인
  const { rows: bookRows } = await sql<{ id: string; topic: string; data: any; user_id: string }>`
    SELECT id, topic, data, user_id FROM book_projects WHERE id = ${bookId}
  `;
  const book = bookRows[0];
  if (!book || book.user_id !== userId) {
    return NextResponse.json({ error: "NOT_FOUND", message: "책을 찾을 수 없습니다." }, { status: 404 });
  }
  if (book.data?.shareEnabled !== true) {
    return NextResponse.json(
      { error: "BOOK_NOT_SHARED", message: "공유 활성화 후 발송 가능합니다." },
      { status: 400 },
    );
  }

  // 활성 구독자 가져오기
  const { rows: subscribers } = await sql<{ subscriber_email: string }>`
    SELECT subscriber_email FROM email_subscriptions
    WHERE author_user_id = ${userId} AND unsubscribed_at IS NULL
    LIMIT ${SUBSCRIBER_HARD_CAP}
  `;

  if (subscribers.length === 0) {
    return NextResponse.json({
      ok: true,
      sentCount: 0,
      failedCount: 0,
      total: 0,
      note: "구독자가 없습니다.",
    });
  }

  // 작가 정보 (handle / displayName)
  const { rows: profileRows } = await sql<{ handle: string | null; display_name: string | null }>`
    SELECT handle, display_name FROM user_profiles WHERE user_id = ${userId}
  `;
  const profile = profileRows[0];
  const authorName = profile?.display_name ?? profile?.handle ?? "작가";

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://tigerbookmaker.vercel.app";
  const bookUrl = `${baseUrl}/book/${bookId}`;
  const profileUrl = profile?.handle ? `${baseUrl}/u/${profile.handle}` : null;

  const { sentCount, failedCount } = await sendNewBookNotifications({
    recipients: subscribers.map((s) => s.subscriber_email),
    authorName,
    bookTopic: book.topic,
    bookUrl,
    profileUrl,
    customMessage: message,
  });

  return NextResponse.json({
    ok: true,
    sentCount,
    failedCount,
    total: subscribers.length,
  });
}
