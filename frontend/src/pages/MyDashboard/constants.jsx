import React from 'react';
import { ShoppingCart, Users } from 'lucide-react';
import dayjs from 'dayjs';

// ============================================================================
// API & Storage 상수
// ============================================================================
export const API_BASE_URL = import.meta.env.VITE_API_URL || '';
export const STORAGE_KEY = 'moadamda_my_dashboard';

// ============================================================================
// 데이터 소스 정의 (확장성 고려)
// ============================================================================
export const DATA_SOURCES = {
  cafe24: { 
    id: 'cafe24',
    name: '주문 / 매출', 
    icon: <ShoppingCart size={28} color="#1890ff" />,
    description: '오늘 매출, 주문 건수, 상품별 판매 등',
    enabled: true 
  },
  customer_analysis: {
    id: 'customer_analysis',
    name: '고객 분석',
    icon: <Users size={28} color="#722ed1" />,
    description: '전환 단계 분석 및 신규/재구매 고객 비교',
    enabled: true
  }
};

// ============================================================================
// 기간 프리셋 정의
// ============================================================================
export const DATE_PRESETS = [
  { key: 'today', label: '오늘', getValue: () => [dayjs(), dayjs()] },
  { key: 'yesterday', label: '어제', getValue: () => [dayjs().subtract(1, 'day'), dayjs().subtract(1, 'day')] },
  { key: 'last7days', label: '최근 7일', getValue: () => [dayjs().subtract(6, 'days'), dayjs()] },
  { key: 'last30days', label: '최근 30일', getValue: () => [dayjs().subtract(29, 'days'), dayjs()] },
  { key: 'thisMonth', label: '이번 달', getValue: () => [dayjs().startOf('month'), dayjs()] },
  { key: 'lastMonth', label: '지난 달', getValue: () => [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
  { key: 'custom', label: '직접 선택', getValue: () => null }
];

// ============================================================================
// 크기 시스템 정의
// ============================================================================

// 너비 크기 (3단 그리드)
export const WIDTH_SIZES = {
  small: { cols: 1, label: '1/3' },
  medium: { cols: 2, label: '2/3' },
  large: { cols: 3, label: '전체' }
};

// 높이 크기 (2단계)
// units는 react-grid-layout용 (rowHeight=50 기준)
export const HEIGHT_SIZES = {
  medium: { height: 250, units: 5, label: '중간' },
  tall: { height: 350, units: 7, label: '큼' }
};

// ============================================================================
// 위젯 타입 상수
// ============================================================================

// 비교 기능을 지원하지 않는 타입 (목록형, 텍스트형)
export const TYPES_WITHOUT_COMPARE = ['table', 'text'];
