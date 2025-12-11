const express = require('express');
const router = express.Router();
const db = require('../../utils/database');

// GET /api/stats/funnel/conversion - 전환 퍼널 데이터
router.get('/conversion', async (req, res) => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({ error: 'start and end dates are required (YYYY-MM-DD format)' });
    }

    const startDate = new Date(start);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    // 방문자 기반 퍼널 쿼리
    const funnelQuery = `
      WITH period_visitors AS (
        SELECT DISTINCT visitor_id
        FROM pageviews
        WHERE timestamp >= $1 AND timestamp <= $2
          AND visitor_id IS NOT NULL
      ),
      cart_visitors AS (
        SELECT DISTINCT visitor_id
        FROM events
        WHERE event_type = 'add_to_cart'
          AND timestamp >= $1 AND timestamp <= $2
          AND visitor_id IS NOT NULL
          AND visitor_id IN (SELECT visitor_id FROM period_visitors)
      ),
      checkout_visitors AS (
        SELECT DISTINCT visitor_id
        FROM events
        WHERE event_type = 'checkout_attempt'
          AND timestamp >= $1 AND timestamp <= $2
          AND visitor_id IS NOT NULL
          AND visitor_id IN (SELECT visitor_id FROM period_visitors)
      ),
      purchase_visitors AS (
        SELECT DISTINCT visitor_id
        FROM conversions
        WHERE timestamp >= $1 AND timestamp <= $2
          AND order_status = 'confirmed'
          AND visitor_id IS NOT NULL
          AND visitor_id IN (SELECT visitor_id FROM period_visitors)
      )
      SELECT 
        (SELECT COUNT(*) FROM period_visitors) as total_visitors,
        (SELECT COUNT(*) FROM cart_visitors) as cart_count,
        (SELECT COUNT(*) FROM checkout_visitors) as checkout_count,
        (SELECT COUNT(*) FROM purchase_visitors) as purchase_count
    `;

    const result = await db.query(funnelQuery, [startDate, endDate]);
    const row = result.rows[0];

    const totalVisitors = parseInt(row.total_visitors) || 0;
    const cartCount = parseInt(row.cart_count) || 0;
    const checkoutCount = parseInt(row.checkout_count) || 0;
    const purchaseCount = parseInt(row.purchase_count) || 0;

    // 전환율 계산 (방문자 대비)
    const cartRate = totalVisitors > 0 ? parseFloat(((cartCount / totalVisitors) * 100).toFixed(1)) : 0;
    const checkoutRate = totalVisitors > 0 ? parseFloat(((checkoutCount / totalVisitors) * 100).toFixed(1)) : 0;
    const purchaseRate = totalVisitors > 0 ? parseFloat(((purchaseCount / totalVisitors) * 100).toFixed(1)) : 0;

    // 결제시도 데이터 없음 감지 (결제시도 0이고 구매완료 > 0)
    const checkoutDataMissing = checkoutCount === 0 && purchaseCount > 0;

    // 이탈률 계산 (이전 단계 대비)
    const cartDropRate = parseFloat((100 - cartRate).toFixed(1));
    
    // 결제시도 데이터가 없으면 장바구니→구매완료 이탈률 계산
    let checkoutDropRate = 0;
    let purchaseDropRate = 0;
    
    if (checkoutDataMissing) {
      // 결제시도 단계 건너뛰고 장바구니→구매완료 이탈률
      purchaseDropRate = cartCount > 0 
        ? parseFloat((((cartCount - purchaseCount) / cartCount) * 100).toFixed(1)) 
        : 0;
    } else {
      checkoutDropRate = cartCount > 0 
        ? parseFloat((((cartCount - checkoutCount) / cartCount) * 100).toFixed(1)) 
        : 0;
      purchaseDropRate = checkoutCount > 0 
        ? parseFloat((((checkoutCount - purchaseCount) / checkoutCount) * 100).toFixed(1)) 
        : 0;
    }

    // 퍼널 데이터 구성 (결제시도 데이터 없으면 3단계, 있으면 4단계)
    let funnel;
    
    if (checkoutDataMissing) {
      // 3단계 퍼널 (결제시도 제외)
      funnel = [
        {
          step: '방문',
          count: totalVisitors,
          rate: 100.0,
          dropRate: 0
        },
        {
          step: '장바구니',
          count: cartCount,
          rate: cartRate,
          dropRate: cartDropRate
        },
        {
          step: '구매완료',
          count: purchaseCount,
          rate: purchaseRate,
          dropRate: purchaseDropRate
        }
      ];
    } else {
      // 4단계 퍼널 (전체)
      funnel = [
        {
          step: '방문',
          count: totalVisitors,
          rate: 100.0,
          dropRate: 0
        },
        {
          step: '장바구니',
          count: cartCount,
          rate: cartRate,
          dropRate: cartDropRate
        },
        {
          step: '결제시도',
          count: checkoutCount,
          rate: checkoutRate,
          dropRate: checkoutDropRate
        },
        {
          step: '구매완료',
          count: purchaseCount,
          rate: purchaseRate,
          dropRate: purchaseDropRate
        }
      ];
    }

    // 인사이트 생성 (가장 큰 이탈 구간 찾기)
    let maxDropIndex = 1;
    let maxDropRateValue = funnel[1].dropRate;

    for (let i = 2; i < funnel.length; i++) {
      if (funnel[i].dropRate > maxDropRateValue) {
        maxDropRateValue = funnel[i].dropRate;
        maxDropIndex = i;
      }
    }

    let insight = '';

    if (totalVisitors === 0) {
      insight = '선택한 기간에 방문자 데이터가 없습니다.';
    } else if (checkoutDataMissing) {
      // 3단계 퍼널일 때 인사이트
      if (maxDropIndex === 1) {
        insight = `방문자의 ${cartDropRate}%가 장바구니를 담지 않고 이탈합니다. 상품 페이지 개선이 필요해요!`;
      } else {
        insight = `장바구니에서 구매완료까지 ${purchaseDropRate}%가 이탈합니다. 결제 과정 점검이 필요해요!`;
      }
    } else {
      // 4단계 퍼널일 때 인사이트
      if (maxDropIndex === 1) {
        insight = `방문자의 ${cartDropRate}%가 장바구니를 담지 않고 이탈합니다. 상품 페이지 개선이 필요해요!`;
      } else if (maxDropIndex === 2) {
        insight = `장바구니에서 결제시도까지 ${checkoutDropRate}%가 이탈합니다. 결제 유도 개선이 필요해요!`;
      } else {
        insight = `결제시도에서 구매완료까지 ${purchaseDropRate}%가 이탈합니다. 결제 과정 점검이 필요해요!`;
      }
    }

    // 응답 구성
    const response = {
      period: {
        start: start,
        end: end
      },
      funnel,
      overallConversion: purchaseRate,
      insight,
      // 결제시도 데이터 누락 여부 (프론트엔드 툴팁용)
      checkoutDataMissing,
      checkoutDataMissingMessage: checkoutDataMissing 
        ? '이 기간에는 결제시도 추적 기능이 활성화되기 전이라 해당 데이터가 없습니다.'
        : null
    };

    res.json(response);
  } catch (error) {
    console.error('Funnel conversion error:', error);
    res.status(500).json({ error: 'Failed to fetch funnel conversion data' });
  }
});

module.exports = router;
