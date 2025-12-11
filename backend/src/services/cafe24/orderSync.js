/**
 * Cafe24 Order Synchronization
 * 주문 동기화, visitor 매칭, 백필 작업 담당
 */

const db = require('../../utils/database');
const { getOrderDetail, getAllOrders } = require('./tokenClient');
const { sleep, parseKSTTimestamp } = require('./utils');

const LOG_PREFIX = '[Cafe24 Sync]';
const BACKFILL_PREFIX = '[Cafe24 Backfill]';
const PRODUCT_PREFIX = '[Cafe24 Product Backfill]';
const PENDING_PREFIX = '[Cafe24 Pending]';

/**
 * 시간 + 상품 기반 visitor_id 매칭
 * 주문 시간 ±30분 내 동일 상품 add_to_cart 이벤트 검색
 * @param {string} orderDate - Cafe24 주문 시간 (예: "2025-12-03T07:20:54+09:00")
 * @param {number} productNo - 상품 번호
 * @returns {Object|null} { visitor_id, session_id } 또는 null
 */
async function findMatchingVisitor(orderDate, productNo) {
  try {
    // KST 시간을 그대로 추출하여 사용 (events 테이블도 KST로 저장됨)
    const kstTimestamp = parseKSTTimestamp(orderDate);
    
    // SQL에서 직접 ±30분 범위 계산 (JavaScript 타임존 변환 방지)
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
        AND e.timestamp BETWEEN ($1::timestamp - INTERVAL '30 minutes') AND ($1::timestamp + INTERVAL '30 minutes')
      ORDER BY time_diff_seconds ASC
      LIMIT 1`,
      [kstTimestamp, String(productNo)]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const match = result.rows[0];
    console.log(`${LOG_PREFIX} Visitor matched: ${match.visitor_id} (time diff: ${Math.round(match.time_diff_seconds)}s)`);
    
    return {
      visitor_id: match.visitor_id,
      session_id: match.session_id
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} findMatchingVisitor error:`, error.message);
    return null;
  }
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
  
  try {
    console.log(`${LOG_PREFIX} Starting sync from ${startDate} to ${endDate}${dryRun ? ' (DRY RUN)' : ''}`);
    
    // Cafe24에서 주문 가져오기
    const cafe24Orders = await getAllOrders(startDate, endDate);
    console.log(`${LOG_PREFIX} Fetched ${cafe24Orders.length} orders from Cafe24`);
    
    if (cafe24Orders.length === 0) {
      console.log(`${LOG_PREFIX} No orders to sync`);
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
    
    console.log(`${LOG_PREFIX} Found ${existingOrderMap.size} existing orders in conversions`);
    
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
        // total_amount = order_price_amount + shipping_fee (상품가 + 배송비)
        const orderPriceAmount = Math.round(parseFloat(order.actual_order_amount?.order_price_amount || 0));
        const shippingFeeAmount = Math.round(parseFloat(order.actual_order_amount?.shipping_fee || 0));
        const totalAmount = orderPriceAmount + shippingFeeAmount;
        
        // final_payment 계산: payment_amount + naver_point 합산
        // - payment_amount: PG결제금액 (카드, 무통장 등)
        // - naver_point: 네이버페이 포인트 결제금액
        // 둘 다 있는 경우 합산해야 Cafe24 관리자 "결제합계"와 일치
        const paymentAmount = Math.round(parseFloat(order.actual_order_amount?.payment_amount || 0));
        const naverPoint = Math.round(parseFloat(order.naver_point || 0));
        const finalPayment = paymentAmount + naverPoint;
        const discountAmount = Math.round(parseFloat(order.actual_order_amount?.total_discount_amount || 0));
        const mileageUsed = Math.round(parseFloat(order.actual_order_amount?.mileage_spent_amount || 0));
        const shippingFee = Math.round(parseFloat(order.actual_order_amount?.shipping_fee || 0));
        const productName = order.items?.[0]?.product_name || null;
        const paid = order.paid || 'T';
        
        // 새 필드: 포인트/적립금/주문경로/결제수단/상태
        const pointsSpent = Math.round(parseFloat(order.actual_order_amount?.points_spent_amount || 0));
        const creditsSpent = Math.round(parseFloat(order.actual_order_amount?.credits_spent_amount || 0));
        const orderPlaceName = order.order_place_name || null;
        const paymentMethodName = Array.isArray(order.payment_method_name) 
          ? order.payment_method_name.join(', ') 
          : (order.payment_method_name || null);
        const cafe24Status = order.items?.[0]?.order_status || null;
        const canceled = order.canceled || 'F';
        
        // order_status 결정 (Cafe24 상태 코드 기반)
        // C로 시작 = 취소, R로 시작 = 반품, 그 외 = confirmed
        let orderStatus = 'confirmed';
        if (cafe24Status) {
          if (cafe24Status.startsWith('C')) {
            orderStatus = 'cancelled';
          } else if (cafe24Status.startsWith('R')) {
            orderStatus = 'refunded';
          }
        }
        if (canceled === 'T') {
          orderStatus = 'cancelled';
        }
        
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
            shipping_fee, order_status, synced_at, product_name, paid,
            points_spent, credits_spent, order_place_name, payment_method_name,
            cafe24_status, canceled
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12, $13,
            $14, $15, $16, $17, $18, $19
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
            points_spent = EXCLUDED.points_spent,
            credits_spent = EXCLUDED.credits_spent,
            order_place_name = EXCLUDED.order_place_name,
            payment_method_name = EXCLUDED.payment_method_name,
            cafe24_status = EXCLUDED.cafe24_status,
            canceled = EXCLUDED.canceled,
            order_status = EXCLUDED.order_status,
            synced_at = NOW()`,
          [
            visitorId,
            sessionId,
            order.order_id,
            totalAmount,
            finalPayment,
            productCount,
            parseKSTTimestamp(order.order_date),  // KST 시간 그대로 저장 (UTC 변환 방지)
            discountAmount,
            mileageUsed,
            shippingFee,
            orderStatus,
            productName,
            paid,
            pointsSpent,
            creditsSpent,
            orderPlaceName,
            paymentMethodName,
            cafe24Status,
            canceled
          ]
        );
        
        if (isNewOrder) {
          syncedCount++;
        } else {
          updatedCount++;
        }
        
      } catch (insertError) {
        console.error(`${LOG_PREFIX} Failed to process order ${order.order_id}:`, insertError.message);
      }
    }
    
    console.log(`${LOG_PREFIX} Completed: ${syncedCount} new, ${updatedCount} updated, ${matchedCount} matched`);
    return { 
      synced: syncedCount, 
      matched: matchedCount, 
      updated: updatedCount,
      total: cafe24Orders.length,
      existing: existingOrderMap.size
    };
    
  } catch (error) {
    console.error(`${LOG_PREFIX} Error:`, error.message);
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
    console.log(`${BACKFILL_PREFIX} Starting visitor_id backfill...`);
    
    // synced_at이 있고 visitor_id가 NULL인 주문들 조회
    const ordersResult = await db.query(
      `SELECT order_id, timestamp 
       FROM conversions 
       WHERE synced_at IS NOT NULL 
         AND (visitor_id IS NULL OR visitor_id = '')
       ORDER BY timestamp DESC`
    );
    
    if (ordersResult.rows.length === 0) {
      console.log(`${BACKFILL_PREFIX} No orders need backfill`);
      return { total: 0, matched: 0, updated: 0 };
    }
    
    console.log(`${BACKFILL_PREFIX} Found ${ordersResult.rows.length} orders to backfill`);
    
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
            console.log(`${BACKFILL_PREFIX} Updated ${order.order_id} -> ${match.visitor_id.substring(0, 8)}...`);
          }
        }
        
        // Rate limit 방지
        await sleep(300);
        
      } catch (orderError) {
        console.error(`${BACKFILL_PREFIX} Error processing ${order.order_id}:`, orderError.message);
      }
    }
    
    console.log(`${BACKFILL_PREFIX} Completed: ${matchedCount} matched, ${updatedCount} updated out of ${ordersResult.rows.length}`);
    
    return {
      total: ordersResult.rows.length,
      matched: matchedCount,
      updated: updatedCount
    };
    
  } catch (error) {
    console.error(`${BACKFILL_PREFIX} Error:`, error.message);
    return { total: 0, matched: 0, updated: 0, error: error.message };
  }
}

/**
 * 기존 주문들의 상품명 일괄 업데이트
 * product_name이 NULL인 주문들 대상으로 Cafe24 API에서 상품명 조회하여 UPDATE
 */
async function backfillProductNames() {
  try {
    console.log(`${PRODUCT_PREFIX} Starting product_name backfill...`);
    
    // product_name이 NULL인 주문들 조회
    const ordersResult = await db.query(
      `SELECT order_id 
       FROM conversions 
       WHERE product_name IS NULL
       ORDER BY timestamp DESC`
    );
    
    if (ordersResult.rows.length === 0) {
      console.log(`${PRODUCT_PREFIX} No orders need product name update`);
      return { total: 0, updated: 0 };
    }
    
    console.log(`${PRODUCT_PREFIX} Found ${ordersResult.rows.length} orders to update`);
    
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
              console.log(`${PRODUCT_PREFIX} Progress: ${updatedCount}/${ordersResult.rows.length}`);
            }
          }
        }
        
        // Rate limit 방지 (200ms 대기)
        await sleep(200);
        
      } catch (orderError) {
        errorCount++;
        // 에러는 조용히 처리 (로그만 남김)
        if (errorCount <= 5) {
          console.error(`${PRODUCT_PREFIX} Error ${order.order_id}:`, orderError.message);
        }
      }
    }
    
    console.log(`${PRODUCT_PREFIX} Completed: ${updatedCount} updated, ${errorCount} errors out of ${ordersResult.rows.length}`);
    
    return {
      total: ordersResult.rows.length,
      updated: updatedCount,
      errors: errorCount
    };
    
  } catch (error) {
    console.error(`${PRODUCT_PREFIX} Error:`, error.message);
    return { total: 0, updated: 0, error: error.message };
  }
}

/**
 * 입금 대기(paid='F') 주문들의 결제 상태 업데이트
 * Cafe24 API로 각 주문의 paid 상태를 확인하여 입금 완료된 주문 업데이트
 */
async function updatePendingPayments() {
  try {
    console.log(`${PENDING_PREFIX} Starting pending payments update...`);
    
    // DB에서 paid='F'인 주문들 조회
    const pendingResult = await db.query(
      `SELECT order_id, timestamp 
       FROM conversions 
       WHERE paid = 'F'
       ORDER BY timestamp DESC`
    );
    
    if (pendingResult.rows.length === 0) {
      console.log(`${PENDING_PREFIX} No pending orders found`);
      return { total: 0, updated: 0 };
    }
    
    console.log(`${PENDING_PREFIX} Found ${pendingResult.rows.length} pending orders`);
    
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
          // final_payment 계산: payment_amount + naver_point 합산
          const paymentAmount = Math.round(parseFloat(cafe24Order.actual_order_amount?.payment_amount || 0));
          const naverPoint = Math.round(parseFloat(cafe24Order.naver_point || 0));
          const finalPayment = paymentAmount + naverPoint;
          // total_amount = order_price_amount + shipping_fee (상품가 + 배송비)
          const orderPriceAmount = Math.round(parseFloat(cafe24Order.actual_order_amount?.order_price_amount || 0));
          const shippingFeeAmount = Math.round(parseFloat(cafe24Order.actual_order_amount?.shipping_fee || 0));
          const totalAmount = orderPriceAmount + shippingFeeAmount;
          
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
          console.log(`${PENDING_PREFIX} Updated ${order.order_id}: paid=T, final_payment=${finalPayment}, total=${totalAmount}`);
        }
        
        // Rate limit 방지
        await sleep(300);
        
      } catch (orderError) {
        errorCount++;
        console.error(`${PENDING_PREFIX} Error processing ${order.order_id}:`, orderError.message);
      }
    }
    
    console.log(`${PENDING_PREFIX} Completed: ${updatedCount} updated, ${errorCount} errors out of ${pendingResult.rows.length}`);
    
    return {
      total: pendingResult.rows.length,
      updated: updatedCount,
      errors: errorCount
    };
    
  } catch (error) {
    console.error(`${PENDING_PREFIX} Error:`, error.message);
    return { total: 0, updated: 0, error: error.message };
  }
}

module.exports = {
  findMatchingVisitor,
  syncOrdersForRange,
  syncOrders,
  backfillVisitorIds,
  backfillProductNames,
  updatePendingPayments
};
