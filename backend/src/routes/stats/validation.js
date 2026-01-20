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
 * GET /unique-visitors
 * 순방문자 수 통계 조회 (카페24 "순방문자 수" 화면 호환)
 * 
 * Query params:
 * - startDate: 시작일 (YYYY-MM-DD)
 * - endDate: 종료일 (YYYY-MM-DD)
 * 
 * 반환값:
 * - date: 날짜
 * - totalVisits: 전체방문
 * - uniqueVisitors: 순방문수
 * - returningVisits: 재방문수
 * - prevTotalVisits: 비교값 (전일 전체방문)
 * - changeRate: 증감률 (%)
 */
router.get('/unique-visitors', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    // 카페24 호환 함수 사용 (비교값, 증감률 포함, KST 기준)
    // to_char로 날짜를 문자열로 변환하여 타임존 문제 방지
    const result = await db.query(
      `SELECT 
        to_char(date, 'YYYY-MM-DD') as date,
        total_visits,
        unique_visitors,
        returning_visits,
        prev_total_visits,
        change_rate
      FROM get_daily_visits_cafe24_full($1::DATE, $2::DATE)`,
      [startDate, endDate]
    );
    
    const data = result.rows.map(row => ({
      date: row.date,  // 이미 문자열로 반환됨
      totalVisits: parseInt(row.total_visits),
      uniqueVisitors: parseInt(row.unique_visitors),
      returningVisits: parseInt(row.returning_visits),
      prevTotalVisits: row.prev_total_visits ? parseInt(row.prev_total_visits) : null,
      changeRate: row.change_rate ? parseFloat(row.change_rate) : null
    }));

    // 합계 계산
    const summary = {
      totalVisits: data.reduce((sum, row) => sum + row.totalVisits, 0),
      uniqueVisitors: data.reduce((sum, row) => sum + row.uniqueVisitors, 0),
      returningVisits: data.reduce((sum, row) => sum + row.returningVisits, 0)
    };

    res.json({
      data,
      summary
    });
  } catch (error) {
    console.error('Error fetching unique visitors:', error);
    res.status(500).json({ error: 'Failed to fetch unique visitors' });
  }
});

/**
 * GET /unique-visitors/detail
 * 특정 날짜의 순방문자 상세 목록 조회
 * 
 * Query params:
 * - date: 조회 날짜 (YYYY-MM-DD)
 * - search: 검색어 (visitor_id 또는 IP 주소)
 * - device: 기기 필터 (pc, mobile, tablet)
 * - browser: 브라우저 필터 (chrome, safari, other)
 * - page: 페이지 번호 (기본값: 1)
 * - limit: 페이지당 개수 (기본값: 10)
 * - sortBy: 정렬 기준 (visitor_id, ip_address, browser, visit_time, session_count, pageview_count)
 * - sortOrder: 정렬 순서 (asc, desc)
 */
