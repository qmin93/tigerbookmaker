-- /write v3 Phase 3.3 — 첫 책 완성 보너스 (₩5,000)
-- spec: docs/superpowers/specs/2026-05-13-write-flow-v3-design.md §3.6
--
-- 사용자가 첫 책을 완성(export 트리거)하면 ₩5,000 추가 크레딧 자동 지급.
-- 1회 한정 — first_book_bonus_given flag로 어뷰징 방지.
--
-- 멱등 지급: UPDATE ... WHERE first_book_bonus_given = false RETURNING.
-- 동시 export 두 번 호출돼도 한쪽만 ₩5,000 지급된다.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS first_book_bonus_given boolean NOT NULL DEFAULT false;
