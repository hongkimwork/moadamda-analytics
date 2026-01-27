const repository = require('./ordersRepository');
const { cleanUrl } = require('../../utils/urlCleaner');

/**
 * Orders Service
 * 주문 관련 비즈니스 로직 담당
 */

/**
 * 주문 데이터 매핑 (공통)
 */
function mapOrderData(row) {
  return {
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
    points_spent: parseInt(row.points_spent) || 0,
    credits_spent: parseInt(row.credits_spent) || 0,
    order_place_name: row.order_place_name || null,
    payment_method_name: row.payment_method_name || null,
    order_status: row.order_status || 'confirmed',
    canceled: row.canceled || 'F',
    paid: row.paid || 'T'
  };
}

/**
 * 주문 데이터 최종 매핑 (기본값 적용)
 */
function applyOrderDefaults(order) {
  return {
    ...order,
    product_name: order.product_name || '상품명 없음',
    ip_address: order.ip_address || (order.is_cafe24_only ? 'API 동기화' : 'unknown'),
    device_type: order.device_type || (order.is_cafe24_only ? 'API 동기화' : 'unknown')
  };
}

/**
 * 주문 목록 조회
 */
async function getOrdersList(options) {
  const {
    start,
    end,
    device = 'all',
    limit = 100,
    offset = 0,
    search = '',
    sortBy = 'timestamp',
    sortOrder = 'desc',
    includeCancelled = 'false',
    includePending = 'false'
  } = options;

  // 날짜 검증
  if (!start || !end) {
    throw new Error('start and end dates are required (YYYY-MM-DD)');
  }

  // 병렬로 주문 목록과 카운트 조회
  const [ordersRows, totalCount] = await Promise.all([
    repository.getOrders({
      start,
      end,
      device,
      search,
      sortBy,
      sortOrder,
      includeCancelled,
      includePending,
      limit,
      offset
    }),
    repository.getOrdersCount({
      start,
      end,
      device,
      search,
      includeCancelled,
      includePending
    })
  ]);

  // 데이터 매핑
  const orders = ordersRows
    .map(mapOrderData)
    .map(applyOrderDefaults);

  return {
    period: {
      start: start,
      end: end
    },
    device_filter: device,
    total_orders: totalCount,
    orders: orders,
    pagination: {
      limit: parseInt(limit),
      offset: parseInt(offset),
      has_more: parseInt(offset) + orders.length < totalCount
    }
  };
}

/**
 * Cafe24 주문 상세 가져오기 (헬퍼)
 */
async function fetchCafe24OrderDetail(orderId) {
  if (!process.env.CAFE24_AUTH_KEY) {
    return null;
  }

  try {
    const cafe24Client = require('../../utils/cafe24');
    const detail = await cafe24Client.getOrderDetail(orderId);
    return detail.order;
  } catch (error) {
    console.error('[Order Detail] Cafe24 API error:', error.message);
    return null;
  }
}

/**
 * Cafe24 주문 아이템 매핑
 */
function mapCafe24OrderItems(cafe24Order, fallbackProductName = null, fallbackAmount = 0, fallbackCount = 1) {
  if (cafe24Order?.items) {
    return cafe24Order.items.map(item => ({
      product_name: item.product_name,
      product_price: parseInt(item.product_sale_price) || parseInt(item.product_price) || 0,
      quantity: parseInt(item.quantity) || 1,
      option_value: item.option_value || null
    }));
  }

  // Fallback: DB 정보 사용
  if (fallbackProductName) {
    return [{
      product_name: fallbackProductName,
      product_price: parseInt(fallbackAmount) || 0,
      quantity: parseInt(fallbackCount) || 1,
      option_value: null
    }];
  }

  return [];
}

/**
 * 외부 결제 주문 응답 (visitor_id 없는 경우)
 */
async function buildExternalPaymentResponse(order) {
  const cafe24Order = await fetchCafe24OrderDetail(order.order_id);

  return {
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
  };
}

/**
 * Date 객체를 로컬 시간대 기준 YYYY-MM-DD 문자열로 변환
 * (toISOString은 UTC 기준이라 KST에서 하루 앞당겨지는 버그 방지)
 */
