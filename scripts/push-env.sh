#!/usr/bin/env bash
# Vercel에 환경변수 일괄 등록 (production + preview + development)
set -e
cd "$(dirname "$0")/.."

# 도메인 — 실제 Vercel 프로젝트 도메인
PROD_URL="https://tigerbookmaker.vercel.app"

push() {
  local NAME=$1
  local VALUE=$2
  for ENV in production preview development; do
    # 기존 값 삭제 (중복 방지) — 실패 무시
    npx vercel env rm "$NAME" "$ENV" --yes 2>/dev/null || true
    # 새 값 등록
    printf '%s' "$VALUE" | npx vercel env add "$NAME" "$ENV" >/dev/null 2>&1 \
      && echo "  ✓ $NAME [$ENV]" \
      || echo "  ✗ $NAME [$ENV] FAIL"
  done
}

# .env.local에서 값 추출
get() { grep -m1 "^$1=" .env.local | cut -d= -f2- | sed 's/^"//;s/"$//'; }

echo "→ Pushing 8 keys to Vercel (× 3 environments)"

# Auth secrets
push NEXTAUTH_SECRET "$(get NEXTAUTH_SECRET)"
push AUTH_SECRET "$(get AUTH_SECRET)"

# URLs — production은 vercel 도메인, dev는 localhost
push NEXTAUTH_URL "$PROD_URL"
push AUTH_URL "$PROD_URL"

# Email
push RESEND_API_KEY "$(get RESEND_API_KEY)"
push EMAIL_FROM "$(get EMAIL_FROM)"

# Toss (test mode)
push TOSS_CLIENT_KEY "$(get TOSS_CLIENT_KEY)"
push TOSS_SECRET_KEY "$(get TOSS_SECRET_KEY)"

# Gemini
push GEMINI_API_KEY "$(get GEMINI_API_KEY)"

echo "→ Done"
