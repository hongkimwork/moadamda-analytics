/**
 * Event Handlers
 * 각 이벤트 타입별 비즈니스 로직 처리
 */

const repository = require('./repository');
const utmService = require('./utmService');
const { parseBrowserInfo, determineReferrerType } = require('./utils');

// Cafe24 API client (for real-time order verification)
let cafe24 = null;
if (process.env.CAFE24_AUTH_KEY) {
  cafe24 = require('../../utils/cafe24');
}

// ============================================================
// 인앱 브라우저 중복 요청 방지 (Dual Send 문제 대응)
// ============================================================
// 인앱 브라우저(Instagram, Facebook 등)에서 sendBeacon + fetch를 
// 동시에 보내면 같은 이벤트가 2번 처리되는 문제 방지
// ============================================================

const DEDUP_WINDOW_MS = 5000; // 5초 내 동일 요청은 중복으로 판단
const DEDUP_CLEANUP_INTERVAL_MS = 60000; // 1분마다 오래된 항목 정리

// 최근 처리된 이벤트 캐시: key -> timestamp
const recentEvents = new Map();

/**
 * 중복 이벤트인지 확인
 * @param {string} eventType - 이벤트 타입
 * @param {string} sessionId - 세션 ID
 * @param {string} url - 페이지 URL
 * @param {string} timestamp - 이벤트 타임스탬프
 * @returns {boolean} 중복이면 true
 */
function isDuplicateEvent(eventType, sessionId, url, timestamp) {
  // pageview만 중복 체크 (가장 많이 중복되는 이벤트)
  if (eventType !== 'pageview') return false;
  
  // URL에서 쿼리스트링 제거 (같은 페이지 판단용)
  const urlPath = url ? url.split('?')[0] : '';
  const key = `${sessionId}:${urlPath}:${timestamp}`;
  
  const now = Date.now();
  const lastProcessed = recentEvents.get(key);
  
  if (lastProcessed && (now - lastProcessed) < DEDUP_WINDOW_MS) {
    return true; // 중복
  }
  
  // 새 이벤트로 등록
  recentEvents.set(key, now);
  return false;
}

// 주기적으로 오래된 항목 정리 (메모리 누수 방지)
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of recentEvents.entries()) {
    if (now - timestamp > DEDUP_WINDOW_MS * 2) {
      recentEvents.delete(key);
    }
  }
}, DEDUP_CLEANUP_INTERVAL_MS);

/**
 * Handle pageview event
 */
async function handlePageview(event, clientIp) {
  const {
    visitor_id,
    session_id,
    url,
    title,
    referrer,
    timestamp,
    device_type,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_params,
    browser_fingerprint,
    member_id_crypt
  } = event;

  // 중복 요청 체크 (인앱 브라우저 dual send 문제 대응)
  if (isDuplicateEvent('pageview', session_id, url, timestamp)) {
    console.log(`[Track] Duplicate pageview ignored: session=${session_id?.substring(0, 8)}...`);
    return; // 중복 요청은 무시
  }

  const visitTime = new Date(timestamp);

  // 1. Upsert visitor (with IP tracking + dynamic UTM support + bot detection + fingerprint)
  const browserInfo = parseBrowserInfo(event);
  
  await repository.upsertVisitor({
    visitor_id,
    visitTime,
    device_type,
    browser: browserInfo.browser,
    os: browserInfo.os,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_params,
    clientIp,
    userAgent: event.user_agent || '',
    browser_fingerprint: browser_fingerprint || null,
    member_id_crypt: member_id_crypt || null
  });

  // 2. Upsert session (with IP tracking + auto-calculate duration_seconds + dynamic UTM)
  await repository.upsertSession({
    session_id,
    visitor_id,
    visitTime,
    url,
    clientIp,
    utm_params
  });

  // 3. Insert pageview
  await repository.insertPageview({
    session_id,
    visitor_id,
    url,
    title,
    timestamp: visitTime
  });

  // 4. Update realtime visitors
  await repository.updateRealtimeVisitor({
    visitor_id,
    url,
    timestamp: visitTime,
    device_type
  });

  // 5. Determine referrer type
  const referrerType = determineReferrerType(referrer);
  if (referrerType) {
    await repository.updateVisitorReferrer(visitor_id, referrerType);
  }

  // 6. Phase 4.4: Track UTM session history for multi-touch attribution
  // FIX: utm_source만 있는 경우는 "실제 광고 클릭"이 아닌 "사이트 내 이동"으로 판단
  // 광고 클릭의 핵심 정보(캠페인/소재)가 있어야만 UTM 세션으로 기록
  const utmContent = utm_params?.utm_content;
  const hasAdClickInfo = utm_campaign || utmContent;
  
  if (hasAdClickInfo) {
    await utmService.trackUtmSession({
      session_id,
      visitor_id,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_params,
      url,
      timestamp: visitTime
    });
  }
}

