-- Add badges JSONB column to url_mappings table
-- Multiple badges support (max 10 badges per mapping)
-- Maintains backward compatibility with badge_text and badge_color

ALTER TABLE url_mappings
ADD COLUMN IF NOT EXISTS badges JSONB DEFAULT NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_url_mappings_badges ON url_mappings USING GIN (badges);

-- Add comments
COMMENT ON COLUMN url_mappings.badges IS 'Array of badge objects: [{"text": "건강", "color": "#ef4444", "order": 1}, ...]';

-- Example data structure:
-- [
--   {"text": "건강", "color": "#ef4444", "order": 1},
--   {"text": "피부", "color": "#3b82f6", "order": 2},
--   {"text": "다이어트", "color": "#10b981", "order": 3}
-- ]

