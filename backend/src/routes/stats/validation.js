/**
 * Data Validation API
 * 
 * 데이터 검증을 위한 일별 방문 통계 API
 * - /daily-visits: 일별 전체방문, 순방문, 재방문 통계
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

module.exports = router;