/**
 * Handle ecommerce events (view_product, add_to_cart, checkout, purchase)
 */
async function handleEcommerceEvent(event, clientIp) {
  const {
    type: event_type,
    visitor_id,
    session_id,
    timestamp,
    product_id,
    product_name,
    product_price,
    quantity,
    order_id,
    total_amount,
    discount_amount,
    mileage_used,
    shipping_fee,
    final_payment
  } = event;

  const eventTime = new Date(timestamp);

  // CRITICAL FIX: Ensure visitor and session exist before inserting events
  await repository.ensureVisitorExists(visitor_id, eventTime, clientIp);
  await repository.ensureSessionExists(session_id, visitor_id, eventTime, '', clientIp);

  // Handle purchase event with Cafe24 API verification
  if (event_type === 'purchase' && order_id) {
    await handlePurchaseEvent({
      session_id,
      visitor_id,
      order_id,
      total_amount,
      product_count: quantity || 1,
      eventTime,
      discount_amount,
      mileage_used,
      shipping_fee,
      final_payment,
      product_name,
      member_id_crypt: event.member_id_crypt || null
    });
  }

  // Insert into events table
  await repository.insertEvent({
    session_id,
    visitor_id,
    event_type,
    product_id,
    product_name,
    product_price,
    quantity: quantity || 1,
    timestamp: eventTime
  });
}

/**
 * Handle purchase event (internal helper)
 * Includes Cafe24 API verification for accurate payment data
 */
