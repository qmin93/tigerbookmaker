-- Wave 2: 독자 후기·이메일 구독·자동 시퀀스
-- (#5 reviews + #17 subscribers + #8 sequences)

-- 독자 후기 (#5)
CREATE TABLE IF NOT EXISTS book_reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id     UUID NOT NULL REFERENCES book_projects(id) ON DELETE CASCADE,
  reader_name VARCHAR(50)  NOT NULL,
  reader_email VARCHAR(255),
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT NOT NULL CHECK (length(comment) BETWEEN 10 AND 2000),
  status      VARCHAR(20) NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'approved', 'rejected', 'spam')),
  ip_hash     VARCHAR(64),  -- 어뷰즈 차단용
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_book_reviews_book_status ON book_reviews(book_id, status);
CREATE INDEX IF NOT EXISTS idx_book_reviews_pending ON book_reviews(status) WHERE status = 'pending';

-- 독자 구독·이메일 (#17 무료 1장 미리보기 + #8 시퀀스 트리거)
CREATE TABLE IF NOT EXISTS book_subscribers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id     UUID NOT NULL REFERENCES book_projects(id) ON DELETE CASCADE,
  email       VARCHAR(255) NOT NULL,
  source      VARCHAR(40) NOT NULL DEFAULT 'preview',
              -- preview(1장 미리보기) / buyer(구매자) / manual(작가가 직접 추가)
  unsubscribed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(book_id, email)
);

CREATE INDEX IF NOT EXISTS idx_book_subscribers_book ON book_subscribers(book_id);

-- 자동 이메일 시퀀스 상태 (#8) — 각 구독자별로 어느 step까지 진행됐나
CREATE TABLE IF NOT EXISTS email_sequence_state (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID NOT NULL REFERENCES book_subscribers(id) ON DELETE CASCADE,
  sequence_type VARCHAR(40) NOT NULL DEFAULT 'preview_followup',
                -- preview_followup (1장 받은 후 7일 시퀀스)
                -- buyer_thanks (구매자 7일 시퀀스 — 추후)
  current_step  SMALLINT NOT NULL DEFAULT 0,    -- 다음 보낼 step (0이면 step 1 발송)
  next_send_at  TIMESTAMPTZ NOT NULL,
  completed_at  TIMESTAMPTZ,
  failed_at     TIMESTAMPTZ,
  fail_reason   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(subscriber_id, sequence_type)
);

CREATE INDEX IF NOT EXISTS idx_email_sequence_due ON email_sequence_state(next_send_at)
  WHERE completed_at IS NULL AND failed_at IS NULL;
