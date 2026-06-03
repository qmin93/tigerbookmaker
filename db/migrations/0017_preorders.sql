-- 0017_preorders.sql
-- Week 1 진단 — 리드 스퀴즈 랜딩 사전예약 (research/day1 가치 사다리 층 1 미끼 측정)
-- 신규 유저 가입 없이 이메일 + ICP 시그널 + 입금의향 수집.

CREATE TABLE IF NOT EXISTS preorders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  icp_signal TEXT,                              -- 'kmong_seller' | 'side_writer' | 'coach' | 'other' | NULL
  intent TEXT NOT NULL,                         -- 'preorder' | 'paid_intent'
  amount_won INTEGER,                           -- 입금의향 금액 (paid_intent일 때만)
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  visitor_hash TEXT,                            -- IP+UA 해시 (analytics와 동일 방식, 32자)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_preorders_created ON preorders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_preorders_email ON preorders(email);
CREATE INDEX IF NOT EXISTS idx_preorders_intent ON preorders(intent);
