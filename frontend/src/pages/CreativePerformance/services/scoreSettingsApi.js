// ============================================================================
// 모수 평가 기준 설정 API
// ============================================================================

const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * 현재 설정 조회
 * @returns {Promise<Object>} { success: boolean, data: Object|null }
 */
export const fetchScoreSettings = async () => {
  const response = await fetch(`${API_URL}/api/creative-performance/score-settings`);
  return response.json();
};

/**
 * 설정 저장
 * @param {Object} settings - 설정 데이터
 * @returns {Promise<Object>} { success: boolean, data: Object, warnings: string[], errors: string[] }
 */
export const saveScoreSettings = async (settings) => {
  const response = await fetch(`${API_URL}/api/creative-performance/score-settings`, {
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
  const response = await fetch(`${API_URL}/api/creative-performance/score-settings`, {
    method: 'DELETE'
  });
  return response.json();
};

// ============================================================================
// 모수 평가 프리셋 API
// ============================================================================

/**
 * 모든 프리셋 목록 조회
 * @returns {Promise<Object>} { success: boolean, data: Array }
 */
export const fetchAllPresets = async () => {
  const response = await fetch(`${API_URL}/api/creative-performance/score-presets`);
  return response.json();
};

/**
 * 현재 적용 중인 프리셋 조회
 * @returns {Promise<Object>} { success: boolean, data: Object|null }
 */
export const fetchActivePreset = async () => {
  const response = await fetch(`${API_URL}/api/creative-performance/score-presets/active`);
  return response.json();
};

/**
 * 특정 프리셋 조회
 * @param {number} id - 프리셋 ID
 * @returns {Promise<Object>} { success: boolean, data: Object|null }
 */
export const fetchPresetById = async (id) => {
  const response = await fetch(`${API_URL}/api/creative-performance/score-presets/${id}`);
  return response.json();
};

/**
 * 새 프리셋 생성
 * @param {Object} preset - 프리셋 데이터
 * @returns {Promise<Object>} { success: boolean, data: Object, warnings: string[], errors: string[] }
 */
export const createPreset = async (preset) => {
  const response = await fetch(`${API_URL}/api/creative-performance/score-presets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(preset)
  });
  return response.json();
};

/**
 * 새 프리셋 생성 및 적용
 * @param {Object} preset - 프리셋 데이터
 * @returns {Promise<Object>} { success: boolean, data: Object, warnings: string[], errors: string[] }
 */
export const createAndApplyPreset = async (preset) => {
  const response = await fetch(`${API_URL}/api/creative-performance/score-presets/save-and-apply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(preset)
  });
  return response.json();
};

/**
 * 프리셋 업데이트
 * @param {number} id - 프리셋 ID
 * @param {Object} preset - 업데이트할 데이터
 * @returns {Promise<Object>} { success: boolean, data: Object, warnings: string[], errors: string[] }
 */
export const updatePreset = async (id, preset) => {
  const response = await fetch(`${API_URL}/api/creative-performance/score-presets/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(preset)
  });
  return response.json();
};

/**
 * 프리셋 이름만 업데이트
 * @param {number} id - 프리셋 ID
 * @param {string} name - 새 이름
 * @returns {Promise<Object>} { success: boolean, data: Object }
 */
export const updatePresetName = async (id, name) => {
  const response = await fetch(`${API_URL}/api/creative-performance/score-presets/${id}/name`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name })
  });
  return response.json();
};

/**
 * 기존 프리셋 저장 및 적용
 * @param {number} id - 프리셋 ID
 * @param {Object} preset - 업데이트할 데이터
 * @returns {Promise<Object>} { success: boolean, data: Object, warnings: string[], errors: string[] }
 */
export const saveAndApplyPreset = async (id, preset) => {
  const response = await fetch(`${API_URL}/api/creative-performance/score-presets/${id}/save-and-apply`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(preset)
  });
  return response.json();
};

/**
 * 프리셋 삭제
 * @param {number} id - 프리셋 ID
 * @returns {Promise<Object>} { success: boolean }
 */
export const deletePreset = async (id) => {
  const response = await fetch(`${API_URL}/api/creative-performance/score-presets/${id}`, {
    method: 'DELETE'
  });
  return response.json();
};

/**
 * 적용 중인 프리셋 초기화
 * @returns {Promise<Object>} { success: boolean }
 */
export const resetActivePreset = async () => {
  const response = await fetch(`${API_URL}/api/creative-performance/score-presets/active/reset`, {
    method: 'DELETE'
  });
  return response.json();
};
