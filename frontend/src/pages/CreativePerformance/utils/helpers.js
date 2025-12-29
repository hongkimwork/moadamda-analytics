// ============================================================================
// 헬퍼 함수
// ============================================================================

/**
 * 레코드의 고유 키 생성 (비교 기능용)
 * @param {Object} record - 광고 소재 레코드
 * @returns {string} 고유 키
 */
export const getRowKey = (record) => {
  return `${record.creative_name}||${record.utm_source}||${record.utm_medium}||${record.utm_campaign}`;
};
