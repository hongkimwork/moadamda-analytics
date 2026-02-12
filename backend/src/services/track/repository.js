/**
 * Track Repository Layer
 * DB 접근을 담당하는 레이어 - 모든 SQL 쿼리는 여기서 관리
 */

const db = require('../../utils/database');
const { detectBot } = require('./utils');

/**
 * Upsert visitor (create or update)
 * @param {Object} params - Visitor parameters
 */
async function upsertVisitor({
  visitor_id,
  visitTime,
  device_type,
  browser,
  os,
  utm_source,
  utm_medium,
  utm_campaign,
  utm_params,
  clientIp,
  userAgent = '',
  browser_fingerprint = null,
  member_id_crypt = null
}) {
  // is_bot 판단: IP 대역 + User-Agent 패턴 + Unknown 브라우저/OS (카페24 호환)
  const isBot = detectBot(clientIp, userAgent, browser, os);

  await db.query(`
    INSERT INTO visitors (
      visitor_id, first_visit, last_visit, device_type, 
      browser, os, utm_source, utm_medium, utm_campaign,
      utm_params, ip_address, last_ip, is_bot,
      browser_fingerprint, member_id_crypt
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    ON CONFLICT (visitor_id) DO UPDATE SET
      last_visit = $3,
      visit_count = visitors.visit_count + 1,
      utm_params = $10,
      last_ip = $12,
      is_bot = $13,
      browser_fingerprint = COALESCE(EXCLUDED.browser_fingerprint, visitors.browser_fingerprint),
      member_id_crypt = COALESCE(EXCLUDED.member_id_crypt, visitors.member_id_crypt)
  `, [
    visitor_id, visitTime, visitTime, device_type,
    browser, os,
    utm_source, utm_medium, utm_campaign,
    utm_params ? JSON.stringify(utm_params) : null,
    clientIp, clientIp, isBot,
    browser_fingerprint || null, member_id_crypt || null
  ]);
}

/**
 * Upsert session (create or update)
 * FIX (2026-02-05): 서버 사이드 세션 타임아웃 검증 추가
 * - 마지막 활동으로부터 2시간 초과 시 세션 리셋 (start_time 갱신)
 * - Android Chrome에서 쿠키 만료가 작동하지 않는 문제 대응
 * @param {Object} params - Session parameters
 */
const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2시간 (밀리초)

async function upsertSession({
  session_id,
  visitor_id,
  visitTime,
  url,
  clientIp,
  utm_params
}) {
  // 기존 세션 확인 (타임아웃 검증용)
  const existingSession = await db.query(`
    SELECT session_id, end_time, start_time 
    FROM sessions 
    WHERE session_id = $1
  `, [session_id]);

  if (existingSession.rows.length > 0) {
    const lastActivity = existingSession.rows[0].end_time || existingSession.rows[0].start_time;
    const visitDate = new Date(visitTime);
    const lastDate = new Date(lastActivity);
    const timeDiff = visitDate - lastDate;

    // 2시간 초과 시 세션 리셋 (새 세션처럼 처리)
    if (timeDiff > SESSION_TIMEOUT_MS) {
      console.warn(`[Track] Session timeout detected: session=${session_id.substring(0, 8)}... | last_activity=${lastDate.toISOString()} | current=${visitDate.toISOString()} | gap=${Math.round(timeDiff / 1000 / 60)}min`);
      
      // 세션 리셋: start_time을 현재 시간으로 갱신, pageview_count 리셋
      await db.query(`
        UPDATE sessions SET
          start_time = $2,
          end_time = $2,
          entry_url = $3,
          exit_url = $3,
          pageview_count = 1,
          duration_seconds = 0,
          ip_address = $4,
          utm_params = $5
        WHERE session_id = $1
      `, [session_id, visitTime, url, clientIp, utm_params ? JSON.stringify(utm_params) : null]);
      return;
    }
  }

  // 일반적인 upsert (새 세션 생성 또는 기존 세션 업데이트)
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
}

/**
 * Insert pageview record
 */
