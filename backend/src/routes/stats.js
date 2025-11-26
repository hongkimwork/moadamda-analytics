const express = require('express');
const router = express.Router();
const db = require('../utils/database');
const { cleanUrl } = require('../utils/urlCleaner');

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

// GET /api/stats/range - Statistics for a date range with comparison
router.get('/range', async (req, res) => {
  try {
    const { start, end, compare, device } = req.query;
    
    if (!start || !end) {
      return res.status(400).json({ error: 'start and end dates are required (YYYY-MM-DD format)' });
    }

    const startDate = new Date(start);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    // Device filter clause
    let deviceFilter = '';
    let deviceParams = [];
    if (device && device !== 'all') {
      deviceFilter = ' AND v.device_type = $3';
      deviceParams = [device];
    }

    // 1. Total visitors in range (with device filter if applicable)
    const visitorsQuery = device && device !== 'all'
      ? `SELECT COUNT(DISTINCT p.visitor_id) as count
         FROM pageviews p
         JOIN visitors v ON p.visitor_id = v.visitor_id
         WHERE p.timestamp >= $1 AND p.timestamp <= $2 AND v.device_type = $3`
      : `SELECT COUNT(DISTINCT visitor_id) as count
         FROM pageviews
         WHERE timestamp >= $1 AND timestamp <= $2`;
    
    const visitorsParams = device && device !== 'all' 
      ? [startDate, endDate, device]
      : [startDate, endDate];
    
    const visitorsResult = await db.query(visitorsQuery, visitorsParams);

    // 2. Total pageviews in range (with device filter)
    const pageviewsQuery = device && device !== 'all'
      ? `SELECT COUNT(*) as count
         FROM pageviews p
         JOIN visitors v ON p.visitor_id = v.visitor_id
         WHERE p.timestamp >= $1 AND p.timestamp <= $2 AND v.device_type = $3`
      : `SELECT COUNT(*) as count
         FROM pageviews
         WHERE timestamp >= $1 AND timestamp <= $2`;
    
    const pageviewsResult = await db.query(pageviewsQuery, visitorsParams);

    // 3. Device breakdown (always show, regardless of filter)
    const devicesResult = await db.query(`
      SELECT device_type, COUNT(DISTINCT visitor_id) as count
      FROM visitors
      WHERE last_visit >= $1 AND last_visit <= $2
      GROUP BY device_type
    `, [startDate, endDate]);

    const deviceBreakdown = {
      pc: 0,
      mobile: 0
    };
    devicesResult.rows.forEach(row => {
      if (row.device_type === 'pc') deviceBreakdown.pc = parseInt(row.count);
      if (row.device_type === 'mobile') deviceBreakdown.mobile = parseInt(row.count);
    });

    // 4. New vs returning visitors (with device filter)
    const newVisitorsQuery = device && device !== 'all'
      ? `SELECT COUNT(*) as count
         FROM visitors
         WHERE first_visit >= $1 AND first_visit <= $2 AND visit_count = 1 AND device_type = $3`
      : `SELECT COUNT(*) as count
         FROM visitors
         WHERE first_visit >= $1 AND first_visit <= $2 AND visit_count = 1`;
    
    const newVisitorsResult = await db.query(newVisitorsQuery, visitorsParams);

    // 5. Revenue and orders (with device filter)
    const revenueQuery = device && device !== 'all'
      ? `SELECT 
           COALESCE(SUM(c.total_amount), 0) as total_revenue,
           COALESCE(SUM(CASE WHEN c.final_payment > 0 THEN c.final_payment ELSE c.total_amount END), 0) as final_revenue,
           COALESCE(SUM(c.discount_amount), 0) as total_discount,
           COALESCE(SUM(c.mileage_used), 0) as total_mileage,
           COALESCE(SUM(c.shipping_fee), 0) as total_shipping,
           COUNT(*) as order_count
         FROM conversions c
         JOIN visitors v ON c.visitor_id = v.visitor_id
         WHERE c.timestamp >= $1 AND c.timestamp <= $2 AND v.device_type = $3`
      : `SELECT 
           COALESCE(SUM(total_amount), 0) as total_revenue,
           COALESCE(SUM(CASE WHEN final_payment > 0 THEN final_payment ELSE total_amount END), 0) as final_revenue,
           COALESCE(SUM(discount_amount), 0) as total_discount,
           COALESCE(SUM(mileage_used), 0) as total_mileage,
           COALESCE(SUM(shipping_fee), 0) as total_shipping,
           COUNT(*) as order_count
         FROM conversions
         WHERE timestamp >= $1 AND timestamp <= $2`;
    
    const revenueResult = await db.query(revenueQuery, visitorsParams);

    const totalRevenue = parseInt(revenueResult.rows[0].total_revenue);
    const finalRevenue = parseInt(revenueResult.rows[0].final_revenue);
    const orderCount = parseInt(revenueResult.rows[0].order_count);
    const totalDiscount = parseInt(revenueResult.rows[0].total_discount);
    const totalMileage = parseInt(revenueResult.rows[0].total_mileage);
    const totalShipping = parseInt(revenueResult.rows[0].total_shipping);

    // 6. AOV
    const aov = orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0;
    const finalAov = orderCount > 0 ? Math.round(finalRevenue / orderCount) : 0;

    // 7. Conversion rate
    const totalVisitors = parseInt(visitorsResult.rows[0].count);
    const conversionRate = totalVisitors > 0 
      ? ((orderCount / totalVisitors) * 100).toFixed(2)
      : '0.00';

    // 8. Cart abandonment rate (with device filter)
    const cartAddQuery = device && device !== 'all'
      ? `SELECT COUNT(DISTINCT e.session_id) as count
         FROM events e
         JOIN visitors v ON e.visitor_id = v.visitor_id
         WHERE e.event_type = 'add_to_cart' AND e.timestamp >= $1 AND e.timestamp <= $2 AND v.device_type = $3`
      : `SELECT COUNT(DISTINCT session_id) as count
         FROM events
         WHERE event_type = 'add_to_cart' AND timestamp >= $1 AND timestamp <= $2`;
    
    const cartAddResult = await db.query(cartAddQuery, visitorsParams);

    const cartAdded = parseInt(cartAddResult.rows[0].count);
    const cartAbandonmentRate = cartAdded > 0
      ? (((cartAdded - orderCount) / cartAdded) * 100).toFixed(2)
      : '0.00';

    // 9. Top products (with device filter)
    const productsQuery = device && device !== 'all'
      ? `SELECT 
           e.product_id,
           e.product_name,
           COUNT(CASE WHEN e.event_type = 'view_product' THEN 1 END) as views,
           COUNT(CASE WHEN e.event_type = 'add_to_cart' THEN 1 END) as cart_adds,
           COUNT(CASE WHEN e.event_type = 'purchase' THEN 1 END) as purchases
         FROM events e
         JOIN visitors v ON e.visitor_id = v.visitor_id
         WHERE e.timestamp >= $1 AND e.timestamp <= $2 AND e.product_id IS NOT NULL AND v.device_type = $3
         GROUP BY e.product_id, e.product_name
         ORDER BY views DESC
         LIMIT 10`
      : `SELECT 
           product_id,
           product_name,
           COUNT(CASE WHEN event_type = 'view_product' THEN 1 END) as views,
           COUNT(CASE WHEN event_type = 'add_to_cart' THEN 1 END) as cart_adds,
           COUNT(CASE WHEN event_type = 'purchase' THEN 1 END) as purchases
         FROM events
         WHERE timestamp >= $1 AND timestamp <= $2 AND product_id IS NOT NULL
         GROUP BY product_id, product_name
         ORDER BY views DESC
         LIMIT 10`;
    
    const productsResult = await db.query(productsQuery, visitorsParams);

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

    // Response object
    const response = {
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      visitors: {
        total: totalVisitors,
        new: parseInt(newVisitorsResult.rows[0].count),
        returning: totalVisitors - parseInt(newVisitorsResult.rows[0].count)
      },
      pageviews: parseInt(pageviewsResult.rows[0].count),
      devices: deviceBreakdown,
      revenue: {
        total: totalRevenue,
        final: finalRevenue,
        discount: totalDiscount,
        mileage: totalMileage,
        shipping: totalShipping
      },
      orders: {
        count: orderCount,
        aov: aov,
        final_aov: finalAov
      },
      conversion_rate: parseFloat(conversionRate),
      cart_abandonment_rate: parseFloat(cartAbandonmentRate),
      products
    };

    // If comparison is requested, fetch previous period data
    if (compare === 'true') {
      const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
      const compareStartDate = new Date(startDate);
      compareStartDate.setDate(compareStartDate.getDate() - daysDiff);
      const compareEndDate = new Date(endDate);
      compareEndDate.setDate(compareEndDate.getDate() - daysDiff);

      // Fetch comparison data (with device filter)
      const compareVisitorsQuery = device && device !== 'all'
        ? `SELECT COUNT(DISTINCT p.visitor_id) as count
           FROM pageviews p
           JOIN visitors v ON p.visitor_id = v.visitor_id
           WHERE p.timestamp >= $1 AND p.timestamp <= $2 AND v.device_type = $3`
        : `SELECT COUNT(DISTINCT visitor_id) as count
           FROM pageviews
           WHERE timestamp >= $1 AND timestamp <= $2`;
      
      const compareVisitorsParams = device && device !== 'all' 
        ? [compareStartDate, compareEndDate, device]
        : [compareStartDate, compareEndDate];
      
      const compareVisitorsResult = await db.query(compareVisitorsQuery, compareVisitorsParams);

      const compareRevenueQuery = device && device !== 'all'
        ? `SELECT 
             COALESCE(SUM(c.total_amount), 0) as total_revenue,
             COALESCE(SUM(CASE WHEN c.final_payment > 0 THEN c.final_payment ELSE c.total_amount END), 0) as final_revenue,
             COUNT(*) as order_count
           FROM conversions c
           JOIN visitors v ON c.visitor_id = v.visitor_id
           WHERE c.timestamp >= $1 AND c.timestamp <= $2 AND v.device_type = $3`
        : `SELECT 
             COALESCE(SUM(total_amount), 0) as total_revenue,
             COALESCE(SUM(CASE WHEN final_payment > 0 THEN final_payment ELSE total_amount END), 0) as final_revenue,
             COUNT(*) as order_count
           FROM conversions
           WHERE timestamp >= $1 AND timestamp <= $2`;
      
      const compareRevenueResult = await db.query(compareRevenueQuery, compareVisitorsParams);

      const compareVisitors = parseInt(compareVisitorsResult.rows[0].count);
      const compareRevenue = parseInt(compareRevenueResult.rows[0].total_revenue);
      const compareFinalRevenue = parseInt(compareRevenueResult.rows[0].final_revenue);
      const compareOrders = parseInt(compareRevenueResult.rows[0].order_count);

      // Calculate change percentages
      const calculateChange = (current, previous) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return parseFloat((((current - previous) / previous) * 100).toFixed(2));
      };

      response.comparison = {
        period: {
          start: compareStartDate.toISOString(),
          end: compareEndDate.toISOString()
        },
        visitors: {
          previous: compareVisitors,
          change_percent: calculateChange(totalVisitors, compareVisitors)
        },
        revenue: {
          previous: compareRevenue,
          change_percent: calculateChange(totalRevenue, compareRevenue)
        },
        final_revenue: {
          previous: compareFinalRevenue,
          change_percent: calculateChange(finalRevenue, compareFinalRevenue)
        },
        orders: {
          previous: compareOrders,
          change_percent: calculateChange(orderCount, compareOrders)
        }
      };
    }

    res.json(response);
  } catch (error) {
    console.error('Stats range error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics for date range' });
  }
});

