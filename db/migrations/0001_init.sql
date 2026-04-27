-- Tigerbookmaker 초기 스키마
-- 작성일: 2026-04-24
-- 관련: docs/tigerbookmaker/2026-04-24-web-architecture.md

-- gen_random_uuid() 사용을 위한 익스텐션 (Vercel Postgres에는 보통 활성화돼 있음)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. NextAuth 표준 테이블 (Auth.js v5 Drizzle adapter 호환)
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT UNIQUE NOT NULL,
  email_verified  TIMESTAMPTZ,
  name            TEXT,
  image           TEXT,
  -- 우리 비즈니스 필드
  balance_krw     INTEGER NOT NULL DEFAULT 0,
  total_charged   INTEGER NOT NULL DEFAULT 0,
  total_spent     INTEGER NOT NULL DEFAULT 0,
  signup_bonus_given BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                TEXT NOT NULL,
  provider            TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  refresh_token       TEXT,
  access_token        TEXT,
  expires_at          BIGINT,
  token_type          TEXT,
  scope               TEXT,
  id_token            TEXT,
  session_state       TEXT,
  UNIQUE (provider, provider_account_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token TEXT UNIQUE NOT NULL,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires       TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier TEXT NOT NULL,
  token      TEXT NOT NULL,
  expires    TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (identifier, token)
);

-- ============================================================
-- 2. 결제 (Toss Payments)
-- ============================================================

CREATE TYPE payment_status AS ENUM ('pending', 'success', 'failed', 'refunded');

CREATE TABLE IF NOT EXISTS payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id),
  toss_key      TEXT UNIQUE,                          -- Toss paymentKey (성공 후 채워짐)
  order_id      TEXT UNIQUE NOT NULL,                 -- 우리가 발급, Toss로 보냄
  amount_krw    INTEGER NOT NULL CHECK (amount_krw > 0),
  bonus_krw     INTEGER NOT NULL DEFAULT 0 CHECK (bonus_krw >= 0),
  status        payment_status NOT NULL DEFAULT 'pending',
  method        TEXT,                                 -- 'CARD' | 'KAKAOPAY' | 'NAVERPAY' etc
  fail_reason   TEXT,
  refunded_at   TIMESTAMPTZ,
  refund_amount INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at  TIMESTAMPTZ
);

CREATE INDEX idx_payments_user ON payments (user_id, created_at DESC);
CREATE INDEX idx_payments_status ON payments (status) WHERE status = 'pending';

-- ============================================================
-- 3. AI 호출 사용 로그
-- ============================================================

CREATE TYPE task_type AS ENUM ('toc', 'chapter', 'edit', 'batch');

CREATE TABLE IF NOT EXISTS ai_usage (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  task            task_type NOT NULL,
  model           TEXT NOT NULL,                     -- 'gemini-2.5-flash' | 'gemini-2.5-pro' | 'claude-sonnet-4-6'
  input_tokens    INTEGER NOT NULL DEFAULT 0,
  output_tokens   INTEGER NOT NULL DEFAULT 0,
  thoughts_tokens INTEGER NOT NULL DEFAULT 0,        -- Gemini thinking
  cache_read_tokens   INTEGER NOT NULL DEFAULT 0,
  cache_write_tokens  INTEGER NOT NULL DEFAULT 0,
  cost_usd        DECIMAL(10, 6) NOT NULL,
  cost_krw        INTEGER NOT NULL,                  -- 환율 적용 후
  duration_ms     INTEGER,
  project_id      UUID,
  chapter_idx     INTEGER,
  status          TEXT NOT NULL DEFAULT 'success',   -- 'success' | 'failed'
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usage_user ON ai_usage (user_id, created_at DESC);
CREATE INDEX idx_usage_project ON ai_usage (project_id, chapter_idx);

-- ============================================================
-- 4. 책 프로젝트
-- ============================================================

CREATE TABLE IF NOT EXISTS book_projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic         TEXT NOT NULL,
  audience      TEXT,
  type          TEXT,                                -- '실용서' | '자기계발서' | '에세이' | '매뉴얼'
  target_pages  INTEGER NOT NULL DEFAULT 120,
  data          JSONB NOT NULL,                      -- chapters, images, settings 전체
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_user ON book_projects (user_id, updated_at DESC);

-- ============================================================
-- 5. 잔액 변동 트랜잭션 로그 (감사용 — 디버깅·환불 분쟁 시)
-- ============================================================

CREATE TYPE balance_tx_type AS ENUM ('charge', 'spend', 'refund', 'bonus', 'manual_adjust');

CREATE TABLE IF NOT EXISTS balance_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id),
  type          balance_tx_type NOT NULL,
  amount_krw    INTEGER NOT NULL,                    -- 양수=증가, 음수=차감
  balance_after INTEGER NOT NULL,                    -- 트랜잭션 후 잔액
  payment_id    UUID REFERENCES payments(id),        -- charge/refund 시
  ai_usage_id   UUID REFERENCES ai_usage(id),        -- spend 시
  reason        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_balance_tx_user ON balance_transactions (user_id, created_at DESC);

-- ============================================================
-- 6. 트리거: updated_at 자동 갱신
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER projects_updated_at BEFORE UPDATE ON book_projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
