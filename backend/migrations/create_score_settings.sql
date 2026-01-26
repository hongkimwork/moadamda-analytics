-- ============================================================================
-- 모수 평가 기준 설정 테이블
-- 사용자가 설정한 점수 평가 기준을 저장
-- ============================================================================

-- 설정 테이블 생성
CREATE TABLE IF NOT EXISTS score_settings (
    id SERIAL PRIMARY KEY,
    
    -- 평가 방식: 'relative' (상대평가) 또는 'absolute' (절대평가)
    evaluation_type VARCHAR(20) NOT NULL CHECK (evaluation_type IN ('relative', 'absolute')),
    
    -- 지표별 가중치 (합계 100)
    weight_scroll INTEGER NOT NULL DEFAULT 30 CHECK (weight_scroll >= 0 AND weight_scroll <= 100),
    weight_pv INTEGER NOT NULL DEFAULT 35 CHECK (weight_pv >= 0 AND weight_pv <= 100),
    weight_duration INTEGER NOT NULL DEFAULT 35 CHECK (weight_duration >= 0 AND weight_duration <= 100),
    
    -- 지표별 구간 설정 (JSON 형태로 저장)
    -- 상대평가: { "boundaries": [10, 30, 60], "scores": [100, 80, 50, 20] }
    -- 절대평가: { "boundaries": [120, 60, 30], "scores": [100, 80, 50, 20] }
    scroll_config JSONB NOT NULL DEFAULT '{"boundaries": [10, 30, 60], "scores": [100, 80, 50, 20]}',
    pv_config JSONB NOT NULL DEFAULT '{"boundaries": [10, 30, 60], "scores": [100, 80, 50, 20]}',
    duration_config JSONB NOT NULL DEFAULT '{"boundaries": [10, 30, 60], "scores": [100, 80, 50, 20]}',
    
    -- 메타 정보
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 가중치 합계 100 검증
    CONSTRAINT weight_sum_check CHECK (weight_scroll + weight_pv + weight_duration = 100)
);

-- 업데이트 시간 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_score_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_score_settings_updated_at ON score_settings;
CREATE TRIGGER trigger_update_score_settings_updated_at
    BEFORE UPDATE ON score_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_score_settings_updated_at();

-- 인덱스 (단일 설정만 사용하므로 id 기준)
CREATE INDEX IF NOT EXISTS idx_score_settings_id ON score_settings(id);

-- 코멘트
COMMENT ON TABLE score_settings IS '모수 평가 기준 설정 테이블';
COMMENT ON COLUMN score_settings.evaluation_type IS '평가 방식 (relative: 상대평가, absolute: 절대평가)';
COMMENT ON COLUMN score_settings.weight_scroll IS '평균 스크롤 가중치 (%)';
COMMENT ON COLUMN score_settings.weight_pv IS '평균 PV 가중치 (%)';
COMMENT ON COLUMN score_settings.weight_duration IS '평균 체류시간 가중치 (%)';
COMMENT ON COLUMN score_settings.scroll_config IS '스크롤 구간 설정 (boundaries: 경계값, scores: 점수)';
COMMENT ON COLUMN score_settings.pv_config IS 'PV 구간 설정';
COMMENT ON COLUMN score_settings.duration_config IS '체류시간 구간 설정';
