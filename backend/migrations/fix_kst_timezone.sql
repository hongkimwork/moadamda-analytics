-- ============================================================================
-- 타임존 변환 버그 수정
-- 수정일: 2026-01-19
-- 
-- 문제: 데이터가 이미 KST로 저장되어 있는데, AT TIME ZONE 변환을 적용하면
--       이중 변환이 발생하여 자정~오전 9시 데이터가 전날로 잘못 집계됨
-- 
-- 해결: AT TIME ZONE 변환 제거, DATE(start_time) 직접 사용
-- ============================================================================

-- ============================================================================
-- 1. get_daily_visits_cafe24_full 함수 (비교값/증감률 포함)
-- ============================================================================
DROP FUNCTION IF EXISTS get_daily_visits_cafe24_full(DATE, DATE);

CREATE OR REPLACE FUNCTION get_daily_visits_cafe24_full(p_start_date DATE, p_end_date DATE)
RETURNS TABLE (
  date DATE,
  total_visits BIGINT,
  unique_visitors BIGINT,
  returning_visits BIGINT,
  prev_total_visits BIGINT,
  change_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH daily_sessions AS (
    SELECT 
      DATE(s.start_time) as visit_date,
      s.visitor_id,
      v.first_visit,
      COUNT(*) as session_count
    FROM sessions s
    JOIN visitors v ON s.visitor_id = v.visitor_id
    WHERE s.start_time >= (p_start_date - interval '1 day')
      AND s.start_time < (p_end_date + interval '1 day')
      AND v.is_bot = false
      AND s.duration_seconds > 0
    GROUP BY DATE(s.start_time), s.visitor_id, v.first_visit
  ),
  daily_stats AS (
    SELECT 
      ds.visit_date,
      SUM(ds.session_count)::BIGINT as total_visits,
      COUNT(DISTINCT ds.visitor_id)::BIGINT as unique_visitors,
      SUM(CASE 
        WHEN DATE(ds.first_visit) < ds.visit_date THEN ds.session_count 
        ELSE 0 
      END)::BIGINT as returning_visits
    FROM daily_sessions ds
    GROUP BY ds.visit_date
  )
  SELECT 
    s.visit_date as date,
    s.total_visits,
    s.unique_visitors,
    s.returning_visits,
    LAG(s.total_visits) OVER (ORDER BY s.visit_date) as prev_total_visits,
    ROUND(
      (s.total_visits - LAG(s.total_visits) OVER (ORDER BY s.visit_date))::NUMERIC 
      / NULLIF(LAG(s.total_visits) OVER (ORDER BY s.visit_date), 0) * 100, 
      2
    ) as change_rate
  FROM daily_stats s
  WHERE s.visit_date >= p_start_date
  ORDER BY s.visit_date;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_daily_visits_cafe24_full IS '카페24 호환 일별 통계 - 전체방문, 순방문수, 재방문수, 비교값, 증감률';

-- ============================================================================
-- 2. get_daily_visits_cafe24 함수 (기본)
-- ============================================================================
DROP FUNCTION IF EXISTS get_daily_visits_cafe24(DATE, DATE);

CREATE OR REPLACE FUNCTION get_daily_visits_cafe24(p_start_date DATE, p_end_date DATE)
RETURNS TABLE (
  date DATE,
  total_visits BIGINT,
  unique_visitors BIGINT,
  returning_visitors BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH daily_sessions AS (
    SELECT 
      DATE(s.start_time) as visit_date,
      s.visitor_id,
      v.first_visit,
      COUNT(*) as session_count
    FROM sessions s
    JOIN visitors v ON s.visitor_id = v.visitor_id
    WHERE s.start_time >= p_start_date 
      AND s.start_time < (p_end_date + interval '1 day')
      AND v.is_bot = false
      AND s.duration_seconds > 0
    GROUP BY DATE(s.start_time), s.visitor_id, v.first_visit
  )
  SELECT 
    ds.visit_date as date,
    SUM(ds.session_count)::BIGINT as total_visits,
    COUNT(DISTINCT ds.visitor_id)::BIGINT as unique_visitors,
    COUNT(DISTINCT CASE 
      WHEN DATE(ds.first_visit) < ds.visit_date THEN ds.visitor_id 
    END)::BIGINT as returning_visitors
  FROM daily_sessions ds
  GROUP BY ds.visit_date
  ORDER BY ds.visit_date;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_daily_visits_cafe24 IS '카페24 호환 일별 방문 통계 - 봇 제외, 체류시간 0초 제외';

-- ============================================================================
-- 3. get_visit_summary_cafe24 함수 (기간 합계)
-- ============================================================================
DROP FUNCTION IF EXISTS get_visit_summary_cafe24(DATE, DATE);

CREATE OR REPLACE FUNCTION get_visit_summary_cafe24(p_start_date DATE, p_end_date DATE)
RETURNS TABLE (
  total_visits BIGINT,
  unique_visitors BIGINT,
  returning_visitors BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH visitor_sessions AS (
    SELECT 
      s.visitor_id,
      v.first_visit,
      COUNT(*) as session_count
    FROM sessions s
    JOIN visitors v ON s.visitor_id = v.visitor_id
    WHERE s.start_time >= p_start_date 
      AND s.start_time < (p_end_date + interval '1 day')
      AND v.is_bot = false
      AND s.duration_seconds > 0
    GROUP BY s.visitor_id, v.first_visit
  )
  SELECT 
    SUM(vs.session_count)::BIGINT as total_visits,
    COUNT(DISTINCT vs.visitor_id)::BIGINT as unique_visitors,
    COUNT(DISTINCT CASE 
      WHEN DATE(vs.first_visit) < p_start_date THEN vs.visitor_id 
    END)::BIGINT as returning_visitors
  FROM visitor_sessions vs;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_visit_summary_cafe24 IS '카페24 호환 기간 합계 통계 - 봇 제외, 체류시간 0초 제외';
