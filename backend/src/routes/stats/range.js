const express = require('express');
const router = express.Router();
const db = require('../../utils/database');
const { cleanUrl } = require('../../utils/urlCleaner');

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
    // 정상 주문만 집계: paid='T' AND canceled='F' AND order_status='confirmed' AND 금액 > 0
    const revenueQuery = device && device !== 'all'
      ? `SELECT
           COALESCE(SUM(c.total_amount), 0) as total_revenue,
           COALESCE(SUM(c.final_payment), 0) as final_revenue,
           COALESCE(SUM(c.discount_amount), 0) as total_discount,
           COALESCE(SUM(c.mileage_used), 0) as total_mileage,
           COALESCE(SUM(c.shipping_fee), 0) as total_shipping,
           COUNT(*) as order_count
         FROM conversions c
         JOIN visitors v ON c.visitor_id = v.visitor_id
         WHERE c.timestamp >= $1 AND c.timestamp <= $2 AND v.device_type = $3
           AND c.paid = 'T' AND (c.canceled = 'F' OR c.canceled IS NULL)
           AND (c.order_status = 'confirmed' OR c.order_status IS NULL)
           AND (c.final_payment > 0 OR c.total_amount > 0)`
      : `SELECT
           COALESCE(SUM(total_amount), 0) as total_revenue,
           COALESCE(SUM(final_payment), 0) as final_revenue,
           COALESCE(SUM(discount_amount), 0) as total_discount,
           COALESCE(SUM(mileage_used), 0) as total_mileage,
           COALESCE(SUM(shipping_fee), 0) as total_shipping,
           COUNT(*) as order_count
         FROM conversions
         WHERE timestamp >= $1 AND timestamp <= $2
           AND paid = 'T' AND (canceled = 'F' OR canceled IS NULL)
           AND (order_status = 'confirmed' OR order_status IS NULL)
           AND (final_payment > 0 OR total_amount > 0)`;

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

      // 비교 기간도 정상 주문만 집계 (환불 제외, 금액 > 0)
      const compareRevenueQuery = device && device !== 'all'
        ? `SELECT
             COALESCE(SUM(c.total_amount), 0) as total_revenue,
             COALESCE(SUM(c.final_payment), 0) as final_revenue,
             COUNT(*) as order_count
           FROM conversions c
           JOIN visitors v ON c.visitor_id = v.visitor_id
           WHERE c.timestamp >= $1 AND c.timestamp <= $2 AND v.device_type = $3
             AND c.paid = 'T' AND (c.canceled = 'F' OR c.canceled IS NULL)
             AND (c.order_status = 'confirmed' OR c.order_status IS NULL)
             AND (c.final_payment > 0 OR c.total_amount > 0)`
        : `SELECT
             COALESCE(SUM(total_amount), 0) as total_revenue,
             COALESCE(SUM(final_payment), 0) as final_revenue,
             COUNT(*) as order_count
           FROM conversions
           WHERE timestamp >= $1 AND timestamp <= $2
             AND paid = 'T' AND (canceled = 'F' OR canceled IS NULL)
             AND (order_status = 'confirmed' OR order_status IS NULL)
             AND (final_payment > 0 OR total_amount > 0)`;

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
    // NOTE: DB의 timestamp는 KST 값으로 저장됨 - 타임존 변환 불필요
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
    // NOTE: DB의 timestamp는 KST 값으로 저장됨 - 타임존 변환 불필요
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
    // NOTE: DB의 timestamp는 KST 값으로 저장됨 - 타임존 변환 불필요
    // 정상 주문만 집계: paid='T' AND canceled='F' AND order_status='confirmed' AND 금액 > 0
    const dailyRevenueQuery = device && device !== 'all'
      ? `SELECT
           DATE(c.timestamp) as date,
           COALESCE(SUM(c.total_amount), 0) as total_revenue,
           COALESCE(SUM(c.final_payment), 0) as final_revenue,
           COUNT(*) as orders
         FROM conversions c
         JOIN visitors v ON c.visitor_id = v.visitor_id
         WHERE c.timestamp >= $1 AND c.timestamp <= $2 AND v.device_type = $3
           AND c.paid = 'T' AND (c.canceled = 'F' OR c.canceled IS NULL)
           AND (c.order_status = 'confirmed' OR c.order_status IS NULL)
           AND (c.final_payment > 0 OR c.total_amount > 0)
         GROUP BY DATE(c.timestamp)
         ORDER BY date`
      : `SELECT
           DATE(timestamp) as date,
           COALESCE(SUM(total_amount), 0) as total_revenue,
           COALESCE(SUM(final_payment), 0) as final_revenue,
           COUNT(*) as orders
         FROM conversions
         WHERE timestamp >= $1 AND timestamp <= $2
           AND paid = 'T' AND (canceled = 'F' OR canceled IS NULL)
           AND (order_status = 'confirmed' OR order_status IS NULL)
           AND (final_payment > 0 OR total_amount > 0)
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

module.exports = router;
