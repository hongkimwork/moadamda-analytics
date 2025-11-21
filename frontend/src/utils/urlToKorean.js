/**
 * URL을 한글 이름으로 변환하는 유틸리티 함수
 * Moadamda Analytics Dashboard - URL to Korean Name Converter
 * 
 * 사용자 정의 매핑(url_mappings 테이블)을 사용하여 URL을 한글 이름으로 변환합니다.
 */

/**
 * URL 매핑 찾기 (유연한 매칭 로직 적용)
 * @param {string} url - 찾을 URL
 * @param {object} mappings - 매핑 객체
 * @returns {object|string|null} - 매핑 객체 또는 한글 이름 또는 null
 */
function findMapping(url, mappings) {
  if (!url || !mappings) return null;

  // 1. 정확한 일치 (Exact Match)
  if (mappings[url]) return mappings[url];

  try {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol; // 'http:' or 'https:'
    const host = urlObj.hostname;
    const path = urlObj.pathname;
    const search = urlObj.search;

    // 2. 프로토콜 스왑 (http <-> https)
    const otherProtocol = protocol === 'https:' ? 'http:' : 'https:';
    const swappedProtocolUrl = `${otherProtocol}//${host}${path}${search}`;
    if (mappings[swappedProtocolUrl]) return mappings[swappedProtocolUrl];

    // 3. 모바일/PC 도메인 호환 (m. <-> www./none)
    // cleanUrl이 www.를 제거하므로, 여기서는 m. 유무만 체크하면 됨
    let altHost = null;
    if (host.startsWith('m.')) {
      // m. 제거 (Mobile -> PC)
      altHost = host.substring(2);
    } else {
      // m. 추가 (PC -> Mobile)
      // 이미 www.가 있다면 교체, 없다면 추가
      if (host.startsWith('www.')) {
        altHost = 'm.' + host.substring(4);
      } else {
        altHost = 'm.' + host;
      }
    }

    if (altHost) {
      // 3-1. 도메인 변경 + 원래 프로토콜
      const altDomainUrl = `${protocol}//${altHost}${path}${search}`;
      if (mappings[altDomainUrl]) return mappings[altDomainUrl];

      // 3-2. 도메인 변경 + 프로토콜 스왑
      const altDomainProtocolUrl = `${otherProtocol}//${altHost}${path}${search}`;
      if (mappings[altDomainProtocolUrl]) return mappings[altDomainProtocolUrl];
    }

    // 4. 트레일링 슬래시 (Trailing Slash) 처리
    // path 끝에 슬래시가 있으면 제거, 없으면 추가
    let altPath = path;
    if (path.endsWith('/')) {
      altPath = path.slice(0, -1);
    } else {
      altPath = path + '/';
    }

    if (altPath !== path) {
      // 4-1. 슬래시 변경 + 원래 프로토콜/도메인
      const slashUrl = `${protocol}//${host}${altPath}${search}`;
      if (mappings[slashUrl]) return mappings[slashUrl];

      // 4-2. 슬래시 변경 + 프로토콜 스왑
      const slashProtocolUrl = `${otherProtocol}//${host}${altPath}${search}`;
      if (mappings[slashProtocolUrl]) return mappings[slashProtocolUrl];

      // 4-3. 슬래시 변경 + 도메인 변경 (있는 경우)
      if (altHost) {
        const slashDomainUrl = `${protocol}//${altHost}${altPath}${search}`;
        if (mappings[slashDomainUrl]) return mappings[slashDomainUrl];
      }
    }

    // 5. 디코딩된 URL로 시도 (DB 키가 디코딩된 상태일 경우)
    try {
      const decodedUrl = decodeURIComponent(url);
      if (decodedUrl !== url && mappings[decodedUrl]) return mappings[decodedUrl];
    } catch (e) {
      // ignore decoding errors
    }

  } catch (e) {
    // URL 파싱 실패 시 원본만 시도했으므로 패스
    console.warn('URL Matching error:', e);
  }

  return null;
}

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

  // 사용자 정의 매핑 확인 (유연한 매칭)
  const mapping = findMapping(url, userMappings);
  if (mapping) {
    // If mapping is an object (new format), return full details
    if (typeof mapping === 'object') {
      return {
        name: mapping.korean_name,
        icon: '',
        originalUrl: url,
        isProductPage: mapping.is_product_page,
        badgeText: mapping.badge_text,
        badgeColor: mapping.badge_color
      };
    }
    // Backward compatibility for string mappings (if any)
    return {
      name: mapping,
      icon: '',
      originalUrl: url,
      isProductPage: false,
      badgeText: null,
      badgeColor: null
    };
  }

  // 매핑 없으면 원본 URL 그대로
  return {
    name: url,
    icon: '',
    originalUrl: url,
    isProductPage: false,
    badgeText: null,
    badgeColor: null
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
