/**
 * 광고 소재 상세 분석 Repository
 * POST 엔드포인트들의 DB 쿼리만 담당
 */

const db = require('../../utils/database');

/**
 * 선택 기간 내 모든 광고를 본 visitor 목록 조회
 * (테이블 creativeAttribution.js와 동일한 방식)
 * 카페24 호환: visitors 테이블과 조인하여 봇 트래픽 제외
 */
async function getAllVisitorsInPeriod({ startDate, endDate }) {
  const query = `
    SELECT DISTINCT us.visitor_id
    FROM utm_sessions us
    JOIN visitors v ON us.visitor_id = v.visitor_id
    WHERE us.utm_params->>'utm_content' IS NOT NULL
      AND us.entry_timestamp >= $1
      AND us.entry_timestamp <= $2
      AND v.is_bot = false
  `;
  
  const result = await db.query(query, [startDate, endDate]);
  return result.rows.map(r => r.visitor_id);
}

/**
 * 특정 광고 소재를 본 visitor 목록 조회
 * FIX (2026-02-04): REPLACE 제거 - View/UV 계산과 동일하게 원본 값 사용
 * 카페24 호환: visitors 테이블과 조인하여 봇 트래픽 제외
 * 
 * @param {Object} params
 * @param {string|string[]} params.creative_name - 광고명 또는 광고명 배열 (변형 포함)
 * @param {string} params.utm_source - UTM Source ('-'면 null 포함)
 * @param {string} params.utm_medium - UTM Medium
 * @param {string} params.utm_campaign - UTM Campaign
 * @param {Date} params.startDate - 시작일
 * @param {Date} params.endDate - 종료일
 */
async function getCreativeVisitors({ creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate }) {
  // 단일 광고명이면 배열로 변환
  const creativeNames = Array.isArray(creative_name) ? creative_name : [creative_name];
  
  // utm_source가 '-'이면 null도 포함해서 조회
  const sourceCondition = utm_source === '-' 
    ? `(COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') = $${creativeNames.length + 1} OR us.utm_params->>'utm_source' IS NULL)`
    : `(COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') = $${creativeNames.length + 1} )`;
  
  const query = `
    SELECT DISTINCT us.visitor_id
    FROM utm_sessions us
    JOIN visitors v ON us.visitor_id = v.visitor_id
    WHERE us.utm_params->>'utm_content' = ANY($1)
      AND ${sourceCondition}
      AND COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') = $${creativeNames.length + 2}
      AND COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') = $${creativeNames.length + 3}
      AND us.entry_timestamp >= $${creativeNames.length + 4}
      AND us.entry_timestamp <= $${creativeNames.length + 5}
      AND v.is_bot = false
  `;
  
  const result = await db.query(query, [creativeNames, utm_source, utm_medium, utm_campaign, startDate, endDate]);
  return result.rows.map(r => r.visitor_id);
}

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
 * Visitor들의 주문 목록 조회
 * FIX (2026-02-03): IP/member_id 추가 (쿠키 끊김 대응)
 * FIX (2026-02-03): 취소/환불 필터 추가 (creativeAttribution.js와 동일)
 */
async function getVisitorOrders({ visitorIds, startDate, endDate }) {
  const query = `
    SELECT 
      c.order_id,
      c.visitor_id,
      c.member_id,
      c.final_payment,
      c.total_amount,
      c.product_name,
      c.product_count,
      c.discount_amount,
      c.timestamp as order_date,
      c.paid,
      COALESCE(s.ip_address, v.ip_address) as ip_address
    FROM conversions c
    LEFT JOIN sessions s ON c.session_id = s.session_id
    LEFT JOIN visitors v ON c.visitor_id = v.visitor_id
    WHERE c.visitor_id = ANY($1)
      AND c.order_id IS NOT NULL
      AND c.paid = 'T'
      AND c.final_payment > 0
      AND c.timestamp >= $2
      AND c.timestamp <= $3
      AND (c.canceled = 'F' OR c.canceled IS NULL)
      AND (c.order_status = 'confirmed' OR c.order_status IS NULL)
    ORDER BY c.timestamp DESC
  `;
  
  const result = await db.query(query, [visitorIds, startDate, endDate]);
  return result.rows;
}

/**
 * Visitor들의 UTM 여정 조회
 * FIX (2026-02-04): REPLACE 제거 - View/UV 계산과 동일하게 원본 값 사용
 * 카페24 호환: visitors 테이블과 조인하여 봇 트래픽 제외
 */
async function getVisitorJourneys({ visitorIds }) {
  const query = `
    SELECT 
      us.visitor_id,
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
    ORDER BY us.visitor_id, us.sequence_order
  `;
  
  const result = await db.query(query, [visitorIds]);
  return result.rows;
}

/**
 * IP 기반 UTM 여정 조회 (쿠키 끊김 대응)
 * 동일 IP의 다른 visitor_id들의 UTM 세션도 조회
 * FIX (2026-02-03): 상세 모달에서도 IP 기반 연결 적용
 */
async function getVisitorJourneysByIp({ purchaserIps, purchaserIds }) {
  if (!purchaserIps || purchaserIps.length === 0) {
    return [];
  }
  
  const query = `
    SELECT 
      v.ip_address,
      us.visitor_id,
      us.utm_params->>'utm_content' as utm_content,
      COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') as utm_source,
      COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') as utm_medium,
      COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') as utm_campaign,
      us.sequence_order,
      us.entry_timestamp
    FROM utm_sessions us
    JOIN visitors v ON us.visitor_id = v.visitor_id
    WHERE v.ip_address = ANY($1)
      AND us.visitor_id != ALL($2)
      AND us.utm_params->>'utm_content' IS NOT NULL
      AND v.is_bot = false
    ORDER BY v.ip_address, us.entry_timestamp
  `;
  
  const result = await db.query(query, [purchaserIps, purchaserIds]);
  return result.rows;
}

