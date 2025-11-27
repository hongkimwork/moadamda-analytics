const express = require('express');
const router = express.Router();
const db = require('../utils/database');

// Cafe24 API client (for real-time order verification)
let cafe24 = null;
if (process.env.CAFE24_AUTH_KEY) {
  cafe24 = require('../utils/cafe24');
}

// Helper: Extract client IP address (supports proxies like Cloudflare)
function getClientIp(req) {
  // Try x-forwarded-for (Cloudflare, Nginx, etc.)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  // Try x-real-ip
  if (req.headers['x-real-ip']) {
    return req.headers['x-real-ip'];
  }
  
  // Fallback to connection remote address
  return req.connection?.remoteAddress 
    || req.socket?.remoteAddress 
    || 'unknown';
}

// POST /api/track - Main tracking endpoint
router.post('/track', async (req, res) => {
  try {
    const { site_id, events } = req.body;

    if (!events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'Invalid request: events array required' });
    }

    // Extract client IP once for all events in this request
    const clientIp = getClientIp(req);

    // Process each event
    for (const event of events) {
      await processEvent(event, clientIp);
    }

    res.json({ success: true, processed: events.length });
  } catch (error) {
    console.error('Track error:', error);
    res.status(500).json({ error: 'Failed to process tracking data' });
  }
});

async function processEvent(event, clientIp) {
  const { type, visitor_id, session_id } = event;

  switch (type) {
    case 'pageview':
      await handlePageview(event, clientIp);
      break;
    case 'view_product':
    case 'add_to_cart':
    case 'checkout':
    case 'purchase':
      await handleEcommerceEvent(event, clientIp);
      break;
    case 'session_end':
      await handleSessionEnd(event);
      break;
    default:
      console.warn('Unknown event type:', type);
  }
}

