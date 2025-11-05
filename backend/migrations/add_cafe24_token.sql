-- ============================================================================
-- Cafe24 API Token Management
-- ============================================================================
-- This table stores Cafe24 OAuth tokens and automatically refreshes them
-- Based on moadamda-access-log implementation
-- ============================================================================

CREATE TABLE IF NOT EXISTS cafe24_token (
  idx SERIAL PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  issued_date TIMESTAMP DEFAULT NOW(),
  expire_date TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster token retrieval
CREATE INDEX IF NOT EXISTS idx_cafe24_token_expire_date ON cafe24_token(expire_date DESC);

-- Add comments
COMMENT ON TABLE cafe24_token IS 'Stores Cafe24 OAuth tokens with automatic refresh capability';
COMMENT ON COLUMN cafe24_token.access_token IS 'OAuth Access Token (valid for 2 hours)';
COMMENT ON COLUMN cafe24_token.refresh_token IS 'OAuth Refresh Token (valid for 2 weeks, renewed on each refresh)';
COMMENT ON COLUMN cafe24_token.expire_date IS 'Access Token expiration time (from expires_at field)';

