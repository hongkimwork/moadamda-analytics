/**
 * Meta Insights 컬럼 정의
 * 모든 사용 가능한 지표와 기본 설정
 */

// 컬럼 카테고리
export const COLUMN_CATEGORIES = {
  BASIC: '기본 정보',
  PERFORMANCE: '성과',
  ENGAGEMENT: '참여',
  COST: '비용',
  CONVERSION: '전환',
  VIDEO: '동영상'
};

/**
 * 모든 컬럼 정의
 * - key: 고유 식별자
 * - title: 표시 이름
 * - tooltip: 설명
 * - category: 카테고리
 * - width: 기본 너비
 * - align: 정렬
 * - render: 렌더링 함수 타입
 * - defaultVisible: 기본 표시 여부
 * - availableFor: 사용 가능한 탭 (campaign, adset, ad)
 */
export const ALL_COLUMNS = [
  // ============ 기본 정보 ============
  {
    key: 'name',
    title: '이름',
    tooltip: '캠페인/광고세트/광고 이름',
    category: COLUMN_CATEGORIES.BASIC,
    width: 350,
    minWidth: 150,
    align: 'left',
    render: 'name',
    defaultVisible: true,
    resizable: true,
    availableFor: ['campaign', 'adset', 'ad']
  },
  {
    key: 'status',
    title: '상태',
    tooltip: '현재 게재 상태',
    category: COLUMN_CATEGORIES.BASIC,
    width: 100,
    align: 'left',
    render: 'status',
    defaultVisible: true,
    availableFor: ['campaign', 'adset', 'ad']
  },
  {
    key: 'objective',
    title: '목표',
    tooltip: '캠페인 목표',
    category: COLUMN_CATEGORIES.BASIC,
    width: 120,
    align: 'left',
    render: 'text',
    defaultVisible: true,
    availableFor: ['campaign']
  },
  {
    key: 'optimization_goal',
    title: '최적화 목표',
    tooltip: '광고 세트 최적화 목표',
    category: COLUMN_CATEGORIES.BASIC,
    width: 140,
    align: 'left',
    render: 'text',
    defaultVisible: true,
    availableFor: ['adset']
  },
  {
    key: 'bid_strategy',
    title: '입찰 전략',
    tooltip: '입찰 전략',
    category: COLUMN_CATEGORIES.BASIC,
    width: 120,
    align: 'left',
    render: 'text',
    defaultVisible: true,
    availableFor: ['adset']
  },
  {
    key: 'daily_budget',
    title: '일일 예산',
    tooltip: '일일 예산',
    category: COLUMN_CATEGORIES.BASIC,
    width: 120,
    align: 'right',
    render: 'budget',
    defaultVisible: false,
    availableFor: ['campaign', 'adset']
  },
  {
    key: 'lifetime_budget',
    title: '총 예산',
    tooltip: '총 예산',
    category: COLUMN_CATEGORIES.BASIC,
    width: 120,
    align: 'right',
    render: 'budget',
    defaultVisible: false,
    availableFor: ['campaign', 'adset']
  },

  // ============ 성과 ============
  {
    key: 'impressions',
    title: '노출',
    tooltip: '광고가 화면에 표시된 횟수',
    category: COLUMN_CATEGORIES.PERFORMANCE,
    width: 120,
    align: 'right',
    render: 'number',
    insightKey: 'impressions',
    defaultVisible: true,
    availableFor: ['campaign', 'adset', 'ad']
  },
  {
    key: 'reach',
    title: '도달',
    tooltip: '광고를 본 고유 계정 수',
    category: COLUMN_CATEGORIES.PERFORMANCE,
    width: 120,
    align: 'right',
    render: 'number',
    insightKey: 'reach',
    defaultVisible: true,
    availableFor: ['campaign', 'adset', 'ad']
  },
  {
    key: 'frequency',
    title: '빈도',
    tooltip: '1인당 평균 노출 횟수',
    category: COLUMN_CATEGORIES.PERFORMANCE,
    width: 80,
    align: 'right',
    render: 'decimal',
    insightKey: 'frequency',
    defaultVisible: true,
    availableFor: ['campaign', 'adset', 'ad']
  },
  {
    key: 'clicks',
    title: '클릭(전체)',
    tooltip: '모든 클릭 수',
    category: COLUMN_CATEGORIES.PERFORMANCE,
    width: 100,
    align: 'right',
    render: 'number',
    insightKey: 'clicks',
    defaultVisible: true,
    availableFor: ['campaign', 'adset', 'ad']
  },
  {
    key: 'inline_link_clicks',
    title: '링크 클릭',
    tooltip: '링크 클릭 수',
    category: COLUMN_CATEGORIES.PERFORMANCE,
    width: 100,
    align: 'right',
    render: 'number',
    insightKey: 'inline_link_clicks',
    defaultVisible: false,
    availableFor: ['campaign', 'adset', 'ad']
  },
  {
    key: 'ctr',
    title: 'CTR',
    tooltip: '클릭률 (클릭/노출)',
    category: COLUMN_CATEGORIES.PERFORMANCE,
    width: 80,
    align: 'right',
    render: 'percent',
    insightKey: 'ctr',
    defaultVisible: true,
    availableFor: ['campaign', 'adset', 'ad']
  },
  {
    key: 'outbound_clicks',
    title: '아웃바운드 클릭',
    tooltip: '외부 링크 클릭 수',
    category: COLUMN_CATEGORIES.PERFORMANCE,
    width: 130,
    align: 'right',
    render: 'actionValue',
    insightKey: 'outbound_clicks',
    defaultVisible: false,
    availableFor: ['campaign', 'adset', 'ad']
  },

  // ============ 비용 ============
  {
    key: 'spend',
    title: '지출 금액',
    tooltip: '총 광고비',
    category: COLUMN_CATEGORIES.COST,
    width: 120,
    align: 'right',
    render: 'currency',
    insightKey: 'spend',
    defaultVisible: true,
    availableFor: ['campaign', 'adset', 'ad']
  },
  {
    key: 'cpc',
    title: 'CPC',
    tooltip: '클릭당 비용',
    category: COLUMN_CATEGORIES.COST,
    width: 100,
    align: 'right',
    render: 'currency',
    insightKey: 'cpc',
    defaultVisible: true,
    availableFor: ['campaign', 'adset', 'ad']
  },
  {
    key: 'cpm',
    title: 'CPM',
    tooltip: '1,000회 노출당 비용',
    category: COLUMN_CATEGORIES.COST,
    width: 100,
    align: 'right',
    render: 'currency',
    insightKey: 'cpm',
    defaultVisible: true,
    availableFor: ['campaign', 'adset', 'ad']
  },
  {
    key: 'cpp',
    title: 'CPP',
    tooltip: '1,000명 도달당 비용',
    category: COLUMN_CATEGORIES.COST,
    width: 100,
    align: 'right',
    render: 'currency',
    insightKey: 'cpp',
    defaultVisible: false,
    availableFor: ['campaign', 'adset', 'ad']
  },

  // ============ 전환 ============
  {
    key: 'results',
    title: '결과',
    tooltip: '전환 행동 수 (구매 등)',
    category: COLUMN_CATEGORIES.CONVERSION,
    width: 100,
    align: 'right',
    render: 'results',
    insightKey: 'actions',
    defaultVisible: true,
    availableFor: ['campaign', 'adset', 'ad']
  },
  {
    key: 'cost_per_result',
    title: '결과당 비용',
    tooltip: '전환당 비용 (CPA)',
    category: COLUMN_CATEGORIES.CONVERSION,
    width: 120,
    align: 'right',
    render: 'costPerResult',
    insightKey: 'cost_per_action_type',
    defaultVisible: false,
    availableFor: ['campaign', 'adset', 'ad']
  },
  {
    key: 'purchase_roas',
    title: 'ROAS',
    tooltip: '광고 수익률 (전환가치/지출)',
    category: COLUMN_CATEGORIES.CONVERSION,
    width: 100,
    align: 'right',
    render: 'roas',
    insightKey: 'purchase_roas',
    defaultVisible: true,
    availableFor: ['campaign', 'adset', 'ad']
  },
  {
    key: 'website_purchase_roas',
    title: '웹사이트 ROAS',
    tooltip: '웹사이트 구매 ROAS',
    category: COLUMN_CATEGORIES.CONVERSION,
    width: 130,
    align: 'right',
    render: 'roas',
    insightKey: 'website_purchase_roas',
    defaultVisible: false,
    availableFor: ['campaign', 'adset', 'ad']
  },
  {
    key: 'action_values',
    title: '전환 가치',
    tooltip: '전환으로 발생한 총 가치',
    category: COLUMN_CATEGORIES.CONVERSION,
    width: 120,
    align: 'right',
    render: 'actionValues',
    insightKey: 'action_values',
    defaultVisible: false,
    availableFor: ['campaign', 'adset', 'ad']
  },

  // ============ 참여 ============
  {
    key: 'inline_post_engagement',
    title: '게시물 참여',
    tooltip: '게시물 참여 수',
    category: COLUMN_CATEGORIES.ENGAGEMENT,
    width: 120,
    align: 'right',
    render: 'number',
    insightKey: 'inline_post_engagement',
    defaultVisible: false,
    availableFor: ['campaign', 'adset', 'ad']
  },

  // ============ 동영상 ============
  {
    key: 'video_play_actions',
    title: '동영상 재생',
    tooltip: '동영상 재생 횟수',
    category: COLUMN_CATEGORIES.VIDEO,
    width: 120,
    align: 'right',
    render: 'actionValue',
    insightKey: 'video_play_actions',
    defaultVisible: false,
    availableFor: ['campaign', 'adset', 'ad']
  },
  {
    key: 'video_p25',
    title: '25% 시청',
    tooltip: '동영상 25% 시청 횟수',
    category: COLUMN_CATEGORIES.VIDEO,
    width: 100,
    align: 'right',
    render: 'actionValue',
    insightKey: 'video_p25_watched_actions',
    defaultVisible: false,
    availableFor: ['campaign', 'adset', 'ad']
  },
  {
    key: 'video_p50',
    title: '50% 시청',
    tooltip: '동영상 50% 시청 횟수',
    category: COLUMN_CATEGORIES.VIDEO,
    width: 100,
    align: 'right',
    render: 'actionValue',
    insightKey: 'video_p50_watched_actions',
    defaultVisible: false,
    availableFor: ['campaign', 'adset', 'ad']
  },
  {
    key: 'video_p75',
    title: '75% 시청',
    tooltip: '동영상 75% 시청 횟수',
    category: COLUMN_CATEGORIES.VIDEO,
    width: 100,
    align: 'right',
    render: 'actionValue',
    insightKey: 'video_p75_watched_actions',
    defaultVisible: false,
    availableFor: ['campaign', 'adset', 'ad']
  },
  {
    key: 'video_p100',
    title: '100% 시청',
    tooltip: '동영상 100% 시청 횟수',
    category: COLUMN_CATEGORIES.VIDEO,
    width: 100,
    align: 'right',
    render: 'actionValue',
    insightKey: 'video_p100_watched_actions',
    defaultVisible: false,
    availableFor: ['campaign', 'adset', 'ad']
  },
  {
    key: 'cost_per_thruplay',
    title: 'ThruPlay 비용',
    tooltip: 'ThruPlay당 비용',
    category: COLUMN_CATEGORIES.VIDEO,
    width: 130,
    align: 'right',
    render: 'actionCurrency',
    insightKey: 'cost_per_thruplay',
    defaultVisible: false,
    availableFor: ['campaign', 'adset', 'ad']
  }
];

