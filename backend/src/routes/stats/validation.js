/**
 * Data Validation API (카페24 호환)
 * 
 * 데이터 검증을 위한 통계 API - 카페24 기준과 동일한 집계 방식 적용
 * - /daily-visits: 일별 전체방문, 순방문, 재방문 통계 (봇 제외)
 * - /pageview-stats: 페이지뷰 통계 (봇 제외, 세션 내 중복 URL 제거)
 * - /daily-sales: 일별 매출 통계
 * 
 * 카페24 호환 기준:
 * - 봇 트래픽 제외 (visitors.is_bot = false)
 * - 재방문자: 조회 기간 시작일 이전에 첫 방문한 사람
 * - 페이지뷰: 세션 내 동일 URL 중복 제거 (새로고침 제외)
 * - 세션 타임아웃: 2시간 (트래커 v21.0부터 적용)
 */

const express = require('express');
const router = express.Router();
const db = require('../../utils/database');

/**
 * GET /daily-visits
 * 일별 방문 통계 조회 (카페24 호환)
 * 
 * Query params:
 * - startDate: 시작일 (YYYY-MM-DD)
 * - endDate: 종료일 (YYYY-MM-DD)
 * 
 * 카페24 호환 기준:
 * - 봇 트래픽 제외
 * - 재방문자: 해당 날짜 이전에 첫 방문한 사람 (일별) / 조회 시작일 이전에 첫 방문한 사람 (합계)
 */
router.get('/daily-visits', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    // 카페24 호환 함수 사용
    const [dailyResult, summaryResult] = await Promise.all([
      db.query('SELECT * FROM get_daily_visits_cafe24($1::DATE, $2::DATE)', [startDate, endDate]),
      db.query('SELECT * FROM get_visit_summary_cafe24($1::DATE, $2::DATE)', [startDate, endDate])
    ]);
    
    // 전일 대비 비교값과 증감 계산
    const data = dailyResult.rows.map((row, index) => {
      const prevUniqueVisitors = index > 0 ? dailyResult.rows[index - 1].unique_visitors : null;
      const change = prevUniqueVisitors !== null 
        ? parseInt(row.unique_visitors) - parseInt(prevUniqueVisitors)
        : null;
      
      return {
        date: row.date,
        totalVisits: parseInt(row.total_visits),
        uniqueVisitors: parseInt(row.unique_visitors),
        returningVisitors: parseInt(row.returning_visitors),
        compareValue: prevUniqueVisitors !== null ? parseInt(prevUniqueVisitors) : null,
        change: change
      };
    });

    // 합계 (카페24 호환 함수 결과)
    const summaryRow = summaryResult.rows[0];
    const summary = {
      totalVisits: parseInt(summaryRow.total_visits),
      uniqueVisitors: parseInt(summaryRow.unique_visitors),
      returningVisitors: parseInt(summaryRow.returning_visitors)
    };

    res.json({
      data,
      summary
    });
  } catch (error) {
    console.error('Error fetching daily visits:', error);
    res.status(500).json({ error: 'Failed to fetch daily visits' });
  }
});

/**
 * GET /pageview-stats
 * 페이지뷰 통계 조회 (카페24 호환)
 * 
 * Query params:
 * - startDate: 시작일 (YYYY-MM-DD)
 * - endDate: 종료일 (YYYY-MM-DD)
 * 
 * 카페24 호환 기준:
 * - 봇 트래픽 제외
 * - 세션 내 동일 URL 중복 제거 (새로고침 제외)
 */
