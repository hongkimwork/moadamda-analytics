-- ============================================================================
-- View, UV 지표 추가 마이그레이션
-- 기존 score_settings 테이블에 새 컬럼 추가
-- ============================================================================

-- 1. 기존 가중치 합계 제약조건 제거
ALTER TABLE score_settings DROP CONSTRAINT IF EXISTS weight_sum_check;

-- 2. 새 컬럼 추가: weight_view, weight_uv (기본값 0 = 미선택 상태)
ALTER TABLE score_settings 
ADD COLUMN IF NOT EXISTS weight_view INTEGER NOT NULL DEFAULT 0 CHECK (weight_view >= 0 AND weight_view <= 100);

ALTER TABLE score_settings 
ADD COLUMN IF NOT EXISTS weight_uv INTEGER NOT NULL DEFAULT 0 CHECK (weight_uv >= 0 AND weight_uv <= 100);

-- 3. 새 구간 설정 컬럼 추가 (JSONB)
-- View 기본값: 절대평가 1000 > 500 > 100 / 상대평가 10, 30, 60
ALTER TABLE score_settings 
ADD COLUMN IF NOT EXISTS view_config JSONB NOT NULL DEFAULT '{"boundaries": [10, 30, 60], "scores": [100, 80, 50, 20]}';

-- UV 기본값: 절대평가 500 > 200 > 50 / 상대평가 10, 30, 60
ALTER TABLE score_settings 
ADD COLUMN IF NOT EXISTS uv_config JSONB NOT NULL DEFAULT '{"boundaries": [10, 30, 60], "scores": [100, 80, 50, 20]}';

-- 4. 선택된 지표 목록 저장 컬럼 추가 (배열)
-- 기본값: 기존 3개 지표 (scroll, pv, duration)
ALTER TABLE score_settings 
ADD COLUMN IF NOT EXISTS enabled_metrics TEXT[] NOT NULL DEFAULT ARRAY['scroll', 'pv', 'duration'];

-- 5. 새 가중치 합계 제약조건 추가
-- 선택된 지표(weight > 0)들의 합계가 100이어야 함
-- 단, enabled_metrics에 포함된 지표만 합계 계산
ALTER TABLE score_settings ADD CONSTRAINT weight_sum_check CHECK (
  (
    CASE WHEN 'scroll' = ANY(enabled_metrics) THEN weight_scroll ELSE 0 END +
    CASE WHEN 'pv' = ANY(enabled_metrics) THEN weight_pv ELSE 0 END +
    CASE WHEN 'duration' = ANY(enabled_metrics) THEN weight_duration ELSE 0 END +
    CASE WHEN 'view' = ANY(enabled_metrics) THEN weight_view ELSE 0 END +
    CASE WHEN 'uv' = ANY(enabled_metrics) THEN weight_uv ELSE 0 END
  ) = 100
);

-- 6. 코멘트 추가
COMMENT ON COLUMN score_settings.weight_view IS 'View(조회수) 가중치 (%)';
COMMENT ON COLUMN score_settings.weight_uv IS 'UV(순방문자) 가중치 (%)';
COMMENT ON COLUMN score_settings.view_config IS 'View 구간 설정 (boundaries: 경계값, scores: 점수)';
COMMENT ON COLUMN score_settings.uv_config IS 'UV 구간 설정';
COMMENT ON COLUMN score_settings.enabled_metrics IS '활성화된 지표 목록 (scroll, pv, duration, view, uv)';
