-- 0009_analytics.sql
-- Wave 5 — 페이지 방문 추적 (book / profile)
-- 24h 내 동일 visitor_hash 중복 방지는 application 레벨에서 처리 (track route)

CREATE TABLE IF NOT EXISTS page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_type TEXT NOT NULL CHECK (page_type IN ('book', 'profile')),
  page_id TEXT NOT NULL,                   -- book id (uuid) or profile handle
  visitor_hash TEXT,                       -- IP+UA hash for dedupe
  visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_page_views_lookup ON page_views(page_type, page_id);
CREATE INDEX IF NOT EXISTS idx_page_views_dedupe ON page_views(page_type, page_id, visitor_hash);
CREATE INDEX IF NOT EXISTS idx_page_views_visited_at ON page_views(visited_at);
