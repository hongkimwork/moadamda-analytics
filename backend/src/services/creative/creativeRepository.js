/**
 * 광고 소재 분석 Repository
 * DB 쿼리 로직만 담당
 */

const db = require('../../utils/database');

/**
 * 광고 소재별 집계 데이터 조회
 * @param {Object} params - 쿼리 파라미터
 * @param {Date} params.startDate - 시작일
 * @param {Date} params.endDate - 종료일
 * @param {string} params.searchCondition - 검색 조건 SQL
 * @param {string} params.utmFilterConditions - UTM 필터 조건 SQL
 * @param {string} params.sortColumn - 정렬 컬럼
 * @param {string} params.sortDirectionSQL - 정렬 방향 (ASC/DESC)
 * @param {Array} params.queryParams - SQL 쿼리 파라미터 배열
 * @param {number} params.maxDurationSeconds - 이상치 기준 (초 단위, 기본값 300)
 * @returns {Promise<Array>} - 집계 데이터 배열
 */
async function getCreativeAggregation({
  startDate,
  endDate,
  searchCondition,
  utmFilterConditions,
  sortColumn,
  sortDirectionSQL,
  queryParams,
  maxDurationSeconds = 300,
  maxPvCount = 15,
  maxScrollPx = 10000,
  minDurationSeconds = 0,
  minPvCount = 0,
  minScrollPx = 0
}) {
  // 카페24 호환: visitors 테이블과 조인하여 봇 트래픽 제외
  // FIX (2026-01-23): View를 "진입 횟수"로 변경
  // - 기존: 고유 세션 수 (같은 세션에서 여러 번 진입해도 1번)
  // - 변경: 광고 클릭 → 진입 횟수 (같은 세션에서 여러 번 진입하면 각각 카운트)
  // - 평균 지표(PV, 체류시간, 스크롤)는 고유 세션 기준 유지
  // FIX (2026-01-27): utm_source 빈 문자열 처리 통일
  // - 기존: utm_source 그대로 사용 → 빈 문자열과 'meta'가 별도 행으로 분리
  // - 변경: COALESCE(NULLIF(...), '-') 적용 → 기여도 계산 쿼리와 동일하게 처리
  const dataQuery = `
    WITH all_entries AS (
      -- 모든 진입 기록 (View 계산용)
      SELECT 
        us.session_id,
        us.visitor_id,
        us.utm_params->>'utm_content' as creative_name,
        COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') as utm_source,
        COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') as utm_medium,
        COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') as utm_campaign
      FROM utm_sessions us
      JOIN visitors v ON us.visitor_id = v.visitor_id
      WHERE us.utm_params->>'utm_content' IS NOT NULL
        AND us.entry_timestamp >= $1
        AND us.entry_timestamp <= $2
        AND v.is_bot = false
        ${searchCondition}
        ${utmFilterConditions}
    ),
    unique_sessions AS (
      -- 고유 세션 (평균 지표 계산용)
      SELECT DISTINCT ON (
        us.utm_params->>'utm_content',
        COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-'), 
        COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-'),
        COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-'),
        us.session_id
      )
        us.session_id,
        us.visitor_id,
        us.utm_params->>'utm_content' as creative_name,
        COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') as utm_source,
        COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') as utm_medium,
        COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') as utm_campaign,
        s.pageview_count,
        s.duration_seconds
      FROM utm_sessions us
      JOIN visitors v ON us.visitor_id = v.visitor_id
      JOIN sessions s ON us.session_id = s.session_id
      WHERE us.utm_params->>'utm_content' IS NOT NULL
        AND us.entry_timestamp >= $1
        AND us.entry_timestamp <= $2
        AND v.is_bot = false
        ${searchCondition}
        ${utmFilterConditions}
      ORDER BY us.utm_params->>'utm_content', COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-'), COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-'), COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-'), us.session_id
    ),
    entry_counts AS (
      -- 광고별 진입 횟수 집계
      SELECT 
        creative_name,
        utm_source,
        utm_medium,
        utm_campaign,
        COUNT(*) as total_views,
        COUNT(DISTINCT visitor_id) as unique_visitors
      FROM all_entries
      GROUP BY creative_name, utm_source, utm_medium, utm_campaign
    ),
    scroll_data AS (
      -- 세션별 스크롤 합계 (events 테이블에서)
      SELECT 
        session_id,
        ROUND(SUM((metadata->>'max_scroll_px')::NUMERIC)) as total_scroll_px
      FROM events 
      WHERE event_type = 'scroll_depth'
        AND (metadata->>'max_scroll_px') IS NOT NULL
      GROUP BY session_id
    ),
    session_metrics AS (
      -- 고유 세션 기준 평균 지표 집계
      -- 이하치 이하: 제외 (NULL), 이상치 초과: 기준값으로 대체
      SELECT 
        us.creative_name,
        us.utm_source,
        us.utm_medium,
        us.utm_campaign,
        ROUND(
          COALESCE(
            AVG(
              CASE 
                WHEN us.pageview_count <= ${minPvCount} THEN NULL  -- 이하치 이하 제외
                WHEN us.pageview_count <= ${maxPvCount} THEN us.pageview_count  -- 정상 범위
                ELSE ${maxPvCount}  -- 이상치 대체
              END
            )::NUMERIC,
            0
          ),
          1
        ) as avg_pageviews,
        ROUND(
          COALESCE(
            AVG(
              CASE 
                WHEN us.duration_seconds <= ${minDurationSeconds} THEN NULL  -- 이하치 이하 제외
                WHEN us.duration_seconds <= ${maxDurationSeconds} THEN us.duration_seconds  -- 정상 범위
                ELSE ${maxDurationSeconds}  -- 이상치 대체
              END
            )::NUMERIC,
            0
          ),
          1
        ) as avg_duration_seconds,
        ROUND(
          COALESCE(
            AVG(
              CASE 
                WHEN COALESCE(sd.total_scroll_px, 0) <= ${minScrollPx} THEN NULL  -- 이하치 이하 제외
                WHEN COALESCE(sd.total_scroll_px, 0) <= ${maxScrollPx} THEN sd.total_scroll_px  -- 정상 범위
                ELSE ${maxScrollPx}  -- 이상치 대체
              END
            )::NUMERIC,
            0
          ),
          0
        ) as avg_scroll_px
      FROM unique_sessions us
      LEFT JOIN scroll_data sd ON us.session_id = sd.session_id
      GROUP BY us.creative_name, us.utm_source, us.utm_medium, us.utm_campaign
    )
    SELECT 
      ec.creative_name,
      ec.utm_source,
      ec.utm_medium,
      ec.utm_campaign,
      
      -- 순방문자수 (UV)
      ec.unique_visitors,
      
      -- 총 조회수 (View) - 진입 횟수
      ec.total_views,
      
      -- 평균 페이지뷰 (고유 세션 기준)
      COALESCE(sm.avg_pageviews, 0) as avg_pageviews,
      
      -- 평균 체류시간 (고유 세션 기준)
      COALESCE(sm.avg_duration_seconds, 0) as avg_duration_seconds,
      
      -- 평균 스크롤 (고유 세션 기준)
      COALESCE(sm.avg_scroll_px, 0) as avg_scroll_px

    FROM entry_counts ec
    LEFT JOIN session_metrics sm ON 
      ec.creative_name = sm.creative_name AND
      ec.utm_source = sm.utm_source AND
      ec.utm_medium = sm.utm_medium AND
      ec.utm_campaign = sm.utm_campaign
    ORDER BY ${sortColumn} ${sortDirectionSQL}
  `;

  const result = await db.query(dataQuery, queryParams);
  return result.rows;
}

