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
 * 모수 평가 점수 계산 (사용자 설정 기반)
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
    weight_scroll,
    weight_pv,
    weight_duration,
    scroll_config,
    pv_config,
    duration_config
  } = settings;

  const totalCount = data.length;
  const scoreMap = new Map();

  // 상대평가인 경우 순위 계산을 위한 정렬 및 순위 맵 생성
  let scrollRankMap, pvRankMap, durationRankMap;
  if (evaluation_type === 'relative') {
    const getKey = (item) => `${item.utm_source || ''}_${item.utm_campaign || ''}_${item.utm_medium || ''}_${item.creative_name || ''}`;
    
    const sortedByScroll = [...data].sort((a, b) => (b.avg_scroll_px || 0) - (a.avg_scroll_px || 0));
    const sortedByPV = [...data].sort((a, b) => (b.avg_pageviews || 0) - (a.avg_pageviews || 0));
    const sortedByDuration = [...data].sort((a, b) => (b.avg_duration_seconds || 0) - (a.avg_duration_seconds || 0));
    
    // 동점자를 고려한 순위 맵 생성
    scrollRankMap = createRankMap(sortedByScroll, (item) => item.avg_scroll_px || 0, getKey);
    pvRankMap = createRankMap(sortedByPV, (item) => item.avg_pageviews || 0, getKey);
    durationRankMap = createRankMap(sortedByDuration, (item) => item.avg_duration_seconds || 0, getKey);
  }

  // 각 광고에 대해 점수 계산
  data.forEach((item) => {
    const key = `${item.utm_source || ''}_${item.utm_campaign || ''}_${item.utm_medium || ''}_${item.creative_name || ''}`;

    const scrollValue = item.avg_scroll_px || 0;
    const pvValue = item.avg_pageviews || 0;
    const durationValue = item.avg_duration_seconds || 0;

    // 0인 지표 확인
    const isScrollZero = scrollValue === 0;
    const isPvZero = pvValue === 0;
    const isDurationZero = durationValue === 0;

    // 모든 지표가 0이면 데이터 부족
    if (isScrollZero && isPvZero && isDurationZero) {
      scoreMap.set(key, {
        score: null,
        hasWarning: true,
        warningMessage: '데이터 부족',
        scrollScore: null,
        pvScore: null,
        durationScore: null
      });
      return;
    }

    // 유효한 지표만으로 가중치 재분배
    let effectiveWeightScroll = isScrollZero ? 0 : weight_scroll;
    let effectiveWeightPv = isPvZero ? 0 : weight_pv;
    let effectiveWeightDuration = isDurationZero ? 0 : weight_duration;
    const totalEffectiveWeight = effectiveWeightScroll + effectiveWeightPv + effectiveWeightDuration;

    // 100%로 재분배
    if (totalEffectiveWeight > 0 && totalEffectiveWeight !== 100) {
      const ratio = 100 / totalEffectiveWeight;
      effectiveWeightScroll = Math.round(effectiveWeightScroll * ratio);
      effectiveWeightPv = Math.round(effectiveWeightPv * ratio);
      effectiveWeightDuration = Math.round(effectiveWeightDuration * ratio);
    }

    let scrollScore = 0, pvScore = 0, durationScore = 0;

    if (evaluation_type === 'relative') {
      // 상대평가: 순위 기반 (동점자 고려된 순위 맵 사용)
      if (!isScrollZero) {
        const scrollRank = scrollRankMap.get(key) || 0;
        scrollScore = calculateRelativeScore(scrollRank, totalCount, scroll_config);
      }
      if (!isPvZero) {
        const pvRank = pvRankMap.get(key) || 0;
        pvScore = calculateRelativeScore(pvRank, totalCount, pv_config);
      }
      if (!isDurationZero) {
        const durationRank = durationRankMap.get(key) || 0;
        durationScore = calculateRelativeScore(durationRank, totalCount, duration_config);
      }
    } else {
      // 절대평가: 수치 기반
      if (!isScrollZero) {
        scrollScore = calculateAbsoluteScore(scrollValue, scroll_config);
      }
      if (!isPvZero) {
        pvScore = calculateAbsoluteScore(pvValue, pv_config);
      }
      if (!isDurationZero) {
        durationScore = calculateAbsoluteScore(durationValue, duration_config);
      }
    }

    // 가중치 적용하여 최종 점수 계산
    const finalScore = Math.round(
      (scrollScore * effectiveWeightScroll + pvScore * effectiveWeightPv + durationScore * effectiveWeightDuration) / 100
    );

    // 경고 메시지 생성
    const zeroMetrics = [];
    if (isScrollZero) zeroMetrics.push('스크롤');
    if (isPvZero) zeroMetrics.push('PV');
    if (isDurationZero) zeroMetrics.push('체류시간');

    scoreMap.set(key, {
      score: finalScore,
      hasWarning: zeroMetrics.length > 0,
      warningMessage: zeroMetrics.length > 0 ? `${zeroMetrics.join(', ')} 데이터가 없어 나머지 지표로 계산됨` : null,
      scrollScore: isScrollZero ? null : scrollScore,
      pvScore: isPvZero ? null : pvScore,
      durationScore: isDurationZero ? null : durationScore
    });
  });

  return scoreMap;
};
