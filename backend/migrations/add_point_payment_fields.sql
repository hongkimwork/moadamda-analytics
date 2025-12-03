-- Add point/credit payment and order status fields to conversions table
-- Created: 2025-12-03
-- Purpose: Support point payment display and cancel/refund status tracking

-- 1. Add point/credit payment columns
ALTER TABLE conversions
ADD COLUMN IF NOT EXISTS points_spent INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS credits_spent INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS order_place_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS payment_method_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS cafe24_status VARCHAR(20),
ADD COLUMN IF NOT EXISTS canceled CHAR(1) DEFAULT 'F';

-- 2. Add comments for clarity
COMMENT ON COLUMN conversions.points_spent IS '포인트 사용 금액 (네이버페이 포인트 등) - Cafe24 points_spent_amount';
COMMENT ON COLUMN conversions.credits_spent IS '적립금 사용 금액 - Cafe24 credits_spent_amount';
COMMENT ON COLUMN conversions.order_place_name IS '주문 경로 (네이버 페이, 카카오페이 등) - Cafe24 order_place_name';
COMMENT ON COLUMN conversions.payment_method_name IS '결제 수단 이름 (신용카드, 휴대폰 등) - Cafe24 payment_method_name';
COMMENT ON COLUMN conversions.cafe24_status IS 'Cafe24 주문 상태 코드 (N20=배송준비중, C10=취소완료, R10=반품완료 등)';
COMMENT ON COLUMN conversions.canceled IS '취소 여부 (T=취소됨, F=정상) - Cafe24 canceled 필드';

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversions_points_spent ON conversions(points_spent);
CREATE INDEX IF NOT EXISTS idx_conversions_canceled ON conversions(canceled);
CREATE INDEX IF NOT EXISTS idx_conversions_cafe24_status ON conversions(cafe24_status);

-- 4. Update existing records (set defaults)
UPDATE conversions 
SET 
  points_spent = 0,
  credits_spent = 0,
  canceled = 'F'
WHERE points_spent IS NULL;

-- Verification query
-- SELECT order_id, total_amount, final_payment, points_spent, credits_spent, 
--        order_place_name, payment_method_name, cafe24_status, canceled
-- FROM conversions 
-- ORDER BY timestamp DESC 
-- LIMIT 10;

