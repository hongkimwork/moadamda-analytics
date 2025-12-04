-- =====================================================
-- Meta(Facebook/Instagram) 광고 API 데이터 테이블
-- 작성일: 2025-12-04
-- 용도: Meta 광고 성과 데이터 저장
-- =====================================================

-- =====================================================
-- 1. 캠페인 정보 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS meta_campaigns (
    id SERIAL PRIMARY KEY,
    campaign_id VARCHAR(50) NOT NULL UNIQUE,      -- Meta 캠페인 ID
    account_id VARCHAR(50) NOT NULL,              -- 광고 계정 ID (act_xxx)
    name VARCHAR(255) NOT NULL,                   -- 캠페인명
    objective VARCHAR(50),                        -- 캠페인 목표 (CONVERSIONS, REACH 등)
    status VARCHAR(20),                           -- 상태 (ACTIVE, PAUSED, DELETED 등)
    daily_budget BIGINT,                          -- 일예산 (원)
    lifetime_budget BIGINT,                       -- 총예산 (원)
    created_time TIMESTAMP,                       -- Meta에서 생성된 시간
    updated_time TIMESTAMP,                       -- Meta에서 수정된 시간
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_meta_campaigns_account ON meta_campaigns(account_id);
CREATE INDEX IF NOT EXISTS idx_meta_campaigns_status ON meta_campaigns(status);

COMMENT ON TABLE meta_campaigns IS 'Meta 광고 캠페인 정보';

-- =====================================================
-- 2. 광고세트(Adset) 정보 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS meta_adsets (
    id SERIAL PRIMARY KEY,
    adset_id VARCHAR(50) NOT NULL UNIQUE,         -- Meta 광고세트 ID
    campaign_id VARCHAR(50) NOT NULL,             -- 캠페인 ID
    account_id VARCHAR(50) NOT NULL,              -- 광고 계정 ID
    name VARCHAR(255) NOT NULL,                   -- 광고세트명
    status VARCHAR(20),                           -- 상태
    optimization_goal VARCHAR(50),                -- 최적화 목표 (OFFSITE_CONVERSIONS 등)
    billing_event VARCHAR(50),                    -- 과금 방식 (IMPRESSIONS, CLICKS 등)
    daily_budget BIGINT,                          -- 일예산 (원)
    lifetime_budget BIGINT,                       -- 총예산 (원)
    targeting JSONB,                              -- 타겟팅 정보 (JSON)
    created_time TIMESTAMP,                       -- Meta에서 생성된 시간
    updated_time TIMESTAMP,                       -- Meta에서 수정된 시간
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_meta_adsets_campaign ON meta_adsets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_meta_adsets_account ON meta_adsets(account_id);
CREATE INDEX IF NOT EXISTS idx_meta_adsets_status ON meta_adsets(status);

COMMENT ON TABLE meta_adsets IS 'Meta 광고 광고세트(Adset) 정보';

-- =====================================================
-- 3. 광고(Ad) 정보 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS meta_ads (
    id SERIAL PRIMARY KEY,
    ad_id VARCHAR(50) NOT NULL UNIQUE,            -- Meta 광고 ID
    adset_id VARCHAR(50) NOT NULL,                -- 광고세트 ID
    campaign_id VARCHAR(50) NOT NULL,             -- 캠페인 ID
    account_id VARCHAR(50) NOT NULL,              -- 광고 계정 ID
    name VARCHAR(255) NOT NULL,                   -- 광고명
    status VARCHAR(20),                           -- 상태
    creative_id VARCHAR(50),                      -- 크리에이티브 ID
    created_time TIMESTAMP,                       -- Meta에서 생성된 시간
    updated_time TIMESTAMP,                       -- Meta에서 수정된 시간
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_meta_ads_adset ON meta_ads(adset_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_campaign ON meta_ads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_account ON meta_ads(account_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_status ON meta_ads(status);

COMMENT ON TABLE meta_ads IS 'Meta 광고 광고(Ad) 정보';

-- =====================================================
-- 4. 일별 성과 데이터 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS meta_ad_stats (
    id SERIAL PRIMARY KEY,
    stat_date DATE NOT NULL,                      -- 기준 날짜
    account_id VARCHAR(50) NOT NULL,              -- 광고 계정 ID
    campaign_id VARCHAR(50) NOT NULL,             -- 캠페인 ID
    adset_id VARCHAR(50),                         -- 광고세트 ID
    ad_id VARCHAR(50),                            -- 광고 ID
    
    -- 기본 성과 지표
    impressions BIGINT DEFAULT 0,                 -- 노출수
    reach BIGINT DEFAULT 0,                       -- 도달수 (유니크 사용자)
    clicks BIGINT DEFAULT 0,                      -- 클릭수 (전체)
    outbound_clicks BIGINT DEFAULT 0,             -- 외부 링크 클릭수
    spend DECIMAL(12,2) DEFAULT 0,                -- 광고비 (원)
    
    -- 전환 지표
    purchases INT DEFAULT 0,                      -- 구매 전환수
    purchase_value DECIMAL(12,2) DEFAULT 0,       -- 구매 전환 금액
    add_to_cart INT DEFAULT 0,                    -- 장바구니 추가
    initiate_checkout INT DEFAULT 0,              -- 결제 시작
    leads INT DEFAULT 0,                          -- 리드
    
    -- ROAS
    purchase_roas DECIMAL(8,4),                   -- 구매 ROAS
    
    -- 동영상 지표
    video_plays INT DEFAULT 0,                    -- 동영상 재생수
    video_p25_watched INT DEFAULT 0,              -- 25% 시청
    video_p50_watched INT DEFAULT 0,              -- 50% 시청
    video_p75_watched INT DEFAULT 0,              -- 75% 시청
    video_p100_watched INT DEFAULT 0,             -- 100% 시청
    video_avg_time_watched DECIMAL(10,2),         -- 평균 시청 시간 (초)
    
    -- 원본 데이터 (복잡한 필드 저장용)
    actions_json JSONB,                           -- actions 전체 JSON
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 유니크 제약: 같은 날짜+캠페인+광고세트+광고 조합은 하나만
    CONSTRAINT uq_meta_ad_stats UNIQUE (stat_date, account_id, campaign_id, adset_id, ad_id)
);

-- 성능을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_meta_stats_date ON meta_ad_stats(stat_date);
CREATE INDEX IF NOT EXISTS idx_meta_stats_campaign ON meta_ad_stats(campaign_id);
CREATE INDEX IF NOT EXISTS idx_meta_stats_adset ON meta_ad_stats(adset_id);
CREATE INDEX IF NOT EXISTS idx_meta_stats_ad ON meta_ad_stats(ad_id);
CREATE INDEX IF NOT EXISTS idx_meta_stats_date_campaign ON meta_ad_stats(stat_date, campaign_id);

COMMENT ON TABLE meta_ad_stats IS 'Meta 광고 일별 성과 데이터';
COMMENT ON COLUMN meta_ad_stats.reach IS '도달수: 광고를 본 고유 사용자 수';
COMMENT ON COLUMN meta_ad_stats.outbound_clicks IS '외부 클릭: 외부 웹사이트로 이동한 클릭수';
COMMENT ON COLUMN meta_ad_stats.purchase_roas IS '구매 ROAS: 광고비 대비 구매 전환 금액 비율';

-- =====================================================
-- 5. updated_at 자동 갱신 트리거
-- =====================================================
CREATE OR REPLACE FUNCTION update_meta_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 각 테이블에 트리거 적용
DROP TRIGGER IF EXISTS trigger_meta_campaigns_updated ON meta_campaigns;
CREATE TRIGGER trigger_meta_campaigns_updated
    BEFORE UPDATE ON meta_campaigns
    FOR EACH ROW EXECUTE FUNCTION update_meta_updated_at();

DROP TRIGGER IF EXISTS trigger_meta_adsets_updated ON meta_adsets;
CREATE TRIGGER trigger_meta_adsets_updated
    BEFORE UPDATE ON meta_adsets
    FOR EACH ROW EXECUTE FUNCTION update_meta_updated_at();

DROP TRIGGER IF EXISTS trigger_meta_ads_updated ON meta_ads;
CREATE TRIGGER trigger_meta_ads_updated
    BEFORE UPDATE ON meta_ads
    FOR EACH ROW EXECUTE FUNCTION update_meta_updated_at();

DROP TRIGGER IF EXISTS trigger_meta_stats_updated ON meta_ad_stats;
CREATE TRIGGER trigger_meta_stats_updated
    BEFORE UPDATE ON meta_ad_stats
    FOR EACH ROW EXECUTE FUNCTION update_meta_updated_at();

-- =====================================================
-- 완료 메시지
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE 'Meta 광고 테이블 생성 완료!';
    RAISE NOTICE '- meta_campaigns 생성됨';
    RAISE NOTICE '- meta_adsets 생성됨';
    RAISE NOTICE '- meta_ads 생성됨';
    RAISE NOTICE '- meta_ad_stats 생성됨';
END $$;

