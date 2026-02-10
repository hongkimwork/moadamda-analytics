/**
 * 광고 소재 상세 분석 Repository
 * POST 엔드포인트들의 DB 쿼리만 담당
 */

const db = require('../../utils/database');

/**
 * 선택 기간 내 모든 구매 조회 (creativeAttribution.js와 동일한 방식)
 * FIX (2026-02-03): visitor 조회 방식 변경 - 모든 구매 먼저 조회
 * - 기존: UTM 세션 있는 visitor만 조회 → 그 visitor들의 주문 조회 (IP/member_id 연결 누락)
 * - 수정: 모든 구매 먼저 조회 → IP/member_id로 여정 연결 (creativeAttribution.js와 동일)
 */
async function getAllOrdersInPeriod({ startDate, endDate }) {
  const query = `
    SELECT 
      c.order_id,
      c.visitor_id,
      c.session_id,
      c.member_id,
      c.final_payment,
      c.total_amount,
      c.product_name,
      c.product_count,
      c.discount_amount,
      c.timestamp as order_date,
      c.paid,
      s.visitor_id as session_visitor_id,
      COALESCE(s.ip_address, v.ip_address) as ip_address
    FROM conversions c
    LEFT JOIN sessions s ON c.session_id = s.session_id
    LEFT JOIN visitors v ON c.visitor_id = v.visitor_id
    WHERE c.order_id IS NOT NULL
      AND c.paid = 'T'
      AND c.final_payment > 0
      AND c.timestamp >= $1
      AND c.timestamp <= $2
      AND (c.canceled = 'F' OR c.canceled IS NULL)
      AND (c.order_status = 'confirmed' OR c.order_status IS NULL)
    ORDER BY c.visitor_id, c.timestamp
  `;
  
  const result = await db.query(query, [startDate, endDate]);
  return result.rows;
}

/**
 * Visitor들의 UTM 여정 조회
 * FIX (2026-02-04): REPLACE 제거 - View/UV 계산과 동일하게 원본 값 사용
 * FIX (2026-02-05): ad_id 추가 및 정상 utm_id 필터 옵션 추가
 * 카페24 호환: visitors 테이블과 조인하여 봇 트래픽 제외
 * 
 * @param {Object} params
 * @param {Array} params.visitorIds - 조회할 visitor ID 배열
 * @param {boolean} params.onlyValidAdId - true면 정상 utm_id만 포함 (메인 테이블과 동일한 기준)
 */
async function getVisitorJourneys({ visitorIds, onlyValidAdId = false }) {
  // 정상 utm_id 필터 조건 (메인 테이블과 동일: 빈 값, {{ad.id}} 등 제외)
  const adIdFilter = onlyValidAdId
    ? `AND NULLIF(us.utm_params->>'utm_id', '') IS NOT NULL
       AND us.utm_params->>'utm_id' NOT LIKE '{{%'`
    : '';
  
  const query = `
    SELECT 
      us.visitor_id,
      us.utm_params->>'utm_id' as ad_id,
      us.utm_params->>'utm_content' as utm_content,
      COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') as utm_source,
      COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') as utm_medium,
      COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') as utm_campaign,
      us.sequence_order,
      us.entry_timestamp
    FROM utm_sessions us
    JOIN visitors v ON us.visitor_id = v.visitor_id
    WHERE us.visitor_id = ANY($1)
      AND us.utm_params->>'utm_content' IS NOT NULL
      AND v.is_bot = false
      ${adIdFilter}
    ORDER BY us.visitor_id, us.sequence_order
  `;
  
  const result = await db.query(query, [visitorIds]);
  return result.rows;
}

/**
 * member_id 기반 UTM 여정 조회 (쿠키 끊김 대응)
 * 동일 member_id의 다른 visitor_id들의 UTM 세션도 조회
 * FIX (2026-02-03): 상세 모달에서도 member_id 기반 연결 적용
 * FIX (2026-02-05): ad_id 추가 및 정상 utm_id 필터 옵션 추가
 * 
 * @param {Object} params
 * @param {boolean} params.onlyValidAdId - true면 정상 utm_id만 포함
 */
async function getVisitorJourneysByMemberId({ purchaserMemberIds, purchaserIds, onlyValidAdId = false }) {
  if (!purchaserMemberIds || purchaserMemberIds.length === 0) {
    return [];
  }
  
  const adIdFilter = onlyValidAdId
    ? `AND NULLIF(us.utm_params->>'utm_id', '') IS NOT NULL
       AND us.utm_params->>'utm_id' NOT LIKE '{{%'`
    : '';
  
  const query = `
    SELECT 
      c2.member_id,
      us.visitor_id,
      us.utm_params->>'utm_id' as ad_id,
      us.utm_params->>'utm_content' as utm_content,
      COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') as utm_source,
      COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') as utm_medium,
      COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') as utm_campaign,
      us.sequence_order,
      us.entry_timestamp
    FROM utm_sessions us
    JOIN visitors v ON us.visitor_id = v.visitor_id
    JOIN conversions c2 ON c2.visitor_id = us.visitor_id
    WHERE c2.member_id = ANY($1)
      AND us.visitor_id != ALL($2)
      AND us.utm_params->>'utm_content' IS NOT NULL
      AND v.is_bot = false
      ${adIdFilter}
    ORDER BY c2.member_id, us.entry_timestamp
  `;
  
  const result = await db.query(query, [purchaserMemberIds, purchaserIds]);
  return result.rows;
}

