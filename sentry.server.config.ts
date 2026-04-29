// Sentry server-side — Node.js (API routes, server components) 에러 캡처.

import * as Sentry from "@sentry/nextjs";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? "development",
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    ignoreErrors: [
      "AbortError",
      "잔액 부족",  // 비즈니스 로직 — 에러 X
      "UNAUTHORIZED",
    ],
  });
}