/**
 * 탭별 기본 표시 컬럼 키 목록
 */
export const DEFAULT_VISIBLE_COLUMNS = {
  campaign: ['name', 'status', 'objective', 'impressions', 'reach', 'frequency', 'clicks', 'ctr', 'cpc', 'cpm', 'spend', 'results', 'purchase_roas'],
  adset: ['name', 'status', 'optimization_goal', 'bid_strategy', 'impressions', 'reach', 'frequency', 'clicks', 'ctr', 'cpc', 'cpm', 'spend', 'results', 'purchase_roas'],
  ad: ['name', 'status', 'impressions', 'reach', 'frequency', 'clicks', 'ctr', 'cpc', 'cpm', 'spend', 'results', 'purchase_roas', 'video_play_actions', 'cost_per_thruplay']
};

/**
 * 탭별 사용 가능한 컬럼 필터링
 */
export function getColumnsForTab(tabType) {
  return ALL_COLUMNS.filter(col => col.availableFor.includes(tabType));
}

/**
 * 기본 컬럼 너비 설정 가져오기
 */
export function getDefaultColumnWidths(tabType) {
  const columns = getColumnsForTab(tabType);
  const widths = {};
  columns.forEach(col => {
    // 광고 탭의 이름 컬럼은 썸네일 때문에 더 넓게
    if (col.key === 'name' && tabType === 'ad') {
      widths[col.key] = 400;
    } else {
      widths[col.key] = col.width;
    }
  });
  return widths;
}

