-- ============================================================================
-- Add member_id column to conversions table
-- For member-based user journey linking (cookie fragmentation workaround)
-- Created: 2026-02-03
-- ============================================================================

-- 1. Add member_id column to conversions table
ALTER TABLE conversions
ADD COLUMN IF NOT EXISTS member_id VARCHAR(100);

-- 2. Create index for member_id queries (for attribution analysis)
CREATE INDEX IF NOT EXISTS idx_conversions_member_id ON conversions(member_id);

-- 3. Add comment for clarity
COMMENT ON COLUMN conversions.member_id IS 'Cafe24 회원 ID - 쿠키 끊김 시 동일 사용자 연결용';

-- ============================================================================
-- Verification queries (run after migration)
-- ============================================================================
-- Check column exists:
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'conversions' AND column_name = 'member_id';

-- Check index exists:
-- SELECT indexname FROM pg_indexes WHERE tablename = 'conversions' AND indexname = 'idx_conversions_member_id';
