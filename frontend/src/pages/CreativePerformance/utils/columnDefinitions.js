/**
 * Creative Performance 컬럼 정의
 * 모든 사용 가능한 컬럼과 기본 설정
 */

// 컬럼 카테고리
export const COLUMN_CATEGORIES = {
  UTM: 'UTM 정보',
  TRAFFIC: '트래픽',
  BEHAVIOR: '행동 지표',
  EVALUATION: '평가',
  REVENUE: '매출/전환'
};

/**
 * 모든 컬럼 정의
 * - key: 테이블 컬럼의 key 또는 dataIndex와 매칭
 * - title: 모달에 표시할 이름
 * - tooltip: 설명
 * - category: 카테고리
 * - defaultVisible: 기본 표시 여부
 * - fixed: 고정 위치 ('left' | 'right') — 고정 컬럼은 항상 표시, 순서 변경 불가
 * - alwaysVisible: true면 체크 해제 불가 (광고 소재 이름, 상세)
 */
export const ALL_COLUMNS = [
  // ============ UTM 정보 ============
  {
    key: 'utm_source',
    title: 'UTM Source',
    tooltip: '광고 유입 소스 (예: meta, google)',
    category: COLUMN_CATEGORIES.UTM,
    defaultVisible: true
  },
  {
    key: 'utm_campaign',
    title: 'UTM Campaign',
    tooltip: '광고 캠페인 이름',
    category: COLUMN_CATEGORIES.UTM,
    defaultVisible: true
  },
  {
    key: 'utm_medium',
    title: 'UTM Medium',
    tooltip: '광고 매체 (예: cpc, social)',
    category: COLUMN_CATEGORIES.UTM,
    defaultVisible: true
  },

  // ============ 트래픽 ============
  {
    key: 'creative_name',
    title: '광고 소재 이름',
    tooltip: '광고 소재의 이름 (항상 표시)',
    category: COLUMN_CATEGORIES.TRAFFIC,
    defaultVisible: true,
    alwaysVisible: true,
    fixed: 'left'
  },
  {
    key: 'total_views',
    title: 'View (진입 수)',
    tooltip: '해당 광고를 통한 총 진입 횟수',
    category: COLUMN_CATEGORIES.TRAFFIC,
    defaultVisible: true
  },
  {
    key: 'unique_visitors',
    title: 'UV (순 방문자)',
    tooltip: '해당 광고를 통한 순 방문자 수',
    category: COLUMN_CATEGORIES.TRAFFIC,
    defaultVisible: true
  },

  // ============ 행동 지표 ============
  {
    key: 'avg_pageviews',
    title: '평균 PV',
    tooltip: '방문자당 평균 페이지뷰 수',
    category: COLUMN_CATEGORIES.BEHAVIOR,
    defaultVisible: true
  },
  {
    key: 'avg_duration_seconds',
    title: '평균 체류시간',
    tooltip: '방문자당 평균 체류 시간',
    category: COLUMN_CATEGORIES.BEHAVIOR,
    defaultVisible: true
  },
  {
    key: 'avg_scroll_px',
    title: '평균 스크롤',
    tooltip: '방문자당 평균 스크롤 거리(px)',
    category: COLUMN_CATEGORIES.BEHAVIOR,
    defaultVisible: true
  },

  // ============ 평가 ============
  {
    key: 'traffic_score',
    title: '모수 평가점수',
    tooltip: '스크롤·PV·체류시간 기반 종합 평가 점수',
    category: COLUMN_CATEGORIES.EVALUATION,
    defaultVisible: true
  },

  // ============ 매출/전환 ============
  {
    key: 'last_touch_count',
    title: '막타 횟수',
    tooltip: '구매 직전 마지막으로 본 광고로서 구매한 횟수',
    category: COLUMN_CATEGORIES.REVENUE,
    defaultVisible: true
  },
  {
    key: 'total_revenue',
    title: '막타 결제액',
    tooltip: '마지막 광고 기여 결제 금액 합계',
    category: COLUMN_CATEGORIES.REVENUE,
    defaultVisible: true
  },
  {
    key: 'purchase_conversion_rate',
    title: '구매 전환율',
    tooltip: '방문자 중 구매로 이어진 비율 (막타 횟수 ÷ UV × 100)',
    category: COLUMN_CATEGORIES.REVENUE,
    defaultVisible: true
  },
  {
    key: 'value_per_visitor',
    title: '1명당 유입 가치',
    tooltip: '방문자 1명당 평균 막타 결제액 (막타 결제액 ÷ UV)',
    category: COLUMN_CATEGORIES.REVENUE,
    defaultVisible: true
  },
  {
    key: 'contributed_orders_count',
    title: '기여한 주문 수',
    tooltip: '이 광고를 본 고객의 총 주문 건수',
    category: COLUMN_CATEGORIES.REVENUE,
    defaultVisible: true
  },
  {
    key: 'attributed_revenue',
    title: '기여한 결제액',
    tooltip: '기여도에 따라 배분된 결제 금액',
    category: COLUMN_CATEGORIES.REVENUE,
    defaultVisible: true
  },

  // ============ 액션 (항상 표시) ============
  {
    key: 'action',
    title: '상세',
    tooltip: '주문 보기, 원본 URL 보기 등 상세 메뉴',
    category: COLUMN_CATEGORIES.REVENUE,
    defaultVisible: true,
    alwaysVisible: true,
    fixed: 'right'
  }
];

