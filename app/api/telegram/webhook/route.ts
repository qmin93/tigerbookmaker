// POST /api/telegram/webhook
// /write v3 Phase 4.4 — 텔레그램 봇 업데이트 수신 (베타).
// spec: docs/superpowers/specs/2026-05-13-write-flow-v3-design.md §3.3 + §7
//
// BotFather에서 setWebhook 으로 한 번만 설정:
//   https://<프로덕션-도메인>/api/telegram/webhook?secret=<TELEGRAM_WEBHOOK_SECRET>
//
// 처리하는 메시지:
//  - "/start"             → 환영 메시지 + 연결 방법 안내
//  - "/start <token>"     → /link 와 동일 처리 (botUrl deeplink 흐름)
//  - "/link <token>"      → 토큰으로 사용자 매칭 → chat_id 저장 → 확인 메시지
//  - 그 외 메시지         → 무시 (200 OK 반환해 텔레그램 재시도 방지)
//
// 보안:
//  - TELEGRAM_WEBHOOK_SECRET 환경변수가 설정돼 있으면 query param 또는
//    "x-telegram-bot-api-secret-token" header 둘 중 하나가 일치해야 함.
//  - 미설정 환경(dev) 에선 검증 skip.
//
// 어떤 실패도 사용자에 노출하지 않음 — 항상 200 OK + 빈 응답으로
// 텔레그램 측 재시도 폭주를 막는다. 실패는 console.error 로만 기록.

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { sendTelegramDM, escapeTelegramHtml } from "@/lib/server/telegram-notify";

export const runtime = "nodejs";
// 텔레그램 webhook은 절대 캐시되면 안 됨.
export const dynamic = "force-dynamic";

const SITE = "https://tigerbookmaker.vercel.app";
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME ?? "tigerbookmaker_bot";

interface TelegramUpdate {
  update_id?: number;
  message?: {
    message_id?: number;
    from?: {
      id: number;
      username?: string;
      first_name?: string;
    };
    chat?: {
      id: number;
      type?: string;
    };
    text?: string;
  };
}

function verifySecret(req: NextRequest): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return true; // dev / 미설정 환경
  const headerSecret = req.headers.get("x-telegram-bot-api-secret-token");
  const querySecret = req.nextUrl.searchParams.get("secret");
  return headerSecret === expected || querySecret === expected;
}

async function replyToChat(chatId: number, html: string): Promise<void> {
  await sendTelegramDM({ chatId: String(chatId), text: html });
}

async function handleLinkToken(
  token: string,
  chatId: number,
  fromName: string,
): Promise<void> {
  if (!token || token.length < 8 || token.length > 128) {
    await replyToChat(
      chatId,
      "올바르지 않은 연결 코드입니다. <a href=\"" +
        SITE +
        "/profile\">프로필 페이지</a>에서 새 코드를 받아주세요.",
    );
    return;
  }

  let updated: { id: string } | undefined;
  try {
    const { rows } = await sql<{ id: string }>`
      UPDATE users
      SET telegram_chat_id = ${String(chatId)},
          telegram_linked_at = NOW(),
          telegram_link_token = NULL
      WHERE telegram_link_token = ${token}
      RETURNING id
    `;
    updated = rows[0];
  } catch (e: any) {
    const msg = (e?.message ?? String(e)).slice(0, 200);
    console.error("[telegram/webhook] link DB update failed:", msg);
    await replyToChat(chatId, "일시적인 오류로 연결에 실패했습니다. 잠시 후 다시 시도해주세요.");
    return;
  }

  if (!updated) {
    await replyToChat(
      chatId,
      "연결 코드가 만료됐거나 잘못됐습니다. <a href=\"" +
        SITE +
        "/profile\">프로필 페이지</a>에서 새 코드를 받아주세요.",
    );
    return;
  }

  const safeName = escapeTelegramHtml(fromName || "작가님");
  await replyToChat(
    chatId,
    `<b>✓ 연결 완료</b>\n\n${safeName}, 이제 책 완성 시 여기로 알림을 보내드릴게요. 🐯\n\n언제든 <a href="${SITE}/profile">프로필 페이지</a>에서 연결을 해제할 수 있습니다.`,
  );
}

async function handleStart(chatId: number, payload: string | null): Promise<void> {
  if (payload) {
    // /start <token> → deeplink 흐름 (botUrl 형식)
    await handleLinkToken(payload, chatId, "");
    return;
  }
  await replyToChat(
    chatId,
    `<b>🐯 Tigerbookmaker 알림 봇</b>\n\n` +
      `책 생성이 완료되면 여기로 알려드립니다.\n\n` +
      `<b>연결 방법</b>\n` +
      `1. <a href="${SITE}/profile">tigerbookmaker.vercel.app/profile</a> 접속\n` +
      `2. "텔레그램 연결하기" 버튼 클릭\n` +
      `3. 받은 코드를 <code>/link &lt;코드&gt;</code> 형식으로 여기 보내주세요`,
  );
}

export async function POST(req: NextRequest) {
  if (!verifySecret(req)) {
    console.warn("[telegram/webhook] secret mismatch");
    // 텔레그램에는 항상 200을 주되, 실제로는 무시.
    return NextResponse.json({ ok: true });
  }

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const msg = update.message;
  if (!msg || !msg.chat || !msg.text) {
    return NextResponse.json({ ok: true });
  }

  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const fromName = msg.from?.first_name ?? msg.from?.username ?? "";

  try {
    if (text === "/start") {
      await handleStart(chatId, null);
    } else if (text.startsWith("/start ")) {
      const payload = text.slice("/start ".length).trim();
      await handleStart(chatId, payload || null);
    } else if (text.startsWith("/link ")) {
      const token = text.slice("/link ".length).trim();
      await handleLinkToken(token, chatId, fromName);
    } else if (text === "/link") {
      await replyToChat(
        chatId,
        `사용법: <code>/link &lt;코드&gt;</code>\n\n프로필 페이지에서 연결 코드를 받아주세요: ${SITE}/profile`,
      );
    }
    // 그 외 메시지는 무시
  } catch (e: any) {
    const errMsg = (e?.message ?? String(e)).slice(0, 200);
    console.error("[telegram/webhook] handler failed:", errMsg);
    // 사용자에 노출하지 않음
  }

  return NextResponse.json({ ok: true });
}

// GET: webhook 등록 확인용 (BotFather setWebhook 후 health check).
export async function GET(req: NextRequest) {
  if (!verifySecret(req)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  return NextResponse.json({
    ok: true,
    bot: BOT_USERNAME,
    note: "Telegram webhook endpoint ready. POST updates here.",
  });
}
