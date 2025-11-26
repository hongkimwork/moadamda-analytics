const express = require('express');
const router = express.Router();
const db = require('../../utils/database');
const { cleanUrl } = require('../../utils/urlCleaner');

// Cafe24 API에서 주문 상세 정보 가져오기 (상품명 보강용)
async function enrichOrdersWithCafe24(orders) {
  // Cafe24 환경 변수 체크
  if (!process.env.CAFE24_AUTH_KEY) {
    return orders;
  }
  
  try {
    const cafe24 = require('../../utils/cafe24');
    
    // 상품명이 없는 주문들만 필터링
    const ordersNeedingEnrichment = orders.filter(o => !o.product_name || o.product_name === '상품명 없음');
    
    if (ordersNeedingEnrichment.length === 0) {
      return orders;
    }
    
    // 각 주문에 대해 Cafe24 API로 상품명 조회 (병렬 처리, 최대 10개)
    const enrichPromises = ordersNeedingEnrichment.slice(0, 10).map(async (order) => {
      try {
        const detail = await cafe24.getOrderDetail(order.order_id);
        if (detail.order && detail.order.items && detail.order.items.length > 0) {
          return {
            order_id: order.order_id,
            product_name: detail.order.items[0].product_name,
            items_count: detail.order.items.length
          };
        }
      } catch (e) {
        // API 에러 무시
      }
      return null;
    });
    
    const enrichments = await Promise.all(enrichPromises);
    const enrichmentMap = new Map();
    enrichments.filter(e => e).forEach(e => enrichmentMap.set(e.order_id, e));
    
    // 원본 주문에 상품명 병합
    return orders.map(order => {
      const enrichment = enrichmentMap.get(order.order_id);
      if (enrichment) {
        return {
          ...order,
          product_name: enrichment.product_name,
          product_count: enrichment.items_count || order.product_count
        };
      }
      return order;
    });
  } catch (error) {
    console.error('[Orders] Cafe24 enrichment error:', error.message);
    return orders;
  }
}

// GET /api/stats/orders - Get paginated orders list
router.get('/orders', async (req, res) => {
  try {
    const { start, end, device = 'all', limit = 100, offset = 0 } = req.query;

    if (!start || !end) {
      return res.status(400).json({ error: 'start and end dates are required (YYYY-MM-DD)' });
    }

    // Parse dates
    const startDate = new Date(start);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    // Build device filter
    let deviceFilter = '';
    let queryParams = [startDate, endDate];
    let paramIndex = 3;

    if (device !== 'all') {
      deviceFilter = `AND v.device_type = $${paramIndex}`;
      queryParams.push(device);
      paramIndex++;
    }

    queryParams.push(parseInt(limit), parseInt(offset));

    // Main query: Get orders with all necessary info
    const ordersQuery = `
      SELECT 
        c.order_id,
        c.timestamp,
        c.final_payment,
        c.total_amount,
        c.product_count,
        c.visitor_id,
        c.session_id,
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
        -- Get first product name from events table
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
      LEFT JOIN sessions s ON c.session_id = s.session_id
      LEFT JOIN visitors v ON c.visitor_id = v.visitor_id
      WHERE c.timestamp BETWEEN $1 AND $2
        ${deviceFilter}
      ORDER BY c.timestamp DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const ordersResult = await db.query(ordersQuery, queryParams);

    // Count total orders for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM conversions c
      LEFT JOIN visitors v ON c.visitor_id = v.visitor_id
      WHERE c.timestamp BETWEEN $1 AND $2
        ${deviceFilter}
    `;

    const countParams = device !== 'all' ? [startDate, endDate, device] : [startDate, endDate];
    const countResult = await db.query(countQuery, countParams);

    // 기본 주문 데이터 매핑
    let orders = ordersResult.rows.map(row => ({
      order_id: row.order_id,
      timestamp: row.timestamp,
      final_payment: parseInt(row.final_payment) || 0,
      total_amount: parseInt(row.total_amount) || 0,
      product_count: parseInt(row.product_count) || 1,
      product_name: row.product_name || null,
      visitor_id: row.visitor_id,
      session_id: row.session_id,
      ip_address: row.ip_address || null,
      device_type: row.device_type || null,
      utm_source: row.utm_source || null,
      utm_campaign: row.utm_campaign || null,
      // Cafe24 API sync 주문 여부 표시 (visitor_id 없거나 빈 문자열)
      is_cafe24_only: !row.visitor_id || row.visitor_id === ''
    }));
    
    // 상품명이 없는 주문들을 Cafe24 API에서 보강
    orders = await enrichOrdersWithCafe24(orders);
    
    // 최종 매핑 (상품명 없으면 기본값)
    orders = orders.map(order => ({
      ...order,
      product_name: order.product_name || '상품명 없음',
      ip_address: order.ip_address || (order.is_cafe24_only ? '외부결제' : 'unknown'),
      device_type: order.device_type || (order.is_cafe24_only ? '외부결제' : 'unknown')
    }));

    res.json({
      period: {
        start: start,
        end: end
      },
      device_filter: device,
      total_orders: parseInt(countResult.rows[0].total),
      orders: orders,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: parseInt(offset) + ordersResult.rows.length < parseInt(countResult.rows[0].total)
      }
    });

  } catch (error) {
    console.error('Orders list error:', error);
    res.status(500).json({ error: 'Failed to fetch orders list' });
  }
});

