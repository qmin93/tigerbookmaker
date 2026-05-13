-- 0014_email_notifications_pref.sql
-- v3 Phase 1.4 — 책 생성 완료 이메일 알림 옵트아웃 플래그.
--
-- 트랜잭셔널 이메일(영수증·환불)은 이 플래그와 무관하게 항상 발송.
-- 본 플래그는 책 생성 완료 등 알림성 이메일에만 적용된다.
-- 기본값 true → 기존 사용자도 자동 수신.
--
-- UI 토글은 별도 PR에서 추가 예정 (이 마이그레이션은 컬럼만 도입).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE;