/**
 * member_id 기반 UTM 여정 조회 (쿠키 끊김 대응)
 * 동일 member_id의 다른 visitor_id들의 UTM 세션도 조회
 * FIX (2026-02-03): 상세 모달에서도 member_id 기반 연결 적용
 */
async function getVisitorJourneysByMemberId({ purchaserMemberIds, purchaserIds }) {
  if (!purchaserMemberIds || purchaserMemberIds.length === 0) {
    return [];
  }
  
  const query = `
    SELECT 
      c2.member_id,
      us.visitor_id,
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
    ORDER BY c2.member_id, us.entry_timestamp
  `;
  
  const result = await db.query(query, [purchaserMemberIds, purchaserIds]);
  return result.rows;
}

/**
 * 일별 UV 및 주문 추이 조회
 * 카페24 호환: visitors 테이블과 조인하여 봇 트래픽 제외
 * @param {string|string[]} creative_name - 광고명 또는 광고명 배열
 */
async function getDailyTrend({ creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate, visitorIds }) {
  const creativeNames = Array.isArray(creative_name) ? creative_name : [creative_name];
  
  const query = `
    WITH daily_uv AS (
      SELECT 
        DATE(us.entry_timestamp) as date,
        COUNT(DISTINCT us.visitor_id) as uv
      FROM utm_sessions us
      JOIN visitors v ON us.visitor_id = v.visitor_id
      WHERE us.utm_params->>'utm_content' = ANY($1)
        AND (COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') = $2 )
        AND COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') = $3
        AND COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') = $4
        AND us.entry_timestamp >= $5
        AND us.entry_timestamp <= $6
        AND v.is_bot = false
      GROUP BY DATE(us.entry_timestamp)
    ),
    daily_orders AS (
      SELECT 
        DATE(c.timestamp) as date,
        COUNT(DISTINCT c.order_id) as orders,
        SUM(c.final_payment) as revenue
      FROM conversions c
      WHERE c.visitor_id = ANY($7)
        AND c.order_id IS NOT NULL
        AND c.paid = 'T'
        AND c.final_payment > 0
        AND c.timestamp >= $5
        AND c.timestamp <= $6
      GROUP BY DATE(c.timestamp)
    )
    SELECT 
      COALESCE(u.date, o.date) as date,
      COALESCE(u.uv, 0) as uv,
      COALESCE(o.orders, 0) as orders,
      COALESCE(o.revenue, 0) as revenue
    FROM daily_uv u
    FULL OUTER JOIN daily_orders o ON u.date = o.date
    ORDER BY date ASC
  `;
  
  const result = await db.query(query, [creativeNames, utm_source, utm_medium, utm_campaign, startDate, endDate, visitorIds]);
  return result.rows;
}

/**
 * 디바이스별 성과 조회
 * 카페24 호환: visitors 테이블과 조인하여 봇 트래픽 제외
 * @param {string|string[]} creative_name - 광고명 또는 광고명 배열
 */
async function getDeviceStats({ creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate, visitorIds }) {
  const creativeNames = Array.isArray(creative_name) ? creative_name : [creative_name];
  
  const query = `
    WITH device_uv AS (
      SELECT 
        COALESCE(v.device_type, 'unknown') as device_type,
        COUNT(DISTINCT us.visitor_id) as uv
      FROM utm_sessions us
      JOIN visitors v ON us.visitor_id = v.visitor_id
      WHERE us.utm_params->>'utm_content' = ANY($1)
        AND (COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') = $2 )
        AND COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') = $3
        AND COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') = $4
        AND us.entry_timestamp >= $5
        AND us.entry_timestamp <= $6
        AND v.is_bot = false
      GROUP BY v.device_type
    ),
    device_orders AS (
      SELECT 
        COALESCE(v.device_type, 'unknown') as device_type,
        COUNT(DISTINCT c.order_id) as orders,
        SUM(c.final_payment) as revenue
      FROM conversions c
      JOIN visitors v ON c.visitor_id = v.visitor_id
      WHERE c.visitor_id = ANY($7)
        AND c.order_id IS NOT NULL
        AND c.paid = 'T'
        AND c.final_payment > 0
        AND c.timestamp >= $5
        AND c.timestamp <= $6
        AND v.is_bot = false
      GROUP BY v.device_type
    )
    SELECT 
      COALESCE(u.device_type, o.device_type) as device_type,
      COALESCE(u.uv, 0) as uv,
      COALESCE(o.orders, 0) as orders,
      COALESCE(o.revenue, 0) as revenue
    FROM device_uv u
    FULL OUTER JOIN device_orders o ON u.device_type = o.device_type
    ORDER BY uv DESC
  `;
  
  const result = await db.query(query, [creativeNames, utm_source, utm_medium, utm_campaign, startDate, endDate, visitorIds]);
  return result.rows;
}

/**
 * 상품별 매출 TOP 10 조회
 */
async function getProductSales({ visitorIds, startDate, endDate }) {
  const query = `
    SELECT 
      COALESCE(c.product_name, '상품명 없음') as product_name,
      COUNT(*) as order_count,
      SUM(c.final_payment) as revenue
    FROM conversions c
    WHERE c.visitor_id = ANY($1)
      AND c.order_id IS NOT NULL
      AND c.paid = 'T'
      AND c.final_payment > 0
      AND c.timestamp >= $2
      AND c.timestamp <= $3
    GROUP BY c.product_name
    ORDER BY revenue DESC
    LIMIT 10
  `;
  
  const result = await db.query(query, [visitorIds, startDate, endDate]);
  return result.rows;
}

