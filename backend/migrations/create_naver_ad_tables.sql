-- =====================================================
-- 네이버 검색광고 API 데이터 테이블
-- 작성일: 2025-12-04
-- 용도: 네이버 검색광고 성과 데이터 저장
-- =====================================================

-- 1. 기존 수동 광고비 테이블 제거
DROP TABLE IF EXISTS ad_spend CASCADE;

-- =====================================================
-- 2. 캠페인 정보 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS naver_campaigns (
    id SERIAL PRIMARY KEY,
    campaign_id VARCHAR(50) NOT NULL UNIQUE,      -- 네이버 캠페인 ID
    customer_id VARCHAR(20) NOT NULL,              -- 광고주 ID
    name VARCHAR(255) NOT NULL,                    -- 캠페인명
    campaign_type VARCHAR(50),                     -- 캠페인 유형 (WEB_SITE, SHOPPING 등)
    status VARCHAR(20),                            -- 상태 (ELIGIBLE, PAUSED, DELETED 등)
    daily_budget BIGINT,                           -- 일예산 (원)
    use_daily_budget BOOLEAN DEFAULT true,         -- 일예산 사용 여부
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_naver_campaigns_customer ON naver_campaigns(customer_id);
CREATE INDEX IF NOT EXISTS idx_naver_campaigns_status ON naver_campaigns(status);

COMMENT ON TABLE naver_campaigns IS '네이버 검색광고 캠페인 정보';

-- =====================================================
-- 3. 광고그룹 정보 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS naver_adgroups (
    id SERIAL PRIMARY KEY,
    adgroup_id VARCHAR(50) NOT NULL UNIQUE,        -- 네이버 광고그룹 ID
    campaign_id VARCHAR(50) NOT NULL,              -- 캠페인 ID (FK)
    customer_id VARCHAR(20) NOT NULL,              -- 광고주 ID
    name VARCHAR(255) NOT NULL,                    -- 광고그룹명
    status VARCHAR(20),                            -- 상태
    bid_amount BIGINT,                             -- 입찰가 (원)
    use_enhanced_cpc BOOLEAN DEFAULT false,        -- 향상된 CPC 사용 여부
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_naver_adgroups_campaign ON naver_adgroups(campaign_id);
CREATE INDEX IF NOT EXISTS idx_naver_adgroups_customer ON naver_adgroups(customer_id);
CREATE INDEX IF NOT EXISTS idx_naver_adgroups_status ON naver_adgroups(status);

COMMENT ON TABLE naver_adgroups IS '네이버 검색광고 광고그룹 정보';

-- =====================================================
-- 4. 키워드 정보 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS naver_keywords (
    id SERIAL PRIMARY KEY,
    keyword_id VARCHAR(50) NOT NULL UNIQUE,        -- 네이버 키워드 ID
    adgroup_id VARCHAR(50) NOT NULL,               -- 광고그룹 ID (FK)
    campaign_id VARCHAR(50) NOT NULL,              -- 캠페인 ID
    customer_id VARCHAR(20) NOT NULL,              -- 광고주 ID
    keyword TEXT NOT NULL,                         -- 키워드 텍스트
    status VARCHAR(20),                            -- 상태
    bid_amount BIGINT,                             -- 입찰가 (원)
    use_group_bid BOOLEAN DEFAULT true,            -- 그룹 입찰가 사용 여부
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_naver_keywords_adgroup ON naver_keywords(adgroup_id);
CREATE INDEX IF NOT EXISTS idx_naver_keywords_campaign ON naver_keywords(campaign_id);
CREATE INDEX IF NOT EXISTS idx_naver_keywords_customer ON naver_keywords(customer_id);
CREATE INDEX IF NOT EXISTS idx_naver_keywords_status ON naver_keywords(status);

COMMENT ON TABLE naver_keywords IS '네이버 검색광고 키워드 정보';

-- =====================================================
-- 5. 일별 성과 데이터 테이블 (통합)
-- =====================================================
CREATE TABLE IF NOT EXISTS naver_ad_stats (
    id SERIAL PRIMARY KEY,
    stat_date DATE NOT NULL,                       -- 기준 날짜
    customer_id VARCHAR(20) NOT NULL,              -- 광고주 ID
    campaign_id VARCHAR(50) NOT NULL,              -- 캠페인 ID
    adgroup_id VARCHAR(50),                        -- 광고그룹 ID
    keyword_id VARCHAR(50),                        -- 키워드 ID
    ad_id VARCHAR(50),                             -- 광고 ID
    device_type VARCHAR(10) NOT NULL,              -- PC / MOBILE
    
    -- 성과 지표
    impressions INT DEFAULT 0,                     -- 노출수
    clicks INT DEFAULT 0,                          -- 클릭수
    cost BIGINT DEFAULT 0,                         -- 광고비 (원)
    avg_rank_sum INT DEFAULT 0,                    -- 순위 합계 (평균순위 = 합계/노출수)
    
    -- 전환 지표 (직접 전환)
    conversions_direct INT DEFAULT 0,              -- 직접 전환수
    conversion_sales_direct BIGINT DEFAULT 0,      -- 직접 전환 매출
    
    -- 전환 지표 (간접 전환)
    conversions_indirect INT DEFAULT 0,            -- 간접 전환수
    conversion_sales_indirect BIGINT DEFAULT 0,    -- 간접 전환 매출
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 유니크 제약: 같은 날짜+캠페인+광고그룹+키워드+광고+디바이스 조합은 하나만
    CONSTRAINT uq_naver_ad_stats UNIQUE (stat_date, customer_id, campaign_id, adgroup_id, keyword_id, ad_id, device_type)
);

-- 성능을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_naver_stats_date ON naver_ad_stats(stat_date);
CREATE INDEX IF NOT EXISTS idx_naver_stats_campaign ON naver_ad_stats(campaign_id);
CREATE INDEX IF NOT EXISTS idx_naver_stats_adgroup ON naver_ad_stats(adgroup_id);
CREATE INDEX IF NOT EXISTS idx_naver_stats_keyword ON naver_ad_stats(keyword_id);
CREATE INDEX IF NOT EXISTS idx_naver_stats_device ON naver_ad_stats(device_type);
CREATE INDEX IF NOT EXISTS idx_naver_stats_date_campaign ON naver_ad_stats(stat_date, campaign_id);

COMMENT ON TABLE naver_ad_stats IS '네이버 검색광고 일별 성과 데이터 (성과+전환 통합)';
COMMENT ON COLUMN naver_ad_stats.avg_rank_sum IS '순위 합계. 평균 순위 = avg_rank_sum / impressions';
COMMENT ON COLUMN naver_ad_stats.conversions_direct IS '직접 전환: 광고 클릭 후 바로 전환';
COMMENT ON COLUMN naver_ad_stats.conversions_indirect IS '간접 전환: 광고 클릭 후 나중에 전환';

-- =====================================================
-- 6. updated_at 자동 갱신 트리거
-- =====================================================
CREATE OR REPLACE FUNCTION update_naver_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 각 테이블에 트리거 적용
DROP TRIGGER IF EXISTS trigger_naver_campaigns_updated ON naver_campaigns;
CREATE TRIGGER trigger_naver_campaigns_updated
    BEFORE UPDATE ON naver_campaigns
    FOR EACH ROW EXECUTE FUNCTION update_naver_updated_at();

DROP TRIGGER IF EXISTS trigger_naver_adgroups_updated ON naver_adgroups;
CREATE TRIGGER trigger_naver_adgroups_updated
    BEFORE UPDATE ON naver_adgroups
    FOR EACH ROW EXECUTE FUNCTION update_naver_updated_at();

DROP TRIGGER IF EXISTS trigger_naver_keywords_updated ON naver_keywords;
CREATE TRIGGER trigger_naver_keywords_updated
    BEFORE UPDATE ON naver_keywords
    FOR EACH ROW EXECUTE FUNCTION update_naver_updated_at();

DROP TRIGGER IF EXISTS trigger_naver_stats_updated ON naver_ad_stats;
CREATE TRIGGER trigger_naver_stats_updated
    BEFORE UPDATE ON naver_ad_stats
    FOR EACH ROW EXECUTE FUNCTION update_naver_updated_at();

-- =====================================================
-- 완료 메시지
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '네이버 검색광고 테이블 생성 완료!';
    RAISE NOTICE '- ad_spend (기존) 제거됨';
    RAISE NOTICE '- naver_campaigns 생성됨';
    RAISE NOTICE '- naver_adgroups 생성됨';
    RAISE NOTICE '- naver_keywords 생성됨';
    RAISE NOTICE '- naver_ad_stats 생성됨';
END $$;

