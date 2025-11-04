-- Phase 2.6: Add detailed payment information to conversions table
-- Created: 2025-01-18

ALTER TABLE conversions
ADD COLUMN discount_amount INTEGER DEFAULT 0,
ADD COLUMN mileage_used INTEGER DEFAULT 0,
ADD COLUMN shipping_fee INTEGER DEFAULT 0,
ADD COLUMN final_payment INTEGER DEFAULT 0;

-- Add comments for clarity
COMMENT ON COLUMN conversions.discount_amount IS '총 할인금액 (쿠폰 등)';
COMMENT ON COLUMN conversions.mileage_used IS '사용한 적립금';
COMMENT ON COLUMN conversions.shipping_fee IS '배송비';
COMMENT ON COLUMN conversions.final_payment IS '최종 결제금액 (실제 결제액)';

-- Create index for final_payment queries (for revenue analysis)
CREATE INDEX idx_conversions_final_payment ON conversions(final_payment);

