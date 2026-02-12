const express = require('express');
const router = express.Router();
const creativeService = require('../services/creative/creativeService');
const detailService = require('../services/creative/detailService');
const scoreSettingsService = require('../services/scoreSettings/scoreSettingsService');
const scorePresetsService = require('../services/scoreSettings/scorePresetsService');
const db = require('../utils/database');

/**
 * GET /api/creative-performance
 * 광고 소재 분석 API
 * 
 * Query Parameters:
 *  - start: 시작일 (YYYY-MM-DD) - 필수
 *  - end: 종료일 (YYYY-MM-DD) - 필수
 *  - page: 페이지 번호 (default: 1)
 *  - limit: 페이지 크기 (default: 50)
 *  - search: 검색어 (광고 소재 이름)
 *  - sort_by: 정렬 기준 (default: total_revenue)
 *  - sort_order: 정렬 순서 (asc, desc) (default: desc)
 *  - utm_filters: 동적 UTM 필터 (JSON string)
 */
router.get('/creative-performance', async (req, res) => {
  try {
    const result = await creativeService.getCreativePerformance(req.query);
    res.json(result);
  } catch (error) {
    console.error('Creative performance API error:', error);
    
    // 비즈니스 로직 에러 (400)와 서버 에러 (500) 구분
    if (error.message.includes('required')) {
      return res.status(400).json({ 
        success: false,
        error: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch creative performance data',
      message: error.message 
    });
  }
});

/**
 * POST /api/creative-performance/orders
 * 특정 광고 소재에 기여한 주문 목록 조회 API
 * (테이블의 contributed_orders_count와 동일한 로직 사용)
 * 
 * Request Body:
 *  - creative_name: 광고 소재 이름 (utm_content) - 필수
 *  - utm_source: UTM Source - 필수
 *  - utm_medium: UTM Medium - 필수
 *  - utm_campaign: UTM Campaign - 필수
 *  - start: 시작일 (YYYY-MM-DD) - 필수
 *  - end: 종료일 (YYYY-MM-DD) - 필수
 */
router.post('/creative-performance/orders', async (req, res) => {
  try {
    const result = await detailService.getCreativeOrders(req.body);
    res.json(result);
  } catch (error) {
    console.error('Creative orders API error:', error);
    
    if (error.message.includes('required')) {
      return res.status(400).json({ 
        success: false,
        error: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch creative orders',
      message: error.message 
    });
  }
});

/**
 * POST /api/creative-performance/sessions
 * 특정 광고 소재를 통해 유입된 세션 상세 목록 조회
 * 
 * Request Body:
 *  - creative_name: 광고 소재 이름 (utm_content) - 필수
 *  - utm_source: UTM Source - 필수
 *  - utm_medium: UTM Medium - 필수
 *  - utm_campaign: UTM Campaign - 필수
 *  - start: 시작일 (YYYY-MM-DD) - 필수
 *  - end: 종료일 (YYYY-MM-DD) - 필수
 *  - page: 페이지 번호 (default: 1)
 *  - limit: 페이지 크기 (default: 50)
 * 
 * Response:
 *  - data: 세션 목록 (session_id, start_time, end_time, duration, pageviews, device, browser, os, ip, entry_url, exit_url, is_converted)
 *  - pagination: 페이지 정보
 */
router.post('/creative-performance/sessions', async (req, res) => {
  try {
    const result = await detailService.getCreativeSessions(req.body);
    res.json(result);
  } catch (error) {
    console.error('Creative sessions API error:', error);
    
    if (error.message.includes('required')) {
      return res.status(400).json({ 
        success: false,
        error: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch creative sessions',
      message: error.message 
    });
  }
});

/**
 * POST /api/creative-performance/sessions/chart
 * 특정 광고 소재의 세션 차트용 집계 데이터 조회
 * 
 * Request Body:
 *  - ad_id: 광고 ID (utm_id) - 선택 (있으면 ad_id 기반 조회)
 *  - creative_name: 광고 소재 이름 (utm_content) - 필수
 *  - utm_source: UTM Source - 필수
 *  - utm_medium: UTM Medium - 필수
 *  - utm_campaign: UTM Campaign - 필수
 *  - start: 시작일 (YYYY-MM-DD) - 필수
 *  - end: 종료일 (YYYY-MM-DD) - 필수
 * 
 * Response:
 *  - totalSessions: 전체 세션 수
 *  - duration_distribution: 체류시간 분포
 *  - device_distribution: 기기 분포
 *  - conversion_distribution: 전환(구매/이탈) 분포
 *  - pv_distribution: 페이지뷰 수 분포
 *  - hourly_distribution: 시간대별 분포
 */
router.post('/creative-performance/sessions/chart', async (req, res) => {
  try {
    const result = await detailService.getCreativeSessionsChart(req.body);
    res.json(result);
  } catch (error) {
    console.error('Creative sessions chart API error:', error);
    
    if (error.message.includes('required')) {
      return res.status(400).json({ 
        success: false,
        error: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch creative sessions chart data',
      message: error.message 
    });
  }
});

/**
 * POST /api/creative-performance/entries
 * 특정 광고 소재의 진입 목록 조회 (View 상세)
 * 
 * Request Body:
 *  - creative_name: 광고 소재 이름 (utm_content) - 필수
 *  - utm_source: UTM Source - 필수
 *  - utm_medium: UTM Medium - 필수
 *  - utm_campaign: UTM Campaign - 필수
 *  - start: 시작일 (YYYY-MM-DD) - 필수
 *  - end: 종료일 (YYYY-MM-DD) - 필수
 *  - page: 페이지 번호 (default: 1)
 *  - limit: 페이지 크기 (default: 50)
 * 
 * Response:
 *  - data: 진입 목록 (entry_timestamp, visitor_id, session_id, gap_seconds)
 *  - pagination: 페이지 정보
 */
router.post('/creative-performance/entries', async (req, res) => {
  try {
    const result = await detailService.getCreativeEntries(req.body);
    res.json(result);
  } catch (error) {
    console.error('Creative entries API error:', error);
    
    if (error.message.includes('required')) {
      return res.status(400).json({ 
        success: false,
        error: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch creative entries',
      message: error.message 
    });
  }
});

/**
 * POST /api/creative-performance/original-url
 * 특정 광고 소재의 원본 URL (대표 랜딩 URL) 조회
 * 
 * Request Body:
 *  - creative_name: 광고 소재 이름 (utm_content) - 필수
 *  - utm_source: UTM Source - 필수
 *  - utm_medium: UTM Medium - 필수
 *  - utm_campaign: UTM Campaign - 필수
 *  - start: 시작일 (YYYY-MM-DD) - 필수
 *  - end: 종료일 (YYYY-MM-DD) - 필수
 * 
 * Response:
 *  - data: { original_url, full_url, total_count }
 */
router.post('/creative-performance/original-url', async (req, res) => {
  try {
    const result = await detailService.getCreativeOriginalUrl(req.body);
    res.json(result);
  } catch (error) {
    console.error('Creative original URL API error:', error);
    
    if (error.message.includes('required')) {
      return res.status(400).json({ 
        success: false,
        error: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch creative original URL',
      message: error.message 
    });
  }
});

/**
 * GET /api/creative-performance/distribution
 * 광고 세션의 PV/체류시간/스크롤 분포 데이터 조회
 * 모수 평가 기준 설정 시 데이터 분포를 시각화하기 위한 API
 * 
 * Query Parameters:
 *  - start: 시작일 (YYYY-MM-DD) - 필수
 *  - end: 종료일 (YYYY-MM-DD) - 필수
 *  - utm_filters: UTM 필터 (JSON string) - 선택
 */
router.get('/creative-performance/distribution', async (req, res) => {
  try {
    const { start, end, utm_filters = '[]' } = req.query;

    if (!start || !end) {
      return res.status(400).json({
        success: false,
        error: 'start and end dates are required (YYYY-MM-DD format)'
      });
    }

    const startDate = new Date(start);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    // UTM 필터 파싱
    const { parseUtmFilters } = require('../services/creative/utils');
    const queryParams = [startDate, endDate];
    const { conditions: utmFilterConditions } = parseUtmFilters(
      utm_filters, queryParams, 3
    );

    // PV 히스토그램 + 백분위수 쿼리
    // FIX (2026-02-12): utm_id 없는 플랫폼(카카오/자사몰 등) 지원
    // - 기존: utm_id 필수 → 카카오 등 utm_id 없는 데이터 전부 제외됨
    // - 변경: utm_content 기반 필터링 (creativeRepository.js와 동일 기준)
    const pvQuery = `
      WITH filtered_sessions AS (
        SELECT DISTINCT ON (us.session_id)
          us.session_id,
          s.pageview_count,
          s.duration_seconds
        FROM utm_sessions us
        JOIN visitors v ON us.visitor_id = v.visitor_id
        JOIN sessions s ON us.session_id = s.session_id
        WHERE us.entry_timestamp >= $1
          AND us.entry_timestamp <= $2
          AND s.start_time >= $1
          AND s.start_time <= $2
          AND v.is_bot = false
          AND s.duration_seconds > 0
          AND us.utm_params->>'utm_content' IS NOT NULL
          AND us.utm_params->>'utm_content' NOT LIKE '{{%'
          ${utmFilterConditions}
        ORDER BY us.session_id
      ),
      histogram AS (
        SELECT 
          CASE 
            WHEN pageview_count = 1 THEN '1'
            WHEN pageview_count = 2 THEN '2'
            WHEN pageview_count = 3 THEN '3'
            WHEN pageview_count BETWEEN 4 AND 5 THEN '4-5'
            WHEN pageview_count BETWEEN 6 AND 10 THEN '6-10'
            WHEN pageview_count BETWEEN 11 AND 15 THEN '11-15'
            WHEN pageview_count BETWEEN 16 AND 20 THEN '16-20'
            WHEN pageview_count BETWEEN 21 AND 30 THEN '21-30'
            WHEN pageview_count BETWEEN 31 AND 50 THEN '31-50'
            ELSE '51+'
          END as range,
          MIN(pageview_count) as range_min,
          COUNT(*) as count
        FROM filtered_sessions
        GROUP BY 1
      ),
      percentiles AS (
        SELECT
          PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY pageview_count) as p25,
          PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY pageview_count) as p50,
          PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY pageview_count) as p75,
          PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY pageview_count) as p90,
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY pageview_count) as p95,
          COUNT(*) as total
        FROM filtered_sessions
      )
      SELECT 
        json_build_object(
          'histogram', (SELECT json_agg(json_build_object('range', range, 'count', count, 'range_min', range_min) ORDER BY range_min) FROM histogram),
          'percentiles', (SELECT row_to_json(p) FROM percentiles p),
          'total', (SELECT total FROM percentiles)
        ) as result
    `;

    // Duration 히스토그램 + 백분위수 쿼리
    const durationQuery = `
      WITH filtered_sessions AS (
        SELECT DISTINCT ON (us.session_id)
          us.session_id,
          s.duration_seconds
        FROM utm_sessions us
        JOIN visitors v ON us.visitor_id = v.visitor_id
        JOIN sessions s ON us.session_id = s.session_id
        WHERE us.entry_timestamp >= $1
          AND us.entry_timestamp <= $2
          AND s.start_time >= $1
          AND s.start_time <= $2
          AND v.is_bot = false
          AND s.duration_seconds > 0
          AND us.utm_params->>'utm_content' IS NOT NULL
          AND us.utm_params->>'utm_content' NOT LIKE '{{%'
          ${utmFilterConditions}
        ORDER BY us.session_id
      ),
      histogram AS (
        SELECT 
          CASE 
            WHEN duration_seconds BETWEEN 1 AND 5 THEN '1-5초'
            WHEN duration_seconds BETWEEN 6 AND 10 THEN '6-10초'
            WHEN duration_seconds BETWEEN 11 AND 30 THEN '11-30초'
            WHEN duration_seconds BETWEEN 31 AND 60 THEN '31-60초'
            WHEN duration_seconds BETWEEN 61 AND 120 THEN '1-2분'
            WHEN duration_seconds BETWEEN 121 AND 300 THEN '2-5분'
            WHEN duration_seconds BETWEEN 301 AND 600 THEN '5-10분'
            WHEN duration_seconds BETWEEN 601 AND 1800 THEN '10-30분'
            WHEN duration_seconds BETWEEN 1801 AND 3600 THEN '30-60분'
            ELSE '60분+'
          END as range,
          MIN(duration_seconds) as range_min,
          COUNT(*) as count
        FROM filtered_sessions
        GROUP BY 1
      ),
      percentiles AS (
        SELECT
          PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY duration_seconds) as p25,
          PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY duration_seconds) as p50,
          PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY duration_seconds) as p75,
          PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY duration_seconds) as p90,
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_seconds) as p95,
          COUNT(*) as total
        FROM filtered_sessions
      )
      SELECT 
        json_build_object(
          'histogram', (SELECT json_agg(json_build_object('range', range, 'count', count, 'range_min', range_min) ORDER BY range_min) FROM histogram),
          'percentiles', (SELECT row_to_json(p) FROM percentiles p),
          'total', (SELECT total FROM percentiles)
        ) as result
    `;

    // Scroll 히스토그램 + 백분위수 쿼리
    const scrollQuery = `
      WITH filtered_sessions AS (
        SELECT DISTINCT ON (us.session_id)
          us.session_id
        FROM utm_sessions us
        JOIN visitors v ON us.visitor_id = v.visitor_id
        JOIN sessions s ON us.session_id = s.session_id
        WHERE us.entry_timestamp >= $1
          AND us.entry_timestamp <= $2
          AND s.start_time >= $1
          AND s.start_time <= $2
          AND v.is_bot = false
          AND s.duration_seconds > 0
          AND us.utm_params->>'utm_content' IS NOT NULL
          AND us.utm_params->>'utm_content' NOT LIKE '{{%'
          ${utmFilterConditions}
        ORDER BY us.session_id
      ),
      scroll_data AS (
        SELECT 
          fs.session_id,
          ROUND(SUM((e.metadata->>'max_scroll_px')::NUMERIC)) as scroll_px
        FROM filtered_sessions fs
        JOIN events e ON fs.session_id = e.session_id
        WHERE e.event_type = 'scroll_depth'
          AND (e.metadata->>'max_scroll_px') IS NOT NULL
          AND e.timestamp >= $1
          AND e.timestamp <= $2
        GROUP BY fs.session_id
        HAVING SUM((e.metadata->>'max_scroll_px')::NUMERIC) > 0
      ),
      histogram AS (
        SELECT 
          CASE 
            WHEN scroll_px BETWEEN 0 AND 500 THEN '0-500'
            WHEN scroll_px BETWEEN 501 AND 1000 THEN '501-1,000'
            WHEN scroll_px BETWEEN 1001 AND 2000 THEN '1,001-2,000'
            WHEN scroll_px BETWEEN 2001 AND 5000 THEN '2,001-5,000'
            WHEN scroll_px BETWEEN 5001 AND 10000 THEN '5,001-10,000'
            WHEN scroll_px BETWEEN 10001 AND 15000 THEN '10,001-15,000'
            WHEN scroll_px BETWEEN 15001 AND 20000 THEN '15,001-20,000'
            WHEN scroll_px BETWEEN 20001 AND 25000 THEN '20,001-25,000'
            WHEN scroll_px BETWEEN 25001 AND 30000 THEN '25,001-30,000'
            WHEN scroll_px BETWEEN 30001 AND 40000 THEN '30,001-40,000'
            WHEN scroll_px BETWEEN 40001 AND 50000 THEN '40,001-50,000'
            WHEN scroll_px BETWEEN 50001 AND 60000 THEN '50,001-60,000'
            ELSE '60,000+'
          END as range,
          MIN(scroll_px) as range_min,
          COUNT(*) as count
        FROM scroll_data
        GROUP BY 1
      ),
      percentiles AS (
        SELECT
          PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY scroll_px) as p25,
          PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY scroll_px) as p50,
          PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY scroll_px) as p75,
          PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY scroll_px) as p90,
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY scroll_px) as p95,
          COUNT(*) as total
        FROM scroll_data
      )
      SELECT 
        json_build_object(
          'histogram', (SELECT json_agg(json_build_object('range', range, 'count', count, 'range_min', range_min) ORDER BY range_min) FROM histogram),
          'percentiles', (SELECT row_to_json(p) FROM percentiles p),
          'total', (SELECT total FROM percentiles)
        ) as result
    `;

    // 3개 쿼리 병렬 실행
    const [pvResult, durationResult, scrollResult] = await Promise.all([
      db.query(pvQuery, queryParams),
      db.query(durationQuery, queryParams),
      db.query(scrollQuery, queryParams)
    ]);

    res.json({
      success: true,
      data: {
        pv: pvResult.rows[0]?.result || { histogram: [], percentiles: {}, total: 0 },
        duration: durationResult.rows[0]?.result || { histogram: [], percentiles: {}, total: 0 },
        scroll: scrollResult.rows[0]?.result || { histogram: [], percentiles: {}, total: 0 }
      }
    });
  } catch (error) {
    console.error('Distribution API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch distribution data',
      message: error.message
    });
  }
});

// ============================================================================
// 모수 평가 기준 설정 API
// ============================================================================

/**
 * GET /api/creative-performance/score-settings
 * 현재 점수 평가 기준 설정 조회
 * 
 * Response:
 *  - success: boolean
 *  - data: 설정 데이터 또는 null (미설정 시)
 */
router.get('/creative-performance/score-settings', async (req, res) => {
  try {
    const result = await scoreSettingsService.getSettings();
    res.json(result);
  } catch (error) {
    console.error('Score settings GET API error:', error);
    res.status(500).json({
      success: false,
      error: '설정을 불러오는 중 오류가 발생했습니다.',
      message: error.message
    });
  }
});

/**
 * POST /api/creative-performance/score-settings
 * 점수 평가 기준 설정 저장
 * 
 * Request Body:
 *  - evaluation_type: 'relative' | 'absolute'
 *  - weight_scroll: number (0-100)
 *  - weight_pv: number (0-100)
 *  - weight_duration: number (0-100)
 *  - scroll_config: { boundaries: number[], scores: number[] }
 *  - pv_config: { boundaries: number[], scores: number[] }
 *  - duration_config: { boundaries: number[], scores: number[] }
 * 
 * Response:
 *  - success: boolean
 *  - data: 저장된 설정 데이터
 *  - warnings: 경고 메시지 배열 (저장은 됨)
 *  - errors: 오류 메시지 배열 (저장 실패 시)
 */
router.post('/creative-performance/score-settings', async (req, res) => {
  try {
    const result = await scoreSettingsService.saveSettings(req.body);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Score settings POST API error:', error);
    res.status(500).json({
      success: false,
      error: '설정을 저장하는 중 오류가 발생했습니다.',
      message: error.message
    });
  }
});

/**
 * DELETE /api/creative-performance/score-settings
 * 점수 평가 기준 설정 삭제 (초기화)
 * 
 * Response:
 *  - success: boolean
 */
router.delete('/creative-performance/score-settings', async (req, res) => {
  try {
    const result = await scoreSettingsService.deleteSettings();
    res.json(result);
  } catch (error) {
    console.error('Score settings DELETE API error:', error);
    res.status(500).json({
      success: false,
      error: '설정을 삭제하는 중 오류가 발생했습니다.',
      message: error.message
    });
  }
});

// ============================================================================
// 모수 평가 프리셋 API
// ============================================================================

/**
 * GET /api/creative-performance/score-presets
 * 모든 프리셋 목록 조회
 * 
 * Response:
 *  - success: boolean
 *  - data: 프리셋 배열
 */
router.get('/creative-performance/score-presets', async (req, res) => {
  try {
    const result = await scorePresetsService.getAllPresets();
    res.json(result);
  } catch (error) {
    console.error('Score presets GET API error:', error);
    res.status(500).json({
      success: false,
      error: '프리셋 목록을 불러오는 중 오류가 발생했습니다.',
      message: error.message
    });
  }
});

/**
 * GET /api/creative-performance/score-presets/active
 * 현재 적용 중인 프리셋 조회
 * 
 * Response:
 *  - success: boolean
 *  - data: 적용 중인 프리셋 또는 null
 */
router.get('/creative-performance/score-presets/active', async (req, res) => {
  try {
    const result = await scorePresetsService.getActivePreset();
    res.json(result);
  } catch (error) {
    console.error('Active preset GET API error:', error);
    res.status(500).json({
      success: false,
      error: '적용 중인 프리셋을 불러오는 중 오류가 발생했습니다.',
      message: error.message
    });
  }
});

/**
 * GET /api/creative-performance/score-presets/:id
 * 특정 프리셋 조회
 * 
 * Response:
 *  - success: boolean
 *  - data: 프리셋 데이터 또는 null
 */
router.get('/creative-performance/score-presets/:id', async (req, res) => {
  try {
    const result = await scorePresetsService.getPresetById(parseInt(req.params.id));
    res.json(result);
  } catch (error) {
    console.error('Score preset GET API error:', error);
    res.status(500).json({
      success: false,
      error: '프리셋을 불러오는 중 오류가 발생했습니다.',
      message: error.message
    });
  }
});

/**
 * POST /api/creative-performance/score-presets
 * 새 프리셋 생성
 * 
 * Request Body:
 *  - name: 프리셋 이름 - 필수
 *  - 나머지 설정값들
 * 
 * Response:
 *  - success: boolean
 *  - data: 생성된 프리셋
 *  - warnings: 경고 메시지 배열
 *  - errors: 오류 메시지 배열 (실패 시)
 */
router.post('/creative-performance/score-presets', async (req, res) => {
  try {
    const result = await scorePresetsService.createPreset(req.body);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Score preset POST API error:', error);
    res.status(500).json({
      success: false,
      error: '프리셋을 생성하는 중 오류가 발생했습니다.',
      message: error.message
    });
  }
});

/**
 * POST /api/creative-performance/score-presets/save-and-apply
 * 새 프리셋 생성 및 적용 (저장 및 적용 버튼용)
 * 
 * Request Body:
 *  - name: 프리셋 이름 - 필수
 *  - 나머지 설정값들
 * 
 * Response:
 *  - success: boolean
 *  - data: 생성 및 적용된 프리셋
 *  - warnings: 경고 메시지 배열
 *  - errors: 오류 메시지 배열 (실패 시)
 */
router.post('/creative-performance/score-presets/save-and-apply', async (req, res) => {
  try {
    const result = await scorePresetsService.createAndActivatePreset(req.body);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Score preset save-and-apply API error:', error);
    res.status(500).json({
      success: false,
      error: '프리셋을 저장 및 적용하는 중 오류가 발생했습니다.',
      message: error.message
    });
  }
});

/**
 * PUT /api/creative-performance/score-presets/:id
 * 프리셋 업데이트
 * 
 * Request Body:
 *  - 업데이트할 설정값들
 * 
 * Response:
 *  - success: boolean
 *  - data: 업데이트된 프리셋
 *  - warnings: 경고 메시지 배열
 *  - errors: 오류 메시지 배열 (실패 시)
 */
router.put('/creative-performance/score-presets/:id', async (req, res) => {
  try {
    const result = await scorePresetsService.updatePreset(parseInt(req.params.id), req.body);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Score preset PUT API error:', error);
    res.status(500).json({
      success: false,
      error: '프리셋을 업데이트하는 중 오류가 발생했습니다.',
      message: error.message
    });
  }
});

/**
 * PUT /api/creative-performance/score-presets/:id/name
 * 프리셋 이름만 업데이트
 * 
 * Request Body:
 *  - name: 새 이름
 * 
 * Response:
 *  - success: boolean
 *  - data: 업데이트된 프리셋
 */
router.put('/creative-performance/score-presets/:id/name', async (req, res) => {
  try {
    const result = await scorePresetsService.updatePresetName(parseInt(req.params.id), req.body.name);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Score preset name PUT API error:', error);
    res.status(500).json({
      success: false,
      error: '프리셋 이름을 변경하는 중 오류가 발생했습니다.',
      message: error.message
    });
  }
});

/**
 * PUT /api/creative-performance/score-presets/:id/save-and-apply
 * 기존 프리셋 저장 및 적용 (저장 및 적용 버튼용)
 * 
 * Request Body:
 *  - 업데이트할 설정값들
 * 
 * Response:
 *  - success: boolean
 *  - data: 저장 및 적용된 프리셋
 *  - warnings: 경고 메시지 배열
 *  - errors: 오류 메시지 배열 (실패 시)
 */
router.put('/creative-performance/score-presets/:id/save-and-apply', async (req, res) => {
  try {
    const result = await scorePresetsService.saveAndActivatePreset(parseInt(req.params.id), req.body);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Score preset save-and-apply API error:', error);
    res.status(500).json({
      success: false,
      error: '프리셋을 저장 및 적용하는 중 오류가 발생했습니다.',
      message: error.message
    });
  }
});

/**
 * DELETE /api/creative-performance/score-presets/:id
 * 프리셋 삭제
 * 
 * Response:
 *  - success: boolean
 */
router.delete('/creative-performance/score-presets/:id', async (req, res) => {
  try {
    const result = await scorePresetsService.deletePreset(parseInt(req.params.id));
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Score preset DELETE API error:', error);
    res.status(500).json({
      success: false,
      error: '프리셋을 삭제하는 중 오류가 발생했습니다.',
      message: error.message
    });
  }
});

/**
 * DELETE /api/creative-performance/score-presets/active/reset
 * 적용 중인 프리셋 초기화 (모든 프리셋 비활성화)
 * 
 * Response:
 *  - success: boolean
 */
router.delete('/creative-performance/score-presets/active/reset', async (req, res) => {
  try {
    const result = await scorePresetsService.resetActivePreset();
    res.json(result);
  } catch (error) {
    console.error('Reset active preset API error:', error);
    res.status(500).json({
      success: false,
      error: '프리셋을 초기화하는 중 오류가 발생했습니다.',
      message: error.message
    });
  }
});

module.exports = router;

