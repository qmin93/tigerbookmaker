-- 0016_telegram_link.sql
-- /write v3 Phase 4.4 — 텔레그램 봇 알림 연동 (베타).
-- spec: docs/superpowers/specs/2026-05-13-write-flow-v3-design.md §3.3 + §7
--
-- 정식 카톡 알림톡은 사업자 인증 필요 → 베타 단계엔 텔레그램 봇으로 대체.
-- 컬럼:
--  - telegram_chat_id: 사용자가 봇과 연결 완료 후 저장되는 텔레그램 user id (DM 채널 id).
--  - telegram_linked_at: 연결 완료 시각.
--  - telegram_link_token: /api/profile/telegram/link 로 발급된 1회용 토큰.
--    봇이 /link <token> 메시지를 받으면 매칭 후 chat_id 저장 + 토큰 삭제.
--
-- 부분 인덱스로 NULL 토큰 행은 인덱스에서 제외.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS telegram_chat_id text,
  ADD COLUMN IF NOT EXISTS telegram_linked_at timestamptz,
  ADD COLUMN IF NOT EXISTS telegram_link_token text;

CREATE INDEX IF NOT EXISTS idx_users_telegram_link_token
  ON users(telegram_link_token)
  WHERE telegram_link_token IS NOT NULL;