/**
 * 신규 vs 재방문 비율 조회
 * 카페24 호환: 봇 트래픽 제외
 */
async function getVisitorType({ visitorIds }) {
  const query = `
    SELECT 
      COUNT(CASE WHEN v.visit_count = 1 THEN 1 END) as new_visitors,
      COUNT(CASE WHEN v.visit_count > 1 THEN 1 END) as returning_visitors
    FROM visitors v
    WHERE v.visitor_id = ANY($1)
      AND v.is_bot = false
  `;
  
  const result = await db.query(query, [visitorIds]);
  return result.rows[0] || { new_visitors: 0, returning_visitors: 0 };
}

/**
 * 구매 목록 조회 (journey용)
 */
async function getPurchases({ visitorIds, startDate, endDate }) {
  const query = `
    SELECT 
      c.visitor_id,
      c.order_id,
      c.final_payment,
      c.timestamp as order_date
    FROM conversions c
    WHERE c.visitor_id = ANY($1)
      AND c.order_id IS NOT NULL
      AND c.paid = 'T'
      AND c.final_payment > 0
      AND c.timestamp >= $2
      AND c.timestamp <= $3
    ORDER BY c.timestamp DESC
  `;
  
  const result = await db.query(query, [visitorIds, startDate, endDate]);
  return result.rows;
}

/**
 * 구매자 목록 조회
 */
async function getPurchasers({ visitorIds, startDate, endDate }) {
  const query = `
    SELECT DISTINCT visitor_id
    FROM conversions
    WHERE visitor_id = ANY($1)
      AND order_id IS NOT NULL
      AND paid = 'T'
      AND final_payment > 0
      AND timestamp >= $2
      AND timestamp <= $3
  `;
  
  const result = await db.query(query, [visitorIds, startDate, endDate]);
  return result.rows.map(r => r.visitor_id);
}

/**
 * 요약 통계 조회 (세션 기준)
 * 카페24 호환: v_sessions_cafe24 뷰 사용하여 봇 트래픽 제외
 */
async function getSummaryStats({ visitorIds, startDate, endDate }) {
  const query = `
    SELECT 
      COUNT(DISTINCT s.session_id) as total_sessions,
      COUNT(DISTINCT s.visitor_id) as total_visitors,
      ROUND(AVG(s.pageview_count)::NUMERIC, 1) as avg_pageviews,
      ROUND(AVG(s.duration_seconds)::NUMERIC, 0) as avg_duration_seconds,
      ROUND(
        (COUNT(CASE WHEN s.is_bounced = true THEN 1 END)::FLOAT / 
         NULLIF(COUNT(DISTINCT s.session_id), 0) * 100)::NUMERIC, 1
      ) as bounce_rate
    FROM v_sessions_cafe24 s
    WHERE s.visitor_id = ANY($1)
      AND s.start_time >= $2
      AND s.start_time <= $3
  `;
  
  const result = await db.query(query, [visitorIds, startDate, endDate]);
  return result.rows[0] || {};
}

/**
 * 많이 본 페이지 TOP 10 조회
 * 카페24 호환: v_pageviews_cafe24 뷰 사용하여 봇 트래픽 제외
 */
async function getTopPages({ visitorIds, startDate, endDate }) {
  const query = `
    SELECT 
      p.page_url,
      MAX(p.page_title) as page_title,
      COUNT(DISTINCT p.visitor_id) as visitor_count,
      COUNT(*) as view_count,
      ROUND(AVG(COALESCE(p.time_spent, 0))::NUMERIC, 0) as avg_time_spent
    FROM v_pageviews_cafe24 p
    WHERE p.visitor_id = ANY($1)
      AND p.timestamp >= $2
      AND p.timestamp <= $3
    GROUP BY p.page_url
    ORDER BY visitor_count DESC
    LIMIT 10
  `;
  
  const result = await db.query(query, [visitorIds, startDate, endDate]);
  return result.rows;
}

/**
 * 이탈 페이지 TOP 5 조회
 * 카페24 호환: v_sessions_cafe24 뷰 사용하여 봇 트래픽 제외
 */
async function getExitPages({ visitorIds, startDate, endDate }) {
  const query = `
    SELECT 
      s.exit_url as page_url,
      COUNT(*) as exit_count,
      COUNT(DISTINCT s.visitor_id) as visitor_count
    FROM v_sessions_cafe24 s
    WHERE s.visitor_id = ANY($1)
      AND s.start_time >= $2
      AND s.start_time <= $3
      AND s.exit_url IS NOT NULL
      AND s.exit_url != ''
    GROUP BY s.exit_url
    ORDER BY exit_count DESC
    LIMIT 5
  `;
  
  const result = await db.query(query, [visitorIds, startDate, endDate]);
  return result.rows;
}

/**
 * 특정 페이지의 방문자 수 조회
 * 카페24 호환: v_pageviews_cafe24 뷰 사용하여 봇 트래픽 제외
 */
async function getPageVisitors({ visitorIds, pageUrl, startDate, endDate }) {
  const query = `
    SELECT COUNT(DISTINCT visitor_id) as total_visitors
    FROM v_pageviews_cafe24
    WHERE visitor_id = ANY($1)
      AND page_url = $2
      AND timestamp >= $3
      AND timestamp <= $4
  `;
  
  const result = await db.query(query, [visitorIds, pageUrl, startDate, endDate]);
  return parseInt(result.rows[0]?.total_visitors) || 0;
}

/**
 * 구매자/비구매자 통계 조회
 * 카페24 호환: v_sessions_cafe24 뷰 사용하여 봇 트래픽 제외
 */
