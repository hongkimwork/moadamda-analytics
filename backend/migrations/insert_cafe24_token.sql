-- ============================================================================
-- Cafe24 Initial Token Insert
-- ============================================================================
-- 최초 OAuth 인증으로 발급받은 토큰을 저장합니다.
-- 
-- 주의: 이 토큰은 발급 후 2시간이 지나면 만료됩니다.
-- 만료된 경우 새로 인증을 받거나, refresh_token으로 갱신해야 합니다.
--
-- 실행 방법:
-- ssh root@49.50.139.223 'docker exec -i ma-postgres psql -U moadamda -d analytics' < backend/migrations/insert_cafe24_token.sql
-- ============================================================================

-- 기존 토큰이 있으면 삭제 (선택사항 - 필요시 주석 해제)
-- DELETE FROM cafe24_token;

-- 2025-11-26 14:33에 발급받은 토큰
-- Access Token 만료: 2025-11-26T16:33:16 (2시간 후)
-- Refresh Token 만료: 2025-12-10T14:33:16 (2주 후)
INSERT INTO cafe24_token (access_token, refresh_token, issued_date, expire_date)
VALUES (
  'lxdaZ0wBPxHnplRDH8Bf2B',
  'LGkhYu2fZq9ANEz1ePbt7I',
  '2025-11-26 14:33:16',
  '2025-11-26 16:33:16'
);

-- 저장된 토큰 확인
SELECT 
  idx,
  substring(access_token, 1, 10) || '...' as access_token_preview,
  substring(refresh_token, 1, 10) || '...' as refresh_token_preview,
  issued_date,
  expire_date,
  CASE 
    WHEN expire_date < NOW() THEN 'EXPIRED'
    ELSE 'VALID'
  END as status
FROM cafe24_token
ORDER BY idx DESC
LIMIT 1;

