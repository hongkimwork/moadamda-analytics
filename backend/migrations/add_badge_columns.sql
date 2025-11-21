-- Add product page and badge columns to url_mappings table
-- Purpose: Allow users to classify pages as product pages and assign badges
-- Created: 2025-11-20

ALTER TABLE url_mappings
ADD COLUMN IF NOT EXISTS is_product_page BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS badge_text VARCHAR(50),
ADD COLUMN IF NOT EXISTS badge_color VARCHAR(20);

COMMENT ON COLUMN url_mappings.is_product_page IS 'Whether this page is a product page';
COMMENT ON COLUMN url_mappings.badge_text IS 'Text to display in the badge';
COMMENT ON COLUMN url_mappings.badge_color IS 'Color of the badge';

DO $$
BEGIN
    RAISE NOTICE 'url_mappings table updated successfully with badge columns';
END $$;
