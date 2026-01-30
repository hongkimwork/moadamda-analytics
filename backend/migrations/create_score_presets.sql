-- ============================================================================
-- 모수 평가 프리셋 테이블
-- 사용자가 저장한 프리셋 목록과 현재 적용 중인 프리셋 관리
-- ============================================================================

-- 프리셋 테이블 생성
CREATE TABLE IF NOT EXISTS score_presets (
    id SERIAL PRIMARY KEY,
    
    -- 프리셋 이름
    name VARCHAR(100) NOT NULL,
    
    -- 평가 방식: 'relative' (상대평가) 또는 'absolute' (절대평가)
    evaluation_type VARCHAR(20) NOT NULL DEFAULT 'absolute' CHECK (evaluation_type IN ('relative', 'absolute')),
    
    -- 지표별 가중치
    weight_scroll INTEGER NOT NULL DEFAULT 30 CHECK (weight_scroll >= 0 AND weight_scroll <= 100),
    weight_pv INTEGER NOT NULL DEFAULT 35 CHECK (weight_pv >= 0 AND weight_pv <= 100),
    weight_duration INTEGER NOT NULL DEFAULT 35 CHECK (weight_duration >= 0 AND weight_duration <= 100),
    weight_view INTEGER NOT NULL DEFAULT 0 CHECK (weight_view >= 0 AND weight_view <= 100),
    weight_uv INTEGER NOT NULL DEFAULT 0 CHECK (weight_uv >= 0 AND weight_uv <= 100),
    
    -- 지표별 구간 설정 (JSON 형태로 저장)
    scroll_config JSONB NOT NULL DEFAULT '{"boundaries": [3000, 1500, 500], "scores": [100, 80, 50, 20]}',
    pv_config JSONB NOT NULL DEFAULT '{"boundaries": [5, 3, 2], "scores": [100, 80, 50, 20]}',
    duration_config JSONB NOT NULL DEFAULT '{"boundaries": [120, 60, 30], "scores": [100, 80, 50, 20]}',
    view_config JSONB NOT NULL DEFAULT '{"boundaries": [1000, 500, 100], "scores": [100, 80, 50, 20]}',
    uv_config JSONB NOT NULL DEFAULT '{"boundaries": [500, 200, 50], "scores": [100, 80, 50, 20]}',
    
    -- 활성화된 지표 목록
    enabled_metrics TEXT[] NOT NULL DEFAULT ARRAY['scroll', 'pv', 'duration'],
    
    -- 현재 적용 중인 프리셋 여부
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- 메타 정보
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 업데이트 시간 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_score_presets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_score_presets_updated_at ON score_presets;
CREATE TRIGGER trigger_update_score_presets_updated_at
    BEFORE UPDATE ON score_presets
    FOR EACH ROW
    EXECUTE FUNCTION update_score_presets_updated_at();

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_score_presets_is_active ON score_presets(is_active);
CREATE INDEX IF NOT EXISTS idx_score_presets_name ON score_presets(name);

-- 코멘트
COMMENT ON TABLE score_presets IS '모수 평가 프리셋 테이블';
COMMENT ON COLUMN score_presets.name IS '프리셋 이름';
COMMENT ON COLUMN score_presets.is_active IS '현재 적용 중인 프리셋 여부';
COMMENT ON COLUMN score_presets.evaluation_type IS '평가 방식 (relative: 상대평가, absolute: 절대평가)';
COMMENT ON COLUMN score_presets.enabled_metrics IS '활성화된 지표 목록';

-- 기존 score_settings 데이터 마이그레이션 (있는 경우)
INSERT INTO score_presets (
    name,
    evaluation_type,
    weight_scroll,
    weight_pv,
    weight_duration,
    weight_view,
    weight_uv,
    scroll_config,
    pv_config,
    duration_config,
    view_config,
    uv_config,
    enabled_metrics,
    is_active
)
SELECT 
    '기본 설정',
    evaluation_type,
    weight_scroll,
    weight_pv,
    weight_duration,
    COALESCE(weight_view, 0),
    COALESCE(weight_uv, 0),
    scroll_config,
    pv_config,
    duration_config,
    COALESCE(view_config, '{"boundaries": [1000, 500, 100], "scores": [100, 80, 50, 20]}'::jsonb),
    COALESCE(uv_config, '{"boundaries": [500, 200, 50], "scores": [100, 80, 50, 20]}'::jsonb),
    COALESCE(enabled_metrics, ARRAY['scroll', 'pv', 'duration']),
    TRUE
FROM score_settings
LIMIT 1;