async function handlePurchaseEvent(purchaseData) {
  const {
    session_id,
    visitor_id,
    order_id,
    total_amount,
    product_count,
    eventTime,
    discount_amount,
    mileage_used,
    shipping_fee,
    final_payment,
    product_name,
    member_id_crypt
  } = purchaseData;

  // Get visitor's UTM information for attribution
  const utm = await repository.getVisitorUtm(visitor_id);

  // === REAL-TIME CAFE24 API VERIFICATION ===
  let actualPaid = 'F';
  let actualFinalPayment = 0;
  let actualTotalAmount = total_amount || 0;
  let actualDiscountAmount = discount_amount || 0;
  let actualMileageUsed = mileage_used || 0;
  let actualShippingFee = shipping_fee || 0;
  let actualProductCount = product_count;
  let actualProductName = product_name || null;
  let actualPointsSpent = 0;
  let actualCreditsSpent = 0;
  let actualOrderPlaceName = null;
  let actualPaymentMethodName = null;
  let actualCafe24Status = null;
  let actualCanceled = 'F';
  let actualOrderStatus = 'confirmed';
  let actualMemberId = null;
  let actualFirstOrder = null;

  if (cafe24) {
    try {
      const cafe24OrderResponse = await cafe24.getOrderDetail(order_id);
      
      if (cafe24OrderResponse && cafe24OrderResponse.order) {
        const cafe24Order = cafe24OrderResponse.order;
        
        // Use Cafe24's accurate values
        actualPaid = cafe24Order.paid || 'F';
        actualFinalPayment = Math.round(parseFloat(cafe24Order.actual_order_amount?.payment_amount || 0));
        const orderPriceAmount = Math.round(parseFloat(cafe24Order.actual_order_amount?.order_price_amount || 0));
        const shippingFeeAmount = Math.round(parseFloat(cafe24Order.actual_order_amount?.shipping_fee || 0));
        actualTotalAmount = orderPriceAmount + shippingFeeAmount;
        actualDiscountAmount = Math.round(parseFloat(cafe24Order.actual_order_amount?.total_discount_amount || 0));
        actualMileageUsed = Math.round(parseFloat(cafe24Order.actual_order_amount?.mileage_spent_amount || 0));
        actualShippingFee = Math.round(parseFloat(cafe24Order.actual_order_amount?.shipping_fee || 0));
        actualProductCount = cafe24Order.items?.length || product_count;
        actualProductName = cafe24Order.items?.[0]?.product_name || product_name || null;
        
        actualPointsSpent = Math.round(parseFloat(cafe24Order.actual_order_amount?.points_spent_amount || 0));
        actualCreditsSpent = Math.round(parseFloat(cafe24Order.actual_order_amount?.credits_spent_amount || 0));
        actualOrderPlaceName = cafe24Order.order_place_name || null;
        actualPaymentMethodName = Array.isArray(cafe24Order.payment_method_name) 
          ? cafe24Order.payment_method_name.join(', ') 
          : (cafe24Order.payment_method_name || null);
        actualCafe24Status = cafe24Order.items?.[0]?.order_status || null;
        actualCanceled = cafe24Order.canceled || 'F';
        
        // order_status 결정
        if (actualCafe24Status) {
          if (actualCafe24Status.startsWith('C')) {
            actualOrderStatus = 'cancelled';
          } else if (actualCafe24Status.startsWith('R')) {
            actualOrderStatus = 'refunded';
          }
        }
        if (actualCanceled === 'T') {
          actualOrderStatus = 'cancelled';
        }
        
        // Extract member_id and first_order from Cafe24 API response
        actualMemberId = cafe24Order.member_id || null;
        actualFirstOrder = cafe24Order.first_order || null; // T=신규, F=재구매
        
        console.log(`[Track] Cafe24 API verified order ${order_id}: paid=${actualPaid}, final_payment=${actualFinalPayment}, points=${actualPointsSpent}, member_id=${actualMemberId}, first_order=${actualFirstOrder}`);
      }
    } catch (cafe24Error) {
      console.warn(`[Track] Cafe24 API error for order ${order_id}:`, cafe24Error.message);
      // Use tracker values as fallback
      actualFinalPayment = final_payment || 0;
      actualTotalAmount = total_amount || 0;
      actualDiscountAmount = discount_amount || 0;
      actualMileageUsed = mileage_used || 0;
      actualShippingFee = shipping_fee || 0;
    }
  } else {
    // No Cafe24 API configured (local development) - use tracker values
    actualFinalPayment = final_payment || 0;
    actualTotalAmount = total_amount || 0;
    actualDiscountAmount = discount_amount || 0;
    actualMileageUsed = mileage_used || 0;
    actualShippingFee = shipping_fee || 0;
  }

  // Insert into conversions table with Cafe24-verified payment details
  await repository.upsertConversion({
    session_id,
    visitor_id,
    order_id,
    total_amount: actualTotalAmount,
    product_count: actualProductCount,
    timestamp: eventTime,
    discount_amount: actualDiscountAmount,
    mileage_used: actualMileageUsed,
    shipping_fee: actualShippingFee,
    final_payment: actualFinalPayment,
    utm_source: utm.utm_source || null,
    utm_campaign: utm.utm_campaign || null,
    paid: actualPaid,
    product_name: actualProductName,
    points_spent: actualPointsSpent,
    credits_spent: actualCreditsSpent,
    order_place_name: actualOrderPlaceName,
    payment_method_name: actualPaymentMethodName,
    cafe24_status: actualCafe24Status,
    canceled: actualCanceled,
    order_status: actualOrderStatus,
    member_id: actualMemberId,
    first_order: actualFirstOrder
  });

  // Mark session as converted
  await repository.markSessionConverted(session_id, eventTime);
}

/**
 * Handle session end event
 */
async function handleSessionEnd(event) {
  const { visitor_id, session_id, timestamp } = event;
  const endTime = new Date(timestamp);

  try {
    // Close all open UTM sessions for this visitor/session
    await utmService.closeUtmSessions(visitor_id, session_id, endTime);

    // Update session end_time and duration
    await repository.updateSessionEnd(session_id, endTime);
  } catch (error) {
    console.error('Error handling session end:', error);
  }
}

