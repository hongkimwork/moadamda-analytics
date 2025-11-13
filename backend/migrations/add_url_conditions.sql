-- Add url_conditions column for complex URL matching
-- This allows multiple URL patterns with OR/AND operations

-- Add JSONB column to store complex URL conditions
ALTER TABLE url_mappings 
ADD COLUMN IF NOT EXISTS url_conditions JSONB DEFAULT NULL;

-- Update existing records to keep backward compatibility
-- Records with url_conditions = NULL will use simple URL matching
COMMENT ON COLUMN url_mappings.url_conditions IS 
'JSONB structure for complex URL matching: {operator: "OR|AND", groups: [{base_url, params: {operator, conditions}}]}';

-- Create index for JSONB queries (performance optimization)
CREATE INDEX IF NOT EXISTS idx_url_mappings_conditions 
ON url_mappings USING GIN (url_conditions);

-- Example data structure:
-- {
--   "operator": "OR",
--   "groups": [
--     {
--       "base_url": "https://m.moadamda.com/product/detail",
--       "params": {
--         "operator": "AND",
--         "conditions": [
--           {"key": "no", "value": "1001"}
--         ]
--       }
--     },
--     {
--       "base_url": "https://m.moadamda.com/product/detail",
--       "params": {
--         "operator": "AND",
--         "conditions": [
--           {"key": "no", "value": "2003"}
--         ]
--       }
--     }
--   ]
-- }