// GET /api/stats/daily - Daily statistics for chart
router.get('/daily', async (req, res) => {
  try {
    const { start, end, device } = req.query;
    
    if (!start || !end) {
      return res.status(400).json({ error: 'start and end dates are required (YYYY-MM-DD format)' });
    }

    const startDate = new Date(start);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    // 1. Daily visitors (with device filter)
    const dailyVisitorsQuery = device && device !== 'all'
      ? `SELECT 
           DATE(p.timestamp) as date,
           COUNT(DISTINCT p.visitor_id) as visitors
         FROM pageviews p
         JOIN visitors v ON p.visitor_id = v.visitor_id
         WHERE p.timestamp >= $1 AND p.timestamp <= $2 AND v.device_type = $3
         GROUP BY DATE(p.timestamp)
         ORDER BY date`
      : `SELECT 
           DATE(timestamp) as date,
           COUNT(DISTINCT visitor_id) as visitors
         FROM pageviews
         WHERE timestamp >= $1 AND timestamp <= $2
         GROUP BY DATE(timestamp)
         ORDER BY date`;
    
    const dailyParams = device && device !== 'all' 
      ? [startDate, endDate, device]
      : [startDate, endDate];
    
    const dailyVisitorsResult = await db.query(dailyVisitorsQuery, dailyParams);

    // 2. Daily pageviews (with device filter)
    const dailyPageviewsQuery = device && device !== 'all'
      ? `SELECT 
           DATE(p.timestamp) as date,
           COUNT(*) as pageviews
         FROM pageviews p
         JOIN visitors v ON p.visitor_id = v.visitor_id
         WHERE p.timestamp >= $1 AND p.timestamp <= $2 AND v.device_type = $3
         GROUP BY DATE(p.timestamp)
         ORDER BY date`
      : `SELECT 
           DATE(timestamp) as date,
           COUNT(*) as pageviews
         FROM pageviews
         WHERE timestamp >= $1 AND timestamp <= $2
         GROUP BY DATE(timestamp)
         ORDER BY date`;
    
    const dailyPageviewsResult = await db.query(dailyPageviewsQuery, dailyParams);

    // 3. Daily revenue and orders (with device filter)
    const dailyRevenueQuery = device && device !== 'all'
      ? `SELECT 
           DATE(c.timestamp) as date,
           COALESCE(SUM(c.total_amount), 0) as total_revenue,
           COALESCE(SUM(CASE WHEN c.final_payment > 0 THEN c.final_payment ELSE c.total_amount END), 0) as final_revenue,
           COUNT(*) as orders
         FROM conversions c
         JOIN visitors v ON c.visitor_id = v.visitor_id
         WHERE c.timestamp >= $1 AND c.timestamp <= $2 AND v.device_type = $3
         GROUP BY DATE(c.timestamp)
         ORDER BY date`
      : `SELECT 
           DATE(timestamp) as date,
           COALESCE(SUM(total_amount), 0) as total_revenue,
           COALESCE(SUM(CASE WHEN final_payment > 0 THEN final_payment ELSE total_amount END), 0) as final_revenue,
           COUNT(*) as orders
         FROM conversions
         WHERE timestamp >= $1 AND timestamp <= $2
         GROUP BY DATE(timestamp)
         ORDER BY date`;
    
    const dailyRevenueResult = await db.query(dailyRevenueQuery, dailyParams);

    // Merge data by date
    const dailyData = {};
    
    // Initialize with revenue data (most important)
    dailyRevenueResult.rows.forEach(row => {
      const dateStr = row.date.toISOString().split('T')[0];
      dailyData[dateStr] = {
        date: dateStr,
        revenue: parseInt(row.final_revenue),
        orders: parseInt(row.orders),
        visitors: 0,
        pageviews: 0
      };
    });

    // Add visitors
    dailyVisitorsResult.rows.forEach(row => {
      const dateStr = row.date.toISOString().split('T')[0];
      if (!dailyData[dateStr]) {
        dailyData[dateStr] = {
          date: dateStr,
          revenue: 0,
          orders: 0,
          visitors: 0,
          pageviews: 0
        };
      }
      dailyData[dateStr].visitors = parseInt(row.visitors);
    });

    // Add pageviews
    dailyPageviewsResult.rows.forEach(row => {
      const dateStr = row.date.toISOString().split('T')[0];
      if (!dailyData[dateStr]) {
        dailyData[dateStr] = {
          date: dateStr,
          revenue: 0,
          orders: 0,
          visitors: 0,
          pageviews: 0
        };
      }
      dailyData[dateStr].pageviews = parseInt(row.pageviews);
    });

    // Convert to array and fill missing dates
    const result = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      result.push(dailyData[dateStr] || {
        date: dateStr,
        revenue: 0,
        orders: 0,
        visitors: 0,
        pageviews: 0
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    res.json({
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      daily_data: result
    });
  } catch (error) {
    console.error('Stats daily error:', error);
    res.status(500).json({ error: 'Failed to fetch daily statistics' });
  }
});

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

// GET /api/stats/utm-performance - UTM campaign performance analysis (Phase 4.2)
router.get('/utm-performance', async (req, res) => {
  try {
    const { start, end, device } = req.query;
    
    if (!start || !end) {
      return res.status(400).json({ 
        error: 'start and end dates are required (YYYY-MM-DD format)' 
      });
    }

    const startDate = new Date(start);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    // Device filter setup
    const deviceFilter = device && device !== 'all' ? 'AND v.device_type = $3' : '';
    const params = device && device !== 'all' 
      ? [startDate, endDate, device] 
      : [startDate, endDate];

    // 1. UTM별 방문자, 세션, 주문, 매출 집계
    const utmQuery = `
      SELECT 
        v.utm_source,
        v.utm_medium,
        v.utm_campaign,
        COUNT(DISTINCT v.visitor_id) as visitors,
        COUNT(DISTINCT s.session_id) as sessions,
        COALESCE(SUM(CASE WHEN c.order_id IS NOT NULL THEN 1 ELSE 0 END), 0) as orders,
        COALESCE(SUM(CASE WHEN c.final_payment > 0 THEN c.final_payment ELSE c.total_amount END), 0) as revenue
      FROM visitors v
      LEFT JOIN sessions s ON v.visitor_id = s.visitor_id 
        AND s.start_time >= $1 AND s.start_time <= $2
      LEFT JOIN conversions c ON v.visitor_id = c.visitor_id 
        AND c.timestamp >= $1 AND c.timestamp <= $2
      WHERE v.utm_source IS NOT NULL 
        AND v.first_visit >= $1 AND v.first_visit <= $2
        ${deviceFilter}
      GROUP BY v.utm_source, v.utm_medium, v.utm_campaign
      ORDER BY revenue DESC
    `;

    const result = await db.query(utmQuery, params);

    // 2. 응답 데이터 가공
    const campaigns = result.rows.map(row => {
      const visitors = parseInt(row.visitors);
      const orders = parseInt(row.orders);
      const revenue = parseInt(row.revenue);

      return {
        utm_source: row.utm_source,
        utm_medium: row.utm_medium || '',
        utm_campaign: row.utm_campaign || '',
        visitors,
        sessions: parseInt(row.sessions),
        orders,
        revenue,
        conversion_rate: visitors > 0 
          ? parseFloat(((orders / visitors) * 100).toFixed(2))
          : 0,
        aov: orders > 0 
          ? Math.round(revenue / orders)
          : 0
      };
    });

    // 3. 전체 통계 (UTM 있는 것만)
    const totalStats = campaigns.reduce((acc, campaign) => ({
      visitors: acc.visitors + campaign.visitors,
      sessions: acc.sessions + campaign.sessions,
      orders: acc.orders + campaign.orders,
      revenue: acc.revenue + campaign.revenue
    }), { visitors: 0, sessions: 0, orders: 0, revenue: 0 });

    res.json({
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      campaigns,
      total: {
        ...totalStats,
        conversion_rate: totalStats.visitors > 0 
          ? parseFloat(((totalStats.orders / totalStats.visitors) * 100).toFixed(2))
          : 0,
        aov: totalStats.orders > 0 
          ? Math.round(totalStats.revenue / totalStats.orders)
          : 0
      }
    });
  } catch (error) {
    console.error('UTM performance error:', error);
    res.status(500).json({ error: 'Failed to fetch UTM performance data' });
  }
});

// GET /api/stats/utm-attribution - Multi-touch attribution analysis (Phase 4.4)
router.get('/utm-attribution', async (req, res) => {
  try {
    const { start, end, model = 'last_click' } = req.query;

    // Date range setup
    const startDate = start ? new Date(start) : new Date();
    const endDate = end ? new Date(end) : new Date();
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    // 1. Get all conversions with their visitor journey
    const conversionsQuery = `
      SELECT 
        c.order_id,
        c.visitor_id,
        c.final_payment,
        c.timestamp as conversion_time,
        json_agg(
          json_build_object(
            'utm_source', us.utm_source,
            'utm_medium', us.utm_medium,
            'utm_campaign', us.utm_campaign,
            'entry_timestamp', us.entry_timestamp,
            'duration_seconds', us.duration_seconds,
            'pageview_count', us.pageview_count,
            'sequence_order', us.sequence_order
          ) ORDER BY us.sequence_order
        ) as journey
      FROM conversions c
      JOIN utm_sessions us ON c.visitor_id = us.visitor_id
      WHERE c.timestamp >= $1 AND c.timestamp <= $2
        AND us.entry_timestamp <= c.timestamp
      GROUP BY c.order_id, c.visitor_id, c.final_payment, c.timestamp
      ORDER BY c.timestamp DESC
    `;

    const conversionsResult = await db.query(conversionsQuery, [startDate, endDate]);

    // 2. Calculate attribution based on selected model
    const attributionMap = new Map(); // key: "source:campaign", value: { revenue, count }

    for (const conversion of conversionsResult.rows) {
      const revenue = parseFloat(conversion.final_payment || 0);
      const journey = conversion.journey;

      if (!journey || journey.length === 0) continue;

      let attributions = [];

      switch (model) {
        case 'first_click':
          // First touch gets 100%
          attributions = [{
            key: `${journey[0].utm_source}:${journey[0].utm_campaign}`,
            source: journey[0].utm_source,
            campaign: journey[0].utm_campaign,
            weight: 1.0
          }];
          break;

        case 'last_click':
          // Last touch gets 100%
          const lastTouch = journey[journey.length - 1];
          attributions = [{
            key: `${lastTouch.utm_source}:${lastTouch.utm_campaign}`,
            source: lastTouch.utm_source,
            campaign: lastTouch.utm_campaign,
            weight: 1.0
          }];
          break;

        case 'linear':
          // Equal weight to all touches
          const linearWeight = 1.0 / journey.length;
          attributions = journey.map(touch => ({
            key: `${touch.utm_source}:${touch.utm_campaign}`,
            source: touch.utm_source,
            campaign: touch.utm_campaign,
            weight: linearWeight
          }));
          break;

        case 'time_decay':
          // Exponential decay: recent touches get higher weight
          // Formula: weight = 2^(position - 1) / sum(2^(i-1))
          const totalWeight = journey.reduce((sum, _, idx) => sum + Math.pow(2, idx), 0);
          attributions = journey.map((touch, idx) => ({
            key: `${touch.utm_source}:${touch.utm_campaign}`,
            source: touch.utm_source,
            campaign: touch.utm_campaign,
            weight: Math.pow(2, idx) / totalWeight
          }));
          break;

        case 'duration_based':
          // Weight based on duration spent in each UTM session
          const totalDuration = journey.reduce((sum, touch) => sum + (touch.duration_seconds || 0), 0);
          if (totalDuration === 0) {
            // Fallback to linear if no duration data
            const fallbackWeight = 1.0 / journey.length;
            attributions = journey.map(touch => ({
              key: `${touch.utm_source}:${touch.utm_campaign}`,
              source: touch.utm_source,
              campaign: touch.utm_campaign,
              weight: fallbackWeight
            }));
          } else {
            attributions = journey.map(touch => ({
              key: `${touch.utm_source}:${touch.utm_campaign}`,
              source: touch.utm_source,
              campaign: touch.utm_campaign,
              weight: (touch.duration_seconds || 0) / totalDuration
            }));
          }
          break;

        default:
          // Default to last_click
          const defaultTouch = journey[journey.length - 1];
          attributions = [{
            key: `${defaultTouch.utm_source}:${defaultTouch.utm_campaign}`,
            source: defaultTouch.utm_source,
            campaign: defaultTouch.utm_campaign,
            weight: 1.0
          }];
      }

      // Aggregate attribution
      for (const attr of attributions) {
        if (!attributionMap.has(attr.key)) {
          attributionMap.set(attr.key, {
            utm_source: attr.source,
            utm_campaign: attr.campaign,
            revenue: 0,
            orders: 0
          });
        }
        const current = attributionMap.get(attr.key);
        current.revenue += revenue * attr.weight;
        current.orders += attr.weight;
      }
    }

    // 3. Format results
    const results = Array.from(attributionMap.values())
      .map(item => ({
        utm_source: item.utm_source,
        utm_campaign: item.utm_campaign,
        revenue: Math.round(item.revenue),
        orders: parseFloat(item.orders.toFixed(2)),
        avg_order_value: item.orders > 0 ? Math.round(item.revenue / item.orders) : 0
      }))
      .sort((a, b) => b.revenue - a.revenue);

    res.json({
      model,
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      total_conversions: conversionsResult.rows.length,
      attributions: results,
      total_revenue: results.reduce((sum, r) => sum + r.revenue, 0)
    });
  } catch (error) {
    console.error('UTM attribution error:', error);
    res.status(500).json({ error: 'Failed to calculate attribution' });
  }
});

// ============================================================================
// Step 2: Orders List API (주문 목록)
// ============================================================================

// GET /api/stats/orders - Get paginated orders list
router.get('/orders', async (req, res) => {
  try {
    const { start, end, device = 'all', limit = 100, offset = 0 } = req.query;

    if (!start || !end) {
      return res.status(400).json({ error: 'start and end dates are required (YYYY-MM-DD)' });
    }

    // Parse dates
    const startDate = new Date(start);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    // Build device filter
    let deviceFilter = '';
    let queryParams = [startDate, endDate];
    let paramIndex = 3;

    if (device !== 'all') {
      deviceFilter = `AND v.device_type = $${paramIndex}`;
      queryParams.push(device);
      paramIndex++;
    }

    queryParams.push(parseInt(limit), parseInt(offset));

    // Main query: Get orders with all necessary info
    const ordersQuery = `
      SELECT 
        c.order_id,
        c.timestamp,
        c.final_payment,
        c.total_amount,
        c.product_count,
        c.visitor_id,
        c.session_id,
        s.ip_address,
        v.device_type,
        -- UTM 데이터: utm_sessions 우선, 없으면 visitors 테이블 사용
        COALESCE(
          (SELECT us.utm_source FROM utm_sessions us 
           WHERE us.visitor_id = c.visitor_id 
           ORDER BY us.entry_timestamp DESC LIMIT 1),
          v.utm_source
        ) as utm_source,
        COALESCE(
          (SELECT us.utm_campaign FROM utm_sessions us 
           WHERE us.visitor_id = c.visitor_id 
           ORDER BY us.entry_timestamp DESC LIMIT 1),
          v.utm_campaign
        ) as utm_campaign,
        -- 상품명: conversions.product_name 우선, 없으면 events에서 조회
        COALESCE(
          c.product_name,
          (
            SELECT e.product_name 
            FROM events e 
            WHERE e.visitor_id = c.visitor_id 
              AND e.event_type = 'purchase' 
              AND e.timestamp <= c.timestamp 
            ORDER BY e.timestamp DESC 
            LIMIT 1
          )
        ) as product_name
      FROM conversions c
      LEFT JOIN sessions s ON c.session_id = s.session_id
      LEFT JOIN visitors v ON c.visitor_id = v.visitor_id
      WHERE c.timestamp BETWEEN $1 AND $2
        ${deviceFilter}
      ORDER BY c.timestamp DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const ordersResult = await db.query(ordersQuery, queryParams);

    // Count total orders for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM conversions c
      LEFT JOIN visitors v ON c.visitor_id = v.visitor_id
      WHERE c.timestamp BETWEEN $1 AND $2
        ${deviceFilter}
    `;

    const countParams = device !== 'all' ? [startDate, endDate, device] : [startDate, endDate];
    const countResult = await db.query(countQuery, countParams);

    // 기본 주문 데이터 매핑
    let orders = ordersResult.rows.map(row => ({
      order_id: row.order_id,
      timestamp: row.timestamp,
      final_payment: parseInt(row.final_payment) || 0,
      total_amount: parseInt(row.total_amount) || 0,
      product_count: parseInt(row.product_count) || 1,
      product_name: row.product_name || null,
      visitor_id: row.visitor_id,
      session_id: row.session_id,
      ip_address: row.ip_address || null,
      device_type: row.device_type || null,
      utm_source: row.utm_source || null,
      utm_campaign: row.utm_campaign || null,
      is_cafe24_only: !row.visitor_id || row.visitor_id === ''
    }));
    
    // 최종 매핑 (상품명/IP/디바이스 기본값 설정)
    orders = orders.map(order => ({
      ...order,
      product_name: order.product_name || '상품명 없음',
      ip_address: order.ip_address || (order.is_cafe24_only ? 'API 동기화' : 'unknown'),
      device_type: order.device_type || (order.is_cafe24_only ? 'API 동기화' : 'unknown')
    }));

    res.json({
      period: {
        start: start,
        end: end
      },
      device_filter: device,
      total_orders: parseInt(countResult.rows[0].total),
      orders: orders,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: parseInt(offset) + ordersResult.rows.length < parseInt(countResult.rows[0].total)
      }
    });

  } catch (error) {
    console.error('Orders list error:', error);
    res.status(500).json({ error: 'Failed to fetch orders list' });
  }
});

// GET /api/stats/order-detail/:orderId - Detailed customer journey for a specific order
router.get('/order-detail/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    // 1. 주문 기본 정보
    const orderQuery = `
      SELECT
        c.order_id,
        c.timestamp,
        c.final_payment,
        c.total_amount,
        c.product_count,
        c.visitor_id,
        c.session_id,
        s.ip_address,
        s.entry_url,
        v.device_type,
        v.browser,
        v.os,
        v.utm_source,
        v.utm_medium,
        v.utm_campaign,
        v.first_visit,
        (
          SELECT e.product_name
          FROM events e
          WHERE e.visitor_id = c.visitor_id
            AND e.event_type = 'purchase'
            AND e.timestamp <= c.timestamp
          ORDER BY e.timestamp DESC
          LIMIT 1
        ) as product_name
      FROM conversions c
      LEFT JOIN sessions s ON c.session_id = s.session_id
      LEFT JOIN visitors v ON c.visitor_id = v.visitor_id
      WHERE c.order_id = $1
    `;
    const orderResult = await db.query(orderQuery, [orderId]);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];
    
    // Cafe24 API sync 주문 (visitor_id 없거나 빈 문자열) 처리
    const isExternalPayment = !order.visitor_id || order.visitor_id === '';
    
    if (isExternalPayment) {
      // Cafe24 API에서 주문 상세 정보 가져오기
      let cafe24Order = null;
      if (process.env.CAFE24_AUTH_KEY) {
        try {
          const cafe24 = require('./cafe24');
          const cafe24Client = require('../utils/cafe24');
          const detail = await cafe24Client.getOrderDetail(orderId);
          cafe24Order = detail.order;
        } catch (e) {
          console.error('[Order Detail] Cafe24 API error:', e.message);
        }
      }
      
      // 외부 결제 주문 응답 (고객 여정 데이터 없음)
      return res.json({
        order: {
          order_id: order.order_id,
          timestamp: order.timestamp,
          final_payment: parseInt(order.final_payment) || 0,
          total_amount: parseInt(order.total_amount) || 0,
          product_count: parseInt(order.product_count) || 1,
          product_name: cafe24Order?.items?.[0]?.product_name || '상품명 없음',
          device_type: 'API 동기화',
          browser: '-',
          os: '-',
          ip_address: 'API 동기화',
          billing_name: cafe24Order?.billing_name || '-',
          payment_method: cafe24Order?.payment_method_name || 'API 동기화',
          order_items: cafe24Order?.items?.map(item => ({
            product_name: item.product_name,
            product_price: item.product_price,
            quantity: item.quantity,
            option_value: item.option_value
          })) || []
        },
        is_external_payment: true,
        message: '외부 결제(네이버페이, 카카오페이 등)로 결제된 주문입니다. 고객 여정 데이터가 없습니다.',
        purchase_journey: [],
        full_journey: [],
        utm_sessions: [],
        pageview_count: 0,
        total_events: 0
      });
    }

    // 2-1. 구매 직전 경로 (마지막 UTM 접촉 이후 ~ 구매까지)
    // 광고 효과 측정에 사용되는 핵심 경로
    const purchaseJourneyQuery = `
      WITH last_utm_contact AS (
        SELECT MAX(entry_timestamp) as utm_timestamp
        FROM utm_sessions
        WHERE visitor_id = $1
      ),
      purchase_journey_pages AS (
        SELECT
          p.page_url,
          p.page_title,
          p.timestamp,
          LEAD(p.timestamp) OVER (ORDER BY p.timestamp) as next_timestamp
        FROM pageviews p
        CROSS JOIN last_utm_contact
        WHERE p.visitor_id = $1
          AND p.timestamp >= COALESCE(last_utm_contact.utm_timestamp, p.timestamp)
          AND p.timestamp <= $2
        ORDER BY p.timestamp ASC
      )
      SELECT
        page_url,
        page_title,
        timestamp,
        CASE
          WHEN next_timestamp IS NOT NULL THEN
            LEAST(
              EXTRACT(EPOCH FROM (next_timestamp - timestamp))::INTEGER,
              600  -- 최대 10분으로 제한
            )
          ELSE 0
        END as time_spent_seconds
      FROM purchase_journey_pages
    `;
    const purchaseJourneyResult = await db.query(purchaseJourneyQuery, [order.visitor_id, order.timestamp]);

    // 2-2. 과거 방문 이력 (마지막 UTM 접촉 이전)
    // 고객이 이전에 어떤 페이지를 봤는지 참고용
    const previousVisitsQuery = `
      WITH last_utm_contact AS (
        SELECT MAX(entry_timestamp) as utm_timestamp
        FROM utm_sessions
        WHERE visitor_id = $1
      ),
      previous_pageviews AS (
        SELECT
          p.page_url,
          p.page_title,
          p.timestamp,
          DATE(p.timestamp) as visit_date,
          LEAD(p.timestamp) OVER (PARTITION BY DATE(p.timestamp) ORDER BY p.timestamp) as next_timestamp
        FROM pageviews p
        CROSS JOIN last_utm_contact
        WHERE p.visitor_id = $1
          AND p.timestamp < COALESCE(last_utm_contact.utm_timestamp, $2::timestamp)
          AND DATE(p.timestamp) < DATE($2)
      )
      SELECT
        visit_date,
        page_url,
        page_title,
        timestamp,
        CASE
          WHEN next_timestamp IS NOT NULL THEN
            LEAST(
              EXTRACT(EPOCH FROM (next_timestamp - timestamp))::INTEGER,
              600
            )
          ELSE 0
        END as time_spent_seconds
      FROM previous_pageviews
      ORDER BY timestamp ASC
    `;
    const previousVisitsResult = await db.query(previousVisitsQuery, [order.visitor_id, order.timestamp]);

    // 3. 동일 쿠키 UTM 히스토리 (동일 visitor_id의 모든 UTM 세션)
    // utm_params에서 누락된 값 복구 + 같은 광고 소재 병합 (5분 이내)
    const utmHistoryQuery = `
      WITH enriched_utm AS (
        -- Step 1: utm_params에서 누락된 값 복구
        SELECT
          id,
          visitor_id,
          COALESCE(utm_source, utm_params->>'utm_source', 'direct') as utm_source,
          COALESCE(utm_medium, utm_params->>'utm_medium') as utm_medium,
          COALESCE(utm_campaign, utm_params->>'utm_campaign') as utm_campaign,
          utm_params->>'utm_content' as utm_content,
          entry_timestamp,
          exit_timestamp,
          duration_seconds,
          sequence_order
        FROM utm_sessions
        WHERE visitor_id = $1
      ),
      with_gaps AS (
        -- Step 2: 이전 세션과의 간격 계산
        SELECT
          eu.*,
          LAG(eu.exit_timestamp) OVER (
            PARTITION BY eu.utm_content
            ORDER BY eu.entry_timestamp
          ) as prev_exit_timestamp
        FROM enriched_utm eu
      ),
      with_group_flags AS (
        -- Step 3: 새 그룹 시작 플래그 계산
        SELECT
          *,
          CASE 
            WHEN prev_exit_timestamp IS NULL THEN 1
            WHEN EXTRACT(EPOCH FROM (entry_timestamp - prev_exit_timestamp)) > 300 THEN 1
            ELSE 0
          END as is_new_group
        FROM with_gaps
      ),
      grouped_sessions AS (
        -- Step 4: 그룹 번호 생성
        SELECT
          *,
          SUM(is_new_group) OVER (
            PARTITION BY utm_content
            ORDER BY entry_timestamp
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
          ) as session_group
        FROM with_group_flags
      ),
      merged_sessions AS (
        -- Step 5: 그룹별로 병합
        SELECT
          MIN(utm_source) as utm_source,
          MIN(utm_medium) as utm_medium,
          MIN(utm_campaign) as utm_campaign,
          MIN(utm_content) as utm_content,
          MIN(entry_timestamp) as entry_timestamp,
          MAX(exit_timestamp) as exit_timestamp,
          SUM(duration_seconds) as total_duration_seconds,
          MIN(sequence_order) as original_sequence_order
        FROM grouped_sessions
        GROUP BY utm_content, session_group
      )
      SELECT
        utm_source,
        utm_medium,
        utm_campaign,
        utm_content,
        entry_timestamp,
        total_duration_seconds as duration_seconds
      FROM merged_sessions
      ORDER BY entry_timestamp ASC
    `;
    const utmHistoryResult = await db.query(utmHistoryQuery, [order.visitor_id]);

    // 4. 동일 IP 방문 기록 (동일 IP의 과거 세션들)
    let sameIpVisits = [];
    if (order.ip_address && order.ip_address !== 'unknown') {
      const sameIpQuery = `
        SELECT
          s.session_id,
          s.start_time,
          s.entry_url,
          s.pageview_count,
          v.visitor_id,
          v.utm_source,
          v.utm_medium,
          v.utm_campaign,
          v.device_type,
          CASE
            WHEN EXISTS (
              SELECT 1 FROM conversions c WHERE c.session_id = s.session_id
            ) THEN true
            ELSE false
          END as has_purchase
        FROM sessions s
        LEFT JOIN visitors v ON s.visitor_id = v.visitor_id
        WHERE s.ip_address = $1
          AND s.session_id != $2
        ORDER BY s.start_time DESC
        LIMIT 20
      `;
      const sameIpResult = await db.query(sameIpQuery, [order.ip_address, order.session_id]);
      sameIpVisits = sameIpResult.rows;
    }

    // 5. 과거 구매 이력 (동일 visitor_id의 과거 주문들)
    const pastPurchasesQuery = `
      SELECT
        c.order_id,
        c.timestamp,
        c.final_payment,
        c.product_count,
        (
          SELECT e.product_name
          FROM events e
          WHERE e.visitor_id = c.visitor_id
            AND e.event_type = 'purchase'
            AND e.timestamp <= c.timestamp
          ORDER BY e.timestamp DESC
          LIMIT 1
        ) as product_name
      FROM conversions c
      WHERE c.visitor_id = $1
        AND c.order_id != $2
      ORDER BY c.timestamp DESC
      LIMIT 10
    `;
    const pastPurchasesResult = await db.query(pastPurchasesQuery, [order.visitor_id, orderId]);

    // 과거 방문을 날짜별로 그룹화
    const previousVisitsByDate = {};
    previousVisitsResult.rows.forEach(row => {
      const date = row.visit_date.toISOString().split('T')[0]; // YYYY-MM-DD
      if (!previousVisitsByDate[date]) {
        previousVisitsByDate[date] = [];
      }
      previousVisitsByDate[date].push({
        page_url: row.page_url,
        clean_url: cleanUrl(row.page_url),
        page_title: row.page_title || null,
        timestamp: row.timestamp,
        time_spent_seconds: row.time_spent_seconds || 0
      });
    });

    // 응답 데이터 구성
    res.json({
      order: {
        order_id: order.order_id,
        timestamp: order.timestamp,
        final_payment: order.final_payment,
        total_amount: order.total_amount,
        product_count: order.product_count,
        product_name: order.product_name,
        visitor_id: order.visitor_id,
        session_id: order.session_id,
        ip_address: order.ip_address || 'unknown',
        device_type: order.device_type || 'unknown',
        browser: order.browser || 'unknown',
        os: order.os || 'unknown',
        utm_source: order.utm_source || null,
        utm_medium: order.utm_medium || null,
        utm_campaign: order.utm_campaign || null,
        first_visit: order.first_visit,
        entry_url: order.entry_url || null
      },
      // 구매 직전 경로 (광고 클릭 후)
      purchase_journey: {
        pages: purchaseJourneyResult.rows.map(row => ({
          page_url: row.page_url,
          clean_url: cleanUrl(row.page_url),
          page_title: row.page_title || null,
          timestamp: row.timestamp,
          time_spent_seconds: row.time_spent_seconds || 0
        })),
        total_duration: purchaseJourneyResult.rows.reduce((sum, row) => sum + (row.time_spent_seconds || 0), 0),
        page_count: purchaseJourneyResult.rows.length
      },
      // 과거 방문 이력 (날짜별)
      previous_visits: Object.entries(previousVisitsByDate).map(([date, pages]) => ({
        date: date,
        pages: pages,
        total_duration: pages.reduce((sum, p) => sum + p.time_spent_seconds, 0),
        page_count: pages.length
      })).sort((a, b) => a.date.localeCompare(b.date)),
      // 기존 호환성 유지 (deprecated)
      page_path: purchaseJourneyResult.rows.map(row => ({
        page_url: row.page_url,
        clean_url: cleanUrl(row.page_url),
        page_title: row.page_title || null,
        timestamp: row.timestamp,
        time_spent_seconds: row.time_spent_seconds || 0
      })),
      utm_history: utmHistoryResult.rows.map(row => ({
        utm_source: row.utm_source || 'direct',
        utm_medium: row.utm_medium || null,
        utm_campaign: row.utm_campaign || null,
        utm_content: row.utm_content || null,
        entry_time: row.entry_timestamp,
        total_duration: row.duration_seconds || 0
      })),
      same_ip_visits: sameIpVisits.map(row => ({
        session_id: row.session_id,
        start_time: row.start_time,
        entry_url: row.entry_url,
        pageview_count: row.pageview_count || 0,
        visitor_id: row.visitor_id,
        utm_source: row.utm_source || null,
        utm_campaign: row.utm_campaign || null,
        device_type: row.device_type || 'unknown',
        has_purchase: row.has_purchase
      })),
      past_purchases: pastPurchasesResult.rows.map(row => ({
        order_id: row.order_id,
        timestamp: row.timestamp,
        final_payment: row.final_payment,
        product_count: row.product_count,
        product_name: row.product_name
      }))
    });

  } catch (error) {
    console.error('Order detail error:', error);
    res.status(500).json({ error: 'Failed to fetch order detail' });
  }
});