router.get('/unique-visitors/detail', async (req, res) => {
  try {
    const { 
      date, 
      search = '', 
      device = '', 
      browser = '',
      page = 1, 
      limit = 10,
      sortBy = 'visit_time',
      sortOrder = 'asc'
    } = req.query;
    
    if (!date) {
      return res.status(400).json({ error: 'date is required' });
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // 정렬 컬럼 화이트리스트
    const sortColumns = {
      visitor_id: 'v.visitor_id',
      ip_address: 'v.ip_address',
      browser: 'v.browser',
      visit_time: 'MIN(s.start_time)',
      session_count: 'COUNT(s.session_id)',
      pageview_count: 'COALESCE(SUM(s.pageview_count), 0)'
    };
    const orderColumn = sortColumns[sortBy] || 'MIN(s.start_time)';
    const orderDir = sortOrder === 'desc' ? 'DESC' : 'ASC';

    // 필터 조건 구성
    let filterConditions = [];
    let filterParams = [date];
    let paramIndex = 2;

    if (search) {
      filterConditions.push(`(v.visitor_id ILIKE $${paramIndex} OR v.ip_address ILIKE $${paramIndex})`);
      filterParams.push(`%${search}%`);
      paramIndex++;
    }

    if (device) {
      filterConditions.push(`v.device_type = $${paramIndex}`);
      filterParams.push(device);
      paramIndex++;
    }

    if (browser) {
      if (browser === 'other') {
        filterConditions.push(`v.browser NOT IN ('Chrome', 'Safari')`);
      } else {
        filterConditions.push(`v.browser = $${paramIndex}`);
        filterParams.push(browser.charAt(0).toUpperCase() + browser.slice(1));
        paramIndex++;
      }
    }

    const filterClause = filterConditions.length > 0 
      ? 'AND ' + filterConditions.join(' AND ')
      : '';

    // 상세 목록 쿼리
    const detailQuery = `
      WITH daily_visitors AS (
        SELECT DISTINCT s.visitor_id
        FROM sessions s
        JOIN visitors v ON s.visitor_id = v.visitor_id
        WHERE DATE(s.start_time) = $1
          AND v.is_bot = false
          AND s.duration_seconds > 0
      )
      SELECT 
        v.visitor_id,
        v.ip_address,
        v.browser,
        v.os,
        v.device_type,
        CONCAT(v.browser, '/', 
          CASE v.device_type 
            WHEN 'mobile' THEN '모바일'
            WHEN 'tablet' THEN '태블릿'
            ELSE 'PC'
          END
        ) as user_agent_summary,
        CONCAT(v.browser, ' / ', v.os, ' / ', v.device_type) as user_agent_full,
        to_char(MIN(s.start_time), 'HH24:MI') as visit_time,
        COUNT(s.session_id) as session_count,
        COALESCE(SUM(s.pageview_count), 0) as pageview_count
      FROM visitors v
      JOIN sessions s ON v.visitor_id = s.visitor_id
      WHERE v.visitor_id IN (SELECT visitor_id FROM daily_visitors)
        AND DATE(s.start_time) = $1
        AND v.is_bot = false
        AND s.duration_seconds > 0
        ${filterClause}
      GROUP BY v.visitor_id, v.ip_address, v.browser, v.os, v.device_type
      ORDER BY ${orderColumn} ${orderDir}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    // 총 개수 쿼리
    const countQuery = `
      WITH daily_visitors AS (
        SELECT DISTINCT s.visitor_id
        FROM sessions s
        JOIN visitors v ON s.visitor_id = v.visitor_id
        WHERE DATE(s.start_time) = $1
          AND v.is_bot = false
          AND s.duration_seconds > 0
      )
      SELECT COUNT(DISTINCT v.visitor_id) as total
      FROM visitors v
      JOIN sessions s ON v.visitor_id = s.visitor_id
      WHERE v.visitor_id IN (SELECT visitor_id FROM daily_visitors)
        AND DATE(s.start_time) = $1
        AND v.is_bot = false
        AND s.duration_seconds > 0
        ${filterClause}
    `;

    // 요약 통계 쿼리
    const summaryQuery = `
      WITH daily_visitors AS (
        SELECT DISTINCT s.visitor_id
        FROM sessions s
        JOIN visitors v ON s.visitor_id = v.visitor_id
        WHERE DATE(s.start_time) = $1
          AND v.is_bot = false
          AND s.duration_seconds > 0
      )
      SELECT 
        COUNT(DISTINCT v.visitor_id) as unique_visitors,
        COUNT(DISTINCT v.ip_address) as unique_ips,
        COUNT(s.session_id) as total_sessions,
        COALESCE(SUM(s.pageview_count), 0) as total_pageviews
      FROM visitors v
      JOIN sessions s ON v.visitor_id = s.visitor_id
      WHERE v.visitor_id IN (SELECT visitor_id FROM daily_visitors)
        AND DATE(s.start_time) = $1
        AND v.is_bot = false
        AND s.duration_seconds > 0
    `;

    const detailParams = [...filterParams, limitNum, offset];
    const countParams = filterParams;

    const [detailResult, countResult, summaryResult] = await Promise.all([
      db.query(detailQuery, detailParams),
      db.query(countQuery, countParams),
      db.query(summaryQuery, [date])
    ]);

    const visitors = detailResult.rows.map((row, index) => ({
      rowNum: offset + index + 1,
      visitorId: row.visitor_id,
      ipAddress: row.ip_address || '-',
      browser: row.browser || 'Unknown',
      os: row.os || 'Unknown',
      deviceType: row.device_type || 'unknown',
      userAgentSummary: row.user_agent_summary || 'Unknown',
      userAgentFull: row.user_agent_full || '-',
      visitTime: row.visit_time,
      sessionCount: parseInt(row.session_count),
      pageviewCount: parseInt(row.pageview_count)
    }));

    const total = parseInt(countResult.rows[0].total);
    const summaryRow = summaryResult.rows[0];

    res.json({
      visitors,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      },
      summary: {
        uniqueVisitors: parseInt(summaryRow.unique_visitors),
        uniqueIps: parseInt(summaryRow.unique_ips),
        totalSessions: parseInt(summaryRow.total_sessions),
        totalPageviews: parseInt(summaryRow.total_pageviews)
      }
    });
  } catch (error) {
    console.error('Error fetching unique visitors detail:', error);
    res.status(500).json({ error: 'Failed to fetch unique visitors detail' });
  }
});

/**
 * GET /unique-visitors/all
 * 특정 날짜의 모든 순방문자 IP + 방문시간 (비교 분석용)
 * 페이지네이션 없이 전체 데이터 반환, 초 단위 시간 포함
 * 
 * Query params:
 * - date: 조회 날짜 (YYYY-MM-DD)
 */
router.get('/unique-visitors/all', async (req, res) => {
  try {
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({ error: 'date is required' });
    }

    // 해당 날짜의 모든 순방문자 (고유 IP 기준, 첫 방문 시간) + 상세 정보
    const query = `
      WITH daily_visitors AS (
        SELECT DISTINCT s.visitor_id
        FROM sessions s
        JOIN visitors v ON s.visitor_id = v.visitor_id
        WHERE DATE(s.start_time) = $1
          AND v.is_bot = false
          AND s.duration_seconds > 0
      ),
      visitor_stats AS (
        SELECT 
          v.ip_address,
          MIN(s.start_time) as first_visit,
          v.browser,
          v.os,
          v.device_type,
          COUNT(s.session_id) as session_count,
          COALESCE(SUM(s.pageview_count), 0) as pageview_count,
          COALESCE(SUM(s.duration_seconds), 0) as total_duration
        FROM visitors v
        JOIN sessions s ON v.visitor_id = s.visitor_id
        WHERE v.visitor_id IN (SELECT visitor_id FROM daily_visitors)
          AND DATE(s.start_time) = $1
          AND v.is_bot = false
          AND s.duration_seconds > 0
        GROUP BY v.ip_address, v.browser, v.os, v.device_type
      )
      SELECT 
        ip_address,
        to_char(first_visit, 'YYYY-MM-DD HH24:MI:SS') as visit_time,
        browser,
        os,
        device_type,
        session_count,
        pageview_count,
        total_duration
      FROM visitor_stats
      ORDER BY first_visit ASC
    `;

    const result = await db.query(query, [date]);
    
    const visitors = result.rows.map(row => ({
      ipAddress: row.ip_address || '-',
      visitTime: row.visit_time,
      browser: row.browser || 'Unknown',
      os: row.os || 'Unknown',
      deviceType: row.device_type || 'unknown',
      sessionCount: parseInt(row.session_count) || 0,
      pageviewCount: parseInt(row.pageview_count) || 0,
      totalDuration: parseInt(row.total_duration) || 0
    }));

    res.json({
      date,
      totalCount: visitors.length,
      visitors
    });
  } catch (error) {
    console.error('Error fetching all unique visitors:', error);
    res.status(500).json({ error: 'Failed to fetch all unique visitors' });
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
