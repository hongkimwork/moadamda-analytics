-- Add order status tracking columns to conversions table
-- Created: 2025-10-27
-- Purpose: Track order cancellations and refunds from Cafe24 Recipe

-- 1. Add order status columns
ALTER TABLE conversions
ADD COLUMN IF NOT EXISTS order_status VARCHAR(20) DEFAULT 'confirmed',
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS refund_amount INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS synced_at TIMESTAMP;

-- 2. Add comments for clarity
COMMENT ON COLUMN conversions.order_status IS '주문 상태: confirmed, cancelled, refunded';
COMMENT ON COLUMN conversions.cancelled_at IS '취소/환불 시각';
COMMENT ON COLUMN conversions.refund_amount IS '환불 금액 (부분 환불 포함)';
COMMENT ON COLUMN conversions.synced_at IS 'Google Sheets에서 마지막 동기화 시각';

-- 3. Create index for performance
CREATE INDEX IF NOT EXISTS idx_conversions_status ON conversions(order_status);

-- 4. Update existing records to confirmed status
UPDATE conversions 
SET order_status = 'confirmed' 
WHERE order_status IS NULL;

-- Verification query
-- SELECT order_id, order_status, final_payment, cancelled_at 
-- FROM conversions 
-- ORDER BY timestamp DESC 
-- LIMIT 10;

