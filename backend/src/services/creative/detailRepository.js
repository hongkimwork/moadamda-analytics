/**
 * 광고 소재 상세 분석 Repository
 * POST 엔드포인트들의 DB 쿼리만 담당
 */

const db = require('../../utils/database');

/**
 * 선택 기간 내 모든 광고를 본 visitor 목록 조회
 * (테이블 creativeAttribution.js와 동일한 방식)
 */
async function getAllVisitorsInPeriod({ startDate, endDate }) {
  const query = `
    SELECT DISTINCT visitor_id
    FROM utm_sessions
    WHERE utm_params->>'utm_content' IS NOT NULL
      AND entry_timestamp >= $1
      AND entry_timestamp <= $2
  `;
  
  const result = await db.query(query, [startDate, endDate]);
  return result.rows.map(r => r.visitor_id);
}

/**
 * 특정 광고 소재를 본 visitor 목록 조회
 * (테이블과 동일하게 REPLACE 적용하여 + → 공백 변환)
 */
async function getCreativeVisitors({ creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate }) {
  const query = `
    SELECT DISTINCT visitor_id
    FROM utm_sessions
    WHERE REPLACE(utm_params->>'utm_content', '+', ' ') = $1
      AND COALESCE(NULLIF(utm_params->>'utm_source', ''), '-') = $2
      AND COALESCE(NULLIF(utm_params->>'utm_medium', ''), '-') = $3
      AND COALESCE(NULLIF(utm_params->>'utm_campaign', ''), '-') = $4
      AND entry_timestamp >= $5
      AND entry_timestamp <= $6
  `;
  
  const result = await db.query(query, [creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate]);
  return result.rows.map(r => r.visitor_id);
}

/**
 * Visitor들의 주문 목록 조회
 */
