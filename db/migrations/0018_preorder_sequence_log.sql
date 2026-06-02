-- 0018_preorder_sequence_log.sql
-- 사전예약자 5일 소프트오페라 이메일 시퀀스 발송 이력
-- (preorder_id, step) UNIQUE로 중복 발송 방지.

CREATE TABLE IF NOT EXISTS preorder_sequence_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preorder_id UUID NOT NULL REFERENCES preorders(id) ON DELETE CASCADE,
  step INTEGER NOT NULL,         -- 0 (즉시), 1..5 (Day N)
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  failed_at TIMESTAMPTZ,
  fail_reason TEXT,
  UNIQUE (preorder_id, step)
);

CREATE INDEX IF NOT EXISTS idx_preorder_seq_log_preorder ON preorder_sequence_log(preorder_id);
CREATE INDEX IF NOT EXISTS idx_preorder_seq_log_sent ON preorder_sequence_log(sent_at DESC);