async function getPurchaserStats({ visitorIds, startDate, endDate }) {
  const query = `
    SELECT 
      ROUND(AVG(s.pageview_count)::NUMERIC, 1) as avg_pageviews,
      ROUND(AVG(s.duration_seconds)::NUMERIC, 0) as avg_duration
    FROM v_sessions_cafe24 s
    WHERE s.visitor_id = ANY($1)
      AND s.start_time >= $2
      AND s.start_time <= $3
  `;
  
  const result = await db.query(query, [visitorIds, startDate, endDate]);
  return result.rows[0] || { avg_pageviews: 0, avg_duration: 0 };
}

/**
 * 상품 상세 페이지 방문 평균 조회
 * 카페24 호환: v_pageviews_cafe24 뷰 사용하여 봇 트래픽 제외
 */
async function getProductViews({ visitorIds }) {
  if (visitorIds.length === 0) {
    return 0;
  }
  
  const query = `
    SELECT 
      ROUND((COUNT(*)::FLOAT / NULLIF($2, 0))::NUMERIC, 1) as avg_product_views
    FROM v_pageviews_cafe24 p
    WHERE p.visitor_id = ANY($1)
      AND (p.page_url LIKE '%product%' OR p.page_url LIKE '%detail%' OR p.page_url LIKE '%goods%')
  `;
  
  const result = await db.query(query, [visitorIds, visitorIds.length]);
  return parseFloat(result.rows[0]?.avg_product_views) || 0;
}

/**
 * 광고 소재 핵심 지표 조회 (compare용)
 * 카페24 호환: visitors 테이블과 조인하여 봇 트래픽 제외
 */
async function getCreativeMetrics({ creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate }) {
  const query = `
    SELECT 
      COUNT(DISTINCT us.visitor_id) as uv,
      ROUND(AVG(us.pageview_count)::NUMERIC, 1) as avg_pageviews,
      ROUND(AVG(us.duration_seconds)::NUMERIC, 0) as avg_duration
    FROM utm_sessions us
    JOIN visitors v ON us.visitor_id = v.visitor_id
    WHERE us.utm_params->>'utm_content' = $1
      AND COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') = $2
      AND COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') = $3
      AND COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') = $4
      AND us.entry_timestamp >= $5
      AND us.entry_timestamp <= $6
      AND v.is_bot = false
  `;
  
  const result = await db.query(query, [creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate]);
  return result.rows[0] || {};
}

/**
 * 이탈률 조회 (compare용)
 * 카페24 호환: v_sessions_cafe24 뷰 사용하여 봇 트래픽 제외
 */
async function getBounceRate({ visitorIds, startDate, endDate }) {
  const query = `
    SELECT 
      ROUND(
        (COUNT(CASE WHEN s.is_bounced = true THEN 1 END)::FLOAT / 
         NULLIF(COUNT(DISTINCT s.session_id), 0) * 100)::NUMERIC, 1
      ) as bounce_rate
    FROM v_sessions_cafe24 s
    WHERE s.visitor_id = ANY($1)
      AND s.start_time >= $2
      AND s.start_time <= $3
  `;
  
  const result = await db.query(query, [visitorIds, startDate, endDate]);
  return parseFloat(result.rows[0]?.bounce_rate) || 0;
}

/**
 * 전환 관련 지표 조회 (compare용)
 */
async function getConversionStats({ visitorIds, startDate, endDate }) {
  const query = `
    SELECT 
      COUNT(DISTINCT c.order_id) as conversion_count,
      SUM(c.final_payment) as total_revenue
    FROM conversions c
    WHERE c.visitor_id = ANY($1)
      AND c.order_id IS NOT NULL
      AND c.paid = 'T'
      AND c.final_payment > 0
      AND c.timestamp >= $2
      AND c.timestamp <= $3
  `;
  
  const result = await db.query(query, [visitorIds, startDate, endDate]);
  return {
    conversion_count: parseInt(result.rows[0]?.conversion_count) || 0,
    total_revenue: parseFloat(result.rows[0]?.total_revenue) || 0
  };
}

/**
 * 막타 매출 계산 (compare용)
 * 카페24 호환: visitors 테이블과 조인하여 봇 트래픽 제외
 */
async function getLastTouchRevenue({ visitorIds, startDate, endDate, creative_name, utm_source, utm_medium, utm_campaign }) {
  const query = `
    WITH visitor_journeys AS (
      SELECT 
        us.visitor_id,
        us.utm_params->>'utm_content' as utm_content,
        COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') as utm_source,
        COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') as utm_medium,
        COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') as utm_campaign,
        us.sequence_order
      FROM utm_sessions us
      JOIN visitors v ON us.visitor_id = v.visitor_id
      WHERE us.visitor_id = ANY($1)
        AND us.utm_params->>'utm_content' IS NOT NULL
        AND v.is_bot = false
    ),
    last_touches AS (
      SELECT DISTINCT ON (visitor_id) 
        visitor_id, utm_content, utm_source, utm_medium, utm_campaign
      FROM visitor_journeys
      ORDER BY visitor_id, sequence_order DESC
    )
    SELECT 
      SUM(c.final_payment) as last_touch_revenue
    FROM conversions c
    JOIN last_touches lt ON c.visitor_id = lt.visitor_id
    WHERE c.order_id IS NOT NULL
      AND c.paid = 'T'
      AND c.final_payment > 0
      AND c.timestamp >= $2
      AND c.timestamp <= $3
      AND lt.utm_content = $4
      AND lt.utm_source = $5
      AND lt.utm_medium = $6
      AND lt.utm_campaign = $7
  `;
  
  const result = await db.query(query, [visitorIds, startDate, endDate, creative_name, utm_source, utm_medium, utm_campaign]);
  return Math.round(parseFloat(result.rows[0]?.last_touch_revenue) || 0);
}

