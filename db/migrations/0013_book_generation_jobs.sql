-- /write v3 Phase 1.3 — 백그라운드 본문 생성 큐
-- spec: docs/superpowers/specs/2026-05-13-write-flow-v3-design.md §3.3
--
-- 사용자가 "본문 생성 시작" 클릭 → 즉시 큐 항목 생성 + 응답.
-- /api/cron/book-generation-worker가 매분 1회 SKIP LOCKED로 큐 항목을 집어 처리.

CREATE TABLE IF NOT EXISTS book_generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES book_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued',
  current_chapter_idx integer NOT NULL DEFAULT 0,
  total_chapters integer NOT NULL,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  completed_at timestamptz,
  CONSTRAINT valid_status CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_book_generation_jobs_status_user
  ON book_generation_jobs(status, user_id);

CREATE INDEX IF NOT EXISTS idx_book_generation_jobs_project
  ON book_generation_jobs(project_id);

-- 워커 SKIP LOCKED 효율을 위한 queued 부분 인덱스
CREATE INDEX IF NOT EXISTS idx_book_generation_jobs_queued_created
  ON book_generation_jobs(created_at)
  WHERE status = 'queued';