/**
 * 기본 표시 컬럼 키 목록
 */
export const DEFAULT_VISIBLE_COLUMNS = ALL_COLUMNS
  .filter(col => col.defaultVisible)
  .map(col => col.key);

/**
 * 항상 표시해야 하는 컬럼 키 목록 (체크 해제 불가)
 */
export const ALWAYS_VISIBLE_COLUMNS = ALL_COLUMNS
  .filter(col => col.alwaysVisible)
  .map(col => col.key);

/**
 * 고정 컬럼 키 목록 (순서 변경 불가)
 */
export const FIXED_COLUMNS = ALL_COLUMNS
  .filter(col => col.fixed)
  .map(col => col.key);

/**
 * localStorage 키
 */
const STORAGE_KEY_PREFIX = 'creative_performance';
export const STORAGE_KEYS = {
  VISIBLE_COLUMNS: `${STORAGE_KEY_PREFIX}_visible_columns`,
  COLUMN_ORDER: `${STORAGE_KEY_PREFIX}_column_order`,
  KNOWN_COLUMNS: `${STORAGE_KEY_PREFIX}_known_columns`
};

/**
 * 컬럼 순서 보정: fixed-right 컬럼(action 등) 뒤에 일반 컬럼이 있으면 앞으로 이동
 * 예: [..., action, purchase_conversion_rate] → [..., purchase_conversion_rate, action]
 */
function repairColumnOrder(order) {
  const fixedRightKeys = ALL_COLUMNS.filter(c => c.fixed === 'right').map(c => c.key);
  if (fixedRightKeys.length === 0) return order;

  const fixedRight = order.filter(k => fixedRightKeys.includes(k));
  const others = order.filter(k => !fixedRightKeys.includes(k));

  // fixed-right 컬럼을 항상 맨 뒤에 배치
  return [...others, ...fixedRight];
}

/**
 * 새로 추가된 컬럼을 ALL_COLUMNS 정의 순서에 맞는 올바른 위치에 삽입
 * (맨 뒤가 아닌, 원래 있어야 할 자리에 배치)
 */
function insertColumnAtNaturalPosition(order, newKey) {
  const allColumnKeys = ALL_COLUMNS.map(c => c.key);
  const naturalIndex = allColumnKeys.indexOf(newKey);

  // ALL_COLUMNS에서 이 컬럼 바로 앞에 있는 컬럼을 찾아서 그 뒤에 삽입
  for (let i = naturalIndex - 1; i >= 0; i--) {
    const prevKey = allColumnKeys[i];
    const prevIdx = order.indexOf(prevKey);
    if (prevIdx !== -1) {
      const result = [...order];
      result.splice(prevIdx + 1, 0, newKey);
      return result;
    }
  }

  // 앞에 있는 컬럼을 못 찾으면 맨 앞에 삽입
  return [newKey, ...order];
}

/**
 * localStorage에서 설정 불러오기
 * 새로 추가된 기본 표시 컬럼이 있으면 올바른 위치에 자동으로 포함
 * 기존에 잘못 저장된 순서(action 뒤에 일반 컬럼)도 자동 수리
 */