/**
 * 일별 추이 조회 (compare용 - visitorIds 포함)
 * 카페24 호환: visitors 테이블과 조인하여 봇 트래픽 제외
 */
async function getDailyTrends({ creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate, visitorIds }) {
  const query = `
    WITH daily_uv AS (
      SELECT 
        DATE(us.entry_timestamp) as date,
        COUNT(DISTINCT us.visitor_id) as uv
      FROM utm_sessions us
      JOIN visitors v ON us.visitor_id = v.visitor_id
      WHERE us.utm_params->>'utm_content' = $1
        AND COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') = $2
        AND COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') = $3
        AND COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') = $4
        AND us.entry_timestamp >= $5
        AND us.entry_timestamp <= $6
        AND v.is_bot = false
      GROUP BY DATE(us.entry_timestamp)
    ),
    daily_conv AS (
      SELECT 
        DATE(c.timestamp) as date,
        COUNT(DISTINCT c.order_id) as conversion_count,
        SUM(c.final_payment) as revenue
      FROM conversions c
      WHERE c.visitor_id = ANY($7)
        AND c.order_id IS NOT NULL
        AND c.paid = 'T'
        AND c.final_payment > 0
        AND c.timestamp >= $5
        AND c.timestamp <= $6
      GROUP BY DATE(c.timestamp)
    )
    SELECT 
      COALESCE(u.date, c.date) as date,
      COALESCE(u.uv, 0) as uv,
      COALESCE(c.conversion_count, 0) as conversion_count,
      COALESCE(c.revenue, 0) as revenue
    FROM daily_uv u
    FULL OUTER JOIN daily_conv c ON u.date = c.date
    ORDER BY date ASC
  `;
  
  const result = await db.query(query, [creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate, visitorIds]);
  return result.rows;
}

/**
 * Raw Data 검증용: 세션 목록 조회
 * 특정 광고 소재로 유입된 모든 방문자 조회 (방문자 단위로 집계)
 * 카페24 호환: visitors 테이블과 조인하여 봇 트래픽 제외
 * @param {string|string[]} creative_name - 광고명 또는 광고명 배열
 */
async function getRawSessions({ creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate, page = 1, limit = 50, filter = 'all' }) {
  const creativeNames = Array.isArray(creative_name) ? creative_name : [creative_name];
  
  // 구매 여부 필터 조건
  let havingClause = '';
  if (filter === 'purchased') {
    havingClause = 'HAVING MAX(CASE WHEN c.order_id IS NOT NULL THEN 1 ELSE 0 END) = 1';
  } else if (filter === 'not_purchased') {
    havingClause = 'HAVING MAX(CASE WHEN c.order_id IS NOT NULL THEN 1 ELSE 0 END) = 0';
  }
  
  const offset = (page - 1) * limit;
  
  const query = `
    SELECT 
      us.visitor_id,
      MIN(us.entry_timestamp) as first_visit,
      MAX(us.entry_timestamp) as last_visit,
      COUNT(us.id) as visit_count,
      SUM(us.duration_seconds) as total_duration_seconds,
      SUM(us.pageview_count) as total_pageviews,
      MAX(v.device_type) as device_type,
      MAX(v.browser) as browser,
      MAX(c.order_id) as order_id,
      MAX(c.final_payment) as final_payment,
      MAX(c.timestamp) as order_date
    FROM utm_sessions us
    JOIN visitors v ON us.visitor_id = v.visitor_id
    LEFT JOIN conversions c ON us.visitor_id = c.visitor_id 
      AND c.timestamp >= us.entry_timestamp
      AND c.timestamp <= us.entry_timestamp + INTERVAL '30 days'
      AND c.order_status = 'confirmed'
    WHERE us.utm_params->>'utm_content' = ANY($1)
      AND (COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') = $2 )
      AND COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') = $3
      AND COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') = $4
      AND us.entry_timestamp >= $5
      AND us.entry_timestamp <= $6
      AND v.is_bot = false
    GROUP BY us.visitor_id
    ${havingClause}
    ORDER BY MAX(us.entry_timestamp) DESC
    LIMIT $7 OFFSET $8
  `;
  
  const result = await db.query(query, [creativeNames, utm_source, utm_medium, utm_campaign, startDate, endDate, limit, offset]);
  return result.rows;
}

/**
 * Raw Data 검증용: 방문자 총 개수 조회 (페이지네이션용)
 * 카페24 호환: visitors 테이블과 조인하여 봇 트래픽 제외
 * @param {string|string[]} creative_name - 광고명 또는 광고명 배열
 */
async function getRawSessionsCount({ creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate, filter = 'all' }) {
  const creativeNames = Array.isArray(creative_name) ? creative_name : [creative_name];
  
  // 구매 여부 필터 조건
  let havingClause = '';
  if (filter === 'purchased') {
    havingClause = 'HAVING MAX(CASE WHEN c.order_id IS NOT NULL THEN 1 ELSE 0 END) = 1';
  } else if (filter === 'not_purchased') {
    havingClause = 'HAVING MAX(CASE WHEN c.order_id IS NOT NULL THEN 1 ELSE 0 END) = 0';
  }
  
  const query = `
    SELECT COUNT(*) as total FROM (
      SELECT us.visitor_id
      FROM utm_sessions us
      JOIN visitors v ON us.visitor_id = v.visitor_id
      LEFT JOIN conversions c ON us.visitor_id = c.visitor_id 
        AND c.timestamp >= us.entry_timestamp
        AND c.timestamp <= us.entry_timestamp + INTERVAL '30 days'
        AND c.order_status = 'confirmed'
      WHERE us.utm_params->>'utm_content' = ANY($1)
        AND (COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') = $2 )
        AND COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') = $3
        AND COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') = $4
        AND us.entry_timestamp >= $5
        AND us.entry_timestamp <= $6
        AND v.is_bot = false
      GROUP BY us.visitor_id
      ${havingClause}
    ) sub
  `;
  
  const result = await db.query(query, [creativeNames, utm_source, utm_medium, utm_campaign, startDate, endDate]);
  return parseInt(result.rows[0]?.total) || 0;
}