/**
 * 특정 광고로 유입된 visitor별 세션 정보 조회 (PV, 체류시간)
 * 
 * FIX (2026-01-06): 체류시간 계산 방식 변경
 * - 기존: utm_sessions.duration_seconds 사용 → 세션 종료 이벤트 필요, 자주 0초
 * - 수정: pageviews 테이블에서 직접 계산 (여정 상세와 동일한 방식)
 *   → 다음 페이지뷰와의 시간 차이로 체류시간 계산 (이상치 기준 적용)
 * 
 * UPDATE (2026-01-07): 총 체류시간 + 막타 체류시간 분리
 * - total_duration: 이 광고로 유입된 모든 방문의 체류시간 합계
 * - last_touch_duration: 구매 직전 마지막 방문의 체류시간
 * 
 * FIX (2026-01-23): 조회 기간 필터 추가
 * - 기존: 기간 제한 없이 모든 세션 집계 → 과거 세션까지 합산되어 비정상적으로 큰 값
 * - 수정: 조회 기간 내 세션만 집계
 * 
 * FIX (2026-02-05): ad_id 기반 조회 지원 추가
 * - ad_id가 있으면 utm_id로 필터링 (메인 테이블과 동일한 기준)
 * - ad_id가 없으면 기존 creative_name(utm_content) 기반 (fallback)
 * 
 * 카페24 호환: visitors 테이블과 조인하여 봇 트래픽 제외
 */
async function getVisitorSessionInfoForCreative({ visitorIds, ad_id, creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate, maxDurationSeconds = 600 }) {
  if (visitorIds.length === 0) return {};
  
  // FIX (2026-02-05): ad_id 기반 모드 판별 (메인 테이블과 동일한 기준)
  const useAdId = ad_id && ad_id !== '' && !ad_id.startsWith('{{');
  
  // 1단계: 해당 광고로 유입된 UTM 세션의 session_id 목록 조회 (조회 기간 내, 세션 중복 제거, 봇 제외)
  // FIX (2026-01-23): 같은 세션에서 광고를 여러 번 클릭한 경우 중복 제거
  let sessionQuery;
  let sessionQueryParams;
  
  if (useAdId) {
    // ad_id 기반 조회 (메인 테이블과 동일한 기준)
    sessionQuery = `
      SELECT DISTINCT us.visitor_id, us.session_id, MIN(us.entry_timestamp) as entry_timestamp
      FROM utm_sessions us
      JOIN visitors v ON us.visitor_id = v.visitor_id
      WHERE us.visitor_id = ANY($1)
        AND us.utm_params->>'utm_id' = $2
        AND COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') = $3
        AND COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') = $4
        AND us.entry_timestamp >= $5
        AND us.entry_timestamp <= $6
        AND v.is_bot = false
      GROUP BY us.visitor_id, us.session_id
      ORDER BY us.visitor_id, MIN(us.entry_timestamp) DESC
    `;
    sessionQueryParams = [visitorIds, ad_id, utm_medium, utm_campaign, startDate, endDate];
  } else {
    // creative_name 기반 조회 (fallback)
    sessionQuery = `
      SELECT DISTINCT us.visitor_id, us.session_id, MIN(us.entry_timestamp) as entry_timestamp
      FROM utm_sessions us
      JOIN visitors v ON us.visitor_id = v.visitor_id
      WHERE us.visitor_id = ANY($1)
        AND us.utm_params->>'utm_content' = $2
        AND COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') = $3
        AND COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') = $4
        AND COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') = $5
        AND us.entry_timestamp >= $6
        AND us.entry_timestamp <= $7
        AND v.is_bot = false
      GROUP BY us.visitor_id, us.session_id
      ORDER BY us.visitor_id, MIN(us.entry_timestamp) DESC
    `;
    sessionQueryParams = [visitorIds, creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate];
  }
  
  const sessionResult = await db.query(sessionQuery, sessionQueryParams);
  
  if (sessionResult.rows.length === 0) {
    return {};
  }
  
  // visitor_id별 session_id 목록 구성 (최신순 정렬됨)
  const visitorSessionMap = {};
  const visitorLastSessionMap = {}; // 각 visitor의 마지막(최신) 세션
  const allSessionIds = [];
  
  sessionResult.rows.forEach(row => {
    if (!visitorSessionMap[row.visitor_id]) {
      visitorSessionMap[row.visitor_id] = [];
      visitorLastSessionMap[row.visitor_id] = row.session_id; // 첫 번째가 최신
    }
    visitorSessionMap[row.visitor_id].push(row.session_id);
    allSessionIds.push(row.session_id);
  });
  
  // 2단계: 해당 세션들의 pageviews에서 체류시간 계산
  const pageviewQuery = `
    WITH page_times AS (
      SELECT 
        p.session_id,
        p.visitor_id,
        p.timestamp,
        LEAD(p.timestamp) OVER (PARTITION BY p.session_id ORDER BY p.timestamp) as next_timestamp
      FROM pageviews p
      WHERE p.session_id = ANY($1)
    ),
    session_durations AS (
      SELECT
        session_id,
        visitor_id,
        COUNT(*) as pageview_count,
        SUM(
          CASE
            WHEN next_timestamp IS NOT NULL THEN
              LEAST(EXTRACT(EPOCH FROM (next_timestamp - timestamp))::INTEGER, ${maxDurationSeconds})
            ELSE 0
          END
        ) as duration
      FROM page_times
      GROUP BY session_id, visitor_id
    )
    SELECT
      visitor_id,
      session_id,
      pageview_count,
      duration
    FROM session_durations
  `;
  
  const pageviewResult = await db.query(pageviewQuery, [allSessionIds]);
  
  // session_id별 체류시간 맵
  const sessionDurationMap = {};
  pageviewResult.rows.forEach(row => {
    sessionDurationMap[row.session_id] = {
      pageview_count: parseInt(row.pageview_count) || 0,
      duration: parseInt(row.duration) || 0
    };
  });
  
  // visitor_id별 총 체류시간 + 막타 체류시간 계산
  const sessionInfoMap = {};
  Object.keys(visitorSessionMap).forEach(visitorId => {
    const sessionIds = visitorSessionMap[visitorId];
    const lastSessionId = visitorLastSessionMap[visitorId];
    
    let totalPageviews = 0;
    let totalDuration = 0;
    let lastTouchDuration = 0;
    let lastTouchPageviews = 0;
    
    sessionIds.forEach(sessionId => {
      const info = sessionDurationMap[sessionId] || { pageview_count: 0, duration: 0 };
      totalPageviews += info.pageview_count;
      totalDuration += info.duration;
      
      if (sessionId === lastSessionId) {
        lastTouchDuration = info.duration;
        lastTouchPageviews = info.pageview_count;
      }
    });
    
    sessionInfoMap[visitorId] = {
      pageview_count: totalPageviews || sessionIds.length,
      duration_seconds: totalDuration,
      last_touch_duration: lastTouchDuration,
      last_touch_pageviews: lastTouchPageviews,
      visit_count: sessionIds.length
    };
  });
  
  return sessionInfoMap;
}

