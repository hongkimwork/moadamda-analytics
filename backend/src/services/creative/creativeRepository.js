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
  maxDurationSeconds = 300
}) {
  const dataQuery = `
    SELECT 
      us.utm_params->>'utm_content' as creative_name,
      us.utm_params->>'utm_source' as utm_source,
      us.utm_params->>'utm_medium' as utm_medium,
      us.utm_params->>'utm_campaign' as utm_campaign,
      
      -- 순방문자수 (UV)
      COUNT(DISTINCT us.visitor_id) as unique_visitors,
      
      -- 총 조회수 (View) - 중복 포함
      COUNT(*) as total_views,
      
      -- 평균 페이지뷰 (방문자당 평균, 소수점 1자리)
      ROUND(
        COALESCE(SUM(us.pageview_count)::FLOAT / NULLIF(COUNT(DISTINCT us.visitor_id), 0), 0)::NUMERIC,
        1
      ) as avg_pageviews,
      
      -- 평균 체류시간 (방문자당 평균, 초 단위, 소수점 1자리)
      -- 이상치 제외: maxDurationSeconds 이상의 체류시간은 비정상으로 판단하여 제외
      ROUND(
        COALESCE(
          SUM(CASE WHEN us.duration_seconds < ${maxDurationSeconds} THEN us.duration_seconds ELSE 0 END)::FLOAT 
          / NULLIF(COUNT(DISTINCT CASE WHEN us.duration_seconds < ${maxDurationSeconds} THEN us.visitor_id END), 0), 
          0
        )::NUMERIC,
        1
      ) as avg_duration_seconds

    FROM utm_sessions us
    WHERE us.utm_params->>'utm_content' IS NOT NULL
      AND us.entry_timestamp >= $1
      AND us.entry_timestamp <= $2
      ${searchCondition}
      ${utmFilterConditions}
    GROUP BY 
      us.utm_params->>'utm_content',
      us.utm_params->>'utm_source',
      us.utm_params->>'utm_medium',
      us.utm_params->>'utm_campaign'
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
  queryParams
}) {
  const countQuery = `
    SELECT COUNT(DISTINCT us.utm_params->>'utm_content') as total
    FROM utm_sessions us
    WHERE us.utm_params->>'utm_content' IS NOT NULL
      AND us.entry_timestamp >= $1
      AND us.entry_timestamp <= $2
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
