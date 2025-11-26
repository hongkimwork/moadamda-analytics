/**
 * Cafe24 API Client
 * 
 * 레퍼런스: moadamda-access-log/src/core/cafe24.py
 * 
 * 주요 기능:
 * - getToken(): DB에서 토큰 조회, 만료 시 자동 갱신
 * - refreshToken(): Refresh Token으로 새 Access Token 발급 후 DB 저장
 * - getOrders(): 날짜 범위로 주문 목록 조회
 * - getOrderDetail(): 개별 주문 상세 조회
 */

const db = require('./database');

// 환경 변수
const CAFE24_AUTH_KEY = process.env.CAFE24_AUTH_KEY;
const CAFE24_MALL_ID = process.env.CAFE24_MALL_ID || 'moadamda';
const CAFE24_API_VERSION = process.env.CAFE24_API_VERSION || '2025-09-01';
const CAFE24_API_BASE = `https://${CAFE24_MALL_ID}.cafe24api.com/api/v2`;

/**
 * DB에서 최신 토큰 조회
 * 만료되었으면 자동 갱신
 */
async function getToken() {
  try {
    const result = await db.query(
      'SELECT * FROM cafe24_token ORDER BY idx DESC LIMIT 1'
    );
    
    if (result.rows.length === 0) {
      throw new Error('No Cafe24 token found in database. Please run initial token setup.');
    }
    
    const tokenRow = result.rows[0];
    const expireDate = new Date(tokenRow.expire_date);
    const now = new Date();
    
    // 만료 10분 전에 갱신 (안전 마진)
    const safeExpireDate = new Date(expireDate.getTime() - 10 * 60 * 1000);
    
    if (now >= safeExpireDate) {
      console.log('[Cafe24] Token expired or expiring soon, refreshing...');
      return await refreshToken(tokenRow.refresh_token);
    }
    
    return tokenRow.access_token;
  } catch (error) {
    console.error('[Cafe24] getToken error:', error.message);
    throw error;
  }
}

/**
 * Refresh Token으로 새 Access Token 발급
 */
async function refreshToken(refreshTokenValue) {
  try {
    const response = await fetch(`${CAFE24_API_BASE}/oauth/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${CAFE24_AUTH_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshTokenValue
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    
    // 새 토큰을 DB에 저장
    const expireDate = new Date(data.expires_at);
    
    await db.query(
      `INSERT INTO cafe24_token (access_token, refresh_token, issued_date, expire_date)
       VALUES ($1, $2, NOW(), $3)`,
      [data.access_token, data.refresh_token, expireDate]
    );
    
    console.log('[Cafe24] Token refreshed successfully, expires at:', data.expires_at);
    
    return data.access_token;
  } catch (error) {
    console.error('[Cafe24] refreshToken error:', error.message);
    throw error;
  }
}

/**
 * Cafe24 API 호출 공통 함수
 * Rate limit (429) 시 재시도
 */
async function callApi(endpoint, options = {}) {
  const maxRetries = 3;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const token = await getToken();
      
      const url = endpoint.startsWith('http') 
        ? endpoint 
        : `${CAFE24_API_BASE}${endpoint}`;
      
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Cafe24-Api-Version': CAFE24_API_VERSION,
          ...options.headers
        },
        body: options.body ? JSON.stringify(options.body) : undefined
      });
      
      // Rate limit 처리
      if (response.status === 429) {
        console.log('[Cafe24] Rate limited, waiting 3 seconds...');
        await sleep(3000);
        continue;
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API call failed: ${response.status} - ${errorText}`);
      }
      
      return await response.json();
    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw error;
      }
      console.log(`[Cafe24] Retry ${attempt + 1}/${maxRetries} after error:`, error.message);
      await sleep(1000);
    }
  }
}

/**
 * 주문 목록 조회
 * @param {string} startDate - 시작일 (YYYY-MM-DD)
 * @param {string} endDate - 종료일 (YYYY-MM-DD)
 * @param {number} limit - 조회 개수 (기본 100)
 * @param {number} offset - 오프셋 (기본 0)
 */
async function getOrders(startDate, endDate, limit = 100, offset = 0) {
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
    limit: limit.toString(),
    offset: offset.toString(),
    embed: 'items'
  });
  
  return await callApi(`/admin/orders?${params.toString()}`);
}

/**
 * 모든 주문 조회 (페이지네이션 처리)
 * @param {string} startDate - 시작일 (YYYY-MM-DD)
 * @param {string} endDate - 종료일 (YYYY-MM-DD)
 */