/**
 * visitor별 총 방문 횟수 조회
 * 카페24 호환: 봇 트래픽 제외
 */
async function getVisitorTotalVisits({ visitorIds }) {
  if (visitorIds.length === 0) return {};
  
  const query = `
    SELECT 
      visitor_id,
      visit_count
    FROM visitors
    WHERE visitor_id = ANY($1)
      AND is_bot = false
  `;
  
  const result = await db.query(query, [visitorIds]);
  
  const visitCountMap = {};
  result.rows.forEach(row => {
    visitCountMap[row.visitor_id] = parseInt(row.visit_count) || 0;
  });
  
  return visitCountMap;
}

/**
 * 특정 광고 소재를 통해 유입된 세션 상세 목록 조회
 * 카페24 호환: visitors.is_bot = false 필터 적용
 * 
 * 원본 테이블 사용 이유: 
 * - 체류시간 0초 세션도 실제 세션이므로 포함해야 함
 * - 세션 상세 정보 조회를 위해 sessions 테이블 직접 사용
 * - 봇 필터링은 visitors.is_bot = false로 적용
 * 
 * @param {Object} params
 * @param {string|string[]} params.creative_name - 광고 소재 이름 또는 배열
 * @param {string} params.utm_source - UTM Source
 * @param {string} params.utm_medium - UTM Medium
 * @param {string} params.utm_campaign - UTM Campaign
 * @param {Date} params.startDate - 시작일
 * @param {Date} params.endDate - 종료일
 * @param {number} params.page - 페이지 번호
 * @param {number} params.limit - 페이지 크기
 * FIX (2026-02-05): ad_id 기반 조회로 변경
 * - ad_id가 있으면 ad_id로 필터링 (메인 테이블과 일치)
 * - ad_id가 없으면 기존 creative_name으로 필터링 (fallback)
 * @param {string} ad_id - 광고 ID (utm_id)
 * @returns {Promise<Array>} 세션 목록
 */
async function getCreativeSessions({ ad_id, creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate, page = 1, limit = 50, sortField, sortOrder }) {
  const offset = (page - 1) * limit;
  
  // ad_id가 있으면 ad_id 기반 조회, 없으면 creative_name 기반 (fallback)
  const useAdId = ad_id && ad_id !== '' && !ad_id.startsWith('{{');
  
  // 정렬 기준 생성 (SQL injection 방지를 위해 화이트리스트 방식)
  const orderClause = buildSessionOrderClause(sortField, sortOrder);
  
  // 카페24 호환: visitors.is_bot = false 필터 적용
  // 원본 sessions 테이블 사용: 체류시간 0초 세션도 실제 세션이므로 포함
  // 서브쿼리로 고유 session_id만 추출 후 세션 정보 조회
  // 스크롤 데이터: events 테이블에서 session_id별 스크롤 총합 계산
  
  let query;
  let queryParams;
  
  if (useAdId) {
    // ad_id 기반 조회 (메인 테이블과 동일한 기준)
    query = `
      WITH scroll_data AS (
        -- FIX (2026-02-05): 조회 기간 내의 스크롤 이벤트만 집계
        SELECT 
          session_id,
          COALESCE(ROUND(SUM((metadata->>'max_scroll_px')::NUMERIC)), 0)::INTEGER as total_scroll_px
        FROM events
        WHERE event_type = 'scroll_depth'
          AND (metadata->>'max_scroll_px') IS NOT NULL
          AND timestamp >= $4
          AND timestamp <= $5
        GROUP BY session_id
      )
      SELECT 
        s.session_id,
        s.visitor_id,
        s.start_time,
        s.end_time,
        s.duration_seconds,
        s.pageview_count,
        s.entry_url,
        s.exit_url,
        -- FIX (2026-02-06): is_converted 대신 conversions 테이블로 실제 구매 확인
        -- 결제 과정(PG 리디렉트)에서 세션이 끊겨 is_converted 미반영 대응
        (s.is_converted = true OR EXISTS (
          SELECT 1 FROM conversions c
          WHERE c.session_id = s.session_id AND c.paid = 'T' AND c.final_payment > 0
          AND (c.canceled = 'F' OR c.canceled IS NULL)
          AND (c.order_status = 'confirmed' OR c.order_status IS NULL)
        )) as is_converted,
        v.device_type,
        v.browser,
        v.os,
        s.ip_address,
        COALESCE(sd.total_scroll_px, 0) as total_scroll_px
      FROM sessions s
      JOIN visitors v ON s.visitor_id = v.visitor_id
      LEFT JOIN scroll_data sd ON s.session_id = sd.session_id
      WHERE s.session_id IN (
        SELECT DISTINCT us.session_id
        FROM utm_sessions us
        JOIN visitors v2 ON us.visitor_id = v2.visitor_id
        WHERE us.utm_params->>'utm_id' = $1
          AND COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') = $2
          AND COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') = $3
          AND us.entry_timestamp >= $4
          AND us.entry_timestamp <= $5
          AND v2.is_bot = false
      )
      AND v.is_bot = false
      AND s.start_time >= $4
      AND s.start_time <= $5
      ${orderClause}
      LIMIT $6 OFFSET $7
    `;
    queryParams = [ad_id, utm_medium, utm_campaign, startDate, endDate, limit, offset];
  } else {
    // creative_name 기반 조회 (fallback)
    const creativeNames = Array.isArray(creative_name) ? creative_name : [creative_name];
    query = `
      WITH scroll_data AS (
        -- FIX (2026-02-05): 조회 기간 내의 스크롤 이벤트만 집계
        SELECT 
          session_id,
          COALESCE(ROUND(SUM((metadata->>'max_scroll_px')::NUMERIC)), 0)::INTEGER as total_scroll_px
        FROM events
        WHERE event_type = 'scroll_depth'
          AND (metadata->>'max_scroll_px') IS NOT NULL
          AND timestamp >= $5
          AND timestamp <= $6
        GROUP BY session_id
      )
      SELECT 
        s.session_id,
        s.visitor_id,
        s.start_time,
        s.end_time,
        s.duration_seconds,
        s.pageview_count,
        s.entry_url,
        s.exit_url,
        -- FIX (2026-02-06): is_converted 대신 conversions 테이블로 실제 구매 확인
        -- 결제 과정(PG 리디렉트)에서 세션이 끊겨 is_converted 미반영 대응
        (s.is_converted = true OR EXISTS (
          SELECT 1 FROM conversions c
          WHERE c.session_id = s.session_id AND c.paid = 'T' AND c.final_payment > 0
          AND (c.canceled = 'F' OR c.canceled IS NULL)
          AND (c.order_status = 'confirmed' OR c.order_status IS NULL)
        )) as is_converted,
        v.device_type,
        v.browser,
        v.os,
        s.ip_address,
        COALESCE(sd.total_scroll_px, 0) as total_scroll_px
      FROM sessions s
      JOIN visitors v ON s.visitor_id = v.visitor_id
      LEFT JOIN scroll_data sd ON s.session_id = sd.session_id
      WHERE s.session_id IN (
        SELECT DISTINCT us.session_id
        FROM utm_sessions us
        JOIN visitors v2 ON us.visitor_id = v2.visitor_id
        WHERE us.utm_params->>'utm_content' = ANY($1)
          AND (COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') = $2 )
          AND COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') = $3
          AND COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') = $4
          AND us.entry_timestamp >= $5
          AND us.entry_timestamp <= $6
          AND v2.is_bot = false
      )
      AND v.is_bot = false
      AND s.start_time >= $5
      AND s.start_time <= $6
      ${orderClause}
      LIMIT $7 OFFSET $8
    `;
    queryParams = [creativeNames, utm_source, utm_medium, utm_campaign, startDate, endDate, limit, offset];
  }
  
  const result = await db.query(query, queryParams);
  return result.rows;
}

