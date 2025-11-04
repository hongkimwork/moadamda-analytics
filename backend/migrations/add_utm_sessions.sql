-- Phase 4.4: Multi-touch Attribution - UTM Session History
-- Created: 2025-10-17
-- Purpose: Track every UTM touchpoint in a visitor's journey for multi-touch attribution

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
CREATE INDEX idx_utm_sessions_visitor ON utm_sessions(visitor_id);
CREATE INDEX idx_utm_sessions_session ON utm_sessions(session_id);
CREATE INDEX idx_utm_sessions_timestamp ON utm_sessions(entry_timestamp);
CREATE INDEX idx_utm_sessions_campaign ON utm_sessions(utm_source, utm_campaign);

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

