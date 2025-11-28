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
    // Cafe24 API의 expires_at은 타임존 없이 KST로 반환됨 → 명시적으로 +09:00 추가
    const expiresAtWithTz = data.expires_at.includes('+') || data.expires_at.includes('Z')
      ? data.expires_at
      : data.expires_at + '+09:00';
    const expireDate = new Date(expiresAtWithTz);
    
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
 * 수동 주문 동기화 (모든 주문 업데이트)
 * - 새 주문: visitor_id 매칭 시도 후 저장
 * - 기존 주문: visitor_id 유지, paid/final_payment는 Cafe24 값으로 업데이트
 * 
 * 핵심 로직: utils/cafe24.js의 syncOrdersForRange() 사용
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
    
    // 공통 함수 호출
    const result = await cafe24.syncOrdersForRange(start_date, end_date, { dryRun: dry_run });
    
    // dry_run 모드 응답
    if (result.dryRun) {
      return res.json({
        success: true,
        dry_run: true,
        total_cafe24_orders: result.total,
        existing_orders: result.existing,
        new_orders: result.newOrders,
        orders_to_update: result.toUpdate,
        new_order_ids: result.newOrderIds
      });
    }
    
    // 일반 동기화 응답
    res.json({
      success: true,
      total_cafe24_orders: result.total,
      existing_orders: result.existing,
      inserted_orders: result.synced,
      updated_orders: result.updated,
      matched_visitors: result.matched
    });
    
  } catch (error) {
    console.error('[Cafe24 Sync] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 기존 synced 주문의 visitor_id 일괄 매칭
 * synced_at이 있고 visitor_id가 NULL인 주문들 대상
 */
router.post('/cafe24/backfill', async (req, res) => {
  try {
    console.log('[Cafe24 Backfill] Starting backfill via API...');
    
    const result = await cafe24.backfillVisitorIds();
    
    res.json({
      success: true,
      total_orders: result.total,
      matched: result.matched,
      updated: result.updated,
      error: result.error || null
    });
    
  } catch (error) {
    console.error('[Cafe24 Backfill] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 상품명 일괄 업데이트
 * product_name이 NULL인 주문들에 Cafe24 API에서 상품명 조회하여 UPDATE
 */
router.post('/cafe24/backfill-products', async (req, res) => {
  try {
    console.log('[Cafe24 Product Backfill] Starting product name backfill via API...');
    
    const result = await cafe24.backfillProductNames();
    
    res.json({
      success: true,
      total_orders: result.total,
      updated: result.updated,
      errors: result.errors || 0,
      error: result.error || null
    });
    
  } catch (error) {
    console.error('[Cafe24 Product Backfill] Error:', error);
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

/**
 * 입금 대기 주문 상태 업데이트
 * paid='F'인 주문들을 Cafe24 API로 확인하여 입금 완료된 주문 업데이트
 */
router.post('/cafe24/update-pending', async (req, res) => {
  try {
    console.log('[Cafe24 Update Pending] Starting pending payments update via API...');
    
    const result = await cafe24.updatePendingPayments();
    
    res.json({
      success: true,
      total_pending: result.total,
      updated: result.updated,
      errors: result.errors || 0,
      error: result.error || null
    });
    
  } catch (error) {
    console.error('[Cafe24 Update Pending] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