/**
 * 세션 정렬 ORDER BY 절 생성
 * - start_time: 방문자 그룹을 유지하면서 시간순 정렬 (윈도우 함수로 그룹 간 정렬)
 * - duration_seconds, pageview_count, total_scroll_px: 순수 값 기준 정렬 (그룹 해제)
 * - 기본값: 방문자별 그룹 + 최신순
 * 
 * SQL injection 방지: 화이트리스트 방식으로 허용된 필드/방향만 사용
 */
function buildSessionOrderClause(sortField, sortOrder) {
  const direction = sortOrder === 'ascend' ? 'ASC' : 'DESC';
  
  switch (sortField) {
    case 'start_time':
      // 방문자 그룹 유지: 그룹 간 정렬(윈도우 함수) + 그룹 내 정렬
      if (direction === 'ASC') {
        return 'ORDER BY MIN(s.start_time) OVER (PARTITION BY s.visitor_id) ASC, s.visitor_id, s.start_time ASC';
      }
      return 'ORDER BY MAX(s.start_time) OVER (PARTITION BY s.visitor_id) DESC, s.visitor_id, s.start_time DESC';
    case 'duration_seconds':
      return `ORDER BY s.duration_seconds ${direction} NULLS LAST`;
    case 'pageview_count':
      return `ORDER BY s.pageview_count ${direction} NULLS LAST`;
    case 'total_scroll_px':
      return `ORDER BY COALESCE(sd.total_scroll_px, 0) ${direction}`;
    default:
      // 기본: 방문자별 그룹 + 최신순
      return 'ORDER BY s.visitor_id, s.start_time DESC';
  }
}

/**
 * 특정 광고 소재를 통해 유입된 세션 총 개수 조회
 * 카페24 호환: visitors.is_bot = false 필터 적용
 * 
 * FIX (2026-02-05): ad_id 기반 조회로 변경
 * 
 * 원본 테이블 사용 이유:
 * - 체류시간 0초 세션도 실제 세션이므로 포함해야 함
 * - 봇 필터링은 visitors.is_bot = false로 적용
 * @param {string} ad_id - 광고 ID (utm_id)
 * @param {string|string[]} creative_name - 광고명 또는 광고명 배열 (fallback용)
 */
