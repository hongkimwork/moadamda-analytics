import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, Typography, Button, Modal, DatePicker, Space, Dropdown, Empty, Input, Radio, Steps, Checkbox, Spin, Tooltip as AntTooltip } from 'antd';
import { 
  AppstoreOutlined, 
  PlusOutlined, 
  DeleteOutlined, 
  EditOutlined,
  DragOutlined,
  LineChartOutlined,
  BarChartOutlined,
  TableOutlined,
  NumberOutlined,
  FundOutlined,
  FileTextOutlined,
  MoreOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
  SoundOutlined,
  LockOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckOutlined,
  LoadingOutlined,
  FunnelPlotOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip, LabelList, PieChart, Pie, LineChart, Line, Legend } from 'recharts';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// ============================================================================
// 데이터 소스 정의 (확장성 고려)
// ============================================================================
const DATA_SOURCES = {
  cafe24: { 
    id: 'cafe24',
    name: '주문 / 매출', 
    icon: <ShoppingCartOutlined style={{ fontSize: 28, color: '#1890ff' }} />,
    description: '오늘 매출, 주문 건수, 상품별 판매 등',
    enabled: true 
  },
  funnel: {
    id: 'funnel',
    name: '전환 퍼널 분석',
    icon: <FunnelPlotOutlined style={{ fontSize: 28, color: '#52c41a' }} />,
    description: '어디서 고객이 이탈하는지 분석',
    enabled: true
  },
  customer_type: {
    id: 'customer_type',
    name: '고객 유형 분석',
    icon: <TeamOutlined style={{ fontSize: 28, color: '#722ed1' }} />,
    description: '신규 vs 재구매 고객 비교',
    enabled: false,
    comingSoon: true
  },
  ad_platforms: { 
    id: 'ad_platforms',
    name: '광고 성과', 
    icon: <SoundOutlined style={{ fontSize: 28, color: '#faad14' }} />,
    description: '네이버/메타 광고 성과, ROAS 등',
    enabled: false,
    comingSoon: true
  }
};

// ============================================================================
// 위젯 프리셋 정의 (Cafe24 주문/매출)
// ============================================================================
const WIDGET_PRESETS = {
  cafe24: {
    kpi: [
      {
        id: 'total_revenue',
        label: '총 매출',
        icon: '💵',
        description: '선택 기간의 총 매출액',
        type: 'kpi',
        apiEndpoint: '/api/stats/range',
        dataKey: 'revenue.final',
        suffix: '원',
        defaultWidth: 'small',
        defaultHeight: 'short'
      },
      {
        id: 'order_count',
        label: '주문 건수',
        icon: '📦',
        description: '선택 기간의 총 주문 수',
        type: 'kpi',
        apiEndpoint: '/api/stats/range',
        dataKey: 'orders.count',
        suffix: '건',
        defaultWidth: 'small',
        defaultHeight: 'short'
      },
      {
        id: 'aov',
        label: '평균 주문금액',
        icon: '💳',
        description: '주문 1건당 평균 결제 금액',
        type: 'kpi',
        apiEndpoint: '/api/stats/range',
        dataKey: 'orders.final_aov',
        suffix: '원',
        defaultWidth: 'small',
        defaultHeight: 'short'
      }
    ],
    chart: [
      {
        id: 'period_revenue_compare',
        label: '기간별 매출 비교',
        icon: '📊',
        description: '선택 기간 vs 이전 기간 매출 비교',
        type: 'period_compare',
        apiEndpoint: '/api/stats/range',
        dataKey: 'revenue.final',
        defaultWidth: 'medium',
        defaultHeight: 'medium'
      },
      {
        id: 'order_place_revenue',
        label: '주문경로별 매출',
        icon: '📊',
        description: '네이버페이, PC쇼핑몰 등 경로별 비교',
        type: 'bar',
        apiEndpoint: '/api/stats/orders',
        dataKey: 'by_order_place',
        defaultWidth: 'medium',
        defaultHeight: 'medium'
      }
    ],
    list: [
      {
        id: 'top_products',
        label: '상품별 판매순위',
        icon: '🏆',
        description: '가장 많이 팔린 상품 순위',
        type: 'table',
        apiEndpoint: '/api/stats/orders',
        dataKey: 'by_product',
        defaultWidth: 'medium',
        defaultHeight: 'tall'
      }
    ]
  },
  funnel: {
    chart: [
      {
        id: 'conversion_funnel',
        label: '전환 퍼널 차트',
        icon: '📊',
        description: '방문→장바구니→결제→구매 4단계 시각화',
        type: 'conversion_funnel',
        apiEndpoint: '/api/stats/funnel/conversion',
        dataKey: 'funnel',
        defaultWidth: 'medium',
        defaultHeight: 'tall'
      }
    ]
  }
};