/**
 * Raw Data 검증용: 트래픽 지표 요약 조회
 * 카페24 호환: visitors 테이블과 조인하여 봇 트래픽 제외
 * @param {string|string[]} creative_name - 광고명 또는 광고명 배열
 */
async function getRawTrafficSummary({ creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate }) {
  const creativeNames = Array.isArray(creative_name) ? creative_name : [creative_name];
  
  const query = `
    SELECT 
      COUNT(*) as total_views,
      COUNT(DISTINCT us.visitor_id) as unique_visitors,
      ROUND(COALESCE(SUM(us.pageview_count)::FLOAT / NULLIF(COUNT(DISTINCT us.visitor_id), 0), 0)::NUMERIC, 1) as avg_pageviews,
      ROUND(COALESCE(
        SUM(CASE WHEN us.duration_seconds < 300 THEN us.duration_seconds ELSE 0 END)::FLOAT 
        / NULLIF(COUNT(DISTINCT CASE WHEN us.duration_seconds < 300 THEN us.visitor_id END), 0), 
        0
      )::NUMERIC, 1) as avg_duration_seconds
    FROM utm_sessions us
    JOIN visitors v ON us.visitor_id = v.visitor_id
    WHERE us.utm_params->>'utm_content' = ANY($1)
      AND (COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') = $2 )
      AND COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') = $3
      AND COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') = $4
      AND us.entry_timestamp >= $5
      AND us.entry_timestamp <= $6
      AND v.is_bot = false
  `;
  
  const result = await db.query(query, [creativeNames, utm_source, utm_medium, utm_campaign, startDate, endDate]);
  return result.rows[0];
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
 * 카페24 호환: visitors 테이블과 조인하여 봇 트래픽 제외
 */
async function getVisitorSessionInfoForCreative({ visitorIds, creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate, maxDurationSeconds = 600 }) {
  if (visitorIds.length === 0) return {};
  
  // 1단계: 해당 광고로 유입된 UTM 세션의 session_id 목록 조회 (조회 기간 내, 세션 중복 제거, 봇 제외)
  // FIX (2026-01-23): 같은 세션에서 광고를 여러 번 클릭한 경우 중복 제거
  const sessionQuery = `
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
  
  const sessionResult = await db.query(sessionQuery, [visitorIds, creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate]);
  
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
 * visitor별 특정 광고 접촉 횟수 조회 (고유 세션 수)
 * FIX (2026-01-23): 조회 기간 필터 추가 + 세션 중복 제거
 * FIX (2026-01-27): Attribution Window (구매일 기준 30일) 적용으로 변경
 *   - 기존: 조회 기간 내 세션만 집계 → 여정 컬럼과 불일치 발생
 *   - 수정: 각 구매자의 구매일 기준 30일 이내 세션 집계 → 여정과 일관성 유지
 * 카페24 호환: visitors 테이블과 조인하여 봇 트래픽 제외
 * 
 * @param {Object} params
 * @param {Array} params.purchaserOrders - [{visitor_id, order_date}] 구매자별 구매일 정보
 * @param {string} params.creative_name - 광고 소재 이름
 * @param {string} params.utm_source - UTM Source
 * @param {string} params.utm_medium - UTM Medium
 * @param {string} params.utm_campaign - UTM Campaign
 * @param {number} params.attributionWindowDays - Attribution Window 일수 (기본 30일)
 */
async function getCreativeTouchCounts({ purchaserOrders, creative_name, utm_source, utm_medium, utm_campaign, attributionWindowDays = 30 }) {
  if (!purchaserOrders || purchaserOrders.length === 0) return {};
  
  // FIX (2026-01-27): toISOString()은 UTC로 변환되어 타임존 문제 발생
  // DB의 entry_timestamp는 KST로 저장되어 있으므로, 로컬 시간 형식으로 변환해야 함
  // 구매자별 구매일 기준 N일 이내 세션만 집계
  // VALUES로 (visitor_id, order_date) 쌍을 전달하여 각 구매자별로 Attribution Window 적용
  const orderPairs = purchaserOrders.map(o => {
    // order_date를 로컬 시간 문자열로 변환 (DB의 timestamp와 동일한 형식)
    const d = new Date(o.order_date);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${String(d.getMilliseconds()).padStart(3, '0')}`;
    return `('${o.visitor_id}'::text, '${dateStr}'::timestamp)`;
  }).join(',');
  
  // FIX (2026-02-04): attributionWindowDays가 null이면 전체 기간 (Attribution Window 제한 없음)
  const attributionFilter = attributionWindowDays !== null
    ? `AND us.entry_timestamp >= pd.order_date - INTERVAL '${attributionWindowDays} days'`
    : '';
  
  const query = `
    WITH purchaser_dates AS (
      SELECT * FROM (VALUES ${orderPairs}) AS t(visitor_id, order_date)
    )
    SELECT 
      us.visitor_id,
      COUNT(DISTINCT us.session_id) as touch_count
    FROM utm_sessions us
    JOIN visitors v ON us.visitor_id = v.visitor_id
    JOIN purchaser_dates pd ON us.visitor_id = pd.visitor_id
    WHERE us.utm_params->>'utm_content' = $1
      AND COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') = $2
      AND COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') = $3
      AND COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') = $4
      ${attributionFilter}
      AND us.entry_timestamp <= pd.order_date
      AND v.is_bot = false
    GROUP BY us.visitor_id
  `;
  
  const result = await db.query(query, [creative_name, utm_source, utm_medium, utm_campaign]);
  
  const touchCountMap = {};
  result.rows.forEach(row => {
    touchCountMap[row.visitor_id] = parseInt(row.touch_count) || 0;
  });
  
  return touchCountMap;
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
 * 체류시간 분포 계산 (주문 발생 건 기준)
 * 주문이 발생한 visitor의 체류시간을 pageviews 테이블 기반으로 계산
 * 
 * @param {Object} params
 * @param {Date} params.startDate - 시작일
 * @param {Date} params.endDate - 종료일
 * @param {string} params.utmFilterConditions - UTM 필터 조건 SQL (optional)
 * @param {Array} params.queryParams - SQL 쿼리 파라미터 배열
 * @returns {Object} - 체류시간 분포 및 통계
 */
