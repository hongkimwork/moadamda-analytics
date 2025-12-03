/**
 * 주문 분석 데이터 변환 유틸리티
 * OrderAnalysis 페이지에서 사용하는 데이터 변환 함수들
 */

/**
 * 시간을 한글 포맷으로 변환
 * @param {number} seconds - 초 단위 시간
 * @returns {string} 포맷된 시간 문자열 (예: "2분 30초" 또는 "45초")
 */
export function formatDuration(seconds) {
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}분 ${secs}초`;
  }
  return `${seconds}초`;
}

/**
 * 연속 중복 페이지 제거 함수
 * 같은 URL을 연속으로 방문한 경우 하나로 통합하고 체류시간 합산
 * @param {Array} pages - 페이지 배열
 * @returns {Array} 중복이 제거된 페이지 배열
 */
export function removeConcecutiveDuplicates(pages) {
  if (!pages || pages.length === 0) return [];

  const result = [];
  let current = null;

  for (const page of pages) {
    const currentUrl = page.clean_url || page.page_url;

    if (!current) {
      // 첫 페이지 - 깊은 복사로 시작
      current = { ...page };
    } else {
      const prevUrl = current.clean_url || current.page_url;

      if (currentUrl === prevUrl) {
        // 같은 URL 연속 방문 - 체류시간만 합산 (최대 600초 제한)
        const combinedTime = (current.time_spent_seconds || 0) + (page.time_spent_seconds || 0);
        current.time_spent_seconds = Math.min(combinedTime, 600);
        // timestamp는 첫 방문 시간 유지
      } else {
        // 다른 URL - 이전 것을 결과에 추가하고 새로 시작
        result.push(current);
        current = { ...page };
      }
    }
  }

  // 마지막 페이지 추가
  if (current) {
    result.push(current);
  }

  return result;
}

/**
 * 실제 구매 상품명을 기준으로 페이지 매핑 테이블에서 직접 매칭 정보 찾기
 * @param {string} orderProductName - 주문 상품명
 * @param {object} userMappings - 사용자 정의 매핑 객체
 * @returns {object|null} 매칭된 매핑 객체 또는 null
 */
export function findMatchingMapping(orderProductName, userMappings) {
  if (!orderProductName || !userMappings) {
    return null;
  }

  // userMappings에서 korean_name에 order.product_name이 포함된 매핑 찾기
  const matchedEntry = Object.entries(userMappings).find(([url, mapping]) => {
    // 상품 페이지이고 뱃지가 있는 경우만
    if (!mapping.is_product_page || !mapping.badges?.length) {
      return false;
    }

    const koreanName = mapping.korean_name || '';

    // 예: "건강을 모아담다 상품 페이지".includes("건강을 모아담다") → true
    return koreanName.includes(orderProductName);
  });

  // 매칭된 mapping 객체 반환 (badges 포함)
  return matchedEntry ? matchedEntry[1] : null;
}

/**
 * 체류시간 검증 및 필터링
 * @param {Array} pages - 페이지 배열
 * @param {number} maxSeconds - 최대 체류시간 (기본: 600초 = 10분)
 * @returns {Array} 필터링된 페이지 배열
 */
export function validateTimeSpent(pages, maxSeconds = 600) {
  return pages.map(page => ({
    ...page,
    time_spent_seconds: Math.min(page.time_spent_seconds || 0, maxSeconds)
  }));
}

/**
 * 체류시간 텍스트 생성
 * @param {number} durationSeconds - 체류시간(초)
 * @returns {string} 체류시간 텍스트
 */
export function getDurationText(durationSeconds) {
  if (durationSeconds >= 60) {
    return `${Math.floor(durationSeconds / 60)}분 ${durationSeconds % 60}초 체류`;
  }

  if (durationSeconds >= 1) {
    return `${durationSeconds}초 체류`;
  }

  return '1초미만 체류';
}
