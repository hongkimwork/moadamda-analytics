/**
 * 광고 소재 분석 공통 유틸리티 함수
 */

/**
 * URL 디코딩 함수 (불완전한 UTF-8 바이트 시퀀스 처리 및 정리)
 * @param {string} str - 디코딩할 문자열
 * @returns {string} - 디코딩된 문자열
 */
function safeDecodeURIComponent(str) {
  if (!str || str === '-') return str;
  
  let result = str;
  let prevResult;
  
  // 반복 디코딩 (이중 인코딩 처리)
  while (result !== prevResult) {
    prevResult = result;
    
    // 유효한 %XX 패턴 시퀀스를 찾아서 디코딩
    result = result.replace(/(%[0-9A-Fa-f]{2})+/g, (match) => {
      // 디코딩 시도, 실패 시 뒤에서부터 %XX 제거하며 재시도
      let toTry = match;
      while (toTry.length >= 3) {
        try {
          const decoded = decodeURIComponent(toTry);
          // 성공: 디코딩된 문자열만 반환 (불완전한 나머지는 버림)
          return decoded;
        } catch (e) {
          // 뒤에서 %XX 하나 제거 (3글자)
          toTry = toTry.slice(0, -3);
        }
      }
      // 모두 실패하면 빈 문자열 반환 (불완전한 인코딩 제거)
      return '';
    });
  }
  
  // 최종 정리: 끝에 남은 불완전한 % 패턴 제거 (%만 있거나 %X 형태)
  result = result.replace(/%[0-9A-Fa-f]?$/g, '');
  
  // Unicode 대체 문자(U+FFFD, �) 및 끝에 잘린 불완전한 문자 제거
  // 이 문자는 디코딩 실패 시 나타나는 깨진 문자
  result = result.replace(/\uFFFD/g, '');
  
  // 끝에 불완전하게 잘린 한글 제거 (자음/모음만 있는 경우)
  // 정상적인 한글 완성형이 아닌 문자가 끝에 있으면 제거
  result = result.replace(/[\u1100-\u11FF\u3130-\u318F]$/g, '');
  
  // '+' 기호를 공백으로 치환 (광고 플랫폼마다 다르게 인코딩되는 이슈 해결)
  result = result.replace(/\+/g, ' ');
  
  return result;
}

/**
 * UTM 필터 파싱 및 SQL 조건 생성
 * @param {string} utmFiltersJson - UTM 필터 JSON 문자열
 * @param {Array} queryParams - SQL 쿼리 파라미터 배열 (참조로 전달)
 * @param {number} startIndex - 시작 파라미터 인덱스
 * @returns {Object} - { conditions: string, nextIndex: number }
 */
function parseUtmFilters(utmFiltersJson, queryParams, startIndex) {
  let utmFilterConditions = '';
  let paramIndex = startIndex;

  try {
    const filters = JSON.parse(utmFiltersJson);
    if (Array.isArray(filters) && filters.length > 0) {
      const filterClauses = filters.map(filter => {
        const key = filter.key; // 예: 'utm_source'
        const operator = filter.operator || 'equals';
        const value = filter.value;
        
        // 키 이름 검증 (SQL Injection 방지)
        if (!/^utm_[a-z_]+$/.test(key)) {
          return null;
        }
        
        // IN 연산자 처리 (배열 값)
        if (operator === 'in' && Array.isArray(value) && value.length > 0) {
          const placeholders = value.map((v) => {
            queryParams.push(v);
            return `$${paramIndex++}`;
          });
          return `us.utm_params->>'${key}' IN (${placeholders.join(', ')})`;
        }
        
        // 기본 equals 연산자
        queryParams.push(value);
        const clause = `us.utm_params->>'${key}' = $${paramIndex}`;
        paramIndex++;
        return clause;
      }).filter(Boolean);
      
      if (filterClauses.length > 0) {
        utmFilterConditions = 'AND ' + filterClauses.join(' AND ');
      }
    }
  } catch (e) {
    console.error('UTM filters parsing error:', e);
  }

  return {
    conditions: utmFilterConditions,
    nextIndex: paramIndex
  };
}

/**
 * 정렬 컬럼 검증 및 정렬 방향 반환
 * @param {string} sortBy - 정렬 기준
 * @param {string} sortOrder - 정렬 순서 (asc/desc)
 * @returns {Object} - { sortBy, sortDirection, isDbSort, sortColumn, sortDirectionSQL }
 */
function validateSortColumn(sortBy, sortOrder) {
  const dbSortColumns = [
    'creative_name',
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'unique_visitors',
    'avg_pageviews',
    'avg_duration_seconds'
  ];

  const attributionSortColumns = [
    'purchase_count',
    'total_revenue',
    'contributed_orders_count',
    'attributed_revenue',
    'total_contributed_revenue',
    'single_touch_count',
    'last_touch_count',
    'last_touch_revenue'
  ];

  const allAllowedSortColumns = [...dbSortColumns, ...attributionSortColumns];
  const validatedSortBy = allAllowedSortColumns.includes(sortBy) ? sortBy : 'total_revenue';
  const sortDirection = sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc';

  // DB 정렬 컬럼인지 기여도 정렬 컬럼인지 판단
  const isDbSort = dbSortColumns.includes(validatedSortBy);
  const sortColumn = isDbSort ? validatedSortBy : 'creative_name'; // 기여도 컬럼이면 일단 creative_name으로 정렬
  const sortDirectionSQL = isDbSort ? sortDirection.toUpperCase() : 'ASC';

  return {
    sortBy: validatedSortBy,
    sortDirection,
    isDbSort,
    sortColumn,
    sortDirectionSQL
  };
}

/**
 * 잘린 광고명인지 판단하는 함수
 * @param {string} shortName - 짧은 광고명
 * @param {string} longName - 긴 광고명
 * @returns {boolean}
 */
function isTruncated(shortName, longName) {
  // 긴 이름과의 차이 부분
  const diff = longName.slice(shortName.length);
  
  // " - 사본" 같은 별도 접미사가 붙은 경우는 잘린 것이 아님
  if (diff.startsWith(' - ') || diff.startsWith(' (') || diff.startsWith('_사본')) {
    return false;
  }
  
  // 짧은 이름이 언더스코어로 끝나면 잘린 것
  if (shortName.endsWith('_')) {
    return true;
  }
  
  // 차이가 한글로 시작하면 잘린 것 (단어 중간에서 잘림)
  // 예: "영괄" -> "영괄식" (식이 붙어야 함)
  if (/^[가-힣]/.test(diff)) {
    return true;
  }
  
  // 차이가 완전히 새로운 단어가 아닌 경우 (언더스코어 없이 바로 이어짐)
  if (!diff.startsWith('_') && !diff.startsWith(' ')) {
    return true;
  }
  
  return false;
}

module.exports = {
  safeDecodeURIComponent,
  parseUtmFilters,
  validateSortColumn,
  isTruncated
};