/**
 * Handle checkout attempt event (v047)
 */
async function handleCheckoutAttempt(event, clientIp) {
  const { visitor_id, session_id, timestamp, url, referrer } = event;
  const eventTime = new Date(timestamp);

  try {
    // Ensure visitor and session exist
    await repository.ensureVisitorExists(visitor_id, eventTime, clientIp);
    await repository.ensureSessionExists(session_id, visitor_id, eventTime, url, clientIp);

    // Insert checkout_attempt event into events table
    await repository.insertEvent({
      session_id,
      visitor_id,
      event_type: 'checkout_attempt',
      timestamp: eventTime,
      metadata: JSON.stringify({ url, referrer })
    });

    console.log(`[Track] Checkout attempt: visitor=${visitor_id.substring(0, 8)}...`);
  } catch (error) {
    console.error('Error handling checkout attempt:', error);
  }
}

/**
 * Handle heartbeat event for session duration tracking (v047)
 */
async function handleHeartbeat(event) {
  const { visitor_id, session_id, timestamp } = event;
  const heartbeatTime = new Date(timestamp);

  try {
    // Update session end_time and duration_seconds
    await repository.updateSessionEnd(session_id, heartbeatTime);

    // Also update UTM sessions if any are open
    await utmService.updateUtmSessionDuration(visitor_id, session_id, heartbeatTime);
  } catch (error) {
    // Heartbeat errors are not critical, just log them
    console.error('Error handling heartbeat:', error.message);
  }
}

/**
 * Handle tracker error logging (v047)
 */
function handleTrackerError(event) {
  const { visitor_id, session_id, timestamp, message, filename, lineno, colno } = event;
  
  // Log to console for monitoring
  console.error(`[Tracker Error] visitor=${visitor_id?.substring(0, 8)}... | ${message} | ${filename}:${lineno}:${colno}`);
  
  // Note: We don't store tracker errors in DB to avoid noise
}

/**
 * Handle coupon select event (v20.4)
 */
async function handleCouponSelect(event, clientIp) {
  const { visitor_id, session_id, timestamp, url, referrer } = event;
  const eventTime = new Date(timestamp);

  try {
    // Ensure visitor and session exist
    await repository.ensureVisitorExists(visitor_id, eventTime, clientIp);
    await repository.ensureSessionExists(session_id, visitor_id, eventTime, url, clientIp);

    // Insert coupon_select event into events table
    await repository.insertEvent({
      session_id,
      visitor_id,
      event_type: 'coupon_select',
      timestamp: eventTime,
      metadata: JSON.stringify({ url, referrer })
    });

    console.log(`[Track] Coupon select: visitor=${visitor_id.substring(0, 8)}...`);
  } catch (error) {
    console.error('Error handling coupon select:', error);
  }
}

/**
 * Handle scroll depth event (v20.5)
 * Tracks maximum scroll position (px) per page
 */
async function handleScrollDepth(event, clientIp) {
  const { visitor_id, session_id, timestamp, url, max_scroll_px, document_height, viewport_height } = event;
  const eventTime = new Date(timestamp);

  try {
    // Ensure visitor and session exist
    await repository.ensureVisitorExists(visitor_id, eventTime, clientIp);
    await repository.ensureSessionExists(session_id, visitor_id, eventTime, url, clientIp);

    // Insert scroll_depth event into events table with metadata
    await repository.insertEvent({
      session_id,
      visitor_id,
      event_type: 'scroll_depth',
      timestamp: eventTime,
      metadata: JSON.stringify({
        url,
        max_scroll_px: max_scroll_px || 0,
        document_height: document_height || 0,
        viewport_height: viewport_height || 0
      })
    });

    console.log(`[Track] Scroll depth: visitor=${visitor_id.substring(0, 8)}... | ${max_scroll_px}px / ${document_height}px`);
  } catch (error) {
    console.error('Error handling scroll depth:', error);
  }
}

module.exports = {
  handlePageview,
  handleEcommerceEvent,
  handleSessionEnd,
  handleCheckoutAttempt,
  handleHeartbeat,
  handleTrackerError,
  handleCouponSelect,
  handleScrollDepth
};