// GET /api/stats/order-detail/:orderId - Detailed customer journey for a specific order
router.get('/order-detail/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    // 1. 주문 기본 정보
    const orderQuery = `
      SELECT
        c.order_id,
        c.timestamp,
        c.final_payment,
        c.total_amount,
        c.product_count,
        c.visitor_id,
        c.session_id,
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
        ) as product_name
      FROM conversions c
      LEFT JOIN sessions s ON c.session_id = s.session_id
      LEFT JOIN visitors v ON c.visitor_id = v.visitor_id
      WHERE c.order_id = $1
    `;
    const orderResult = await db.query(orderQuery, [orderId]);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];
    
    // 디버깅 로그
    console.log('[Order Detail] order_id:', orderId, 'visitor_id:', order.visitor_id, 'type:', typeof order.visitor_id);
    
    // Cafe24 API sync 주문 (visitor_id 없거나 빈 문자열) 처리
    const isExternalPayment = !order.visitor_id || order.visitor_id === '' || order.visitor_id === null;
    console.log('[Order Detail] isExternalPayment:', isExternalPayment);
    
    if (isExternalPayment) {
      // Cafe24 API에서 주문 상세 정보 가져오기
      let cafe24Order = null;
      if (process.env.CAFE24_AUTH_KEY) {
        try {
          const cafe24 = require('../../utils/cafe24');
          const detail = await cafe24.getOrderDetail(orderId);
          cafe24Order = detail.order;
        } catch (e) {
          console.error('[Order Detail] Cafe24 API error:', e.message);
        }
      }
      
      // 외부 결제 주문 응답 (고객 여정 데이터 없음)
      return res.json({
        order: {
          order_id: order.order_id,
          timestamp: order.timestamp,
          final_payment: parseInt(order.final_payment) || 0,
          total_amount: parseInt(order.total_amount) || 0,
          product_count: parseInt(order.product_count) || 1,
          product_name: cafe24Order?.items?.[0]?.product_name || '상품명 없음',
          device_type: '외부결제',
          browser: '-',
          os: '-',
          ip_address: '외부결제',
          // Cafe24 API에서 가져온 추가 정보
          billing_name: cafe24Order?.billing_name || '-',
          payment_method: cafe24Order?.payment_method_name || '외부결제',
          order_items: cafe24Order?.items?.map(item => ({
            product_name: item.product_name,
            product_price: item.product_price,
            quantity: item.quantity,
            option_value: item.option_value
          })) || []
        },
        is_external_payment: true,
        message: '외부 결제(네이버페이, 카카오페이 등)로 결제된 주문입니다. 고객 여정 데이터가 없습니다.',
        purchase_journey: [],
        full_journey: [],
        utm_sessions: [],
        pageview_count: 0,
        total_events: 0
      });
    }

    // 2-1. 구매 직전 경로 (마지막 UTM 접촉 이후 ~ 구매까지)
    // 광고 효과 측정에 사용되는 핵심 경로
    const purchaseJourneyQuery = `
      WITH last_utm_contact AS (
        SELECT MAX(entry_timestamp) as utm_timestamp
        FROM utm_sessions
        WHERE visitor_id = $1
      ),
      purchase_journey_pages AS (
        SELECT
          p.page_url,
          p.page_title,
          p.timestamp,
          LEAD(p.timestamp) OVER (ORDER BY p.timestamp) as next_timestamp
        FROM pageviews p
        CROSS JOIN last_utm_contact
        WHERE p.visitor_id = $1
          AND p.timestamp >= COALESCE(last_utm_contact.utm_timestamp, p.timestamp)
          AND p.timestamp <= $2
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
              600  -- 최대 10분으로 제한
            )
          ELSE 0
        END as time_spent_seconds
      FROM purchase_journey_pages
    `;
    const purchaseJourneyResult = await db.query(purchaseJourneyQuery, [order.visitor_id, order.timestamp]);

    // 2-2. 과거 방문 이력 (마지막 UTM 접촉 이전)
    // 고객이 이전에 어떤 페이지를 봤는지 참고용
    const previousVisitsQuery = `
      WITH last_utm_contact AS (
        SELECT MAX(entry_timestamp) as utm_timestamp
        FROM utm_sessions
        WHERE visitor_id = $1
      ),
      previous_pageviews AS (
        SELECT
          p.page_url,
          p.page_title,
          p.timestamp,
          DATE(p.timestamp) as visit_date,
          LEAD(p.timestamp) OVER (PARTITION BY DATE(p.timestamp) ORDER BY p.timestamp) as next_timestamp
        FROM pageviews p
        CROSS JOIN last_utm_contact
        WHERE p.visitor_id = $1
          AND p.timestamp < COALESCE(last_utm_contact.utm_timestamp, $2::timestamp)
          AND DATE(p.timestamp) < DATE($2)
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
    const previousVisitsResult = await db.query(previousVisitsQuery, [order.visitor_id, order.timestamp]);

    // 3. 동일 쿠키 UTM 히스토리 (동일 visitor_id의 모든 UTM 세션)
    // utm_params에서 누락된 값 복구 + 같은 광고 소재 병합 (5분 이내)
    const utmHistoryQuery = `
      WITH enriched_utm AS (
        -- Step 1: utm_params에서 누락된 값 복구
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
        -- Step 2: 이전 세션과의 간격 계산
        SELECT
          eu.*,
          LAG(eu.exit_timestamp) OVER (
            PARTITION BY eu.utm_content
            ORDER BY eu.entry_timestamp
          ) as prev_exit_timestamp
        FROM enriched_utm eu
      ),
      with_group_flags AS (
        -- Step 3: 새 그룹 시작 플래그 계산
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
        -- Step 4: 그룹 번호 생성
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
        -- Step 5: 그룹별로 병합
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
    const utmHistoryResult = await db.query(utmHistoryQuery, [order.visitor_id]);

    // 4. 동일 IP 방문 기록 (동일 IP의 과거 세션들)
    let sameIpVisits = [];
    if (order.ip_address && order.ip_address !== 'unknown') {
      const sameIpQuery = `
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
      const sameIpResult = await db.query(sameIpQuery, [order.ip_address, order.session_id]);
      sameIpVisits = sameIpResult.rows;
    }

    // 5. 과거 구매 이력 (동일 visitor_id의 과거 주문들)
    const pastPurchasesQuery = `
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
    const pastPurchasesResult = await db.query(pastPurchasesQuery, [order.visitor_id, orderId]);

    // 과거 방문을 날짜별로 그룹화
    const previousVisitsByDate = {};
    previousVisitsResult.rows.forEach(row => {
      const date = row.visit_date.toISOString().split('T')[0]; // YYYY-MM-DD
      if (!previousVisitsByDate[date]) {
        previousVisitsByDate[date] = [];
      }
      previousVisitsByDate[date].push({
        page_url: row.page_url,
        clean_url: cleanUrl(row.page_url),
        page_title: row.page_title || null,
        timestamp: row.timestamp,
        time_spent_seconds: row.time_spent_seconds || 0
      });
    });

    // 응답 데이터 구성
    res.json({
      order: {
        order_id: order.order_id,
        timestamp: order.timestamp,
        final_payment: order.final_payment,
        total_amount: order.total_amount,
        product_count: order.product_count,
        product_name: order.product_name,
        visitor_id: order.visitor_id,
        session_id: order.session_id,
        ip_address: order.ip_address || 'unknown',
        device_type: order.device_type || 'unknown',
        browser: order.browser || 'unknown',
        os: order.os || 'unknown',
        utm_source: order.utm_source || null,
        utm_medium: order.utm_medium || null,
        utm_campaign: order.utm_campaign || null,
        first_visit: order.first_visit,
        entry_url: order.entry_url || null
      },
      // 구매 직전 경로 (광고 클릭 후)
      purchase_journey: {
        pages: purchaseJourneyResult.rows.map(row => ({
          page_url: row.page_url,
          clean_url: cleanUrl(row.page_url),
          page_title: row.page_title || null,
          timestamp: row.timestamp,
          time_spent_seconds: row.time_spent_seconds || 0
        })),
        total_duration: purchaseJourneyResult.rows.reduce((sum, row) => sum + (row.time_spent_seconds || 0), 0),
        page_count: purchaseJourneyResult.rows.length
      },
      // 과거 방문 이력 (날짜별)
      previous_visits: Object.entries(previousVisitsByDate).map(([date, pages]) => ({
        date: date,
        pages: pages,
        total_duration: pages.reduce((sum, p) => sum + p.time_spent_seconds, 0),
        page_count: pages.length
      })).sort((a, b) => a.date.localeCompare(b.date)),
      // 기존 호환성 유지 (deprecated)
      page_path: purchaseJourneyResult.rows.map(row => ({
        page_url: row.page_url,
        clean_url: cleanUrl(row.page_url),
        page_title: row.page_title || null,
        timestamp: row.timestamp,
        time_spent_seconds: row.time_spent_seconds || 0
      })),
      utm_history: utmHistoryResult.rows.map(row => ({
        utm_source: row.utm_source || 'direct',
        utm_medium: row.utm_medium || null,
        utm_campaign: row.utm_campaign || null,
        utm_content: row.utm_content || null,
        entry_time: row.entry_timestamp,
        total_duration: row.duration_seconds || 0
      })),
      same_ip_visits: sameIpVisits.map(row => ({
        session_id: row.session_id,
        start_time: row.start_time,
        entry_url: row.entry_url,
        pageview_count: row.pageview_count || 0,
        visitor_id: row.visitor_id,
        utm_source: row.utm_source || null,
        utm_campaign: row.utm_campaign || null,
        device_type: row.device_type || 'unknown',
        has_purchase: row.has_purchase
      })),
      past_purchases: pastPurchasesResult.rows.map(row => ({
        order_id: row.order_id,
        timestamp: row.timestamp,
        final_payment: row.final_payment,
        product_count: row.product_count,
        product_name: row.product_name
      }))
    });

  } catch (error) {
    console.error('Order detail error:', error);
    res.status(500).json({ error: 'Failed to fetch order detail' });
  }
});

module.exports = router;

