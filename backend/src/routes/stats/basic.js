const express = require('express');
const router = express.Router();
const db = require('../../utils/database');
const { cleanUrl } = require('../../utils/urlCleaner');

// GET /api/stats/today - Today's basic statistics
router.get('/today', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Total visitors today
    const visitorsResult = await db.query(`
      SELECT COUNT(DISTINCT visitor_id) as count
      FROM pageviews
      WHERE timestamp >= $1
    `, [today]);

    // 2. Total pageviews today
    const pageviewsResult = await db.query(`
      SELECT COUNT(*) as count
      FROM pageviews
      WHERE timestamp >= $1
    `, [today]);

    // 3. Device breakdown
    const devicesResult = await db.query(`
      SELECT device_type, COUNT(DISTINCT visitor_id) as count
      FROM visitors
      WHERE last_visit >= $1
      GROUP BY device_type
    `, [today]);

    const deviceBreakdown = {
      pc: 0,
      mobile: 0
    };
    devicesResult.rows.forEach(row => {
      if (row.device_type === 'pc') deviceBreakdown.pc = parseInt(row.count);
      if (row.device_type === 'mobile') deviceBreakdown.mobile = parseInt(row.count);
    });

    // 4. Realtime visitors (active in last 5 minutes)
    const realtimeResult = await db.query(`
      SELECT COUNT(*) as count
      FROM realtime_visitors
      WHERE last_activity >= NOW() - INTERVAL '5 minutes'
    `);

    // 5. New vs returning visitors
    const newVisitorsResult = await db.query(`
      SELECT COUNT(*) as count
      FROM visitors
      WHERE first_visit >= $1 AND visit_count = 1
    `, [today]);

    res.json({
      date: today.toISOString(),
      visitors: {
        total: parseInt(visitorsResult.rows[0].count),
        new: parseInt(newVisitorsResult.rows[0].count),
        returning: parseInt(visitorsResult.rows[0].count) - parseInt(newVisitorsResult.rows[0].count)
      },
      pageviews: parseInt(pageviewsResult.rows[0].count),
      devices: deviceBreakdown,
      realtime: parseInt(realtimeResult.rows[0].count)
    });
  } catch (error) {
    console.error('Stats today error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// GET /api/stats/conversion - Conversion statistics
router.get('/conversion', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Total revenue today
    const revenueResult = await db.query(`
      SELECT
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN final_payment > 0 THEN final_payment ELSE total_amount END), 0) as final_revenue,
        COUNT(*) as order_count
      FROM conversions
      WHERE timestamp >= $1
    `, [today]);

    const totalRevenue = parseInt(revenueResult.rows[0].total_revenue);
    const finalRevenue = parseInt(revenueResult.rows[0].final_revenue);
    const orderCount = parseInt(revenueResult.rows[0].order_count);

    // 2. Average Order Value (AOV)
    const aov = orderCount > 0 ? Math.round(finalRevenue / orderCount) : 0;

    // 3. Purchase conversion rate
    const visitorsResult = await db.query(`
      SELECT COUNT(DISTINCT visitor_id) as count
      FROM pageviews
      WHERE timestamp >= $1
    `, [today]);

    const totalVisitors = parseInt(visitorsResult.rows[0].count);
    const conversionRate = totalVisitors > 0
      ? ((orderCount / totalVisitors) * 100).toFixed(2)
      : '0.00';

    // 4. Cart abandonment rate
    const cartAddResult = await db.query(`
      SELECT COUNT(DISTINCT session_id) as count
      FROM events
      WHERE event_type = 'add_to_cart' AND timestamp >= $1
    `, [today]);

    const cartAdded = parseInt(cartAddResult.rows[0].count);
    const cartAbandonmentRate = cartAdded > 0
      ? (((cartAdded - orderCount) / cartAdded) * 100).toFixed(2)
      : '0.00';

    // 5. Yesterday's comparison
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const yesterdayRevenueResult = await db.query(`
      SELECT
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN final_payment > 0 THEN final_payment ELSE total_amount END), 0) as final_revenue,
        COUNT(*) as order_count
      FROM conversions
      WHERE timestamp >= $1 AND timestamp < $2
    `, [yesterday, today]);

    const yesterdayRevenue = parseInt(yesterdayRevenueResult.rows[0].final_revenue);
    const revenueChange = yesterdayRevenue > 0
      ? (((finalRevenue - yesterdayRevenue) / yesterdayRevenue) * 100).toFixed(2)
      : '0.00';

    res.json({
      date: today.toISOString(),
      revenue: {
        total: finalRevenue,
        yesterday: yesterdayRevenue,
        change_percent: parseFloat(revenueChange)
      },
      orders: {
        count: orderCount,
        aov: aov
      },
      conversion_rate: parseFloat(conversionRate),
      cart_abandonment_rate: parseFloat(cartAbandonmentRate)
    });
  } catch (error) {
    console.error('Stats conversion error:', error);
    res.status(500).json({ error: 'Failed to fetch conversion statistics' });
  }
});

// GET /api/stats/products - Product performance
router.get('/products', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Top products by views
    const productsResult = await db.query(`
      SELECT
        product_id,
        product_name,
        COUNT(CASE WHEN event_type = 'view_product' THEN 1 END) as views,
        COUNT(CASE WHEN event_type = 'add_to_cart' THEN 1 END) as cart_adds,
        COUNT(CASE WHEN event_type = 'purchase' THEN 1 END) as purchases
      FROM events
      WHERE timestamp >= $1 AND product_id IS NOT NULL
      GROUP BY product_id, product_name
      ORDER BY views DESC
      LIMIT 10
    `, [today]);

    const products = productsResult.rows.map(row => ({
      product_id: row.product_id,
      product_name: row.product_name,
      views: parseInt(row.views),
      cart_adds: parseInt(row.cart_adds),
      purchases: parseInt(row.purchases),
      conversion_rate: parseInt(row.views) > 0
        ? ((parseInt(row.purchases) / parseInt(row.views)) * 100).toFixed(2)
        : '0.00'
    }));

    res.json({
      date: today.toISOString(),
      products
    });
  } catch (error) {
    console.error('Stats products error:', error);
    res.status(500).json({ error: 'Failed to fetch product statistics' });
  }
});

module.exports = router;
