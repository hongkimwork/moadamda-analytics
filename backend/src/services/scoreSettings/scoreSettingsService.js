// ============================================================================
// 모수 평가 기준 설정 Service
// ============================================================================

const repository = require('./scoreSettingsRepository');

/**
 * 설정 유효성 검사
 * @param {Object} settings - 설정 데이터
 * @returns {Object} { valid: boolean, errors: string[] }
 */
const validateSettings = (settings) => {
  const errors = [];

  // 평가 방식 검사
  if (!settings.evaluation_type || !['relative', 'absolute'].includes(settings.evaluation_type)) {
    errors.push('평가 방식은 relative 또는 absolute여야 합니다.');
  }

  // 가중치 검사
  const weightSum = (settings.weight_scroll || 0) + (settings.weight_pv || 0) + (settings.weight_duration || 0);
  if (weightSum !== 100) {
    errors.push(`가중치 합계가 ${weightSum}%입니다. 100%가 되어야 합니다.`);
  }

  // 각 가중치 범위 검사
  if (settings.weight_scroll < 0 || settings.weight_scroll > 100) {
    errors.push('스크롤 가중치는 0~100 사이여야 합니다.');
  }
  if (settings.weight_pv < 0 || settings.weight_pv > 100) {
    errors.push('PV 가중치는 0~100 사이여야 합니다.');
  }
  if (settings.weight_duration < 0 || settings.weight_duration > 100) {
    errors.push('체류시간 가중치는 0~100 사이여야 합니다.');
  }

  // 구간 설정 검사
  const configFields = ['scroll_config', 'pv_config', 'duration_config'];
  const configNames = ['스크롤', 'PV', '체류시간'];

  configFields.forEach((field, index) => {
    const config = settings[field];
    const name = configNames[index];

    if (!config || !config.boundaries || !config.scores) {
      errors.push(`${name} 구간 설정이 올바르지 않습니다.`);
      return;
    }

    // 경계값 개수 검사 (4구간이면 경계값 3개)
    if (config.boundaries.length !== 3) {
      errors.push(`${name} 경계값은 3개여야 합니다.`);
    }

    // 점수 개수 검사 (4구간이면 점수 4개)
    if (config.scores.length !== 4) {
      errors.push(`${name} 점수는 4개여야 합니다.`);
    }

    // 경계값 순서 검사 (내림차순이어야 함 - 상위 10% < 상위 30% < 상위 60%)
    // 상대평가: 퍼센트 기준 (오름차순)
    // 절대평가: 수치 기준 (내림차순 - 120초 > 60초 > 30초)
    if (settings.evaluation_type === 'relative') {
      // 상대평가: 경계값이 오름차순이어야 함 (10 < 30 < 60)
      for (let i = 0; i < config.boundaries.length - 1; i++) {
        if (config.boundaries[i] >= config.boundaries[i + 1]) {
          errors.push(`${name} 경계값은 순서대로 커야 합니다. (상위 %)`);
          break;
        }
      }
    } else {
      // 절대평가: 경계값이 내림차순이어야 함 (120 > 60 > 30)
      for (let i = 0; i < config.boundaries.length - 1; i++) {
        if (config.boundaries[i] <= config.boundaries[i + 1]) {
          errors.push(`${name} 경계값은 순서대로 작아져야 합니다. (수치 기준)`);
          break;
        }
      }
    }

    // 점수 순서 검사 (내림차순이어야 함 - 100 > 80 > 50 > 20)
    for (let i = 0; i < config.scores.length - 1; i++) {
      if (config.scores[i] <= config.scores[i + 1]) {
        errors.push(`${name} 점수는 순서대로 작아져야 합니다.`);
        break;
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * 경고 메시지 생성 (저장은 가능하지만 알려줄 내용)
 * @param {Object} settings - 설정 데이터
 * @returns {string[]} 경고 메시지 배열
 */
const getWarnings = (settings) => {
  const warnings = [];

  const configFields = ['scroll_config', 'pv_config', 'duration_config'];
  const configNames = ['스크롤', 'PV', '체류시간'];

  configFields.forEach((field, index) => {
    const config = settings[field];
    const name = configNames[index];

    if (config && config.scores && config.scores[0] !== 100) {
      warnings.push(`${name}의 최고 점수가 ${config.scores[0]}점입니다. 100점이 아니면 최종 점수가 낮게 나올 수 있습니다.`);
    }
  });

  return warnings;
};

/**
 * 현재 설정 조회
 * @returns {Object} { success: boolean, data: Object|null }
 */
const getSettings = async () => {
  try {
    const settings = await repository.getSettings();
    return {
      success: true,
      data: settings
    };
  } catch (error) {
    console.error('설정 조회 실패:', error);
    throw error;
  }
};

/**
 * 설정 저장
 * @param {Object} settings - 설정 데이터
 * @returns {Object} { success: boolean, data: Object, warnings: string[] }
 */
const saveSettings = async (settings) => {
  try {
    // 유효성 검사
    const validation = validateSettings(settings);
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors
      };
    }

    // 경고 메시지 생성
    const warnings = getWarnings(settings);

    // 저장
    const saved = await repository.saveSettings(settings);

    return {
      success: true,
      data: saved,
      warnings
    };
  } catch (error) {
    console.error('설정 저장 실패:', error);
    throw error;
  }
};

/**
 * 설정 삭제 (초기화)
 * @returns {Object} { success: boolean }
 */
const deleteSettings = async () => {
  try {
    await repository.deleteSettings();
    return {
      success: true
    };
  } catch (error) {
    console.error('설정 삭제 실패:', error);
    throw error;
  }
};

module.exports = {
  getSettings,
  saveSettings,
  deleteSettings,
  validateSettings,
  getWarnings
};
