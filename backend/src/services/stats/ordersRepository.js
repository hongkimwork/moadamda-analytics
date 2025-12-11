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

  // 입금대기 주문 필터
  if (includePending !== true && includePending !== 'true') {
    filterClauses.push(`c.paid = 'T'`);
  }

  // 취소/반품 주문 필터 및 금액 조건
  if (includeCancelled !== true && includeCancelled !== 'true') {
    filterClauses.push(`(c.canceled = 'F' OR c.canceled IS NULL)`);
    filterClauses.push(`(c.order_status = 'confirmed' OR c.order_status IS NULL)`);
    filterClauses.push(`(c.final_payment > 0 OR c.total_amount > 0)`);
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
      -- 재구매 여부: 동일 visitor_id로 이전 구매가 있는지 확인
      CASE 
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
      c.discount_amount,
      c.mileage_used,
      c.points_spent,
      c.credits_spent,
      c.shipping_fee,
      c.payment_method_name,
      c.order_place_name,
      c.order_status,
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
  const query = `
    WITH previous_pageviews AS (
      SELECT
        p.page_url,
        p.page_title,
        p.timestamp,
        DATE(p.timestamp) as visit_date,
        LEAD(p.timestamp) OVER (PARTITION BY DATE(p.timestamp) ORDER BY p.timestamp) as next_timestamp
      FROM pageviews p
      WHERE p.visitor_id = $1
        AND DATE(p.timestamp) < DATE(($2::timestamptz) AT TIME ZONE 'Asia/Seoul')
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
    FROM previous_pageviews
    ORDER BY timestamp ASC
  `;

  const result = await db.query(query, [visitorId, purchaseTimestamp]);
  return result.rows;
}

/**
 * UTM 히스토리 조회 (병합 적용)
 */
async function getUtmHistory(visitorId) {
  const query = `
    WITH enriched_utm AS (
      SELECT
        id,
        visitor_id,
        COALESCE(utm_source, utm_params->>'utm_source', 'direct') as utm_source,
        COALESCE(utm_medium, utm_params->>'utm_medium') as utm_medium,
        COALESCE(utm_campaign, utm_params->>'utm_campaign') as utm_campaign,
        utm_params->>'utm_content' as utm_content,
        entry_timestamp,
        exit_timestamp,
        duration_seconds,
        sequence_order
      FROM utm_sessions
      WHERE visitor_id = $1
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

  const result = await db.query(query, [visitorId]);
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
 * 과거 구매 이력 조회
 */
async function getPastPurchases(visitorId, excludeOrderId) {
  const query = `
    SELECT
      c.order_id,
      c.timestamp,
      c.final_payment,
      c.product_count,
      (
        SELECT e.product_name
        FROM events e
        WHERE e.visitor_id = c.visitor_id
          AND e.event_type = 'purchase'
          AND e.timestamp <= c.timestamp
        ORDER BY e.timestamp DESC
        LIMIT 1
      ) as product_name
    FROM conversions c
    WHERE c.visitor_id = $1
      AND c.order_id != $2
    ORDER BY c.timestamp DESC
    LIMIT 10
  `;

  const result = await db.query(query, [visitorId, excludeOrderId]);
  return result.rows;
}

module.exports = {
  getOrders,
  getOrdersCount,
  getOrderBasicInfo,
  getPurchaseJourney,
  getPreviousVisits,
  getUtmHistory,
  getSameIpVisits,
  getPastPurchases,
  buildOrderFilters,
  SORT_FIELD_MAP
};

