-- ============================================================================
-- Add IP Tracking Support
-- Date: 2025-10-20
-- Purpose: Track user IP addresses for "동일 IP 유입 기록" analysis
-- ============================================================================

-- 1. Add IP columns to visitors table
ALTER TABLE visitors 
ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45),
ADD COLUMN IF NOT EXISTS last_ip VARCHAR(45);

-- 2. Add IP column to sessions table
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_visitors_last_ip ON visitors(last_ip);
CREATE INDEX IF NOT EXISTS idx_sessions_ip ON sessions(ip_address);

-- 4. Add comments for clarity
COMMENT ON COLUMN visitors.ip_address IS 'IP address from first visit';
COMMENT ON COLUMN visitors.last_ip IS 'IP address from most recent visit';
COMMENT ON COLUMN sessions.ip_address IS 'IP address for this session';

-- 5. Verification query (run manually to check)
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'visitors' AND column_name LIKE '%ip%';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'sessions' AND column_name LIKE '%ip%';

