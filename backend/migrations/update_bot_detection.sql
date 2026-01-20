-- 봇 감지 로직 개선 마이그레이션
-- Meta/Apple/Google 크롤러 IP 대역을 봇으로 표시

-- 1. Meta/Facebook 크롤러 IP 대역 (31.13.*, 69.63.*, 66.220.*, 173.252.*, 157.240.*, 179.60.*)
UPDATE visitors SET is_bot = true 
WHERE ip_address LIKE '31.13.%' 
   OR ip_address LIKE '69.63.%' 
   OR ip_address LIKE '66.220.%' 
   OR ip_address LIKE '173.252.%'
   OR ip_address LIKE '157.240.%'
   OR ip_address LIKE '179.60.%';

-- 2. Apple 봇 IP 대역 (17.*)
UPDATE visitors SET is_bot = true 
WHERE ip_address LIKE '17.%';

-- 3. Google 크롤러 IP 대역 (66.249.*, 64.233.*, 72.14.*, 74.125.*)
UPDATE visitors SET is_bot = true 
WHERE ip_address LIKE '66.249.%' 
   OR ip_address LIKE '64.233.%' 
   OR ip_address LIKE '72.14.%'
   OR ip_address LIKE '74.125.%';

-- 4. Microsoft/Bing 크롤러 IP 대역 (40.77.*, 157.55.*, 207.46.*)
UPDATE visitors SET is_bot = true 
WHERE ip_address LIKE '40.77.%' 
   OR ip_address LIKE '157.55.%' 
   OR ip_address LIKE '207.46.%';

-- 5. 기타 알려진 호스팅/봇 서버 (198.64.*, 198.55.*)
UPDATE visitors SET is_bot = true 
WHERE ip_address LIKE '198.64.%' 
   OR ip_address LIKE '198.55.%';

-- 결과 확인
SELECT 
  'Total visitors' as category,
  COUNT(*) as count
FROM visitors
UNION ALL
SELECT 
  'Marked as bot' as category,
  COUNT(*) as count
FROM visitors WHERE is_bot = true
UNION ALL
SELECT 
  'Normal visitors' as category,
  COUNT(*) as count
FROM visitors WHERE is_bot = false;