export function loadColumnSettings() {
  try {
    const visibleStr = localStorage.getItem(STORAGE_KEYS.VISIBLE_COLUMNS);
    const orderStr = localStorage.getItem(STORAGE_KEYS.COLUMN_ORDER);

    if (!visibleStr && !orderStr) {
      return {
        visibleColumns: [...DEFAULT_VISIBLE_COLUMNS],
        columnOrder: [...DEFAULT_VISIBLE_COLUMNS]
      };
    }

    const savedVisible = visibleStr ? JSON.parse(visibleStr) : [...DEFAULT_VISIBLE_COLUMNS];
    let savedOrder = orderStr ? JSON.parse(orderStr) : [...DEFAULT_VISIBLE_COLUMNS];

    // 기존 저장된 순서 자동 수리 (fixed-right 컬럼 뒤에 일반 컬럼이 있으면 보정)
    savedOrder = repairColumnOrder(savedOrder);

    // 사용자가 알고 있는 컬럼 목록 (저장 시점에 존재했던 모든 컬럼)
    const knownStr = localStorage.getItem(STORAGE_KEYS.KNOWN_COLUMNS);
    const knownColumns = knownStr ? JSON.parse(knownStr) : null;

    // 새로 추가된 기본 표시 컬럼 감지: knownColumns에 없는 컬럼만 "새 컬럼"으로 판단
    // knownColumns가 없으면 (이전 버전 저장 데이터) 기존 방식으로 fallback
    const newDefaultColumns = knownColumns
      ? DEFAULT_VISIBLE_COLUMNS.filter(key => !knownColumns.includes(key))
      : DEFAULT_VISIBLE_COLUMNS.filter(key => !savedVisible.includes(key) && !savedOrder.includes(key));

    if (newDefaultColumns.length > 0) {
      const updatedVisible = [...savedVisible, ...newDefaultColumns];
      let updatedOrder = [...savedOrder];

      // 새 컬럼을 ALL_COLUMNS 정의 순서에 맞는 올바른 위치에 삽입
      newDefaultColumns.forEach(newKey => {
        updatedOrder = insertColumnAtNaturalPosition(updatedOrder, newKey);
      });

      // fixed-right 위치 보정 후 저장
      updatedOrder = repairColumnOrder(updatedOrder);

      localStorage.setItem(STORAGE_KEYS.VISIBLE_COLUMNS, JSON.stringify(updatedVisible));
      localStorage.setItem(STORAGE_KEYS.COLUMN_ORDER, JSON.stringify(updatedOrder));
      // 새 컬럼이 추가되었으므로 알려진 컬럼 목록도 갱신
      const allKeys = ALL_COLUMNS.map(c => c.key);
      localStorage.setItem(STORAGE_KEYS.KNOWN_COLUMNS, JSON.stringify(allKeys));
      return { visibleColumns: updatedVisible, columnOrder: updatedOrder };
    }

    // 수리된 순서를 저장소에 반영
    if (orderStr && JSON.stringify(savedOrder) !== orderStr) {
      localStorage.setItem(STORAGE_KEYS.COLUMN_ORDER, JSON.stringify(savedOrder));
    }

    return { visibleColumns: savedVisible, columnOrder: savedOrder };
  } catch (e) {
    console.error('Failed to load column settings:', e);
    return {
      visibleColumns: [...DEFAULT_VISIBLE_COLUMNS],
      columnOrder: [...DEFAULT_VISIBLE_COLUMNS]
    };
  }
}

/**
 * localStorage에 설정 저장
 */
export function saveColumnSettings(settings) {
  try {
    if (settings.visibleColumns) {
      localStorage.setItem(STORAGE_KEYS.VISIBLE_COLUMNS, JSON.stringify(settings.visibleColumns));
    }
    if (settings.columnOrder) {
      localStorage.setItem(STORAGE_KEYS.COLUMN_ORDER, JSON.stringify(settings.columnOrder));
    }
    // 저장 시점의 전체 컬럼 목록을 기록 (새 컬럼 감지용)
    const allKeys = ALL_COLUMNS.map(c => c.key);
    localStorage.setItem(STORAGE_KEYS.KNOWN_COLUMNS, JSON.stringify(allKeys));
  } catch (e) {
    console.error('Failed to save column settings:', e);
  }
}

/**
 * 설정 초기화
 */
export function resetColumnSettings() {
  try {
    localStorage.removeItem(STORAGE_KEYS.VISIBLE_COLUMNS);
    localStorage.removeItem(STORAGE_KEYS.COLUMN_ORDER);
    localStorage.removeItem(STORAGE_KEYS.KNOWN_COLUMNS);
  } catch (e) {
    console.error('Failed to reset column settings:', e);
  }
}
