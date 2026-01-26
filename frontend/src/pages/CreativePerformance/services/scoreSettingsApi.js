// ============================================================================
// 모수 평가 기준 설정 API
// ============================================================================

const API_BASE = '/api/creative-performance';

/**
 * 현재 설정 조회
 * @returns {Promise<Object>} { success: boolean, data: Object|null }
 */
export const fetchScoreSettings = async () => {
  const response = await fetch(`${API_BASE}/score-settings`);
  return response.json();
};

/**
 * 설정 저장
 * @param {Object} settings - 설정 데이터
 * @returns {Promise<Object>} { success: boolean, data: Object, warnings: string[], errors: string[] }
 */
export const saveScoreSettings = async (settings) => {
  const response = await fetch(`${API_BASE}/score-settings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(settings)
  });
  return response.json();
};

/**
 * 설정 삭제 (초기화)
 * @returns {Promise<Object>} { success: boolean }
 */
export const deleteScoreSettings = async () => {
  const response = await fetch(`${API_BASE}/score-settings`, {
    method: 'DELETE'
  });
  return response.json();
};
