// ============================================================================
// 데이터 포맷팅 유틸리티
// ============================================================================

/**
 * 체류시간 포맷팅 (초 → 분:초)
 * @param {number} seconds - 초 단위 시간
 * @returns {string} 포맷팅된 문자열 (예: "2분 30초", "45초")
 */
export const formatDuration = (seconds) => {
  if (!seconds || seconds === 0) return '0초';

  const numSeconds = parseFloat(seconds);
  if (numSeconds < 60) {
    return `${Math.round(numSeconds)}초`;
  }

  const minutes = Math.floor(numSeconds / 60);
  const remainSeconds = Math.round(numSeconds % 60);

  if (remainSeconds === 0) {
    return `${minutes}분`;
  }

  return `${minutes}분 ${remainSeconds}초`;
};

/**
 * 금액 포맷팅
 * @param {number} amount - 금액
 * @returns {string} 포맷팅된 문자열 (예: "1,000,000원")
 */
export const formatCurrency = (amount) => {
  if (!amount || amount === 0) return '0원';
  return `${parseInt(amount).toLocaleString()}원`;
};

/**
 * 숫자 포맷팅
 * @param {number} num - 숫자
 * @returns {string} 포맷팅된 문자열 (예: "1,000")
 */
export const formatNumber = (num) => {
  if (!num || num === 0) return '0';
  return parseInt(num).toLocaleString();
};
