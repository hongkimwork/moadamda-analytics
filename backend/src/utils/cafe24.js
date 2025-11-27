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
 * 주문 동기화 핵심 로직 (공통 함수)
 * 자동 스케줄러와 수동 API 모두 이 함수를 사용
 * 
 * @param {string} startDate - 시작일 (YYYY-MM-DD)
 * @param {string} endDate - 종료일 (YYYY-MM-DD)
 * @param {Object} options - 옵션
 * @param {boolean} options.dryRun - true면 실제 저장 안하고 결과만 반환
 * @returns {Object} 동기화 결과
 */
async function syncOrdersForRange(startDate, endDate, options = {}) {
  const { dryRun = false } = options;
  const logPrefix = '[Cafe24 Sync]';
  
  try {
    console.log(`${logPrefix} Starting sync from ${startDate} to ${endDate}${dryRun ? ' (DRY RUN)' : ''}`);
    
    // Cafe24에서 주문 가져오기
    const cafe24Orders = await getAllOrders(startDate, endDate);
    console.log(`${logPrefix} Fetched ${cafe24Orders.length} orders from Cafe24`);
    
    if (cafe24Orders.length === 0) {
      console.log(`${logPrefix} No orders to sync`);
      return { synced: 0, matched: 0, updated: 0, total: 0 };
    }
    
    // 기존 conversions에서 해당 기간의 order_id와 visitor_id 조회
    const existingResult = await db.query(
      `SELECT order_id, visitor_id, session_id FROM conversions 
       WHERE timestamp >= $1::date AND timestamp < $2::date + INTERVAL '1 day'
       AND order_id IS NOT NULL`,
      [startDate, endDate]
    );
    
    // 기존 주문의 visitor_id 매핑 (visitor_id가 있는 경우 보존용)
    const existingOrderMap = new Map();
    for (const row of existingResult.rows) {
      existingOrderMap.set(row.order_id, {
        visitor_id: row.visitor_id,
        session_id: row.session_id
      });
    }
    
    console.log(`${logPrefix} Found ${existingOrderMap.size} existing orders in conversions`);
    
    // dry_run 모드: 실제 저장 없이 결과만 반환
    if (dryRun) {
      const newOrders = cafe24Orders.filter(o => !existingOrderMap.has(o.order_id));
      return {
        dryRun: true,
        total: cafe24Orders.length,
        existing: existingOrderMap.size,
        newOrders: newOrders.length,
        toUpdate: existingOrderMap.size,
        newOrderIds: newOrders.map(o => o.order_id)
      };
    }
    
    let syncedCount = 0;
    let matchedCount = 0;
    let updatedCount = 0;
    
    // 모든 Cafe24 주문에 대해 UPSERT 실행
    for (const order of cafe24Orders) {
      try {
        // 결제 금액 계산 (Cafe24 API 값 사용)
        const totalAmount = Math.round(parseFloat(order.actual_order_amount?.total_order_amount || order.order_amount || 0));
        const finalPayment = Math.round(parseFloat(order.actual_order_amount?.payment_amount || 0));
        const discountAmount = Math.round(parseFloat(order.actual_order_amount?.total_discount_amount || 0));
        const mileageUsed = Math.round(parseFloat(order.actual_order_amount?.mileage_spent_amount || 0));
        const shippingFee = Math.round(parseFloat(order.actual_order_amount?.shipping_fee || 0));
        const productName = order.items?.[0]?.product_name || null;
        const paid = order.paid || 'T';
        
        // 기존 주문 여부 확인
        const existingOrder = existingOrderMap.get(order.order_id);
        const isNewOrder = !existingOrder;
        
        let visitorId = null;
        let sessionId = null;
        
        if (isNewOrder) {
          // 새 주문: visitor_id 매칭 시도
          if (order.items && order.items.length > 0) {
            const productNo = order.items[0].product_no;
            const match = await findMatchingVisitor(order.order_date, productNo);
            if (match) {
              visitorId = match.visitor_id;
              sessionId = match.session_id;
              matchedCount++;
            }
          }
        } else {
          // 기존 주문: visitor_id 유지
          visitorId = existingOrder.visitor_id;
          sessionId = existingOrder.session_id;
        }
        
        // 실제 구매 상품 수 계산 (각 항목의 quantity 합산)
        const productCount = order.items?.reduce((sum, item) => sum + (parseInt(item.quantity) || 1), 0) || 1;
        
        // conversions 테이블에 UPSERT
        // - 새 주문: 전체 데이터 저장
        // - 기존 주문: visitor_id 유지, 결제 정보는 Cafe24 값으로 업데이트
        await db.query(
          `INSERT INTO conversions (
            visitor_id, session_id, order_id, total_amount, final_payment, 
            product_count, timestamp, discount_amount, mileage_used, 
            shipping_fee, order_status, synced_at, product_name, paid
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12, $13
          )
          ON CONFLICT (order_id) DO UPDATE SET
            paid = EXCLUDED.paid,
            final_payment = EXCLUDED.final_payment,
            total_amount = EXCLUDED.total_amount,
            product_count = EXCLUDED.product_count,
            discount_amount = EXCLUDED.discount_amount,
            mileage_used = EXCLUDED.mileage_used,
            shipping_fee = EXCLUDED.shipping_fee,
            product_name = COALESCE(EXCLUDED.product_name, conversions.product_name),
            synced_at = NOW()`,
          [
            visitorId,
            sessionId,
            order.order_id,
            totalAmount,
            finalPayment,
            productCount,
            new Date(order.order_date),
            discountAmount,
            mileageUsed,
            shippingFee,
            'confirmed',
            productName,
            paid
          ]
        );
        
        if (isNewOrder) {
          syncedCount++;
        } else {
          updatedCount++;
        }
        
      } catch (insertError) {
        console.error(`${logPrefix} Failed to process order ${order.order_id}:`, insertError.message);
      }
    }
    
    console.log(`${logPrefix} Completed: ${syncedCount} new, ${updatedCount} updated, ${matchedCount} matched`);
    return { 
      synced: syncedCount, 
      matched: matchedCount, 
      updated: updatedCount,
      total: cafe24Orders.length,
      existing: existingOrderMap.size
    };
    
  } catch (error) {
    console.error(`${logPrefix} Error:`, error.message);
    return { synced: 0, matched: 0, updated: 0, error: error.message };
  }
}

