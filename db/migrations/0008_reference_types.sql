-- Wave 4 — book_references.source_type 확장
-- 기존: 'pdf' | 'url' | 'text'
-- 추가: 'docx' | 'youtube' | 'image'

ALTER TABLE book_references DROP CONSTRAINT IF EXISTS book_references_source_type_check;
ALTER TABLE book_references ADD CONSTRAINT book_references_source_type_check
  CHECK (source_type IN ('pdf', 'url', 'text', 'docx', 'youtube', 'image'));
