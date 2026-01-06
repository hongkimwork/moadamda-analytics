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

/**
 * 특정 광고로 유입된 visitor별 세션 정보 조회 (PV, 체류시간)
 * 
 * FIX (2026-01-06): 체류시간 계산 방식 변경
 * - 기존: utm_sessions.duration_seconds 사용 → 세션 종료 이벤트 필요, 자주 0초
 * - 수정: pageviews 테이블에서 직접 계산 (여정 상세와 동일한 방식)
 *   → 다음 페이지뷰와의 시간 차이로 체류시간 계산 (최대 600초=10분 제한)
 */
async function getVisitorSessionInfoForCreative({ visitorIds, creative_name, utm_source, utm_medium, utm_campaign }) {
  if (visitorIds.length === 0) return {};
  
  // 1단계: 해당 광고로 유입된 UTM 세션의 session_id 목록 조회
  const sessionQuery = `
    SELECT visitor_id, session_id
    FROM utm_sessions
    WHERE visitor_id = ANY($1)
      AND REPLACE(utm_params->>'utm_content', '+', ' ') = $2
      AND COALESCE(NULLIF(utm_params->>'utm_source', ''), '-') = $3
      AND COALESCE(NULLIF(utm_params->>'utm_medium', ''), '-') = $4
      AND COALESCE(NULLIF(utm_params->>'utm_campaign', ''), '-') = $5
  `;
  
  const sessionResult = await db.query(sessionQuery, [visitorIds, creative_name, utm_source, utm_medium, utm_campaign]);
  
  if (sessionResult.rows.length === 0) {
    return {};
  }
  
  // visitor_id별 session_id 목록 구성
  const visitorSessionMap = {};
  const allSessionIds = [];
  sessionResult.rows.forEach(row => {
    if (!visitorSessionMap[row.visitor_id]) {
      visitorSessionMap[row.visitor_id] = [];
    }
    visitorSessionMap[row.visitor_id].push(row.session_id);
    allSessionIds.push(row.session_id);
  });
  
  // 2단계: 해당 세션들의 pageviews에서 체류시간 계산 (여정 상세와 동일한 로직)
  const pageviewQuery = `
    WITH page_times AS (
      SELECT 
        p.session_id,
        p.visitor_id,
        p.timestamp,
        LEAD(p.timestamp) OVER (PARTITION BY p.session_id ORDER BY p.timestamp) as next_timestamp
      FROM pageviews p
      WHERE p.session_id = ANY($1)
    )
    SELECT
      visitor_id,
      COUNT(*) as pageview_count,
      SUM(
        CASE
          WHEN next_timestamp IS NOT NULL THEN
            LEAST(EXTRACT(EPOCH FROM (next_timestamp - timestamp))::INTEGER, 600)
          ELSE 0
        END
      ) as total_duration
    FROM page_times
    GROUP BY visitor_id
  `;
  
  const pageviewResult = await db.query(pageviewQuery, [allSessionIds]);
  
  // visitor_id를 키로 하는 객체로 변환
  const sessionInfoMap = {};
  pageviewResult.rows.forEach(row => {
    sessionInfoMap[row.visitor_id] = {
      pageview_count: parseInt(row.pageview_count) || 0,
      duration_seconds: parseInt(row.total_duration) || 0
    };
  });
  
  // pageviews가 없는 visitor는 utm_sessions의 pageview_count 사용
  Object.keys(visitorSessionMap).forEach(visitorId => {
    if (!sessionInfoMap[visitorId]) {
      sessionInfoMap[visitorId] = {
        pageview_count: visitorSessionMap[visitorId].length,
        duration_seconds: 0
      };
    }
  });
  
  return sessionInfoMap;
}

/**
 * visitor별 특정 광고 접촉 횟수 조회
 */
async function getCreativeTouchCounts({ visitorIds, creative_name, utm_source, utm_medium, utm_campaign }) {
  if (visitorIds.length === 0) return {};
  
  const query = `
    SELECT 
      visitor_id,
      COUNT(*) as touch_count
    FROM utm_sessions
    WHERE visitor_id = ANY($1)
      AND REPLACE(utm_params->>'utm_content', '+', ' ') = $2
      AND COALESCE(NULLIF(utm_params->>'utm_source', ''), '-') = $3
      AND COALESCE(NULLIF(utm_params->>'utm_medium', ''), '-') = $4
      AND COALESCE(NULLIF(utm_params->>'utm_campaign', ''), '-') = $5
    GROUP BY visitor_id
  `;
  
  const result = await db.query(query, [visitorIds, creative_name, utm_source, utm_medium, utm_campaign]);
  
  const touchCountMap = {};
  result.rows.forEach(row => {
    touchCountMap[row.visitor_id] = parseInt(row.touch_count) || 0;
  });
  
  return touchCountMap;
}

/**
 * visitor별 총 방문 횟수 조회
 */
async function getVisitorTotalVisits({ visitorIds }) {
  if (visitorIds.length === 0) return {};
  
  const query = `
    SELECT 
      visitor_id,
      visit_count
    FROM visitors
    WHERE visitor_id = ANY($1)
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
  getRawTrafficSummary,
  getVisitorSessionInfoForCreative,
  getCreativeTouchCounts,
  getVisitorTotalVisits,
  getDurationDistribution
};
