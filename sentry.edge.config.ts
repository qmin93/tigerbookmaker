// Sentry Edge runtime — middleware 등 edge에서 동작.

import * as Sentry from "@sentry/nextjs";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? "development",
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
}
