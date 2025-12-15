const express = require('express');
const router = express.Router();
const db = require('../../utils/database');

/**
 * 채널 분류 함수 (SQL에서 사용할 CASE 문)
 * UTM source 우선, 없으면 referrer_type 기반 분류
 */
const CHANNEL_CLASSIFICATION_SQL = `
  CASE
    -- UTM source가 있으면 우선 사용 (대소문자 구분 없이)
    WHEN v.utm_source IS NOT NULL AND v.utm_source != '' THEN
      CASE
        WHEN LOWER(v.utm_source) LIKE '%google%' THEN 'Google'
        WHEN LOWER(v.utm_source) LIKE '%naver%' THEN 'Naver'
        WHEN LOWER(v.utm_source) LIKE '%facebook%' OR LOWER(v.utm_source) = 'fb' THEN 'Facebook'
        WHEN LOWER(v.utm_source) LIKE '%instagram%' OR LOWER(v.utm_source) = 'ig' THEN 'Instagram'
        WHEN LOWER(v.utm_source) LIKE '%kakao%' THEN 'KakaoTalk'
        WHEN LOWER(v.utm_source) LIKE '%youtube%' THEN 'YouTube'
        WHEN LOWER(v.utm_source) LIKE '%twitter%' OR LOWER(v.utm_source) = 'x' THEN 'Twitter'
        ELSE INITCAP(v.utm_source)  -- 기타 utm_source는 첫 글자만 대문자
      END
    -- UTM source 없으면 referrer_type으로 분류
    WHEN v.referrer_type = 'search' THEN 'Organic Search'
    WHEN v.referrer_type = 'social' THEN 'Social'
    WHEN v.referrer_type = 'direct' THEN '직접 유입'
    WHEN v.referrer_type = 'referral' THEN 'Referral'
    ELSE '기타'
  END
`;

// GET /api/stats/channel-funnel/channels - 채널 목록만 조회 (전체 기간 기준)
router.get('/channels', async (req, res) => {
  try {
    // 전체 기간에서 존재하는 모든 채널 목록 조회
    const channelsQuery = `
      SELECT DISTINCT ${CHANNEL_CLASSIFICATION_SQL} as channel
      FROM pageviews pv
      JOIN visitors v ON pv.visitor_id = v.visitor_id
      WHERE pv.visitor_id IS NOT NULL
      ORDER BY channel
    `;

    const result = await db.query(channelsQuery);
    const channels = result.rows.map(row => row.channel);

    res.json({ channels });
  } catch (error) {
    console.error('Channel list error:', error);
    res.status(500).json({ error: 'Failed to fetch channel list' });
  }
});