// ============================================================================
// Phase 2: Dynamic UTM Filter Support APIs
// ============================================================================

/**
 * GET /api/stats/utm-keys
 * 실제 수집된 모든 UTM 키 목록 반환
 * Query params:
 *  - table: 'visitors' | 'sessions' | 'utm_sessions' | 'conversions' (default: 'visitors')
 */
router.get('/utm-keys', async (req, res) => {
  try {
    const { table = 'visitors' } = req.query;
    
    // Phase 6-5: 테이블 이름 정규화 (하이픈 → 언더스코어)
    // 예: 'utm-sessions' → 'utm_sessions'
    const normalizedTable = table.replace(/-/g, '_');
    
    // 허용된 테이블만 조회 (SQL Injection 방지)
    const allowedTables = ['visitors', 'sessions', 'utm_sessions', 'conversions'];
    if (!allowedTables.includes(normalizedTable)) {
      return res.status(400).json({ error: 'Invalid table parameter' });
    }
    
    // JSONB에서 모든 키 추출
    const result = await db.query(`
      SELECT DISTINCT jsonb_object_keys(utm_params) as utm_key
      FROM ${normalizedTable}
      WHERE utm_params IS NOT NULL
      ORDER BY utm_key
    `);
    
    const keys = result.rows.map(r => r.utm_key);
    
    res.json({ 
      table: normalizedTable,
      keys,
      count: keys.length
    });
  } catch (error) {
    // utm_params 컬럼이 없는 테이블의 경우 빈 배열 반환 (graceful degradation)
    console.error('[UTM-KEYS] 조회 실패 (테이블: ' + (req.query.table || 'visitors') + '):', error.message);
    
    // 컬럼 없음 에러인 경우 빈 배열 반환
    if (error.message && error.message.includes('utm_params')) {
      return res.json({ 
        table: req.query.table ? req.query.table.replace(/-/g, '_') : 'visitors',
        keys: [],
        count: 0
      });
    }
    
    // 기타 에러는 500 반환
    res.status(500).json({ error: 'Failed to fetch UTM keys' });
  }
});

