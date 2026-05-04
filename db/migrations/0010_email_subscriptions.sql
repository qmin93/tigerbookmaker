-- 0010_email_subscriptions.sql
-- Wave 5 — 작가 프로필 이메일 구독 (독자 → 작가 새 책 알림)

CREATE TABLE IF NOT EXISTS email_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscriber_email TEXT NOT NULL,
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ,
  UNIQUE (author_user_id, subscriber_email)
);

CREATE INDEX IF NOT EXISTS idx_email_subs_author ON email_subscriptions(author_user_id);
