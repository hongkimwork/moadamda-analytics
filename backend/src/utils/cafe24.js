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
  startTokenRefreshTask,
  CAFE24_MALL_ID,
  CAFE24_API_VERSION
};

