-- ============================================================================
-- 광고비 관리 테이블
-- ============================================================================
-- 각 광고 캠페인의 집행 비용을 관리하여 ROAS 계산에 활용

CREATE TABLE IF NOT EXISTS ad_spend (
  id SERIAL PRIMARY KEY,
  
  -- 광고 식별 정보
  utm_source VARCHAR(100),          -- 광고 소스 (facebook, instagram, google 등)
  utm_campaign VARCHAR(100) NOT NULL, -- 캠페인명 (필수)
  
  -- 광고비 정보
  spend_amount INTEGER NOT NULL,    -- 광고비 (원 단위)
  currency VARCHAR(10) DEFAULT 'KRW', -- 통화 (기본: 원화)
  
  -- 기간 정보 (선택사항: 특정 기간의 광고비인 경우)
  period_start DATE,                -- 기간 시작일
  period_end DATE,                  -- 기간 종료일
  
  -- 메타 정보
  note TEXT,                        -- 메모 (예: "1월 신년 프로모션")
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- 유니크 제약: 같은 캠페인+소스 조합은 하나만 (기간 없는 경우)
  CONSTRAINT unique_campaign_source UNIQUE (utm_source, utm_campaign)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_ad_spend_campaign ON ad_spend(utm_campaign);
CREATE INDEX IF NOT EXISTS idx_ad_spend_source ON ad_spend(utm_source);
CREATE INDEX IF NOT EXISTS idx_ad_spend_period ON ad_spend(period_start, period_end);

-- 테이블 설명
COMMENT ON TABLE ad_spend IS '광고 캠페인별 집행 비용 관리 테이블';
COMMENT ON COLUMN ad_spend.utm_campaign IS '캠페인 이름 (필수, utm_campaign과 매칭)';
COMMENT ON COLUMN ad_spend.utm_source IS '광고 소스 (선택, utm_source와 매칭)';
COMMENT ON COLUMN ad_spend.spend_amount IS '광고 집행 비용 (원 단위)';
COMMENT ON COLUMN ad_spend.period_start IS '광고 기간 시작일 (선택사항)';
COMMENT ON COLUMN ad_spend.period_end IS '광고 기간 종료일 (선택사항)';

-- updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_ad_spend_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_update_ad_spend_updated_at ON ad_spend;
CREATE TRIGGER trigger_update_ad_spend_updated_at
  BEFORE UPDATE ON ad_spend
  FOR EACH ROW
  EXECUTE FUNCTION update_ad_spend_updated_at();

-- 샘플 데이터 (테스트용, 실제 환경에서는 주석 처리)
-- INSERT INTO ad_spend (utm_source, utm_campaign, spend_amount, note) VALUES
-- ('facebook', 'winter_video_a', 1500000, '겨울신상 영상 광고'),
-- ('facebook', 'sale_video_b', 2000000, '세일특가 영상 광고'),
-- ('facebook', 'last_video_c', 3000000, '마지막혜택 영상 광고'),
-- ('instagram', 'winter_video_a', 800000, '인스타그램 겨울신상'),
-- ('instagram', 'sale_video_b', 1200000, '인스타그램 세일특가');

