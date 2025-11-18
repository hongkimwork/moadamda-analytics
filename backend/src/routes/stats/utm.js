const express = require('express');
const router = express.Router();
const db = require('../../utils/database');

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
      count: values.length
    });
  } catch (error) {
    // utm_params 컬럼이 없는 테이블의 경우 빈 배열 반환 (graceful degradation)
    console.error('[UTM-VALUES] 조회 실패 (테이블: ' + (req.query.table || 'visitors') + ', 키: ' + (req.query.key || 'N/A') + '):', error.message);
    
    // 컬럼 없음 에러인 경우 빈 배열 반환
    if (error.message && error.message.includes('utm_params')) {
      return res.json({ 
        table: req.query.table ? req.query.table.replace(/-/g, '_') : 'visitors',
        key: req.query.key || '',
        values: [],
        count: 0
      });
    }
    
    // 기타 에러는 500 반환
    res.status(500).json({ error: 'Failed to fetch UTM values' });
  }
});

module.exports = router;

