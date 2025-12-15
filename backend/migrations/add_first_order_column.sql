-- Add first_order column to conversions table
-- Created: 2025-12-15
-- Purpose: Store Cafe24 first_order field for accurate repurchase detection

-- 1. Add first_order column
ALTER TABLE conversions
ADD COLUMN IF NOT EXISTS first_order CHAR(1) DEFAULT NULL;

-- 2. Add comment for clarity
COMMENT ON COLUMN conversions.first_order IS 'Cafe24 최초 주문 여부 (T=최초주문/신규, F=재구매, NULL=판단불가) - Cafe24 first_order 필드';

-- 3. Create index for performance
CREATE INDEX IF NOT EXISTS idx_conversions_first_order ON conversions(first_order);

-- 4. Verification query
-- SELECT order_id, visitor_id, first_order, 
--        CASE 
--          WHEN first_order = 'T' THEN '신규'
--          WHEN first_order = 'F' THEN '재구매'
--          ELSE '판단불가'
--        END as customer_type
-- FROM conversions 
-- WHERE first_order IS NOT NULL
-- ORDER BY timestamp DESC 
-- LIMIT 10;
