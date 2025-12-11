const express = require('express');
const router = express.Router();
const tablesService = require('../services/tables/tablesService');

// ============================================================================
// 1. Visitors 테이블 조회
// ============================================================================
router.get('/visitors', async (req, res) => {
  try {
    const result = await tablesService.getVisitorsList(req.query);
    res.json(result);
  } catch (error) {
    console.error('Visitors 조회 오류:', error);
    res.status(500).json({ error: 'Failed to fetch visitors data' });
  }
});

// ============================================================================
// 2. Sessions 테이블 조회
// ============================================================================
router.get('/sessions', async (req, res) => {
  try {
    const result = await tablesService.getSessionsList(req.query);
    res.json(result);
  } catch (error) {
    console.error('Sessions 조회 오류:', error);
    res.status(500).json({ error: 'Failed to fetch sessions data' });
  }
});

// ============================================================================
// 3. Events 테이블 조회
// ============================================================================
router.get('/events', async (req, res) => {
  try {
    const result = await tablesService.getEventsList(req.query);
    res.json(result);
  } catch (error) {
    console.error('Events 조회 오류:', error);
    res.status(500).json({ error: 'Failed to fetch events data' });
  }
});

// ============================================================================
// 4. Pageviews 테이블 조회 (체류 시간 자동 계산)
// ============================================================================
router.get('/pageviews', async (req, res) => {
  try {
    const result = await tablesService.getPageviewsList(req.query);
    res.json(result);
  } catch (error) {
    console.error('Pageviews 조회 오류:', error);
    res.status(500).json({ error: 'Failed to fetch pageviews data' });
  }
});

// ============================================================================
// 5. Conversions 테이블 조회
// ============================================================================
router.get('/conversions', async (req, res) => {
  try {
    const result = await tablesService.getConversionsList(req.query);
    res.json(result);
  } catch (error) {
    console.error('Conversions 조회 오류:', error);
    res.status(500).json({ error: 'Failed to fetch conversions data' });
  }
});

// ============================================================================
// 6. UTM Sessions 테이블 조회
// ============================================================================
router.get('/utm-sessions', async (req, res) => {
  try {
    const result = await tablesService.getUtmSessionsList(req.query);
    res.json(result);
  } catch (error) {
    console.error('UTM Sessions 조회 오류:', error);
    res.status(500).json({ error: 'Failed to fetch utm_sessions data' });
  }
});

// ============================================================================
// 7. Realtime Visitors 테이블 조회
// ============================================================================
router.get('/realtime-visitors', async (req, res) => {
  try {
    const result = await tablesService.getRealtimeVisitorsList(req.query);
    res.json(result);
  } catch (error) {
    console.error('Realtime Visitors 조회 오류:', error);
    res.status(500).json({ error: 'Failed to fetch realtime_visitors data' });
  }
});

module.exports = router;

