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
 * 모수 평가 점수 계산 (상대 순위 기반)
 * 평균PV 50% + 평균체류시간 50%
 * @param {Array} data - 전체 광고 데이터 배열
 * @returns {Map} 각 광고의 고유키 → 점수 매핑
 */
export const calculateTrafficScores = (data) => {
  if (!data || data.length === 0) return new Map();

  // 각 지표별 정렬된 배열 생성 (내림차순 - 높을수록 좋음)
  const sortedByPV = [...data].sort((a, b) => (b.avg_pageviews || 0) - (a.avg_pageviews || 0));
  const sortedByDuration = [...data].sort((a, b) => (b.avg_duration_seconds || 0) - (a.avg_duration_seconds || 0));

  const totalCount = data.length;
  const scoreMap = new Map();

  // 각 광고에 대해 순위 기반 점수 계산
  data.forEach((item) => {
    const key = `${item.utm_source || ''}_${item.utm_campaign || ''}_${item.utm_medium || ''}_${item.creative_name || ''}`;

    // 순위 찾기 (0-based index)
    const pvRank = sortedByPV.findIndex(d => 
      d.utm_source === item.utm_source && 
      d.utm_campaign === item.utm_campaign && 
      d.utm_medium === item.utm_medium && 
      d.creative_name === item.creative_name
    );
    const durationRank = sortedByDuration.findIndex(d => 
      d.utm_source === item.utm_source && 
      d.utm_campaign === item.utm_campaign && 
      d.utm_medium === item.utm_medium && 
      d.creative_name === item.creative_name
    );

    // 순위를 점수로 변환 (1등 = 100점, 꼴등 = 0점에 가까움)
    const pvScore = totalCount > 1 ? ((totalCount - 1 - pvRank) / (totalCount - 1)) * 100 : 100;
    const durationScore = totalCount > 1 ? ((totalCount - 1 - durationRank) / (totalCount - 1)) * 100 : 100;

    // 가중치 적용: 평균PV 50%, 체류시간 50%
    const finalScore = Math.round(pvScore * 0.5 + durationScore * 0.5);

    scoreMap.set(key, {
      score: finalScore,
      pvScore: Math.round(pvScore),
      durationScore: Math.round(durationScore),
      pvRank: pvRank + 1,
      durationRank: durationRank + 1,
      totalCount
    });
  });

  return scoreMap;
};
