CREATE TABLE IF NOT EXISTS ad_spend (
  id SERIAL PRIMARY KEY,
  utm_source VARCHAR(100),
  utm_campaign VARCHAR(100) NOT NULL,
  spend_amount INTEGER NOT NULL,
  currency VARCHAR(10) DEFAULT 'KRW',
  period_start DATE,
  period_end DATE,
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_campaign_source UNIQUE (utm_source, utm_campaign)
);

CREATE INDEX IF NOT EXISTS idx_ad_spend_campaign ON ad_spend(utm_campaign);
CREATE INDEX IF NOT EXISTS idx_ad_spend_source ON ad_spend(utm_source);
CREATE INDEX IF NOT EXISTS idx_ad_spend_period ON ad_spend(period_start, period_end);

CREATE OR REPLACE FUNCTION update_ad_spend_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_ad_spend_updated_at ON ad_spend;
CREATE TRIGGER trigger_update_ad_spend_updated_at
  BEFORE UPDATE ON ad_spend
  FOR EACH ROW
  EXECUTE FUNCTION update_ad_spend_updated_at();