async function insertPageview({
  session_id,
  visitor_id,
  url,
  title,
  timestamp
}) {
  // site_version 결정: URL 기준 (카페24 방식)
  const siteVersion = (url && (url.includes('m.moadamda') || url.includes('/m/'))) 
    ? 'mobile' 
    : 'pc';

  await db.query(`
    INSERT INTO pageviews (
      session_id, visitor_id, page_url, page_title, timestamp, site_version
    )
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [session_id, visitor_id, url, title, timestamp, siteVersion]);
}

/**
 * Update realtime visitors tracking
 */
async function updateRealtimeVisitor({
  visitor_id,
  url,
  timestamp,
  device_type
}) {
  await db.query(`
    INSERT INTO realtime_visitors (visitor_id, current_url, last_activity, device_type)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (visitor_id) DO UPDATE SET
      current_url = $2,
      last_activity = $3,
      device_type = $4
  `, [visitor_id, url, timestamp, device_type]);
}

/**
 * Update visitor's referrer type
 */
async function updateVisitorReferrer(visitor_id, referrerType) {
  await db.query(`
    UPDATE visitors SET referrer_type = $1 WHERE visitor_id = $2
  `, [referrerType, visitor_id]);
}

/**
 * Ensure visitor exists (for ecommerce/checkout events)
 * Creates minimal visitor record if not exists
 */
async function ensureVisitorExists(visitor_id, eventTime, clientIp) {
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
}

/**
 * Ensure session exists (for ecommerce/checkout events)
 * Creates minimal session record if not exists
 */
async function ensureSessionExists(session_id, visitor_id, eventTime, url, clientIp) {
  const sessionCheck = await db.query(`
    SELECT session_id FROM sessions WHERE session_id = $1
  `, [session_id]);

  if (sessionCheck.rows.length === 0) {
    await db.query(`
      INSERT INTO sessions (
        session_id, visitor_id, start_time, end_time,
        entry_url, exit_url, pageview_count, ip_address, duration_seconds
      )
      VALUES ($1, $2, $3, $4, $5, $6, 0, $7, 0)
      ON CONFLICT (session_id) DO NOTHING
    `, [session_id, visitor_id, eventTime, eventTime, url || '', url || '', clientIp || 'unknown']);
  }
}

/**
 * Get visitor's UTM information for attribution
 */
async function getVisitorUtm(visitor_id) {
  const result = await db.query(`
    SELECT utm_source, utm_medium, utm_campaign
    FROM visitors
    WHERE visitor_id = $1
  `, [visitor_id]);

  return result.rows[0] || {};
}

/**
 * Insert conversion record (purchase)
 */
async function upsertConversion(conversionData) {
  const {
    session_id, visitor_id, order_id, total_amount,
    product_count, timestamp, discount_amount,
    mileage_used, shipping_fee, final_payment,
    utm_source, utm_campaign, paid, product_name,
    points_spent, credits_spent, order_place_name,
    payment_method_name, cafe24_status, canceled, order_status,
    member_id, first_order
  } = conversionData;

  await db.query(`
    INSERT INTO conversions (
      session_id, visitor_id, order_id, total_amount, 
      product_count, timestamp, discount_amount, 
      mileage_used, shipping_fee, final_payment,
      utm_source, utm_campaign, paid, product_name, synced_at,
      points_spent, credits_spent, order_place_name, payment_method_name,
      cafe24_status, canceled, order_status, member_id, first_order
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(),
            $15, $16, $17, $18, $19, $20, $21, $22, $23)
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
      points_spent = EXCLUDED.points_spent,
      credits_spent = EXCLUDED.credits_spent,
      order_place_name = EXCLUDED.order_place_name,
      payment_method_name = EXCLUDED.payment_method_name,
      cafe24_status = EXCLUDED.cafe24_status,
      canceled = EXCLUDED.canceled,
      order_status = EXCLUDED.order_status,
      member_id = COALESCE(EXCLUDED.member_id, conversions.member_id),
      first_order = COALESCE(EXCLUDED.first_order, conversions.first_order),
      synced_at = NOW()
  `, [
    session_id, visitor_id, order_id, total_amount,
    product_count, timestamp,
    discount_amount, mileage_used, shipping_fee, final_payment,
    utm_source, utm_campaign, paid, product_name,
    points_spent, credits_spent, order_place_name, payment_method_name,
    cafe24_status, canceled, order_status, member_id || null, first_order || null
  ]);
}

/**
 * Mark session as converted and update duration
 */
async function markSessionConverted(session_id, eventTime) {
  await db.query(`
    UPDATE sessions 
    SET 
      is_converted = true,
      end_time = $2,
      duration_seconds = EXTRACT(EPOCH FROM ($2 - start_time))::INTEGER
    WHERE session_id = $1
  `, [session_id, eventTime]);
}

/**
 * Insert event record (ecommerce events, checkout_attempt, coupon_select)
 */
async function insertEvent(eventData) {
  const {
    session_id,
    visitor_id,
    event_type,
    timestamp,
    product_id,
    product_name,
    product_price,
    quantity,
    metadata
  } = eventData;

  await db.query(`
    INSERT INTO events (
      session_id, visitor_id, event_type, product_id, 
      product_name, product_price, quantity, timestamp, metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `, [
    session_id, visitor_id, event_type, product_id,
    product_name, product_price, quantity, timestamp, metadata
  ]);
}

/**
 * Update session end time and duration
 */
async function updateSessionEnd(session_id, endTime) {
  await db.query(`
    UPDATE sessions
    SET 
      end_time = $1,
      duration_seconds = EXTRACT(EPOCH FROM ($1 - start_time))::INTEGER
    WHERE session_id = $2
  `, [endTime, session_id]);
}

module.exports = {
  upsertVisitor,
  upsertSession,
  insertPageview,
  updateRealtimeVisitor,
  updateVisitorReferrer,
  ensureVisitorExists,
  ensureSessionExists,
  getVisitorUtm,
  upsertConversion,
  markSessionConverted,
  insertEvent,
  updateSessionEnd
};
