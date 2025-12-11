/**
 * Cafe24 Service Utilities
 * 공통 유틸리티 함수 및 상수
 */

// 환경 변수
const CAFE24_AUTH_KEY = process.env.CAFE24_AUTH_KEY;
const CAFE24_MALL_ID = process.env.CAFE24_MALL_ID || 'moadamda';
const CAFE24_API_VERSION = process.env.CAFE24_API_VERSION || '2025-09-01';
const CAFE24_API_BASE = `https://${CAFE24_MALL_ID}.cafe24api.com/api/v2`;

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Cafe24 order_date에서 KST 시간을 그대로 추출
 * Cafe24 API는 KST(+09:00) 시간을 반환하는데, new Date()로 파싱하면 UTC로 변환됨
 * 이 함수는 타임존 변환 없이 KST 시간 값을 그대로 반환
 * 
 * @param {string} dateString - Cafe24 order_date (예: "2025-12-03T07:20:54+09:00")
 * @returns {string} KST 시간 문자열 (예: "2025-12-03 07:20:54")
 */
function parseKSTTimestamp(dateString) {
  if (!dateString) return null;
  
  // ISO 형식에서 날짜/시간 부분만 추출 (타임존 정보 무시)
  // "2025-12-03T07:20:54+09:00" → "2025-12-03 07:20:54"
  const match = dateString.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/);
  if (match) {
    return `${match[1]} ${match[2]}`;
  }
  
  // 매칭 실패 시 원본 반환 (fallback)
  return dateString;
}

module.exports = {
  CAFE24_AUTH_KEY,
  CAFE24_MALL_ID,
  CAFE24_API_VERSION,
  CAFE24_API_BASE,
  sleep,
  parseKSTTimestamp
};
