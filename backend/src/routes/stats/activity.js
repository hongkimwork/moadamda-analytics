const express = require('express');
const router = express.Router();
const db = require('../../utils/database');

// GET /api/stats/recent-activity - Recent activity feed
router.get('/recent-activity', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    // 1. Recent orders (last 24 hours)
    const recentOrdersResult = await db.query(`
      SELECT 
        c.order_id,
        c.total_amount,
        c.final_payment,
        c.product_count,
        c.timestamp,
        e.product_name
      FROM conversions c
      LEFT JOIN LATERAL (
        SELECT product_name
        FROM events
        WHERE order_id = c.order_id 
          AND event_type = 'purchase'
        LIMIT 1
      ) e ON true
      WHERE c.timestamp >= NOW() - INTERVAL '24 hours'
      ORDER BY c.timestamp DESC
      LIMIT $1
    `, [parseInt(limit)]);

    // 2. Recently viewed products (last 1 hour)
    const recentProductsResult = await db.query(`
      SELECT 
        product_id,
        product_name,
        COUNT(*) as view_count,
        MAX(timestamp) as last_viewed
      FROM events
      WHERE event_type = 'view_product' 
        AND timestamp >= NOW() - INTERVAL '1 hour'
        AND product_id IS NOT NULL
      GROUP BY product_id, product_name
      ORDER BY last_viewed DESC
      LIMIT $1
    `, [parseInt(limit)]);

    // 3. Recent cart additions (last 1 hour)
    const recentCartResult = await db.query(`
      SELECT 
        product_id,
        product_name,
        timestamp
      FROM events
      WHERE event_type = 'add_to_cart' 
        AND timestamp >= NOW() - INTERVAL '1 hour'
        AND product_id IS NOT NULL
      ORDER BY timestamp DESC
      LIMIT $1
    `, [parseInt(limit)]);

    const recentOrders = recentOrdersResult.rows.map(row => ({
      order_id: row.order_id,
      product_name: row.product_name || '상품명 없음',
      amount: parseInt(row.final_payment) > 0 ? parseInt(row.final_payment) : parseInt(row.total_amount),
      product_count: parseInt(row.product_count),
      timestamp: row.timestamp.toISOString(),
      type: 'order'
    }));

    const recentProducts = recentProductsResult.rows.map(row => ({
      product_id: row.product_id,
      product_name: row.product_name,
      view_count: parseInt(row.view_count),
      timestamp: row.last_viewed.toISOString(),
      type: 'view'
    }));

    const recentCart = recentCartResult.rows.map(row => ({
      product_id: row.product_id,
      product_name: row.product_name,
      timestamp: row.timestamp.toISOString(),
      type: 'cart'
    }));

    res.json({
      recent_orders: recentOrders,
      recently_viewed: recentProducts,
      recent_cart: recentCart
    });
  } catch (error) {
    console.error('Recent activity error:', error);
    res.status(500).json({ error: 'Failed to fetch recent activity' });
  }
});

