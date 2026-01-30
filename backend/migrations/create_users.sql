-- Users table for authentication system
-- Created: 2026-01-30

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- role constraint: master, admin, user
  CONSTRAINT valid_role CHECK (role IN ('master', 'admin', 'user'))
);

-- Index for email lookup (login)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Index for role filtering
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_users_updated_at ON users;
CREATE TRIGGER trigger_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_users_updated_at();

-- Comments
COMMENT ON TABLE users IS '대시보드 사용자 인증 테이블';
COMMENT ON COLUMN users.role IS 'master: 전체 권한, admin: 일반 사용자 관리 가능, user: 일반 사용자';