async function getCreativeSessionsCount({ ad_id, creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate }) {
  // ad_id가 있으면 ad_id 기반 조회, 없으면 creative_name 기반 (fallback)
  const useAdId = ad_id && ad_id !== '' && !ad_id.startsWith('{{');
  
  let query;
  let queryParams;
  
  if (useAdId) {
    // ad_id 기반 조회 (메인 테이블과 동일한 기준)
    // FIX (2026-02-06): s.start_time 기간 필터 추가 - 잘못된 entry_timestamp로 기간 외 세션이 포함되는 문제 방지
    query = `
      SELECT 
        COUNT(DISTINCT us.visitor_id) as uv_count,
        COUNT(DISTINCT s.session_id) as total
      FROM utm_sessions us
      JOIN sessions s ON us.session_id = s.session_id
      JOIN visitors v ON us.visitor_id = v.visitor_id
      WHERE us.utm_params->>'utm_id' = $1
        AND COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') = $2
        AND COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') = $3
        AND us.entry_timestamp >= $4
        AND us.entry_timestamp <= $5
        AND s.start_time >= $4
        AND s.start_time <= $5
        AND v.is_bot = false
    `;
    queryParams = [ad_id, utm_medium, utm_campaign, startDate, endDate];
  } else {
    // creative_name 기반 조회 (fallback)
    // FIX (2026-02-06): s.start_time 기간 필터 추가 - 잘못된 entry_timestamp로 기간 외 세션이 포함되는 문제 방지
    const creativeNames = Array.isArray(creative_name) ? creative_name : [creative_name];
    query = `
      SELECT 
        COUNT(DISTINCT us.visitor_id) as uv_count,
        COUNT(DISTINCT s.session_id) as total
      FROM utm_sessions us
      JOIN sessions s ON us.session_id = s.session_id
      JOIN visitors v ON us.visitor_id = v.visitor_id
      WHERE us.utm_params->>'utm_content' = ANY($1)
        AND (COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') = $2 )
        AND COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') = $3
        AND COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') = $4
        AND us.entry_timestamp >= $5
        AND us.entry_timestamp <= $6
        AND s.start_time >= $5
        AND s.start_time <= $6
        AND v.is_bot = false
    `;
    queryParams = [creativeNames, utm_source, utm_medium, utm_campaign, startDate, endDate];
  }
  
  const result = await db.query(query, queryParams);
  
  return {
    uvCount: parseInt(result.rows[0]?.uv_count) || 0,
    total: parseInt(result.rows[0]?.total) || 0
  };
}

/**
 * 특정 광고 소재의 진입 목록 조회 (View 상세)
 * 모든 진입 기록을 시간순으로 반환, 이전 진입과의 간격도 계산
 * 카페24 호환: visitors.is_bot = false 필터 적용
 * 
 * FIX (2026-02-05): ad_id 기반 조회로 변경
 * 
 * @param {Object} params
 * @param {string} params.ad_id - 광고 ID (utm_id)
 * @param {string|string[]} params.creative_name - 광고 소재 이름 또는 배열 (fallback용)
 * @param {string} params.utm_source - UTM Source
 * @param {string} params.utm_medium - UTM Medium
 * @param {string} params.utm_campaign - UTM Campaign
 * @param {Date} params.startDate - 시작일
 * @param {Date} params.endDate - 종료일
 * @param {number} params.page - 페이지 번호
 * @param {number} params.limit - 페이지 크기
 * @returns {Promise<Array>} 진입 목록
 */
async function getCreativeEntries({ ad_id, creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate, page = 1, limit = 50 }) {
  const offset = (page - 1) * limit;
  
  // ad_id가 있으면 ad_id 기반 조회, 없으면 creative_name 기반 (fallback)
  const useAdId = ad_id && ad_id !== '' && !ad_id.startsWith('{{');
  
  let query;
  let queryParams;
  
  if (useAdId) {
    // ad_id 기반 조회 (메인 테이블과 동일한 기준)
    // FIX (2026-02-06): sessions.start_time 기간 필터 추가 - 메인 테이블 View와 일치
    query = `
      WITH entries AS (
        SELECT 
          us.id,
          us.entry_timestamp,
          us.visitor_id,
          us.session_id,
          us.sequence_order,
          us.duration_seconds,
          LAG(us.entry_timestamp) OVER (
            PARTITION BY us.visitor_id
            ORDER BY us.entry_timestamp
          ) as prev_entry
        FROM utm_sessions us
        JOIN visitors v ON us.visitor_id = v.visitor_id
        JOIN sessions s ON us.session_id = s.session_id
        WHERE us.utm_params->>'utm_id' = $1
          AND COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') = $2
          AND COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') = $3
          AND us.entry_timestamp >= $4
          AND us.entry_timestamp <= $5
          AND s.start_time >= $4
          AND s.start_time <= $5
          AND v.is_bot = false
      )
      SELECT 
        id,
        entry_timestamp,
        visitor_id,
        session_id,
        sequence_order,
        duration_seconds,
        CASE 
          WHEN prev_entry IS NOT NULL THEN
            EXTRACT(EPOCH FROM (entry_timestamp - prev_entry))::INTEGER
          ELSE NULL
        END as gap_seconds
      FROM entries
      ORDER BY entry_timestamp DESC
      LIMIT $6 OFFSET $7
    `;
    queryParams = [ad_id, utm_medium, utm_campaign, startDate, endDate, limit, offset];
  } else {
    // creative_name 기반 조회 (fallback)
    // FIX (2026-02-06): sessions.start_time 기간 필터 추가 - 메인 테이블 View와 일치
    const creativeNames = Array.isArray(creative_name) ? creative_name : [creative_name];
    query = `
      WITH entries AS (
        SELECT 
          us.id,
          us.entry_timestamp,
          us.visitor_id,
          us.session_id,
          us.sequence_order,
          us.duration_seconds,
          LAG(us.entry_timestamp) OVER (
            PARTITION BY us.visitor_id
            ORDER BY us.entry_timestamp
          ) as prev_entry
        FROM utm_sessions us
        JOIN visitors v ON us.visitor_id = v.visitor_id
        JOIN sessions s ON us.session_id = s.session_id
        WHERE us.utm_params->>'utm_content' = ANY($1)
          AND (COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') = $2 )
          AND COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') = $3
          AND COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') = $4
          AND us.entry_timestamp >= $5
          AND us.entry_timestamp <= $6
          AND s.start_time >= $5
          AND s.start_time <= $6
          AND v.is_bot = false
      )
      SELECT 
        id,
        entry_timestamp,
        visitor_id,
        session_id,
        sequence_order,
        duration_seconds,
        CASE 
          WHEN prev_entry IS NOT NULL THEN
            EXTRACT(EPOCH FROM (entry_timestamp - prev_entry))::INTEGER
          ELSE NULL
        END as gap_seconds
      FROM entries
      ORDER BY entry_timestamp DESC
      LIMIT $7 OFFSET $8
    `;
    queryParams = [creativeNames, utm_source, utm_medium, utm_campaign, startDate, endDate, limit, offset];
  }
  
  const result = await db.query(query, queryParams);
  return result.rows;
}

