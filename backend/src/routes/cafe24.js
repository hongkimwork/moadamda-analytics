/**
 * Cafe24 API Routes
 * 
 * 엔드포인트:
 * - GET /api/cafe24/callback - OAuth 콜백 처리 (최초 인증용)
 * - GET /api/cafe24/orders - 주문 목록 조회
 * - GET /api/cafe24/token-info - 현재 토큰 정보 조회
 * - POST /api/cafe24/sync - 수동 주문 동기화 트리거
 */

const express = require('express');
const router = express.Router();
const db = require('../utils/database');
const cafe24 = require('../utils/cafe24');

/**
 * OAuth 콜백 처리
 * Cafe24에서 인증 완료 후 리다이렉트되는 엔드포인트
 */
router.get('/cafe24/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }
    
    // 인증코드로 액세스 토큰 발급
    const CAFE24_AUTH_KEY = process.env.CAFE24_AUTH_KEY;
    const CAFE24_MALL_ID = process.env.CAFE24_MALL_ID || 'moadamda';
    const REDIRECT_URI = process.env.CAFE24_REDIRECT_URI || 'https://moadamda-analytics.co.kr/api/cafe24/callback';
    
    const response = await fetch(`https://${CAFE24_MALL_ID}.cafe24api.com/api/v2/oauth/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${CAFE24_AUTH_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return res.status(400).json({ 
        error: 'Token exchange failed', 
        details: errorText 
      });
    }
    
    const data = await response.json();
    
    // 토큰을 DB에 저장
    const expireDate = new Date(data.expires_at);
    
    await db.query(
      `INSERT INTO cafe24_token (access_token, refresh_token, issued_date, expire_date)
       VALUES ($1, $2, NOW(), $3)`,
      [data.access_token, data.refresh_token, expireDate]
    );
    
    res.json({
      success: true,
      message: 'Token saved successfully',
      expires_at: data.expires_at,
      scopes: data.scopes
    });
    
  } catch (error) {
    console.error('[Cafe24 Callback] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 주문 목록 조회
 * Query params: start_date, end_date, limit, offset
 */
router.get('/cafe24/orders', async (req, res) => {
  try {
    const { 
      start_date, 
      end_date, 
      limit = 100, 
      offset = 0 
    } = req.query;
    
    if (!start_date || !end_date) {
      return res.status(400).json({ 
        error: 'start_date and end_date are required (YYYY-MM-DD format)' 
      });
    }
    
    const orders = await cafe24.getOrders(start_date, end_date, parseInt(limit), parseInt(offset));
    
    res.json(orders);
    
  } catch (error) {
    console.error('[Cafe24 Orders] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 모든 주문 조회 (페이지네이션 자동 처리)
 */
router.get('/cafe24/orders/all', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    if (!start_date || !end_date) {
      return res.status(400).json({ 
        error: 'start_date and end_date are required (YYYY-MM-DD format)' 
      });
    }
    
    const orders = await cafe24.getAllOrders(start_date, end_date);
    
    res.json({
      total: orders.length,
      orders: orders
    });
    
  } catch (error) {
    console.error('[Cafe24 All Orders] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 개별 주문 상세 조회
 */
router.get('/cafe24/orders/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await cafe24.getOrderDetail(orderId);
    
    res.json(order);
    
  } catch (error) {
    console.error('[Cafe24 Order Detail] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 현재 토큰 정보 조회
 */
router.get('/cafe24/token-info', async (req, res) => {
  try {
    const tokenInfo = await cafe24.getTokenInfo();
    
    if (!tokenInfo) {
      return res.status(404).json({ error: 'No token found' });
    }
    
    res.json(tokenInfo);
    
  } catch (error) {
    console.error('[Cafe24 Token Info] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 수동 주문 동기화
 * 기존 conversions 테이블에 누락된 주문만 추가
 */
router.post('/cafe24/sync', async (req, res) => {
  try {
    const { 
      start_date, 
      end_date,
      dry_run = false // true면 실제 저장 안하고 결과만 반환
    } = req.body;
    
    if (!start_date || !end_date) {
      return res.status(400).json({ 
        error: 'start_date and end_date are required in request body (YYYY-MM-DD format)' 
      });
    }
    
    console.log(`[Cafe24 Sync] Starting sync from ${start_date} to ${end_date}`);
    
    // Cafe24에서 주문 가져오기
    const cafe24Orders = await cafe24.getAllOrders(start_date, end_date);
    console.log(`[Cafe24 Sync] Fetched ${cafe24Orders.length} orders from Cafe24`);
    
    // 기존 conversions에서 해당 기간의 order_id 조회
    const existingResult = await db.query(
      `SELECT order_id FROM conversions 
       WHERE timestamp >= $1::date AND timestamp < $2::date + INTERVAL '1 day'
       AND order_id IS NOT NULL`,
      [start_date, end_date]
    );
    
    const existingOrderIds = new Set(existingResult.rows.map(r => r.order_id));
    console.log(`[Cafe24 Sync] Found ${existingOrderIds.size} existing orders in conversions`);
    
    // 누락된 주문 찾기
    const missingOrders = cafe24Orders.filter(order => 
      !existingOrderIds.has(order.order_id) && 
      order.paid === 'T' // 결제 완료된 주문만
    );
    
    console.log(`[Cafe24 Sync] Found ${missingOrders.length} missing orders to sync`);
    
    if (dry_run) {
      return res.json({
        success: true,
        dry_run: true,
        total_cafe24_orders: cafe24Orders.length,
        existing_orders: existingOrderIds.size,
        missing_orders: missingOrders.length,
        missing_order_ids: missingOrders.map(o => o.order_id)
      });
    }
    
    // 누락된 주문 저장
    let insertedCount = 0;
    let matchedCount = 0;
    
    for (const order of missingOrders) {
      try {
        // 결제 금액 계산 (정수로 변환)
        const totalAmount = Math.round(parseFloat(order.actual_order_amount?.total_order_amount || order.order_amount || 0));
        const finalPayment = Math.round(parseFloat(order.actual_order_amount?.payment_amount || 0));
        const discountAmount = Math.round(parseFloat(order.actual_order_amount?.total_discount_amount || 0));
        const mileageUsed = Math.round(parseFloat(order.actual_order_amount?.mileage_spent_amount || 0));
        const shippingFee = Math.round(parseFloat(order.actual_order_amount?.shipping_fee || 0));
        
        // visitor_id 매칭 시도
        let visitorId = null;
        let sessionId = null;
        
        if (order.items && order.items.length > 0) {
          const productNo = order.items[0].product_no;
          const match = await cafe24.findMatchingVisitor(order.order_date, productNo);
          if (match) {
            visitorId = match.visitor_id;
            sessionId = match.session_id;
            matchedCount++;
          }
        }
        
        // conversions 테이블에 INSERT (visitor_id 매칭 포함)
        await db.query(
          `INSERT INTO conversions (
            visitor_id, session_id, order_id, total_amount, final_payment, 
            product_count, timestamp, discount_amount, mileage_used, 
            shipping_fee, order_status, synced_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW()
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
            'confirmed'
          ]
        );
        
        insertedCount++;
      } catch (insertError) {
        console.error(`[Cafe24 Sync] Failed to insert order ${order.order_id}:`, insertError.message);
      }
    }
    
    console.log(`[Cafe24 Sync] Successfully synced ${insertedCount} orders, matched ${matchedCount} visitors`);
    
    res.json({
      success: true,
      total_cafe24_orders: cafe24Orders.length,
      existing_orders: existingOrderIds.size,
      missing_orders: missingOrders.length,
      inserted_orders: insertedCount,
      matched_visitors: matchedCount
    });
    
  } catch (error) {
    console.error('[Cafe24 Sync] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 토큰 수동 갱신
 */
router.post('/cafe24/refresh-token', async (req, res) => {
  try {
    // 현재 refresh_token 가져오기
    const result = await db.query(
      'SELECT refresh_token FROM cafe24_token ORDER BY idx DESC LIMIT 1'
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No token found to refresh' });
    }
    
    const newToken = await cafe24.refreshToken(result.rows[0].refresh_token);
    
    res.json({
      success: true,
      message: 'Token refreshed successfully',
      access_token_preview: newToken.substring(0, 10) + '...'
    });
    
  } catch (error) {
    console.error('[Cafe24 Refresh Token] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

