/**
 * URL Helper Functions
 * 
 * URL 디코딩, 배지 파싱 등 페이지 매핑에서 사용되는 유틸리티 함수들
 */

/**
 * URL을 디코딩하여 표시용으로 변환
 * @param {string} url - 인코딩된 URL
 * @returns {string} 디코딩된 URL
 */
export const decodeUrl = (url) => {
  try {
    return decodeURIComponent(url);
  } catch (e) {
    // 디코딩 실패 시 원본 반환
    return url;
  }
};

/**
 * 배지 데이터를 파싱 (문자열 → 배열)
 * @param {string|Array|null} badges - 배지 데이터
 * @returns {Array} 파싱된 배지 배열
 */
export const parseBadges = (badges) => {
  if (!badges) return [];
  
  try {
    if (typeof badges === 'string') {
      return JSON.parse(badges);
    } else if (Array.isArray(badges)) {
      return badges;
    }
  } catch (e) {
    console.error('Failed to parse badges:', e);
    return [];
  }
  
  return [];
};

/**
 * 레거시 배지를 새 형식으로 변환
 * @param {string} badgeText - 배지 텍스트
 * @param {string} badgeColor - 배지 색상
 * @returns {Array} 배지 배열 형식
 */
export const convertLegacyBadge = (badgeText, badgeColor) => {
  if (!badgeText) return [];
  
  return [{
    text: badgeText,
    color: badgeColor || '#1677ff'
  }];
};

/**
 * 데이터 목록의 배지를 파싱
 * @param {Array} data - 데이터 목록
 * @returns {Array} 배지가 파싱된 데이터 목록
 */
export const parseDataBadges = (data) => {
  return data.map(item => {
    let parsedBadges = item.badges;
    if (typeof item.badges === 'string' && item.badges) {
      try {
        parsedBadges = JSON.parse(item.badges);
      } catch (e) {
        console.error('Failed to parse badges for item:', item.url, e);
        parsedBadges = null;
      }
    }
    return { ...item, badges: parsedBadges };
  });
};

/**
 * URL 조건이 복합 매핑인지 확인
 * @param {Object} urlConditions - URL 조건 객체
 * @returns {boolean}
 */
export const isComplexMapping = (urlConditions) => {
  if (!urlConditions || !urlConditions.groups) return false;
  return urlConditions.groups.length > 0;
};