/**
 * GET /api/stats/utm-values
 * 특정 UTM 키의 고유 값 목록 반환
 * Query params:
 *  - key: UTM 키 (required, 예: utm_content)
 *  - table: 'visitors' | 'sessions' | 'utm_sessions' | 'conversions' (default: 'visitors')
 */
router.get('/utm-values', async (req, res) => {
  try {
    const { key, table = 'visitors' } = req.query;
    
    if (!key) {
      return res.status(400).json({ error: 'key parameter is required' });
    }
    
    // Phase 6-5: 테이블 이름 정규화 (하이픈 → 언더스코어)
    // 예: 'utm-sessions' → 'utm_sessions'
    const normalizedTable = table.replace(/-/g, '_');
    
    // 허용된 테이블만 조회 (SQL Injection 방지)
    const allowedTables = ['visitors', 'sessions', 'utm_sessions', 'conversions'];
    if (!allowedTables.includes(normalizedTable)) {
      return res.status(400).json({ error: 'Invalid table parameter' });
    }
    
    // 키 이름 검증 (SQL Injection 방지)
    if (!/^utm_[a-z_]+$/.test(key)) {
      return res.status(400).json({ error: 'Invalid key format. Must be utm_* format' });
    }
    
    // JSONB에서 특정 키의 모든 값 추출 (카운트 포함)
    const result = await db.query(`
      SELECT 
        utm_params->>'${key}' as value, 
        COUNT(*) as count
      FROM ${normalizedTable}
      WHERE utm_params->>'${key}' IS NOT NULL
      GROUP BY value
      ORDER BY count DESC, value
      LIMIT 100
    `);
    
    const values = result.rows.map(r => ({
      value: r.value,
      count: parseInt(r.count)
    }));
    
    res.json({ 
      table: normalizedTable,
      key,
      values,
      total: values.length
    });
  } catch (error) {
    // utm_params 컬럼이 없는 테이블의 경우 빈 배열 반환 (graceful degradation)
    console.error('[UTM-VALUES] 조회 실패 (테이블: ' + (req.query.table || 'visitors') + ', 키: ' + req.query.key + '):', error.message);
    
    // 컬럼 없음 에러인 경우 빈 배열 반환
    if (error.message && error.message.includes('utm_params')) {
      return res.json({ 
        table: req.query.table ? req.query.table.replace(/-/g, '_') : 'visitors',
        key: req.query.key,
        values: [],
        total: 0
      });
    }
    
    // 기타 에러는 500 반환
    res.status(500).json({ error: 'Failed to fetch UTM values' });
  }
});

module.exports = router;

