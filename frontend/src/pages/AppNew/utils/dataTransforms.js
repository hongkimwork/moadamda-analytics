/**
 * API 응답 데이터를 화면 표시용 stats 객체로 변환
 * @param {Object} rangeData - /api/stats/range 응답 데이터
 * @returns {Object} 화면 표시용 stats 객체
 */
export function transformStatsData(rangeData) {
  return {
    visitors: {
      total: rangeData.visitors.total,
      new: rangeData.visitors.new,
      returning: rangeData.visitors.returning,
      change_percent: rangeData.comparison?.visitors?.change_percent || 0
    },
    pageviews: {
      total: rangeData.pageviews,
      change_percent: rangeData.comparison?.pageviews?.change_percent || 0
    },
    revenue: {
      total: rangeData.revenue.final,
      change_percent: rangeData.comparison?.final_revenue?.change_percent || 0
    },
    orders: {
      count: rangeData.orders.count,
      aov: rangeData.orders.final_aov,
      change_percent: rangeData.comparison?.orders?.change_percent || 0
    },
    conversion: {
      rate: parseFloat(rangeData.conversion_rate),
      cart_abandonment: parseFloat(rangeData.cart_abandonment_rate)
    },
    devices: rangeData.devices,
    products: rangeData.products
  };
}

/**
 * 일별 데이터를 스파크라인 데이터로 변환
 * @param {Array} dailyData - 일별 데이터 배열
 * @param {string} key - 추출할 키 (예: 'revenue', 'visitors')
 * @returns {Array} 스파크라인 데이터 [{ value: number }, ...]
 */
export function createSparklineData(dailyData, key) {
  if (!dailyData || dailyData.length === 0) {
    return [];
  }
  return dailyData.map(d => ({ value: d[key] || 0 }));
}

/**
 * 어트리뷰션 비교 차트 데이터 생성
 * @param {Array} durationAttributions - 체류시간 기반 어트리뷰션 배열
 * @param {Array} ga4Attributions - GA4 어트리뷰션 배열
 * @param {number} limit - 표시할 캠페인 개수
 * @returns {Array} 차트 데이터
 */
export function createAttributionComparisonData(durationAttributions, ga4Attributions, limit = 5) {
  return durationAttributions.slice(0, limit).map(item => {
    const ga4Item = ga4Attributions.find(g => g.utm_campaign === item.utm_campaign);
    return {
      campaign: item.utm_campaign,
      'GA4 (Last Click)': Math.round(ga4Item?.revenue || 0),
      '체류시간 기반': Math.round(item.revenue)
    };
  });
}
