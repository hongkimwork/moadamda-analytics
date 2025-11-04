/**
 * URL을 한글 이름으로 변환하는 유틸리티 함수
 * Moadamda Analytics Dashboard - URL to Korean Name Converter
 */

/**
 * URL 패턴 매칭 규칙
 * - regex: URL 매칭용 정규표현식
 * - name: 한글 페이지 이름
 * - icon: 아이콘 이모지
 * - priority: 매칭 우선순위 (낮을수록 먼저 체크)
 */
const URL_PATTERNS = [
  // 1. 메인 페이지
  {
    regex: /^https?:\/\/[^\/]+\/(index\.html)?(\?.*)?$/,
    name: '메인 페이지',
    icon: '🏠',
    priority: 1
  },

  // 2. 상품 페이지 (surl/P 또는 surl/p)
  {
    regex: /\/surl\/[Pp]\/146/,
    name: '모로실 다이어트&혈당 관리 상품',
    icon: '📦',
    priority: 2
  },
  {
    regex: /\/surl\/[Pp]\/129/,
    name: '건강을 모아담다 상품',
    icon: '📦',
    priority: 2
  },
  {
    regex: /\/surl\/[Pp]\/156/,
    name: '★리뉴얼★ 건강을 모아담다 상품',
    icon: '📦',
    priority: 2
  },
  {
    regex: /\/surl\/[Pp]\/157/,
    name: '다이어트 끝 싹쓸어담다 SET 상품',
    icon: '📦',
    priority: 2
  },
  {
    regex: /\/surl\/[Pp]\/\d+/,
    name: '상품 페이지',
    icon: '📦',
    priority: 3
  },

  // 3. 주문 프로세스
  {
    regex: /\/order\/basket\.html/,
    name: '장바구니',
    icon: '🛒',
    priority: 1
  },
  {
    regex: /\/order\/orderform\.html/,
    name: '주문서 작성',
    icon: '📝',
    priority: 1
  },
  {
    regex: /\/order\/order_result\.html/,
    name: '주문 완료',
    icon: '✅',
    priority: 1
  },

  // 4. 회원 관련
  {
    regex: /\/member\/login\.html/,
    name: '로그인',
    icon: '🔐',
    priority: 1
  },
  {
    regex: /\/member\/mapping_join\.html/,
    name: 'SNS 회원가입',
    icon: '👤',
    priority: 1
  },
  {
    regex: /\/protected\/loginSns\.html/,
    name: 'SNS 로그인',
    icon: '🔐',
    priority: 1
  },

  // 5. 마이페이지
  {
    regex: /\/myshop\/order\/detail\.html/,
    name: '주문 상세 조회',
    icon: '📋',
    priority: 1
  },
  {
    regex: /\/myshop\/order\/list\.html/,
    name: '주문 내역',
    icon: '📋',
    priority: 1
  },
  {
    regex: /\/myshop\/order\/cancel\.html/,
    name: '주문 취소',
    icon: '❌',
    priority: 1
  },

  // 6. 쿠폰/이벤트
  {
    regex: /\/coupon\/coupon_select\.html/,
    name: '쿠폰 선택',
    icon: '🎟️',
    priority: 1
  },

  // 7. 카테고리/상품 목록
  {
    regex: /\/category\/.+\/24\//,
    name: '전체 상품 카테고리',
    icon: '🗂️',
    priority: 2
  },
  {
    regex: /\/category\/.+\/31\//,
    name: '건강 카테고리',
    icon: '🗂️',
    priority: 2
  },
  {
    regex: /\/category\//,
    name: '상품 카테고리',
    icon: '🗂️',
    priority: 3
  },
  {
    regex: /\/product\/list\.html/,
    name: '전체 상품 목록',
    icon: '📋',
    priority: 1
  },

  // 8. 상품 상세 페이지 (일반 URL)
  {
    regex: /\/product\/.+\/\d+\//,
    name: '상품 상세',
    icon: '📦',
    priority: 4
  }
];

/**
 * URL을 한글 이름으로 변환
 * @param {string} url - 원본 URL
 * @returns {object} { name: string, icon: string, originalUrl: string }
 */
export function urlToKorean(url) {
  if (!url || typeof url !== 'string') {
    return {
      name: '알 수 없음',
      icon: '❓',
      originalUrl: url || ''
    };
  }

  // URL 패턴 매칭 (우선순위 순으로 정렬)
  const sortedPatterns = [...URL_PATTERNS].sort((a, b) => a.priority - b.priority);

  for (const pattern of sortedPatterns) {
    if (pattern.regex.test(url)) {
      return {
        name: pattern.name,
        icon: pattern.icon,
        originalUrl: url
      };
    }
  }

  // 매칭되지 않은 경우 기본값 반환
  return {
    name: url,
    icon: '📄',
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

