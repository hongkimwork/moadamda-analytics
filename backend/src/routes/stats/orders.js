const express = require('express');
const router = express.Router();
const db = require('../../utils/database');
const { cleanUrl } = require('../../utils/urlCleaner');

// GET /api/stats/orders - Get paginated orders list
router.get('/orders', async (req, res) => {
  try {
    const { 
      start, 
      end, 
      device = 'all', 
      limit = 100, 
      offset = 0,
      search = '',
      sort_by = 'timestamp',
      sort_order = 'desc',
      include_cancelled = 'false',  // 취소/반품 주문 포함 여부
      include_pending = 'false'     // 입금대기 주문 포함 여부
    } = req.query;

    if (!start || !end) {
      return res.status(400).json({ error: 'start and end dates are required (YYYY-MM-DD)' });
    }

    // 날짜 문자열을 그대로 전달 (SQL에서 KST→UTC 변환 처리)
    // KST 기준 날짜를 UTC 범위로 변환하여 검색

    // Build device filter
    let deviceFilter = '';
    let searchFilter = '';
    let cancelledFilter = '';
    let queryParams = [start, end];
    let paramIndex = 3;

    if (device !== 'all') {
      deviceFilter = `AND v.device_type = $${paramIndex}`;
      queryParams.push(device);
      paramIndex++;
    }

    // 검색 필터 (주문번호 또는 상품명)
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      searchFilter = `AND (
        c.order_id ILIKE $${paramIndex} 
        OR COALESCE(c.product_name, '') ILIKE $${paramIndex}
      )`;
      queryParams.push(searchTerm);
      paramIndex++;
    }

    // 입금대기 주문 필터
    // - 입금대기 미포함 시: paid = 'T' (입금완료만)
    // - 입금대기 포함 시: paid 조건 없음 (전체)
    let paidFilter = '';
    if (include_pending !== 'true') {
      paidFilter = `AND c.paid = 'T'`;
    }

    // 취소/반품 주문 필터 및 금액 조건
    // - 취소 미포함 시: 정상 주문만 + 금액 > 0 조건
    // - 취소 포함 시: 모든 주문 (취소 주문은 금액이 0일 수 있음)
    let amountFilter = '';
    if (include_cancelled !== 'true') {
      cancelledFilter = `AND (c.canceled = 'F' OR c.canceled IS NULL) AND (c.order_status = 'confirmed' OR c.order_status IS NULL)`;
      amountFilter = `AND (c.final_payment > 0 OR c.total_amount > 0)`;
    }

    // 정렬 필드 매핑 (SQL injection 방지)
    const sortFieldMap = {
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
    const sortColumn = sortFieldMap[sort_by] || 'c.timestamp';
    const sortDirection = sort_order === 'asc' ? 'ASC' : 'DESC';

    queryParams.push(parseInt(limit), parseInt(offset));

    // Main query: Get orders with all necessary info
    // NOTE: DB의 timestamp 컬럼은 KST 값으로 저장됨 (timestamp without time zone + TZ=Asia/Seoul)
    // 따라서 타임존 변환 없이 직접 날짜 비교 수행
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
        ${paidFilter}
        AND c.order_id IS NOT NULL
        ${amountFilter}
        ${cancelledFilter}
        ${deviceFilter}
        ${searchFilter}
      ORDER BY ${sortColumn} ${sortDirection}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const ordersResult = await db.query(ordersQuery, queryParams);

    // Count total orders for pagination
    let countParams = [start, end];
    let countParamIndex = 3;
    let countDeviceFilter = '';
    let countSearchFilter = '';
    let countCancelledFilter = '';

    if (device !== 'all') {
      countDeviceFilter = `AND v.device_type = $${countParamIndex}`;
      countParams.push(device);
      countParamIndex++;
    }

    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      countSearchFilter = `AND (
        c.order_id ILIKE $${countParamIndex} 
        OR COALESCE(c.product_name, '') ILIKE $${countParamIndex}
      )`;
      countParams.push(searchTerm);
    }

    // 입금대기 필터 (카운트용)
    let countPaidFilter = '';
    if (include_pending !== 'true') {
      countPaidFilter = `AND c.paid = 'T'`;
    }

    // 취소 필터 및 금액 조건 (카운트용)
    let countAmountFilter = '';
    if (include_cancelled !== 'true') {
      countCancelledFilter = `AND (c.canceled = 'F' OR c.canceled IS NULL) AND (c.order_status = 'confirmed' OR c.order_status IS NULL)`;
      countAmountFilter = `AND (c.final_payment > 0 OR c.total_amount > 0)`;
    }

    // NOTE: DB의 timestamp 컬럼은 KST 값으로 저장됨
    const countQuery = `
      SELECT COUNT(*) as total
      FROM conversions c
      LEFT JOIN visitors v ON c.visitor_id = v.visitor_id
      WHERE c.timestamp >= $1::date
        AND c.timestamp < ($2::date + INTERVAL '1 day')
        ${countPaidFilter}
        AND c.order_id IS NOT NULL
        ${countAmountFilter}
        ${countCancelledFilter}
        ${countDeviceFilter}
        ${countSearchFilter}
    `;
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
      is_repurchase: row.is_repurchase,
      is_cafe24_only: !row.visitor_id || row.visitor_id === '',
      // 새 필드들
      points_spent: parseInt(row.points_spent) || 0,
      credits_spent: parseInt(row.credits_spent) || 0,
      order_place_name: row.order_place_name || null,
      payment_method_name: row.payment_method_name || null,
      order_status: row.order_status || 'confirmed',
      canceled: row.canceled || 'F',
      paid: row.paid || 'T'
    }));
    
    // 최종 매핑 (상품명/IP/디바이스 기본값 설정)
    orders = orders.map(order => ({
      ...order,
      product_name: order.product_name || '상품명 없음',
      ip_address: order.ip_address || (order.is_cafe24_only ? 'API 동기화' : 'unknown'),
      device_type: order.device_type || (order.is_cafe24_only ? 'API 동기화' : 'unknown')
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

    // 1. 주문 기본 정보 (결제 상세 정보 포함)
    const orderQuery = `
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
    const orderResult = await db.query(orderQuery, [orderId]);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];
    
    // Cafe24 API sync 주문 (visitor_id 없거나 빈 문자열) 처리
    const isExternalPayment = !order.visitor_id || order.visitor_id === '';
    
    if (isExternalPayment) {
      // Cafe24 API에서 주문 상세 정보 가져오기
      let cafe24Order = null;
      if (process.env.CAFE24_AUTH_KEY) {
        try {
          const cafe24Client = require('../../utils/cafe24');
          const detail = await cafe24Client.getOrderDetail(orderId);
          cafe24Order = detail.order;
        } catch (e) {
          console.error('[Order Detail] Cafe24 API error:', e.message);
        }
      }
      
      // visitor_id가 없는 주문 응답 (고객 여정 데이터 없음)
      return res.json({
        order: {
          order_id: order.order_id,
          timestamp: order.timestamp,
          final_payment: parseInt(order.final_payment) || 0,
          total_amount: parseInt(order.total_amount) || 0,
          product_count: parseInt(order.product_count) || 1,
          product_name: cafe24Order?.items?.[0]?.product_name || '상품명 없음',
          device_type: '-',
          browser: '-',
          os: '-',
          ip_address: '-',
          billing_name: cafe24Order?.billing_name || '-',
          payment_method: cafe24Order?.payment_method_name || '-',
          order_items: cafe24Order?.items?.map(item => ({
            product_name: item.product_name,
            product_price: parseInt(item.product_sale_price) || parseInt(item.product_price) || 0,
            quantity: parseInt(item.quantity) || 1,
            option_value: item.option_value
          })) || []
        },
        is_external_payment: false,
        message: '고객 여정 데이터가 없는 주문입니다.',
        purchase_journey: [],
        full_journey: [],
        utm_sessions: [],
        pageview_count: 0,
        total_events: 0
      });
    }

    // Cafe24 API에서 다중 상품 정보 가져오기 (visitor_id가 있는 일반 주문)
    let orderItems = [];
    if (process.env.CAFE24_AUTH_KEY) {
      try {
        const cafe24Client = require('../../utils/cafe24');
        const detail = await cafe24Client.getOrderDetail(orderId);
        if (detail.order?.items) {
          orderItems = detail.order.items.map(item => ({
            product_name: item.product_name,
            product_price: parseInt(item.product_sale_price) || parseInt(item.product_price) || 0,
            quantity: parseInt(item.quantity) || 1,
            option_value: item.option_value || null
          }));
        }
      } catch (e) {
        console.error('[Order Detail] Cafe24 API error (items):', e.message);
        // API 실패 시 DB 저장 정보로 폴백
        if (order.db_product_name || order.event_product_name) {
          orderItems = [{
            product_name: order.db_product_name || order.event_product_name || '상품명 없음',
            product_price: parseInt(order.total_amount) || 0,
            quantity: parseInt(order.product_count) || 1,
            option_value: null
          }];
        }
      }
    } else {
      // Cafe24 미연동 시 DB 정보로 대체
      if (order.db_product_name || order.event_product_name) {
        orderItems = [{
          product_name: order.db_product_name || order.event_product_name || '상품명 없음',
          product_price: parseInt(order.total_amount) || 0,
          quantity: parseInt(order.product_count) || 1,
          option_value: null
        }];
      }
    }

    // 2-1. 구매 당일 전체 경로 (구매 당일의 모든 페이지뷰)
    // UTM 기준 제거 - 직접 방문 포함 모든 페이지 이동 표시
    // FIX (2025-12-03): 타임존 비교 버그 수정
    // 핵심: p.timestamp는 KST로 저장됨 (timestamp without time zone)
    //       $2는 JS Date → timestamptz (UTC)
    // 해결: $2를 KST로 변환하여 p.timestamp(KST)와 동일 기준으로 비교
    const purchaseJourneyQuery = `
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
              600  -- 최대 10분으로 제한
            )
          ELSE 0
        END as time_spent_seconds
      FROM purchase_journey_pages
    `;
    const purchaseJourneyResult = await db.query(purchaseJourneyQuery, [order.visitor_id, order.timestamp]);

    // 2-2. 과거 방문 이력 (구매 당일 이전의 모든 방문)
    // UTM 기준 제거 - 구매 당일 이전의 모든 페이지 이동 표시
    // FIX (2025-12-03): 타임존 비교 버그 수정
    // 핵심: p.timestamp는 KST로 저장됨 (timestamp without time zone)
    //       $2는 JS Date → timestamptz (UTC)
    // 해결: $2를 KST로 변환하여 p.timestamp(KST)와 동일 기준으로 비교
    const previousVisitsQuery = `
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
        final_payment: parseInt(order.final_payment) || 0,
        total_amount: parseInt(order.total_amount) || 0,
        product_count: parseInt(order.product_count) || 1,
        product_name: order.db_product_name || order.event_product_name || '상품명 없음',
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
        entry_url: order.entry_url || null,
        // 결제 상세 정보
        payment_details: {
          discount_amount: parseInt(order.discount_amount) || 0,
          mileage_used: parseInt(order.mileage_used) || 0,
          points_spent: parseInt(order.points_spent) || 0,
          credits_spent: parseInt(order.credits_spent) || 0,
          shipping_fee: parseInt(order.shipping_fee) || 0,
          payment_method: order.payment_method_name || null,
          order_place: order.order_place_name || null,
          order_status: order.order_status || 'confirmed',
          paid: order.paid || 'T'
        },
        // 구매 상품 목록
        order_items: orderItems
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
