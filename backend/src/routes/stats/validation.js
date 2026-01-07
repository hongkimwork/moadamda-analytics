/**
 * Data Validation API
 * 
 * 데이터 검증을 위한 통계 API
 * - /daily-visits: 일별 전체방문, 순방문, 재방문 통계
 * - /pageview-stats: 페이지뷰 통계
 * - /daily-sales: 일별 매출 통계
 */

const express = require('express');
const router = express.Router();
const db = require('../../utils/database');

/**
 * GET /daily-visits
 * 일별 방문 통계 조회
 * 
 * Query params:
 * - startDate: 시작일 (YYYY-MM-DD)
 * - endDate: 종료일 (YYYY-MM-DD)
 */
router.get('/daily-visits', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    // 일별 통계 쿼리
    const query = `
      WITH daily_stats AS (
        SELECT 
          DATE(s.start_time) as date,
          COUNT(DISTINCT s.session_id) as total_visits,
          COUNT(DISTINCT s.visitor_id) as unique_visitors,
          COUNT(DISTINCT CASE WHEN v.visit_count > 1 THEN s.visitor_id END) as returning_visitors
        FROM sessions s
        LEFT JOIN visitors v ON s.visitor_id = v.visitor_id
        WHERE s.start_time >= $1 AND s.start_time < ($2::date + interval '1 day')
        GROUP BY DATE(s.start_time)
        ORDER BY date
      )
      SELECT 
        date,
        total_visits,
        unique_visitors,
        returning_visitors
      FROM daily_stats
    `;

    const result = await db.query(query, [startDate, endDate]);
    
    // 전일 대비 비교값과 증감 계산
    const data = result.rows.map((row, index) => {
      const prevUniqueVisitors = index > 0 ? result.rows[index - 1].unique_visitors : null;
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

    // 합계 계산
    const summary = {
      totalVisits: data.reduce((sum, row) => sum + row.totalVisits, 0),
      uniqueVisitors: data.reduce((sum, row) => sum + row.uniqueVisitors, 0),
      returningVisitors: data.reduce((sum, row) => sum + row.returningVisitors, 0)
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
 * 페이지뷰 통계 조회 (사이트 버전별 + 일별 - 카페24 기준)
 * 
 * Query params:
 * - startDate: 시작일 (YYYY-MM-DD)
 * - endDate: 종료일 (YYYY-MM-DD)
 */
router.get('/pageview-stats', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    // 카페24 기준: URL 기반 사이트 버전, 봇 제외, 세션 내 중복 페이지 제외
    const siteVersionQuery = `
      WITH unique_pageviews AS (
        SELECT DISTINCT 
          p.site_version,
          p.session_id,
          p.page_url
        FROM pageviews p
        JOIN visitors v ON p.visitor_id = v.visitor_id
        WHERE p.timestamp >= $1 AND p.timestamp < ($2::date + interval '1 day')
          AND v.is_bot = false
      )
      SELECT 
        site_version,
        COUNT(*) as pageviews,
        COUNT(DISTINCT session_id) as first_sessions
      FROM unique_pageviews
      GROUP BY site_version
      ORDER BY pageviews DESC
    `;

    // 일별 통계 쿼리
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

    const [siteVersionResult, dailyResult] = await Promise.all([
      db.query(siteVersionQuery, [startDate, endDate]),
      db.query(dailyQuery, [startDate, endDate])
    ]);
    
    // 전체 합계 계산
    const totalPageviews = siteVersionResult.rows.reduce((sum, row) => sum + parseInt(row.pageviews), 0);
    const totalSessions = siteVersionResult.rows.reduce((sum, row) => sum + parseInt(row.first_sessions), 0);
    
    const data = siteVersionResult.rows.map(row => ({
      siteVersion: row.site_version,
      pageviews: parseInt(row.pageviews),
      firstSessions: parseInt(row.first_sessions),
      pvPerSession: row.first_sessions > 0 
        ? Math.round((parseInt(row.pageviews) / parseInt(row.first_sessions)) * 10) / 10 
        : 0
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
        COALESCE(SUM(final_payment), 0) as final_payment,
        COALESCE(SUM(CASE WHEN order_status IN ('cancelled', 'refunded') THEN refund_amount ELSE 0 END), 0) as refund_amount
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
      finalPayment: parseInt(row.final_payment),
      refundAmount: parseInt(row.refund_amount),
      netSales: parseInt(row.final_payment) - parseInt(row.refund_amount)
    }));

    const summary = {
      orderCount: data.reduce((sum, row) => sum + row.orderCount, 0),
      productCount: data.reduce((sum, row) => sum + row.productCount, 0),
      totalAmount: data.reduce((sum, row) => sum + row.totalAmount, 0),
      shippingFee: data.reduce((sum, row) => sum + row.shippingFee, 0),
      discountAmount: data.reduce((sum, row) => sum + row.discountAmount, 0),
      finalPayment: data.reduce((sum, row) => sum + row.finalPayment, 0),
      refundAmount: data.reduce((sum, row) => sum + row.refundAmount, 0),
      netSales: data.reduce((sum, row) => sum + row.netSales, 0)
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