router.get('/pageview-stats', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    // 카페24 호환 함수 사용 (사이트 버전별)
    const siteVersionResult = await db.query(
      'SELECT * FROM get_pageview_stats_cafe24($1::DATE, $2::DATE)',
      [startDate, endDate]
    );

    // 일별 통계 쿼리 (카페24 호환 - 봇 제외, 세션 내 중복 URL 제거)
    const dailyQuery = `
      WITH unique_pageviews AS (
        SELECT DISTINCT 
          DATE(p.timestamp) as date,
          p.session_id,
          p.page_url
        FROM pageviews p
        JOIN visitors v ON p.visitor_id = v.visitor_id
        WHERE p.timestamp >= $1 AND p.timestamp < ($2::date + interval '1 day')
          AND v.is_bot = false
      )
      SELECT 
        date,
        COUNT(*) as pageviews,
        COUNT(DISTINCT session_id) as first_sessions
      FROM unique_pageviews
      GROUP BY date
      ORDER BY date
    `;

    const dailyResult = await db.query(dailyQuery, [startDate, endDate]);
    
    // 전체 합계 계산
    const totalPageviews = siteVersionResult.rows.reduce((sum, row) => sum + parseInt(row.pageviews), 0);
    const totalSessions = siteVersionResult.rows.reduce((sum, row) => sum + parseInt(row.first_sessions), 0);
    
    const data = siteVersionResult.rows.map(row => ({
      siteVersion: row.site_version,
      pageviews: parseInt(row.pageviews),
      firstSessions: parseInt(row.first_sessions),
      pvPerSession: parseFloat(row.pv_per_session) || 0
    }));

    // 일별 데이터 처리 (전일 대비 증감 계산)
    const dailyData = dailyResult.rows.map((row, index) => {
      const pageviews = parseInt(row.pageviews);
      const firstSessions = parseInt(row.first_sessions);
      const prevPageviews = index > 0 ? parseInt(dailyResult.rows[index - 1].pageviews) : null;
      const change = prevPageviews !== null ? pageviews - prevPageviews : null;

      return {
        date: row.date,
        pageviews: pageviews,
        firstSessions: firstSessions,
        pvPerSession: firstSessions > 0 
          ? Math.round((pageviews / firstSessions) * 10) / 10 
          : 0,
        compareValue: prevPageviews,
        change: change
      };
    });

    const summary = {
      pageviews: totalPageviews,
      firstSessions: totalSessions,
      pvPerSession: totalSessions > 0 ? Math.round((totalPageviews / totalSessions) * 10) / 10 : 0
    };

    // PC 버전을 먼저, 모바일 버전을 나중에 표시
    const sortOrder = { pc: 1, mobile: 2 };
    const sortedData = [...data].sort((a, b) => 
      (sortOrder[a.siteVersion] || 99) - (sortOrder[b.siteVersion] || 99)
    );

    res.json({
      data: sortedData,
      dailyData: dailyData,
      summary
    });
  } catch (error) {
    console.error('Error fetching pageview stats:', error);
    res.status(500).json({ error: 'Failed to fetch pageview stats' });
  }
});

/**
 * GET /daily-sales
 * 일별 매출 통계 조회
 * 
 * Query params:
 * - startDate: 시작일 (YYYY-MM-DD)
 * - endDate: 종료일 (YYYY-MM-DD)
 */
router.get('/daily-sales', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const query = `
      SELECT 
        DATE(timestamp) as date,
        COUNT(DISTINCT order_id) as order_count,
        COALESCE(SUM(product_count), 0) as product_count,
        COALESCE(SUM(total_amount), 0) as total_amount,
        COALESCE(SUM(shipping_fee), 0) as shipping_fee,
        COALESCE(SUM(discount_amount), 0) as discount_amount,
        COALESCE(SUM(final_payment), 0) as final_payment
      FROM conversions
      WHERE timestamp >= $1 AND timestamp < ($2::date + interval '1 day')
      GROUP BY DATE(timestamp)
      ORDER BY date DESC
    `;

    const result = await db.query(query, [startDate, endDate]);
    
    const data = result.rows.map(row => ({
      date: row.date,
      orderCount: parseInt(row.order_count),
      productCount: parseInt(row.product_count),
      totalAmount: parseInt(row.total_amount),
      shippingFee: parseInt(row.shipping_fee),
      discountAmount: parseInt(row.discount_amount),
      finalPayment: parseInt(row.final_payment)
    }));

    const summary = {
      orderCount: data.reduce((sum, row) => sum + row.orderCount, 0),
      productCount: data.reduce((sum, row) => sum + row.productCount, 0),
      totalAmount: data.reduce((sum, row) => sum + row.totalAmount, 0),
      shippingFee: data.reduce((sum, row) => sum + row.shippingFee, 0),
      discountAmount: data.reduce((sum, row) => sum + row.discountAmount, 0),
      finalPayment: data.reduce((sum, row) => sum + row.finalPayment, 0)
    };

    res.json({
      data,
      summary
    });
  } catch (error) {
    console.error('Error fetching daily sales:', error);
    res.status(500).json({ error: 'Failed to fetch daily sales' });
  }
});

module.exports = router;
