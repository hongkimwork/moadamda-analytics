/**
 * 데이터 변환 유틸리티
 * API 응답을 위젯에 맞게 변환
 */

import dayjs from 'dayjs';

/**
 * 데이터에서 특정 키 값 추출 (nested key 지원)
 * @param {Object} data - 데이터 객체
 * @param {string} dataKey - 키 경로 (예: "revenue.final")
 * @returns {*} - 추출된 값
 */
export const getValueFromData = (data, dataKey) => {
  if (!data || !dataKey) return null;
  const keys = dataKey.split('.');
  let value = data;
  for (const key of keys) {
    if (value === null || value === undefined) return null;
    value = value[key];
  }
  return value;
};

/**
 * 증감률 계산
 * @param {number} current - 현재 값
 * @param {number} previous - 이전 값
 * @returns {string|null} - 증감률(%) 또는 'new' (이전 값 없음)
 */
export const calculateChange = (current, previous) => {
  if (previous === null || previous === undefined) return null;
  if (previous === 0) {
    // 이전 값이 0이고 현재 값이 있으면 "신규" 표시를 위해 특수값 반환
    return current > 0 ? 'new' : '0.0';
  }
  return ((current - previous) / previous * 100).toFixed(1);
};

/**
 * 위젯 데이터 변환 함수 (프리셋별 데이터 가공)
 * @param {Object} widget - 위젯 설정
 * @param {Object} apiData - API 응답 데이터
 * @param {Object} compareApiData - 비교 기간 API 응답 데이터
 * @returns {*} - 변환된 데이터
 */
export const transformWidgetData = (widget, apiData, compareApiData) => {
  const { presetId, type, dataKey, suffix, dateRange, compareRange } = widget;

  console.log('[transformWidgetData] Input:', {
    presetId,
    type,
    dataKey,
    apiData,
    compareApiData,
    dateRange,
    compareRange
  });

  // KPI 타입
  if (type === 'kpi') {
    const value = getValueFromData(apiData, dataKey);
    const compareValue = compareApiData ? getValueFromData(compareApiData, dataKey) : null;
    const change = calculateChange(value, compareValue);

    console.log('[transformWidgetData] KPI Result:',
      'dataKey:', dataKey,
      '| value:', value,
      '| compareValue:', compareValue,
      '| change:', change
    );

    return {
      value: value || 0,
      compareValue: compareValue,  // 이전 기간 값 추가
      change: change,
      prefix: '',
      suffix: suffix || '',
      // 날짜 정보 추가
      dateRange: dateRange,
      compareRange: compareRange
    };
  }

  // Line 차트 (일별 추이)
  if (type === 'line' && presetId === 'daily_revenue') {
    const daily = apiData?.daily || [];
    return daily.map(d => ({
      date: dayjs(d.date).format('MM/DD'),
      value: d.revenue || d.final_payment || 0
    })).slice(-7); // 최근 7일
  }

  // Bar 차트 (주문경로별)
  if (type === 'bar' && presetId === 'order_place_revenue') {
    // orders 배열에서 order_place_name별 집계
    const orders = apiData?.orders || [];
    const byPlace = {};
    orders.forEach(order => {
      const place = order.order_place_name || '기타';
      if (!byPlace[place]) {
        byPlace[place] = 0;
      }
      byPlace[place] += order.final_payment || 0;
    });

    return Object.entries(byPlace)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // 상위 5개
  }

  // Table (최근 주문)
  if (type === 'table' && presetId === 'recent_orders') {
    const orders = apiData?.orders || [];
    return orders.slice(0, 10).map(order => ({
      order_id: order.order_id,
      product_name: order.product_name || '-',
      final_payment: order.final_payment || 0,
      timestamp: order.timestamp,
      order_place: order.order_place_name || '-'
    }));
  }

  // Table (상품별 판매순위)
  if (type === 'table' && presetId === 'top_products') {
    const orders = apiData?.orders || [];
    const byProduct = {};
    orders.forEach(order => {
      const name = order.product_name || '기타';
      if (!byProduct[name]) {
        byProduct[name] = { count: 0, revenue: 0 };
      }
      byProduct[name].count += 1;
      byProduct[name].revenue += order.final_payment || 0;
    });

    return Object.entries(byProduct)
      .map(([product_name, data]) => ({
        product_name,
        order_count: data.count,
        revenue: data.revenue
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }

  // 기본 반환
  return apiData;
};
