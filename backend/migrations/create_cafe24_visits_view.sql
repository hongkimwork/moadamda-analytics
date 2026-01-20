-- ============================================================================
-- 카페24 "최근 방문자" 호환 뷰
-- 생성일: 2026-01-16
-- 목적: 카페24 "최근 방문자" 데이터와 동일한 기준으로 방문 기록 추출
-- ============================================================================
-- 
-- 카페24 "최근 방문자" 데이터 정의:
-- - IP: 방문자 장비의 네트워크 식별 주소
-- - 유입출처: 방문 전 접속한 웹 페이지 주소 (referrer)
-- - 방문일시: IP 기준 쇼핑몰 사이트 방문(접속) 일시
--
-- 카페24 수집 패턴 분석:
-- - 같은 IP가 여러 번 기록됨 (예: 58.227.70.113이 3번)
-- - 각각 다른 유입출처와 시간으로 기록
-- - 페이지뷰마다 기록하는 게 아니라, 새로운 "방문"마다 기록
-- - "방문" = 세션 시작 시점 (새 세션이 생성될 때)
--
-- 결론: 카페24는 "세션 시작 시점"을 기록함
-- 우리 시스템의 sessions 테이블의 start_time이 이에 해당
-- ============================================================================

-- 카페24 "최근 방문자" 호환 뷰
-- 세션 시작 시점 기준 (카페24와 동일)
DROP VIEW IF EXISTS v_visits_cafe24_style CASCADE;

CREATE VIEW v_visits_cafe24_style AS
SELECT 
  s.session_id,
  s.visitor_id,
  REPLACE(s.ip_address, E'\\', '') as ip_address,  -- 백슬래시 제거
  s.start_time as visit_time,
  s.utm_params,
  s.entry_url,
  -- 유입출처 추출 (카페24 형식에 맞게)
  CASE 
    WHEN s.utm_params IS NOT NULL AND s.utm_params->>'utm_source' IS NOT NULL 
    THEN s.utm_params->>'utm_source'
    ELSE '(직접 방문)'
  END as source
FROM sessions s
JOIN visitors v ON s.visitor_id = v.visitor_id
WHERE v.is_bot = false
ORDER BY s.start_time DESC;

COMMENT ON VIEW v_visits_cafe24_style IS '카페24 "최근 방문자" 호환 뷰 - 세션 시작 시점 기준, 봇 제외';

-- ============================================================================
-- 일별 방문 건수 확인용 함수
-- ============================================================================
DROP FUNCTION IF EXISTS get_visits_cafe24_style(DATE);

CREATE OR REPLACE FUNCTION get_visits_cafe24_style(p_date DATE)
RETURNS TABLE (
  ip_address TEXT,
  source TEXT,
  visit_time TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.ip_address,
    v.source,
    v.visit_time
  FROM v_visits_cafe24_style v
  WHERE v.visit_time >= p_date
    AND v.visit_time < (p_date + interval '1 day')
  ORDER BY v.visit_time DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_visits_cafe24_style IS '특정 날짜의 카페24 스타일 방문 기록 조회';

-- ============================================================================
-- 확인용 쿼리 (실행 후 삭제 가능)
-- ============================================================================
-- SELECT COUNT(*) FROM v_visits_cafe24_style WHERE visit_time >= '2026-01-12' AND visit_time < '2026-01-13';
-- SELECT * FROM get_visits_cafe24_style('2026-01-12'::DATE) LIMIT 20;
