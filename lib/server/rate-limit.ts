// 간단 in-memory rate limiter — 단일 Vercel 함수 인스턴스 한정
// 프로덕션 스케일 시 Upstash Redis로 교체 권장

import "server-only";

interface Bucket { count: number; resetAt: number }
const store = new Map<string, Bucket>();

/**
 * key 단위로 windowMs 안에 maxRequests 회 허용.
 * 초과 시 false 반환.
 */
export function rateLimit(key: string, maxRequests: number, windowMs: number): { ok: boolean; resetIn: number } {
  const now = Date.now();
  const bucket = store.get(key);
  if (!bucket || bucket.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, resetIn: windowMs };
  }
  if (bucket.count >= maxRequests) {
    return { ok: false, resetIn: bucket.resetAt - now };
  }
  bucket.count++;
  return { ok: true, resetIn: bucket.resetAt - now };
}

// ──────────────────────────────────────────
// 1회용 이메일 도메인 차단
// ──────────────────────────────────────────

const DISPOSABLE_DOMAINS = new Set([
  "10minutemail.com", "10minutemail.net", "tempmail.com", "tempmail.net",
  "throwaway.email", "throwawaymail.com", "guerrillamail.com", "guerrillamail.de",
  "guerrillamail.net", "guerrillamail.org", "mailinator.com", "yopmail.com",
  "yopmail.fr", "trashmail.com", "trashmail.net", "trash-mail.com",
  "getairmail.com", "dispostable.com", "fakeinbox.com", "tempinbox.com",
  "tempinbox.us", "mintemail.com", "mailcatch.com", "spam4.me",
  "sharklasers.com", "grr.la", "guerrillamailblock.com", "mohmal.com",
  "maildrop.cc", "harakirimail.com", "tempmailaddress.com", "fakemail.net",
  "tempmail.io", "tempr.email", "throwam.com", "wegwerfmail.de",
  "spambox.us", "incognitomail.org", "anonbox.net", "anonymbox.com",
  "mvrht.net", "mvrht.com", "fastacura.com", "fastchevy.com",
  "burnermail.io", "tutanota.com", "protonmail.com", "anonaddy.com",
  "33mail.com", "sneakemail.com", "instaaddr.com", "cs.email",
]);

export function isDisposableEmail(email: string): boolean {
  const domain = email.toLowerCase().split("@")[1];
  if (!domain) return false;
  return DISPOSABLE_DOMAINS.has(domain);
}
