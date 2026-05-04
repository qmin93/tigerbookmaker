-- 0011_page_views_variant.sql
-- Wave B5 — A/B 테스트: page_views 행에 variant_id (A/B) 같이 저장.
-- analytics/track route가 body에 variantId 받으면 함께 INSERT.

ALTER TABLE page_views ADD COLUMN IF NOT EXISTS variant_id TEXT;

-- A/B variant별 카운트 lookup용 부분 인덱스 (variantId 없는 행은 인덱싱 X)
CREATE INDEX IF NOT EXISTS idx_page_views_variant
  ON page_views(page_type, page_id, variant_id)
  WHERE variant_id IS NOT NULL;
