-- ============================================================================
-- Performance Optimization: Add expression index for utm_content queries
-- Created: 2025-12-29
-- Purpose: Speed up creative performance queries by indexing utm_content extraction
-- ============================================================================

-- 1. Expression index for utm_content (most frequently queried)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_utm_sessions_utm_content 
ON utm_sessions ((utm_params->>'utm_content'))
WHERE utm_params->>'utm_content' IS NOT NULL;

-- 2. Composite expression index for full creative key lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_utm_sessions_creative_key
ON utm_sessions (
  (utm_params->>'utm_content'),
  (COALESCE(NULLIF(utm_params->>'utm_source', ''), '-')),
  (COALESCE(NULLIF(utm_params->>'utm_medium', ''), '-')),
  (COALESCE(NULLIF(utm_params->>'utm_campaign', ''), '-'))
)
WHERE utm_params->>'utm_content' IS NOT NULL;

-- 3. Composite index for entry_timestamp + utm_content (date range queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_utm_sessions_timestamp_content
ON utm_sessions (entry_timestamp, (utm_params->>'utm_content'))
WHERE utm_params->>'utm_content' IS NOT NULL;

-- ============================================================================
-- Verification query (run after migration)
-- ============================================================================
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename = 'utm_sessions' 
-- AND indexname LIKE '%utm_content%';
