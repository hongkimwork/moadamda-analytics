/**
 * Tables Service Utilities
 * 테이블 조회 관련 공통 헬퍼 함수
 */

/**
 * URL 디코딩/인코딩 검색을 위한 헬퍼 함수
 * 사용자가 한글로 검색하면 인코딩된 형태로도 검색
 */
function encodeSearchTerm(searchTerm) {
  try {
    // 한글, 일본어, 중국어 등 non-ASCII 문자가 있는지 확인
    const hasNonAscii = /[^\x00-\x7F]/.test(searchTerm);
    
    if (hasNonAscii) {
      // non-ASCII 문자가 있으면 URL 인코딩
      const encoded = encodeURIComponent(searchTerm);
      // PostgreSQL LIKE/ILIKE에서 % 문자를 literal로 검색하기 위해
      // ! 문자로 escape (ESCAPE '!' 절과 함께 사용)
      return encoded.replace(/%/g, '!%').replace(/_/g, '!_');
    }
    
    // ASCII만 있으면 그대로 반환 (이미 인코딩된 값일 수도 있음)
    return searchTerm;
  } catch (e) {
    return searchTerm;
  }
}

/**
 * non-ASCII 문자 존재 여부 확인
 */
function hasNonAsciiChars(str) {
  return /[^\x00-\x7F]/.test(str);
}

module.exports = {
  encodeSearchTerm,
  hasNonAsciiChars
};
