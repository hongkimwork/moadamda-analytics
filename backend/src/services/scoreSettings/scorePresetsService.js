// ============================================================================
// 모수 평가 프리셋 Service
// ============================================================================

const repository = require('./scorePresetsRepository');
const { validateSettings, getWarnings } = require('./scoreSettingsService');

/**
 * 모든 프리셋 조회
 * @returns {Object} { success: boolean, data: Array }
 */
const getAllPresets = async () => {
  try {
    const presets = await repository.getAllPresets();
    return {
      success: true,
      data: presets
    };
  } catch (error) {
    console.error('프리셋 목록 조회 실패:', error);
    throw error;
  }
};

/**
 * 특정 프리셋 조회
 * @param {number} id - 프리셋 ID
 * @returns {Object} { success: boolean, data: Object|null }
 */
const getPresetById = async (id) => {
  try {
    const preset = await repository.getPresetById(id);
    return {
      success: true,
      data: preset
    };
  } catch (error) {
    console.error('프리셋 조회 실패:', error);
    throw error;
  }
};

/**
 * 현재 적용 중인 프리셋 조회
 * @returns {Object} { success: boolean, data: Object|null }
 */
const getActivePreset = async () => {
  try {
    const preset = await repository.getActivePreset();
    return {
      success: true,
      data: preset
    };
  } catch (error) {
    console.error('적용 중인 프리셋 조회 실패:', error);
    throw error;
  }
};

/**
 * 프리셋 생성
 * @param {Object} preset - 프리셋 데이터
 * @returns {Object} { success: boolean, data: Object, warnings: string[], errors: string[] }
 */
const createPreset = async (preset) => {
  try {
    // 이름 검증
    if (!preset.name || preset.name.trim() === '') {
      return {
        success: false,
        errors: ['프리셋 이름을 입력해주세요.']
      };
    }

    // 설정값 유효성 검사
    const validation = validateSettings(preset);
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors
      };
    }

    // 경고 메시지 생성
    const warnings = getWarnings(preset);

    // 생성
    const created = await repository.createPreset(preset);

    return {
      success: true,
      data: created,
      warnings
    };
  } catch (error) {
    console.error('프리셋 생성 실패:', error);
    throw error;
  }
};

/**
 * 프리셋 업데이트
 * @param {number} id - 프리셋 ID
 * @param {Object} preset - 업데이트할 데이터
 * @returns {Object} { success: boolean, data: Object, warnings: string[], errors: string[] }
 */
const updatePreset = async (id, preset) => {
  try {
    // 프리셋 존재 확인
    const existing = await repository.getPresetById(id);
    if (!existing) {
      return {
        success: false,
        errors: ['프리셋을 찾을 수 없습니다.']
      };
    }

    // 설정값 유효성 검사 (설정값이 포함된 경우)
    if (preset.weight_scroll !== undefined || preset.enabled_metrics !== undefined) {
      const mergedPreset = { ...existing, ...preset };
      const validation = validateSettings(mergedPreset);
      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors
        };
      }
    }

    // 경고 메시지 생성
    const mergedPreset = { ...existing, ...preset };
    const warnings = getWarnings(mergedPreset);

    // 업데이트
    const updated = await repository.updatePreset(id, preset);

    return {
      success: true,
      data: updated,
      warnings
    };
  } catch (error) {
    console.error('프리셋 업데이트 실패:', error);
    throw error;
  }
};

/**
 * 프리셋 이름만 업데이트
 * @param {number} id - 프리셋 ID
 * @param {string} name - 새 이름
 * @returns {Object} { success: boolean, data: Object }
 */
const updatePresetName = async (id, name) => {
  try {
    if (!name || name.trim() === '') {
      return {
        success: false,
        errors: ['프리셋 이름을 입력해주세요.']
      };
    }

    const updated = await repository.updatePresetName(id, name.trim());
    if (!updated) {
      return {
        success: false,
        errors: ['프리셋을 찾을 수 없습니다.']
      };
    }

    return {
      success: true,
      data: updated
    };
  } catch (error) {
    console.error('프리셋 이름 업데이트 실패:', error);
    throw error;
  }
};

/**
 * 프리셋 삭제
 * @param {number} id - 프리셋 ID
 * @returns {Object} { success: boolean }
 */
const deletePreset = async (id) => {
  try {
    const existing = await repository.getPresetById(id);
    if (!existing) {
      return {
        success: false,
        errors: ['프리셋을 찾을 수 없습니다.']
      };
    }

    await repository.deletePreset(id);
    return {
      success: true
    };
  } catch (error) {
    console.error('프리셋 삭제 실패:', error);
    throw error;
  }
};

/**
 * 프리셋 저장 및 활성화 (저장 및 적용)
 * @param {number} id - 프리셋 ID
 * @param {Object} preset - 업데이트할 데이터
 * @returns {Object} { success: boolean, data: Object, warnings: string[], errors: string[] }
 */
const saveAndActivatePreset = async (id, preset) => {
  try {
    // 프리셋 존재 확인
    const existing = await repository.getPresetById(id);
    if (!existing) {
      return {
        success: false,
        errors: ['프리셋을 찾을 수 없습니다.']
      };
    }

    // 설정값 유효성 검사
    const mergedPreset = { ...existing, ...preset };
    const validation = validateSettings(mergedPreset);
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors
      };
    }

    // 경고 메시지 생성
    const warnings = getWarnings(mergedPreset);

    // 업데이트
    await repository.updatePreset(id, preset);

    // 활성화
    const activated = await repository.activatePreset(id);

    return {
      success: true,
      data: activated,
      warnings
    };
  } catch (error) {
    console.error('프리셋 저장 및 활성화 실패:', error);
    throw error;
  }
};

/**
 * 새 프리셋 생성 및 활성화 (저장 및 적용)
 * @param {Object} preset - 프리셋 데이터
 * @returns {Object} { success: boolean, data: Object, warnings: string[], errors: string[] }
 */
const createAndActivatePreset = async (preset) => {
  try {
    // 이름 검증
    if (!preset.name || preset.name.trim() === '') {
      return {
        success: false,
        errors: ['프리셋 이름을 입력해주세요.']
      };
    }

    // 설정값 유효성 검사
    const validation = validateSettings(preset);
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors
      };
    }

    // 경고 메시지 생성
    const warnings = getWarnings(preset);

    // 생성
    const created = await repository.createPreset(preset);

    // 활성화
    const activated = await repository.activatePreset(created.id);

    return {
      success: true,
      data: activated,
      warnings
    };
  } catch (error) {
    console.error('프리셋 생성 및 활성화 실패:', error);
    throw error;
  }
};

/**
 * 모든 프리셋 비활성화 (초기화)
 * @returns {Object} { success: boolean }
 */
const resetActivePreset = async () => {
  try {
    await repository.deactivateAllPresets();
    return {
      success: true
    };
  } catch (error) {
    console.error('프리셋 초기화 실패:', error);
    throw error;
  }
};

module.exports = {
  getAllPresets,
  getPresetById,
  getActivePreset,
  createPreset,
  updatePreset,
  updatePresetName,
  deletePreset,
  saveAndActivatePreset,
  createAndActivatePreset,
  resetActivePreset
};
