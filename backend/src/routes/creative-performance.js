const express = require('express');
const router = express.Router();
const db = require('../utils/database');
const { calculateCreativeAttribution } = require('../utils/creativeAttribution');
const creativeService = require('../services/creative/creativeService');
const detailService = require('../services/creative/detailService');

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
 * POST /api/creative-performance/analysis
 * 특정 광고 소재의 상세 성과 분석 API
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
 *  - daily_trend: 일별 UV, 전환수, 매출 추이
 *  - device_stats: 디바이스별 성과
 *  - product_sales: 상품별 매출 TOP 10
 *  - visitor_type: 신규 vs 재방문 비율
 */
router.post('/creative-performance/analysis', async (req, res) => {
  try {
    const result = await detailService.getCreativeAnalysis(req.body);
    res.json(result);
  } catch (error) {
    console.error('Creative analysis API error:', error);
    
    if (error.message.includes('required')) {
      return res.status(400).json({ 
        success: false,
        error: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch creative analysis data',
      message: error.message 
    });
  }
});

/**
 * POST /api/creative-performance/journey
 * 특정 광고 소재의 고객 여정 분석 API
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
 *  - summary: 총 구매자 수, 평균 접촉 횟수, 평균 구매 소요 시간
 *  - role_distribution: 광고 역할 비율 (첫 접점/중간/막타)
 *  - co_viewed_creatives: 함께 본 광고 TOP 10
 *  - journey_patterns: 주요 여정 패턴 TOP 5
 */
router.post('/creative-performance/journey', async (req, res) => {
  try {
    const result = await detailService.getCreativeJourney(req.body);
    res.json(result);
  } catch (error) {
    console.error('Creative journey API error:', error);
    
    if (error.message.includes('required')) {
      return res.status(400).json({ 
        success: false,
        error: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch creative journey data',
      message: error.message 
    });
  }
});

/**
 * POST /api/creative-performance/landing-pages
 * 특정 광고 소재의 랜딩페이지 분석 API
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
 *  - summary: 평균 페이지뷰, 평균 체류시간, 이탈률, 전환율
 *  - top_pages: 많이 본 페이지 TOP 10
 *  - exit_pages: 이탈이 많은 페이지 TOP 5
 *  - purchaser_comparison: 구매자 vs 비구매자 비교
 */
router.post('/creative-performance/landing-pages', async (req, res) => {
  try {
    const result = await detailService.getCreativeLandingPages(req.body);
    res.json(result);
  } catch (error) {
    console.error('Landing pages API error:', error);
    
    if (error.message.includes('required')) {
      return res.status(400).json({ 
        success: false,
        error: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch landing pages data',
      message: error.message 
    });
  }
});

/**
 * POST /api/creative-performance/compare
 * 여러 광고 소재 비교 분석 API
 * 
 * Request Body:
 *  - creatives: 비교할 광고 소재 배열 (2~5개)
 *    각 항목: { creative_name, utm_source, utm_medium, utm_campaign }
 *  - start: 시작일 (YYYY-MM-DD) - 필수
 *  - end: 종료일 (YYYY-MM-DD) - 필수
 * 
 * Response:
 *  - creatives_data: 각 소재별 핵심 지표
 *  - daily_trends: 각 소재별 일별 추이
 *  - role_comparison: 각 소재별 광고 역할 분포
 */
/**
 * POST /api/creative-performance/compare
 * 여러 광고 소재 비교 분석 API
 * 
 * Request Body:
 *  - creatives: 비교할 광고 소재 배열 (2~5개)
 *    각 항목: { creative_name, utm_source, utm_medium, utm_campaign }
 *  - start: 시작일 (YYYY-MM-DD) - 필수
 *  - end: 종료일 (YYYY-MM-DD) - 필수
 * 
 * Response:
 *  - creatives_data: 각 소재별 핵심 지표
 *  - daily_trends: 각 소재별 일별 추이
 *  - role_comparison: 각 소재별 광고 역할 분포
 */
router.post('/creative-performance/compare', async (req, res) => {
  try {
    const result = await detailService.compareCreatives(req.body);
    res.json(result);
  } catch (error) {
    console.error('Creative compare API error:', error);
    
    if (error.message.includes('required') || error.message.includes('선택해주세요')) {
      return res.status(400).json({ 
        success: false,
        error: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to compare creatives',
      message: error.message 
    });
  }
});

/**
 * POST /api/creative-performance/raw-traffic
 * Raw Data 검증: 트래픽 지표 + 세션 목록
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
 *  - summary: View, UV, 평균 PV, 평균 체류시간
 *  - sessions: 세션 목록 (최대 500건)
 */
router.post('/creative-performance/raw-traffic', async (req, res) => {
  try {
    const result = await detailService.getRawTrafficData(req.body);
    res.json(result);
  } catch (error) {
    console.error('Raw traffic API error:', error);
    
    if (error.message.includes('required')) {
      return res.status(400).json({ 
        success: false,
        error: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch raw traffic data',
      message: error.message 
    });
  }
});

/**
 * POST /api/creative-performance/raw-attribution
 * Raw Data 검증: 매출 지표 + 기여 주문 상세
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
 *  - summary: 영향 준 주문 수, 막타 횟수, 막타 결제액, 기여한 매출액
 *  - orders: 주문별 기여도 상세 (역할, 기여 비율, 기여 금액)
 */
router.post('/creative-performance/raw-attribution', async (req, res) => {
  try {
    const result = await detailService.getRawAttributionData(req.body);
    res.json(result);
  } catch (error) {
    console.error('Raw attribution API error:', error);
    
    if (error.message.includes('required')) {
      return res.status(400).json({ 
        success: false,
        error: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch raw attribution data',
      message: error.message 
    });
  }
});

/**
 * GET /api/creative-performance/duration-distribution
 * 체류시간 분포 API
 * 
 * Query Parameters:
 *  - start: 시작일 (YYYY-MM-DD) - 필수
 *  - end: 종료일 (YYYY-MM-DD) - 필수
 *  - utm_filters: 동적 UTM 필터 (JSON string, optional)
 * 
 * Response:
 *  - distribution: 구간별 방문자 수 및 비율
 *  - stats: 총 방문자 수, 평균/중앙값 체류시간
 */
router.get('/creative-performance/duration-distribution', async (req, res) => {
  try {
    const result = await detailService.getDurationDistribution(req.query);
    res.json(result);
  } catch (error) {
    console.error('Duration distribution API error:', error);
    
    if (error.message.includes('required')) {
      return res.status(400).json({ 
        success: false,
        error: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch duration distribution',
      message: error.message 
    });
  }
});

module.exports = router;

