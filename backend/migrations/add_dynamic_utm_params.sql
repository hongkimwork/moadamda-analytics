-- Dynamic UTM Parameters Support
-- Created: 2025-10-22
-- Purpose: Add JSONB column to store all utm_* parameters dynamically

-- ============================================================================
-- 1. Add utm_params JSONB column to visitors table
-- ============================================================================
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS utm_params JSONB;

COMMENT ON COLUMN visitors.utm_params IS 'Stores all UTM parameters as JSON (utm_source, utm_medium, utm_campaign, utm_content, utm_term, etc.)';

-- Create GIN index for fast JSONB queries
CREATE INDEX IF NOT EXISTS idx_visitors_utm_params ON visitors USING gin(utm_params);

-- ============================================================================
-- 2. Add utm_params JSONB column to sessions table
-- ============================================================================
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS utm_params JSONB;

COMMENT ON COLUMN sessions.utm_params IS 'Stores all UTM parameters for this session as JSON';

CREATE INDEX IF NOT EXISTS idx_sessions_utm_params ON sessions USING gin(utm_params);

-- ============================================================================
-- 3. Add utm_params JSONB column to utm_sessions table
-- ============================================================================
ALTER TABLE utm_sessions ADD COLUMN IF NOT EXISTS utm_params JSONB;

COMMENT ON COLUMN utm_sessions.utm_params IS 'Stores all UTM parameters for this UTM session as JSON';

CREATE INDEX IF NOT EXISTS idx_utm_sessions_utm_params ON utm_sessions USING gin(utm_params);

-- ============================================================================
-- 4. Add utm_params JSONB column to conversions table (optional but useful)
-- ============================================================================
ALTER TABLE conversions ADD COLUMN IF NOT EXISTS utm_params JSONB;

COMMENT ON COLUMN conversions.utm_params IS 'Stores all UTM parameters at conversion time as JSON';

CREATE INDEX IF NOT EXISTS idx_conversions_utm_params ON conversions USING gin(utm_params);

-- ============================================================================
-- 5. Migrate existing data (기존 3개 컬럼 데이터를 JSONB로 복사)
-- ============================================================================

-- visitors 테이블 기존 데이터 마이그레이션
UPDATE visitors
SET utm_params = jsonb_build_object(
  'utm_source', utm_source,
  'utm_medium', utm_medium,
  'utm_campaign', utm_campaign
)
WHERE utm_params IS NULL
  AND (utm_source IS NOT NULL OR utm_medium IS NOT NULL OR utm_campaign IS NOT NULL);

-- utm_sessions 테이블 기존 데이터 마이그레이션
UPDATE utm_sessions
SET utm_params = jsonb_build_object(
  'utm_source', utm_source,
  'utm_medium', utm_medium,
  'utm_campaign', utm_campaign
)
WHERE utm_params IS NULL
  AND (utm_source IS NOT NULL OR utm_medium IS NOT NULL OR utm_campaign IS NOT NULL);

-- conversions 테이블 기존 데이터 마이그레이션
UPDATE conversions
SET utm_params = jsonb_build_object(
  'utm_source', utm_source,
  'utm_campaign', utm_campaign
)
WHERE utm_params IS NULL
  AND (utm_source IS NOT NULL OR utm_campaign IS NOT NULL);

-- ============================================================================
-- 6. Create helper function to extract all UTM keys
-- ============================================================================
CREATE OR REPLACE FUNCTION get_all_utm_keys(table_name text)
RETURNS TABLE(utm_key text, count bigint) AS $$
BEGIN
  RETURN QUERY EXECUTE format('
    SELECT DISTINCT jsonb_object_keys(utm_params) as utm_key,
           COUNT(*) as count
    FROM %I
    WHERE utm_params IS NOT NULL
    GROUP BY utm_key
    ORDER BY utm_key
  ', table_name);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_all_utm_keys IS 'Returns all unique UTM parameter keys found in a table';

-- Usage example:
-- SELECT * FROM get_all_utm_keys('visitors');

-- ============================================================================
-- Verification queries
-- ============================================================================

-- Check if columns are added
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name IN ('visitors', 'sessions', 'utm_sessions', 'conversions')
--   AND column_name = 'utm_params';

-- Check sample data
-- SELECT visitor_id, utm_source, utm_medium, utm_campaign, utm_params 
-- FROM visitors 
-- WHERE utm_params IS NOT NULL 
-- LIMIT 5;

-- Check all UTM keys in visitors table
-- SELECT * FROM get_all_utm_keys('visitors');

