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
    utm_params
  } = event;

  const visitTime = new Date(timestamp);

  // 1. Upsert visitor (with IP tracking + dynamic UTM support)
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
    clientIp
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
      product_name
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
    product_name
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
        
        console.log(`[Track] Cafe24 API verified order ${order_id}: paid=${actualPaid}, final_payment=${actualFinalPayment}, points=${actualPointsSpent}`);
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
    order_status: actualOrderStatus
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

module.exports = {
  handlePageview,
  handleEcommerceEvent,
  handleSessionEnd,
  handleCheckoutAttempt,
  handleHeartbeat,
  handleTrackerError,
  handleCouponSelect
};