/**
 * 특정 광고 소재의 진입 총 개수 조회
 * 카페24 호환: visitors.is_bot = false 필터 적용
 * 
 * FIX (2026-02-05): ad_id 기반 조회로 변경
 * 
 * @param {string} ad_id - 광고 ID (utm_id)
 * @param {string|string[]} creative_name - 광고명 또는 광고명 배열 (fallback용)
 */
async function getCreativeEntriesCount({ ad_id, creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate }) {
  // ad_id가 있으면 ad_id 기반 조회, 없으면 creative_name 기반 (fallback)
  const useAdId = ad_id && ad_id !== '' && !ad_id.startsWith('{{');
  
  let query;
  let queryParams;
  
  if (useAdId) {
    // ad_id 기반 조회 (메인 테이블과 동일한 기준)
    // FIX (2026-02-06): sessions.start_time 기간 필터 추가 - 메인 테이블 View와 일치
    query = `
      SELECT COUNT(*) as total
      FROM utm_sessions us
      JOIN visitors v ON us.visitor_id = v.visitor_id
      JOIN sessions s ON us.session_id = s.session_id
      WHERE us.utm_params->>'utm_id' = $1
        AND COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') = $2
        AND COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') = $3
        AND us.entry_timestamp >= $4
        AND us.entry_timestamp <= $5
        AND s.start_time >= $4
        AND s.start_time <= $5
        AND v.is_bot = false
    `;
    queryParams = [ad_id, utm_medium, utm_campaign, startDate, endDate];
  } else {
    // creative_name 기반 조회 (fallback)
    // FIX (2026-02-06): sessions.start_time 기간 필터 추가 - 메인 테이블 View와 일치
    const creativeNames = Array.isArray(creative_name) ? creative_name : [creative_name];
    query = `
      SELECT COUNT(*) as total
      FROM utm_sessions us
      JOIN visitors v ON us.visitor_id = v.visitor_id
      JOIN sessions s ON us.session_id = s.session_id
      WHERE us.utm_params->>'utm_content' = ANY($1)
        AND (COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') = $2 )
        AND COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') = $3
        AND COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') = $4
        AND us.entry_timestamp >= $5
        AND us.entry_timestamp <= $6
        AND s.start_time >= $5
        AND s.start_time <= $6
        AND v.is_bot = false
    `;
    queryParams = [creativeNames, utm_source, utm_medium, utm_campaign, startDate, endDate];
  }
  
  const result = await db.query(query, queryParams);
  return parseInt(result.rows[0]?.total) || 0;
}

/**
 * 특정 광고 소재의 대표 원본 URL 조회
 * 가장 많이 유입된 entry_url을 반환 (UTM 파라미터가 포함된 URL 우선)
 * 카페24 호환: v_sessions_cafe24 뷰 사용하여 봇 트래픽 제외
 */
async function getCreativeOriginalUrl({ creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate }) {
  // 단일 광고명이면 배열로 변환
  const creativeNames = Array.isArray(creative_name) ? creative_name : [creative_name];
  
  // FIX (2026-02-10): s.entry_url → us.page_url 변경
  // 멀티터치 세션에서 entry_url은 세션 시작 URL이므로 다른 광고의 URL일 수 있음
  // us.page_url은 해당 UTM 터치포인트 고유의 URL이므로 정확한 광고 URL을 반환
  const query = `
    WITH entry_urls AS (
      SELECT 
        us.page_url,
        -- URL에 쿼리 파라미터가 있는지 확인 (? 포함 여부)
        CASE WHEN us.page_url LIKE '%?%' THEN 1 ELSE 0 END as has_params,
        COUNT(*) as cnt
      FROM v_sessions_cafe24 s
      JOIN utm_sessions us ON s.session_id = us.session_id
      WHERE us.utm_params->>'utm_content' = ANY($1)
        AND (
          COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') = $2
          OR us.utm_params->>'utm_source' IS NULL
          OR us.utm_params->>'utm_source' = 'meta'
        )
        AND COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') = $3
        AND COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') = $4
        AND s.start_time >= $5
        AND s.start_time <= $6
        AND us.page_url IS NOT NULL
      GROUP BY us.page_url
    )
    SELECT 
      page_url as full_url,
      cnt as total_count
    FROM entry_urls
    ORDER BY has_params DESC, cnt DESC
    LIMIT 1
  `;
  
  const result = await db.query(query, [creativeNames, utm_source, utm_medium, utm_campaign, startDate, endDate]);
  
  if (result.rows.length === 0) {
    return {
      full_url: null,
      total_count: 0
    };
  }
  
  return {
    full_url: result.rows[0].full_url,
    total_count: parseInt(result.rows[0].total_count) || 0
  };
}

/**
 * 특정 광고 소재를 통해 유입된 세션의 차트용 집계 데이터 조회
 * - 체류시간 분포, 기기 분포, 전환 분포, PV 분포, 시간대별 분포
 * 카페24 호환: visitors.is_bot = false 필터 적용
 * 
 * @param {Object} params
 * @param {string} params.ad_id - 광고 ID (utm_id)
 * @param {string|string[]} params.creative_name - 광고 소재 이름 또는 배열
 * @param {string} params.utm_source - UTM Source
 * @param {string} params.utm_medium - UTM Medium
 * @param {string} params.utm_campaign - UTM Campaign
 * @param {Date} params.startDate - 시작일
 * @param {Date} params.endDate - 종료일
 * @returns {Promise<Object>} 집계 데이터
 */