/**
 * 주문 자동 동기화 실행 (스케줄러용)
 * 오늘 날짜 기준으로 syncOrdersForRange() 호출
 */
async function syncOrders() {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  console.log(`[Cafe24 Auto Sync] Running for ${todayStr}`);
  return await syncOrdersForRange(todayStr, todayStr);
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
 * 입금 대기(paid='F') 주문들의 결제 상태 업데이트
 * Cafe24 API로 각 주문의 paid 상태를 확인하여 입금 완료된 주문 업데이트
 */
async function updatePendingPayments() {
  try {
    console.log('[Cafe24 Pending] Starting pending payments update...');
    
    // DB에서 paid='F'인 주문들 조회
    const pendingResult = await db.query(
      `SELECT order_id, timestamp 
       FROM conversions 
       WHERE paid = 'F'
       ORDER BY timestamp DESC`
    );
    
    if (pendingResult.rows.length === 0) {
      console.log('[Cafe24 Pending] No pending orders found');
      return { total: 0, updated: 0 };
    }
    
    console.log(`[Cafe24 Pending] Found ${pendingResult.rows.length} pending orders`);
    
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const order of pendingResult.rows) {
      try {
        // Cafe24 API에서 주문 상태 조회
        const orderDetail = await getOrderDetail(order.order_id);
        
        if (!orderDetail.order) {
          continue;
        }
        
        const cafe24Order = orderDetail.order;
        
        // 입금 완료된 경우 (paid='T')
        if (cafe24Order.paid === 'T') {
          const finalPayment = Math.round(parseFloat(cafe24Order.actual_order_amount?.payment_amount || 0));
          const totalAmount = Math.round(parseFloat(cafe24Order.actual_order_amount?.total_order_amount || cafe24Order.order_amount || 0));
          
          // DB 업데이트
          await db.query(
            `UPDATE conversions 
             SET paid = 'T', 
                 final_payment = $1,
                 total_amount = $2
             WHERE order_id = $3`,
            [finalPayment, totalAmount, order.order_id]
          );
          
          updatedCount++;
          console.log(`[Cafe24 Pending] Updated ${order.order_id}: paid=T, final_payment=${finalPayment}`);
        }
        
        // Rate limit 방지
        await sleep(300);
        
      } catch (orderError) {
        errorCount++;
        console.error(`[Cafe24 Pending] Error processing ${order.order_id}:`, orderError.message);
      }
    }
    
    console.log(`[Cafe24 Pending] Completed: ${updatedCount} updated, ${errorCount} errors out of ${pendingResult.rows.length}`);
    
    return {
      total: pendingResult.rows.length,
      updated: updatedCount,
      errors: errorCount
    };
    
  } catch (error) {
    console.error('[Cafe24 Pending] Error:', error.message);
    return { total: 0, updated: 0, error: error.message };
  }
}

/**
 * 자동 동기화 스케줄러 시작
 * 10분마다 오늘 주문 동기화 + 입금대기 주문 상태 업데이트 실행
 */
function startAutoSyncTask() {
  console.log('[Cafe24] Starting auto sync background task (10min interval)');
  
  // 서버 시작 2분 후 첫 동기화 (서버 안정화 대기)
  setTimeout(async () => {
    console.log('[Cafe24] Running initial auto sync...');
    await syncOrders();
    await updatePendingPayments();
  }, 2 * 60 * 1000);
  
  // 10분마다 동기화
  const SYNC_INTERVAL = 10 * 60 * 1000; // 10분
  
  setInterval(async () => {
    console.log('[Cafe24] Running scheduled auto sync...');
    await syncOrders();
    // 입금대기(paid=F) 주문들의 결제 상태도 업데이트
    await updatePendingPayments();
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
  syncOrdersForRange,
  backfillVisitorIds,
  backfillProductNames,
  updatePendingPayments,
  startTokenRefreshTask,
  startAutoSyncTask,
  CAFE24_MALL_ID,
  CAFE24_API_VERSION
};