async function getAllOrders(startDate, endDate) {
  const allOrders = [];
  let offset = 0;
  const limit = 100;
  
  while (true) {
    const response = await getOrders(startDate, endDate, limit, offset);
    
    if (!response.orders || response.orders.length === 0) {
      break;
    }
    
    allOrders.push(...response.orders);
    
    // 다음 페이지가 없으면 종료
    if (response.orders.length < limit) {
      break;
    }
    
    offset += limit;
    
    // Rate limit 방지
    await sleep(500);
  }
  
  return allOrders;
}

/**
 * 개별 주문 상세 조회
 * @param {string} orderId - 주문번호
 */
async function getOrderDetail(orderId) {
  return await callApi(`/admin/orders/${orderId}?embed=items`);
}

/**
 * 구매자 정보 조회
 * @param {string} orderId - 주문번호
 */
async function getBuyerInfo(orderId) {
  return await callApi(`/admin/orders/${orderId}/buyer`);
}

/**
 * 회원 정보 조회
 * @param {string} memberId - 회원 ID
 */
async function getMemberInfo(memberId) {
  return await callApi(`/admin/customers?member_id=${memberId}`);
}

/**
 * 시간 + 상품 기반 visitor_id 매칭
 * 주문 시간 ±30분 내 동일 상품 add_to_cart 이벤트 검색
 * @param {Date} orderDate - 주문 시간
 * @param {number} productNo - 상품 번호
 * @returns {Object|null} { visitor_id, session_id } 또는 null
 */
