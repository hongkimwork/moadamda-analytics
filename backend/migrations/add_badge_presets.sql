-- Add badge_presets table for storing recently used badges
-- This allows users to quickly reuse previously created badges

-- 1. Create badge_presets table
CREATE TABLE IF NOT EXISTS badge_presets (
  id SERIAL PRIMARY KEY,
  text VARCHAR(50) NOT NULL,
  bg_color VARCHAR(20) NOT NULL DEFAULT '#1677ff',
  text_color VARCHAR(20) NOT NULL DEFAULT '#ffffff',
  use_count INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create unique index on text + bg_color + text_color combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_badge_presets_unique 
ON badge_presets(text, bg_color, text_color);

-- 3. Create index for sorting by updated_at (most recently used)
CREATE INDEX IF NOT EXISTS idx_badge_presets_updated 
ON badge_presets(updated_at DESC);

-- 4. Add comments
COMMENT ON TABLE badge_presets IS 'Stores recently used badge presets for quick reuse';
COMMENT ON COLUMN badge_presets.text IS 'Badge text (e.g., 모로실, HQ)';
COMMENT ON COLUMN badge_presets.bg_color IS 'Background color hex code';
COMMENT ON COLUMN badge_presets.text_color IS 'Text color hex code';
COMMENT ON COLUMN badge_presets.use_count IS 'Number of times this preset was used';
COMMENT ON COLUMN badge_presets.updated_at IS 'Last time this preset was used (for sorting)';

-- Note: badges JSONB in url_mappings now supports text_color field:
-- [
--   {"text": "건강", "color": "#ef4444", "text_color": "#ffffff", "order": 1},
--   {"text": "신제품", "color": "#fbbf24", "text_color": "#1f2937", "order": 2}
-- ]

