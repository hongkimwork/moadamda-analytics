/**
 * URL 파싱 유틸리티
 * 전체 URL을 베이스 URL과 쿼리 파라미터로 분리
 */

/**
 * URL을 파싱하여 베이스 URL과 파라미터 분리
 * @param {string} fullUrl - 전체 URL
 * @returns {{ baseUrl: string, params: Array<{key: string, value: string}> }}
 */
export function parseUrl(fullUrl) {
  if (!fullUrl || typeof fullUrl !== 'string') {
    return { baseUrl: '', params: [] };
  }

  try {
    const url = new URL(fullUrl);
    const baseUrl = url.origin + url.pathname;
    
    const params = [];
    url.searchParams.forEach((value, key) => {
      params.push({ key, value });
    });

    return { baseUrl, params };
  } catch (error) {
    // URL 파싱 실패 시 원본 반환
    console.warn('URL parsing failed:', error);
    return { baseUrl: fullUrl, params: [] };
  }
}

/**
 * 베이스 URL과 파라미터를 합쳐서 전체 URL 생성
 * @param {string} baseUrl - 베이스 URL
 * @param {Array<{key: string, value: string}>} params - 파라미터 배열
 * @returns {string} - 전체 URL
 */
export function buildUrl(baseUrl, params) {
  if (!baseUrl) return '';
  if (!params || params.length === 0) return baseUrl;

  try {
    const url = new URL(baseUrl);
    params.forEach(param => {
      if (param.key && param.value) {
        url.searchParams.set(param.key, param.value);
      }
    });
    return url.toString();
  } catch (error) {
    console.warn('URL building failed:', error);
    return baseUrl;
  }
}

/**
 * URL 조건 그룹 생성 (Phase 1: URL OR 연산)
 * @param {Array<{baseUrl: string, params: Array}>} urlGroups - URL 그룹 배열
 * @param {string} urlOperator - URL 간 연산자 ('OR' or 'AND')
 * @returns {Object} - url_conditions 객체
 */
export function createUrlConditions(urlGroups, urlOperator = 'OR') {
  if (!urlGroups || urlGroups.length === 0) {
    return null;
  }

  return {
    operator: urlOperator,
    groups: urlGroups.map(group => ({
      base_url: group.baseUrl,
      params: {
        operator: 'AND', // Phase 1: 파라미터는 AND만
        conditions: group.params.filter(p => p.key && p.value)
      }
    }))
  };
}

/**
 * URL 조건이 단순 매핑인지 복합 매핑인지 확인
 * @param {Object} urlConditions - url_conditions 객체
 * @returns {boolean} - 복합 매핑이면 true
 */
export function isComplexMapping(urlConditions) {
  if (!urlConditions) return false;
  if (!urlConditions.groups || urlConditions.groups.length === 0) return false;
  if (urlConditions.groups.length > 1) return true;
  
  // 단일 URL이지만 파라미터가 있으면 복합 매핑
  const firstGroup = urlConditions.groups[0];
  return firstGroup.params && firstGroup.params.conditions && firstGroup.params.conditions.length > 0;
}