// GET /api/stats/segments - New vs returning visitor segment analysis
router.get('/segments', async (req, res) => {
  try {
    const { start, end, device } = req.query;
    
    if (!start || !end) {
      return res.status(400).json({ error: 'start and end dates are required (YYYY-MM-DD format)' });
    }

    const startDate = new Date(start);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    // Device filter setup
    const deviceParams = device && device !== 'all' ? [startDate, endDate, device] : [startDate, endDate];

    // 1. New visitors segment (visit_count = 1)
    const newVisitorsQuery = device && device !== 'all'
      ? `SELECT 
           COUNT(DISTINCT v.visitor_id) as visitor_count,
           COUNT(DISTINCT s.session_id) as session_count,
           COALESCE(SUM(s.pageview_count), 0) as total_pageviews,
           COALESCE(AVG(s.pageview_count), 0) as avg_pageviews_per_session,
           COUNT(DISTINCT CASE WHEN s.is_converted = true THEN s.session_id END) as converted_sessions
         FROM visitors v
         LEFT JOIN sessions s ON v.visitor_id = s.visitor_id AND s.start_time >= $1 AND s.start_time <= $2
         WHERE v.visit_count = 1 AND v.first_visit >= $1 AND v.first_visit <= $2 AND v.device_type = $3`
      : `SELECT 
           COUNT(DISTINCT v.visitor_id) as visitor_count,
           COUNT(DISTINCT s.session_id) as session_count,
           COALESCE(SUM(s.pageview_count), 0) as total_pageviews,
           COALESCE(AVG(s.pageview_count), 0) as avg_pageviews_per_session,
           COUNT(DISTINCT CASE WHEN s.is_converted = true THEN s.session_id END) as converted_sessions
         FROM visitors v
         LEFT JOIN sessions s ON v.visitor_id = s.visitor_id AND s.start_time >= $1 AND s.start_time <= $2
         WHERE v.visit_count = 1 AND v.first_visit >= $1 AND v.first_visit <= $2`;
    
    const newVisitorsResult = await db.query(newVisitorsQuery, deviceParams);

    // 2. Returning visitors segment (visit_count > 1)
    const returningVisitorsQuery = device && device !== 'all'
      ? `SELECT 
           COUNT(DISTINCT v.visitor_id) as visitor_count,
           COUNT(DISTINCT s.session_id) as session_count,
           COALESCE(SUM(s.pageview_count), 0) as total_pageviews,
           COALESCE(AVG(s.pageview_count), 0) as avg_pageviews_per_session,
           COUNT(DISTINCT CASE WHEN s.is_converted = true THEN s.session_id END) as converted_sessions
         FROM visitors v
         LEFT JOIN sessions s ON v.visitor_id = s.visitor_id AND s.start_time >= $1 AND s.start_time <= $2
         WHERE v.visit_count > 1 AND v.last_visit >= $1 AND v.last_visit <= $2 AND v.device_type = $3`
      : `SELECT 
           COUNT(DISTINCT v.visitor_id) as visitor_count,
           COUNT(DISTINCT s.session_id) as session_count,
           COALESCE(SUM(s.pageview_count), 0) as total_pageviews,
           COALESCE(AVG(s.pageview_count), 0) as avg_pageviews_per_session,
           COUNT(DISTINCT CASE WHEN s.is_converted = true THEN s.session_id END) as converted_sessions
         FROM visitors v
         LEFT JOIN sessions s ON v.visitor_id = s.visitor_id AND s.start_time >= $1 AND s.start_time <= $2
         WHERE v.visit_count > 1 AND v.last_visit >= $1 AND v.last_visit <= $2`;
    
    const returningVisitorsResult = await db.query(returningVisitorsQuery, deviceParams);

    // 3. Revenue by segment
    const newRevenueQuery = device && device !== 'all'
      ? `SELECT 
           COALESCE(SUM(CASE WHEN c.final_payment > 0 THEN c.final_payment ELSE c.total_amount END), 0) as revenue,
           COUNT(*) as orders
         FROM conversions c
         JOIN visitors v ON c.visitor_id = v.visitor_id
         WHERE v.visit_count = 1 AND c.timestamp >= $1 AND c.timestamp <= $2 AND v.device_type = $3`
      : `SELECT 
           COALESCE(SUM(CASE WHEN final_payment > 0 THEN final_payment ELSE total_amount END), 0) as revenue,
           COUNT(*) as orders
         FROM conversions c
         JOIN visitors v ON c.visitor_id = v.visitor_id
         WHERE v.visit_count = 1 AND c.timestamp >= $1 AND c.timestamp <= $2`;
    
    const newRevenueResult = await db.query(newRevenueQuery, deviceParams);

    const returningRevenueQuery = device && device !== 'all'
      ? `SELECT 
           COALESCE(SUM(CASE WHEN c.final_payment > 0 THEN c.final_payment ELSE c.total_amount END), 0) as revenue,
           COUNT(*) as orders
         FROM conversions c
         JOIN visitors v ON c.visitor_id = v.visitor_id
         WHERE v.visit_count > 1 AND c.timestamp >= $1 AND c.timestamp <= $2 AND v.device_type = $3`
      : `SELECT 
           COALESCE(SUM(CASE WHEN final_payment > 0 THEN final_payment ELSE total_amount END), 0) as revenue,
           COUNT(*) as orders
         FROM conversions c
         JOIN visitors v ON c.visitor_id = v.visitor_id
         WHERE v.visit_count > 1 AND c.timestamp >= $1 AND c.timestamp <= $2`;
    
    const returningRevenueResult = await db.query(returningRevenueQuery, deviceParams);

    // Calculate metrics
    const newSegment = newVisitorsResult.rows[0];
    const returningSegment = returningVisitorsResult.rows[0];
    const newRevenue = newRevenueResult.rows[0];
    const returningRevenue = returningRevenueResult.rows[0];

    const response = {
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      new_visitors: {
        visitor_count: parseInt(newSegment.visitor_count),
        session_count: parseInt(newSegment.session_count),
        total_pageviews: parseInt(newSegment.total_pageviews),
        avg_pageviews_per_session: parseFloat(newSegment.avg_pageviews_per_session).toFixed(2),
        converted_sessions: parseInt(newSegment.converted_sessions),
        conversion_rate: newSegment.session_count > 0 
          ? ((parseInt(newSegment.converted_sessions) / parseInt(newSegment.session_count)) * 100).toFixed(2)
          : '0.00',
        revenue: parseInt(newRevenue.revenue),
        orders: parseInt(newRevenue.orders),
        avg_order_value: parseInt(newRevenue.orders) > 0
          ? (parseInt(newRevenue.revenue) / parseInt(newRevenue.orders)).toFixed(0)
          : '0'
      },
      returning_visitors: {
        visitor_count: parseInt(returningSegment.visitor_count),
        session_count: parseInt(returningSegment.session_count),
        total_pageviews: parseInt(returningSegment.total_pageviews),
        avg_pageviews_per_session: parseFloat(returningSegment.avg_pageviews_per_session).toFixed(2),
        converted_sessions: parseInt(returningSegment.converted_sessions),
        conversion_rate: returningSegment.session_count > 0 
          ? ((parseInt(returningSegment.converted_sessions) / parseInt(returningSegment.session_count)) * 100).toFixed(2)
          : '0.00',
        revenue: parseInt(returningRevenue.revenue),
        orders: parseInt(returningRevenue.orders),
        avg_order_value: parseInt(returningRevenue.orders) > 0
          ? (parseInt(returningRevenue.revenue) / parseInt(returningRevenue.orders)).toFixed(0)
          : '0'
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Stats segments error:', error);
    res.status(500).json({ error: 'Failed to fetch segment statistics' });
  }
});

module.exports = router;