async function getCreativeSessionsChartData({ ad_id, creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate }) {
  const useAdId = ad_id && ad_id !== '' && !ad_id.startsWith('{{');
  
  let query;
  let queryParams;
  
  if (useAdId) {
    query = `
      WITH target_sessions AS (
        SELECT DISTINCT us.session_id
        FROM utm_sessions us
        JOIN visitors v2 ON us.visitor_id = v2.visitor_id
        WHERE us.utm_params->>'utm_id' = $1
          AND COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') = $2
          AND COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') = $3
          AND us.entry_timestamp >= $4
          AND us.entry_timestamp <= $5
          AND v2.is_bot = false
      )
      SELECT 
        s.duration_seconds,
        s.pageview_count,
        -- FIX (2026-02-06): is_converted 대신 conversions 테이블로 실제 구매 확인
        -- 결제 과정(PG 리디렉트)에서 세션이 끊겨 is_converted 미반영 대응
        (s.is_converted = true OR EXISTS (
          SELECT 1 FROM conversions c
          WHERE c.session_id = s.session_id AND c.paid = 'T' AND c.final_payment > 0
          AND (c.canceled = 'F' OR c.canceled IS NULL)
          AND (c.order_status = 'confirmed' OR c.order_status IS NULL)
        )) as is_converted,
        v.device_type,
        EXTRACT(HOUR FROM s.start_time) as start_hour
      FROM sessions s
      JOIN visitors v ON s.visitor_id = v.visitor_id
      JOIN target_sessions ts ON s.session_id = ts.session_id
      WHERE v.is_bot = false
        AND s.start_time >= $4
        AND s.start_time <= $5
    `;
    queryParams = [ad_id, utm_medium, utm_campaign, startDate, endDate];
  } else {
    const creativeNames = Array.isArray(creative_name) ? creative_name : [creative_name];
    query = `
      WITH target_sessions AS (
        SELECT DISTINCT us.session_id
        FROM utm_sessions us
        JOIN visitors v2 ON us.visitor_id = v2.visitor_id
        WHERE us.utm_params->>'utm_content' = ANY($1)
          AND (COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') = $2 )
          AND COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') = $3
          AND COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') = $4
          AND us.entry_timestamp >= $5
          AND us.entry_timestamp <= $6
          AND v2.is_bot = false
      )
      SELECT 
        s.duration_seconds,
        s.pageview_count,
        -- FIX (2026-02-06): is_converted 대신 conversions 테이블로 실제 구매 확인
        -- 결제 과정(PG 리디렉트)에서 세션이 끊겨 is_converted 미반영 대응
        (s.is_converted = true OR EXISTS (
          SELECT 1 FROM conversions c
          WHERE c.session_id = s.session_id AND c.paid = 'T' AND c.final_payment > 0
          AND (c.canceled = 'F' OR c.canceled IS NULL)
          AND (c.order_status = 'confirmed' OR c.order_status IS NULL)
        )) as is_converted,
        v.device_type,
        EXTRACT(HOUR FROM s.start_time) as start_hour
      FROM sessions s
      JOIN visitors v ON s.visitor_id = v.visitor_id
      JOIN target_sessions ts ON s.session_id = ts.session_id
      WHERE v.is_bot = false
        AND s.start_time >= $5
        AND s.start_time <= $6
    `;
    queryParams = [creativeNames, utm_source, utm_medium, utm_campaign, startDate, endDate];
  }
  
  const result = await db.query(query, queryParams);
  return result.rows;
}

/**
 * 세션 내 구매 중 이 광고가 막타인 건수 조회 (= 공통 건수)
 * - member_id 기반 visitor 병합을 반영하여 정확한 last touch 판정
 * FIX (2026-02-06): UV 전환 구매 수와 막타 횟수 차이 안내용
 * 
 * @param {Object} params
 * @param {string} params.ad_id - 광고 ID (utm_id)
 * @param {string} params.utm_medium - UTM Medium
 * @param {string} params.utm_campaign - UTM Campaign
 * @param {Date} params.startDate - 시작일
 * @param {Date} params.endDate - 종료일
 * @returns {Promise<number>} 이 광고가 막타이면서 세션 내 구매인 건수 (공통 건수)
 */
async function getSessionPurchaseLastTouchCount({ ad_id, utm_medium, utm_campaign, startDate, endDate }) {
  if (!ad_id || ad_id === '' || ad_id.startsWith('{{')) return 0;
  
  const query = `
    WITH target_sessions AS (
      SELECT DISTINCT us.session_id
      FROM utm_sessions us
      JOIN visitors v ON us.visitor_id = v.visitor_id
      WHERE us.utm_params->>'utm_id' = $1
        AND COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') = $2
        AND COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') = $3
        AND us.entry_timestamp >= $4
        AND us.entry_timestamp <= $5
        AND v.is_bot = false
    ),
    session_purchases AS (
      SELECT DISTINCT ON (s.session_id)
        s.session_id,
        s.visitor_id,
        c.member_id,
        c.timestamp as purchase_time
      FROM sessions s
      JOIN conversions c ON c.session_id = s.session_id
      JOIN target_sessions ts ON s.session_id = ts.session_id
      JOIN visitors v ON s.visitor_id = v.visitor_id
      WHERE c.paid = 'T' AND c.final_payment > 0
        AND (c.canceled = 'F' OR c.canceled IS NULL)
        AND (c.order_status = 'confirmed' OR c.order_status IS NULL)
        AND v.is_bot = false
        AND s.start_time >= $4
        AND s.start_time <= $5
      ORDER BY s.session_id, c.timestamp
    ),
    -- member_id로 연결된 모든 visitor_id 수집
    merged_visitors AS (
      SELECT sp.session_id, sp.visitor_id, sp.member_id, sp.purchase_time,
        COALESCE(other_v.visitor_id, sp.visitor_id) as all_vid
      FROM session_purchases sp
      LEFT JOIN (
        SELECT DISTINCT c2.member_id, c2.visitor_id
        FROM conversions c2
        WHERE c2.member_id IS NOT NULL
      ) other_v ON sp.member_id = other_v.member_id AND sp.member_id IS NOT NULL
    ),
    -- 각 구매에 대해 병합된 전체 visitor의 마지막 UTM 엔트리 찾기
    last_utm_per_purchase AS (
      SELECT DISTINCT ON (mv.session_id)
        mv.session_id,
        us.utm_params->>'utm_id' as last_ad_id
      FROM merged_visitors mv
      JOIN utm_sessions us ON us.visitor_id = mv.all_vid
      JOIN visitors v ON us.visitor_id = v.visitor_id
      WHERE us.entry_timestamp <= mv.purchase_time
        AND NULLIF(us.utm_params->>'utm_id', '') IS NOT NULL
        AND us.utm_params->>'utm_id' NOT LIKE '{{%'
        AND us.utm_params->>'utm_content' IS NOT NULL
        AND v.is_bot = false
      ORDER BY mv.session_id, us.entry_timestamp DESC
    )
    SELECT COUNT(*) as count
    FROM last_utm_per_purchase
    WHERE last_ad_id = $1
  `;
  
  const result = await db.query(query, [ad_id, utm_medium, utm_campaign, startDate, endDate]);
  return parseInt(result.rows[0]?.count) || 0;
}

