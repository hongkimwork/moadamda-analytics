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
      time_spent_seconds: row.time_spent_seconds || 0,
      visitor_id: row.visitor_id || null // IP 기반 조회 시 어떤 visitor_id인지 표시
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
 * visitor_id 기반 방문과 IP 기반 방문을 병합
 * 중복 제거 및 시간순 정렬
 */
function mergeVisitsByDate(visitorVisits, ipVisits) {
  const allVisits = [...visitorVisits, ...ipVisits];
  
  // 날짜별로 그룹화
  const grouped = {};
  
  allVisits.forEach(visit => {
    const date = visit.date;
    if (!grouped[date]) {
      grouped[date] = {
        date: date,
        pages: [],
        total_duration: 0,
        page_count: 0,
        source: visit.source || 'visitor_id' // 데이터 출처 표시
      };
    }
    
    // 페이지 병합 (중복 제거: 같은 timestamp의 같은 URL)
    visit.pages.forEach(page => {
      const isDuplicate = grouped[date].pages.some(p => 
        p.timestamp === page.timestamp && p.page_url === page.page_url
      );
      if (!isDuplicate) {
        grouped[date].pages.push(page);
      }
    });
  });
  
  // 각 날짜의 페이지를 시간순 정렬하고 통계 재계산
  return Object.values(grouped)
    .map(visit => ({
      ...visit,
      pages: visit.pages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
      total_duration: visit.pages.reduce((sum, p) => sum + (p.time_spent_seconds || 0), 0),
      page_count: visit.pages.length
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 주문 상세 조회
 * 
 * FIX (2026-02-04): Attribution Window를 사용자가 선택할 수 있도록 변경
 * FIX (2026-02-10): matching_mode 추가 (extended = IP+기기+OS 기반 UTM도 어트리뷰션에 포함)
 * 
 * @param {string} orderId - 주문 ID
 * @param {number|null} attributionWindowDays - Attribution Window 일수 (30, 60, 90, null=전체)
 * @param {string} matchingMode - 매칭 방식 ('default' = 방문자ID+회원ID, 'fingerprint' = +브라우저핑거프린트)
 */
async function getOrderDetail(orderId, attributionWindowDays = 30, matchingMode = 'fingerprint') {
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
  // FIX (2026-01-27): 구매일(order.timestamp) 전달하여 Attribution Window 적용
  // FIX (2026-01-27): 타임존 문제 - DB timestamp는 KST로 저장되어 있으므로 로컬 시간 문자열로 변환
  // FIX (2026-02-03): IP 기반 과거 방문 기록 추가 (쿠키 끊김 대응)
  // FIX (2026-02-04): Attribution Window를 사용자가 선택할 수 있도록 변경
  const d = new Date(order.timestamp);
  const localTimestamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${String(d.getMilliseconds()).padStart(3, '0')}`;
  
  const hasValidIp = order.ip_address && order.ip_address !== 'unknown';
  const hasValidMemberId = order.member_id && order.member_id !== '';
  
  // FIX (2026-02-11): IP+기기+OS 매칭 → browser_fingerprint 매칭으로 전면 교체
  const hasValidFingerprint = order.browser_fingerprint && order.browser_fingerprint !== '';
  const useFingerprintMatching = matchingMode === 'fingerprint' && hasValidFingerprint;

  const [
    purchaseJourneyRows,
    previousVisitsRows,
    previousVisitsByFingerprintRows,
    previousVisitsByMemberIdRows,
    utmHistoryRows,
    utmHistoryByFingerprintRows,
    utmHistoryByMemberIdRows,
    sameIpVisits,
    pastPurchasesRows,
    pastPurchasesByFingerprintRows,
    pastPurchasesByMemberIdRows
  ] = await Promise.all([
    repository.getPurchaseJourney(order.visitor_id, order.timestamp),
    repository.getPreviousVisits(order.visitor_id),
    // FIX (2026-02-11): browser_fingerprint 기반 과거 방문 조회 (IP+기기+OS 대체)
    hasValidFingerprint
      ? repository.getPreviousVisitsByFingerprint(order.browser_fingerprint, order.visitor_id)
      : Promise.resolve([]),
    // member_id 기반 과거 방문 조회 (회원 기반 연결)
    hasValidMemberId
      ? repository.getPreviousVisitsByMemberId(order.member_id, order.visitor_id)
      : Promise.resolve([]),
    // removeUpperBound=true → 구매 이후 UTM도 포함 (광고 클릭 카드 표시용)
    repository.getUtmHistory(order.visitor_id, order.session_id, localTimestamp, attributionWindowDays, true),
    // FIX (2026-02-11): browser_fingerprint 기반 UTM 히스토리 (fingerprint 모드 시 어트리뷰션에 포함)
    useFingerprintMatching
      ? repository.getUtmHistoryByFingerprint(order.browser_fingerprint, order.visitor_id, localTimestamp, attributionWindowDays, true)
      : Promise.resolve([]),
    // member_id 기반 UTM 히스토리 조회 (회원 기반 연결)
    hasValidMemberId
      ? repository.getUtmHistoryByMemberId(order.member_id, order.visitor_id, localTimestamp, attributionWindowDays, true)
      : Promise.resolve([]),
    // 동일 IP 방문은 참고 정보로만 유지
    hasValidIp
      ? repository.getSameIpVisits(order.ip_address, order.session_id)
      : Promise.resolve([]),
    repository.getPastPurchases(order.visitor_id, orderId),
    // FIX (2026-02-11): fingerprint/member_id 기반 과거 구매 조회
    hasValidFingerprint
      ? repository.getPastPurchasesByFingerprint(order.browser_fingerprint, order.visitor_id, orderId)
      : Promise.resolve([]),
    hasValidMemberId
      ? repository.getPastPurchasesByMemberId(order.member_id, orderId)
      : Promise.resolve([])
  ]);

  // 4. 데이터 가공
  const purchaseJourneyPages = purchaseJourneyRows.map(row => ({
    page_url: row.page_url,
    clean_url: cleanUrl(row.page_url),
    page_title: row.page_title || null,
    timestamp: row.timestamp,
    time_spent_seconds: row.time_spent_seconds || 0
  }));

  // visitor_id 기반 과거 방문
  const visitorPreviousVisits = groupVisitsByDate(previousVisitsRows).map(v => ({
    ...v,
    source: 'visitor_id'
  }));
  
  // fingerprint 기반 과거 방문 (쿠키 끊김 대응)
  const fpPreviousVisits = groupVisitsByDate(previousVisitsByFingerprintRows).map(v => ({
    ...v,
    source: 'fingerprint'
  }));
  
  // FIX (2026-02-03): member_id 기반 과거 방문 (회원 기반 연결)
  const memberPreviousVisits = groupVisitsByDate(previousVisitsByMemberIdRows).map(v => ({
    ...v,
    source: 'member_id'
  }));
  
  // 세 소스 병합 (중복 제거): visitor_id → fingerprint → member_id
  const previousVisits = mergeVisitsByDate(
    mergeVisitsByDate(visitorPreviousVisits, fpPreviousVisits),
    memberPreviousVisits
  );

  // visitor_id 기반 UTM 히스토리
  const visitorUtmHistory = utmHistoryRows.map(row => ({
    utm_source: row.utm_source || 'direct',
    utm_medium: row.utm_medium || null,
    utm_campaign: row.utm_campaign || null,
    utm_content: row.utm_content || null,
    entry_time: row.entry_timestamp,
    total_duration: row.duration_seconds || 0,
    source: 'visitor_id'
  }));
  
  // FIX (2026-02-11): fingerprint 기반 UTM 히스토리 (IP 기반 대체)
  const fpUtmHistory = utmHistoryByFingerprintRows.map(row => ({
    utm_source: row.utm_source || 'direct',
    utm_medium: row.utm_medium || null,
    utm_campaign: row.utm_campaign || null,
    utm_content: row.utm_content || null,
    entry_time: row.entry_timestamp,
    total_duration: row.duration_seconds || 0,
    source: 'fingerprint',
    original_visitor_id: row.visitor_id
  }));
  
  // member_id 기반 UTM 히스토리 (회원 기반 연결)
  const memberUtmHistory = utmHistoryByMemberIdRows.map(row => ({
    utm_source: row.utm_source || 'direct',
    utm_medium: row.utm_medium || null,
    utm_campaign: row.utm_campaign || null,
    utm_content: row.utm_content || null,
    entry_time: row.entry_timestamp,
    total_duration: row.duration_seconds || 0,
    source: 'member_id',
    original_visitor_id: row.visitor_id
  }));

  // FIX (2026-02-11): UTM 히스토리 병합 - fingerprint + member_id 기반
  // - display_utm_history: 광고 클릭 카드 표시용 (구매 이후 UTM 포함)
  // - utm_history: 어트리뷰션 분석용 (구매 이전 UTM만)
  
  // visitor_id + member_id + fingerprint 기반 UTM 히스토리
  const mainUtmHistory = [...visitorUtmHistory, ...memberUtmHistory];
  
  // fingerprint 모드: fingerprint 기반 UTM도 메인에 포함
  if (matchingMode === 'fingerprint') {
    mainUtmHistory.push(...fpUtmHistory);
  }
  
  // 전체 UTM 히스토리 (구매 이후 포함 - 광고 클릭 카드 표시용)
  const displayUtmHistory = mainUtmHistory
    .filter((utm, idx, arr) => {
      // 중복 제거: 같은 entry_time과 utm_content 조합은 첫 번째만
      return arr.findIndex(u => 
        u.entry_time === utm.entry_time && u.utm_content === utm.utm_content
      ) === idx;
    })
    .sort((a, b) => new Date(a.entry_time) - new Date(b.entry_time));
  
  // 어트리뷰션 분석용 UTM 히스토리 (구매 이전만 필터링)
  const purchaseTime = new Date(order.timestamp);
  const utmHistory = displayUtmHistory.filter(utm => {
    return new Date(utm.entry_time) <= purchaseTime;
  });

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

  // FIX (2026-02-04): 과거 구매 데이터 병합 (visitor_id + IP + member_id)
  // 중복 제거: order_id 기준
  const pastPurchasesMap = new Map();
  
  // visitor_id 기반 구매
  pastPurchasesRows.forEach(row => {
    pastPurchasesMap.set(row.order_id, { ...row, source: 'visitor_id' });
  });
  
  // fingerprint 기반 구매 (중복 시 기존 데이터 유지)
  pastPurchasesByFingerprintRows.forEach(row => {
    if (!pastPurchasesMap.has(row.order_id)) {
      pastPurchasesMap.set(row.order_id, { ...row, source: 'fingerprint' });
    }
  });
  
  // member_id 기반 구매 (중복 시 기존 데이터 유지)
  pastPurchasesByMemberIdRows.forEach(row => {
    if (!pastPurchasesMap.has(row.order_id)) {
      pastPurchasesMap.set(row.order_id, { ...row, source: 'member_id' });
    }
  });
  
  const pastPurchases = Array.from(pastPurchasesMap.values())
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

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
    // FIX (2026-02-10): 광고 클릭 카드 표시용 UTM (구매 이후 포함)
    // - utm_history: 어트리뷰션 분석용 (구매 이전만)
    // - display_utm_history: 광고 클릭 카드 표시용 (구매 이후 포함)
    display_utm_history: displayUtmHistory,
    same_ip_visits: sameIpVisitsMapped,
    past_purchases: pastPurchasesMapped,
    matching_mode: matchingMode,
    // 데이터 연결 정보 (fingerprint + member_id 기반)
    data_enrichment: {
      fingerprint_based_visits_found: fpPreviousVisits.length > 0,
      fingerprint_based_utm_found: fpUtmHistory.length > 0,
      member_based_visits_found: memberPreviousVisits.length > 0,
      member_based_utm_found: memberUtmHistory.length > 0,
      visitor_visits_count: visitorPreviousVisits.length,
      fingerprint_visits_count: fpPreviousVisits.length,
      member_visits_count: memberPreviousVisits.length,
      visitor_utm_count: visitorUtmHistory.length,
      fingerprint_utm_count: fpUtmHistory.length,
      member_utm_count: memberUtmHistory.length
    }
  };
}

module.exports = {
  getOrdersList,
  getOrderDetail
};

