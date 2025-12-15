const express = require('express');
const router = express.Router();
const db = require('../../utils/database');

/**
 * GET /api/stats/customer-type
 * 신규 고객 vs 재구매 고객 분석
 * 
 * Query params:
 * - start: 시작일 (YYYY-MM-DD)
 * - end: 종료일 (YYYY-MM-DD)
 * - device: 디바이스 필터 (optional: 'all', 'pc', 'mobile')
 * - compare: 비교 기간 포함 여부 (optional: 'true' | 'false')
 */
router.get('/customer-type', async (req, res) => {
  try {
    const { start, end, device = 'all', compare = 'false' } = req.query;
    
    if (!start || !end) {
      return res.status(400).json({ 
        error: 'start and end dates are required (YYYY-MM-DD format)' 
      });
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

    const queryParams = device && device !== 'all'
      ? [startDate, endDate, device]
      : [startDate, endDate];

    // ============================================================================
    // 1. 신규 고객 통계 (해당 기간에 첫 구매)
    // - Cafe24 first_order='T' 우선, 없으면 visitor_id 기반 계산
    // ============================================================================
    const newCustomersQuery = device && device !== 'all'
      ? `SELECT 
           COUNT(DISTINCT c.visitor_id) as customer_count,
           COUNT(*) as order_count,
           COALESCE(SUM(c.final_payment), 0) as total_revenue,
           CASE 
             WHEN COUNT(*) > 0 THEN COALESCE(AVG(c.final_payment), 0)
             ELSE 0
           END as avg_order_value
         FROM conversions c
         JOIN visitors v ON c.visitor_id = v.visitor_id
         WHERE c.timestamp >= $1 AND c.timestamp <= $2
           AND v.device_type = $3
           AND c.paid = 'T' 
           AND (c.canceled = 'F' OR c.canceled IS NULL)
           AND (c.order_status = 'confirmed' OR c.order_status IS NULL)
           AND (c.final_payment > 0 OR c.total_amount > 0)
           AND c.visitor_id IS NOT NULL
           AND (
             c.first_order = 'T'
             OR (
               c.first_order IS NULL 
               AND NOT EXISTS (
                 SELECT 1 FROM conversions c2 
                 WHERE c2.visitor_id = c.visitor_id 
                   AND c2.timestamp < c.timestamp
                   AND c2.paid = 'T'
                   AND (c2.final_payment > 0 OR c2.total_amount > 0)
               )
             )
           )`
      : `SELECT 
           COUNT(DISTINCT visitor_id) as customer_count,
           COUNT(*) as order_count,
           COALESCE(SUM(final_payment), 0) as total_revenue,
           CASE 
             WHEN COUNT(*) > 0 THEN COALESCE(AVG(final_payment), 0)
             ELSE 0
           END as avg_order_value
         FROM conversions
         WHERE timestamp >= $1 AND timestamp <= $2
           AND paid = 'T' 
           AND (canceled = 'F' OR canceled IS NULL)
           AND (order_status = 'confirmed' OR order_status IS NULL)
           AND (final_payment > 0 OR total_amount > 0)
           AND visitor_id IS NOT NULL
           AND (
             first_order = 'T'
             OR (
               first_order IS NULL 
               AND NOT EXISTS (
                 SELECT 1 FROM conversions c2 
                 WHERE c2.visitor_id = conversions.visitor_id 
                   AND c2.timestamp < conversions.timestamp
                   AND c2.paid = 'T'
                   AND (c2.final_payment > 0 OR c2.total_amount > 0)
               )
             )
           )`;

    const newCustomersResult = await db.query(newCustomersQuery, queryParams);

    // ============================================================================
    // 2. 재구매 고객 통계 (이전 구매 이력 있음)
    // - Cafe24 first_order='F' 우선, 없으면 visitor_id 기반 계산
    // ============================================================================
    const returningCustomersQuery = device && device !== 'all'
      ? `SELECT 
           COUNT(DISTINCT c.visitor_id) as customer_count,
           COUNT(*) as order_count,
           COALESCE(SUM(c.final_payment), 0) as total_revenue,
           CASE 
             WHEN COUNT(*) > 0 THEN COALESCE(AVG(c.final_payment), 0)
             ELSE 0
           END as avg_order_value
         FROM conversions c
         JOIN visitors v ON c.visitor_id = v.visitor_id
         WHERE c.timestamp >= $1 AND c.timestamp <= $2
           AND v.device_type = $3
           AND c.paid = 'T' 
           AND (c.canceled = 'F' OR c.canceled IS NULL)
           AND (c.order_status = 'confirmed' OR c.order_status IS NULL)
           AND (c.final_payment > 0 OR c.total_amount > 0)
           AND c.visitor_id IS NOT NULL
           AND (
             c.first_order = 'F'
             OR (
               c.first_order IS NULL 
               AND EXISTS (
                 SELECT 1 FROM conversions c2 
                 WHERE c2.visitor_id = c.visitor_id 
                   AND c2.timestamp < c.timestamp
                   AND c2.paid = 'T'
                   AND (c2.final_payment > 0 OR c2.total_amount > 0)
               )
             )
           )`
      : `SELECT 
           COUNT(DISTINCT visitor_id) as customer_count,
           COUNT(*) as order_count,
           COALESCE(SUM(final_payment), 0) as total_revenue,
           CASE 
             WHEN COUNT(*) > 0 THEN COALESCE(AVG(final_payment), 0)
             ELSE 0
           END as avg_order_value
         FROM conversions
         WHERE timestamp >= $1 AND timestamp <= $2
           AND paid = 'T' 
           AND (canceled = 'F' OR canceled IS NULL)
           AND (order_status = 'confirmed' OR order_status IS NULL)
           AND (final_payment > 0 OR total_amount > 0)
           AND visitor_id IS NOT NULL
           AND (
             first_order = 'F'
             OR (
               first_order IS NULL 
               AND EXISTS (
                 SELECT 1 FROM conversions c2 
                 WHERE c2.visitor_id = conversions.visitor_id 
                   AND c2.timestamp < conversions.timestamp
                   AND c2.paid = 'T'
                   AND (c2.final_payment > 0 OR c2.total_amount > 0)
               )
             )
           )`;

    const returningCustomersResult = await db.query(returningCustomersQuery, queryParams);

    // ============================================================================
    // 3. 결과 데이터 가공
    // ============================================================================
    const newCustomers = newCustomersResult.rows[0];
    const returningCustomers = returningCustomersResult.rows[0];

    const newRevenue = parseInt(newCustomers.total_revenue);
    const returningRevenue = parseInt(returningCustomers.total_revenue);
    const totalRevenue = newRevenue + returningRevenue;

    const response = {
      period: {
        start: start,
        end: end
      },
      device_filter: device,
      new_customers: {
        count: parseInt(newCustomers.customer_count),
        orders: parseInt(newCustomers.order_count),
        revenue: newRevenue,
        aov: Math.round(parseFloat(newCustomers.avg_order_value)),
        revenue_share: totalRevenue > 0 
          ? parseFloat(((newRevenue / totalRevenue) * 100).toFixed(1))
          : 0
      },
      returning_customers: {
        count: parseInt(returningCustomers.customer_count),
        orders: parseInt(returningCustomers.order_count),
        revenue: returningRevenue,
        aov: Math.round(parseFloat(returningCustomers.avg_order_value)),
        revenue_share: totalRevenue > 0 
          ? parseFloat(((returningRevenue / totalRevenue) * 100).toFixed(1))
          : 0
      },
      total: {
        customers: parseInt(newCustomers.customer_count) + parseInt(returningCustomers.customer_count),
        orders: parseInt(newCustomers.order_count) + parseInt(returningCustomers.order_count),
        revenue: totalRevenue
      }
    };

    // ============================================================================
    // 4. 비교 기간 데이터 (optional)
    // ============================================================================
    if (compare === 'true') {
      const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
      const compareStartDate = new Date(startDate);
      compareStartDate.setDate(compareStartDate.getDate() - daysDiff);
      const compareEndDate = new Date(endDate);
      compareEndDate.setDate(compareEndDate.getDate() - daysDiff);

      const compareParams = device && device !== 'all'
        ? [compareStartDate, compareEndDate, device]
        : [compareStartDate, compareEndDate];

      // 비교 기간 신규 고객
      const compareNewCustomersResult = await db.query(
        newCustomersQuery.replace(/\$1/g, '$1').replace(/\$2/g, '$2'), 
        compareParams
      );

      // 비교 기간 재구매 고객
      const compareReturningCustomersResult = await db.query(
        returningCustomersQuery.replace(/\$1/g, '$1').replace(/\$2/g, '$2'), 
        compareParams
      );

      const compareNewCustomers = compareNewCustomersResult.rows[0];
      const compareReturningCustomers = compareReturningCustomersResult.rows[0];

      const compareNewRevenue = parseInt(compareNewCustomers.total_revenue);
      const compareReturningRevenue = parseInt(compareReturningCustomers.total_revenue);
      const compareTotalRevenue = compareNewRevenue + compareReturningRevenue;

      // 증감률 계산 함수
      const calculateChange = (current, previous) => {
        if (previous === 0) {
          return current > 0 ? 'new' : '0';
        }
        return parseFloat((((current - previous) / previous) * 100).toFixed(1));
      };

      response.comparison = {
        period: {
          start: compareStartDate.toISOString().split('T')[0],
          end: compareEndDate.toISOString().split('T')[0]
        },
        new_customers: {
          count: parseInt(compareNewCustomers.customer_count),
          orders: parseInt(compareNewCustomers.order_count),
          revenue: compareNewRevenue,
          aov: Math.round(parseFloat(compareNewCustomers.avg_order_value)),
          revenue_share: compareTotalRevenue > 0 
            ? parseFloat(((compareNewRevenue / compareTotalRevenue) * 100).toFixed(1))
            : 0
        },
        returning_customers: {
          count: parseInt(compareReturningCustomers.customer_count),
          orders: parseInt(compareReturningCustomers.order_count),
          revenue: compareReturningRevenue,
          aov: Math.round(parseFloat(compareReturningCustomers.avg_order_value)),
          revenue_share: compareTotalRevenue > 0 
            ? parseFloat(((compareReturningRevenue / compareTotalRevenue) * 100).toFixed(1))
            : 0
        },
        changes: {
          new_customers_count: calculateChange(
            response.new_customers.count,
            parseInt(compareNewCustomers.customer_count)
          ),
          new_customers_revenue: calculateChange(
            response.new_customers.revenue,
            compareNewRevenue
          ),
          returning_customers_count: calculateChange(
            response.returning_customers.count,
            parseInt(compareReturningCustomers.customer_count)
          ),
          returning_customers_revenue: calculateChange(
            response.returning_customers.revenue,
            compareReturningRevenue
          ),
          total_revenue: calculateChange(
            response.total.revenue,
            compareTotalRevenue
          )
        }
      };
    }

    res.json(response);

  } catch (error) {
    console.error('Customer type analysis error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch customer type analysis',
      details: error.message 
    });
  }
});

module.exports = router;