async function handlePageview(event, clientIp) {
  const {
    visitor_id,
    session_id,
    url,
    title,
    referrer,
    timestamp,
    device_type,
    screen_width,
    screen_height,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_params  // 새로 추가: 모든 UTM 파라미터를 담은 객체
  } = event;

  const visitTime = new Date(timestamp);

  // 1. Upsert visitor (with IP tracking + dynamic UTM support)
  const browserInfo = parseBrowserInfo(event);
  
  await db.query(`
    INSERT INTO visitors (
      visitor_id, first_visit, last_visit, device_type, 
      browser, os, utm_source, utm_medium, utm_campaign,
      utm_params, ip_address, last_ip
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (visitor_id) DO UPDATE SET
      last_visit = $3,
      visit_count = visitors.visit_count + 1,
      utm_params = $10,
      last_ip = $12
  `, [
    visitor_id, visitTime, visitTime, device_type,
    browserInfo.browser, browserInfo.os,
    utm_source, utm_medium, utm_campaign,
    utm_params ? JSON.stringify(utm_params) : null,  // JSONB로 저장
    clientIp, clientIp
  ]);

  // 2. Upsert session (with IP tracking + auto-calculate duration_seconds + dynamic UTM)
  await db.query(`
    INSERT INTO sessions (
      session_id, visitor_id, start_time, entry_url, pageview_count, ip_address, utm_params
    )
    VALUES ($1, $2, $3, $4, 1, $5, $6)
    ON CONFLICT (session_id) DO UPDATE SET
      end_time = $3,
      exit_url = $4,
      pageview_count = sessions.pageview_count + 1,
      duration_seconds = EXTRACT(EPOCH FROM ($3 - sessions.start_time))::INTEGER
  `, [session_id, visitor_id, visitTime, url, clientIp, utm_params ? JSON.stringify(utm_params) : null]);

  // 3. Insert pageview
  await db.query(`
    INSERT INTO pageviews (
      session_id, visitor_id, page_url, page_title, timestamp
    )
    VALUES ($1, $2, $3, $4, $5)
  `, [session_id, visitor_id, url, title, visitTime]);

  // 4. Update realtime visitors
  await db.query(`
    INSERT INTO realtime_visitors (visitor_id, current_url, last_activity, device_type)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (visitor_id) DO UPDATE SET
      current_url = $2,
      last_activity = $3,
      device_type = $4
  `, [visitor_id, url, visitTime, device_type]);

  // 5. Determine referrer type
  const referrerType = determineReferrerType(referrer);
  if (referrerType) {
    await db.query(`
      UPDATE visitors SET referrer_type = $1 WHERE visitor_id = $2
    `, [referrerType, visitor_id]);
  }

  // 6. Phase 4.4: Track UTM session history for multi-touch attribution (with dynamic UTM support)
  if (utm_source || utm_medium || utm_campaign || utm_params) {
    await trackUtmSession({
      session_id,
      visitor_id,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_params,  // 새로 추가: 모든 UTM 파라미터 전달
      url,
      timestamp: visitTime
    });
  }
}

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
    // Phase 2.6: New payment detail fields
    discount_amount,
    mileage_used,
    shipping_fee,
    final_payment
  } = event;

  // Purchase event processing (logging removed for production)

  const eventTime = new Date(timestamp);

  // CRITICAL FIX: Ensure visitor and session exist before inserting events
  // This prevents foreign key constraint violations
  
  // 1. Check and create visitor if not exists
  const visitorCheck = await db.query(`
    SELECT visitor_id FROM visitors WHERE visitor_id = $1
  `, [visitor_id]);

  if (visitorCheck.rows.length === 0) {
    await db.query(`
      INSERT INTO visitors (
        visitor_id, first_visit, last_visit, visit_count,
        device_type, ip_address, last_ip
      )
      VALUES ($1, $2, $3, 1, 'unknown', $4, $5)
      ON CONFLICT (visitor_id) DO NOTHING
    `, [visitor_id, eventTime, eventTime, clientIp || 'unknown', clientIp || 'unknown']);
  }

  // 2. Check and create session if not exists
  const sessionCheck = await db.query(`
    SELECT session_id FROM sessions WHERE session_id = $1
  `, [session_id]);

  if (sessionCheck.rows.length === 0) {
    await db.query(`
      INSERT INTO sessions (
        session_id, visitor_id, start_time, end_time,
        entry_url, exit_url, pageview_count, ip_address, duration_seconds
      )
      VALUES ($1, $2, $3, $4, '', '', 0, $5, 0)
      ON CONFLICT (session_id) DO NOTHING
    `, [session_id, visitor_id, eventTime, eventTime, clientIp || 'unknown']);
  }

  if (event_type === 'purchase' && order_id) {
    // Phase 4.1: Get visitor's UTM information for attribution
    const visitorUtm = await db.query(`
      SELECT utm_source, utm_medium, utm_campaign
      FROM visitors
      WHERE visitor_id = $1
    `, [visitor_id]);

    const utm = visitorUtm.rows[0] || {};

    // === REAL-TIME CAFE24 API VERIFICATION ===
    // Fetch accurate payment info from Cafe24 API instead of using tracker's potentially inaccurate values
    let actualPaid = 'F';  // Default to unpaid
    let actualFinalPayment = 0;
    let actualTotalAmount = total_amount || 0;
    let actualDiscountAmount = discount_amount || 0;
    let actualMileageUsed = mileage_used || 0;
    let actualShippingFee = shipping_fee || 0;
    let actualProductCount = quantity || 1;
    let actualProductName = product_name || null;

    if (cafe24) {
      try {
        // Query Cafe24 API for accurate order information
        const cafe24OrderResponse = await cafe24.getOrderDetail(order_id);
        
        if (cafe24OrderResponse && cafe24OrderResponse.order) {
          const cafe24Order = cafe24OrderResponse.order;
          
          // Use Cafe24's accurate values
          actualPaid = cafe24Order.paid || 'F';
          actualFinalPayment = Math.round(parseFloat(cafe24Order.actual_order_amount?.payment_amount || 0));
          actualTotalAmount = Math.round(parseFloat(cafe24Order.actual_order_amount?.total_order_amount || cafe24Order.order_amount || 0));
          actualDiscountAmount = Math.round(parseFloat(cafe24Order.actual_order_amount?.total_discount_amount || 0));
          actualMileageUsed = Math.round(parseFloat(cafe24Order.actual_order_amount?.mileage_spent_amount || 0));
          actualShippingFee = Math.round(parseFloat(cafe24Order.actual_order_amount?.shipping_fee || 0));
          actualProductCount = cafe24Order.items?.length || 1;
          actualProductName = cafe24Order.items?.[0]?.product_name || product_name || null;
          
          console.log(`[Track] Cafe24 API verified order ${order_id}: paid=${actualPaid}, final_payment=${actualFinalPayment}`);
        }
      } catch (cafe24Error) {
        // Cafe24 API error - fall back to tracker values but mark as unverified
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
    await db.query(`
      INSERT INTO conversions (
        session_id, visitor_id, order_id, total_amount, 
        product_count, timestamp, discount_amount, 
        mileage_used, shipping_fee, final_payment,
        utm_source, utm_campaign, paid, product_name, synced_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
      ON CONFLICT (order_id) DO UPDATE SET
        visitor_id = COALESCE(conversions.visitor_id, EXCLUDED.visitor_id),
        session_id = COALESCE(conversions.session_id, EXCLUDED.session_id),
        total_amount = EXCLUDED.total_amount,
        discount_amount = EXCLUDED.discount_amount,
        mileage_used = EXCLUDED.mileage_used,
        shipping_fee = EXCLUDED.shipping_fee,
        final_payment = EXCLUDED.final_payment,
        paid = EXCLUDED.paid,
        product_name = COALESCE(EXCLUDED.product_name, conversions.product_name),
        utm_source = COALESCE(EXCLUDED.utm_source, conversions.utm_source),
        utm_campaign = COALESCE(EXCLUDED.utm_campaign, conversions.utm_campaign),
        synced_at = NOW()
    `, [
      session_id, visitor_id, order_id, actualTotalAmount,
      actualProductCount, eventTime,
      actualDiscountAmount,
      actualMileageUsed,
      actualShippingFee,
      actualFinalPayment,
      utm.utm_source || null,
      utm.utm_campaign || null,
      actualPaid,
      actualProductName
    ]);

    // Mark session as converted and update duration_seconds
    await db.query(`
      UPDATE sessions 
      SET 
        is_converted = true,
        end_time = $2,
        duration_seconds = EXTRACT(EPOCH FROM ($2 - start_time))::INTEGER
      WHERE session_id = $1
    `, [session_id, eventTime]);
  }

  // Insert into events table
  await db.query(`
    INSERT INTO events (
      session_id, visitor_id, event_type, product_id, 
      product_name, product_price, quantity, timestamp
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `, [
    session_id, visitor_id, event_type, product_id,
    product_name, product_price, quantity || 1, eventTime
  ]);
}

function parseBrowserInfo(event) {
  // Simple user agent parsing (can be enhanced)
  const ua = event.user_agent || '';
  
  let browser = 'Unknown';
  let os = 'Unknown';

  if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edge')) browser = 'Edge';

  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iOS')) os = 'iOS';
  else if (ua.includes('Linux')) os = 'Linux';

  return { browser, os };
}

function determineReferrerType(referrer) {
  if (!referrer || referrer === '') return 'direct';
  
  const ref = referrer.toLowerCase();
  
  if (ref.includes('google')) return 'search';
  if (ref.includes('naver')) return 'search';
  if (ref.includes('daum')) return 'search';
  if (ref.includes('facebook') || ref.includes('instagram')) return 'social';
  if (ref.includes('twitter') || ref.includes('linkedin')) return 'social';
  if (ref.includes('ad') || ref.includes('campaign')) return 'ad';
  
  return 'referral';
}

// Phase 4.4: Track UTM session history for multi-touch attribution (with dynamic UTM support)
async function trackUtmSession({ session_id, visitor_id, utm_source, utm_medium, utm_campaign, utm_params, url, timestamp }) {
  try {
    // Check if there's an existing UTM session for this visitor with same UTM params
    const existing = await db.query(`
      SELECT id, entry_timestamp, pageview_count
      FROM utm_sessions
      WHERE visitor_id = $1 
        AND session_id = $2
        AND utm_source = $3
        AND COALESCE(utm_medium, '') = COALESCE($4, '')
        AND COALESCE(utm_campaign, '') = COALESCE($5, '')
        AND exit_timestamp IS NULL
      ORDER BY entry_timestamp DESC
      LIMIT 1
    `, [visitor_id, session_id, utm_source, utm_medium, utm_campaign]);

    if (existing.rows.length > 0) {
      // Update existing UTM session: increase pageview count and update duration
      const utmSessionId = existing.rows[0].id;
      const entryTime = new Date(existing.rows[0].entry_timestamp);
      const durationSeconds = Math.floor((timestamp - entryTime) / 1000);

      await db.query(`
        UPDATE utm_sessions
        SET 
          exit_timestamp = $1,
          duration_seconds = $2,
          pageview_count = pageview_count + 1,
          utm_params = $4
        WHERE id = $3
      `, [timestamp, durationSeconds, utmSessionId, utm_params ? JSON.stringify(utm_params) : null]);
    } else {
      // Create new UTM session record
      // Calculate sequence order for this visitor
      const sequenceResult = await db.query(`
        SELECT COALESCE(MAX(sequence_order), 0) + 1 as next_order
        FROM utm_sessions
        WHERE visitor_id = $1
      `, [visitor_id]);

      const sequenceOrder = sequenceResult.rows[0].next_order;

      await db.query(`
        INSERT INTO utm_sessions (
          session_id, visitor_id, utm_source, utm_medium, utm_campaign,
          utm_params, page_url, entry_timestamp, sequence_order
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [session_id, visitor_id, utm_source, utm_medium, utm_campaign, 
          utm_params ? JSON.stringify(utm_params) : null, url, timestamp, sequenceOrder]);
    }
  } catch (error) {
    console.error('Error tracking UTM session:', error);
    // Don't throw error - UTM tracking failure shouldn't break pageview tracking
  }
}

// Handle session end event
async function handleSessionEnd(event) {
  const { visitor_id, session_id, timestamp } = event;
  const endTime = new Date(timestamp);

  try {
    // Close all open UTM sessions for this visitor/session
    await db.query(`
      UPDATE utm_sessions
      SET 
        exit_timestamp = $1,
        duration_seconds = EXTRACT(EPOCH FROM ($1 - entry_timestamp))::INTEGER
      WHERE visitor_id = $2
        AND session_id = $3
        AND exit_timestamp IS NULL
    `, [endTime, visitor_id, session_id]);

    // UTM sessions closed
  } catch (error) {
    console.error('Error handling session end:', error);
  }
}

module.exports = router;

