-- Add source_type column to url_mappings table
-- This column tracks whether a URL was automatically collected or manually added

ALTER TABLE url_mappings 
ADD COLUMN IF NOT EXISTS source_type VARCHAR(10) DEFAULT 'auto';

-- Update existing records to 'auto' (all current URLs are automatically collected)
UPDATE url_mappings 
SET source_type = 'auto' 
WHERE source_type IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN url_mappings.source_type IS 
'Source of URL: "auto" for visitor-collected URLs, "manual" for admin-added URLs';

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_url_mappings_source_type ON url_mappings(source_type);

