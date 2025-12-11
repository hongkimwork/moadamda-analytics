import dayjs from 'dayjs';
import { formatPeriodLabel, formatDetailedPeriod } from './helpers';

// ============================================================================
// 데이터 변환 유틸리티
// ============================================================================

// 데이터에서 특정 키 값 추출 (nested key 지원)
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

// 증감률 계산 (이전 값이 0일 때도 처리)
export const calculateChange = (current, previous) => {
  if (previous === null || previous === undefined) return null;
  if (previous === 0) {
    // 이전 값이 0이고 현재 값이 있으면 "신규" 표시를 위해 특수값 반환
    return current > 0 ? 'new' : '0.0';
  }
  return ((current - previous) / previous * 100).toFixed(1);
};

// 위젯 데이터 변환 함수 (프리셋별 데이터 가공) - 다중 비교 기간 지원
export const transformWidgetData = (widget, apiData, compareDataList) => {
  const { presetId, type, dataKey, suffix, dateRange, compareRanges, compareRange } = widget;

  console.log('[transformWidgetData] Input:', {
    presetId,
    type,
    dataKey,
    apiData,
    compareDataList,
    dateRange,
    compareRanges
  });

  // KPI 타입 - 첫 번째 비교 기간만 사용 (기존 호환)
  if (type === 'kpi') {
    const value = getValueFromData(apiData, dataKey);
    const firstCompare = compareDataList && compareDataList.length > 0 ? compareDataList[0] : null;
    const compareValue = firstCompare?.data ? getValueFromData(firstCompare.data, dataKey) : null;
    const change = calculateChange(value, compareValue);

    console.log('[transformWidgetData] KPI Result:', 
      'dataKey:', dataKey,
      '| value:', value,
      '| compareValue:', compareValue,
      '| change:', change
    );

    return {
      value: value || 0,
      compareValue: compareValue,
      change: change,
      prefix: '',
      suffix: suffix || '',
      dateRange: dateRange,
      compareRange: firstCompare || compareRange
    };
  }

  // 기간별 매출 비교 차트 - 다중 비교 기간 지원
  if (type === 'period_compare' && presetId === 'period_revenue_compare') {
    const currentValue = getValueFromData(apiData, dataKey) || 0;
    const currentLabel = formatPeriodLabel(dateRange);
    
    // 차트 데이터 구성: 현재 기간 + 모든 비교 기간
    const chartData = [
      { name: currentLabel || '현재 기간', value: currentValue, period: 'current', detailed: formatDetailedPeriod(dateRange) }
    ];
    
    // 비교 기간 데이터 추가
    const compareValues = [];
    if (compareDataList && compareDataList.length > 0) {
      compareDataList.forEach((compareItem, index) => {
        const value = compareItem.data ? getValueFromData(compareItem.data, dataKey) : 0;
        const label = formatPeriodLabel(compareItem);
        chartData.push({
          name: label || `비교 ${index + 1}`,
          value: value || 0,
          period: `compare-${index}`,
          detailed: formatDetailedPeriod(compareItem)
        });
        compareValues.push({
          value: value || 0,
          change: calculateChange(currentValue, value || 0),
          label: label
        });
      });
    }
    
    // 상세 날짜 정보 (다중)
    const detailedDates = {
      current: formatDetailedPeriod(dateRange),
      compares: compareDataList ? compareDataList.map(item => formatDetailedPeriod(item)) : []
    };
    
    return {
      chartData,
      currentValue,
      compareValues, // 여러 비교 값 배열
      // 첫 번째 비교 기간과의 증감률 (레거시 호환)
      compareValue: compareValues.length > 0 ? compareValues[0].value : 0,
      change: compareValues.length > 0 ? compareValues[0].change : null,
      detailedDates
    };
  }

  // Line 차트 (일별 추이) - 레거시 지원
  if (type === 'line' && presetId === 'daily_revenue') {
    const daily = apiData?.daily_data || [];
    return daily.map(d => ({
      date: dayjs(d.date).format('MM/DD'),
      value: d.revenue || d.final_payment || 0
    }));
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

  // ============================================================================
  // 방문자 분석 차트 변환
  // ============================================================================

  // 파이 차트 (디바이스별 방문자)
  if (type === 'pie' && presetId === 'device_breakdown') {
    const device = apiData?.device || {};
    const chartData = [
      { name: 'PC', value: device.pc?.count || 0, rate: device.pc?.rate || 0, fill: '#1890ff' },
      { name: '모바일', value: device.mobile?.count || 0, rate: device.mobile?.rate || 0, fill: '#52c41a' },
      { name: '태블릿', value: device.tablet?.count || 0, rate: device.tablet?.rate || 0, fill: '#faad14' }
    ].filter(item => item.value > 0);
    
    return { chartData, total: chartData.reduce((sum, item) => sum + item.value, 0) };
  }

  // 24시간 바 차트 (시간대별 방문자)
  if (type === 'hourly_bar' && presetId === 'hourly_visitors') {
    const hourly = apiData?.hourly || [];
    return {
      chartData: hourly.map(h => ({
        hour: h.hour,
        label: h.label,
        uv: h.uv,
        pv: h.pv
      })),
      maxValue: Math.max(...hourly.map(h => h.uv), 1)
    };
  }

  // 라인 차트 (일별 방문 추이)
  if (type === 'visitor_line' && presetId === 'daily_trend') {
    const daily = apiData?.daily || [];
    return {
      chartData: daily.map(d => ({
        date: dayjs(d.date).format('MM/DD'),
        fullDate: d.date,
        uv: d.uv,
        pv: d.pv
      })),
      totalUv: daily.reduce((sum, d) => sum + d.uv, 0),
      totalPv: daily.reduce((sum, d) => sum + d.pv, 0)
    };
  }

  // 비교 바 차트 (신규 vs 재방문)
  if (type === 'compare_bar' && presetId === 'new_vs_returning') {
    const newVsReturning = apiData?.newVsReturning || {};
    return {
      chartData: [
        { name: '신규', value: newVsReturning.new?.count || 0, rate: newVsReturning.new?.rate || 0, fill: '#52c41a' },
        { name: '재방문', value: newVsReturning.returning?.count || 0, rate: newVsReturning.returning?.rate || 0, fill: '#1890ff' }
      ],
      total: (newVsReturning.new?.count || 0) + (newVsReturning.returning?.count || 0)
    };
  }

  // Table (인기 페이지)
  if (type === 'table' && presetId === 'top_pages') {
    return apiData?.pages || [];
  }

  // Table (유입 경로)
  if (type === 'table' && presetId === 'referrer_sources') {
    return apiData?.referrers || [];
  }

  // Table (UTM 캠페인)
  if (type === 'table' && presetId === 'utm_campaigns') {
    return apiData?.campaigns || [];
  }

  // 전환 퍼널 차트 (비교 기간 지원)
  if (type === 'conversion_funnel' && presetId === 'conversion_funnel') {
    const currentFunnel = apiData?.funnel || [];
    const currentInsight = apiData?.insight || '';
    const currentConversion = apiData?.overallConversion || 0;
    const checkoutDataMissing = apiData?.checkoutDataMissing || false;
    const checkoutDataMissingMessage = apiData?.checkoutDataMissingMessage || null;
    
    // 비교 데이터 처리
    let compareFunnel = null;
    let compareConversion = null;
    let conversionChange = null;
    let compareCheckoutDataMissing = false;
    let compareCheckoutDataMissingMessage = null;
    
    if (compareDataList && compareDataList.length > 0 && compareDataList[0]?.data) {
      const compareData = compareDataList[0].data;
      compareFunnel = compareData.funnel || [];
      compareConversion = compareData.overallConversion || 0;
      compareCheckoutDataMissing = compareData.checkoutDataMissing || false;
      compareCheckoutDataMissingMessage = compareData.checkoutDataMissingMessage || null;
      
      // 전환율 변화 계산
      if (compareConversion > 0) {
        conversionChange = ((currentConversion - compareConversion) / compareConversion * 100).toFixed(1);
      } else if (currentConversion > 0) {
        conversionChange = 'new';
      }
    }
    
    return {
      funnel: currentFunnel,
      compareFunnel,
      insight: currentInsight,
      overallConversion: currentConversion,
      compareConversion,
      conversionChange,
      period: apiData?.period,
      comparePeriod: compareDataList?.[0],
      checkoutDataMissing,
      checkoutDataMissingMessage,
      compareCheckoutDataMissing,
      compareCheckoutDataMissingMessage
    };
  }

  // 기본 반환
  return apiData;
};
