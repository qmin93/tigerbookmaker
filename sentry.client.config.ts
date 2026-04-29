// Sentry client-side — 브라우저에서 발생하는 에러 캡처.
// SENTRY_DSN 미설정 시 자동 비활성 (init 자체 X).

import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
    // 베타 단계 — 모든 에러 잡되 sample은 줄임
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,    // 세션 replay 비활성 (비용·트래픽)
    replaysOnErrorSampleRate: 1.0,  // 에러 발생 시에만 replay
    // 사용자 IP·이메일 자동 수집 X (privacy)
    sendDefaultPii: false,
    // 흔한 noise 무시
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "Non-Error promise rejection captured",
      "AbortError",  // 사용자 abort는 정상
    ],
  });
}
