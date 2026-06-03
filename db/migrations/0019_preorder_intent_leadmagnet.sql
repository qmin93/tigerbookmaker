-- 0019_preorder_intent_leadmagnet.sql
-- preorders.intent enum 확장: 'preorder' | 'paid_intent' | 'leadmagnet'
-- HERO 직하단 인라인 폼으로 '지금 즉시 PDF 받기' 신청자도 같은 테이블에 누적.
-- intent='leadmagnet' 인 행은 5일 시퀀스 발송 대상 X (cron 라우트에서 필터).

-- intent 컬럼은 TEXT 이므로 별도 ALTER 불필요 (CHECK constraint 없음).
-- 본 마이그레이션은 코멘트 갱신과 검증 인덱스만 추가.

COMMENT ON COLUMN preorders.intent IS
  'preorder | paid_intent | leadmagnet (즉시 PDF 받기, HERO 하단 인라인 폼)';

-- leadmagnet 신청자 빠른 조회용 (intent + created_at)
CREATE INDEX IF NOT EXISTS idx_preorders_intent_created
  ON preorders(intent, created_at DESC);