function formatDateLocal(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 과거 방문을 날짜별로 그룹화
 */
function groupVisitsByDate(visits) {
  const grouped = {};

  visits.forEach(row => {
    const date = formatDateLocal(row.visit_date);
    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push({
      page_url: row.page_url,
      clean_url: cleanUrl(row.page_url),
      page_title: row.page_title || null,
      timestamp: row.timestamp,
      time_spent_seconds: row.time_spent_seconds || 0
    });
  });

  return Object.entries(grouped)
    .map(([date, pages]) => ({
      date: date,
      pages: pages,
      total_duration: pages.reduce((sum, p) => sum + p.time_spent_seconds, 0),
      page_count: pages.length
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 주문 상세 조회
 */
async function getOrderDetail(orderId) {
  // 1. 주문 기본 정보 조회
  const order = await repository.getOrderBasicInfo(orderId);

  if (!order) {
    throw new Error('Order not found');
  }

  // Cafe24 API sync 주문 (visitor_id 없거나 빈 문자열) 처리
  const isExternalPayment = !order.visitor_id || order.visitor_id === '';

  if (isExternalPayment) {
    return await buildExternalPaymentResponse(order);
  }

  // 2. Cafe24 주문 상품 정보 가져오기
  const cafe24Order = await fetchCafe24OrderDetail(orderId);
  const orderItems = mapCafe24OrderItems(
    cafe24Order,
    order.db_product_name || order.event_product_name,
    order.total_amount,
    order.product_count
  );

  // 3. 병렬로 여정 데이터 조회
  // getUtmHistory: session_id를 추가로 전달 (인앱 브라우저 쿠키 문제 대응)
  // FIX (2026-01-27): 구매일(order.timestamp) 전달하여 Attribution Window (30일) 적용
  // FIX (2026-01-27): 타임존 문제 - DB timestamp는 KST로 저장되어 있으므로 로컬 시간 문자열로 변환
  const d = new Date(order.timestamp);
  const localTimestamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${String(d.getMilliseconds()).padStart(3, '0')}`;
  
  const [
    purchaseJourneyRows,
    previousVisitsRows,
    utmHistoryRows,
    sameIpVisits,
    pastPurchases
  ] = await Promise.all([
    repository.getPurchaseJourney(order.visitor_id, order.timestamp),
    repository.getPreviousVisits(order.visitor_id, order.timestamp),
    repository.getUtmHistory(order.visitor_id, order.session_id, localTimestamp),
    order.ip_address && order.ip_address !== 'unknown'
      ? repository.getSameIpVisits(order.ip_address, order.session_id)
      : Promise.resolve([]),
    repository.getPastPurchases(order.visitor_id, orderId)
  ]);

  // 4. 데이터 가공
  const purchaseJourneyPages = purchaseJourneyRows.map(row => ({
    page_url: row.page_url,
    clean_url: cleanUrl(row.page_url),
    page_title: row.page_title || null,
    timestamp: row.timestamp,
    time_spent_seconds: row.time_spent_seconds || 0
  }));

  const previousVisits = groupVisitsByDate(previousVisitsRows);

  const utmHistory = utmHistoryRows.map(row => ({
    utm_source: row.utm_source || 'direct',
    utm_medium: row.utm_medium || null,
    utm_campaign: row.utm_campaign || null,
    utm_content: row.utm_content || null,
    entry_time: row.entry_timestamp,
    total_duration: row.duration_seconds || 0
  }));

  const sameIpVisitsMapped = sameIpVisits.map(row => ({
    session_id: row.session_id,
    start_time: row.start_time,
    entry_url: row.entry_url,
    pageview_count: row.pageview_count || 0,
    visitor_id: row.visitor_id,
    utm_source: row.utm_source || null,
    utm_campaign: row.utm_campaign || null,
    device_type: row.device_type || 'unknown',
    has_purchase: row.has_purchase
  }));

  // 과거 구매 내역에 Cafe24 상세 정보 추가 (병렬 처리)
  const pastPurchasesMapped = await Promise.all(
    pastPurchases.map(async (row) => {
      const cafe24Order = await fetchCafe24OrderDetail(row.order_id);
      const orderItems = mapCafe24OrderItems(
        cafe24Order,
        row.product_name,
        row.final_payment,
        row.product_count
      );

      return {
        order_id: row.order_id,
        timestamp: row.timestamp,
        final_payment: parseInt(row.final_payment) || 0,
        product_count: row.product_count,
        product_name: row.product_name,
        order_items: orderItems,
        payment_details: {
          order_status: row.order_status || 'confirmed',
          paid: row.paid || 'T'
        }
      };
    })
  );

  // 5. 응답 구성
  return {
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
      payment_details: {
        discount_amount: parseInt(order.discount_amount) || 0,
        mileage_used: parseInt(order.mileage_used) || 0,
        points_spent: parseInt(order.points_spent) || 0,
        credits_spent: parseInt(order.credits_spent) || 0,
        shipping_fee: parseInt(order.shipping_fee) || 0,
        payment_method: order.payment_method_name || null,
        order_place: order.order_place_name || null,
        order_status: order.order_status || 'confirmed',
        canceled: order.canceled || 'F',
        paid: order.paid || 'T'
      },
      order_items: orderItems
    },
    purchase_journey: {
      pages: purchaseJourneyPages,
      total_duration: purchaseJourneyPages.reduce((sum, row) => sum + row.time_spent_seconds, 0),
      page_count: purchaseJourneyPages.length
    },
    previous_visits: previousVisits,
    // 기존 호환성 유지 (deprecated)
    page_path: purchaseJourneyPages,
    utm_history: utmHistory,
    same_ip_visits: sameIpVisitsMapped,
    past_purchases: pastPurchasesMapped
  };
}

module.exports = {
  getOrdersList,
  getOrderDetail
};

