// ============================================================================
// 데이터 포맷팅 유틸리티
// ============================================================================

/**
 * 체류시간 포맷팅 (초 → 분:초)
 * @param {number} seconds - 초 단위 시간
 * @returns {string} 포맷팅된 문자열 (예: "2분 30초", "45초")
 */
export const formatDuration = (seconds) => {
  if (!seconds || seconds === 0) return '0초';

  const numSeconds = parseFloat(seconds);
  if (numSeconds < 60) {
    return `${Math.round(numSeconds)}초`;
  }

  const minutes = Math.floor(numSeconds / 60);
  const remainSeconds = Math.round(numSeconds % 60);

  if (remainSeconds === 0) {
    return `${minutes}분`;
  }

  return `${minutes}분 ${remainSeconds}초`;
};

/**
 * 금액 포맷팅
 * @param {number} amount - 금액
 * @returns {string} 포맷팅된 문자열 (예: "1,000,000원")
 */
export const formatCurrency = (amount) => {
  if (!amount || amount === 0) return '0원';
  return `${parseInt(amount).toLocaleString()}원`;
};

/**
 * 숫자 포맷팅
 * @param {number} num - 숫자
 * @returns {string} 포맷팅된 문자열 (예: "1,000")
 */
export const formatNumber = (num) => {
  if (!num || num === 0) return '0';
  return parseInt(num).toLocaleString();
};

/**
 * 상대평가: 순위 기반 점수 계산 (동적 구간 지원)
 * @param {number} rank - 순위 (0-based, 동점자 고려된 순위)
 * @param {number} totalCount - 전체 개수
 * @param {Object} config - 구간 설정 { boundaries: [10, 30, 60, ...], scores: [100, 80, 50, 20, ...] }
 * @returns {number} 점수
 */
const calculateRelativeScore = (rank, totalCount, config) => {
  if (totalCount === 0) return 0;
  
  // 상위 몇 %인지 계산 (동점자는 같은 순위이므로 rank+1 사용)
  const percentile = ((rank + 1) / totalCount) * 100;
  
  // 동적 구간에 따른 점수 반환
  const { boundaries, scores } = config;
  for (let i = 0; i < boundaries.length; i++) {
    if (percentile <= boundaries[i]) {
      return scores[i];
    }
  }
  // 어떤 구간에도 해당하지 않으면 마지막 점수 (그 외 나머지)
  return scores[scores.length - 1];
};

/**
 * 백분위 방식: 순위 기반 연속 점수 계산
 * 공식: 백분위 점수 = (1 - 순위/전체) × 100
 * @param {number} rank - 순위 (0-based, 동점자 고려된 순위)
 * @param {number} totalCount - 전체 개수
 * @returns {number} 점수 (1~99, 반올림)
 */
const calculatePercentileScore = (rank, totalCount) => {
  if (totalCount === 0) return 0;
  if (totalCount === 1) return 100; // 1개만 있으면 100점
  
  // 백분위 점수 = (1 - (순위 / (전체-1))) × 100
  // rank는 0-based이므로 0이면 1등
  const score = Math.round((1 - rank / (totalCount - 1)) * 100);
  
  // 최소 1점, 최대 100점 보장
  return Math.max(1, Math.min(100, score));
};

/**
 * 동점자를 고려한 순위 맵 생성
 * @param {Array} sortedData - 정렬된 데이터 배열
 * @param {Function} getValue - 값을 추출하는 함수
 * @param {Function} getKey - 고유 키를 추출하는 함수
 * @returns {Map} 키 → 순위 매핑 (동점자는 같은 순위)
 */
const createRankMap = (sortedData, getValue, getKey) => {
  const rankMap = new Map();
  let currentRank = 0;
  let prevValue = null;

  sortedData.forEach((item, index) => {
    const value = getValue(item);
    const key = getKey(item);
    
    // 이전 값과 다르면 순위 갱신 (동점자는 같은 순위 유지)
    if (prevValue === null || value !== prevValue) {
      currentRank = index;
    }
    
    rankMap.set(key, currentRank);
    prevValue = value;
  });

  return rankMap;
};

/**
 * 절대평가: 수치 기반 점수 계산 (동적 구간 지원)
 * @param {number} value - 실제 수치
 * @param {Object} config - 구간 설정 { boundaries: [120, 60, 30, ...], scores: [100, 80, 50, 20, ...] }
 * @returns {number} 점수
 */
const calculateAbsoluteScore = (value, config) => {
  const { boundaries, scores } = config;
  // 동적 구간: 가장 높은 경계값부터 체크 (내림차순)
  for (let i = 0; i < boundaries.length; i++) {
    if (value >= boundaries[i]) {
      return scores[i];
    }
  }
  // 어떤 구간에도 해당하지 않으면 마지막 점수 (그 외 나머지)
  return scores[scores.length - 1];
};

