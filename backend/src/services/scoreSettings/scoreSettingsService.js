// ============================================================================
// 모수 평가 기준 설정 Service
// ============================================================================

const repository = require('./scoreSettingsRepository');

// 최대/최소 구간 수
const MAX_BOUNDARIES = 10;
const MIN_BOUNDARIES = 1;

// 최소/최대 선택 지표 수
const MIN_METRICS = 3;
const MAX_METRICS = 5;

// 지표 정의
const METRIC_DEFINITIONS = {
  scroll: { field: 'weight_scroll', configField: 'scroll_config', name: '스크롤' },
  pv: { field: 'weight_pv', configField: 'pv_config', name: 'PV' },
  duration: { field: 'weight_duration', configField: 'duration_config', name: '체류시간' },
  view: { field: 'weight_view', configField: 'view_config', name: 'View' },
  uv: { field: 'weight_uv', configField: 'uv_config', name: 'UV' }
};

/**
 * 설정 유효성 검사 (절대평가 전용)
 * @param {Object} settings - 설정 데이터
 * @returns {Object} { valid: boolean, errors: string[] }
 */
const validateSettings = (settings) => {
  const errors = [];
  const enabledMetrics = settings.enabled_metrics || ['scroll', 'pv', 'duration'];

  // 평가 방식 검사 (절대평가만 허용)
  if (!settings.evaluation_type || settings.evaluation_type !== 'absolute') {
    errors.push('평가 방식은 absolute여야 합니다.');
  }

  // 활성화된 지표 수 검사
  if (enabledMetrics.length < MIN_METRICS) {
    errors.push(`최소 ${MIN_METRICS}개의 지표를 선택해야 합니다.`);
  }
  if (enabledMetrics.length > MAX_METRICS) {
    errors.push(`최대 ${MAX_METRICS}개의 지표만 선택할 수 있습니다.`);
  }

  // 활성화된 지표의 가중치 합계 검사
  let weightSum = 0;
  enabledMetrics.forEach(metric => {
    const def = METRIC_DEFINITIONS[metric];
    if (def) {
      weightSum += (settings[def.field] || 0);
    }
  });
  
  if (weightSum !== 100) {
    errors.push(`선택된 지표의 가중치 합계가 ${weightSum}%입니다. 100%가 되어야 합니다.`);
  }

  // 각 가중치 범위 검사 (모든 지표)
  Object.entries(METRIC_DEFINITIONS).forEach(([metric, def]) => {
    const weight = settings[def.field];
    if (weight !== undefined && weight !== null) {
      if (weight < 0 || weight > 100) {
        errors.push(`${def.name} 가중치는 0~100 사이여야 합니다.`);
      }
    }
  });

  // 활성화된 지표의 구간 설정 검사
  enabledMetrics.forEach(metric => {
    const def = METRIC_DEFINITIONS[metric];
    if (!def) return;

    const config = settings[def.configField];
    const name = def.name;

    if (!config || !config.boundaries || !config.scores) {
      errors.push(`${name} 구간 설정이 올바르지 않습니다.`);
      return;
    }

    // 경계값 개수 검사 (동적: 최소 1개 ~ 최대 10개)
    if (config.boundaries.length < MIN_BOUNDARIES) {
      errors.push(`${name}에 최소 ${MIN_BOUNDARIES}개의 구간이 필요합니다.`);
      return;
    }
    if (config.boundaries.length > MAX_BOUNDARIES) {
      errors.push(`${name}은 최대 ${MAX_BOUNDARIES}개 구간까지만 가능합니다.`);
      return;
    }

    // 점수 개수 검사 (경계값 개수 + 1 = 점수 개수)
    const expectedScores = config.boundaries.length + 1;
    if (config.scores.length !== expectedScores) {
      errors.push(`${name} 점수 개수가 올바르지 않습니다. (경계값 ${config.boundaries.length}개면 점수 ${expectedScores}개 필요)`);
      return;
    }

    // 경계값 순서 검사 (절대평가: 내림차순)
    for (let i = 0; i < config.boundaries.length - 1; i++) {
      if (config.boundaries[i] <= config.boundaries[i + 1]) {
        errors.push(`${name} 경계값은 순서대로 작아져야 합니다. (수치 기준)`);
        break;
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
  const enabledMetrics = settings.enabled_metrics || ['scroll', 'pv', 'duration'];

  // 활성화된 지표만 경고 체크
  enabledMetrics.forEach(metric => {
    const def = METRIC_DEFINITIONS[metric];
    if (!def) return;

    const config = settings[def.configField];
    const name = def.name;

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