/**
 * 광고 소재 총 개수 조회
 * @param {Object} params - 쿼리 파라미터
 * @param {Date} params.startDate - 시작일
 * @param {Date} params.endDate - 종료일
 * @param {string} params.searchCondition - 검색 조건 SQL
 * @param {string} params.utmFilterConditions - UTM 필터 조건 SQL
 * @param {Array} params.queryParams - SQL 쿼리 파라미터 배열
 * @returns {Promise<number>} - 총 개수
 */
async function getCreativeCount({
  startDate,
  endDate,
  searchCondition,
  utmFilterConditions,
  queryParams,
  minDurationSeconds = 0,
  minPvCount = 0,
  minScrollPx = 0
}) {
  // Note: 이하치 필터는 평균 지표 계산에만 적용되며, 광고 소재 총 개수에는 영향 없음
  // 카페24 호환: visitors 테이블과 조인하여 봇 트래픽 제외
  const countQuery = `
    SELECT COUNT(DISTINCT us.utm_params->>'utm_content') as total
    FROM utm_sessions us
    JOIN visitors v ON us.visitor_id = v.visitor_id
    WHERE us.utm_params->>'utm_content' IS NOT NULL
      AND us.entry_timestamp >= $1
      AND us.entry_timestamp <= $2
      AND v.is_bot = false
      ${searchCondition}
      ${utmFilterConditions}
  `;

  const result = await db.query(countQuery, queryParams);
  return parseInt(result.rows[0]?.total) || 0;
}

module.exports = {
  getCreativeAggregation,
  getCreativeCount
};
