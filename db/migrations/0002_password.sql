-- 비밀번호 로그인 지원 — bcrypt 해시 저장
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
