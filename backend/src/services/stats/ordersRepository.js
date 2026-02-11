const db = require('../../utils/database');

/**
 * Orders Repository
 * 주문 관련 데이터베이스 쿼리 담당
 */

/**
 * 필터 조건 빌더
 * @param {object} filters - 필터 옵션
 * @returns {object} { filters: string, params: array, paramIndex: number }
 */
function buildOrderFilters(filters = {}) {
  const {
    device,
    search,
    includeCancelled,
    includePending,
    startParamIndex = 3
  } = filters;

  let filterClauses = [];
  let params = [];
  let paramIndex = startParamIndex;

  // 디바이스 필터
  if (device && device !== 'all') {
    filterClauses.push(`v.device_type = $${paramIndex}`);
    params.push(device);
    paramIndex++;
  }

  // 검색 필터 (주문번호 또는 상품명)
  if (search && search.trim()) {
    const searchTerm = `%${search.trim()}%`;
    filterClauses.push(`(
      c.order_id ILIKE $${paramIndex} 
      OR COALESCE(c.product_name, '') ILIKE $${paramIndex}
    )`);
    params.push(searchTerm);
    paramIndex++;
  }

  // 취소/반품 주문 필터 및 금액 조건
  if (includeCancelled !== true && includeCancelled !== 'true') {
    filterClauses.push(`(c.canceled = 'F' OR c.canceled IS NULL)`);
    filterClauses.push(`(c.order_status = 'confirmed' OR c.order_status IS NULL)`);
    filterClauses.push(`(c.final_payment > 0 OR c.total_amount > 0)`);
  }

  // 입금대기 주문 필터
  // 취소/반품 포함 시, 취소된 주문은 paid 상태와 관계없이 표시
  if (includePending !== true && includePending !== 'true') {
    if (includeCancelled === true || includeCancelled === 'true') {
      // 취소/반품 포함이면: 정상 주문만 paid='T' 필터 적용, 취소/반품 주문은 제외하지 않음
      filterClauses.push(`(c.paid = 'T' OR c.canceled = 'T' OR c.order_status IN ('cancelled', 'refunded'))`);
    } else {
      // 취소/반품 미포함이면: 기존대로 paid='T' 필터
      filterClauses.push(`c.paid = 'T'`);
    }
  }

  return {
    filters: filterClauses.length > 0 ? 'AND ' + filterClauses.join(' AND ') : '',
    params,
    paramIndex
  };
}

/**
 * 정렬 필드 매핑 (SQL injection 방지)
 */
const SORT_FIELD_MAP = {
  'order_id': 'c.order_id',
  'timestamp': 'c.timestamp',
  'final_payment': 'c.final_payment',
  'total_amount': 'c.total_amount',
  'product_name': 'c.product_name',
  'product_count': 'c.product_count',
  'device_type': 'v.device_type',
  'is_repurchase': 'is_repurchase',
  'utm_source': 'utm_source'
};

/**
 * 주문 목록 조회
 */
