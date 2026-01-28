-- ============================================================================
-- 상대평가 세부 방식 컬럼 추가
-- relative_mode: 'range' (구간 점수 방식) 또는 'percentile' (백분위 방식)
-- ============================================================================

-- 상대평가 세부 방식 컬럼 추가 (기본값: range = 구간 점수 방식)
ALTER TABLE score_settings 
ADD COLUMN IF NOT EXISTS relative_mode VARCHAR(20) NOT NULL DEFAULT 'range' 
CHECK (relative_mode IN ('range', 'percentile'));

-- 코멘트 추가
COMMENT ON COLUMN score_settings.relative_mode IS '상대평가 세부 방식 (range: 구간 점수, percentile: 백분위)';
