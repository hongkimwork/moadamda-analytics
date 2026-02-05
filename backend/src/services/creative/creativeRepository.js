/**
 * 광고 소재 분석 Repository
 * DB 쿼리 로직만 담당
 * 
 * FIX (2026-02-05): ad_id(utm_id) 기반 그룹핑으로 변경
 * - 기존: 광고명(utm_content) 기준 그룹핑 → 광고명 변경 시 별도 행으로 분리
 * - 변경: ad_id(utm_id) 기준 그룹핑 → 같은 광고는 자동 병합
 * - 현재 광고명은 meta_ads 테이블에서 조회
 * - utm_id가 없거나 {{ad.id}} 같은 잘못된 데이터는 제외
 */

const db = require('../../utils/database');

/**
 * 광고 소재별 집계 데이터 조회 (ad_id 기준)
 * @param {Object} params - 쿼리 파라미터
 * @param {Date} params.startDate - 시작일
 * @param {Date} params.endDate - 종료일
 * @param {string} params.searchCondition - 검색 조건 SQL (현재 미사용, 서비스에서 필터링)
 * @param {string} params.utmFilterConditions - UTM 필터 조건 SQL
 * @param {string} params.sortColumn - 정렬 컬럼
 * @param {string} params.sortDirectionSQL - 정렬 방향 (ASC/DESC)
 * @param {Array} params.queryParams - SQL 쿼리 파라미터 배열
 * @param {number} params.maxDurationSeconds - 이상치 기준 (초 단위)
 * @param {number} params.maxPvCount - 이상치 기준 (PV)
 * @param {number} params.maxScrollPx - 이상치 기준 (스크롤 px)
 * @param {number} params.minDurationSeconds - 이하치 기준 (초 단위)
 * @param {number} params.minPvCount - 이하치 기준 (PV)
 * @param {number} params.minScrollPx - 이하치 기준 (스크롤 px)
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
  // FIX (2026-02-05): ad_id(utm_id) 기준 그룹핑
  // - 정상 utm_id가 있는 데이터만 포함 (utm_id 없거나 {{ad.id}} 같은 잘못된 값 제외)
  // - meta_ads 테이블과 조인하여 현재 광고명 조회
  // - 수집된 광고명들은 array_agg로 variant_names에 저장
  const dataQuery = `
    WITH all_entries AS (
      -- 모든 진입 기록 (View 계산용)
      -- 정상 utm_id만 포함 (빈 값, {{ad.id}} 등 제외)
      SELECT 
        us.session_id,
        us.visitor_id,
        us.utm_params->>'utm_id' as ad_id,
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
        -- 정상 utm_id만 포함 (빈 값, {{ad.id}} 등 잘못된 값 제외)
        AND NULLIF(us.utm_params->>'utm_id', '') IS NOT NULL
        AND us.utm_params->>'utm_id' NOT LIKE '{{%'
        ${utmFilterConditions}
    ),
    unique_sessions AS (
      -- 고유 세션 (평균 지표 계산용)
      SELECT DISTINCT ON (ae.ad_id, ae.utm_medium, ae.utm_campaign, ae.session_id)
        ae.session_id,
        ae.visitor_id,
        ae.ad_id,
        ae.creative_name,
        ae.utm_source,
        ae.utm_medium,
        ae.utm_campaign,
        s.pageview_count,
        s.duration_seconds
      FROM all_entries ae
      JOIN sessions s ON ae.session_id = s.session_id
      ORDER BY ae.ad_id, ae.utm_medium, ae.utm_campaign, ae.session_id
    ),
    entry_counts AS (
      -- ad_id별 진입 횟수 집계
      SELECT 
        ad_id,
        utm_medium,
        utm_campaign,
        COUNT(*) as total_views,
        COUNT(DISTINCT visitor_id) as unique_visitors,
        -- 수집된 광고명들 (중복 제거)
        array_agg(DISTINCT creative_name) as variant_names,
        -- utm_source는 가장 많이 수집된 값 사용 (대부분 동일)
        MODE() WITHIN GROUP (ORDER BY utm_source) as utm_source
      FROM all_entries
      GROUP BY ad_id, utm_medium, utm_campaign
    ),
    scroll_data AS (
      -- 세션별 스크롤 합계 (events 테이블에서)
      -- FIX (2026-02-05): 조회 기간 내의 스크롤 이벤트만 집계
      -- 비정상 세션(수개월 유지)의 다른 기간 스크롤 데이터가 집계되는 문제 해결
      SELECT 
        session_id,
        ROUND(SUM((metadata->>'max_scroll_px')::NUMERIC)) as total_scroll_px
      FROM events 
      WHERE event_type = 'scroll_depth'
        AND (metadata->>'max_scroll_px') IS NOT NULL
        AND timestamp >= $1
        AND timestamp <= $2
      GROUP BY session_id
    ),
    session_metrics AS (
      -- ad_id 기준 평균 지표 집계
      -- 이하치 이하: 제외 (NULL), 이상치 초과: 기준값으로 대체
      SELECT 
        us.ad_id,
        us.utm_medium,
        us.utm_campaign,
        ROUND(
          COALESCE(
            AVG(
              CASE 
                WHEN us.pageview_count <= ${minPvCount} THEN NULL
                WHEN us.pageview_count <= ${maxPvCount} THEN us.pageview_count
                ELSE ${maxPvCount}
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
                WHEN us.duration_seconds <= ${minDurationSeconds} THEN NULL
                WHEN us.duration_seconds <= ${maxDurationSeconds} THEN us.duration_seconds
                ELSE ${maxDurationSeconds}
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
                WHEN COALESCE(sd.total_scroll_px, 0) <= ${minScrollPx} THEN NULL
                WHEN COALESCE(sd.total_scroll_px, 0) <= ${maxScrollPx} THEN sd.total_scroll_px
                ELSE ${maxScrollPx}
              END
            )::NUMERIC,
            0
          ),
          0
        ) as avg_scroll_px
      FROM unique_sessions us
      LEFT JOIN scroll_data sd ON us.session_id = sd.session_id
      GROUP BY us.ad_id, us.utm_medium, us.utm_campaign
    )
    SELECT 
      ec.ad_id,
      ec.utm_source,
      ec.utm_medium,
      ec.utm_campaign,
      
      -- 현재 광고명: meta_ads에서 조회, 없으면 수집된 광고명 중 첫 번째 사용
      COALESCE(ma.name, ec.variant_names[1]) as creative_name,
      
      -- 수집된 광고명들 (이력 확인용)
      ec.variant_names,
      
      -- 순방문자수 (UV)
      ec.unique_visitors,
      
      -- 총 조회수 (View) - 진입 횟수
      ec.total_views,
      
      -- 평균 페이지뷰
      COALESCE(sm.avg_pageviews, 0) as avg_pageviews,
      
      -- 평균 체류시간
      COALESCE(sm.avg_duration_seconds, 0) as avg_duration_seconds,
      
      -- 평균 스크롤
      COALESCE(sm.avg_scroll_px, 0) as avg_scroll_px,
      
      -- 메타 광고 매핑 여부 (meta_ads 테이블에 있으면 매핑됨)
      CASE 
        WHEN ma.ad_id IS NOT NULL THEN true
        ELSE false
      END as is_meta_matched

    FROM entry_counts ec
    LEFT JOIN session_metrics sm ON 
      ec.ad_id = sm.ad_id AND
      ec.utm_medium = sm.utm_medium AND
      ec.utm_campaign = sm.utm_campaign
    LEFT JOIN meta_ads ma ON ec.ad_id = ma.ad_id
    ORDER BY ${sortColumn} ${sortDirectionSQL}
  `;

  const result = await db.query(dataQuery, queryParams);
  return result.rows;
}

/**
 * 광고 소재 총 개수 조회 (ad_id 기준)
 * @param {Object} params - 쿼리 파라미터
 * @param {Date} params.startDate - 시작일
 * @param {Date} params.endDate - 종료일
 * @param {string} params.searchCondition - 검색 조건 SQL (현재 미사용)
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
  // FIX (2026-02-05): ad_id 기준으로 개수 조회
  // 정상 utm_id만 포함 (빈 값, {{ad.id}} 등 제외)
  const countQuery = `
    SELECT COUNT(DISTINCT us.utm_params->>'utm_id') as total
    FROM utm_sessions us
    JOIN visitors v ON us.visitor_id = v.visitor_id
    WHERE us.utm_params->>'utm_content' IS NOT NULL
      AND us.entry_timestamp >= $1
      AND us.entry_timestamp <= $2
      AND v.is_bot = false
      -- 정상 utm_id만 포함
      AND NULLIF(us.utm_params->>'utm_id', '') IS NOT NULL
      AND us.utm_params->>'utm_id' NOT LIKE '{{%'
      ${utmFilterConditions}
  `;

  const result = await db.query(countQuery, queryParams);
  return parseInt(result.rows[0]?.total) || 0;
}

module.exports = {
  getCreativeAggregation,
  getCreativeCount
};
