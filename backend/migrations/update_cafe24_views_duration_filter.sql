-- ============================================================================
-- 카페24 호환 뷰/함수 업데이트 - 체류시간 필터 추가
-- 생성일: 2026-01-19
-- 목적: 카페24와 동일하게 "체류시간이 기록된 방문"만 집계
-- 
-- 변경 내용:
-- - 모든 세션 기반 쿼리에 duration_seconds > 0 조건 추가
-- - 페이지를 열고 바로 나간 방문(체류시간 0초)은 제외
-- ============================================================================

-- ============================================================================
-- 1. 카페24 호환 세션 뷰 (봇 제외 + 체류시간 필터)
-- ============================================================================
DROP VIEW IF EXISTS v_sessions_cafe24 CASCADE;

CREATE VIEW v_sessions_cafe24 AS
SELECT 
  s.session_id,
  s.visitor_id,
  s.start_time,
  s.end_time,
  s.pageview_count,
  s.duration_seconds,
  s.entry_url,
  s.exit_url,
  s.is_bounced,
  s.is_converted,
  s.created_at
FROM sessions s
JOIN visitors v ON s.visitor_id = v.visitor_id
WHERE v.is_bot = false
  AND s.duration_seconds > 0;  -- 체류시간이 기록된 세션만

COMMENT ON VIEW v_sessions_cafe24 IS '카페24 호환 세션 뷰 - 봇 제외, 체류시간 0초 제외';

-- ============================================================================
-- 2. 카페24 호환 페이지뷰 뷰 (봇 제외 + 세션 내 중복 URL 제외)
-- 체류시간 있는 세션의 페이지뷰만 포함
-- ============================================================================
DROP VIEW IF EXISTS v_pageviews_cafe24 CASCADE;

CREATE VIEW v_pageviews_cafe24 AS
SELECT DISTINCT ON (p.session_id, p.page_url)
  p.id,
  p.session_id,
  p.visitor_id,
  p.page_url,
  p.page_title,
  p.timestamp,
  p.time_spent,
  p.site_version,
  p.created_at
FROM pageviews p
JOIN visitors v ON p.visitor_id = v.visitor_id
JOIN sessions s ON p.session_id = s.session_id
WHERE v.is_bot = false
  AND s.duration_seconds > 0  -- 체류시간이 기록된 세션만
ORDER BY p.session_id, p.page_url, p.timestamp;

COMMENT ON VIEW v_pageviews_cafe24 IS '카페24 호환 페이지뷰 뷰 - 봇 제외, 체류시간 0초 세션 제외, 세션 내 동일 URL 중복 제거';

-- ============================================================================
-- 3. 카페24 호환 방문자 뷰 (봇 제외)
-- 변경 없음 - 방문자 자체는 필터링하지 않음
-- ============================================================================
DROP VIEW IF EXISTS v_visitors_cafe24 CASCADE;

CREATE VIEW v_visitors_cafe24 AS
SELECT 
  v.visitor_id,
  v.first_visit,
  v.last_visit,
  v.visit_count,
  v.device_type,
  v.browser,
  v.os,
  v.referrer_type,
  v.utm_source,
  v.utm_medium,
  v.utm_campaign,
  v.utm_params,
  v.created_at
FROM visitors v
WHERE v.is_bot = false;

COMMENT ON VIEW v_visitors_cafe24 IS '카페24 호환 방문자 뷰 - 봇 제외';

-- ============================================================================
-- 4. 일별 방문 통계 함수 (카페24 호환) - 체류시간 필터 추가
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
      AND s.duration_seconds > 0  -- 체류시간이 기록된 세션만
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

COMMENT ON FUNCTION get_daily_visits_cafe24 IS '카페24 호환 일별 방문 통계 - 봇 제외, 체류시간 0초 제외, 재방문자는 해당 날짜 이전에 첫 방문한 사람';

-- ============================================================================
-- 5. 기간 합계 방문 통계 함수 (카페24 호환) - 체류시간 필터 추가
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
      AND s.duration_seconds > 0  -- 체류시간이 기록된 세션만
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

COMMENT ON FUNCTION get_visit_summary_cafe24 IS '카페24 호환 기간 합계 방문 통계 - 봇 제외, 체류시간 0초 제외';

-- ============================================================================
-- 6. 페이지뷰 통계 함수 (카페24 호환) - 체류시간 필터 추가
-- ============================================================================
DROP FUNCTION IF EXISTS get_pageview_stats_cafe24(DATE, DATE);

CREATE OR REPLACE FUNCTION get_pageview_stats_cafe24(p_start_date DATE, p_end_date DATE)
RETURNS TABLE (
  site_version VARCHAR,
  pageviews BIGINT,
  first_sessions BIGINT,
  pv_per_session NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH unique_pageviews AS (
    SELECT DISTINCT 
      p.site_version,
      p.session_id,
      p.page_url
    FROM pageviews p
    JOIN visitors v ON p.visitor_id = v.visitor_id
    JOIN sessions s ON p.session_id = s.session_id
    WHERE p.timestamp >= p_start_date 
      AND p.timestamp < (p_end_date + interval '1 day')
      AND v.is_bot = false
      AND s.duration_seconds > 0  -- 체류시간이 기록된 세션만
  )
  SELECT 
    COALESCE(up.site_version, 'unknown')::VARCHAR as site_version,
    COUNT(*)::BIGINT as pageviews,
    COUNT(DISTINCT up.session_id)::BIGINT as first_sessions,
    ROUND(COUNT(*)::NUMERIC / NULLIF(COUNT(DISTINCT up.session_id), 0), 1) as pv_per_session
  FROM unique_pageviews up
  GROUP BY up.site_version
  ORDER BY pageviews DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_pageview_stats_cafe24 IS '카페24 호환 페이지뷰 통계 - 봇 제외, 체류시간 0초 세션 제외, 세션 내 동일 URL 중복 제거';

-- ============================================================================
-- 7. 일별 방문 통계 함수 (카페24 호환) - 재방문 횟수 포함 버전
-- 카페24 "순방문자 수" 화면과 동일한 데이터 반환
-- ============================================================================
DROP FUNCTION IF EXISTS get_daily_visits_cafe24_full(DATE, DATE);

CREATE OR REPLACE FUNCTION get_daily_visits_cafe24_full(p_start_date DATE, p_end_date DATE)
RETURNS TABLE (
  date DATE,
  total_visits BIGINT,        -- 전체방문
  unique_visitors BIGINT,     -- 순방문수
  returning_visits BIGINT,    -- 재방문수 (재방문자들의 방문 횟수)
  prev_total_visits BIGINT,   -- 비교값 (전일 전체방문)
  change_rate NUMERIC         -- 증감률 (%)
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
    WHERE s.start_time >= (p_start_date - interval '1 day')  -- 전일 데이터도 필요
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
  WHERE s.visit_date >= p_start_date  -- 실제 조회 기간만 반환
  ORDER BY s.visit_date;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_daily_visits_cafe24_full IS '카페24 "순방문자 수" 화면 호환 - 전체방문, 순방문수, 재방문수, 비교값, 증감률';
