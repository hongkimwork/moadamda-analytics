/**
 * URL을 한글 이름으로 변환하는 유틸리티 함수
 * Moadamda Analytics Dashboard - URL to Korean Name Converter
 * 
 * 사용자 정의 매핑(url_mappings 테이블)을 사용하여 URL을 한글 이름으로 변환합니다.
 */

/**
 * URL을 한글 이름으로 변환
 * @param {string} url - 원본 URL
 * @param {object} userMappings - 사용자 정의 매핑 객체 { url: korean_name }
 * @returns {object} { name: string, icon: string, originalUrl: string }
 */
export function urlToKorean(url, userMappings = {}) {
  if (!url || typeof url !== 'string') {
    return {
      name: '알 수 없음',
      icon: '',
      originalUrl: url || ''
    };
  }

  // 사용자 정의 매핑 확인
  if (userMappings[url]) {
    return {
      name: userMappings[url],
      icon: '',
      originalUrl: url
    };
  }

  // 매핑 없으면 원본 URL 그대로
  return {
    name: url,
    icon: '',
    originalUrl: url
  };
}

/**
 * URL에서 쿼리 파라미터를 제거한 순수 경로만 추출
 * @param {string} url - 원본 URL
 * @returns {string} 쿼리 파라미터가 제거된 URL
 */
export function cleanUrl(url) {
  if (!url) return '';
  try {
    const urlObj = new URL(url);
    return `${urlObj.origin}${urlObj.pathname}`;
  } catch {
    return url.split('?')[0];
  }
}

/**
 * URL을 짧게 표시 (도메인 제거, 경로만)
 * @param {string} url - 원본 URL
 * @returns {string} 짧게 표시된 URL
 */
export function shortenUrl(url) {
  if (!url) return '';
  try {
    const urlObj = new URL(url);
    return urlObj.pathname + (urlObj.search ? urlObj.search.substring(0, 30) + '...' : '');
  } catch {
    return url;
  }
}

/**
 * 로컬스토리지에서 URL 표시 모드 가져오기
 * @returns {string} 'korean' | 'original'
 */
export function getUrlDisplayMode() {
  return localStorage.getItem('urlDisplayMode') || 'korean';
}

/**
 * 로컬스토리지에 URL 표시 모드 저장
 * @param {string} mode - 'korean' | 'original'
 */
export function setUrlDisplayMode(mode) {
  localStorage.setItem('urlDisplayMode', mode);
}

