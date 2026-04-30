-- 0005_pgvector_references.sql
-- pgvector extension + 레퍼런스 저장 테이블 2개

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS book_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES book_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('pdf', 'url', 'text')),
  source_url text,
  total_chars integer NOT NULL DEFAULT 0,
  chunk_count integer NOT NULL DEFAULT 0,
  uploaded_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_book_references_project ON book_references(project_id);
CREATE INDEX IF NOT EXISTS idx_book_references_user ON book_references(user_id);

CREATE TABLE IF NOT EXISTS reference_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id uuid NOT NULL REFERENCES book_references(id) ON DELETE CASCADE,
  chunk_idx integer NOT NULL,
  content text NOT NULL,
  embedding vector(768),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reference_chunks_ref ON reference_chunks(reference_id);
-- HNSW index — vector 유사도 검색용 (cosine distance)
CREATE INDEX IF NOT EXISTS idx_reference_chunks_embedding
  ON reference_chunks USING hnsw (embedding vector_cosine_ops);
