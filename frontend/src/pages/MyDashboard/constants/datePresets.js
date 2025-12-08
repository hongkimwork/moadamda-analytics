import dayjs from 'dayjs';

/**
 * 기간 프리셋 정의
 * 사용자가 빠르게 선택할 수 있는 기간 옵션
 */
export const DATE_PRESETS = [
  { key: 'today', label: '오늘', getValue: () => [dayjs(), dayjs()] },
  { key: 'yesterday', label: '어제', getValue: () => [dayjs().subtract(1, 'day'), dayjs().subtract(1, 'day')] },
  { key: 'last7days', label: '최근 7일', getValue: () => [dayjs().subtract(6, 'days'), dayjs()] },
  { key: 'last30days', label: '최근 30일', getValue: () => [dayjs().subtract(29, 'days'), dayjs()] },
  { key: 'thisMonth', label: '이번 달', getValue: () => [dayjs().startOf('month'), dayjs()] },
  { key: 'lastMonth', label: '지난 달', getValue: () => [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
  { key: 'custom', label: '직접 선택', getValue: () => null }
];

/**
 * 이전 기간 자동 계산 함수
 * 같은 일자의 이전 달로 비교 기간 생성
 * 예: 12월 1일 ~ 12월 5일 → 11월 1일 ~ 11월 5일
 */
export const getComparisonPeriod = (startDate, endDate) => {
  return [
    startDate.subtract(1, 'month'),
    endDate.subtract(1, 'month')
  ];
};