// GET /api/stats/channel-funnel/conversion - 채널별 전환 퍼널 데이터
router.get('/conversion', async (req, res) => {
  try {
    const { start, end, limit = 10, device = 'all' } = req.query;

    if (!start || !end) {
      return res.status(400).json({ error: 'start and end dates are required (YYYY-MM-DD format)' });
    }

    // 디바이스 필터 조건 생성
    let deviceFilter = '';
    if (device && device !== 'all') {
      // device_type: 'desktop', 'mobile', 'tablet' 등
      const deviceMap = {
        'pc': 'desktop',
        'desktop': 'desktop',
        'mobile': 'mobile',
        'tablet': 'tablet'
      };
      const mappedDevice = deviceMap[device.toLowerCase()] || device.toLowerCase();
      deviceFilter = `AND LOWER(v.device_type) = '${mappedDevice}'`;
    }

    // 채널별 퍼널 데이터 쿼리 (상세페이지 조회 단계 포함)
    const channelFunnelQuery = `
      WITH period_visitors AS (
        -- 기간 내 모든 방문자와 그들의 채널 분류
        SELECT DISTINCT 
          pv.visitor_id,
          ${CHANNEL_CLASSIFICATION_SQL} as channel
        FROM pageviews pv
        JOIN visitors v ON pv.visitor_id = v.visitor_id
        WHERE pv.timestamp >= $1::date 
          AND pv.timestamp < ($2::date + INTERVAL '1 day')
          AND pv.visitor_id IS NOT NULL
          ${deviceFilter}
      ),
      channel_visitors AS (
        -- 채널별 총 방문자 수
        SELECT 
          channel,
          COUNT(DISTINCT visitor_id) as total_count
        FROM period_visitors
        GROUP BY channel
      ),
      channel_product_view AS (
        -- 채널별 상세페이지 조회한 방문자 수
        SELECT 
          pv.channel,
          COUNT(DISTINCT pg.visitor_id) as product_view_count
        FROM pageviews pg
        JOIN period_visitors pv ON pg.visitor_id = pv.visitor_id
        WHERE (
          pg.page_url LIKE '%/product/%'
          OR pg.page_url LIKE '%product_no=%'
          OR pg.page_url LIKE '%/surl/P/%'
          OR pg.page_url LIKE '%/surl/p/%'
        )
          AND pg.timestamp >= $1::date 
          AND pg.timestamp < ($2::date + INTERVAL '1 day')
        GROUP BY pv.channel
      ),
      channel_cart AS (
        -- 채널별 장바구니 추가한 방문자 수
        SELECT 
          pv.channel,
          COUNT(DISTINCT e.visitor_id) as cart_count
        FROM events e
        JOIN period_visitors pv ON e.visitor_id = pv.visitor_id
        WHERE e.event_type = 'add_to_cart'
          AND e.timestamp >= $1::date 
          AND e.timestamp < ($2::date + INTERVAL '1 day')
        GROUP BY pv.channel
      ),
      channel_checkout AS (
        -- 채널별 결제 시도한 방문자 수
        SELECT 
          pv.channel,
          COUNT(DISTINCT e.visitor_id) as checkout_count
        FROM events e
        JOIN period_visitors pv ON e.visitor_id = pv.visitor_id
        WHERE e.event_type = 'checkout_attempt'
          AND e.timestamp >= $1::date 
          AND e.timestamp < ($2::date + INTERVAL '1 day')
        GROUP BY pv.channel
      ),
      channel_purchase AS (
        -- 채널별 구매 완료한 방문자 수
        SELECT 
          pv.channel,
          COUNT(DISTINCT c.visitor_id) as purchase_count
        FROM conversions c
        JOIN period_visitors pv ON c.visitor_id = pv.visitor_id
        WHERE c.timestamp >= $1::date 
          AND c.timestamp < ($2::date + INTERVAL '1 day')
          AND c.order_status = 'confirmed'
        GROUP BY pv.channel
      )
      SELECT 
        cv.channel,
        cv.total_count as visitors,
        COALESCE(cpv.product_view_count, 0) as product_view_count,
        COALESCE(cc.cart_count, 0) as cart_count,
        COALESCE(cch.checkout_count, 0) as checkout_count,
        COALESCE(cp.purchase_count, 0) as purchase_count
      FROM channel_visitors cv
      LEFT JOIN channel_product_view cpv ON cv.channel = cpv.channel
      LEFT JOIN channel_cart cc ON cv.channel = cc.channel
      LEFT JOIN channel_checkout cch ON cv.channel = cch.channel
      LEFT JOIN channel_purchase cp ON cv.channel = cp.channel
      ORDER BY cv.total_count DESC
      LIMIT $3
    `;

    const result = await db.query(channelFunnelQuery, [start, end, parseInt(limit)]);

    // 각 채널별로 퍼널 데이터 구성
    const channels = result.rows.map(row => {
      const visitors = parseInt(row.visitors) || 0;
      const productViewCount = parseInt(row.product_view_count) || 0;
      const cartCount = parseInt(row.cart_count) || 0;
      const checkoutCount = parseInt(row.checkout_count) || 0;
      const purchaseCount = parseInt(row.purchase_count) || 0;

      // 전환율 계산 (방문자 대비 %)
      const productViewRate = visitors > 0 ? parseFloat(((productViewCount / visitors) * 100).toFixed(1)) : 0;
      const cartRate = visitors > 0 ? parseFloat(((cartCount / visitors) * 100).toFixed(1)) : 0;
      const checkoutRate = visitors > 0 ? parseFloat(((checkoutCount / visitors) * 100).toFixed(1)) : 0;
      const purchaseRate = visitors > 0 ? parseFloat(((purchaseCount / visitors) * 100).toFixed(1)) : 0;

      // 결제시도 데이터 누락 감지 (결제시도 0이고 구매완료 > 0)
      const checkoutDataMissing = checkoutCount === 0 && purchaseCount > 0;

      // 이탈률 계산 (이전 단계 대비)
      const productViewDropRate = parseFloat((100 - productViewRate).toFixed(1));
      const cartDropRate = productViewCount > 0 
        ? parseFloat((((productViewCount - cartCount) / productViewCount) * 100).toFixed(1)) 
        : 0;
      
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

      // 퍼널 구성 (결제시도 데이터 없으면 4단계, 있으면 5단계)
      let funnel;
      
      if (checkoutDataMissing) {
        // 4단계 퍼널 (결제시도 제외)
        funnel = [
          { step: '방문', count: visitors, rate: 100.0, dropRate: 0 },
          { step: '상세페이지', count: productViewCount, rate: productViewRate, dropRate: productViewDropRate },
          { step: '장바구니', count: cartCount, rate: cartRate, dropRate: cartDropRate },
          { step: '구매완료', count: purchaseCount, rate: purchaseRate, dropRate: purchaseDropRate }
        ];
      } else {
        // 5단계 퍼널 (전체)
        funnel = [
          { step: '방문', count: visitors, rate: 100.0, dropRate: 0 },
          { step: '상세페이지', count: productViewCount, rate: productViewRate, dropRate: productViewDropRate },
          { step: '장바구니', count: cartCount, rate: cartRate, dropRate: cartDropRate },
          { step: '결제시도', count: checkoutCount, rate: checkoutRate, dropRate: checkoutDropRate },
          { step: '구매완료', count: purchaseCount, rate: purchaseRate, dropRate: purchaseDropRate }
        ];
      }

      // 인사이트 생성 (가장 큰 이탈 구간)
      let maxDropIndex = 1;
      let maxDropRateValue = funnel[1].dropRate;

      for (let i = 2; i < funnel.length; i++) {
        if (funnel[i].dropRate > maxDropRateValue) {
          maxDropRateValue = funnel[i].dropRate;
          maxDropIndex = i;
        }
      }

      let insight = '';
      if (checkoutDataMissing) {
        // 4단계 퍼널
        if (maxDropIndex === 1) insight = `${productViewDropRate}% 이탈 (상세페이지 전)`;
        else if (maxDropIndex === 2) insight = `${cartDropRate}% 이탈 (상세→장바구니)`;
        else insight = `${purchaseDropRate}% 이탈 (장바구니→구매)`;
      } else {
        // 5단계 퍼널
        if (maxDropIndex === 1) insight = `${productViewDropRate}% 이탈 (상세페이지 전)`;
        else if (maxDropIndex === 2) insight = `${cartDropRate}% 이탈 (상세→장바구니)`;
        else if (maxDropIndex === 3) insight = `${checkoutDropRate}% 이탈 (장바구니→결제)`;
        else insight = `${purchaseDropRate}% 이탈 (결제→구매)`;
      }

      return {
        channel: row.channel,
        funnel,
        overallConversion: purchaseRate,
        insight,
        checkoutDataMissing
      };
    });

    // 응답 구성
    const response = {
      period: {
        start: start,
        end: end
      },
      channels
    };

    res.json(response);
  } catch (error) {
    console.error('Channel funnel conversion error:', error);
    res.status(500).json({ error: 'Failed to fetch channel funnel conversion data' });
  }
});