// ============================================================================
// 기간 프리셋 정의
// ============================================================================
const DATE_PRESETS = [
  { key: 'today', label: '오늘', getValue: () => [dayjs(), dayjs()] },
  { key: 'yesterday', label: '어제', getValue: () => [dayjs().subtract(1, 'day'), dayjs().subtract(1, 'day')] },
  { key: 'last7days', label: '최근 7일', getValue: () => [dayjs().subtract(6, 'days'), dayjs()] },
  { key: 'last30days', label: '최근 30일', getValue: () => [dayjs().subtract(29, 'days'), dayjs()] },
  { key: 'thisMonth', label: '이번 달', getValue: () => [dayjs().startOf('month'), dayjs()] },
  { key: 'lastMonth', label: '지난 달', getValue: () => [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
  { key: 'custom', label: '직접 선택', getValue: () => null }
];

// 이전 기간 자동 계산 함수 (같은 일자의 이전 달)
// 예: 12월 1일 ~ 12월 5일 → 11월 1일 ~ 11월 5일
const getComparisonPeriod = (startDate, endDate) => {
  return [
    startDate.subtract(1, 'month'),
    endDate.subtract(1, 'month')
  ];
};

// ============================================================================
// localStorage 저장/불러오기
// ============================================================================
const STORAGE_KEY = 'moadamda_my_dashboard';

// 위젯 설정 저장 (data 제외, 설정만 저장)
const saveToLocalStorage = (widgets, globalDateRange) => {
  try {
    // data, loading, error는 제외하고 설정만 저장
    const widgetsToSave = widgets.map(w => ({
      id: w.id,
      type: w.type,
      title: w.title,
      widthSize: w.widthSize,
      heightSize: w.heightSize,
      presetId: w.presetId,
      category: w.category,
      apiEndpoint: w.apiEndpoint,
      dataKey: w.dataKey,
      suffix: w.suffix,
      dateRange: w.dateRange,
      compareEnabled: w.compareEnabled,
      compareRanges: w.compareRanges || [] // 다중 비교 기간 배열
    }));

    const dataToSave = {
      widgets: widgetsToSave,
      globalDateRange: globalDateRange ? {
        start: globalDateRange[0].format('YYYY-MM-DD'),
        end: globalDateRange[1].format('YYYY-MM-DD')
      } : null,
      lastUpdated: new Date().toISOString()
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    console.log('[Dashboard] Saved to localStorage:', dataToSave.widgets.length, 'widgets');
  } catch (error) {
    console.error('[Dashboard] Failed to save to localStorage:', error);
  }
};

// 위젯 설정 불러오기 (레거시 마이그레이션 포함)
const loadFromLocalStorage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    console.log('[Dashboard] Loaded from localStorage:', parsed.widgets?.length || 0, 'widgets');
    
    // tracker 카테고리 위젯 필터링 (제거된 기능)
    const filteredWidgets = (parsed.widgets || []).filter(w => {
      if (w.category === 'tracker') {
        console.log('[Dashboard] Filtered out tracker widget:', w.id);
        return false;
      }
      return true;
    });
    
    return {
      widgets: filteredWidgets.map(w => {
        // 레거시 마이그레이션: compareRange → compareRanges
        let compareRanges = w.compareRanges || [];
        if (w.compareRange && !w.compareRanges) {
          // 기존 단일 compareRange를 배열로 변환
          compareRanges = [{
            start: w.compareRange.start,
            end: w.compareRange.end,
            type: w.compareRange.type || 'auto',
            monthsAgo: 1
          }];
          console.log('[Dashboard] Migrated legacy compareRange to compareRanges:', w.id);
        }
        
        return {
          ...w,
          compareRanges,
          data: null,
          loading: !!w.presetId, // API 연결 위젯은 로딩 상태로
          error: null
        };
      }),
      globalDateRange: parsed.globalDateRange ? [
        dayjs(parsed.globalDateRange.start),
        dayjs(parsed.globalDateRange.end)
      ] : null,
      lastUpdated: parsed.lastUpdated
    };
  } catch (error) {
    console.error('[Dashboard] Failed to load from localStorage:', error);
    return null;
  }
};

// ============================================================================
// API 호출 유틸리티
// ============================================================================
const API_BASE_URL = 'http://localhost:3003';

// 위젯 데이터 fetch 함수 (다중 비교 기간 지원)
const fetchWidgetData = async (widget) => {
  const { presetId, category, apiEndpoint, dataKey, dateRange, compareEnabled, compareRanges, compareRange } = widget;
  
  console.log('[fetchWidgetData] Widget config:', {
    presetId,
    apiEndpoint,
    dataKey,
    dateRange,
    compareEnabled,
    compareRanges,
    compareRange // 레거시 호환
  });
  
  if (!apiEndpoint || !dateRange) {
    return { data: null, compareDataList: [], error: 'Missing configuration' };
  }

  try {
    const params = new URLSearchParams({
      start: dateRange.start,
      end: dateRange.end
    });

    // 메인 데이터 fetch
    const mainUrl = `${API_BASE_URL}${apiEndpoint}?${params.toString()}`;
    console.log('[fetchWidgetData] Main API URL:', mainUrl);
    const response = await fetch(mainUrl);
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    const result = await response.json();
    console.log('[fetchWidgetData] Main API Result:', result);

    // 다중 비교 데이터 병렬 fetch
    let compareDataList = [];
    
    // 새로운 compareRanges 배열 사용
    if (compareEnabled && compareRanges && compareRanges.length > 0) {
      console.log('[fetchWidgetData] Fetching multiple compare ranges:', compareRanges.length);
      
      const comparePromises = compareRanges.map(async (range) => {
        const compareParams = new URLSearchParams({
          start: range.start,
          end: range.end
        });
        const compareUrl = `${API_BASE_URL}${apiEndpoint}?${compareParams.toString()}`;
        console.log('[fetchWidgetData] Compare API URL:', compareUrl);
        
        try {
          const compareResponse = await fetch(compareUrl);
          if (compareResponse.ok) {
            const data = await compareResponse.json();
            return { ...range, data };
          }
          console.error('[fetchWidgetData] Compare API Error:', compareResponse.status);
          return { ...range, data: null };
        } catch (err) {
          console.error('[fetchWidgetData] Compare fetch error:', err);
          return { ...range, data: null };
        }
      });
      
      compareDataList = await Promise.all(comparePromises);
      console.log('[fetchWidgetData] Compare Data List:', compareDataList);
    } 
    // 레거시 호환: 기존 단일 compareRange 지원
    else if (compareEnabled && compareRange) {
      const compareParams = new URLSearchParams({
        start: compareRange.start,
        end: compareRange.end
      });
      const compareUrl = `${API_BASE_URL}${apiEndpoint}?${compareParams.toString()}`;
      const compareResponse = await fetch(compareUrl);
      if (compareResponse.ok) {
        const data = await compareResponse.json();
        compareDataList = [{ ...compareRange, data }];
      }
    } else {
      console.log('[fetchWidgetData] Compare skipped - compareEnabled:', compareEnabled);
    }

    return { data: result, compareDataList, error: null };
  } catch (error) {
    console.error('[Widget Fetch Error]', error);
    return { data: null, compareDataList: [], error: error.message };
  }
};

// 데이터에서 특정 키 값 추출 (nested key 지원)
const getValueFromData = (data, dataKey) => {
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
const calculateChange = (current, previous) => {
  if (previous === null || previous === undefined) return null;
  if (previous === 0) {
    // 이전 값이 0이고 현재 값이 있으면 "신규" 표시를 위해 특수값 반환
    return current > 0 ? 'new' : '0.0';
  }
  return ((current - previous) / previous * 100).toFixed(1);
};

// 위젯 데이터 변환 함수 (프리셋별 데이터 가공) - 다중 비교 기간 지원
const transformWidgetData = (widget, apiData, compareDataList) => {
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

  // 날짜 라벨 생성 (YYYY년 MM월 형식 - 년도 포함)
  const formatPeriodLabel = (range) => {
    if (!range) return '';
    const startParts = range.start?.split('-') || [];
    const endParts = range.end?.split('-') || [];
    
    if (startParts.length < 3 || endParts.length < 3) return '';
    
    const startYear = startParts[0];
    const startMonth = parseInt(startParts[1]);
    const endYear = endParts[0];
    const endMonth = parseInt(endParts[1]);
    
    // 같은 년도, 같은 월
    if (startYear === endYear && startMonth === endMonth) {
      return `${startYear}년 ${startMonth}월`;
    }
    
    // 같은 년도, 다른 월
    if (startYear === endYear) {
      return `${startYear}년 ${startMonth}~${endMonth}월`;
    }
    
    // 다른 년도
    return `${startYear}년 ${startMonth}월~${endYear}년 ${endMonth}월`;
  };
  
  // 상세 날짜 정보 (간결한 형식: 2024.11.01 ~ 30)
  const formatDetailedPeriod = (range) => {
    if (!range) return '';
    const startParts = range.start?.split('-') || [];
    const endParts = range.end?.split('-') || [];
    
    if (startParts.length < 3 || endParts.length < 3) return '';
    
    const startYear = startParts[0];
    const startMonth = startParts[1];
    const startDay = startParts[2];
    const endYear = endParts[0];
    const endMonth = endParts[1];
    const endDay = endParts[2];
    
    // 같은 년도, 같은 월: 2024.11.01 ~ 30
    if (startYear === endYear && startMonth === endMonth) {
      return `${startYear}.${startMonth}.${startDay} ~ ${endDay}`;
    }
    
    // 같은 년도, 다른 월: 2024.11.01 ~ 12.31
    if (startYear === endYear) {
      return `${startYear}.${startMonth}.${startDay} ~ ${endMonth}.${endDay}`;
    }
    
    // 다른 년도: 2024.12.01 ~ 2025.01.31
    return `${startYear}.${startMonth}.${startDay} ~ ${endYear}.${endMonth}.${endDay}`;
  };

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

// ============================================================================
// 크기 시스템 정의
// ============================================================================

// 너비 크기 (3단 그리드)
const WIDTH_SIZES = {
  small: { cols: 1, label: '1/3' },
  medium: { cols: 2, label: '2/3' },
  large: { cols: 3, label: '전체' }
};

// 높이 크기 (3단계)
const HEIGHT_SIZES = {
  short: { height: 150, label: '작음' },
  medium: { height: 250, label: '중간' },
  tall: { height: 350, label: '큼' }
};

// cols에서 width size key 찾기
const getWidthSizeFromCols = (cols) => {
  if (cols <= 1) return 'small';
  if (cols <= 2) return 'medium';
  return 'large';
};

// height에서 height size key 찾기
const getHeightSizeFromPixels = (pixels) => {
  if (pixels <= 175) return 'short';
  if (pixels <= 275) return 'medium';
  return 'tall';
};

// ============================================================================
// 위젯 타입 정의 (기본 크기 포함)
// ============================================================================

// 비교 기능을 지원하지 않는 타입 (목록형, 텍스트형)
const TYPES_WITHOUT_COMPARE = ['table', 'text'];

const WIDGET_TYPES = [
  {
    key: 'kpi',
    icon: <NumberOutlined style={{ fontSize: 24, color: '#1890ff' }} />,
    label: 'KPI 숫자',
    description: '핵심 지표를 큰 숫자로 표시',
    defaultWidth: 'small',
    defaultHeight: 'short'
  },
  {
    key: 'period_compare',
    icon: <BarChartOutlined style={{ fontSize: 24, color: '#7C3AED' }} />,
    label: '기간 비교',
    description: '두 기간의 매출을 비교',
    defaultWidth: 'medium',
    defaultHeight: 'medium'
  },
  {
    key: 'line',
    icon: <LineChartOutlined style={{ fontSize: 24, color: '#52c41a' }} />,
    label: '라인 차트',
    description: '시간에 따른 추이 표시',
    defaultWidth: 'medium',
    defaultHeight: 'medium'
  },
  {
    key: 'bar',
    icon: <BarChartOutlined style={{ fontSize: 24, color: '#722ed1' }} />,
    label: '바 차트',
    description: '항목별 비교 분석',
    defaultWidth: 'medium',
    defaultHeight: 'medium'
  },
  {
    key: 'table',
    icon: <TableOutlined style={{ fontSize: 24, color: '#fa8c16' }} />,
    label: '테이블',
    description: '상세 데이터 목록',
    defaultWidth: 'large',
    defaultHeight: 'tall'
  },
  {
    key: 'funnel',
    icon: <FundOutlined style={{ fontSize: 24, color: '#eb2f96' }} />,
    label: '퍼널',
    description: '단계별 전환율 표시',
    defaultWidth: 'small',
    defaultHeight: 'medium'
  },
  {
    key: 'text',
    icon: <FileTextOutlined style={{ fontSize: 24, color: '#8c8c8c' }} />,
    label: '텍스트',
    description: '제목이나 설명 추가',
    defaultWidth: 'large',
    defaultHeight: 'short'
  }
];

// ============================================================================
// 더미 데이터 생성 함수
// ============================================================================
const generateDummyData = (type) => {
  switch (type) {
    case 'kpi':
      return {
        value: Math.floor(Math.random() * 100000) + 10000,
        change: (Math.random() * 40 - 20).toFixed(1),
        prefix: '',
        suffix: ''
      };
    case 'line':
      return Array.from({ length: 7 }, (_, i) => ({
        date: dayjs().subtract(6 - i, 'days').format('MM/DD'),
        value: Math.floor(Math.random() * 1000) + 500
      }));
    case 'bar':
      return [
        { name: '네이버', value: Math.floor(Math.random() * 5000) + 1000 },
        { name: '메타', value: Math.floor(Math.random() * 5000) + 1000 },
        { name: '구글', value: Math.floor(Math.random() * 5000) + 1000 },
        { name: '직접유입', value: Math.floor(Math.random() * 5000) + 1000 }
      ];
    case 'table':
      return [
        { campaign: '봄맞이 세일', visitors: 1234, orders: 56, revenue: 2340000 },
        { campaign: '신상품 런칭', visitors: 987, orders: 34, revenue: 1560000 },
        { campaign: '회원가입 이벤트', visitors: 756, orders: 23, revenue: 890000 }
      ];
    case 'funnel':
      return [
        { stage: '방문', value: 10000, rate: 100 },
        { stage: '상품조회', value: 6500, rate: 65 },
        { stage: '장바구니', value: 2100, rate: 21 },
        { stage: '구매완료', value: 850, rate: 8.5 }
      ];
    case 'text':
      return { title: '섹션 제목', content: '여기에 설명을 입력하세요' };
    default:
      return null;
  }
};

// ============================================================================
// 개별 위젯 컴포넌트 (리사이즈 핸들 + 가이드 박스)
// ============================================================================
const DashboardWidget = ({ widget, onDelete, onEdit, onResize, containerWidth, containerRef }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState(null); // 'corner-left', 'corner-right', 'bottom'
  const [previewSize, setPreviewSize] = useState(null); // { cols, height }
  const widgetRef = useRef(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const startSizeRef = useRef({ cols: 1, height: 150 });
  
  const gap = 16;
  const colWidth = (containerWidth - gap * 2) / 3;
  
  // 현재 크기 계산
  const currentCols = WIDTH_SIZES[widget.widthSize]?.cols || 1;
  const currentHeight = HEIGHT_SIZES[widget.heightSize]?.height || 150;
  
  // 위젯 너비 계산
  const getWidthFromCols = (cols) => cols * colWidth + (cols - 1) * gap;
  
  const widgetWidth = getWidthFromCols(currentCols);
  const widgetHeight = currentHeight;
  
  // 리사이즈 시작
  const handleResizeStart = (e, direction) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeDirection(direction);
    startPosRef.current = { x: e.clientX, y: e.clientY };
    startSizeRef.current = { cols: currentCols, height: currentHeight };
    setPreviewSize({ cols: currentCols, height: currentHeight });
  };
  
  // 리사이즈 중
  useEffect(() => {
    if (!isResizing) return;
    
    const handleMouseMove = (e) => {
      const deltaX = e.clientX - startPosRef.current.x;
      const deltaY = e.clientY - startPosRef.current.y;
      
      let newCols = startSizeRef.current.cols;
      let newHeight = startSizeRef.current.height;
      
      // 방향에 따라 크기 계산
      if (resizeDirection === 'corner-right') {
        // 우하단: 너비 + 높이
        const deltaColsRaw = deltaX / colWidth;
        newCols = Math.round(startSizeRef.current.cols + deltaColsRaw);
        newHeight = startSizeRef.current.height + deltaY;
      } else if (resizeDirection === 'corner-left') {
        // 좌하단: 너비 + 높이 (좌측으로 늘리면 너비 증가)
        const deltaColsRaw = -deltaX / colWidth;
        newCols = Math.round(startSizeRef.current.cols + deltaColsRaw);
        newHeight = startSizeRef.current.height + deltaY;
      } else if (resizeDirection === 'bottom') {
        // 하단 중앙: 높이만
        newHeight = startSizeRef.current.height + deltaY;
      }
      
      // 범위 제한
      newCols = Math.max(1, Math.min(3, newCols));
      
      // 높이 스냅 (short: 150, medium: 250, tall: 350)
      const heightSteps = [150, 250, 350];
      const closestHeight = heightSteps.reduce((prev, curr) => 
        Math.abs(curr - newHeight) < Math.abs(prev - newHeight) ? curr : prev
      );
      
      setPreviewSize({ cols: newCols, height: closestHeight });
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      setResizeDirection(null);
      
      if (previewSize) {
        const newWidthSize = getWidthSizeFromCols(previewSize.cols);
        const newHeightSize = getHeightSizeFromPixels(previewSize.height);
        
        // 크기가 변경된 경우에만 업데이트
        if (newWidthSize !== widget.widthSize || newHeightSize !== widget.heightSize) {
          onResize(widget.id, newWidthSize, newHeightSize);
        }
      }
      
      setPreviewSize(null);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, resizeDirection, previewSize, colWidth, widget.id, widget.widthSize, widget.heightSize, onResize]);
  
  // 위젯 타입별 렌더링
  const renderWidgetContent = () => {
    const contentHeight = widgetHeight - 57; // Card header 높이 제외
    
    // 로딩 상태
    if (widget.loading) {
      return (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          height: contentHeight
        }}>
          <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
        </div>
      );
    }

    // 에러 상태
    if (widget.error) {
      return (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          height: contentHeight,
          color: '#ff4d4f',
          fontSize: 13
        }}>
          데이터를 불러올 수 없습니다
        </div>
      );
    }

    // 데이터 없음
    if (!widget.data) {
      return (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          height: contentHeight,
          color: '#8c8c8c',
          fontSize: 13
        }}>
          데이터가 없습니다
        </div>
      );
    }
    
    switch (widget.type) {
      case 'kpi':
        // 비교 모드 확인 (compareValue가 숫자면 비교 모드)
        const hasCompare = widget.compareEnabled && (widget.data.compareValue !== null && widget.data.compareValue !== undefined);
        const changeValue = widget.data.change;
        const isNewData = changeValue === 'new';  // 이전 데이터 없음 (신규)
        const numericChange = isNewData ? 0 : (parseFloat(changeValue) || 0);
        
        // 날짜 포맷팅 (YYYY.MM.DD ~ DD 형식)
        const formatDateRange = (range) => {
          if (!range) return '';
          const start = range.start || '';
          const end = range.end || '';
          
          const startParts = start.split('-');
          const endParts = end.split('-');
          
          if (startParts.length < 3 || endParts.length < 3) return '';
          
          const startYear = startParts[0];
          const startMonth = startParts[1];
          const startDay = startParts[2];
          const endYear = endParts[0];
          const endMonth = endParts[1];
          const endDay = endParts[2];
          
          // 같은 년도, 같은 월: 2025.11.01 ~ 30
          if (startYear === endYear && startMonth === endMonth) {
            return `${startYear}.${startMonth}.${startDay} ~ ${endDay}`;
          }
          
          // 같은 년도, 다른 월: 2025.11.01 ~ 12.31
          if (startYear === endYear) {
            return `${startYear}.${startMonth}.${startDay} ~ ${endMonth}.${endDay}`;
          }
          
          // 다른 년도: 2024.12.25 ~ 2025.01.05
          return `${startYear}.${startMonth}.${startDay} ~ ${endYear}.${endMonth}.${endDay}`;
        };
        
        const currentDateLabel = widget.dateRange ? formatDateRange(widget.dateRange) : '이번 기간';
        // 비교 기간 계산: compareRange 또는 compareRanges[0] 또는 data.compareRange 사용
        const compareRangeForLabel = widget.compareRange || 
                                     widget.data?.compareRange || 
                                     (widget.compareRanges && widget.compareRanges.length > 0 ? widget.compareRanges[0] : null);
        const compareDateLabel = compareRangeForLabel ? formatDateRange(compareRangeForLabel) : '';
        
        return (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            height: contentHeight,
            padding: '10px 0'
          }}>
            {/* 비교 모드: 현재값 + 이전값 나란히 표시 */}
            {hasCompare ? (
              <>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  gap: 20,
                  width: '100%'
                }}>
                  {/* 현재 기간 */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: '#1890ff', marginBottom: 4, fontWeight: 500 }}>{currentDateLabel}</div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: '#1890ff' }}>
                      {widget.data.prefix}{(widget.data.value || 0).toLocaleString()}<span style={{ fontSize: 13 }}>{widget.data.suffix}</span>
                    </div>
                  </div>
                  
                  {/* 구분선 */}
                  <div style={{ 
                    width: 1, 
                    height: 40, 
                    background: '#e8e8e8' 
                  }} />
                  
                  {/* 이전 기간 */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4, fontWeight: 500 }}>{compareDateLabel}</div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: '#8c8c8c' }}>
                      {widget.data.prefix}{(widget.data.compareValue || 0).toLocaleString()}<span style={{ fontSize: 13 }}>{widget.data.suffix}</span>
                    </div>
                  </div>
                </div>
                
                {/* 증감률 */}
                <div style={{ 
                  fontSize: 12, 
                  marginTop: 8,
                  padding: '3px 10px',
                  borderRadius: 10,
                  background: isNewData ? '#e6f7ff' : (numericChange >= 0 ? '#f6ffed' : '#fff2f0'),
                  color: isNewData ? '#1890ff' : (numericChange >= 0 ? '#52c41a' : '#ff4d4f')
                }}>
                  {isNewData ? (
                    '🆕 신규 (이전 데이터 없음)'
                  ) : (
                    <>
                      {numericChange >= 0 ? '▲' : '▼'} {Math.abs(numericChange)}% {numericChange >= 0 ? '증가' : '감소'}
                    </>
                  )}
                </div>
              </>
            ) : (
              /* 비교 없음: 날짜 + 단일 값 표시 */
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#1890ff', marginBottom: 4, fontWeight: 500 }}>{currentDateLabel}</div>
                <div style={{ fontSize: 36, fontWeight: 700, color: '#1890ff' }}>
                  {widget.data.prefix}{(widget.data.value || 0).toLocaleString()}<span style={{ fontSize: 16 }}>{widget.data.suffix}</span>
                </div>
              </div>
            )}
          </div>
        );
      
      case 'line':
        return (
          <div style={{ height: contentHeight, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', height: contentHeight - 30, gap: 8 }}>
              {widget.data.map((d, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div 
                    style={{ 
                      width: '100%', 
                      height: `${(d.value / 1500) * (contentHeight - 50)}px`,
                      background: 'linear-gradient(180deg, #1890ff 0%, #69c0ff 100%)',
                      borderRadius: '4px 4px 0 0',
                      minHeight: 20
                    }} 
                  />
                  <div style={{ fontSize: 10, color: '#8c8c8c', marginTop: 4 }}>{d.date}</div>
                </div>
              ))}
            </div>
          </div>
        );
      
      // 기간별 매출 비교 차트 (수평 막대 2개)
      case 'period_compare':
        const periodData = widget.data;
        if (!periodData?.chartData) {
          return <div style={{ height: contentHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8c8c8c' }}>데이터가 없습니다</div>;
        }

        // 다중 비교 기간 색상 배열 (현재: 보라색, 비교: 회색 계열)
        const periodColors = ['#7C3AED', '#94A3B8', '#CBD5E1', '#E2E8F0', '#F1F5F9'];
        const maxPeriodValue = Math.max(...periodData.chartData.map(d => d.value));
        
        // 증감률 렌더링 (2개일 때만 표시, 3개 이상은 표시하지 않음)
        const renderChangeIndicator = () => {
          // 3개 이상이면 표시하지 않음
          if (barCount > 2) return null;
          
          const compareValues = periodData.compareValues || [];
          if (compareValues.length === 0) return null;
          
          // 2개일 때: 첫 번째 비교값만 이전 스타일로 표시
          const firstCompare = compareValues[0];
          const changeValue = firstCompare.change;
          const isNew = changeValue === 'new';
          const numericChange = isNew ? 0 : (parseFloat(changeValue) || 0);

          return (
            <div style={{
              textAlign: 'center',
              padding: '8px 0 4px',
              borderTop: '1px solid #f0f0f0'
            }}>
              <span style={{
                fontSize: 13,
                padding: '4px 12px',
                borderRadius: 12,
                background: isNew ? '#e6f7ff' : (numericChange >= 0 ? '#f6ffed' : '#fff2f0'),
                color: isNew ? '#1890ff' : (numericChange >= 0 ? '#52c41a' : '#ff4d4f')
              }}>
                {isNew ? '신규 (이전 데이터 없음)' : (
                  <>
                    {numericChange >= 0 ? '▲' : '▼'} {Math.abs(numericChange)}% {numericChange >= 0 ? '증가' : '감소'}
                  </>
                )}
              </span>
            </div>
          );
        };

        // 동적 막대 높이 계산 (기간 개수에 따라)
        const barCount = periodData.chartData.length;
        const dynamicBarSize = barCount <= 2 ? 28 : (barCount <= 3 ? 24 : (barCount <= 4 ? 20 : 16));

        // 커스텀 Tooltip 렌더링 (상세 날짜 표시)
        const PeriodTooltip = ({ active, payload }) => {
          if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
              <div style={{
                background: 'white',
                border: '1px solid #e8e8e8',
                borderRadius: 8,
                padding: '8px 12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
              }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{data.name}</div>
                {data.detailed && (
                  <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>
                    {data.detailed}
                  </div>
                )}
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1890ff' }}>
                  {data.value.toLocaleString()}원
                </div>
              </div>
            );
          }
          return null;
        };

        return (
          <div style={{ height: contentHeight, padding: '12px 0', display: 'flex', flexDirection: 'column' }}>
            {/* 차트 영역 */}
            <div style={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={periodData.chartData}
                  layout="vertical"
                  margin={{ top: 5, right: 80, left: 10, bottom: 5 }}
                  barSize={dynamicBarSize}
                >
                  <XAxis type="number" hide domain={[0, maxPeriodValue * 1.1]} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: barCount > 3 ? 11 : 13, fill: '#262626', fontWeight: 500 }}
                    width={120}
                  />
                  {/* 3개 이상일 때만 Tooltip 표시 */}
                  {barCount > 2 && (
                    <Tooltip content={<PeriodTooltip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                  )}
                  <Bar
                    dataKey="value"
                    radius={[0, 6, 6, 0]}
                    background={{ fill: '#f5f5f5', radius: [0, 6, 6, 0] }}
                  >
                    {periodData.chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={periodColors[index] || periodColors[periodColors.length - 1]} />
                    ))}
                    <LabelList
                      dataKey="value"
                      position="right"
                      formatter={(value) => `${value.toLocaleString()}원`}
                      style={{ fontSize: barCount > 3 ? 11 : 13, fontWeight: 600, fill: '#262626' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 증감률 표시 (2개일 때만) */}
            {renderChangeIndicator()}
          </div>
        );
      
      case 'bar':
        // 카드 너비에 따라 표시할 항목 수 결정
        const widthSize = widget.widthSize || 'medium';
        const maxItems = widthSize === 'small' ? 3 : (widthSize === 'medium' ? 5 : 7);
        const barData = (widget.data || []).slice(0, maxItems);
        
        if (barData.length === 0) {
          return <div style={{ height: contentHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8c8c8c' }}>데이터가 없습니다</div>;
        }
        
        // 항목별 다른 색상 (Mixpanel 스타일)
        const barColors = ['#3B82F6', '#EF4444', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899', '#06B6D4'];
        const maxBarValue = Math.max(...barData.map(d => d.value));
        
        return (
          <div style={{ height: contentHeight, padding: '8px 0' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={barData}
                layout="vertical"
                margin={{ top: 5, right: 90, left: 10, bottom: 5 }}
                barSize={22}
              >
                <XAxis type="number" hide domain={[0, maxBarValue * 1.15]} />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#262626' }}
                  width={80}
                  tickFormatter={(value) => value.length > 8 ? value.slice(0, 8) + '...' : value}
                />
                <Tooltip 
                  formatter={(value) => [`${value.toLocaleString()}원`, '매출']}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e8e8e8' }}
                />
                <Bar 
                  dataKey="value" 
                  radius={[0, 6, 6, 0]}
                  background={{ fill: '#f5f5f5', radius: [0, 6, 6, 0] }}
                >
                  {barData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={barColors[index % barColors.length]} />
                  ))}
                  <LabelList 
                    dataKey="value" 
                    position="right" 
                    formatter={(value) => `${value.toLocaleString()}원`}
                    style={{ fontSize: 11, fill: '#595959' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      
      case 'table':
        // 프리셋별 테이블 렌더링
        if (widget.presetId === 'top_products') {
          return (
            <div style={{ height: contentHeight, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600, position: 'sticky', top: 0, background: 'white', width: 30 }}>#</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>상품명</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>주문</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>매출</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(widget.data) ? widget.data : []).map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600, color: i < 3 ? '#fa8c16' : '#8c8c8c' }}>{i + 1}</td>
                      <td style={{ padding: '6px 8px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.product_name}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{row.order_count}건</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: '#1890ff' }}>
                        {(row.revenue || 0).toLocaleString()}원
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        // 인기 페이지 테이블
        if (widget.presetId === 'top_pages') {
          return (
            <div style={{ height: contentHeight, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600, position: 'sticky', top: 0, background: 'white', width: 30 }}>#</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>페이지</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>PV</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>UV</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(widget.data) ? widget.data : []).map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600, color: i < 3 ? '#52c41a' : '#8c8c8c' }}>{row.rank || i + 1}</td>
                      <td style={{ padding: '6px 8px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.url}>
                        {row.title || row.url}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: '#1890ff' }}>
                        {(row.pv || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                        {(row.uv || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        // 유입 경로 테이블
        if (widget.presetId === 'referrer_sources') {
          return (
            <div style={{ height: contentHeight, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600, position: 'sticky', top: 0, background: 'white', width: 30 }}>#</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>유입 경로</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>방문자</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>비율</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(widget.data) ? widget.data : []).map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600, color: i < 3 ? '#52c41a' : '#8c8c8c' }}>{row.rank || i + 1}</td>
                      <td style={{ padding: '6px 8px' }}>{row.source}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: '#1890ff' }}>
                        {(row.uv || 0).toLocaleString()}명
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                        {row.rate || 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        // UTM 캠페인 테이블
        if (widget.presetId === 'utm_campaigns') {
          return (
            <div style={{ height: contentHeight, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600, position: 'sticky', top: 0, background: 'white', width: 30 }}>#</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>소스</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>캠페인</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>방문자</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(widget.data) ? widget.data : []).map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600, color: i < 3 ? '#52c41a' : '#8c8c8c' }}>{row.rank || i + 1}</td>
                      <td style={{ padding: '6px 8px', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.source} / {row.medium}
                      </td>
                      <td style={{ padding: '6px 8px', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.campaign}>
                        {row.campaign}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: '#1890ff' }}>
                        {(row.uv || 0).toLocaleString()}명
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        // 기본 테이블 (기존 더미 데이터 호환)
        return (
          <div style={{ height: contentHeight, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>캠페인</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>방문자</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>주문</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>매출</th>
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(widget.data) ? widget.data : []).map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '8px 12px' }}>{row.campaign}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{(row.visitors || 0).toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{row.orders}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#1890ff' }}>
                      {(row.revenue || 0).toLocaleString()}원
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      
      case 'funnel':
        return (
          <div style={{ height: contentHeight, overflow: 'auto', padding: '10px 0' }}>
            {widget.data.map((d, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13 }}>{d.stage}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{d.value.toLocaleString()} ({d.rate}%)</span>
                </div>
                <div 
                  style={{ 
                    height: 24, 
                    background: `linear-gradient(90deg, #1890ff ${d.rate}%, #f0f0f0 ${d.rate}%)`,
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: 8
                  }}
                >
                  <span style={{ fontSize: 11, color: d.rate > 50 ? 'white' : '#8c8c8c' }}>
                    {d.rate}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        );
      
      case 'text':
        return (
          <div style={{ height: contentHeight, overflow: 'auto', padding: '10px 0' }}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: '#262626' }}>
              {widget.data.title}
            </div>
            <div style={{ fontSize: 14, color: '#8c8c8c', lineHeight: 1.6 }}>
              {widget.data.content}
            </div>
          </div>
        );

      // ============================================================================
      // 방문자 분석 차트 렌더링
      // ============================================================================

      // 파이 차트 (디바이스별 방문자)
      case 'pie':
        const pieData = widget.data;
        if (!pieData?.chartData || pieData.chartData.length === 0) {
          return <div style={{ height: contentHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8c8c8c' }}>데이터가 없습니다</div>;
        }

        const RADIAN = Math.PI / 180;
        const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
          const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
          const x = cx + radius * Math.cos(-midAngle * RADIAN);
          const y = cy + radius * Math.sin(-midAngle * RADIAN);
          
          if (percent < 0.05) return null; // 5% 미만은 라벨 생략
          
          return (
            <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
              {`${(percent * 100).toFixed(0)}%`}
            </text>
          );
        };

        return (
          <div style={{ height: contentHeight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData.chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomizedLabel}
                  outerRadius={Math.min(contentHeight, 200) / 2 - 20}
                  dataKey="value"
                >
                  {pieData.chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value, name, props) => [`${value.toLocaleString()}명 (${props.payload.rate}%)`, name]}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e8e8e8' }}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36}
                  formatter={(value, entry) => (
                    <span style={{ color: '#262626', fontSize: 12 }}>
                      {value} ({entry.payload.rate}%)
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        );

      // 24시간 바 차트 (시간대별 방문자)
      case 'hourly_bar':
        const hourlyData = widget.data;
        if (!hourlyData?.chartData || hourlyData.chartData.length === 0) {
          return <div style={{ height: contentHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8c8c8c' }}>데이터가 없습니다</div>;
        }

        // 피크 시간 찾기
        const peakHour = hourlyData.chartData.reduce((max, item) => item.uv > max.uv ? item : max, hourlyData.chartData[0]);

        return (
          <div style={{ height: contentHeight, padding: '8px 0' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={hourlyData.chartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
              >
                <XAxis 
                  dataKey="hour" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#8c8c8c' }}
                  tickFormatter={(hour) => hour % 6 === 0 ? `${hour}시` : ''}
                  interval={0}
                />
                <YAxis hide domain={[0, hourlyData.maxValue * 1.2]} />
                <Tooltip 
                  formatter={(value) => [`${value.toLocaleString()}명`, '방문자']}
                  labelFormatter={(hour) => `${hour}시`}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e8e8e8' }}
                />
                <Bar 
                  dataKey="uv" 
                  radius={[2, 2, 0, 0]}
                >
                  {hourlyData.chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.hour === peakHour.hour ? '#52c41a' : '#d9d9d9'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        );

      // 라인 차트 (일별 방문 추이)
      case 'visitor_line':
        const dailyData = widget.data;
        if (!dailyData?.chartData || dailyData.chartData.length === 0) {
          return <div style={{ height: contentHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8c8c8c' }}>데이터가 없습니다</div>;
        }

        return (
          <div style={{ height: contentHeight, padding: '8px 0' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={dailyData.chartData}
                margin={{ top: 10, right: 30, left: -10, bottom: 5 }}
              >
                <XAxis 
                  dataKey="date" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#8c8c8c' }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#8c8c8c' }}
                  tickFormatter={(value) => value.toLocaleString()}
                />
                <Tooltip 
                  formatter={(value, name) => [
                    `${value.toLocaleString()}${name === 'uv' ? '명' : '회'}`, 
                    name === 'uv' ? '방문자' : '페이지뷰'
                  ]}
                  labelFormatter={(label) => `${label}`}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e8e8e8' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="uv" 
                  stroke="#52c41a" 
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#52c41a' }}
                  activeDot={{ r: 5 }}
                  name="uv"
                />
                <Line 
                  type="monotone" 
                  dataKey="pv" 
                  stroke="#1890ff" 
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#1890ff' }}
                  activeDot={{ r: 5 }}
                  name="pv"
                />
                <Legend 
                  verticalAlign="top"
                  height={30}
                  formatter={(value) => (
                    <span style={{ color: '#262626', fontSize: 12 }}>
                      {value === 'uv' ? '방문자(UV)' : '페이지뷰(PV)'}
                    </span>
                  )}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        );

      // 비교 바 차트 (신규 vs 재방문)
      case 'compare_bar':
        const compareData = widget.data;
        if (!compareData?.chartData || compareData.chartData.length === 0) {
          return <div style={{ height: contentHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8c8c8c' }}>데이터가 없습니다</div>;
        }

        const maxCompareValue = Math.max(...compareData.chartData.map(d => d.value));

        return (
          <div style={{ height: contentHeight, padding: '12px 0' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={compareData.chartData}
                layout="vertical"
                margin={{ top: 5, right: 80, left: 10, bottom: 5 }}
                barSize={32}
              >
                <XAxis type="number" hide domain={[0, maxCompareValue * 1.2]} />
                <YAxis
                  type="category"
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 13, fill: '#262626', fontWeight: 500 }}
                  width={60}
                />
                <Tooltip 
                  formatter={(value, name, props) => [`${value.toLocaleString()}명 (${props.payload.rate}%)`, props.payload.name]}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e8e8e8' }}
                />
                <Bar
                  dataKey="value"
                  radius={[0, 6, 6, 0]}
                  background={{ fill: '#f5f5f5', radius: [0, 6, 6, 0] }}
                >
                  {compareData.chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                  <LabelList
                    dataKey="value"
                    position="right"
                    formatter={(value) => `${value.toLocaleString()}명`}
                    style={{ fontSize: 12, fontWeight: 600, fill: '#262626' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      
      case 'conversion_funnel':
        const funnelData = widget.data;
        if (!funnelData?.funnel) {
          return <div style={{ height: contentHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8c8c8c' }}>데이터가 없습니다</div>;
        }

        const funnelColors = ['#1890ff', '#52c41a', '#faad14', '#f5222d'];
        const funnelSteps = funnelData.funnel;
        const compareFunnel = funnelData.compareFunnel;
        const hasCompareData = widget.compareEnabled && compareFunnel && compareFunnel.length > 0;
        const stepCount = funnelSteps.length;
        
        // 비교용 차트 데이터 생성 (현재 + 이전)
        const funnelChartData = funnelSteps.map((step, index) => {
          const compareStep = hasCompareData ? compareFunnel[index] : null;
          return {
            name: step.step,
            current: step.count,
            currentRate: step.rate,
            compare: compareStep?.count || 0,
            compareRate: compareStep?.rate || 0,
            dropRate: step.dropRate,
            fill: funnelColors[index],
            // 증감률 계산
            change: compareStep?.count > 0 
              ? ((step.count - compareStep.count) / compareStep.count * 100).toFixed(1)
              : (step.count > 0 ? 'new' : '0')
          };
        });
        
        // 최대값 (현재와 이전 중 큰 값 기준)
        const maxFunnelValue = Math.max(
          funnelChartData[0]?.current || 1,
          hasCompareData ? (funnelChartData[0]?.compare || 0) : 0
        );
        
        // 동적 막대 크기 (비교 모드일 때 더 작게)
        const funnelBarSize = hasCompareData 
          ? (stepCount <= 3 ? 14 : 12)
          : (stepCount <= 3 ? 28 : (stepCount <= 4 ? 24 : 20));
        
        // 높이에 따라 인사이트/전환율 비교 표시 여부 결정
        const showFunnelInsight = contentHeight > 220;
        const showConversionCompare = hasCompareData && contentHeight > 160;

        // 커스텀 Tooltip (비교 데이터 포함)
        const FunnelTooltip = ({ active, payload }) => {
          if (active && payload && payload.length) {
            const data = payload[0].payload;
            const changeNum = parseFloat(data.change);
            const isNew = data.change === 'new';
            return (
              <div style={{
                background: 'white',
                border: '1px solid #e8e8e8',
                borderRadius: 8,
                padding: '8px 12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
              }}>
                <div style={{ fontWeight: 600, marginBottom: 4, color: data.fill }}>{data.name}</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  현재: {data.current.toLocaleString()}명 ({data.currentRate}%)
                </div>
                {hasCompareData && (
                  <>
                    <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>
                      이전: {data.compare.toLocaleString()}명 ({data.compareRate}%)
                    </div>
                    <div style={{ 
                      fontSize: 12, 
                      marginTop: 4,
                      color: isNew ? '#1890ff' : (changeNum >= 0 ? '#52c41a' : '#ff4d4f')
                    }}>
                      {isNew ? '🆕 신규' : (changeNum >= 0 ? `▲ ${changeNum}%` : `▼ ${Math.abs(changeNum)}%`)}
                    </div>
                  </>
                )}
                {data.dropRate > 0 && (
                  <div style={{ fontSize: 12, color: '#ff4d4f', marginTop: 4 }}>
                    ↓ {data.dropRate}% 이탈
                  </div>
                )}
              </div>
            );
          }
          return null;
        };

        return (
          <div style={{ height: contentHeight, padding: '8px 0', display: 'flex', flexDirection: 'column' }}>
            {/* 차트 영역 */}
            <div style={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={funnelChartData}
                  layout="vertical"
                  margin={{ top: 5, right: 90, left: 5, bottom: 5 }}
                  barGap={hasCompareData ? 2 : 0}
                  barCategoryGap={hasCompareData ? '15%' : '20%'}
                >
                  <XAxis type="number" hide domain={[0, maxFunnelValue * 1.1]} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#262626', fontWeight: 500 }}
                    width={55}
                  />
                  <Tooltip content={<FunnelTooltip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                  
                  {/* 이전 기간 막대 (투명하게 먼저 그림) */}
                  {hasCompareData && (
                    <Bar
                      dataKey="compare"
                      radius={[0, 6, 6, 0]}
                      barSize={funnelBarSize}
                    >
                      {funnelChartData.map((entry, index) => (
                        <Cell key={`compare-${index}`} fill={entry.fill} fillOpacity={0.3} />
                      ))}
                    </Bar>
                  )}
                  
                  {/* 현재 기간 막대 */}
                  <Bar
                    dataKey="current"
                    radius={[0, 6, 6, 0]}
                    barSize={funnelBarSize}
                    background={!hasCompareData ? { fill: '#f5f5f5', radius: [0, 6, 6, 0] } : false}
                  >
                    {funnelChartData.map((entry, index) => (
                      <Cell key={`current-${index}`} fill={entry.fill} />
                    ))}
                    <LabelList
                      dataKey="current"
                      position="right"
                      formatter={(value) => `${value.toLocaleString()}명`}
                      style={{ fontSize: 11, fontWeight: 600, fill: '#262626' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 전환율 비교 (비교 모드일 때) */}
            {showConversionCompare && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '6px 8px',
                background: '#f6ffed',
                borderRadius: 4,
                margin: '0 8px 4px',
                fontSize: 12
              }}>
                <span style={{ color: '#8c8c8c' }}>전환율</span>
                <span style={{ fontWeight: 600, color: '#52c41a' }}>{funnelData.overallConversion}%</span>
                <span style={{ color: '#8c8c8c' }}>vs</span>
                <span style={{ fontWeight: 600, color: '#8c8c8c' }}>{funnelData.compareConversion}%</span>
                {funnelData.conversionChange && funnelData.conversionChange !== 'new' && (
                  <span style={{
                    padding: '2px 6px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    background: parseFloat(funnelData.conversionChange) >= 0 ? '#d9f7be' : '#ffccc7',
                    color: parseFloat(funnelData.conversionChange) >= 0 ? '#389e0d' : '#cf1322'
                  }}>
                    {parseFloat(funnelData.conversionChange) >= 0 ? '▲' : '▼'} {Math.abs(parseFloat(funnelData.conversionChange))}%
                  </span>
                )}
              </div>
            )}

            {/* 결제시도 데이터 누락 안내 (현재 또는 비교 기간) */}
            {(funnelData.checkoutDataMissing || funnelData.compareCheckoutDataMissing) && (
              <AntTooltip 
                title={
                  <div>
                    {funnelData.checkoutDataMissing && (
                      <div>📊 현재 기간: {funnelData.checkoutDataMissingMessage}</div>
                    )}
                    {funnelData.compareCheckoutDataMissing && (
                      <div style={{ marginTop: funnelData.checkoutDataMissing ? 8 : 0 }}>
                        📊 비교 기간: {funnelData.compareCheckoutDataMissingMessage}
                      </div>
                    )}
                  </div>
                }
                placement="top"
                overlayStyle={{ maxWidth: 300 }}
              >
                <div style={{ 
                  padding: '4px 8px', 
                  background: '#fff1f0', 
                  borderRadius: 4,
                  fontSize: 11,
                  color: '#cf1322',
                  lineHeight: 1.4,
                  margin: '0 8px 4px',
                  textAlign: 'center',
                  cursor: 'help'
                }}>
                  ⚠️ 일부 기간에 결제시도 데이터가 없습니다 (마우스를 올려 상세 보기)
                </div>
              </AntTooltip>
            )}

            {/* 인사이트 (공간이 충분하고 비교 모드가 아닐 때) */}
            {showFunnelInsight && !hasCompareData && funnelData.insight && (
              <div style={{ 
                padding: '6px 8px', 
                background: '#fff7e6', 
                borderRadius: 4,
                fontSize: 11,
                color: '#ad6800',
                lineHeight: 1.4,
                margin: '0 8px'
              }}>
                💡 {funnelData.insight}
              </div>
            )}
          </div>
        );

      default:
        return <div>알 수 없는 위젯 타입</div>;
    }
  };

  // 더보기 메뉴
  const moreMenuItems = [
    {
      key: 'edit',
      icon: <EditOutlined />,
      label: '편집',
      onClick: () => onEdit(widget)
    },
    {
      type: 'divider'
    },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: '삭제',
      danger: true,
      onClick: () => onDelete(widget.id)
    }
  ];
  
  // 핸들 공통 스타일
  const handleBaseStyle = {
    position: 'absolute',
    zIndex: 10,
    display: isHovered || isResizing ? 'flex' : 'none',
    alignItems: 'center',
    justifyContent: 'center'
  };

  return (
    <div 
      ref={widgetRef}
      style={{ 
        width: widgetWidth,
        height: widgetHeight,
        minWidth: 200,
        flexShrink: 0,
        position: 'relative'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => !isResizing && setIsHovered(false)}
    >
      {/* 원본 카드 */}
      <Card
        size="small"
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 8,
          border: isHovered ? '1px solid #1890ff' : '1px solid #e8e8e8',
          boxShadow: isHovered ? '0 2px 8px rgba(24, 144, 255, 0.15)' : '0 1px 2px rgba(0,0,0,0.03)',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
          overflow: 'hidden'
        }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            {/* 왼쪽 그룹: 제목 + 날짜 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <DragOutlined style={{ color: '#bfbfbf', cursor: 'grab' }} />
              <span style={{ fontSize: 14, fontWeight: 600 }}>{widget.title}</span>
              
              {/* period_compare 타입일 때 날짜 정보 표시 (2개일 때만 vs 형태로 표시, 3개 이상은 Tooltip으로) */}
              {widget.type === 'period_compare' && widget.data?.detailedDates && (
                <>
                  {/* 2개일 때만 헤더에 표시 */}
                  {widget.data.chartData?.length === 2 && (
                    <>
                      <span style={{ color: '#e0e0e0', margin: '0 8px' }}>|</span>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 11,
                        color: '#595959'
                      }}>
                        {widget.data.detailedDates.current && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <span style={{ color: '#7C3AED', fontSize: 12 }}>●</span>
                            {widget.data.detailedDates.current}
                          </span>
                        )}
                        {widget.data.detailedDates.compares?.[0] && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <span style={{ color: '#8c8c8c', fontSize: 10 }}>vs</span>
                            <span style={{ color: '#94A3B8', fontSize: 12 }}>●</span>
                            {widget.data.detailedDates.compares[0]}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                  {/* 3개 이상일 때는 안내 문구만 표시 */}
                  {widget.data.chartData?.length > 2 && (
                    <>
                      <span style={{ color: '#e0e0e0', margin: '0 8px' }}>|</span>
                      <span style={{ fontSize: 11, color: '#8c8c8c' }}>
                        {widget.data.chartData.length}개 기간 비교 (막대에 마우스를 올리면 상세 날짜 표시)
                      </span>
                    </>
                  )}
                </>
              )}
              
              {/* 다른 타입(bar, table 등)일 때 날짜 정보 표시 (단일 기간) */}
              {/* KPI, period_compare, text 타입은 제외 */}
              {widget.type !== 'period_compare' && widget.type !== 'text' && widget.type !== 'kpi' && widget.dateRange && (
                <>
                  <span style={{ color: '#e0e0e0', margin: '0 8px' }}>|</span>
                  <span style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 12,
                    color: '#595959'
                  }}>
                    <span style={{ color: '#8c8c8c' }}>조회기간 :</span>
                    {(() => {
                      const formatDateRange = (dateRange) => {
                        if (!dateRange?.start || !dateRange?.end) return '';
                        const { start, end } = dateRange;
                        
                        const startParts = start.split('-');
                        const endParts = end.split('-');
                        
                        if (startParts.length < 3 || endParts.length < 3) return '';
                        
                        const startYear = startParts[0];
                        const startMonth = startParts[1];
                        const startDay = startParts[2];
                        const endYear = endParts[0];
                        const endMonth = endParts[1];
                        const endDay = endParts[2];
                        
                        // 같은 년도, 같은 월
                        if (startYear === endYear && startMonth === endMonth) {
                          return `${startYear}.${startMonth}.${startDay} ~ ${endDay}`;
                        }
                        
                        // 같은 년도, 다른 월
                        if (startYear === endYear) {
                          return `${startYear}.${startMonth}.${startDay} ~ ${endMonth}.${endDay}`;
                        }
                        
                        // 다른 년도
                        return `${startYear}.${startMonth}.${startDay} ~ ${endYear}.${endMonth}.${endDay}`;
                      };
                      
                      const currentRange = formatDateRange(widget.dateRange);
                      
                      // conversion_funnel 타입이고 비교 기간이 있을 때
                      if (widget.type === 'conversion_funnel' && widget.compareEnabled && widget.compareRanges?.length > 0) {
                        const compareRange = formatDateRange(widget.compareRanges[0]);
                        if (compareRange) {
                          return (
                            <>
                              <span style={{ color: '#1890ff', fontWeight: 500 }}>{currentRange}</span>
                              <span style={{ color: '#8c8c8c', margin: '0 4px' }}>vs</span>
                              <span style={{ color: '#8c8c8c' }}>{compareRange}</span>
                            </>
                          );
                        }
                      }
                      
                      return currentRange;
                    })()}
                  </span>
                </>
              )}
            </div>
          </div>
        }
        extra={
          <Dropdown menu={{ items: moreMenuItems }} trigger={['click']}>
            <Button 
              type="text" 
              icon={<MoreOutlined />} 
              style={{ opacity: isHovered ? 1 : 0.3, transition: 'opacity 0.2s' }}
            />
          </Dropdown>
        }
        bodyStyle={{ padding: '0 12px', height: widgetHeight - 57, overflow: 'hidden' }}
      >
        {renderWidgetContent()}
      </Card>
      
      {/* 좌측 하단 리사이즈 핸들 (대각선) */}
      <div
        style={{
          ...handleBaseStyle,
          left: 0,
          bottom: 0,
          width: 20,
          height: 20,
          cursor: 'nesw-resize'
        }}
        onMouseDown={(e) => handleResizeStart(e, 'corner-left')}
      >
        <div style={{
          width: 10,
          height: 10,
          borderLeft: '2px solid #1890ff',
          borderBottom: '2px solid #1890ff',
          borderBottomLeftRadius: 2
        }} />
      </div>
      
      {/* 하단 중앙 리사이즈 핸들 (높이만) */}
      <div
        style={{
          ...handleBaseStyle,
          left: '50%',
          bottom: 0,
          transform: 'translateX(-50%)',
          width: 40,
          height: 16,
          cursor: 'ns-resize'
        }}
        onMouseDown={(e) => handleResizeStart(e, 'bottom')}
      >
        <div style={{
          width: 24,
          height: 4,
          background: '#1890ff',
          borderRadius: 2
        }} />
      </div>
      
      {/* 우측 하단 리사이즈 핸들 (대각선) */}
      <div
        style={{
          ...handleBaseStyle,
          right: 0,
          bottom: 0,
          width: 20,
          height: 20,
          cursor: 'nwse-resize'
        }}
        onMouseDown={(e) => handleResizeStart(e, 'corner-right')}
      >
        <div style={{
          width: 10,
          height: 10,
          borderRight: '2px solid #1890ff',
          borderBottom: '2px solid #1890ff',
          borderBottomRightRadius: 2
        }} />
      </div>
      
      {/* 리사이즈 가이드 박스 (투명한 파란색) */}
      {isResizing && previewSize && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: resizeDirection === 'corner-left' 
              ? -(getWidthFromCols(previewSize.cols) - widgetWidth) 
              : 0,
            width: getWidthFromCols(previewSize.cols),
            height: previewSize.height,
            background: 'rgba(24, 144, 255, 0.15)',
            border: '2px dashed #1890ff',
            borderRadius: 8,
            pointerEvents: 'none',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div style={{
            background: '#1890ff',
            color: 'white',
            padding: '4px 12px',
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 600
          }}>
            {WIDTH_SIZES[getWidthSizeFromCols(previewSize.cols)].label} × {HEIGHT_SIZES[getHeightSizeFromPixels(previewSize.height)].label}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 위젯 추가 모달 컴포넌트 (3단계 스텝)
// ============================================================================
const AddWidgetModal = ({ visible, onClose, onAdd, globalDateRange }) => {
  // Step 관리
  const [currentStep, setCurrentStep] = useState(0);
  
  // Step 1: 카테고리 선택
  const [selectedCategory, setSelectedCategory] = useState(null);
  
  // Step 2: 지표 선택
  const [selectedPreset, setSelectedPreset] = useState(null);
  
  // Step 3: 기간 설정
  const [datePresetKey, setDatePresetKey] = useState('last7days');
  const [customDateRange, setCustomDateRange] = useState([dayjs().subtract(6, 'days'), dayjs()]);
  const [compareEnabled, setCompareEnabled] = useState(true);
  // 다중 비교 기간 (최대 4개)
  const [compareRanges, setCompareRanges] = useState([
    { id: 1, type: 'auto', monthsAgo: 1, customRange: null }
  ]);

  // 초기화
  const resetModal = () => {
    setCurrentStep(0);
    setSelectedCategory(null);
    setSelectedPreset(null);
    setDatePresetKey('last7days');
    setCustomDateRange([dayjs().subtract(6, 'days'), dayjs()]);
    setCompareEnabled(true);
    setCompareRanges([{ id: 1, type: 'auto', monthsAgo: 1, customRange: null }]);
  };

  // Step 2에서 지표 선택 시 비교 기능 자동 설정
  useEffect(() => {
    if (selectedPreset) {
      // table/text 타입이면 비교 기능 자동 OFF
      if (TYPES_WITHOUT_COMPARE.includes(selectedPreset.type)) {
        setCompareEnabled(false);
      } else {
        // 다른 타입은 기본값 true (사용자가 선택 가능)
        setCompareEnabled(true);
      }
    }
  }, [selectedPreset]);

  // 모달 닫기
  const handleClose = () => {
    resetModal();
    onClose();
  };

  // 현재 기간 계산
  const getCurrentDateRange = () => {
    if (datePresetKey === 'custom') {
      return customDateRange;
    }
    const preset = DATE_PRESETS.find(p => p.key === datePresetKey);
    return preset ? preset.getValue() : [dayjs().subtract(6, 'days'), dayjs()];
  };

  // 다중 비교 기간 계산
  const getCompareRangesForSave = () => {
    if (!compareEnabled || compareRanges.length === 0) return [];
    const [start, end] = getCurrentDateRange();
    
    return compareRanges.map(range => {
      if (range.type === 'custom' && range.customRange) {
        return {
          start: range.customRange[0].format('YYYY-MM-DD'),
          end: range.customRange[1].format('YYYY-MM-DD'),
          type: 'custom',
          monthsAgo: range.monthsAgo
        };
      }
      // 자동 계산: N달 전
      const compareStart = start.subtract(range.monthsAgo, 'month');
      const compareEnd = end.subtract(range.monthsAgo, 'month');
      return {
        start: compareStart.format('YYYY-MM-DD'),
        end: compareEnd.format('YYYY-MM-DD'),
        type: 'auto',
        monthsAgo: range.monthsAgo
      };
    });
  };

  // 특정 비교 기간의 날짜 범위 계산 (UI 표시용)
  const getCompareRangeDates = (range) => {
    const [start, end] = getCurrentDateRange();
    if (range.type === 'custom' && range.customRange) {
      return range.customRange;
    }
    return [start.subtract(range.monthsAgo, 'month'), end.subtract(range.monthsAgo, 'month')];
  };

  // 비교 기간 추가
  const handleAddCompareRange = () => {
    if (compareRanges.length >= 4) return;
    const nextMonthsAgo = compareRanges.length + 1;
    setCompareRanges([...compareRanges, {
      id: Date.now(),
      type: 'auto',
      monthsAgo: nextMonthsAgo,
      customRange: null
    }]);
  };

  // 비교 기간 삭제
  const handleRemoveCompareRange = (id) => {
    if (compareRanges.length <= 1) return;
    setCompareRanges(compareRanges.filter(r => r.id !== id));
  };

  // 비교 기간 타입 변경
  const handleCompareRangeTypeChange = (id, newType) => {
    setCompareRanges(compareRanges.map(r => 
      r.id === id ? { ...r, type: newType } : r
    ));
  };

  // 비교 기간 커스텀 날짜 변경
  const handleCompareRangeCustomChange = (id, dates) => {
    setCompareRanges(compareRanges.map(r => 
      r.id === id ? { ...r, customRange: dates } : r
    ));
  };

  // 완료 처리
  const handleComplete = () => {
    if (!selectedPreset) return;
    
    const [startDate, endDate] = getCurrentDateRange();
    const compareRangesForSave = getCompareRangesForSave();
    
    // 비교 기능을 지원하지 않는 타입이면 강제로 false/빈 배열
    const finalCompareEnabled = TYPES_WITHOUT_COMPARE.includes(selectedPreset.type) 
      ? false 
      : compareEnabled;
    
    const finalCompareRanges = TYPES_WITHOUT_COMPARE.includes(selectedPreset.type)
      ? []
      : compareRangesForSave;
    
    onAdd({
      id: `widget-${Date.now()}`,
      type: selectedPreset.type,
      title: selectedPreset.label,
      widthSize: selectedPreset.defaultWidth,
      heightSize: selectedPreset.defaultHeight,
      // 위젯 설정 정보
      presetId: selectedPreset.id,
      category: selectedCategory,
      apiEndpoint: selectedPreset.apiEndpoint,
      dataKey: selectedPreset.dataKey,
      suffix: selectedPreset.suffix || '',
      // 기간 설정
      dateRange: {
        start: startDate.format('YYYY-MM-DD'),
        end: endDate.format('YYYY-MM-DD'),
        presetKey: datePresetKey
      },
      compareEnabled: finalCompareEnabled,
      compareRanges: finalCompareRanges,
      // 초기 데이터 (로딩 상태)
      data: null,
      loading: true
    });
    
    handleClose();
  };

  // 다음 단계로
  const handleNext = () => {
    if (currentStep < 2) {
      setCurrentStep(currentStep + 1);
    }
  };

  // 이전 단계로
  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // 다음 버튼 활성화 여부
  const canGoNext = () => {
    if (currentStep === 0) return selectedCategory !== null;
    if (currentStep === 1) return selectedPreset !== null;
    return true;
  };

  // Step 1: 카테고리 선택 렌더링
  const renderStep1 = () => (
    <div>
      <Text style={{ display: 'block', marginBottom: 16, fontSize: 15 }}>
        무엇을 보고 싶으세요?
      </Text>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Object.values(DATA_SOURCES).map(source => (
          <div
            key={source.id}
            onClick={() => source.enabled && setSelectedCategory(source.id)}
            style={{
              padding: 20,
              border: selectedCategory === source.id ? '2px solid #1890ff' : '1px solid #e8e8e8',
              borderRadius: 12,
              cursor: source.enabled ? 'pointer' : 'not-allowed',
              background: selectedCategory === source.id ? '#e6f7ff' : source.enabled ? 'white' : '#fafafa',
              opacity: source.enabled ? 1 : 0.6,
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: 16
            }}
          >
            <div style={{ 
              width: 56, 
              height: 56, 
              borderRadius: 12, 
              background: source.enabled ? '#f0f5ff' : '#f5f5f5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {source.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ 
                fontWeight: 600, 
                fontSize: 16, 
                marginBottom: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                {source.name}
                {source.comingSoon && (
                  <span style={{ 
                    fontSize: 11, 
                    background: '#f0f0f0', 
                    padding: '2px 8px', 
                    borderRadius: 4,
                    color: '#8c8c8c',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    <LockOutlined style={{ fontSize: 10 }} /> 준비중
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, color: '#8c8c8c' }}>{source.description}</div>
            </div>
            {source.enabled && (
              <div style={{ 
                width: 24, 
                height: 24, 
                borderRadius: '50%',
                border: selectedCategory === source.id ? 'none' : '2px solid #d9d9d9',
                background: selectedCategory === source.id ? '#1890ff' : 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {selectedCategory === source.id && <CheckOutlined style={{ color: 'white', fontSize: 12 }} />}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  // Step 2: 지표 선택 렌더링
  const renderStep2 = () => {
    const presets = WIDGET_PRESETS[selectedCategory];
    if (!presets) return <div>해당 카테고리의 위젯이 없습니다.</div>;

    const sections = [
      { key: 'kpi', label: '숫자 카드', sublabel: '한눈에 보기', items: presets.kpi || [] },
      { key: 'chart', label: '그래프', sublabel: '추이 보기', items: presets.chart || [] },
      { key: 'list', label: '목록', sublabel: '상세 보기', items: presets.list || [] }
    ];

    return (
      <div>
        <Text style={{ display: 'block', marginBottom: 16, fontSize: 15 }}>
          어떤 정보를 볼까요?
        </Text>
        <div style={{ maxHeight: 400, overflowY: 'auto', paddingRight: 8 }}>
        {sections.map(section => (
          section.items.length > 0 && (
            <div key={section.key} style={{ marginBottom: 20 }}>
              <div style={{ 
                fontSize: 13, 
                color: '#8c8c8c', 
                marginBottom: 10,
                borderBottom: '1px solid #f0f0f0',
                paddingBottom: 8
              }}>
                {section.label} ({section.sublabel})
              </div>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(3, 1fr)', 
                gap: 10 
              }}>
                {section.items.map(item => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedPreset(item)}
                    style={{
                      padding: 14,
                      border: selectedPreset?.id === item.id ? '2px solid #1890ff' : '1px solid #e8e8e8',
                      borderRadius: 10,
                      cursor: 'pointer',
                      background: selectedPreset?.id === item.id ? '#e6f7ff' : 'white',
                      transition: 'all 0.2s ease',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontSize: 28, marginBottom: 6 }}>{item.icon}</div>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: '#8c8c8c', lineHeight: 1.3 }}>{item.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        ))}
        </div>
      </div>
    );
  };

  // Step 3: 기간 설정 렌더링
  const renderStep3 = () => {
    const [currentStart, currentEnd] = getCurrentDateRange();
    
    // 선택된 지표가 비교 기능을 지원하는지 확인
    const shouldShowCompare = selectedPreset && 
      !TYPES_WITHOUT_COMPARE.includes(selectedPreset.type);

    return (
      <div>
        <Text style={{ display: 'block', marginBottom: 16, fontSize: 15 }}>
          언제 데이터를 볼까요?
        </Text>
        
        {/* 기간 선택 */}
        <div style={{ 
          padding: 20, 
          border: '1px solid #e8e8e8', 
          borderRadius: 12, 
          marginBottom: 16,
          background: '#fafafa'
        }}>
          <div style={{ 
            fontWeight: 600, 
            marginBottom: 12, 
            display: 'flex', 
            alignItems: 'center', 
            gap: 16
          }}>
            <span>기간 선택</span>
            {datePresetKey !== 'custom' && currentStart && (
              <span style={{ fontSize: 13, color: '#1890ff', fontWeight: 600 }}>
                {currentStart.format('YYYY-MM-DD')} ~ {currentEnd.format('YYYY-MM-DD')}
              </span>
            )}
          </div>
          <Radio.Group 
            value={datePresetKey} 
            onChange={e => setDatePresetKey(e.target.value)}
            style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}
          >
            {DATE_PRESETS.map(preset => (
              <Radio.Button 
                key={preset.key} 
                value={preset.key}
                style={{ borderRadius: 6 }}
              >
                {preset.label}
              </Radio.Button>
            ))}
          </Radio.Group>
          
          {datePresetKey === 'custom' && (
            <div style={{ marginTop: 12 }}>
              <RangePicker
                value={customDateRange}
                onChange={setCustomDateRange}
                format="YYYY-MM-DD"
                style={{ width: '100%' }}
              />
            </div>
          )}
        </div>

        {/* 비교 기간 - 지원하는 타입에만 표시 */}
        {shouldShowCompare && (
          <div style={{ 
            padding: 16, 
            border: '1px solid #e8e8e8', 
            borderRadius: 12,
            background: compareEnabled ? '#f6ffed' : '#fafafa'
          }}>
            {/* 비교하기 체크박스 */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 16,
              marginBottom: compareEnabled ? 12 : 0 
            }}>
              <Checkbox 
                checked={compareEnabled} 
                onChange={e => setCompareEnabled(e.target.checked)}
              >
                <span style={{ fontWeight: 600 }}>이전 기간과 비교하기</span>
              </Checkbox>
              {/* 자동 계산된 날짜 표시 (모든 지표 공통) */}
              {compareEnabled && compareRanges[0]?.type === 'auto' && (
                (() => {
                  const [compareStart, compareEnd] = getCompareRangeDates(compareRanges[0]);
                  return (
                    <span style={{ fontSize: 13, color: '#52c41a', fontWeight: 600 }}>
                      {compareStart.format('YYYY-MM-DD')} ~ {compareEnd.format('YYYY-MM-DD')} 와 비교
                    </span>
                  );
                })()
              )}
            </div>
            
            {compareEnabled && (
              <>
                {/* 기간별 매출 비교일 때: 첫 번째는 일반 UI + 추가 기간들 */}
                {selectedPreset?.id === 'period_revenue_compare' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* 첫 번째 비교 기간: 일반 UI 스타일 */}
                    {compareRanges.length > 0 && (() => {
                      const firstRange = compareRanges[0];
                      return (
                        <div key={firstRange.id} style={{ marginLeft: 24 }}>
                          {/* 라디오 그룹 */}
                          <Radio.Group 
                            value={firstRange.type} 
                            onChange={e => handleCompareRangeTypeChange(firstRange.id, e.target.value)}
                            style={{ display: 'flex', flexDirection: 'row', gap: 16 }}
                          >
                            <Radio value="auto">
                              <span>같은 일자의 이전 달 (자동 계산)</span>
                            </Radio>
                            <Radio value="custom">
                              <span>직접 선택</span>
                            </Radio>
                          </Radio.Group>
                          
                          {/* 직접 선택 시 날짜 선택기 */}
                          {firstRange.type === 'custom' && (
                            <div style={{ marginTop: 12 }}>
                              <RangePicker
                                value={firstRange.customRange}
                                onChange={(dates) => handleCompareRangeCustomChange(firstRange.id, dates)}
                                format="YYYY-MM-DD"
                                style={{ width: '100%' }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    
                    {/* 2번째 이후 추가 비교 기간들 */}
                    {compareRanges.slice(1).map((range, index) => {
                      const [compareStart, compareEnd] = getCompareRangeDates(range);
                      const actualIndex = index + 1; // 실제 인덱스 (0-based에서 1을 더함)
                      return (
                        <div 
                          key={range.id}
                          style={{ 
                            padding: 12, 
                            background: 'white', 
                            borderRadius: 8,
                            border: '1px solid #e8e8e8',
                            marginLeft: 24
                          }}
                        >
                          {/* 비교 기간 헤더 */}
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            marginBottom: 8
                          }}>
                            <span style={{ 
                              fontSize: 13, 
                              fontWeight: 600, 
                              color: '#595959',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8
                            }}>
                              <span style={{ 
                                width: 20, 
                                height: 20, 
                                borderRadius: '50%', 
                                background: '#d9d9d9',
                                color: 'white',
                                fontSize: 11,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}>
                                {actualIndex + 1}
                              </span>
                              비교 {actualIndex + 1}
                              {range.type === 'auto' && (
                                <span style={{ color: '#52c41a', fontWeight: 500, fontSize: 12 }}>
                                  {compareStart.format('YYYY-MM-DD')} ~ {compareEnd.format('YYYY-MM-DD')}
                                </span>
                              )}
                            </span>
                            {/* 삭제 버튼 */}
                            <Button 
                              type="text" 
                              size="small"
                              icon={<DeleteOutlined />}
                              onClick={() => handleRemoveCompareRange(range.id)}
                              style={{ color: '#ff4d4f' }}
                            />
                          </div>
                          
                          {/* 비교 기간 타입 선택 */}
                          <Radio.Group 
                            value={range.type} 
                            onChange={e => handleCompareRangeTypeChange(range.id, e.target.value)}
                            style={{ display: 'flex', gap: 16 }}
                            size="small"
                          >
                            <Radio value="auto">
                              {range.monthsAgo === 1 ? '이전 달 (자동)' : `${range.monthsAgo}달 전 (자동)`}
                            </Radio>
                            <Radio value="custom">직접 선택</Radio>
                          </Radio.Group>
                          
                          {/* 직접 선택 시 날짜 선택기 */}
                          {range.type === 'custom' && (
                            <div style={{ marginTop: 8 }}>
                              <RangePicker
                                value={range.customRange}
                                onChange={(dates) => handleCompareRangeCustomChange(range.id, dates)}
                                format="YYYY-MM-DD"
                                style={{ width: '100%' }}
                                size="small"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                    
                    {/* 비교할 기간 추가 버튼 (점선) */}
                    {compareRanges.length < 4 && (
                      <div 
                        onClick={handleAddCompareRange}
                        style={{
                          border: '2px dashed #d9d9d9',
                          borderRadius: 8,
                          padding: '12px 16px',
                          textAlign: 'center',
                          cursor: 'pointer',
                          color: '#8c8c8c',
                          background: 'white',
                          transition: 'all 0.2s ease',
                          marginLeft: 24
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = '#1890ff';
                          e.currentTarget.style.color = '#1890ff';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = '#d9d9d9';
                          e.currentTarget.style.color = '#8c8c8c';
                        }}
                      >
                        <PlusOutlined style={{ marginRight: 8 }} />
                        비교할 기간 추가 (최대 4개)
                      </div>
                    )}
                  </div>
                ) : (
                  /* 그 외 지표: 단일 비교 기간 UI (이전 스타일) */
                  <div style={{ marginLeft: 24 }}>
                    <Radio.Group 
                      value={compareRanges[0]?.type || 'auto'} 
                      onChange={e => handleCompareRangeTypeChange(compareRanges[0]?.id, e.target.value)}
                      style={{ display: 'flex', flexDirection: 'row', gap: 16 }}
                    >
                      <Radio value="auto">
                        <span>같은 일자의 이전 달 (자동 계산)</span>
                      </Radio>
                      <Radio value="custom">
                        <span>직접 선택</span>
                      </Radio>
                    </Radio.Group>
                    
                    {compareRanges[0]?.type === 'custom' && (
                      <div style={{ marginTop: 12 }}>
                        <RangePicker
                          value={compareRanges[0]?.customRange}
                          onChange={(dates) => handleCompareRangeCustomChange(compareRanges[0]?.id, dates)}
                          format="YYYY-MM-DD"
                          style={{ width: '100%' }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* 도움말 - 타입에 따라 다른 메시지 */}
        <div style={{ 
          marginTop: 16, 
          padding: 12, 
          background: '#fffbe6', 
          borderRadius: 8,
          fontSize: 13,
          color: '#ad8b00'
        }}>
          {selectedPreset?.id === 'period_revenue_compare' ? (
            <>💡 Tip: 여러 기간을 추가하면 월별 추이를 한눈에 비교할 수 있어요</>
          ) : shouldShowCompare ? (
            <>💡 Tip: 비교 기간을 설정하면 증감률(%)을 함께 볼 수 있어요</>
          ) : (
            <>💡 Tip: 선택한 기간의 상세 목록을 볼 수 있어요</>
          )}
        </div>
      </div>
    );
  };

  const steps = [
    { title: '카테고리', description: '무엇을 볼까요?' },
    { title: '지표', description: '어떤 정보?' },
    { title: '기간', description: '언제 데이터?' }
  ];

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PlusOutlined style={{ color: '#1890ff' }} />
          <span>위젯 추가</span>
        </div>
      }
      open={visible}
      onCancel={handleClose}
      width={640}
      style={{ top: 20 }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button 
            onClick={handlePrev} 
            disabled={currentStep === 0}
            icon={<ArrowLeftOutlined />}
          >
            이전
          </Button>
          <div>
            <Button onClick={handleClose} style={{ marginRight: 8 }}>
              취소
            </Button>
            {currentStep < 2 ? (
              <Button 
                type="primary" 
                onClick={handleNext}
                disabled={!canGoNext()}
              >
                다음 <ArrowRightOutlined />
              </Button>
            ) : (
              <Button 
                type="primary" 
                onClick={handleComplete}
                disabled={!selectedPreset}
                icon={<CheckOutlined />}
              >
                완료
              </Button>
            )}
          </div>
        </div>
      }
    >
      {/* 스텝 인디케이터 */}
      <Steps 
        current={currentStep} 
        size="small" 
        style={{ marginBottom: 24 }}
        items={steps.map(step => ({ title: step.title }))}
      />
      
      {/* 스텝별 콘텐츠 */}
      <div style={{ minHeight: 320 }}>
        {currentStep === 0 && renderStep1()}
        {currentStep === 1 && renderStep2()}
        {currentStep === 2 && renderStep3()}
      </div>
    </Modal>
  );
};

// ============================================================================
// 메인 대시보드 컴포넌트
// ============================================================================
function MyDashboard() {
  // 컨테이너 너비 측정 (ResizeObserver로 사이드바 변화도 감지)
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(1200);
  
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    
    updateWidth();
    
    // ResizeObserver로 컨테이너 크기 변화 감지 (사이드바 접힘 포함)
    const resizeObserver = new ResizeObserver(() => {
      updateWidth();
    });
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    window.addEventListener('resize', updateWidth);
    
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, []);
  
  // 날짜 필터 state
  const [dateRange, setDateRange] = useState([
    dayjs().subtract(7, 'days'),
    dayjs()
  ]);

  // 초기화 완료 플래그
  const [initialized, setInitialized] = useState(false);

  // 위젯 목록 state - 초기값은 빈 배열, localStorage에서 로드
  const [widgets, setWidgets] = useState([]);

  // 초기 로드: localStorage에서 위젯 불러오기
  useEffect(() => {
    const loadInitialData = async () => {
      const stored = loadFromLocalStorage();
      
      if (stored && stored.widgets.length > 0) {
        // 저장된 위젯이 있으면 불러오기
        setWidgets(stored.widgets);
        if (stored.globalDateRange) {
          setDateRange(stored.globalDateRange);
        }
        
        // API 연결된 위젯들 데이터 로드
        const apiWidgets = stored.widgets.filter(w => w.presetId && w.apiEndpoint);
        if (apiWidgets.length > 0) {
          const loadedWidgets = await Promise.all(
            apiWidgets.map(async (w) => {
              try {
                const { data: apiData, compareDataList, error } = await fetchWidgetData(w);
                if (error) {
                  return { ...w, loading: false, error, data: null };
                }
                const transformedData = transformWidgetData(w, apiData, compareDataList);
                return { ...w, loading: false, error: null, data: transformedData };
              } catch (err) {
                return { ...w, loading: false, error: err.message, data: null };
              }
            })
          );
          
          setWidgets(prev => {
            const loadedMap = new Map(loadedWidgets.map(w => [w.id, w]));
            return prev.map(w => loadedMap.get(w.id) || w);
          });
        }
      } else {
        // 저장된 위젯이 없으면 기본 샘플 위젯 표시
        setWidgets([
          {
            id: 'sample-1',
            type: 'text',
            title: '시작하기',
            widthSize: 'large',
            heightSize: 'short',
            data: { 
              title: '👋 나만의 대시보드에 오신 것을 환영합니다!', 
              content: '위젯 추가 버튼을 클릭하여 원하는 데이터를 추가해보세요.' 
            }
          }
        ]);
      }
      
      setInitialized(true);
    };

    loadInitialData();
  }, []);

  // 위젯 변경 시 자동 저장 (초기화 후에만)
  useEffect(() => {
    if (initialized && widgets.length > 0) {
      // 샘플 위젯만 있는 경우는 저장하지 않음
      const hasRealWidgets = widgets.some(w => !w.id.startsWith('sample-'));
      if (hasRealWidgets) {
        saveToLocalStorage(widgets, dateRange);
      }
    }
  }, [widgets, dateRange, initialized]);

  // 모달 state
  const [addModalVisible, setAddModalVisible] = useState(false);

  // 위젯 데이터 로드 함수
  const loadWidgetData = useCallback(async (widget) => {
    // API 연결된 위젯만 처리 (presetId가 있는 경우)
    if (!widget.presetId || !widget.apiEndpoint) {
      return widget;
    }

    try {
      const { data: apiData, compareDataList, error } = await fetchWidgetData(widget);

      if (error) {
        return { ...widget, loading: false, error: error, data: null };
      }

      const transformedData = transformWidgetData(widget, apiData, compareDataList);
      return { ...widget, loading: false, error: null, data: transformedData };
    } catch (err) {
      console.error('[loadWidgetData Error]', err);
      return { ...widget, loading: false, error: err.message, data: null };
    }
  }, []);

  // 위젯 추가 시 데이터 로드
  const handleAddWidget = useCallback(async (newWidget) => {
    // 먼저 로딩 상태로 추가
    setWidgets(prev => [...prev, newWidget]);

    // API 연결된 위젯이면 데이터 로드
    if (newWidget.presetId && newWidget.apiEndpoint) {
      const loadedWidget = await loadWidgetData(newWidget);
      setWidgets(prev => prev.map(w => w.id === loadedWidget.id ? loadedWidget : w));
    }
  }, [loadWidgetData]);

  // 대시보드 날짜 변경 시 모든 위젯 데이터 새로고침
  const refreshAllWidgets = useCallback(async () => {
    const widgetsToRefresh = widgets.filter(w => w.presetId && w.apiEndpoint);
    if (widgetsToRefresh.length === 0) return;

    // 모든 위젯을 로딩 상태로
    setWidgets(prev => prev.map(w => 
      w.presetId && w.apiEndpoint ? { ...w, loading: true } : w
    ));

    // 병렬로 데이터 로드
    const loadedWidgets = await Promise.all(
      widgetsToRefresh.map(w => loadWidgetData(w))
    );

    // 결과 업데이트
    setWidgets(prev => {
      const loadedMap = new Map(loadedWidgets.map(w => [w.id, w]));
      return prev.map(w => loadedMap.get(w.id) || w);
    });
  }, [widgets, loadWidgetData]);

  // 위젯 삭제
  const handleDeleteWidget = useCallback((widgetId) => {
    Modal.confirm({
      title: '위젯 삭제',
      content: '이 위젯을 삭제하시겠습니까?',
      okText: '삭제',
      cancelText: '취소',
      okButtonProps: { danger: true },
      onOk: () => {
        setWidgets(prev => prev.filter(w => w.id !== widgetId));
      }
    });
  }, []);

  // 위젯 편집
  const handleEditWidget = useCallback((widget) => {
    console.log('Edit widget:', widget);
  }, []);

  // 위젯 크기 변경 (너비 + 높이)
  const handleResizeWidget = useCallback((widgetId, newWidthSize, newHeightSize) => {
    setWidgets(prev => prev.map(w => 
      w.id === widgetId ? { ...w, widthSize: newWidthSize, heightSize: newHeightSize } : w
    ));
  }, []);

  const gap = 16;
  const colWidth = (containerWidth - gap * 2) / 3;

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      {/* 헤더 영역 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 24,
        background: 'white',
        padding: '16px 24px',
        borderRadius: 8,
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <AppstoreOutlined style={{ fontSize: 24, color: '#1890ff' }} />
          <Title level={4} style={{ margin: 0 }}>나만의 대시보드</Title>
        </div>
        
        <Space size="middle">
          <RangePicker
            value={dateRange}
            onChange={setDateRange}
            format="YYYY-MM-DD"
            allowClear={false}
            style={{ width: 260 }}
            presets={[
              { label: '오늘', value: [dayjs(), dayjs()] },
              { label: '최근 7일', value: [dayjs().subtract(7, 'days'), dayjs()] },
              { label: '최근 30일', value: [dayjs().subtract(30, 'days'), dayjs()] },
              { label: '이번 달', value: [dayjs().startOf('month'), dayjs()] }
            ]}
          />
          
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => setAddModalVisible(true)}
          >
            위젯 추가
          </Button>
        </Space>
      </div>

      {/* 위젯 그리드 영역 */}
      <div ref={containerRef}>
        {widgets.length === 0 ? (
          <Card style={{ textAlign: 'center', padding: 60 }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div>
                  <Text type="secondary" style={{ fontSize: 16, display: 'block', marginBottom: 16 }}>
                    아직 추가된 위젯이 없습니다
                  </Text>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalVisible(true)}>
                    첫 번째 위젯 추가하기
                  </Button>
                </div>
              }
            />
          </Card>
        ) : (
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: gap,
            alignItems: 'flex-start',
            paddingBottom: 40
          }}>
            {widgets.map(widget => (
              <DashboardWidget
                key={widget.id}
                widget={widget}
                onDelete={handleDeleteWidget}
                onEdit={handleEditWidget}
                onResize={handleResizeWidget}
                containerWidth={containerWidth}
                containerRef={containerRef}
              />
            ))}
            
            {/* 위젯 추가 플레이스홀더 */}
            <div 
              onClick={() => setAddModalVisible(true)}
              style={{ 
                width: colWidth,
                minWidth: 200,
                height: 150,
                border: '2px dashed #d9d9d9',
                borderRadius: 8,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                background: 'white',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#1890ff';
                e.currentTarget.style.background = '#fafafa';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#d9d9d9';
                e.currentTarget.style.background = 'white';
              }}
            >
              <PlusOutlined style={{ fontSize: 32, color: '#bfbfbf', marginBottom: 8 }} />
              <Text type="secondary">위젯 추가</Text>
            </div>
          </div>
        )}
      </div>

      {/* 위젯 추가 모달 */}
      <AddWidgetModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onAdd={handleAddWidget}
      />
    </div>
  );
}

export default MyDashboard;