async function getDurationDistribution({ startDate, endDate, utmFilterConditions = '', queryParams }) {
  // 1단계: 해당 기간 내 주문이 발생한 visitor 조회
  const purchaserQuery = `
    SELECT DISTINCT c.visitor_id, c.order_id
    FROM conversions c
    WHERE c.order_id IS NOT NULL
      AND c.paid = 'T'
      AND c.final_payment > 0
      AND c.timestamp >= $1
      AND c.timestamp <= $2
  `;
  
  const purchaserResult = await db.query(purchaserQuery, [queryParams[0], queryParams[1]]);
  
  if (purchaserResult.rows.length === 0) {
    return {
      distribution: {
        range_0_30: 0,
        range_30_60: 0,
        range_60_180: 0,
        range_180_300: 0,
        range_300_600: 0,
        range_600_900: 0,
        range_900_1200: 0,
        range_1200_1800: 0,
        range_1800_2400: 0,
        range_2400_3000: 0,
        range_3000_3600: 0,
        range_3600_7200: 0
      },
      stats: {
        total_orders: 0,
        avg_duration: 0,
        median_duration: 0
      }
    };
  }
  
  const purchaserIds = [...new Set(purchaserResult.rows.map(r => r.visitor_id))];
  
  // 2단계: 해당 purchaser들이 UTM 광고를 통해 유입된 세션 조회
  let sessionQuery = `
    SELECT DISTINCT us.session_id, us.visitor_id
    FROM utm_sessions us
    WHERE us.visitor_id = ANY($1)
      AND us.utm_params->>'utm_content' IS NOT NULL
      AND us.entry_timestamp >= $2
      AND us.entry_timestamp <= $3
  `;
  
  // UTM 필터 조건 적용 (파라미터 인덱스 조정)
  let adjustedUtmConditions = utmFilterConditions;
  if (utmFilterConditions) {
    // $3 이후의 파라미터 인덱스를 $4부터 시작하도록 조정
    adjustedUtmConditions = utmFilterConditions.replace(/\$(\d+)/g, (match, num) => {
      const newNum = parseInt(num) + 1; // $3 -> $4, $4 -> $5, ...
      return `$${newNum}`;
    });
    sessionQuery += adjustedUtmConditions;
  }
  
  const sessionParams = [purchaserIds, queryParams[0], queryParams[1], ...queryParams.slice(2)];
  const sessionResult = await db.query(sessionQuery, sessionParams);
  
  if (sessionResult.rows.length === 0) {
    return {
      distribution: {
        range_0_30: 0,
        range_30_60: 0,
        range_60_180: 0,
        range_180_300: 0,
        range_300_600: 0,
        range_600_900: 0,
        range_900_1200: 0,
        range_1200_1800: 0,
        range_1800_2400: 0,
        range_2400_3000: 0,
        range_3000_3600: 0,
        range_3600_7200: 0
      },
      stats: {
        total_orders: 0,
        avg_duration: 0,
        median_duration: 0
      }
    };
  }
  
  const allSessionIds = sessionResult.rows.map(r => r.session_id);
  
  // 3단계: pageviews 기반 visitor별 체류시간 계산 (10분 제한 없이 계산)
  const durationQuery = `
    WITH page_times AS (
      SELECT 
        p.session_id,
        p.visitor_id,
        p.timestamp,
        LEAD(p.timestamp) OVER (PARTITION BY p.session_id ORDER BY p.timestamp) as next_timestamp
      FROM pageviews p
      WHERE p.session_id = ANY($1)
    ),
    visitor_durations AS (
      SELECT
        visitor_id,
        SUM(
          CASE
            WHEN next_timestamp IS NOT NULL THEN
              LEAST(EXTRACT(EPOCH FROM (next_timestamp - timestamp))::INTEGER, 1800)
            ELSE 0
          END
        ) as total_duration
      FROM page_times
      GROUP BY visitor_id
    )
    SELECT 
      visitor_id,
      total_duration
    FROM visitor_durations
    WHERE visitor_id = ANY($2)
  `;
  
  const durationResult = await db.query(durationQuery, [allSessionIds, purchaserIds]);
  
  // 분포 계산 (초/분 단위 구간)
  const distribution = {
    range_0_30: 0,       // 0~30초
    range_30_60: 0,      // 30초~1분
    range_60_180: 0,     // 1~3분
    range_180_300: 0,    // 3~5분
    range_300_600: 0,    // 5~10분
    range_600_900: 0,    // 10~15분
    range_900_1200: 0,   // 15~20분
    range_1200_1800: 0,  // 20~30분
    range_1800_2400: 0,  // 30~40분
    range_2400_3000: 0,  // 40~50분
    range_3000_3600: 0,  // 50~60분
    range_3600_7200: 0   // 60~120분
  };
  
  const durations = [];
  
  durationResult.rows.forEach(row => {
    const duration = parseInt(row.total_duration) || 0;
    durations.push(duration);
    
    if (duration < 30) {
      distribution.range_0_30++;
    } else if (duration < 60) {
      distribution.range_30_60++;
    } else if (duration < 180) {
      distribution.range_60_180++;
    } else if (duration < 300) {
      distribution.range_180_300++;
    } else if (duration < 600) {
      distribution.range_300_600++;
    } else if (duration < 900) {
      distribution.range_600_900++;
    } else if (duration < 1200) {
      distribution.range_900_1200++;
    } else if (duration < 1800) {
      distribution.range_1200_1800++;
    } else if (duration < 2400) {
      distribution.range_1800_2400++;
    } else if (duration < 3000) {
      distribution.range_2400_3000++;
    } else if (duration < 3600) {
      distribution.range_3000_3600++;
    } else {
      distribution.range_3600_7200++;
    }
  });
  
  // 통계 계산
  const totalOrders = durations.length;
  const avgDuration = totalOrders > 0 
    ? Math.round(durations.reduce((sum, d) => sum + d, 0) / totalOrders)
    : 0;
  
  // 중앙값 계산
  let medianDuration = 0;
  if (durations.length > 0) {
    const sorted = [...durations].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    medianDuration = sorted.length % 2 !== 0
      ? sorted[mid]
      : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }
  
  return {
    distribution,
    stats: {
      total_orders: totalOrders,
      avg_duration: avgDuration,
      median_duration: medianDuration
    }
  };
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
async function getCreativeSessions({ ad_id, creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate, page = 1, limit = 50 }) {
  const offset = (page - 1) * limit;
  
  // ad_id가 있으면 ad_id 기반 조회, 없으면 creative_name 기반 (fallback)
  const useAdId = ad_id && ad_id !== '' && !ad_id.startsWith('{{');
  
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
        s.is_converted,
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
      ORDER BY s.visitor_id, s.start_time DESC
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
        s.is_converted,
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
      ORDER BY s.visitor_id, s.start_time DESC
      LIMIT $7 OFFSET $8
    `;
    queryParams = [creativeNames, utm_source, utm_medium, utm_campaign, startDate, endDate, limit, offset];
  }
  
  const result = await db.query(query, queryParams);
  return result.rows;
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
        AND v.is_bot = false
    `;
    queryParams = [ad_id, utm_medium, utm_campaign, startDate, endDate];
  } else {
    // creative_name 기반 조회 (fallback)
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
        WHERE us.utm_params->>'utm_id' = $1
          AND COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') = $2
          AND COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') = $3
          AND us.entry_timestamp >= $4
          AND us.entry_timestamp <= $5
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
        WHERE us.utm_params->>'utm_content' = ANY($1)
          AND (COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') = $2 )
          AND COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') = $3
          AND COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') = $4
          AND us.entry_timestamp >= $5
          AND us.entry_timestamp <= $6
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
    query = `
      SELECT COUNT(*) as total
      FROM utm_sessions us
      JOIN visitors v ON us.visitor_id = v.visitor_id
      WHERE us.utm_params->>'utm_id' = $1
        AND COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') = $2
        AND COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') = $3
        AND us.entry_timestamp >= $4
        AND us.entry_timestamp <= $5
        AND v.is_bot = false
    `;
    queryParams = [ad_id, utm_medium, utm_campaign, startDate, endDate];
  } else {
    // creative_name 기반 조회 (fallback)
    const creativeNames = Array.isArray(creative_name) ? creative_name : [creative_name];
    query = `
      SELECT COUNT(*) as total
      FROM utm_sessions us
      JOIN visitors v ON us.visitor_id = v.visitor_id
      WHERE us.utm_params->>'utm_content' = ANY($1)
        AND (COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') = $2 )
        AND COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') = $3
        AND COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') = $4
        AND us.entry_timestamp >= $5
        AND us.entry_timestamp <= $6
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
  
  const query = `
    WITH entry_urls AS (
      SELECT 
        s.entry_url,
        -- URL에 쿼리 파라미터가 있는지 확인 (? 포함 여부)
        CASE WHEN s.entry_url LIKE '%?%' THEN 1 ELSE 0 END as has_params,
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
        AND s.entry_url IS NOT NULL
      GROUP BY s.entry_url
    )
    SELECT 
      entry_url as full_url,
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

module.exports = {
  getAllVisitorsInPeriod,
  getAllOrdersInPeriod,
  getCreativeVisitors,
  getVisitorOrders,
  getVisitorJourneys,
  getVisitorJourneysByIp,
  getVisitorJourneysByMemberId,
  getDailyTrend,
  getDeviceStats,
  getProductSales,
  getVisitorType,
  getPurchases,
  getPurchasers,
  getSummaryStats,
  getTopPages,
  getExitPages,
  getPageVisitors,
  getPurchaserStats,
  getProductViews,
  getCreativeMetrics,
  getBounceRate,
  getConversionStats,
  getLastTouchRevenue,
  getDailyTrends,
  getRawSessions,
  getRawSessionsCount,
  getRawTrafficSummary,
  getVisitorSessionInfoForCreative,
  getCreativeTouchCounts,
  getVisitorTotalVisits,
  getCreativeSessions,
  getCreativeSessionsCount,
  getCreativeEntries,
  getCreativeEntriesCount,
  getCreativeOriginalUrl
};