/**
 * IP+기기+OS 기반 UTM 여정 조회 (인앱 브라우저 쿠키 분리 대응)
 * FIX (2026-02-10): detailService의 getCreativeOrders에서 extended 모드 지원용
 * 
 * 동일 IP + device_type + OS를 가진 다른 visitor_id들의 UTM 세션 기록을 조회합니다.
 * creativeAttribution.js의 ipDeviceJourneyQuery와 동일한 로직
 * 
 * @param {Array} purchaserIds - 이미 찾은 구매자 visitor_id 목록 (제외용)
 * @param {boolean} onlyValidAdId - true면 정상 utm_id만 포함
 */
async function getVisitorJourneysByIpDeviceOs({ purchaserIds, onlyValidAdId = false }) {
  if (!purchaserIds || purchaserIds.length === 0) {
    return { visitorInfoRows: [], journeyRows: [] };
  }

  // 1단계: 구매자들의 IP, device_type, OS 정보 조회
  const visitorInfoQuery = `
    SELECT visitor_id, ip_address, device_type, os
    FROM visitors
    WHERE visitor_id = ANY($1)
      AND ip_address IS NOT NULL
      AND ip_address != 'unknown'
      AND device_type IS NOT NULL
      AND os IS NOT NULL
  `;
  const visitorInfoResult = await db.query(visitorInfoQuery, [purchaserIds]);
  
  // IP+device_type+OS 조합별로 구매자 그룹화
  const fingerprintGroups = {};
  visitorInfoResult.rows.forEach(row => {
    const fingerprint = `${row.ip_address}||${row.device_type}||${row.os}`;
    if (!fingerprintGroups[fingerprint]) {
      fingerprintGroups[fingerprint] = [];
    }
    fingerprintGroups[fingerprint].push(row.visitor_id);
  });
  
  const uniqueFingerprints = Object.keys(fingerprintGroups);
  if (uniqueFingerprints.length === 0) {
    return { visitorInfoRows: visitorInfoResult.rows, journeyRows: [] };
  }
  
  // 2단계: 동일 IP+device+OS의 다른 visitor_id들의 UTM 여정 조회
  const adIdFilter = onlyValidAdId
    ? `AND NULLIF(us.utm_params->>'utm_id', '') IS NOT NULL
       AND us.utm_params->>'utm_id' NOT LIKE '{{%'`
    : '';
  
  const ips = [];
  const deviceTypes = [];
  const oses = [];
  uniqueFingerprints.forEach(fp => {
    const [ip, dt, os] = fp.split('||');
    ips.push(ip);
    deviceTypes.push(dt);
    oses.push(os);
  });
  
  const journeyQuery = `
    SELECT 
      match_v.visitor_id as match_visitor_id,
      match_v.ip_address,
      match_v.device_type,
      match_v.os,
      us.visitor_id,
      us.utm_params->>'utm_id' as ad_id,
      us.utm_params->>'utm_content' as utm_content,
      COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') as utm_source,
      COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') as utm_medium,
      COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') as utm_campaign,
      us.sequence_order,
      us.entry_timestamp
    FROM visitors match_v
    JOIN utm_sessions us ON us.visitor_id = match_v.visitor_id
    JOIN visitors v ON us.visitor_id = v.visitor_id
    WHERE match_v.visitor_id != ALL($1)
      AND match_v.is_bot = false
      AND v.is_bot = false
      AND (match_v.ip_address, match_v.device_type, match_v.os) IN (
        SELECT unnest($2::text[]), unnest($3::text[]), unnest($4::text[])
      )
      AND us.utm_params->>'utm_content' IS NOT NULL
      ${adIdFilter}
    ORDER BY match_v.visitor_id, us.entry_timestamp
  `;
  
  const journeyResult = await db.query(journeyQuery, [purchaserIds, ips, deviceTypes, oses]);
  
  return { 
    visitorInfoRows: visitorInfoResult.rows, 
    journeyRows: journeyResult.rows,
    fingerprintGroups
  };
}

module.exports = {
  getAllOrdersInPeriod,
  getVisitorJourneys,
  getVisitorJourneysByMemberId,
  getVisitorJourneysByIpDeviceOs,
  getVisitorSessionInfoForCreative,
  getVisitorTotalVisits,
  getCreativeSessions,
  getCreativeSessionsCount,
  getCreativeEntries,
  getCreativeEntriesCount,
  getCreativeOriginalUrl,
  getCreativeSessionsChartData,
  getSessionPurchaseLastTouchCount
};
