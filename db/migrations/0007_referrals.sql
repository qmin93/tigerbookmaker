-- 0007_referrals.sql
-- 추천 코드 + 추천 가입 추적

CREATE TABLE IF NOT EXISTS referral_codes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  code          TEXT NOT NULL UNIQUE,                       -- e.g. "qmin-x4z"
  total_referred INTEGER NOT NULL DEFAULT 0,
  total_credits_earned INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_codes_user ON referral_codes(user_id);

CREATE TABLE IF NOT EXISTS referral_signups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  code            TEXT NOT NULL,
  credit_amount   INTEGER NOT NULL DEFAULT 2000,
  awarded_at      TIMESTAMPTZ,             -- NULL이면 미지급 (이메일 미인증 등)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_signups_referrer ON referral_signups(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_signups_referred ON referral_signups(referred_user_id);
