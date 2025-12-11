/**
 * Cafe24 Token Client
 * 토큰 관리 및 API 호출 담당
 */

const db = require('../../utils/database');
const { 
  CAFE24_AUTH_KEY, 
  CAFE24_API_BASE, 
  CAFE24_API_VERSION,
  sleep 
} = require('./utils');

const LOG_PREFIX = '[Cafe24]';

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
      console.log(`${LOG_PREFIX} Token expired or expiring soon, refreshing...`);
      return await refreshToken(tokenRow.refresh_token);
    }
    
    return tokenRow.access_token;
  } catch (error) {
    console.error(`${LOG_PREFIX} getToken error:`, error.message);
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
    
    console.log(`${LOG_PREFIX} Token refreshed successfully, expires at:`, data.expires_at);
    
    return data.access_token;
  } catch (error) {
    console.error(`${LOG_PREFIX} refreshToken error:`, error.message);
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
        console.log(`${LOG_PREFIX} Rate limited, waiting 3 seconds...`);
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
      console.log(`${LOG_PREFIX} Retry ${attempt + 1}/${maxRetries} after error:`, error.message);
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

module.exports = {
  getToken,
  refreshToken,
  callApi,
  getOrders,
  getAllOrders,
  getOrderDetail,
  getBuyerInfo,
  getMemberInfo,
  getTokenInfo
};
