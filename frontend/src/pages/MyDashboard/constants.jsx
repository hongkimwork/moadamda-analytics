import React from 'react';
import {
  ShoppingCartOutlined,
  FunnelPlotOutlined,
  TeamOutlined,
  SoundOutlined,
  NumberOutlined,
  LineChartOutlined,
  BarChartOutlined,
  TableOutlined,
  FundOutlined,
  FileTextOutlined,
  RiseOutlined
} from '@ant-design/icons';
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
    icon: <ShoppingCartOutlined style={{ fontSize: 28, color: '#1890ff' }} />,
    description: '오늘 매출, 주문 건수, 상품별 판매 등',
    enabled: true 
  },
  funnel: {
    id: 'funnel',
    name: '전환 퍼널 분석',
    icon: <FunnelPlotOutlined style={{ fontSize: 28, color: '#52c41a' }} />,
    description: '전체 또는 채널별 전환 단계 분석',
    enabled: true
  },
  customer_type: {
    id: 'customer_type',
    name: '고객 유형 분석',
    icon: <TeamOutlined style={{ fontSize: 28, color: '#722ed1' }} />,
    description: '신규 vs 재구매 고객 비교',
    enabled: true
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

// 높이 크기 (3단계)
export const HEIGHT_SIZES = {
  short: { height: 150, label: '작음' },
  medium: { height: 250, label: '중간' },
  tall: { height: 350, label: '큼' }
};

// ============================================================================
// 위젯 타입 정의 (기본 크기 포함)
// ============================================================================

// 비교 기능을 지원하지 않는 타입 (목록형, 텍스트형)
export const TYPES_WITHOUT_COMPARE = ['table', 'text'];

export const WIDGET_TYPES = [
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
