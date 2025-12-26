/**
 * 숫자 포맷팅 유틸리티
 */

/**
 * 숫자를 천 단위 구분자로 포맷팅
 */
export function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '-';
  const num = Number(value);
  if (isNaN(num)) return '-';
  return num.toLocaleString('ko-KR');
}

/**
 * 통화 포맷팅 (원화)
 */
export function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return '-';
  const num = Number(value);
  if (isNaN(num)) return '-';
  return `₩${Math.round(num).toLocaleString('ko-KR')}`;
}

/**
 * 퍼센트 포맷팅
 */
export function formatPercent(value) {
  if (value === null || value === undefined || value === '') return '-';
  const num = Number(value);
  if (isNaN(num)) return '-';
  return `${num.toFixed(2)}%`;
}

/**
 * 상태에 따른 색상 반환
 */
export function getStatusColor(status) {
  const colors = {
    'ACTIVE': '#52c41a',
    'PAUSED': '#faad14',
    'DELETED': '#ff4d4f',
    'ARCHIVED': '#8c8c8c',
    'IN_PROCESS': '#1890ff',
    'WITH_ISSUES': '#ff4d4f',
    'PENDING_REVIEW': '#faad14',
    'DISAPPROVED': '#ff4d4f',
    'PREAPPROVED': '#1890ff',
    'PENDING_BILLING_INFO': '#faad14',
    'CAMPAIGN_PAUSED': '#faad14',
    'ADSET_PAUSED': '#faad14'
  };
  return colors[status] || '#8c8c8c';
}

/**
 * 상태 텍스트 반환
 */
export function getStatusText(status) {
  const texts = {
    'ACTIVE': '활성',
    'PAUSED': '일시중지',
    'DELETED': '삭제됨',
    'ARCHIVED': '보관됨',
    'IN_PROCESS': '처리 중',
    'WITH_ISSUES': '문제 있음',
    'PENDING_REVIEW': '검토 대기',
    'DISAPPROVED': '거부됨',
    'PREAPPROVED': '사전 승인',
    'PENDING_BILLING_INFO': '결제 정보 대기',
    'CAMPAIGN_PAUSED': '캠페인 일시중지',
    'ADSET_PAUSED': '광고세트 일시중지'
  };
  return texts[status] || status;
}