// GET /api/stats/channel-funnel/single - 단일 채널의 전환 퍼널 데이터 (비교 기간 포함)
router.get('/single', async (req, res) => {
  try {
    const { channel, start, end, compareStart, compareEnd, device = 'all' } = req.query;

    if (!channel || !start || !end) {
      return res.status(400).json({ error: 'channel, start, and end dates are required' });
    }

    // 디바이스 필터 조건 생성
    let deviceFilter = '';
    if (device && device !== 'all') {
      const deviceMap = {
        'pc': 'desktop',
        'desktop': 'desktop',
        'mobile': 'mobile',
        'tablet': 'tablet'
      };
      const mappedDevice = deviceMap[device.toLowerCase()] || device.toLowerCase();
      deviceFilter = `AND LOWER(v.device_type) = '${mappedDevice}'`;
    }

    // 단일 채널 퍼널 데이터 조회 함수 (상세페이지 조회 단계 포함)
    const getChannelFunnel = async (startDate, endDate) => {
      const query = `
        WITH period_visitors AS (
          -- 기간 내 해당 채널의 방문자
          SELECT DISTINCT pv.visitor_id
          FROM pageviews pv
          JOIN visitors v ON pv.visitor_id = v.visitor_id
          WHERE pv.timestamp >= $1::date 
            AND pv.timestamp < ($2::date + INTERVAL '1 day')
            AND pv.visitor_id IS NOT NULL
            AND ${CHANNEL_CLASSIFICATION_SQL} = $3
            ${deviceFilter}
        ),
        product_view_visitors AS (
          -- 상세페이지 조회한 방문자
          SELECT COUNT(DISTINCT pg.visitor_id) as product_view_count
          FROM pageviews pg
          WHERE (
            pg.page_url LIKE '%/product/%'
            OR pg.page_url LIKE '%product_no=%'
            OR pg.page_url LIKE '%/surl/P/%'
            OR pg.page_url LIKE '%/surl/p/%'
          )
            AND pg.timestamp >= $1::date 
            AND pg.timestamp < ($2::date + INTERVAL '1 day')
            AND pg.visitor_id IN (SELECT visitor_id FROM period_visitors)
        ),
        cart_visitors AS (
          -- 장바구니 추가한 방문자
          SELECT COUNT(DISTINCT e.visitor_id) as cart_count
          FROM events e
          WHERE e.event_type = 'add_to_cart'
            AND e.timestamp >= $1::date 
            AND e.timestamp < ($2::date + INTERVAL '1 day')
            AND e.visitor_id IN (SELECT visitor_id FROM period_visitors)
        ),
        checkout_visitors AS (
          -- 결제 시도한 방문자
          SELECT COUNT(DISTINCT e.visitor_id) as checkout_count
          FROM events e
          WHERE e.event_type = 'checkout_attempt'
            AND e.timestamp >= $1::date 
            AND e.timestamp < ($2::date + INTERVAL '1 day')
            AND e.visitor_id IN (SELECT visitor_id FROM period_visitors)
        ),
        purchase_visitors AS (
          -- 구매 완료한 방문자
          SELECT COUNT(DISTINCT c.visitor_id) as purchase_count
          FROM conversions c
          WHERE c.timestamp >= $1::date 
            AND c.timestamp < ($2::date + INTERVAL '1 day')
            AND c.order_status = 'confirmed'
            AND c.visitor_id IN (SELECT visitor_id FROM period_visitors)
        )
        SELECT 
          (SELECT COUNT(*) FROM period_visitors) as visitors,
          (SELECT product_view_count FROM product_view_visitors) as product_view_count,
          (SELECT cart_count FROM cart_visitors) as cart_count,
          (SELECT checkout_count FROM checkout_visitors) as checkout_count,
          (SELECT purchase_count FROM purchase_visitors) as purchase_count
      `;

      const result = await db.query(query, [startDate, endDate, channel]);
      const row = result.rows[0];

      const visitors = parseInt(row.visitors) || 0;
      const productViewCount = parseInt(row.product_view_count) || 0;
      const cartCount = parseInt(row.cart_count) || 0;
      const checkoutCount = parseInt(row.checkout_count) || 0;
      const purchaseCount = parseInt(row.purchase_count) || 0;

      // 전환율 계산
      const productViewRate = visitors > 0 ? parseFloat(((productViewCount / visitors) * 100).toFixed(1)) : 0;
      const cartRate = visitors > 0 ? parseFloat(((cartCount / visitors) * 100).toFixed(1)) : 0;
      const checkoutRate = visitors > 0 ? parseFloat(((checkoutCount / visitors) * 100).toFixed(1)) : 0;
      const purchaseRate = visitors > 0 ? parseFloat(((purchaseCount / visitors) * 100).toFixed(1)) : 0;

      // 결제시도 데이터 누락 감지
      const checkoutDataMissing = checkoutCount === 0 && purchaseCount > 0;

      // 이탈률 계산
      const productViewDropRate = parseFloat((100 - productViewRate).toFixed(1));
      const cartDropRate = productViewCount > 0 
        ? parseFloat((((productViewCount - cartCount) / productViewCount) * 100).toFixed(1)) 
        : 0;
      
      let checkoutDropRate = 0;
      let purchaseDropRate = 0;
      
      if (checkoutDataMissing) {
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

      // 퍼널 구성 (결제시도 데이터 없으면 4단계, 있으면 5단계)
      let funnel;
      if (checkoutDataMissing) {
        funnel = [
          { step: '방문', count: visitors, rate: 100.0, dropRate: 0 },
          { step: '상세페이지', count: productViewCount, rate: productViewRate, dropRate: productViewDropRate },
          { step: '장바구니', count: cartCount, rate: cartRate, dropRate: cartDropRate },
          { step: '구매완료', count: purchaseCount, rate: purchaseRate, dropRate: purchaseDropRate }
        ];
      } else {
        funnel = [
          { step: '방문', count: visitors, rate: 100.0, dropRate: 0 },
          { step: '상세페이지', count: productViewCount, rate: productViewRate, dropRate: productViewDropRate },
          { step: '장바구니', count: cartCount, rate: cartRate, dropRate: cartDropRate },
          { step: '결제시도', count: checkoutCount, rate: checkoutRate, dropRate: checkoutDropRate },
          { step: '구매완료', count: purchaseCount, rate: purchaseRate, dropRate: purchaseDropRate }
        ];
      }

      // 인사이트 생성
      let maxDropIndex = 1;
      let maxDropRateValue = funnel[1].dropRate;
      for (let i = 2; i < funnel.length; i++) {
        if (funnel[i].dropRate > maxDropRateValue) {
          maxDropRateValue = funnel[i].dropRate;
          maxDropIndex = i;
        }
      }

      let insight = '';
      if (checkoutDataMissing) {
        // 4단계 퍼널
        if (maxDropIndex === 1) insight = `${productViewDropRate}% 이탈 (상세페이지 전)`;
        else if (maxDropIndex === 2) insight = `${cartDropRate}% 이탈 (상세→장바구니)`;
        else insight = `${purchaseDropRate}% 이탈 (장바구니→구매)`;
      } else {
        // 5단계 퍼널
        if (maxDropIndex === 1) insight = `${productViewDropRate}% 이탈 (상세페이지 전)`;
        else if (maxDropIndex === 2) insight = `${cartDropRate}% 이탈 (상세→장바구니)`;
        else if (maxDropIndex === 3) insight = `${checkoutDropRate}% 이탈 (장바구니→결제)`;
        else insight = `${purchaseDropRate}% 이탈 (결제→구매)`;
      }

      return {
        funnel,
        overallConversion: purchaseRate,
        insight,
        checkoutDataMissing,
        isEmpty: visitors === 0
      };
    };

    // 현재 기간 퍼널 데이터
    const currentData = await getChannelFunnel(start, end);

    // 응답 구성
    const response = {
      channel: channel,
      period: {
        start: start,
        end: end
      },
      funnel: currentData.funnel,
      overallConversion: currentData.overallConversion,
      insight: currentData.insight,
      checkoutDataMissing: currentData.checkoutDataMissing,
      isEmpty: currentData.isEmpty
    };

    // 비교 기간이 있으면 추가 조회
    if (compareStart && compareEnd) {
      const compareData = await getChannelFunnel(compareStart, compareEnd);
      
      response.comparePeriod = {
        start: compareStart,
        end: compareEnd
      };
      response.compareFunnel = compareData.funnel;
      response.compareConversion = compareData.overallConversion;
      response.compareCheckoutDataMissing = compareData.checkoutDataMissing;
      
      // 전환율 변화 계산
      if (compareData.overallConversion > 0) {
        const change = ((currentData.overallConversion - compareData.overallConversion) / compareData.overallConversion * 100).toFixed(1);
        response.conversionChange = change;
      } else if (currentData.overallConversion > 0) {
        response.conversionChange = 'new';
      } else {
        response.conversionChange = '0';
      }

      // 비교 기간 데이터 누락 메시지
      if (compareData.checkoutDataMissing) {
        response.compareCheckoutDataMissingMessage = '비교 기간에는 결제시도 추적 기능이 활성화되기 전이라 해당 데이터가 없습니다.';
      }
    }

    // 현재 기간 데이터 누락 메시지
    if (currentData.checkoutDataMissing) {
      response.checkoutDataMissingMessage = '이 기간에는 결제시도 추적 기능이 활성화되기 전이라 해당 데이터가 없습니다.';
    }

    res.json(response);
  } catch (error) {
    console.error('Single channel funnel error:', error);
    res.status(500).json({ error: 'Failed to fetch single channel funnel data' });
  }
});

module.exports = router;