async function getOrders(options) {
  const {
    start,
    end,
    device = 'all',
    search = '',
    sortBy = 'timestamp',
    sortOrder = 'desc',
    includeCancelled = 'false',
    includePending = 'false',
    limit = 100,
    offset = 0
  } = options;

  // 필터 빌드
  const { filters, params, paramIndex } = buildOrderFilters({
    device,
    search,
    includeCancelled,
    includePending
  });

  // 정렬 설정
  const sortColumn = SORT_FIELD_MAP[sortBy] || 'c.timestamp';
  const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';

  // 쿼리 파라미터
  const queryParams = [start, end, ...params, parseInt(limit), parseInt(offset)];

  // 주문 목록 쿼리
  const ordersQuery = `
    SELECT 
      c.order_id,
      TO_CHAR(c.timestamp, 'YYYY-MM-DD HH24:MI:SS') as timestamp,
      c.timestamp as raw_timestamp,
      c.final_payment,
      c.total_amount,
      c.product_count,
      c.visitor_id,
      c.session_id,
      c.points_spent,
      c.credits_spent,
      c.order_place_name,
      c.payment_method_name,
      c.order_status,
      c.canceled,
      c.paid,
      s.ip_address,
      v.device_type,
      -- UTM 데이터: utm_sessions 우선, 없으면 visitors 테이블 사용
      COALESCE(
        (SELECT us.utm_source FROM utm_sessions us 
         WHERE us.visitor_id = c.visitor_id 
         ORDER BY us.entry_timestamp DESC LIMIT 1),
        v.utm_source
      ) as utm_source,
      COALESCE(
        (SELECT us.utm_campaign FROM utm_sessions us 
         WHERE us.visitor_id = c.visitor_id 
         ORDER BY us.entry_timestamp DESC LIMIT 1),
        v.utm_campaign
      ) as utm_campaign,
      -- 상품명: conversions.product_name 우선, 없으면 events에서 조회
      COALESCE(
        c.product_name,
        (
          SELECT e.product_name 
          FROM events e 
          WHERE e.visitor_id = c.visitor_id 
            AND e.event_type = 'purchase' 
            AND e.timestamp <= c.timestamp 
          ORDER BY e.timestamp DESC 
          LIMIT 1
        )
      ) as product_name,
      -- 재구매 여부: Cafe24 first_order 우선, 없으면 visitor_id 기반 계산
      CASE 
        -- 1순위: Cafe24 first_order 필드 (T=신규, F=재구매)
        WHEN c.first_order = 'T' THEN false
        WHEN c.first_order = 'F' THEN true
        -- 2순위: visitor_id 기반 계산 (기존 로직)
        WHEN c.visitor_id IS NULL OR c.visitor_id = '' THEN NULL
        WHEN EXISTS (
          SELECT 1 FROM conversions c2 
          WHERE c2.visitor_id = c.visitor_id 
            AND c2.timestamp < c.timestamp
            AND c2.paid = 'T'
            AND (c2.final_payment > 0 OR c2.total_amount > 0)
        ) THEN true
        ELSE false
      END as is_repurchase
    FROM conversions c
    LEFT JOIN sessions s ON c.session_id = s.session_id
    LEFT JOIN visitors v ON c.visitor_id = v.visitor_id
    WHERE c.timestamp >= $1::date
      AND c.timestamp < ($2::date + INTERVAL '1 day')
      AND c.order_id IS NOT NULL
      ${filters}
    ORDER BY ${sortColumn} ${sortDirection}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  const result = await db.query(ordersQuery, queryParams);
  return result.rows;
}

/**
 * 주문 총 개수 조회
 */
async function getOrdersCount(options) {
  const {
    start,
    end,
    device = 'all',
    search = '',
    includeCancelled = 'false',
    includePending = 'false'
  } = options;

  // 필터 빌드
  const { filters, params } = buildOrderFilters({
    device,
    search,
    includeCancelled,
    includePending
  });

  const queryParams = [start, end, ...params];

  const countQuery = `
    SELECT COUNT(*) as total
    FROM conversions c
    LEFT JOIN visitors v ON c.visitor_id = v.visitor_id
    WHERE c.timestamp >= $1::date
      AND c.timestamp < ($2::date + INTERVAL '1 day')
      AND c.order_id IS NOT NULL
      ${filters}
  `;

  const result = await db.query(countQuery, queryParams);
  return parseInt(result.rows[0].total);
}

/**
 * 주문 기본 정보 조회
 * FIX (2026-02-03): member_id 추가 (회원 기반 연결)
 */
async function getOrderBasicInfo(orderId) {
  const query = `
    SELECT
      c.order_id,
      c.timestamp,
      c.final_payment,
      c.total_amount,
      c.product_count,
      c.visitor_id,
      c.session_id,
      c.member_id,
      c.discount_amount,
      c.mileage_used,
      c.points_spent,
      c.credits_spent,
      c.shipping_fee,
      c.payment_method_name,
      c.order_place_name,
      c.order_status,
      c.canceled,
      c.paid,
      c.product_name as db_product_name,
      s.ip_address,
      s.entry_url,
      v.device_type,
      v.browser,
      v.os,
      v.utm_source,
      v.utm_medium,
      v.utm_campaign,
      v.first_visit,
      v.browser_fingerprint,
      v.member_id_crypt,
      (
        SELECT e.product_name
        FROM events e
        WHERE e.visitor_id = c.visitor_id
          AND e.event_type = 'purchase'
          AND e.timestamp <= c.timestamp
        ORDER BY e.timestamp DESC
        LIMIT 1
      ) as event_product_name
    FROM conversions c
    LEFT JOIN sessions s ON c.session_id = s.session_id
    LEFT JOIN visitors v ON c.visitor_id = v.visitor_id
    WHERE c.order_id = $1
  `;

  const result = await db.query(query, [orderId]);
  return result.rows[0] || null;
}

/**
 * 구매 당일 전체 경로 조회
 */
async function getPurchaseJourney(visitorId, purchaseTimestamp) {
  const query = `
    WITH purchase_journey_pages AS (
      SELECT
        p.page_url,
        p.page_title,
        p.timestamp,
        LEAD(p.timestamp) OVER (ORDER BY p.timestamp) as next_timestamp
      FROM pageviews p
      WHERE p.visitor_id = $1
        AND DATE(p.timestamp) = DATE(($2::timestamptz) AT TIME ZONE 'Asia/Seoul')
        AND p.timestamp <= (($2::timestamptz) AT TIME ZONE 'Asia/Seoul')
      ORDER BY p.timestamp ASC
    )
    SELECT
      page_url,
      page_title,
      timestamp,
      CASE
        WHEN next_timestamp IS NOT NULL THEN
          LEAST(
            EXTRACT(EPOCH FROM (next_timestamp - timestamp))::INTEGER,
            600
          )
        ELSE 0
      END as time_spent_seconds
    FROM purchase_journey_pages
  `;

  const result = await db.query(query, [visitorId, purchaseTimestamp]);
  return result.rows;
}

/**
 * 과거 방문 이력 조회 (구매 당일 이전)
 */
async function getPreviousVisits(visitorId, purchaseTimestamp) {
  // FIX (2026-02-04): 구매일 이전 제한 제거 - 전체 방문 기록 조회
  const query = `
    WITH all_pageviews AS (
      SELECT
        p.page_url,
        p.page_title,
        p.timestamp,
        DATE(p.timestamp) as visit_date,
        LEAD(p.timestamp) OVER (PARTITION BY DATE(p.timestamp) ORDER BY p.timestamp) as next_timestamp
      FROM pageviews p
      WHERE p.visitor_id = $1
    )
    SELECT
      visit_date,
      page_url,
      page_title,
      timestamp,
      CASE
        WHEN next_timestamp IS NOT NULL THEN
          LEAST(
            EXTRACT(EPOCH FROM (next_timestamp - timestamp))::INTEGER,
            600
          )
        ELSE 0
      END as time_spent_seconds
    FROM all_pageviews
    ORDER BY timestamp ASC
  `;

  const result = await db.query(query, [visitorId]);
  return result.rows;
}

/**
 * UTM 히스토리 조회 (병합 적용)
 * 
 * FIX (2026-01-27): Attribution Window (구매일 기준) 필터 추가
 * FIX (2026-02-04): Attribution Window를 사용자가 선택할 수 있도록 변경
 *   - attributionWindowDays: 30, 60, 90, 또는 null(전체)
 * 
 * 인앱 브라우저 쿠키 문제 대응:
 * - 인앱 브라우저에서 쿠키가 저장되지 않으면 visitor_id가 중복 생성됨
 * - conversions.visitor_id와 utm_sessions.visitor_id가 다를 수 있음
 * - session_id를 통해 sessions.visitor_id를 찾아 utm_sessions 조회
 * 
 * @param {string} visitorId - conversions 테이블의 visitor_id
 * @param {string} sessionId - conversions 테이블의 session_id (optional, for fallback)
 * @param {Date|string} purchaseTimestamp - 구매일시 (Attribution Window 계산용)
 * @param {number|null} attributionWindowDays - Attribution Window 일수 (30, 60, 90, null=전체)
 */
async function getUtmHistory(visitorId, sessionId = null, purchaseTimestamp = null, attributionWindowDays = 30, removeUpperBound = false) {
  // Attribution Window 적용 여부 결정 (null이면 전체 기간)
  const hasAttributionFilter = purchaseTimestamp !== null && attributionWindowDays !== null;
  
  const query = `
    WITH 
    -- session_id 기반으로 실제 visitor_id 찾기 (인앱 브라우저 쿠키 문제 대응)
    session_visitor AS (
      SELECT visitor_id 
      FROM sessions 
      WHERE session_id = $2
    ),
    -- 조회할 visitor_id 결정: session 기반 visitor_id 우선, 없으면 원래 visitor_id
    target_visitors AS (
      SELECT visitor_id FROM session_visitor
      UNION
      SELECT $1::text as visitor_id
    ),
    enriched_utm AS (
      SELECT
        us.id,
        us.visitor_id,
        COALESCE(us.utm_source, us.utm_params->>'utm_source', 'direct') as utm_source,
        COALESCE(us.utm_medium, us.utm_params->>'utm_medium') as utm_medium,
        COALESCE(us.utm_campaign, us.utm_params->>'utm_campaign') as utm_campaign,
        us.utm_params->>'utm_content' as utm_content,
        us.entry_timestamp,
        us.exit_timestamp,
        us.duration_seconds,
        us.sequence_order
      FROM utm_sessions us
      WHERE us.visitor_id IN (SELECT visitor_id FROM target_visitors)
        ${hasAttributionFilter ? `
        -- Attribution Window 하한 적용 (사용자 선택 기간)
        AND us.entry_timestamp >= ($3::timestamp - INTERVAL '${attributionWindowDays} days')
        ${removeUpperBound ? '' : `AND us.entry_timestamp <= $3::timestamp`}
        ` : (purchaseTimestamp !== null && !removeUpperBound ? `
        -- 전체 기간: 구매일 이전만 필터
        AND us.entry_timestamp <= $3::timestamp
        ` : '')}
    ),
    with_gaps AS (
      SELECT
        eu.*,
        LAG(eu.exit_timestamp) OVER (
          PARTITION BY eu.utm_content
          ORDER BY eu.entry_timestamp
        ) as prev_exit_timestamp
      FROM enriched_utm eu
    ),
    with_group_flags AS (
      SELECT
        *,
        CASE 
          WHEN prev_exit_timestamp IS NULL THEN 1
          WHEN EXTRACT(EPOCH FROM (entry_timestamp - prev_exit_timestamp)) > 300 THEN 1
          ELSE 0
        END as is_new_group
      FROM with_gaps
    ),
    grouped_sessions AS (
      SELECT
        *,
        SUM(is_new_group) OVER (
          PARTITION BY utm_content
          ORDER BY entry_timestamp
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) as session_group
      FROM with_group_flags
    ),
    merged_sessions AS (
      SELECT
        MIN(utm_source) as utm_source,
        MIN(utm_medium) as utm_medium,
        MIN(utm_campaign) as utm_campaign,
        MIN(utm_content) as utm_content,
        MIN(entry_timestamp) as entry_timestamp,
        MAX(exit_timestamp) as exit_timestamp,
        SUM(duration_seconds) as total_duration_seconds,
        MIN(sequence_order) as original_sequence_order
      FROM grouped_sessions
      GROUP BY utm_content, session_group
    )
    SELECT
      utm_source,
      utm_medium,
      utm_campaign,
      utm_content,
      entry_timestamp,
      total_duration_seconds as duration_seconds
    FROM merged_sessions
    ORDER BY entry_timestamp ASC
  `;

  // FIX (2026-02-10): $3이 SQL에서 참조될 때만 params에 포함
  // - hasAttributionFilter: 하한 조건에서 $3 참조
  // - !removeUpperBound && purchaseTimestamp: 상한 조건에서 $3 참조
  const needsPurchaseTimestamp = purchaseTimestamp !== null && (hasAttributionFilter || !removeUpperBound);
  const params = needsPurchaseTimestamp
    ? [visitorId, sessionId, purchaseTimestamp]
    : [visitorId, sessionId];
  
  const result = await db.query(query, params);
  return result.rows;
}

/**
 * 동일 IP 방문 기록 조회
 */
async function getSameIpVisits(ipAddress, excludeSessionId) {
  const query = `
    SELECT
      s.session_id,
      s.start_time,
      s.entry_url,
      s.pageview_count,
      v.visitor_id,
      v.utm_source,
      v.utm_medium,
      v.utm_campaign,
      v.device_type,
      CASE
        WHEN EXISTS (
          SELECT 1 FROM conversions c WHERE c.session_id = s.session_id
        ) THEN true
        ELSE false
      END as has_purchase
    FROM sessions s
    LEFT JOIN visitors v ON s.visitor_id = v.visitor_id
    WHERE s.ip_address = $1
      AND s.session_id != $2
    ORDER BY s.start_time DESC
    LIMIT 20
  `;

  const result = await db.query(query, [ipAddress, excludeSessionId]);
  return result.rows;
}

/**
 * 브라우저 핑거프린트 기반 과거 방문 기록 조회 (쿠키 끊김 대응)
 * 
 * 쿠키가 끊어져서 visitor_id가 달라진 경우에도
 * 동일 browser_fingerprint로 과거 방문 기록을 연결합니다.
 * 
 * FIX (2026-02-11): IP+기기+OS 매칭 → browser_fingerprint 매칭으로 전면 교체
 * - 공유 네트워크 오매칭 문제 근본 해결
 * 
 * @param {string} fingerprint - 브라우저 핑거프린트
 * @param {string} currentVisitorId - 현재 visitor_id (제외용)
 */
async function getPreviousVisitsByFingerprint(fingerprint, currentVisitorId) {
  if (!fingerprint) {
    return [];
  }

  const query = `
    WITH fp_visitors AS (
      -- 동일 browser_fingerprint의 다른 visitor_id들 찾기
      SELECT DISTINCT v.visitor_id
      FROM visitors v
      WHERE v.browser_fingerprint = $1
        AND v.visitor_id != $2
        AND v.is_bot = false
    ),
    fp_pageviews AS (
      SELECT
        p.page_url,
        p.page_title,
        p.timestamp,
        DATE(p.timestamp) as visit_date,
        p.visitor_id,
        LEAD(p.timestamp) OVER (PARTITION BY DATE(p.timestamp) ORDER BY p.timestamp) as next_timestamp
      FROM pageviews p
      WHERE p.visitor_id IN (SELECT visitor_id FROM fp_visitors)
    )
    SELECT
      visit_date,
      page_url,
      page_title,
      timestamp,
      visitor_id,
      CASE
        WHEN next_timestamp IS NOT NULL THEN
          LEAST(
            EXTRACT(EPOCH FROM (next_timestamp - timestamp))::INTEGER,
            600
          )
        ELSE 0
      END as time_spent_seconds
    FROM fp_pageviews
    ORDER BY timestamp ASC
  `;

  const result = await db.query(query, [fingerprint, currentVisitorId]);
  return result.rows;
}

/**
 * 브라우저 핑거프린트 기반 UTM 히스토리 조회 (쿠키 끊김 대응)
 * 
 * 동일 browser_fingerprint의 다른 visitor_id들의 UTM 세션 기록을 조회합니다.
 * 
 * FIX (2026-02-11): IP 기반 → browser_fingerprint 기반으로 전면 교체
 * - getUtmHistoryByIp() + getUtmHistoryByIpDeviceOs()를 통합 대체
 * - 동시 활동 필터 유지 (안전장치)
 * 
 * @param {string} fingerprint - 브라우저 핑거프린트
 * @param {string} currentVisitorId - 현재 visitor_id (제외용)
 * @param {Date} purchaseTimestamp - 구매일시
 * @param {number|null} attributionWindowDays - Attribution Window (30, 60, 90, null=전체)
 * @param {boolean} removeUpperBound - true면 구매 이후 UTM도 포함
 */
async function getUtmHistoryByFingerprint(fingerprint, currentVisitorId, purchaseTimestamp, attributionWindowDays = 30, removeUpperBound = false) {
  if (!fingerprint) {
    return [];
  }

  const hasAttributionFilter = attributionWindowDays !== null;

  const query = `
    WITH fp_visitors AS (
      -- 동일 browser_fingerprint의 다른 visitor_id들 찾기
      -- + 동시 활동 필터: 구매자와 세션이 60초 이상 겹치는 방문자는 다른 사람으로 제외
      SELECT DISTINCT v.visitor_id
      FROM visitors v
      WHERE v.browser_fingerprint = $1
        AND v.visitor_id != $2
        AND v.is_bot = false
        AND NOT EXISTS (
          SELECT 1
          FROM sessions match_s
          JOIN sessions purch_s ON purch_s.visitor_id = $2
          WHERE match_s.visitor_id = v.visitor_id
            AND match_s.start_time < COALESCE(purch_s.end_time, purch_s.start_time)
            AND purch_s.start_time < COALESCE(match_s.end_time, match_s.start_time)
            AND EXTRACT(EPOCH FROM (
              LEAST(COALESCE(match_s.end_time, match_s.start_time), COALESCE(purch_s.end_time, purch_s.start_time))
              - GREATEST(match_s.start_time, purch_s.start_time)
            )) >= 60
          LIMIT 1
        )
    ),
    deduplicated_utm AS (
      SELECT DISTINCT ON (us.session_id, us.utm_params->>'utm_content')
        us.visitor_id,
        us.session_id,
        COALESCE(us.utm_source, us.utm_params->>'utm_source', 'direct') as utm_source,
        COALESCE(us.utm_medium, us.utm_params->>'utm_medium') as utm_medium,
        COALESCE(us.utm_campaign, us.utm_params->>'utm_campaign') as utm_campaign,
        us.utm_params->>'utm_content' as utm_content,
        us.entry_timestamp,
        us.duration_seconds,
        us.sequence_order
      FROM utm_sessions us
      WHERE us.visitor_id IN (SELECT visitor_id FROM fp_visitors)
        ${hasAttributionFilter ? `
        AND us.entry_timestamp >= ($3::timestamp - INTERVAL '${attributionWindowDays} days')
        ` : ''}
        ${removeUpperBound ? '' : `AND us.entry_timestamp <= $3::timestamp`}
      ORDER BY us.session_id, us.utm_params->>'utm_content', us.entry_timestamp ASC
    )
    SELECT * FROM deduplicated_utm
    ORDER BY entry_timestamp ASC
  `;

  const needsPurchaseTimestamp = hasAttributionFilter || !removeUpperBound;
  const params = needsPurchaseTimestamp
    ? [fingerprint, currentVisitorId, purchaseTimestamp]
    : [fingerprint, currentVisitorId];

  const result = await db.query(query, params);
  return result.rows;
}

/**
 * member_id 기반 과거 방문 기록 조회 (쿠키 끊김 대응)
 * 
 * 동일 회원 ID를 가진 다른 주문의 visitor_id들의 과거 방문 기록을 연결합니다.
 * 
 * FIX (2026-02-04): 구매일 이전 제한 제거 - 전체 방문 기록 조회
 * 
 * @param {string} memberId - Cafe24 회원 ID
 * @param {string} currentVisitorId - 현재 visitor_id (제외용)
 */
async function getPreviousVisitsByMemberId(memberId, currentVisitorId) {
  if (!memberId || memberId === '') {
    return [];
  }

  const query = `
    WITH member_visitors AS (
      -- 동일 member_id를 가진 다른 주문의 visitor_id들 찾기
      SELECT DISTINCT c.visitor_id
      FROM conversions c
      JOIN visitors v ON c.visitor_id = v.visitor_id
      WHERE c.member_id = $1
        AND c.visitor_id IS NOT NULL
        AND c.visitor_id != $2
        AND v.is_bot = false
    ),
    member_pageviews AS (
      SELECT
        p.page_url,
        p.page_title,
        p.timestamp,
        DATE(p.timestamp) as visit_date,
        p.visitor_id,
        LEAD(p.timestamp) OVER (PARTITION BY DATE(p.timestamp) ORDER BY p.timestamp) as next_timestamp
      FROM pageviews p
      WHERE p.visitor_id IN (SELECT visitor_id FROM member_visitors)
    )
    SELECT
      visit_date,
      page_url,
      page_title,
      timestamp,
      visitor_id,
      CASE
        WHEN next_timestamp IS NOT NULL THEN
          LEAST(
            EXTRACT(EPOCH FROM (next_timestamp - timestamp))::INTEGER,
            600
          )
        ELSE 0
      END as time_spent_seconds
    FROM member_pageviews
    ORDER BY timestamp ASC
  `;

  const result = await db.query(query, [memberId, currentVisitorId]);
  return result.rows;
}

/**
 * member_id 기반 UTM 히스토리 조회 (쿠키 끊김 대응)
 * 
 * 동일 회원 ID를 가진 다른 주문의 visitor_id들의 UTM 세션 기록을 조회합니다.
 * 
 * FIX (2026-02-04): Attribution Window를 사용자가 선택할 수 있도록 변경
 * 
 * @param {string} memberId - Cafe24 회원 ID
 * @param {string} currentVisitorId - 현재 visitor_id (제외용)
 * @param {Date} purchaseTimestamp - 구매일시
 * @param {number|null} attributionWindowDays - Attribution Window (30, 60, 90, null=전체)
 */
async function getUtmHistoryByMemberId(memberId, currentVisitorId, purchaseTimestamp, attributionWindowDays = 30, removeUpperBound = false) {
  if (!memberId || memberId === '') {
    return [];
  }

  // Attribution Window 적용 여부 결정 (null이면 전체 기간)
  const hasAttributionFilter = attributionWindowDays !== null;

  // FIX (2026-02-04): session_id로 그룹화하여 중복 제거
  // 트래커가 페이지 이동마다 UTM 세션을 새로 기록하는 버그 대응
  const query = `
    WITH member_visitors AS (
      -- 동일 member_id를 가진 다른 주문의 visitor_id들 찾기
      SELECT DISTINCT c.visitor_id
      FROM conversions c
      JOIN visitors v ON c.visitor_id = v.visitor_id
      WHERE c.member_id = $1
        AND c.visitor_id IS NOT NULL
        AND c.visitor_id != $2
        AND v.is_bot = false
    ),
    deduplicated_utm AS (
      -- session_id + utm_content 조합으로 그룹화하여 첫 번째 entry만 선택
      SELECT DISTINCT ON (us.session_id, us.utm_params->>'utm_content')
        us.visitor_id,
        us.session_id,
        COALESCE(us.utm_source, us.utm_params->>'utm_source', 'direct') as utm_source,
        COALESCE(us.utm_medium, us.utm_params->>'utm_medium') as utm_medium,
        COALESCE(us.utm_campaign, us.utm_params->>'utm_campaign') as utm_campaign,
        us.utm_params->>'utm_content' as utm_content,
        us.entry_timestamp,
        us.duration_seconds,
        us.sequence_order
      FROM utm_sessions us
      WHERE us.visitor_id IN (SELECT visitor_id FROM member_visitors)
        ${hasAttributionFilter ? `
        AND us.entry_timestamp >= ($3::timestamp - INTERVAL '${attributionWindowDays} days')
        ` : ''}
        ${removeUpperBound ? '' : `AND us.entry_timestamp <= $3::timestamp`}
      ORDER BY us.session_id, us.utm_params->>'utm_content', us.entry_timestamp ASC
    )
    SELECT * FROM deduplicated_utm
    ORDER BY entry_timestamp ASC
  `;

  // FIX (2026-02-10): $3이 SQL에서 참조될 때만 params에 포함
  const needsPurchaseTimestamp = hasAttributionFilter || !removeUpperBound;
  const params = needsPurchaseTimestamp
    ? [memberId, currentVisitorId, purchaseTimestamp]
    : [memberId, currentVisitorId];

  const result = await db.query(query, params);
  return result.rows;
}

/**
 * 과거 구매 이력 조회
 */
async function getPastPurchases(visitorId, excludeOrderId) {
  // FIX (2026-02-04): 취소 필터 제거 - 구매 시도 여부가 중요하므로 모든 주문 표시
  const query = `
    SELECT
      c.order_id,
      c.timestamp,
      c.final_payment,
      c.product_count,
      c.order_status,
      c.paid,
      c.canceled,
      COALESCE(
        c.product_name,
        (
          SELECT e.product_name
          FROM events e
          WHERE e.visitor_id = c.visitor_id
            AND e.event_type = 'purchase'
            AND e.timestamp <= c.timestamp
          ORDER BY e.timestamp DESC
          LIMIT 1
        )
      ) as product_name
    FROM conversions c
    WHERE c.visitor_id = $1
      AND c.order_id != $2
    ORDER BY c.timestamp DESC
    LIMIT 20
  `;

  const result = await db.query(query, [visitorId, excludeOrderId]);
  return result.rows;
}

/**
 * 브라우저 핑거프린트 기반 과거 구매 이력 조회 (쿠키 끊김 대응)
 * FIX (2026-02-11): IP 기반 → browser_fingerprint 기반으로 전면 교체
 */
async function getPastPurchasesByFingerprint(fingerprint, currentVisitorId, excludeOrderId) {
  if (!fingerprint) {
    return [];
  }

  const query = `
    SELECT
      c.order_id,
      c.timestamp,
      c.final_payment,
      c.product_count,
      c.order_status,
      c.paid,
      c.canceled,
      c.visitor_id,
      COALESCE(
        c.product_name,
        (
          SELECT e.product_name
          FROM events e
          WHERE e.visitor_id = c.visitor_id
            AND e.event_type = 'purchase'
            AND e.timestamp <= c.timestamp
          ORDER BY e.timestamp DESC
          LIMIT 1
        )
      ) as product_name
    FROM conversions c
    JOIN visitors v ON c.visitor_id = v.visitor_id
    WHERE v.browser_fingerprint = $1
      AND c.visitor_id != $2
      AND c.order_id != $3
    ORDER BY c.timestamp DESC
    LIMIT 20
  `;

  const result = await db.query(query, [fingerprint, currentVisitorId, excludeOrderId]);
  return result.rows;
}

/**
 * member_id 기반 과거 구매 이력 조회 (회원 기반 연결)
 * FIX (2026-02-04): 다른 visitor_id로 구매한 경우도 조회
 */
async function getPastPurchasesByMemberId(memberId, excludeOrderId) {
  if (!memberId || memberId === '') {
    return [];
  }

  // FIX (2026-02-04): 취소 필터 제거, visitor_id 조건 완화 - 모든 구매 기록 표시
  const query = `
    SELECT
      c.order_id,
      c.timestamp,
      c.final_payment,
      c.product_count,
      c.order_status,
      c.paid,
      c.canceled,
      c.visitor_id,
      COALESCE(
        c.product_name,
        (
          SELECT e.product_name
          FROM events e
          WHERE e.visitor_id = c.visitor_id
            AND e.event_type = 'purchase'
            AND e.timestamp <= c.timestamp
          ORDER BY e.timestamp DESC
          LIMIT 1
        )
      ) as product_name
    FROM conversions c
    WHERE c.member_id = $1
      AND c.order_id != $2
    ORDER BY c.timestamp DESC
    LIMIT 30
  `;

  const result = await db.query(query, [memberId, excludeOrderId]);
  return result.rows;
}

module.exports = {
  getOrders,
  getOrdersCount,
  getOrderBasicInfo,
  getPurchaseJourney,
  getPreviousVisits,
  getPreviousVisitsByFingerprint,
  getPreviousVisitsByMemberId,
  getUtmHistory,
  getUtmHistoryByFingerprint,
  getUtmHistoryByMemberId,
  getSameIpVisits,
  getPastPurchases,
  getPastPurchasesByFingerprint,
  getPastPurchasesByMemberId,
  buildOrderFilters,
  SORT_FIELD_MAP
};

