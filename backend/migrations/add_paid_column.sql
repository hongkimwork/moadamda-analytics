-- Add paid column to conversions table
-- This column tracks payment completion status from Cafe24 API
-- 'T' = Payment completed (입금 완료)
-- 'F' = Payment pending (입금 대기, e.g. 무통장입금 대기)

-- Add paid column
ALTER TABLE conversions 
ADD COLUMN IF NOT EXISTS paid CHAR(1) DEFAULT 'T';

-- Set existing data to 'T' (assume completed) - will be updated via backfill
UPDATE conversions SET paid = 'T' WHERE paid IS NULL;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_conversions_paid ON conversions(paid);

-- Add comment
COMMENT ON COLUMN conversions.paid IS '결제 완료 여부 (T=완료, F=대기) - Cafe24 API paid 필드';

-- Confirmation message
DO $$ BEGIN
    RAISE NOTICE 'paid column added successfully to conversions table';
END $$;