async function getVisitorOrders({ visitorIds, startDate, endDate }) {
  const query = `
    SELECT 
      c.order_id,
      c.visitor_id,
      c.final_payment,
      c.total_amount,
      c.product_name,
      c.product_count,
      c.discount_amount,
      c.timestamp as order_date,
      c.paid
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
 * Visitor들의 UTM 여정 조회
 * (테이블과 동일하게 REPLACE 적용하여 + → 공백 변환)
 */
async function getVisitorJourneys({ visitorIds }) {
  const query = `
    SELECT 
      visitor_id,
      REPLACE(utm_params->>'utm_content', '+', ' ') as utm_content,
      COALESCE(NULLIF(utm_params->>'utm_source', ''), '-') as utm_source,
      COALESCE(NULLIF(utm_params->>'utm_medium', ''), '-') as utm_medium,
      COALESCE(NULLIF(utm_params->>'utm_campaign', ''), '-') as utm_campaign,
      sequence_order,
      entry_timestamp
    FROM utm_sessions
    WHERE visitor_id = ANY($1)
      AND utm_params->>'utm_content' IS NOT NULL
    ORDER BY visitor_id, sequence_order
  `;
  
  const result = await db.query(query, [visitorIds]);
  return result.rows;
}

/**
 * 일별 UV 및 주문 추이 조회
 */
async function getDailyTrend({ creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate, visitorIds }) {
  const query = `
    WITH daily_uv AS (
      SELECT 
        DATE(us.entry_timestamp) as date,
        COUNT(DISTINCT us.visitor_id) as uv
      FROM utm_sessions us
      WHERE REPLACE(us.utm_params->>'utm_content', '+', ' ') = $1
        AND COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') = $2
        AND COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') = $3
        AND COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') = $4
        AND us.entry_timestamp >= $5
        AND us.entry_timestamp <= $6
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
  
  const result = await db.query(query, [creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate, visitorIds]);
  return result.rows;
}

/**
 * 디바이스별 성과 조회
 */
async function getDeviceStats({ creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate, visitorIds }) {
  const query = `
    WITH device_uv AS (
      SELECT 
        COALESCE(v.device_type, 'unknown') as device_type,
        COUNT(DISTINCT us.visitor_id) as uv
      FROM utm_sessions us
      JOIN visitors v ON us.visitor_id = v.visitor_id
      WHERE REPLACE(us.utm_params->>'utm_content', '+', ' ') = $1
        AND COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') = $2
        AND COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') = $3
        AND COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') = $4
        AND us.entry_timestamp >= $5
        AND us.entry_timestamp <= $6
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
  
  const result = await db.query(query, [creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate, visitorIds]);
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
 */
async function getVisitorType({ visitorIds }) {
  const query = `
    SELECT 
      COUNT(CASE WHEN v.visit_count = 1 THEN 1 END) as new_visitors,
      COUNT(CASE WHEN v.visit_count > 1 THEN 1 END) as returning_visitors
    FROM visitors v
    WHERE v.visitor_id = ANY($1)
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
    FROM sessions s
    WHERE s.visitor_id = ANY($1)
      AND s.start_time >= $2
      AND s.start_time <= $3
  `;
  
  const result = await db.query(query, [visitorIds, startDate, endDate]);
  return result.rows[0] || {};
}

/**
 * 많이 본 페이지 TOP 10 조회
 */
async function getTopPages({ visitorIds, startDate, endDate }) {
  const query = `
    SELECT 
      p.page_url,
      MAX(p.page_title) as page_title,
      COUNT(DISTINCT p.visitor_id) as visitor_count,
      COUNT(*) as view_count,
      ROUND(AVG(COALESCE(p.time_spent, 0))::NUMERIC, 0) as avg_time_spent
    FROM pageviews p
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
 */
async function getExitPages({ visitorIds, startDate, endDate }) {
  const query = `
    SELECT 
      s.exit_url as page_url,
      COUNT(*) as exit_count,
      COUNT(DISTINCT s.visitor_id) as visitor_count
    FROM sessions s
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
 */
async function getPageVisitors({ visitorIds, pageUrl, startDate, endDate }) {
  const query = `
    SELECT COUNT(DISTINCT visitor_id) as total_visitors
    FROM pageviews
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
 */
async function getPurchaserStats({ visitorIds, startDate, endDate }) {
  const query = `
    SELECT 
      ROUND(AVG(s.pageview_count)::NUMERIC, 1) as avg_pageviews,
      ROUND(AVG(s.duration_seconds)::NUMERIC, 0) as avg_duration
    FROM sessions s
    WHERE s.visitor_id = ANY($1)
      AND s.start_time >= $2
      AND s.start_time <= $3
  `;
  
  const result = await db.query(query, [visitorIds, startDate, endDate]);
  return result.rows[0] || { avg_pageviews: 0, avg_duration: 0 };
}

/**
 * 상품 상세 페이지 방문 평균 조회
 */
async function getProductViews({ visitorIds }) {
  if (visitorIds.length === 0) {
    return 0;
  }
  
  const query = `
    SELECT 
      ROUND((COUNT(*)::FLOAT / NULLIF($2, 0))::NUMERIC, 1) as avg_product_views
    FROM pageviews p
    WHERE p.visitor_id = ANY($1)
      AND (p.page_url LIKE '%product%' OR p.page_url LIKE '%detail%' OR p.page_url LIKE '%goods%')
  `;
  
  const result = await db.query(query, [visitorIds, visitorIds.length]);
  return parseFloat(result.rows[0]?.avg_product_views) || 0;
}

/**
 * 광고 소재 핵심 지표 조회 (compare용)
 */
async function getCreativeMetrics({ creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate }) {
  const query = `
    SELECT 
      COUNT(DISTINCT us.visitor_id) as uv,
      ROUND(AVG(us.pageview_count)::NUMERIC, 1) as avg_pageviews,
      ROUND(AVG(us.duration_seconds)::NUMERIC, 0) as avg_duration
    FROM utm_sessions us
    WHERE REPLACE(us.utm_params->>'utm_content', '+', ' ') = $1
      AND COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') = $2
      AND COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') = $3
      AND COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') = $4
      AND us.entry_timestamp >= $5
      AND us.entry_timestamp <= $6
  `;
  
  const result = await db.query(query, [creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate]);
  return result.rows[0] || {};
}

/**
 * 이탈률 조회 (compare용)
 */
async function getBounceRate({ visitorIds, startDate, endDate }) {
  const query = `
    SELECT 
      ROUND(
        (COUNT(CASE WHEN s.is_bounced = true THEN 1 END)::FLOAT / 
         NULLIF(COUNT(DISTINCT s.session_id), 0) * 100)::NUMERIC, 1
      ) as bounce_rate
    FROM sessions s
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
 */
async function getLastTouchRevenue({ visitorIds, startDate, endDate, creative_name, utm_source, utm_medium, utm_campaign }) {
  const query = `
    WITH visitor_journeys AS (
      SELECT 
        us.visitor_id,
        REPLACE(us.utm_params->>'utm_content', '+', ' ') as utm_content,
        COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') as utm_source,
        COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') as utm_medium,
        COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') as utm_campaign,
        us.sequence_order
      FROM utm_sessions us
      WHERE us.visitor_id = ANY($1)
        AND us.utm_params->>'utm_content' IS NOT NULL
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
 */
async function getDailyTrends({ creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate, visitorIds }) {
  const query = `
    WITH daily_uv AS (
      SELECT 
        DATE(us.entry_timestamp) as date,
        COUNT(DISTINCT us.visitor_id) as uv
      FROM utm_sessions us
      WHERE REPLACE(us.utm_params->>'utm_content', '+', ' ') = $1
        AND COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') = $2
        AND COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') = $3
        AND COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') = $4
        AND us.entry_timestamp >= $5
        AND us.entry_timestamp <= $6
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
 * 특정 광고 소재로 유입된 모든 세션 조회
 */
async function getRawSessions({ creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate }) {
  const query = `
    SELECT 
      us.id,
      us.visitor_id,
      us.entry_timestamp,
      us.exit_timestamp,
      us.duration_seconds,
      us.pageview_count,
      us.sequence_order,
      v.device_type,
      v.browser
    FROM utm_sessions us
    LEFT JOIN visitors v ON us.visitor_id = v.visitor_id
    WHERE REPLACE(us.utm_params->>'utm_content', '+', ' ') = $1
      AND COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') = $2
      AND COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') = $3
      AND COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') = $4
      AND us.entry_timestamp >= $5
      AND us.entry_timestamp <= $6
    ORDER BY us.entry_timestamp DESC
    LIMIT 500
  `;
  
  const result = await db.query(query, [creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate]);
  return result.rows;
}

/**
 * Raw Data 검증용: 트래픽 지표 요약 조회
 */
async function getRawTrafficSummary({ creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate }) {
  const query = `
    SELECT 
      COUNT(*) as total_views,
      COUNT(DISTINCT visitor_id) as unique_visitors,
      ROUND(COALESCE(SUM(pageview_count)::FLOAT / NULLIF(COUNT(DISTINCT visitor_id), 0), 0)::NUMERIC, 1) as avg_pageviews,
      ROUND(COALESCE(
        SUM(CASE WHEN duration_seconds < 300 THEN duration_seconds ELSE 0 END)::FLOAT 
        / NULLIF(COUNT(DISTINCT CASE WHEN duration_seconds < 300 THEN visitor_id END), 0), 
        0
      )::NUMERIC, 1) as avg_duration_seconds
    FROM utm_sessions
    WHERE REPLACE(utm_params->>'utm_content', '+', ' ') = $1
      AND COALESCE(NULLIF(utm_params->>'utm_source', ''), '-') = $2
      AND COALESCE(NULLIF(utm_params->>'utm_medium', ''), '-') = $3
      AND COALESCE(NULLIF(utm_params->>'utm_campaign', ''), '-') = $4
      AND entry_timestamp >= $5
      AND entry_timestamp <= $6
  `;
  
  const result = await db.query(query, [creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate]);
  return result.rows[0];
}

module.exports = {
  getAllVisitorsInPeriod,
  getCreativeVisitors,
  getVisitorOrders,
  getVisitorJourneys,
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
  getRawTrafficSummary
};
