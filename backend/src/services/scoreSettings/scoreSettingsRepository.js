// ============================================================================
// 모수 평가 기준 설정 Repository
// ============================================================================

const db = require('../../utils/database');

/**
 * 현재 설정 조회 (절대평가 전용)
 * @returns {Object|null} 설정 데이터 또는 null
 */
const getSettings = async () => {
  const query = `
    SELECT 
      id,
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
      created_at,
      updated_at
    FROM score_settings
    ORDER BY id DESC
    LIMIT 1
  `;
  
  const result = await db.query(query);
  return result.rows[0] || null;
};

/**
 * 설정 저장 (절대평가 전용 - 기존 설정이 있으면 업데이트, 없으면 생성)
 * @param {Object} settings - 설정 데이터
 * @returns {Object} 저장된 설정 데이터
 */
const saveSettings = async (settings) => {
  const {
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
  } = settings;

  // 기존 설정 확인
  const existing = await getSettings();

  if (existing) {
    // 업데이트
    const query = `
      UPDATE score_settings
      SET 
        evaluation_type = $1,
        weight_scroll = $2,
        weight_pv = $3,
        weight_duration = $4,
        weight_view = $5,
        weight_uv = $6,
        scroll_config = $7,
        pv_config = $8,
        duration_config = $9,
        view_config = $10,
        uv_config = $11,
        enabled_metrics = $12,
        updated_at = NOW()
      WHERE id = $13
      RETURNING *
    `;
    
    const result = await db.query(query, [
      evaluation_type,
      weight_scroll,
      weight_pv,
      weight_duration,
      weight_view || 0,
      weight_uv || 0,
      JSON.stringify(scroll_config),
      JSON.stringify(pv_config),
      JSON.stringify(duration_config),
      JSON.stringify(view_config),
      JSON.stringify(uv_config),
      enabled_metrics,
      existing.id
    ]);
    
    return result.rows[0];
  } else {
    // 새로 생성
    const query = `
      INSERT INTO score_settings (
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
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;
    
    const result = await db.query(query, [
      evaluation_type,
      weight_scroll,
      weight_pv,
      weight_duration,
      weight_view || 0,
      weight_uv || 0,
      JSON.stringify(scroll_config),
      JSON.stringify(pv_config),
      JSON.stringify(duration_config),
      JSON.stringify(view_config),
      JSON.stringify(uv_config),
      enabled_metrics
    ]);
    
    return result.rows[0];
  }
};

/**
 * 설정 삭제 (초기화)
 * @returns {boolean} 삭제 성공 여부
 */
const deleteSettings = async () => {
  const query = `DELETE FROM score_settings`;
  await db.query(query);
  return true;
};

module.exports = {
  getSettings,
  saveSettings,
  deleteSettings
};
