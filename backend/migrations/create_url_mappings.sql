-- Page URL Mapping Table Creation
-- Purpose: Map page URLs to Korean names for intuitive display
-- Created: 2025-10-22

-- 1. Create url_mappings table
CREATE TABLE IF NOT EXISTS url_mappings (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  korean_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Add UNIQUE constraint to prevent duplicate URLs
CREATE UNIQUE INDEX IF NOT EXISTS idx_url_mappings_url_unique ON url_mappings(url);

-- 3. Add indexes for search performance
CREATE INDEX IF NOT EXISTS idx_url_mappings_korean_name ON url_mappings(korean_name);
CREATE INDEX IF NOT EXISTS idx_url_mappings_created_at ON url_mappings(created_at);

-- 4. Add table comments
COMMENT ON TABLE url_mappings IS 'Page URL to Korean name mapping table';
COMMENT ON COLUMN url_mappings.url IS 'Clean page URL without UTM parameters';
COMMENT ON COLUMN url_mappings.korean_name IS 'User-defined Korean page name';
COMMENT ON COLUMN url_mappings.created_at IS 'Mapping creation time';
COMMENT ON COLUMN url_mappings.updated_at IS 'Mapping update time';

-- 5. Create updated_at auto-update function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Create updated_at auto-update trigger
DROP TRIGGER IF EXISTS update_url_mappings_updated_at ON url_mappings;
CREATE TRIGGER update_url_mappings_updated_at
    BEFORE UPDATE ON url_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'url_mappings table created successfully';
END $$;