/**
 * localStorage 키
 */
export const STORAGE_KEYS = {
  VISIBLE_COLUMNS: 'meta_insights_visible_columns',
  COLUMN_WIDTHS: 'meta_insights_column_widths',
  COLUMN_ORDER: 'meta_insights_column_order'
};

/**
 * localStorage에서 설정 불러오기
 */
export function loadColumnSettings(tabType) {
  try {
    const visibleStr = localStorage.getItem(`${STORAGE_KEYS.VISIBLE_COLUMNS}_${tabType}`);
    const widthsStr = localStorage.getItem(`${STORAGE_KEYS.COLUMN_WIDTHS}_${tabType}`);
    const orderStr = localStorage.getItem(`${STORAGE_KEYS.COLUMN_ORDER}_${tabType}`);

    return {
      visibleColumns: visibleStr ? JSON.parse(visibleStr) : DEFAULT_VISIBLE_COLUMNS[tabType],
      columnWidths: widthsStr ? JSON.parse(widthsStr) : getDefaultColumnWidths(tabType),
      columnOrder: orderStr ? JSON.parse(orderStr) : null
    };
  } catch (e) {
    console.error('Failed to load column settings:', e);
    return {
      visibleColumns: DEFAULT_VISIBLE_COLUMNS[tabType],
      columnWidths: getDefaultColumnWidths(tabType),
      columnOrder: null
    };
  }
}

