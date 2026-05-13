// lib/server/telegram-notify.ts
// /write v3 Phase 4.4 — 텔레그램 봇으로 사용자 DM 전송 (베타).
// spec: docs/superpowers/specs/2026-05-13-write-flow-v3-design.md §3.3 + §7
//
// 호출처:
//  - lib/server/notify-book-completion.ts (책 완성·실패 시 이메일과 함께 발송)
//  - app/api/telegram/webhook/route.ts (연결 완료 confirmation 메시지)
//
// 정책:
//  - TELEGRAM_BOT_TOKEN 미설정 환경(dev/로컬)에선 조용히 skip — { sent: false, error: "token missing" }
//  - 어떤 실패도 throw 하지 않음 — best-effort.
//  - HTML parse_mode 사용. 호출자가 text를 HTML로 미리 escape 해 두는 것을 권장.

import "server-only";

const TELEGRAM_API = "https://api.telegram.org";

export interface SendTelegramOptions {
  chatId: string;
  /** HTML-formatted text. Caller is responsible for escaping. */
  text: string;
  /**
   * Optional inline keyboard. Each inner array is a row of buttons.
   * Only url-buttons are supported for now (no callback_data).
   */
  inlineKeyboard?: Array<Array<{ text: string; url: string }>>;
  /** Disable Telegram link preview (default true — completion DMs include a button instead). */
  disableWebPagePreview?: boolean;
}

export interface SendTelegramResult {
  sent: boolean;
  error?: string;
}

/**
 * 텔레그램 봇 sendMessage API 호출.
 *
 * @example
 * await sendTelegramDM({
 *   chatId: user.telegramChatId,
 *   text: `<b>${escapeHtml(topic)}</b> 책이 완성됐어요!`,
 *   inlineKeyboard: [[{ text: "📖 미리보기", url: previewUrl }]],
 * });
 */
export async function sendTelegramDM(
  opts: SendTelegramOptions,
): Promise<SendTelegramResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { sent: false, error: "TELEGRAM_BOT_TOKEN not configured" };
  }
  if (!opts.chatId) {
    return { sent: false, error: "chatId required" };
  }

  const body: Record<string, unknown> = {
    chat_id: opts.chatId,
    text: opts.text,
    parse_mode: "HTML",
    disable_web_page_preview: opts.disableWebPagePreview ?? true,
  };

  if (opts.inlineKeyboard && opts.inlineKeyboard.length > 0) {
    body.reply_markup = {
      inline_keyboard: opts.inlineKeyboard.map((row) =>
        row.map((b) => ({ text: b.text, url: b.url })),
      ),
    };
  }

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      const msg = `telegram sendMessage failed (${res.status}): ${errText.slice(0, 200)}`;
      console.error("[telegram-notify]", msg);
      return { sent: false, error: msg };
    }

    const data = (await res.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
    if (!data?.ok) {
      const msg = `telegram sendMessage returned ok=false: ${data?.description ?? "unknown"}`;
      console.error("[telegram-notify]", msg);
      return { sent: false, error: msg };
    }
    return { sent: true };
  } catch (e: any) {
    const msg = (e?.message ?? String(e)).slice(0, 300);
    console.error("[telegram-notify] fetch failed:", msg);
    return { sent: false, error: msg };
  }
}

/** HTML 이스케이프 — Telegram parse_mode=HTML 사용 시 사용자 입력은 반드시 escape. */
export function escapeTelegramHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
