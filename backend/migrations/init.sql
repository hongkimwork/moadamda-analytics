-- Moadamda Analytics Database Schema
-- Phase 1: Basic tracking tables

-- 1. Visitors table
CREATE TABLE IF NOT EXISTS visitors (
  visitor_id VARCHAR(36) PRIMARY KEY,
  first_visit TIMESTAMP NOT NULL,
  last_visit TIMESTAMP NOT NULL,
  visit_count INTEGER DEFAULT 1,
  device_type VARCHAR(20),
  browser VARCHAR(50),
  os VARCHAR(50),
  referrer_type VARCHAR(50),
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_visitors_first_visit ON visitors(first_visit);
CREATE INDEX idx_visitors_last_visit ON visitors(last_visit);

-- 2. Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  session_id VARCHAR(36) PRIMARY KEY,
  visitor_id VARCHAR(36) REFERENCES visitors(visitor_id),
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  pageview_count INTEGER DEFAULT 0,
  duration_seconds INTEGER,
  entry_url TEXT,
  exit_url TEXT,
  is_bounced BOOLEAN DEFAULT FALSE,
  is_converted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_visitor_id ON sessions(visitor_id);
CREATE INDEX idx_sessions_start_time ON sessions(start_time);

-- 3. Pageviews table
CREATE TABLE IF NOT EXISTS pageviews (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(36) REFERENCES sessions(session_id),
  visitor_id VARCHAR(36) REFERENCES visitors(visitor_id),
  page_url TEXT NOT NULL,
  page_title VARCHAR(255),
  timestamp TIMESTAMP NOT NULL,
  time_spent INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pageviews_session_id ON pageviews(session_id);
CREATE INDEX idx_pageviews_timestamp ON pageviews(timestamp);
CREATE INDEX idx_pageviews_url ON pageviews(page_url);

-- 4. Events table (for Phase 2, but create now for schema completeness)
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(36) REFERENCES sessions(session_id),
  visitor_id VARCHAR(36) REFERENCES visitors(visitor_id),
  event_type VARCHAR(50) NOT NULL,
  product_id VARCHAR(100),
  product_name VARCHAR(255),
  product_price INTEGER,
  quantity INTEGER DEFAULT 1,
  timestamp TIMESTAMP NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_events_session_id ON events(session_id);
CREATE INDEX idx_events_event_type ON events(event_type);
CREATE INDEX idx_events_timestamp ON events(timestamp);

-- 5. Conversions table (for Phase 2)
CREATE TABLE IF NOT EXISTS conversions (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(36) REFERENCES sessions(session_id),
  visitor_id VARCHAR(36) REFERENCES visitors(visitor_id),
  order_id VARCHAR(100) UNIQUE,
  total_amount INTEGER NOT NULL,
  product_count INTEGER,
  timestamp TIMESTAMP NOT NULL,
  utm_source VARCHAR(100),
  utm_campaign VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_conversions_timestamp ON conversions(timestamp);
CREATE INDEX idx_conversions_order_id ON conversions(order_id);

-- 6. Realtime visitors tracking (simple approach)
CREATE TABLE IF NOT EXISTS realtime_visitors (
  visitor_id VARCHAR(36) PRIMARY KEY,
  current_url TEXT,
  last_activity TIMESTAMP NOT NULL,
  device_type VARCHAR(20)
);

CREATE INDEX idx_realtime_last_activity ON realtime_visitors(last_activity);

-- Function to clean up old realtime visitors (older than 5 minutes)
CREATE OR REPLACE FUNCTION cleanup_realtime_visitors()
RETURNS void AS $$
BEGIN
  DELETE FROM realtime_visitors WHERE last_activity < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Phase 2.6: Add detailed payment information to conversions table
-- ============================================================================

ALTER TABLE conversions
ADD COLUMN IF NOT EXISTS discount_amount INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS mileage_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS shipping_fee INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS final_payment INTEGER DEFAULT 0;

-- Add comments for clarity
COMMENT ON COLUMN conversions.discount_amount IS '총 할인금액 (쿠폰 등)';
COMMENT ON COLUMN conversions.mileage_used IS '사용한 적립금';
COMMENT ON COLUMN conversions.shipping_fee IS '배송비';
COMMENT ON COLUMN conversions.final_payment IS '최종 결제금액 (실제 결제액)';

-- Create index for final_payment queries (for revenue analysis)
CREATE INDEX IF NOT EXISTS idx_conversions_final_payment ON conversions(final_payment);

-- ============================================================================
-- Phase 4.4: Multi-touch Attribution - UTM Session History
-- ============================================================================

-- 1. Create utm_sessions table to store session-level UTM history
CREATE TABLE IF NOT EXISTS utm_sessions (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(36) NOT NULL REFERENCES sessions(session_id),
  visitor_id VARCHAR(36) NOT NULL REFERENCES visitors(visitor_id),
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  page_url TEXT,
  entry_timestamp TIMESTAMP NOT NULL,
  exit_timestamp TIMESTAMP,
  duration_seconds INTEGER DEFAULT 0,
  pageview_count INTEGER DEFAULT 1,
  sequence_order INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_utm_sessions_visitor ON utm_sessions(visitor_id);
CREATE INDEX IF NOT EXISTS idx_utm_sessions_session ON utm_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_utm_sessions_timestamp ON utm_sessions(entry_timestamp);
CREATE INDEX IF NOT EXISTS idx_utm_sessions_campaign ON utm_sessions(utm_source, utm_campaign);

-- 3. Add comments for clarity
COMMENT ON TABLE utm_sessions IS 'Tracks every UTM touchpoint in visitor journey for multi-touch attribution';
COMMENT ON COLUMN utm_sessions.duration_seconds IS 'Time spent in this UTM session (calculated from entry to exit)';
COMMENT ON COLUMN utm_sessions.sequence_order IS 'Order of this UTM touchpoint in visitor journey (1 = first touch, N = last touch)';

-- 4. Create view for easy multi-touch analysis
CREATE OR REPLACE VIEW v_visitor_utm_journey AS
SELECT 
  v.visitor_id,
  v.first_visit,
  us.sequence_order,
  us.utm_source,
  us.utm_medium,
  us.utm_campaign,
  us.entry_timestamp,
  us.duration_seconds,
  us.pageview_count,
  c.order_id,
  c.final_payment,
  CASE 
    WHEN us.sequence_order = 1 THEN 'First Touch'
    WHEN us.sequence_order = (
      SELECT MAX(sequence_order) 
      FROM utm_sessions 
      WHERE visitor_id = v.visitor_id
    ) THEN 'Last Touch'
    ELSE 'Mid Touch'
  END as touch_type
FROM visitors v
JOIN utm_sessions us ON v.visitor_id = us.visitor_id
LEFT JOIN conversions c ON v.visitor_id = c.visitor_id
WHERE v.utm_source IS NOT NULL
ORDER BY v.visitor_id, us.sequence_order;

COMMENT ON VIEW v_visitor_utm_journey IS 'Complete UTM journey for each visitor with touch type classification';