/**
 * localStorage에 설정 저장
 */
export function saveColumnSettings(tabType, settings) {
  try {
    if (settings.visibleColumns) {
      localStorage.setItem(`${STORAGE_KEYS.VISIBLE_COLUMNS}_${tabType}`, JSON.stringify(settings.visibleColumns));
    }
    if (settings.columnWidths) {
      localStorage.setItem(`${STORAGE_KEYS.COLUMN_WIDTHS}_${tabType}`, JSON.stringify(settings.columnWidths));
    }
    if (settings.columnOrder) {
      localStorage.setItem(`${STORAGE_KEYS.COLUMN_ORDER}_${tabType}`, JSON.stringify(settings.columnOrder));
    }
  } catch (e) {
    console.error('Failed to save column settings:', e);
  }
}

/**
 * 설정 초기화
 */
export function resetColumnSettings(tabType) {
  try {
    localStorage.removeItem(`${STORAGE_KEYS.VISIBLE_COLUMNS}_${tabType}`);
    localStorage.removeItem(`${STORAGE_KEYS.COLUMN_WIDTHS}_${tabType}`);
    localStorage.removeItem(`${STORAGE_KEYS.COLUMN_ORDER}_${tabType}`);
  } catch (e) {
    console.error('Failed to reset column settings:', e);
  }
}