/**
 * 모수 평가 점수 계산 (사용자 설정 기반 - 동적 지표 지원)
 * - 선택된 지표(enabled_metrics)만 점수 계산에 포함
 * - 데이터가 없는 지표는 0점 처리 (가중치 재분배 없이 해당 비율만큼 점수 차감)
 * @param {Array} data - 전체 광고 데이터 배열
 * @param {Object|null} settings - 사용자 설정 (null이면 점수 계산 안 함)
 * @returns {Map} 각 광고의 고유키 → 점수 매핑
 */
export const calculateTrafficScores = (data, settings = null) => {
  if (!data || data.length === 0) return new Map();
  
  // 설정이 없으면 빈 Map 반환 (점수 표시 안 함)
  if (!settings) return new Map();

  const {
    evaluation_type,
    relative_mode = 'range', // 'range' (구간 점수) 또는 'percentile' (백분위)
    weight_scroll = 0,
    weight_pv = 0,
    weight_duration = 0,
    weight_view = 0,
    weight_uv = 0,
    scroll_config,
    pv_config,
    duration_config,
    view_config,
    uv_config,
    enabled_metrics = ['scroll', 'pv', 'duration']
  } = settings;

  // 백분위 방식 여부
  const isPercentileMode = evaluation_type === 'relative' && relative_mode === 'percentile';

  const totalCount = data.length;
  const scoreMap = new Map();

  // 지표 정의 (동적 처리용)
  const metricDefinitions = {
    scroll: { 
      weight: weight_scroll, 
      config: scroll_config, 
      getValue: (item) => item.avg_scroll_px || 0,
      label: '스크롤'
    },
    pv: { 
      weight: weight_pv, 
      config: pv_config, 
      getValue: (item) => item.avg_pageviews || 0,
      label: 'PV'
    },
    duration: { 
      weight: weight_duration, 
      config: duration_config, 
      getValue: (item) => item.avg_duration_seconds || 0,
      label: '체류시간'
    },
    view: { 
      weight: weight_view, 
      config: view_config, 
      getValue: (item) => item.total_views || 0,
      label: 'View'
    },
    uv: { 
      weight: weight_uv, 
      config: uv_config, 
      getValue: (item) => item.unique_visitors || 0,
      label: 'UV'
    }
  };

  // 상대평가인 경우 순위 계산을 위한 순위 맵 생성
  const rankMaps = {};
  if (evaluation_type === 'relative') {
    const getKey = (item) => `${item.utm_source || ''}_${item.utm_campaign || ''}_${item.utm_medium || ''}_${item.creative_name || ''}`;
    
    enabled_metrics.forEach(metric => {
      const def = metricDefinitions[metric];
      // 백분위 방식이면 config 없이도 순위 맵 생성
      if (def && (isPercentileMode || def.config)) {
        const sorted = [...data].sort((a, b) => (def.getValue(b)) - (def.getValue(a)));
        rankMaps[metric] = createRankMap(sorted, def.getValue, getKey);
      }
    });
  }

  // 각 광고에 대해 점수 계산
  data.forEach((item) => {
    const key = `${item.utm_source || ''}_${item.utm_campaign || ''}_${item.utm_medium || ''}_${item.creative_name || ''}`;

    // 각 지표별 점수 계산
    const metricScores = {};
    const metricValues = {};
    const deductedMetrics = [];
    let totalDeducted = 0;
    let weightedSum = 0;

    enabled_metrics.forEach(metric => {
      const def = metricDefinitions[metric];
      // 백분위 방식이면 config가 없어도 됨
      if (!def || (!isPercentileMode && !def.config)) return;

      const value = def.getValue(item);
      const isZero = value === 0;
      metricValues[metric] = value;

      let score = 0;
      if (!isZero) {
        if (evaluation_type === 'relative') {
          const rank = rankMaps[metric]?.get(key) || 0;
          if (isPercentileMode) {
            // 백분위 방식: 연속적 점수
            score = calculatePercentileScore(rank, totalCount);
          } else {
            // 구간 점수 방식
            score = calculateRelativeScore(rank, totalCount, def.config);
          }
        } else {
          // 절대평가
          score = calculateAbsoluteScore(value, def.config);
        }
      }

      metricScores[metric] = score;

      // 가중치 적용
      weightedSum += score * def.weight;

      // 0인 지표 차감 기록
      if (isZero && def.weight > 0) {
        deductedMetrics.push(`${def.label} ${def.weight}%`);
        totalDeducted += def.weight;
      }
    });

    // 최종 점수 계산
    const finalScore = Math.round(weightedSum / 100);

    scoreMap.set(key, {
      score: finalScore,
      hasWarning: deductedMetrics.length > 0,
      warningMessage: deductedMetrics.length > 0 
        ? `${deductedMetrics.join(', ')} 데이터 없음 (총 ${totalDeducted}% 차감)` 
        : null,
      // 각 지표별 점수 상세 (툴팁용)
      metricScores,
      metricValues,
      enabledMetrics: enabled_metrics,
      weights: {
        scroll: weight_scroll,
        pv: weight_pv,
        duration: weight_duration,
        view: weight_view,
        uv: weight_uv
      },
      deductedPercent: totalDeducted,
      isPercentileMode
    });
  });

  return scoreMap;
};
