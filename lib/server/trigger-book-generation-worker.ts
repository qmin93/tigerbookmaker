// lib/server/trigger-book-generation-worker.ts
// 책 생성 큐 워커를 self-trigger (fire-and-forget HTTP fetch).
//
// cron 의존 제거: enqueue 직후, 그리고 워커 tick 종료 시점에 호출되어
// 큐가 남아있으면 즉시 다음 tick을 시작한다.
//
// Vercel Hobby 환경 — 책 1권 처리는 챕터별 60초 tick chain으로 진행.

import "server-only";

function resolveBaseUrl(): string | null {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return null;
}

/**
 * 책 생성 워커를 fire-and-forget로 트리거.
 * - 응답을 await하지 않음 (워커는 최대 60s 실행).
 * - 호출 실패는 log만, 호출자 흐름 막지 않음.
 * - base URL 못 찾으면 no-op (로컬 개발 환경 등).
 */
export function triggerBookGenerationWorker(): void {
  const baseUrl = resolveBaseUrl();
  if (!baseUrl) {
    console.warn("[trigger-book-generation-worker] no base URL; skipping self-trigger");
    return;
  }

  const headers: Record<string, string> = {};
  const secret = process.env.CRON_SECRET;
  if (secret) headers["Authorization"] = `Bearer ${secret}`;

  void fetch(`${baseUrl}/api/cron/book-generation-worker`, {
    method: "GET",
    headers,
    cache: "no-store",
  }).catch((e) => {
    console.error("[trigger-book-generation-worker] fetch failed:", e?.message ?? e);
  });
}
