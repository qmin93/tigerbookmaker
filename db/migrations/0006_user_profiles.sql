-- 0006_user_profiles.sql
-- 작가 프로필 (link-in-bio)

CREATE TABLE IF NOT EXISTS user_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  handle        TEXT NOT NULL UNIQUE,                       -- URL slug, lowercase, [a-z0-9_-]
  display_name  TEXT,                                        -- 표시명 (default: email prefix)
  avatar_url    TEXT,                                        -- 외부 이미지 URL or data: URL
  bio           TEXT,                                        -- 한두 문단 자기소개
  social_links  JSONB NOT NULL DEFAULT '[]'::jsonb,          -- [{ label, url }]
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user ON user_profiles(user_id);
-- handle은 UNIQUE constraint로 자동 인덱스됨

CREATE TRIGGER user_profiles_updated_at BEFORE UPDATE ON user_profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
