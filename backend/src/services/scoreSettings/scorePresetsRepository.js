// ============================================================================
// 모수 평가 프리셋 Repository
// ============================================================================

const db = require('../../utils/database');

/**
 * 모든 프리셋 조회
 * @returns {Array} 프리셋 목록
 */
const getAllPresets = async () => {
  const query = `
    SELECT 
      id,
      name,
      evaluation_type,
      weight_scroll,
      weight_pv,
      weight_duration,
      weight_view,
      weight_uv,
      scroll_config,
      pv_config,
      duration_config,
      view_config,
      uv_config,
      enabled_metrics,
      is_active,
      created_at,
      updated_at
    FROM score_presets
    ORDER BY is_active DESC, updated_at DESC
  `;
  
  const result = await db.query(query);
  return result.rows;
};

/**
 * 특정 프리셋 조회
 * @param {number} id - 프리셋 ID
 * @returns {Object|null} 프리셋 데이터
 */
const getPresetById = async (id) => {
  const query = `
    SELECT 
      id,
      name,
      evaluation_type,
      weight_scroll,
      weight_pv,
      weight_duration,
      weight_view,
      weight_uv,
      scroll_config,
      pv_config,
      duration_config,
      view_config,
      uv_config,
      enabled_metrics,
      is_active,
      created_at,
      updated_at
    FROM score_presets
    WHERE id = $1
  `;
  
  const result = await db.query(query, [id]);
  return result.rows[0] || null;
};

/**
 * 현재 적용 중인 프리셋 조회
 * @returns {Object|null} 적용 중인 프리셋 데이터
 */
const getActivePreset = async () => {
  const query = `
    SELECT 
      id,
      name,
      evaluation_type,
      weight_scroll,
      weight_pv,
      weight_duration,
      weight_view,
      weight_uv,
      scroll_config,
      pv_config,
      duration_config,
      view_config,
      uv_config,
      enabled_metrics,
      is_active,
      created_at,
      updated_at
    FROM score_presets
    WHERE is_active = TRUE
    LIMIT 1
  `;
  
  const result = await db.query(query);
  return result.rows[0] || null;
};

/**
 * 프리셋 생성
 * @param {Object} preset - 프리셋 데이터
 * @returns {Object} 생성된 프리셋 데이터
 */
const createPreset = async (preset) => {
  const {
    name,
    evaluation_type = 'absolute',
    weight_scroll = 30,
    weight_pv = 35,
    weight_duration = 35,
    weight_view = 0,
    weight_uv = 0,
    scroll_config,
    pv_config,
    duration_config,
    view_config,
    uv_config,
    enabled_metrics = ['scroll', 'pv', 'duration']
  } = preset;

  const query = `
    INSERT INTO score_presets (
      name,
      evaluation_type,
      weight_scroll,
      weight_pv,
      weight_duration,
      weight_view,
      weight_uv,
      scroll_config,
      pv_config,
      duration_config,
      view_config,
      uv_config,
      enabled_metrics,
      is_active
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, FALSE)
    RETURNING *
  `;
  
  const result = await db.query(query, [
    name,
    evaluation_type,
    weight_scroll,
    weight_pv,
    weight_duration,
    weight_view,
    weight_uv,
    JSON.stringify(scroll_config),
    JSON.stringify(pv_config),
    JSON.stringify(duration_config),
    JSON.stringify(view_config),
    JSON.stringify(uv_config),
    enabled_metrics
  ]);
  
  return result.rows[0];
};

/**
 * 프리셋 업데이트
 * @param {number} id - 프리셋 ID
 * @param {Object} preset - 업데이트할 데이터
 * @returns {Object} 업데이트된 프리셋 데이터
 */
const updatePreset = async (id, preset) => {
  const {
    name,
    evaluation_type,
    weight_scroll,
    weight_pv,
    weight_duration,
    weight_view,
    weight_uv,
    scroll_config,
    pv_config,
    duration_config,
    view_config,
    uv_config,
    enabled_metrics
  } = preset;

  const query = `
    UPDATE score_presets
    SET 
      name = COALESCE($1, name),
      evaluation_type = COALESCE($2, evaluation_type),
      weight_scroll = COALESCE($3, weight_scroll),
      weight_pv = COALESCE($4, weight_pv),
      weight_duration = COALESCE($5, weight_duration),
      weight_view = COALESCE($6, weight_view),
      weight_uv = COALESCE($7, weight_uv),
      scroll_config = COALESCE($8, scroll_config),
      pv_config = COALESCE($9, pv_config),
      duration_config = COALESCE($10, duration_config),
      view_config = COALESCE($11, view_config),
      uv_config = COALESCE($12, uv_config),
      enabled_metrics = COALESCE($13, enabled_metrics),
      updated_at = NOW()
    WHERE id = $14
    RETURNING *
  `;
  
  const result = await db.query(query, [
    name,
    evaluation_type,
    weight_scroll,
    weight_pv,
    weight_duration,
    weight_view,
    weight_uv,
    scroll_config ? JSON.stringify(scroll_config) : null,
    pv_config ? JSON.stringify(pv_config) : null,
    duration_config ? JSON.stringify(duration_config) : null,
    view_config ? JSON.stringify(view_config) : null,
    uv_config ? JSON.stringify(uv_config) : null,
    enabled_metrics,
    id
  ]);
  
  return result.rows[0];
};

/**
 * 프리셋 이름만 업데이트
 * @param {number} id - 프리셋 ID
 * @param {string} name - 새 이름
 * @returns {Object} 업데이트된 프리셋 데이터
 */
const updatePresetName = async (id, name) => {
  const query = `
    UPDATE score_presets
    SET name = $1, updated_at = NOW()
    WHERE id = $2
    RETURNING *
  `;
  
  const result = await db.query(query, [name, id]);
  return result.rows[0];
};

/**
 * 프리셋 삭제
 * @param {number} id - 프리셋 ID
 * @returns {boolean} 삭제 성공 여부
 */
const deletePreset = async (id) => {
  const query = `DELETE FROM score_presets WHERE id = $1`;
  await db.query(query, [id]);
  return true;
};

/**
 * 프리셋 활성화 (다른 프리셋은 비활성화)
 * @param {number} id - 활성화할 프리셋 ID
 * @returns {Object} 활성화된 프리셋 데이터
 */
const activatePreset = async (id) => {
  // 모든 프리셋 비활성화
  await db.query(`UPDATE score_presets SET is_active = FALSE`);
  
  // 해당 프리셋 활성화
  const query = `
    UPDATE score_presets
    SET is_active = TRUE, updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `;
  
  const result = await db.query(query, [id]);
  return result.rows[0];
};

/**
 * 모든 프리셋 비활성화 (초기화)
 * @returns {boolean} 성공 여부
 */
const deactivateAllPresets = async () => {
  await db.query(`UPDATE score_presets SET is_active = FALSE`);
  return true;
};

module.exports = {
  getAllPresets,
  getPresetById,
  getActivePreset,
  createPreset,
  updatePreset,
  updatePresetName,
  deletePreset,
  activatePreset,
  deactivateAllPresets
};
