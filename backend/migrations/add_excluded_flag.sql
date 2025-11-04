-- Add is_excluded flag to url_mappings table
-- This flag indicates URLs that should be excluded from the unmapped list

-- Add is_excluded column (default false)
ALTER TABLE url_mappings 
ADD COLUMN IF NOT EXISTS is_excluded BOOLEAN DEFAULT false;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_url_mappings_is_excluded ON url_mappings(is_excluded);

-- Add constraint: if is_excluded is true, korean_name can be null
-- (We'll allow NULL korean_name for excluded URLs)
ALTER TABLE url_mappings 
ALTER COLUMN korean_name DROP NOT NULL;

-- Add check constraint: either korean_name is provided OR is_excluded is true
ALTER TABLE url_mappings
DROP CONSTRAINT IF EXISTS check_korean_name_or_excluded;

ALTER TABLE url_mappings
ADD CONSTRAINT check_korean_name_or_excluded 
CHECK (
  (korean_name IS NOT NULL AND is_excluded = false) OR 
  (korean_name IS NULL AND is_excluded = true)
);

-- Comments
COMMENT ON COLUMN url_mappings.is_excluded IS 'True if this URL should be excluded from unmapped list';

-- Confirmation message
DO $$ BEGIN
    RAISE NOTICE 'is_excluded flag added successfully';
END $$;