async function findMatchingVisitor(orderDate, productNo) {
  try {
    // 주문 시간 ±30분 범위 계산
    const orderTime = new Date(orderDate);
    const startTime = new Date(orderTime.getTime() - 30 * 60 * 1000);
    const endTime = new Date(orderTime.getTime() + 30 * 60 * 1000);
    
    // 동일 상품을 add_to_cart한 visitor 검색
    const result = await db.query(
      `SELECT 
        e.visitor_id,
        e.session_id,
        e.timestamp,
        ABS(EXTRACT(EPOCH FROM (e.timestamp - $1::timestamp))) as time_diff_seconds
      FROM events e
      WHERE e.event_type = 'add_to_cart'
        AND e.product_id = $2
        AND e.timestamp BETWEEN $3 AND $4
      ORDER BY time_diff_seconds ASC
      LIMIT 1`,
      [orderTime, String(productNo), startTime, endTime]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const match = result.rows[0];
    console.log(`[Cafe24] Visitor matched: ${match.visitor_id} (time diff: ${Math.round(match.time_diff_seconds)}s)`);
    
    return {
      visitor_id: match.visitor_id,
      session_id: match.session_id
    };
  } catch (error) {
    console.error('[Cafe24] findMatchingVisitor error:', error.message);
    return null;
  }
}

/**
 * 현재 토큰 정보 조회 (디버깅용)
 */
async function getTokenInfo() {
  const result = await db.query(
    'SELECT idx, issued_date, expire_date, created_at FROM cafe24_token ORDER BY idx DESC LIMIT 1'
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const tokenRow = result.rows[0];
  const now = new Date();
  const expireDate = new Date(tokenRow.expire_date);
  
  return {
    idx: tokenRow.idx,
    issued_date: tokenRow.issued_date,
    expire_date: tokenRow.expire_date,
    created_at: tokenRow.created_at,
    is_expired: now >= expireDate,
    expires_in_minutes: Math.round((expireDate - now) / 60000)
  };
}

/**
 * 토큰 갱신 태스크 (서버 시작 시 호출)
 * 1시간마다 토큰 갱신
 */
function startTokenRefreshTask() {
  console.log('[Cafe24] Starting token refresh background task');
  
  // 즉시 한 번 체크
  getToken().then(token => {
    console.log('[Cafe24] Initial token check completed');
  }).catch(err => {
    console.error('[Cafe24] Initial token check failed:', err.message);
  });
  
  // 1시간마다 갱신
  const REFRESH_INTERVAL = 60 * 60 * 1000; // 1시간
  
  setInterval(async () => {
    try {
      await getToken();
      console.log('[Cafe24] Scheduled token refresh completed');
    } catch (error) {
      console.error('[Cafe24] Scheduled token refresh failed:', error.message);
    }
  }, REFRESH_INTERVAL);
}

/**
 * 주문 자동 동기화 실행
 * 오늘 날짜 기준으로 누락된 주문 동기화 + visitor_id 매칭
 */
async function syncOrders() {
  try {
    const today = new Date();
    const startDate = today.toISOString().split('T')[0];
    const endDate = startDate;
    
    console.log(`[Cafe24 Auto Sync] Starting sync for ${startDate}`);
    
    // Cafe24에서 주문 가져오기
    const cafe24Orders = await getAllOrders(startDate, endDate);
    console.log(`[Cafe24 Auto Sync] Fetched ${cafe24Orders.length} orders from Cafe24`);
    
    if (cafe24Orders.length === 0) {
      console.log('[Cafe24 Auto Sync] No orders to sync');
      return { synced: 0, matched: 0 };
    }
    
    // 기존 conversions에서 해당 기간의 order_id 조회
    const existingResult = await db.query(
      `SELECT order_id FROM conversions 
       WHERE timestamp >= $1::date AND timestamp < $1::date + INTERVAL '1 day'
       AND order_id IS NOT NULL`,
      [startDate]
    );
    
    const existingOrderIds = new Set(existingResult.rows.map(r => r.order_id));
    
    // 누락된 주문 찾기 (결제 완료된 주문만)
    const missingOrders = cafe24Orders.filter(order => 
      !existingOrderIds.has(order.order_id) && 
      order.paid === 'T'
    );
    
    console.log(`[Cafe24 Auto Sync] Found ${missingOrders.length} missing orders`);
    
    let syncedCount = 0;
    let matchedCount = 0;
    
    for (const order of missingOrders) {
      try {
        // 결제 금액 계산
        const totalAmount = Math.round(parseFloat(order.actual_order_amount?.total_order_amount || order.order_amount || 0));
        const finalPayment = Math.round(parseFloat(order.actual_order_amount?.payment_amount || 0));
        const discountAmount = Math.round(parseFloat(order.actual_order_amount?.total_discount_amount || 0));
        const mileageUsed = Math.round(parseFloat(order.actual_order_amount?.mileage_spent_amount || 0));
        const shippingFee = Math.round(parseFloat(order.actual_order_amount?.shipping_fee || 0));
        
        // visitor_id 매칭 시도
        let visitorId = null;
        let sessionId = null;
        let productName = null;
        
        if (order.items && order.items.length > 0) {
          const productNo = order.items[0].product_no;
          productName = order.items[0].product_name || null;
          const match = await findMatchingVisitor(order.order_date, productNo);
          if (match) {
            visitorId = match.visitor_id;
            sessionId = match.session_id;
            matchedCount++;
          }
        }
        
        // conversions 테이블에 INSERT (product_name 포함)
        await db.query(
          `INSERT INTO conversions (
            visitor_id, session_id, order_id, total_amount, final_payment, 
            product_count, timestamp, discount_amount, mileage_used, 
            shipping_fee, order_status, synced_at, product_name
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12
          )
          ON CONFLICT (order_id) DO NOTHING`,
          [
            visitorId,
            sessionId,
            order.order_id,
            totalAmount,
            finalPayment,
            order.items?.length || 1,
            new Date(order.order_date),
            discountAmount,
            mileageUsed,
            shippingFee,
            'confirmed',
            productName
          ]
        );
        
        syncedCount++;
      } catch (insertError) {
        console.error(`[Cafe24 Auto Sync] Failed to insert order ${order.order_id}:`, insertError.message);
      }
    }
    
    console.log(`[Cafe24 Auto Sync] Synced ${syncedCount} orders, matched ${matchedCount} visitors`);
    return { synced: syncedCount, matched: matchedCount };
    
  } catch (error) {
    console.error('[Cafe24 Auto Sync] Error:', error.message);
    return { synced: 0, matched: 0, error: error.message };
  }
}

/**
 * 기존 synced 주문들의 visitor_id 일괄 매칭
 * synced_at이 있고 visitor_id가 NULL인 주문들 대상
 */
async function backfillVisitorIds() {
  try {
    console.log('[Cafe24 Backfill] Starting visitor_id backfill...');
    
    // synced_at이 있고 visitor_id가 NULL인 주문들 조회
    const ordersResult = await db.query(
      `SELECT order_id, timestamp 
       FROM conversions 
       WHERE synced_at IS NOT NULL 
         AND (visitor_id IS NULL OR visitor_id = '')
       ORDER BY timestamp DESC`
    );
    
    if (ordersResult.rows.length === 0) {
      console.log('[Cafe24 Backfill] No orders need backfill');
      return { total: 0, matched: 0, updated: 0 };
    }
    
    console.log(`[Cafe24 Backfill] Found ${ordersResult.rows.length} orders to backfill`);
    
    let matchedCount = 0;
    let updatedCount = 0;
    
    for (const order of ordersResult.rows) {
      try {
        // Cafe24 API에서 주문 상세 조회하여 상품 정보 가져오기
        const orderDetail = await getOrderDetail(order.order_id);
        
        if (!orderDetail.order || !orderDetail.order.items || orderDetail.order.items.length === 0) {
          continue;
        }
        
        const productNo = orderDetail.order.items[0].product_no;
        const orderDate = orderDetail.order.order_date;
        
        // visitor_id 매칭 시도
        const match = await findMatchingVisitor(orderDate, productNo);
        
        if (match) {
          matchedCount++;
          
          // UPDATE 쿼리
          const updateResult = await db.query(
            `UPDATE conversions 
             SET visitor_id = $1, session_id = $2
             WHERE order_id = $3 AND (visitor_id IS NULL OR visitor_id = '')`,
            [match.visitor_id, match.session_id, order.order_id]
          );
          
          if (updateResult.rowCount > 0) {
            updatedCount++;
            console.log(`[Cafe24 Backfill] Updated ${order.order_id} -> ${match.visitor_id.substring(0, 8)}...`);
          }
        }
        
        // Rate limit 방지
        await sleep(300);
        
      } catch (orderError) {
        console.error(`[Cafe24 Backfill] Error processing ${order.order_id}:`, orderError.message);
      }
    }
    
    console.log(`[Cafe24 Backfill] Completed: ${matchedCount} matched, ${updatedCount} updated out of ${ordersResult.rows.length}`);
    
    return {
      total: ordersResult.rows.length,
      matched: matchedCount,
      updated: updatedCount
    };
    
  } catch (error) {
    console.error('[Cafe24 Backfill] Error:', error.message);
    return { total: 0, matched: 0, updated: 0, error: error.message };
  }
}

/**
 * 기존 주문들의 상품명 일괄 업데이트
 * product_name이 NULL인 주문들 대상으로 Cafe24 API에서 상품명 조회하여 UPDATE
 */
async function backfillProductNames() {
  try {
    console.log('[Cafe24 Product Backfill] Starting product_name backfill...');
    
    // product_name이 NULL인 주문들 조회
    const ordersResult = await db.query(
      `SELECT order_id 
       FROM conversions 
       WHERE product_name IS NULL
       ORDER BY timestamp DESC`
    );
    
    if (ordersResult.rows.length === 0) {
      console.log('[Cafe24 Product Backfill] No orders need product name update');
      return { total: 0, updated: 0 };
    }
    
    console.log(`[Cafe24 Product Backfill] Found ${ordersResult.rows.length} orders to update`);
    
    let updatedCount = 0;
    let errorCount = 0;
    
    // 배치 처리 (Rate limit 고려)
    for (let i = 0; i < ordersResult.rows.length; i++) {
      const order = ordersResult.rows[i];
      
      try {
        // Cafe24 API에서 주문 상세 조회
        const orderDetail = await getOrderDetail(order.order_id);
        
        if (orderDetail.order && orderDetail.order.items && orderDetail.order.items.length > 0) {
          const productName = orderDetail.order.items[0].product_name;
          
          if (productName) {
            await db.query(
              `UPDATE conversions SET product_name = $1 WHERE order_id = $2`,
              [productName, order.order_id]
            );
            updatedCount++;
            
            // 진행 상황 로그 (100개마다)
            if (updatedCount % 100 === 0) {
              console.log(`[Cafe24 Product Backfill] Progress: ${updatedCount}/${ordersResult.rows.length}`);
            }
          }
        }
        
        // Rate limit 방지 (200ms 대기)
        await sleep(200);
        
      } catch (orderError) {
        errorCount++;
        // 에러는 조용히 처리 (로그만 남김)
        if (errorCount <= 5) {
          console.error(`[Cafe24 Product Backfill] Error ${order.order_id}:`, orderError.message);
        }
      }
    }
    
    console.log(`[Cafe24 Product Backfill] Completed: ${updatedCount} updated, ${errorCount} errors out of ${ordersResult.rows.length}`);
    
    return {
      total: ordersResult.rows.length,
      updated: updatedCount,
      errors: errorCount
    };
    
  } catch (error) {
    console.error('[Cafe24 Product Backfill] Error:', error.message);
    return { total: 0, updated: 0, error: error.message };
  }
}

/**
 * 자동 동기화 스케줄러 시작
 * 1시간마다 오늘 주문 동기화 실행
 */
function startAutoSyncTask() {
  console.log('[Cafe24] Starting auto sync background task');
  
  // 서버 시작 5분 후 첫 동기화 (서버 안정화 대기)
  setTimeout(async () => {
    console.log('[Cafe24] Running initial auto sync...');
    await syncOrders();
  }, 5 * 60 * 1000);
  
  // 1시간마다 동기화
  const SYNC_INTERVAL = 60 * 60 * 1000; // 1시간
  
  setInterval(async () => {
    console.log('[Cafe24] Running scheduled auto sync...');
    await syncOrders();
  }, SYNC_INTERVAL);
}

// 유틸리티 함수
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  getToken,
  refreshToken,
  callApi,
  getOrders,
  getAllOrders,
  getOrderDetail,
  getBuyerInfo,
  getMemberInfo,
  getTokenInfo,
  findMatchingVisitor,
  syncOrders,
  backfillVisitorIds,
  backfillProductNames,
  startTokenRefreshTask,
  startAutoSyncTask,
  CAFE24_MALL_ID,
  CAFE24_API_VERSION
};

