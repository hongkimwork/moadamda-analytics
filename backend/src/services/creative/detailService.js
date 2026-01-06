/**
 * 광고 소재 상세 분석 Service
 * POST 엔드포인트들의 비즈니스 로직 담당
 */

const repository = require('./detailRepository');

// 기여 인정 기간 (일 단위) - 구매일 기준 이 기간 내에 본 광고만 기여 인정
const ATTRIBUTION_WINDOW_DAYS = 30;

/**
 * 날짜 파라미터 파싱 및 검증
 */
function parseDates(start, end) {
  const startDate = new Date(start);
  startDate.setHours(0, 0, 0, 0);
  
  const endDate = new Date(end);
  endDate.setHours(23, 59, 59, 999);
  
  return { startDate, endDate };
}

/**
 * 기본 파라미터 검증 (creative + dates)
 */
function validateCreativeParams({ creative_name, utm_source, utm_medium, utm_campaign, start, end }) {
  if (!creative_name || !utm_source || !utm_medium || !utm_campaign || !start || !end) {
    throw new Error('creative_name, utm_source, utm_medium, utm_campaign, start, end are required');
  }
}

/**
 * Visitor 여정 그룹화
 */
function groupJourneysByVisitor(journeyRows) {
  const visitorJourneys = {};
  journeyRows.forEach(row => {
    if (!visitorJourneys[row.visitor_id]) {
      visitorJourneys[row.visitor_id] = [];
    }
    visitorJourneys[row.visitor_id].push(row);
  });
  return visitorJourneys;
}

/**
 * 구매일 기준 30일 이내 여정만 필터링
 */
function filterJourneyByAttributionWindow(journey, purchaseDate) {
  const orderDate = new Date(purchaseDate);
  const windowStart = new Date(orderDate);
  windowStart.setDate(windowStart.getDate() - ATTRIBUTION_WINDOW_DAYS);
  
  return journey.filter(touch => {
    const touchDate = new Date(touch.entry_timestamp);
    return touchDate >= windowStart && touchDate <= orderDate;
  });
}

/**
 * 특정 광고 소재에 기여한 주문 목록 조회 (기여도 상세 정보 포함)
 * 
 * 중요: 테이블(creativeAttribution.js)과 동일한 로직으로 계산
 * - 선택 기간 내 구매한 모든 visitor의 여정을 분석
 * - 구매일 기준 30일 이내에 본 광고만 기여 인정 (Attribution Window)
 * - 해당 광고가 30일 이내 여정에 포함된 경우만 기여 주문으로 인정
 */
async function getCreativeOrders(params) {
  const { creative_name, utm_source, utm_medium, utm_campaign, start, end } = params;
  
  // 파라미터 검증
  validateCreativeParams(params);
  
  const { startDate, endDate } = parseDates(start, end);
  const targetCreativeKey = `${creative_name}||${utm_source}||${utm_medium}||${utm_campaign}`;
  
  // visitor 조회 시작일을 30일 전으로 확장 (기여 인정 기간만큼)
  // 이렇게 해야 선택 기간 시작일에 결제한 사람이 30일 전에 본 광고도 집계됨
  const extendedStartDate = new Date(startDate);
  extendedStartDate.setDate(extendedStartDate.getDate() - ATTRIBUTION_WINDOW_DAYS);
  
  const emptyResponse = {
    success: true,
    data: [],
    summary: {
      total_orders: 0,
      last_touch_orders: 0,
      last_touch_ratio: 0,
      assist_orders: 0,
      assist_ratio: 0,
      single_touch_orders: 0,
      attributed_revenue: 0,
      last_touch_revenue: 0,
      avg_contribution_rate: 0,
      unique_visitors: 0
    },
    verification: {
      last_touch_100_percent: { count: 0, revenue: 0 },
      last_touch_50_percent: { count: 0, revenue: 0 },
      assist_contribution: { count: 0, revenue: 0 },
      total_attributed: 0
    }
  };
  
  // 테이블과 동일하게: 확장된 기간 내 모든 광고를 본 visitor 조회
  const allVisitorIds = await repository.getAllVisitorsInPeriod({ startDate: extendedStartDate, endDate });
  
  if (allVisitorIds.length === 0) {
    return emptyResponse;
  }
  
  // 해당 visitor들의 주문 조회 (선택 기간 내)
  const allOrders = await repository.getVisitorOrders({ 
    visitorIds: allVisitorIds, 
    startDate, 
    endDate 
  });
  
  if (allOrders.length === 0) {
    return emptyResponse;
  }
  
  // 구매한 visitor들의 전체 여정 조회
  const purchaserIds = [...new Set(allOrders.map(o => o.visitor_id))];
  const journeyRows = await repository.getVisitorJourneys({ visitorIds: purchaserIds });
  
  // visitor별 여정 그룹화
  const visitorJourneys = groupJourneysByVisitor(journeyRows);
  
  // 기여도 기반 주문 필터링 및 상세 계산
  const contributedOrders = [];
  const contributedVisitorIds = new Set();
  
  // 검증용 집계 변수
  let lastTouch100Count = 0, lastTouch100Revenue = 0;
  let lastTouch50Count = 0, lastTouch50Revenue = 0;
  let assistCount = 0, assistRevenue = 0;
  let totalAttributedRevenue = 0;
  let singleTouchCount = 0;
  
  allOrders.forEach(order => {
    const fullJourney = visitorJourneys[order.visitor_id] || [];
    if (fullJourney.length === 0) return;
    
    // 구매일 기준 30일 이내 여정만 필터링
    const journey = filterJourneyByAttributionWindow(fullJourney, order.order_date);
    if (journey.length === 0) return;
    
    // 고유한 광고 조합 수집
    const uniqueCreativesMap = new Map();
    journey.forEach(touch => {
      const touchKey = `${touch.utm_content}||${touch.utm_source}||${touch.utm_medium}||${touch.utm_campaign}`;
      if (!uniqueCreativesMap.has(touchKey) || touch.sequence_order > uniqueCreativesMap.get(touchKey).sequence_order) {
        uniqueCreativesMap.set(touchKey, touch);
      }
    });
    
    const uniqueCreativeKeys = Array.from(uniqueCreativesMap.keys());
    
    // 해당 광고가 30일 이내 여정에 포함되어 있는지 확인
    if (!uniqueCreativeKeys.includes(targetCreativeKey)) return;
    
    contributedVisitorIds.add(order.visitor_id);
    
    // 막타 찾기 (필터링된 여정 중 sequence_order가 가장 큰 것)
    const lastTouch = journey.reduce((max, current) => 
      current.sequence_order > max.sequence_order ? current : max
    );
    const lastTouchKey = `${lastTouch.utm_content}||${lastTouch.utm_source}||${lastTouch.utm_medium}||${lastTouch.utm_campaign}`;
    const isLastTouch = lastTouchKey === targetCreativeKey;
    const isSingleTouch = uniqueCreativeKeys.length === 1;
    
    const finalPayment = parseFloat(order.final_payment) || 0;
    const journeyCreativeCount = uniqueCreativeKeys.length;
    const assistCreativeCount = uniqueCreativeKeys.filter(key => key !== lastTouchKey).length;
    
    // 기여율 및 기여 금액 계산
    let contributionRate = 0;
    let attributedAmount = 0;
    let role = '';
    
    if (isLastTouch) {
      if (assistCreativeCount === 0) {
        // 순수 전환 (이 광고만 보고 구매)
        contributionRate = 100;
        attributedAmount = finalPayment;
        role = '막타(순수)';
        lastTouch100Count++;
        lastTouch100Revenue += attributedAmount;
        singleTouchCount++;
      } else {
        // 막타 50%
        contributionRate = 50;
        attributedAmount = finalPayment * 0.5;
        role = '막타';
        lastTouch50Count++;
        lastTouch50Revenue += attributedAmount;
      }
    } else {
      // 어시 (50%를 어시 광고 수로 균등 분배)
      contributionRate = assistCreativeCount > 0 ? Math.round((50 / assistCreativeCount) * 10) / 10 : 0;
      attributedAmount = assistCreativeCount > 0 ? (finalPayment * 0.5) / assistCreativeCount : 0;
      role = '어시';
      assistCount++;
      assistRevenue += attributedAmount;
    }
    
    totalAttributedRevenue += attributedAmount;
    
    // 광고 여정 정보 구성
    const journeyInfo = [];
    const sortedJourney = [...uniqueCreativesMap.entries()]
      .sort((a, b) => a[1].sequence_order - b[1].sequence_order);
    
    sortedJourney.forEach(([key, touch], index) => {
      const isTarget = key === targetCreativeKey;
      const isLast = key === lastTouchKey;
      journeyInfo.push({
        order: index + 1,
        creative_name: touch.utm_content,
        utm_source: touch.utm_source,
        utm_medium: touch.utm_medium,
        utm_campaign: touch.utm_campaign,
        timestamp: touch.entry_timestamp,
        is_target: isTarget,
        is_last_touch: isLast,
        role: isLast ? '막타' : '어시'
      });
    });
    
    contributedOrders.push({
      ...order,
      is_last_touch: isLastTouch,
      is_single_touch: isSingleTouch,
      role,
      journey_creative_count: journeyCreativeCount,
      contribution_rate: contributionRate,
      attributed_amount: Math.round(attributedAmount),
      journey: journeyInfo
    });
  });
  
  // 기여 주문의 visitor들에 대한 추가 정보 조회
  const contributedVisitorArray = Array.from(contributedVisitorIds);
  const [sessionInfoMap, touchCountMap, visitCountMap] = await Promise.all([
    repository.getVisitorSessionInfoForCreative({
      visitorIds: contributedVisitorArray,
      creative_name,
      utm_source,
      utm_medium,
      utm_campaign
    }),
    repository.getCreativeTouchCounts({
      visitorIds: contributedVisitorArray,
      creative_name,
      utm_source,
      utm_medium,
      utm_campaign
    }),
    repository.getVisitorTotalVisits({ visitorIds: contributedVisitorArray })
  ]);
  
  // 요약 통계 계산
  const lastTouchOrders = contributedOrders.filter(o => o.is_last_touch).length;
  const assistOrders = contributedOrders.filter(o => !o.is_last_touch).length;
  const totalOrders = contributedOrders.length;
  const lastTouchRevenue = contributedOrders
    .filter(o => o.is_last_touch)
    .reduce((sum, o) => sum + (parseFloat(o.final_payment) || 0), 0);
  const avgContributionRate = totalOrders > 0 
    ? Math.round(contributedOrders.reduce((sum, o) => sum + o.contribution_rate, 0) / totalOrders * 10) / 10
    : 0;
  
  // 응답 데이터 가공
  const formattedOrders = contributedOrders.map(order => {
    const sessionInfo = sessionInfoMap[order.visitor_id] || { pageview_count: 0, duration_seconds: 0 };
    const touchCount = touchCountMap[order.visitor_id] || 0;
    const totalVisits = visitCountMap[order.visitor_id] || 0;
    
    return {
      order_id: order.order_id,
      order_date: order.order_date,
      final_payment: Math.round(parseFloat(order.final_payment) || 0),
      total_amount: Math.round(parseFloat(order.total_amount) || 0),
      product_name: order.product_name || '-',
      product_count: parseInt(order.product_count) || 1,
      discount_amount: Math.round(parseFloat(order.discount_amount) || 0),
      is_last_touch: order.is_last_touch,
      is_single_touch: order.is_single_touch,
      role: order.role,
      journey_creative_count: order.journey_creative_count,
      contribution_rate: order.contribution_rate,
      attributed_amount: order.attributed_amount,
      journey: order.journey,
      // 추가 지표
      session_pageviews: sessionInfo.pageview_count,
      session_duration: sessionInfo.duration_seconds,
      ad_touch_count: touchCount,
      total_visits: totalVisits
    };
  });
  
  return {
    success: true,
    creative: { creative_name, utm_source, utm_medium, utm_campaign },
    period: { start, end },
    data: formattedOrders,
    summary: {
      total_orders: totalOrders,
      last_touch_orders: lastTouchOrders,
      last_touch_ratio: totalOrders > 0 ? Math.round(lastTouchOrders / totalOrders * 1000) / 10 : 0,
      assist_orders: assistOrders,
      assist_ratio: totalOrders > 0 ? Math.round(assistOrders / totalOrders * 1000) / 10 : 0,
      single_touch_orders: singleTouchCount,
      attributed_revenue: Math.round(totalAttributedRevenue),
      last_touch_revenue: Math.round(lastTouchRevenue),
      avg_contribution_rate: avgContributionRate,
      unique_visitors: contributedVisitorIds.size
    },
    verification: {
      last_touch_100_percent: { 
        count: lastTouch100Count, 
        revenue: Math.round(lastTouch100Revenue),
        description: '이 광고만 보고 구매 (100% 기여)'
      },
      last_touch_50_percent: { 
        count: lastTouch50Count, 
        revenue: Math.round(lastTouch50Revenue),
        description: '여러 광고 중 막타로 구매 (50% 기여)'
      },
      assist_contribution: { 
        count: assistCount, 
        revenue: Math.round(assistRevenue),
        description: '어시로 기여 (50%를 어시 수로 분배)'
      },
      total_attributed: Math.round(totalAttributedRevenue),
      formula: '기여한 매출액 = 막타100% + 막타50% + 어시기여'
    }
  };
}

/**
 * 특정 광고 소재의 상세 성과 분석
 */
async function getCreativeAnalysis(params) {
  const { creative_name, utm_source, utm_medium, utm_campaign, start, end } = params;
  
  // 파라미터 검증
  validateCreativeParams(params);
  
  const { startDate, endDate } = parseDates(start, end);
  
  // visitor 조회
  const visitorIds = await repository.getCreativeVisitors({
    creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate
  });
  
  if (visitorIds.length === 0) {
    return {
      success: true,
      creative: { creative_name, utm_source, utm_medium, utm_campaign },
      period: { start, end },
      daily_trend: [],
      device_stats: [],
      product_sales: [],
      visitor_type: { new_visitors: 0, returning_visitors: 0, new_ratio: 0, returning_ratio: 0 }
    };
  }
  
  // 병렬 쿼리 실행
  const [dailyTrendRows, deviceStatsRows, productSalesRows, visitorTypeRow] = await Promise.all([
    repository.getDailyTrend({ creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate, visitorIds }),
    repository.getDeviceStats({ creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate, visitorIds }),
    repository.getProductSales({ visitorIds, startDate, endDate }),
    repository.getVisitorType({ visitorIds })
  ]);
  
  // 일별 추이 가공
  const dailyTrend = dailyTrendRows.map(row => ({
    date: row.date,
    uv: parseInt(row.uv) || 0,
    orders: parseInt(row.orders) || 0,
    revenue: Math.round(parseFloat(row.revenue) || 0)
  }));
  
  // 디바이스 타입 한글 변환
  const deviceTypeKorean = {
    'mobile': '모바일',
    'desktop': '데스크톱',
    'tablet': '태블릿',
    'unknown': '알 수 없음'
  };
  
  const deviceStats = deviceStatsRows.map(row => {
    const uv = parseInt(row.uv) || 0;
    const orders = parseInt(row.orders) || 0;
    const conversionRate = uv > 0 ? (orders / uv * 100).toFixed(1) : '0.0';
    
    return {
      device_type: row.device_type,
      device_type_korean: deviceTypeKorean[row.device_type] || row.device_type,
      uv,
      orders,
      revenue: Math.round(parseFloat(row.revenue) || 0),
      conversion_rate: parseFloat(conversionRate)
    };
  });
  
  const productSales = productSalesRows.map((row, index) => ({
    rank: index + 1,
    product_name: row.product_name,
    order_count: parseInt(row.order_count) || 0,
    revenue: Math.round(parseFloat(row.revenue) || 0)
  }));
  
  const newVisitors = parseInt(visitorTypeRow.new_visitors) || 0;
  const returningVisitors = parseInt(visitorTypeRow.returning_visitors) || 0;
  const totalVisitors = newVisitors + returningVisitors;
  
  const visitorType = {
    new_visitors: newVisitors,
    returning_visitors: returningVisitors,
    new_ratio: totalVisitors > 0 ? Math.round(newVisitors / totalVisitors * 100) : 0,
    returning_ratio: totalVisitors > 0 ? Math.round(returningVisitors / totalVisitors * 100) : 0
  };
  
  return {
    success: true,
    creative: { creative_name, utm_source, utm_medium, utm_campaign },
    period: { start, end },
    summary: {
      total_uv: visitorIds.length,
      total_orders: dailyTrend.reduce((sum, d) => sum + d.orders, 0),
      total_revenue: dailyTrend.reduce((sum, d) => sum + d.revenue, 0)
    },
    daily_trend: dailyTrend,
    device_stats: deviceStats,
    product_sales: productSales,
    visitor_type: visitorType
  };
}

/**
 * 특정 광고 소재의 고객 여정 분석
 */
async function getCreativeJourney(params) {
  const { creative_name, utm_source, utm_medium, utm_campaign, start, end } = params;
  
  // 파라미터 검증
  validateCreativeParams(params);
  
  const { startDate, endDate } = parseDates(start, end);
  const targetCreativeKey = `${creative_name}||${utm_source}||${utm_medium}||${utm_campaign}`;
  
  // visitor 조회
  const visitorIds = await repository.getCreativeVisitors({
    creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate
  });
  
  if (visitorIds.length === 0) {
    return {
      success: true,
      creative: { creative_name, utm_source, utm_medium, utm_campaign },
      period: { start, end },
      summary: {
        total_visitors: 0,
        total_purchasers: 0,
        avg_touch_count: 0,
        avg_days_to_purchase: 0
      },
      role_distribution: {
        first_touch: { count: 0, ratio: 0 },
        mid_touch: { count: 0, ratio: 0 },
        last_touch: { count: 0, ratio: 0 }
      },
      co_viewed_creatives: [],
      journey_patterns: []
    };
  }
  
  // 구매 및 여정 조회
  const [purchases, journeyRows] = await Promise.all([
    repository.getPurchases({ visitorIds, startDate, endDate }),
    repository.getVisitorJourneys({ visitorIds })
  ]);
  
  const purchaserIds = [...new Set(purchases.map(p => p.visitor_id))];
  const visitorJourneys = groupJourneysByVisitor(journeyRows);
  
  // 광고 역할 비율 계산
  let firstTouchCount = 0;
  let midTouchCount = 0;
  let lastTouchCount = 0;
  let totalTouchCount = 0;
  let totalDaysToConvert = 0;
  let validDaysCount = 0;
  
  const coViewedMap = new Map();
  const journeyPatternMap = new Map();
  
  purchaserIds.forEach(visitorId => {
    const journey = visitorJourneys[visitorId] || [];
    if (journey.length === 0) return;
    
    // 고유한 광고 조합 추출
    const uniqueCreatives = [];
    const seenKeys = new Set();
    
    journey.forEach(touch => {
      const touchKey = `${touch.utm_content}||${touch.utm_source}||${touch.utm_medium}||${touch.utm_campaign}`;
      if (!seenKeys.has(touchKey)) {
        seenKeys.add(touchKey);
        uniqueCreatives.push({
          key: touchKey,
          name: touch.utm_content,
          source: touch.utm_source,
          timestamp: touch.entry_timestamp
        });
      }
    });
    
    totalTouchCount += uniqueCreatives.length;
    
    // 타겟 광고의 역할 파악
    const targetIndex = uniqueCreatives.findIndex(c => c.key === targetCreativeKey);
    if (targetIndex === -1) return;
    
    if (targetIndex === 0 && uniqueCreatives.length === 1) {
      lastTouchCount++;
    } else if (targetIndex === 0) {
      firstTouchCount++;
    } else if (targetIndex === uniqueCreatives.length - 1) {
      lastTouchCount++;
    } else {
      midTouchCount++;
    }
    
    // 함께 본 광고 집계
    uniqueCreatives.forEach(creative => {
      if (creative.key !== targetCreativeKey) {
        if (!coViewedMap.has(creative.key)) {
          coViewedMap.set(creative.key, {
            creative_name: creative.name,
            utm_source: creative.source,
            count: 0,
            purchasers: new Set()
          });
        }
        const data = coViewedMap.get(creative.key);
        data.count++;
        data.purchasers.add(visitorId);
      }
    });
    
    // 여정 패턴 집계
    const patternNames = uniqueCreatives.slice(0, 5).map(c => c.name);
    patternNames.push('구매');
    const patternString = patternNames.join(' → ');
    journeyPatternMap.set(patternString, (journeyPatternMap.get(patternString) || 0) + 1);
    
    // 구매 소요 시간 계산
    const visitorPurchases = purchases.filter(p => p.visitor_id === visitorId);
    if (visitorPurchases.length > 0 && uniqueCreatives.length > 0) {
      const firstTouchTime = new Date(uniqueCreatives[0].timestamp);
      const purchaseTime = new Date(visitorPurchases[0].order_date);
      const daysDiff = (purchaseTime - firstTouchTime) / (1000 * 60 * 60 * 24);
      if (daysDiff >= 0) {
        totalDaysToConvert += daysDiff;
        validDaysCount++;
      }
    }
  });
  
  // 결과 가공
  const totalRoleCount = firstTouchCount + midTouchCount + lastTouchCount;
  
  const roleDistribution = {
    first_touch: {
      count: firstTouchCount,
      ratio: totalRoleCount > 0 ? Math.round(firstTouchCount / totalRoleCount * 100 * 10) / 10 : 0
    },
    mid_touch: {
      count: midTouchCount,
      ratio: totalRoleCount > 0 ? Math.round(midTouchCount / totalRoleCount * 100 * 10) / 10 : 0
    },
    last_touch: {
      count: lastTouchCount,
      ratio: totalRoleCount > 0 ? Math.round(lastTouchCount / totalRoleCount * 100 * 10) / 10 : 0
    }
  };
  
  const coViewedCreatives = Array.from(coViewedMap.entries())
    .map(([key, data]) => ({
      creative_name: data.creative_name,
      utm_source: data.utm_source,
      co_view_count: data.count,
      co_purchaser_count: data.purchasers.size,
      co_conversion_rate: data.count > 0 ? Math.round(data.purchasers.size / data.count * 100 * 10) / 10 : 0
    }))
    .sort((a, b) => b.co_view_count - a.co_view_count)
    .slice(0, 10)
    .map((item, index) => ({ rank: index + 1, ...item }));
  
  const journeyPatterns = Array.from(journeyPatternMap.entries())
    .map(([pattern, count]) => ({ pattern, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  return {
    success: true,
    creative: { creative_name, utm_source, utm_medium, utm_campaign },
    period: { start, end },
    summary: {
      total_visitors: visitorIds.length,
      total_purchasers: purchaserIds.length,
      avg_touch_count: purchaserIds.length > 0 ? Math.round(totalTouchCount / purchaserIds.length * 10) / 10 : 0,
      avg_days_to_purchase: validDaysCount > 0 ? Math.round(totalDaysToConvert / validDaysCount * 10) / 10 : 0
    },
    role_distribution: roleDistribution,
    co_viewed_creatives: coViewedCreatives,
    journey_patterns: journeyPatterns
  };
}

/**
 * 특정 광고 소재의 랜딩페이지 분석
 */
async function getCreativeLandingPages(params) {
  const { creative_name, utm_source, utm_medium, utm_campaign, start, end } = params;
  
  // 파라미터 검증
  validateCreativeParams(params);
  
  const { startDate, endDate } = parseDates(start, end);
  
  // visitor 조회
  const visitorIds = await repository.getCreativeVisitors({
    creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate
  });
  
  if (visitorIds.length === 0) {
    return {
      success: true,
      creative: { creative_name, utm_source, utm_medium, utm_campaign },
      period: { start, end },
      summary: {
        total_visitors: 0,
        avg_pageviews: 0,
        avg_duration_seconds: 0,
        bounce_rate: 0,
        conversion_rate: 0
      },
      top_pages: [],
      exit_pages: [],
      purchaser_comparison: {
        purchasers: { count: 0, avg_pageviews: 0, avg_duration: 0 },
        non_purchasers: { count: 0, avg_pageviews: 0, avg_duration: 0 }
      }
    };
  }
  
  // 구매자 목록 조회
  const purchaserIds = await repository.getPurchasers({ visitorIds, startDate, endDate });
  const nonPurchaserIds = visitorIds.filter(id => !purchaserIds.includes(id));
  
  // 요약 통계 조회
  const summary = await repository.getSummaryStats({ visitorIds, startDate, endDate });
  const conversionRate = visitorIds.length > 0 
    ? Math.round(purchaserIds.length / visitorIds.length * 1000) / 10 
    : 0;
  
  // 많이 본 페이지, 이탈 페이지 조회
  const [topPagesRows, exitPagesRows] = await Promise.all([
    repository.getTopPages({ visitorIds, startDate, endDate }),
    repository.getExitPages({ visitorIds, startDate, endDate })
  ]);
  
  const totalVisitors = visitorIds.length;
  const topPages = topPagesRows.map((row, index) => ({
    rank: index + 1,
    page_url: row.page_url,
    page_title: row.page_title || null,
    visitor_count: parseInt(row.visitor_count) || 0,
    view_count: parseInt(row.view_count) || 0,
    visitor_ratio: totalVisitors > 0 
      ? Math.round(parseInt(row.visitor_count) / totalVisitors * 100) 
      : 0,
    avg_time_spent: parseInt(row.avg_time_spent) || 0
  }));
  
  // 이탈 페이지 처리 (각 페이지의 총 방문 수 조회)
  const exitPages = await Promise.all(exitPagesRows.map(async (row, index) => {
    const pageVisitors = await repository.getPageVisitors({ visitorIds, pageUrl: row.page_url, startDate, endDate });
    const exitCount = parseInt(row.exit_count) || 0;
    const exitRate = pageVisitors > 0 ? Math.round(exitCount / pageVisitors * 100) : 0;
    
    // 개선 힌트 생성
    let improvementHint = '';
    const urlLower = (row.page_url || '').toLowerCase();
    
    if (urlLower.includes('cart') || urlLower.includes('basket') || urlLower.includes('장바구니')) {
      improvementHint = '결제 유도 필요';
    } else if (urlLower.includes('product') || urlLower.includes('detail') || urlLower.includes('goods')) {
      improvementHint = '상품 정보 보완';
    } else if (urlLower.includes('category') || urlLower.includes('list')) {
      improvementHint = '상품 추천 강화';
    } else if (urlLower.includes('main') || urlLower === '/' || urlLower.endsWith('.com/') || urlLower.endsWith('.com')) {
      improvementHint = '흥미 유발 콘텐츠 필요';
    } else if (urlLower.includes('order') || urlLower.includes('checkout')) {
      improvementHint = '결제 과정 간소화';
    } else {
      improvementHint = '페이지 콘텐츠 점검';
    }
    
    return {
      rank: index + 1,
      page_url: row.page_url,
      exit_count: exitCount,
      exit_rate: exitRate,
      improvement_hint: improvementHint
    };
  }));
  
  // 구매자 vs 비구매자 비교
  const [purchaserStats, nonPurchaserStats, purchaserProductViews, nonPurchaserProductViews] = await Promise.all([
    purchaserIds.length > 0 
      ? repository.getPurchaserStats({ visitorIds: purchaserIds, startDate, endDate })
      : { avg_pageviews: 0, avg_duration: 0 },
    nonPurchaserIds.length > 0
      ? repository.getPurchaserStats({ visitorIds: nonPurchaserIds, startDate, endDate })
      : { avg_pageviews: 0, avg_duration: 0 },
    repository.getProductViews({ visitorIds: purchaserIds }),
    repository.getProductViews({ visitorIds: nonPurchaserIds })
  ]);
  
  const purchaserComparison = {
    purchasers: {
      count: purchaserIds.length,
      avg_pageviews: parseFloat(purchaserStats.avg_pageviews) || 0,
      avg_duration: parseInt(purchaserStats.avg_duration) || 0,
      avg_product_views: purchaserProductViews
    },
    non_purchasers: {
      count: nonPurchaserIds.length,
      avg_pageviews: parseFloat(nonPurchaserStats.avg_pageviews) || 0,
      avg_duration: parseInt(nonPurchaserStats.avg_duration) || 0,
      avg_product_views: nonPurchaserProductViews
    }
  };
  
  // 인사이트 생성
  let insight = '';
  const pvRatio = purchaserComparison.non_purchasers.avg_pageviews > 0
    ? (purchaserComparison.purchasers.avg_pageviews / purchaserComparison.non_purchasers.avg_pageviews).toFixed(1)
    : 0;
  
  if (purchaserComparison.purchasers.count > 0 && purchaserComparison.non_purchasers.count > 0) {
    if (parseFloat(pvRatio) > 1.5) {
      insight = `구매자는 비구매자보다 평균 ${pvRatio}배 더 많은 페이지를 봅니다. 상품 상세 페이지 노출을 늘리면 전환율이 높아질 수 있습니다.`;
    } else if (purchaserComparison.purchasers.avg_product_views > purchaserComparison.non_purchasers.avg_product_views * 1.5) {
      insight = `구매자는 상품 상세 페이지를 더 많이 봅니다. 추천 상품 노출을 강화해보세요.`;
    } else {
      insight = `구매자와 비구매자의 페이지 탐색 패턴이 유사합니다. 결제 과정 개선에 집중해보세요.`;
    }
  } else if (purchaserComparison.purchasers.count === 0) {
    insight = `아직 구매 전환이 발생하지 않았습니다. 랜딩페이지와 상품 구성을 점검해보세요.`;
  }
  
  return {
    success: true,
    creative: { creative_name, utm_source, utm_medium, utm_campaign },
    period: { start, end },
    summary: {
      total_visitors: visitorIds.length,
      avg_pageviews: parseFloat(summary.avg_pageviews) || 0,
      avg_duration_seconds: parseInt(summary.avg_duration_seconds) || 0,
      bounce_rate: parseFloat(summary.bounce_rate) || 0,
      conversion_rate: conversionRate
    },
    top_pages: topPages,
    exit_pages: exitPages,
    purchaser_comparison: purchaserComparison,
    insight: insight
  };
}

/**
 * 여러 광고 소재 비교 분석
 */
async function compareCreatives(params) {
  const { creatives, start, end } = params;
  
  // 파라미터 검증
  if (!creatives || !Array.isArray(creatives) || creatives.length < 2 || creatives.length > 5) {
    throw new Error('2~5개의 광고 소재를 선택해주세요');
  }
  
  if (!start || !end) {
    throw new Error('start, end are required');
  }
  
  const { startDate, endDate } = parseDates(start, end);
  
  const creativesData = [];
  const dailyTrends = [];
  const roleComparison = [];
  
  // 각 소재별 데이터 조회
  for (const creative of creatives) {
    const { creative_name, utm_source, utm_medium, utm_campaign } = creative;
    const targetKey = `${creative_name}||${utm_source}||${utm_medium}||${utm_campaign}`;
    
    // visitor 조회
    const visitorIds = await repository.getCreativeVisitors({
      creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate
    });
    
    if (visitorIds.length === 0) {
      creativesData.push({
        creative_name, utm_source,
        uv: 0, conversion_count: 0, conversion_rate: 0,
        revenue: 0, attributed_revenue: 0, avg_duration: 0,
        avg_pageviews: 0, bounce_rate: 0
      });
      dailyTrends.push([]);
      roleComparison.push({
        creative_name,
        first_touch_ratio: 0, mid_touch_ratio: 0,
        last_touch_ratio: 0, dominant_role: null
      });
      continue;
    }
    
    // 핵심 지표, 이탈률, 전환 통계 조회
    const [metrics, bounceRate, conversionStats] = await Promise.all([
      repository.getCreativeMetrics({ creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate }),
      repository.getBounceRate({ visitorIds, startDate, endDate }),
      repository.getConversionStats({ visitorIds, startDate, endDate })
    ]);
    
    const uv = parseInt(metrics.uv) || 0;
    const conversionRate = uv > 0 ? Math.round(conversionStats.conversion_count / uv * 1000) / 10 : 0;
    
    // 막타 매출 계산
    const lastTouchRevenue = await repository.getLastTouchRevenue({
      visitorIds, startDate, endDate, creative_name, utm_source, utm_medium, utm_campaign
    });
    
    creativesData.push({
      creative_name, utm_source, uv,
      conversion_count: conversionStats.conversion_count,
      conversion_rate: conversionRate,
      revenue: lastTouchRevenue,
      attributed_revenue: Math.round(conversionStats.total_revenue * 0.5),
      avg_duration: parseInt(metrics.avg_duration) || 0,
      avg_pageviews: parseFloat(metrics.avg_pageviews) || 0,
      bounce_rate: bounceRate
    });
    
    // 일별 추이 조회
    const dailyRows = await repository.getDailyTrends({
      creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate, visitorIds
    });
    dailyTrends.push(dailyRows.map(row => ({
      date: row.date,
      uv: parseInt(row.uv) || 0,
      conversion_count: parseInt(row.conversion_count) || 0,
      revenue: Math.round(parseFloat(row.revenue) || 0)
    })));
    
    // 광고 역할 분포
    const purchaserIds = await repository.getPurchasers({ visitorIds, startDate, endDate });
    
    if (purchaserIds.length === 0) {
      roleComparison.push({
        creative_name,
        first_touch_ratio: 0, mid_touch_ratio: 0,
        last_touch_ratio: 0, dominant_role: null
      });
      continue;
    }
    
    const journeyRows = await repository.getVisitorJourneys({ visitorIds: purchaserIds });
    const visitorJourneys = groupJourneysByVisitor(journeyRows);
    
    let firstTouchCount = 0;
    let midTouchCount = 0;
    let lastTouchCount = 0;
    
    purchaserIds.forEach(vid => {
      const journey = visitorJourneys[vid] || [];
      if (journey.length === 0) return;
      
      const uniqueCreatives = [];
      const seenKeys = new Set();
      
      journey.forEach(touch => {
        const touchKey = `${touch.utm_content}||${touch.utm_source}||${touch.utm_medium}||${touch.utm_campaign}`;
        if (!seenKeys.has(touchKey)) {
          seenKeys.add(touchKey);
          uniqueCreatives.push(touchKey);
        }
      });
      
      const targetIndex = uniqueCreatives.indexOf(targetKey);
      if (targetIndex === -1) return;
      
      if (targetIndex === 0 && uniqueCreatives.length === 1) {
        lastTouchCount++;
      } else if (targetIndex === 0) {
        firstTouchCount++;
      } else if (targetIndex === uniqueCreatives.length - 1) {
        lastTouchCount++;
      } else {
        midTouchCount++;
      }
    });
    
    const totalRoleCount = firstTouchCount + midTouchCount + lastTouchCount;
    const firstRatio = totalRoleCount > 0 ? Math.round(firstTouchCount / totalRoleCount * 100) : 0;
    const midRatio = totalRoleCount > 0 ? Math.round(midTouchCount / totalRoleCount * 100) : 0;
    const lastRatio = totalRoleCount > 0 ? Math.round(lastTouchCount / totalRoleCount * 100) : 0;
    
    let dominantRole = null;
    if (lastRatio >= 40) {
      dominantRole = '막타형';
    } else if (firstRatio >= 40) {
      dominantRole = '첫 접점형';
    } else if (midRatio >= 30) {
      dominantRole = '중간 터치형';
    }
    
    roleComparison.push({
      creative_name,
      first_touch_ratio: firstRatio,
      mid_touch_ratio: midRatio,
      last_touch_ratio: lastRatio,
      dominant_role: dominantRole
    });
  }
  
  return {
    success: true,
    period: { start, end },
    creatives_data: creativesData,
    daily_trends: dailyTrends,
    role_comparison: roleComparison
  };
}

/**
 * Raw Data 검증: 트래픽 지표 + 세션 목록
 */
async function getRawTrafficData(params) {
  const { creative_name, utm_source, utm_medium, utm_campaign, start, end } = params;
  
  // 파라미터 검증
  validateCreativeParams(params);
  
  const { startDate, endDate } = parseDates(start, end);
  
  // 트래픽 요약 및 세션 목록 조회
  const [summary, sessions] = await Promise.all([
    repository.getRawTrafficSummary({ creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate }),
    repository.getRawSessions({ creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate })
  ]);
  
  // 세션 데이터 가공
  const formattedSessions = sessions.map(s => ({
    id: s.id,
    visitor_id: s.visitor_id,
    entry_timestamp: s.entry_timestamp,
    duration_seconds: parseInt(s.duration_seconds) || 0,
    pageview_count: parseInt(s.pageview_count) || 0,
    device_type: s.device_type || 'unknown',
    browser: s.browser || 'unknown'
  }));
  
  return {
    success: true,
    creative: { creative_name, utm_source, utm_medium, utm_campaign },
    period: { start, end },
    summary: {
      total_views: parseInt(summary.total_views) || 0,
      unique_visitors: parseInt(summary.unique_visitors) || 0,
      avg_pageviews: parseFloat(summary.avg_pageviews) || 0,
      avg_duration_seconds: parseFloat(summary.avg_duration_seconds) || 0
    },
    sessions: formattedSessions
  };
}

/**
 * Raw Data 검증: 매출 지표 + 기여 주문 상세
 */
async function getRawAttributionData(params) {
  const { creative_name, utm_source, utm_medium, utm_campaign, start, end } = params;
  
  // 파라미터 검증
  validateCreativeParams(params);
  
  const { startDate, endDate } = parseDates(start, end);
  const targetCreativeKey = `${creative_name}||${utm_source}||${utm_medium}||${utm_campaign}`;
  
  // visitor 조회
  const visitorIds = await repository.getCreativeVisitors({
    creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate
  });
  
  if (visitorIds.length === 0) {
    return {
      success: true,
      creative: { creative_name, utm_source, utm_medium, utm_campaign },
      period: { start, end },
      summary: {
        contributed_orders_count: 0,
        last_touch_count: 0,
        last_touch_revenue: 0,
        attributed_revenue: 0
      },
      orders: []
    };
  }
  
  // 주문 및 여정 조회
  const [allOrders, journeyRows] = await Promise.all([
    repository.getVisitorOrders({ visitorIds, startDate, endDate }),
    repository.getVisitorJourneys({ visitorIds })
  ]);
  
  if (allOrders.length === 0) {
    return {
      success: true,
      creative: { creative_name, utm_source, utm_medium, utm_campaign },
      period: { start, end },
      summary: {
        contributed_orders_count: 0,
        last_touch_count: 0,
        last_touch_revenue: 0,
        attributed_revenue: 0
      },
      orders: []
    };
  }
  
  // visitor별 여정 그룹화
  const visitorJourneys = groupJourneysByVisitor(journeyRows);
  
  // 기여도 상세 계산
  const attributionDetails = [];
  let totalContributedOrders = 0;
  let totalLastTouchCount = 0;
  let totalLastTouchRevenue = 0;
  let totalAttributedRevenue = 0;
  
  allOrders.forEach(order => {
    const journey = visitorJourneys[order.visitor_id] || [];
    if (journey.length === 0) return;
    
    // 고유 광고 조합 수집
    const uniqueCreativesMap = new Map();
    journey.forEach(touch => {
      const touchKey = `${touch.utm_content}||${touch.utm_source}||${touch.utm_medium}||${touch.utm_campaign}`;
      if (!uniqueCreativesMap.has(touchKey) || touch.sequence_order > uniqueCreativesMap.get(touchKey).sequence_order) {
        uniqueCreativesMap.set(touchKey, touch);
      }
    });
    
    const uniqueCreativeKeys = Array.from(uniqueCreativesMap.keys());
    
    // 이 광고가 여정에 포함되어 있는지 확인
    if (!uniqueCreativeKeys.includes(targetCreativeKey)) return;
    
    // 막타 찾기
    const lastTouch = journey.reduce((max, current) => 
      current.sequence_order > max.sequence_order ? current : max
    );
    const lastTouchKey = `${lastTouch.utm_content}||${lastTouch.utm_source}||${lastTouch.utm_medium}||${lastTouch.utm_campaign}`;
    
    const finalPayment = parseFloat(order.final_payment) || 0;
    const isLastTouch = lastTouchKey === targetCreativeKey;
    const assistCreativeKeys = uniqueCreativeKeys.filter(key => key !== lastTouchKey);
    const assistCount = assistCreativeKeys.length;
    
    // 기여도 계산
    let role = '';
    let contributionRatio = 0;
    let attributedAmount = 0;
    
    if (isLastTouch) {
      role = '막타';
      if (assistCount === 0) {
        contributionRatio = 100;
        attributedAmount = finalPayment;
      } else {
        contributionRatio = 50;
        attributedAmount = finalPayment * 0.5;
      }
      totalLastTouchCount++;
      totalLastTouchRevenue += finalPayment;
    } else {
      role = '어시';
      contributionRatio = assistCount > 0 ? Math.round(50 / assistCount) : 0;
      attributedAmount = assistCount > 0 ? (finalPayment * 0.5) / assistCount : 0;
    }
    
    totalContributedOrders++;
    totalAttributedRevenue += attributedAmount;
    
    attributionDetails.push({
      order_id: order.order_id,
      order_date: order.order_date,
      final_payment: Math.round(finalPayment),
      role: role,
      journey_count: uniqueCreativeKeys.length,
      contribution_ratio: contributionRatio,
      attributed_amount: Math.round(attributedAmount),
      product_name: order.product_name || '-'
    });
  });
  
  return {
    success: true,
    creative: { creative_name, utm_source, utm_medium, utm_campaign },
    period: { start, end },
    summary: {
      contributed_orders_count: totalContributedOrders,
      last_touch_count: totalLastTouchCount,
      last_touch_revenue: Math.round(totalLastTouchRevenue),
      attributed_revenue: Math.round(totalAttributedRevenue)
    },
    orders: attributionDetails.sort((a, b) => new Date(b.order_date) - new Date(a.order_date))
  };
}

/**
 * 체류시간 분포 조회
 * 선택한 기간 내 주문이 발생한 구매자의 체류시간 분포
 */
async function getDurationDistribution(params) {
  const { start, end, utm_filters = '[]' } = params;
  
  // 날짜 파라미터 검증
  if (!start || !end) {
    throw new Error('start, end are required');
  }
  
  const { startDate, endDate } = parseDates(start, end);
  
  // UTM 필터 파싱
  let utmFilterConditions = '';
  const queryParams = [startDate, endDate];
  let paramIndex = 3;
  
  try {
    const filters = JSON.parse(utm_filters);
    if (Array.isArray(filters) && filters.length > 0) {
      filters.forEach(filter => {
        if (filter.field && filter.value) {
          const fieldMap = {
            'utm_source': "us.utm_params->>'utm_source'",
            'utm_medium': "us.utm_params->>'utm_medium'",
            'utm_campaign': "us.utm_params->>'utm_campaign'",
            'utm_content': "us.utm_params->>'utm_content'"
          };
          const dbField = fieldMap[filter.field];
          if (dbField) {
            utmFilterConditions += ` AND ${dbField} = $${paramIndex}`;
            queryParams.push(filter.value);
            paramIndex++;
          }
        }
      });
    }
  } catch (e) {
    // 파싱 실패 시 필터 무시
  }
  
  // Repository에서 분포 데이터 조회
  const result = await repository.getDurationDistribution({
    startDate,
    endDate,
    utmFilterConditions,
    queryParams
  });
  
  // 응답 데이터 가공
  const { distribution, stats } = result;
  const totalOrders = stats.total_orders;
  
  // 비율 계산 (초/분 단위 구간)
  const distributionWithRatio = {
    range_0_30: {
      count: distribution.range_0_30,
      ratio: totalOrders > 0 ? Math.round(distribution.range_0_30 / totalOrders * 1000) / 10 : 0,
      label: '0~30초'
    },
    range_30_60: {
      count: distribution.range_30_60,
      ratio: totalOrders > 0 ? Math.round(distribution.range_30_60 / totalOrders * 1000) / 10 : 0,
      label: '30초~1분'
    },
    range_60_180: {
      count: distribution.range_60_180,
      ratio: totalOrders > 0 ? Math.round(distribution.range_60_180 / totalOrders * 1000) / 10 : 0,
      label: '1~3분'
    },
    range_180_300: {
      count: distribution.range_180_300,
      ratio: totalOrders > 0 ? Math.round(distribution.range_180_300 / totalOrders * 1000) / 10 : 0,
      label: '3~5분'
    },
    range_300_600: {
      count: distribution.range_300_600,
      ratio: totalOrders > 0 ? Math.round(distribution.range_300_600 / totalOrders * 1000) / 10 : 0,
      label: '5~10분'
    },
    range_600_900: {
      count: distribution.range_600_900,
      ratio: totalOrders > 0 ? Math.round(distribution.range_600_900 / totalOrders * 1000) / 10 : 0,
      label: '10~15분'
    },
    range_900_1200: {
      count: distribution.range_900_1200,
      ratio: totalOrders > 0 ? Math.round(distribution.range_900_1200 / totalOrders * 1000) / 10 : 0,
      label: '15~20분'
    },
    range_1200_1800: {
      count: distribution.range_1200_1800,
      ratio: totalOrders > 0 ? Math.round(distribution.range_1200_1800 / totalOrders * 1000) / 10 : 0,
      label: '20~30분'
    },
    range_1800_2400: {
      count: distribution.range_1800_2400,
      ratio: totalOrders > 0 ? Math.round(distribution.range_1800_2400 / totalOrders * 1000) / 10 : 0,
      label: '30~40분'
    },
    range_2400_3000: {
      count: distribution.range_2400_3000,
      ratio: totalOrders > 0 ? Math.round(distribution.range_2400_3000 / totalOrders * 1000) / 10 : 0,
      label: '40~50분'
    },
    range_3000_3600: {
      count: distribution.range_3000_3600,
      ratio: totalOrders > 0 ? Math.round(distribution.range_3000_3600 / totalOrders * 1000) / 10 : 0,
      label: '50~60분'
    },
    range_3600_7200: {
      count: distribution.range_3600_7200,
      ratio: totalOrders > 0 ? Math.round(distribution.range_3600_7200 / totalOrders * 1000) / 10 : 0,
      label: '60분 이상'
    }
  };
  
  // 평균 체류시간 포맷
  const avgDurationFormatted = formatDuration(stats.avg_duration);
  const medianDurationFormatted = formatDuration(stats.median_duration);
  
  return {
    success: true,
    period: { start, end },
    distribution: distributionWithRatio,
    stats: {
      total_orders: stats.total_orders,
      avg_duration_seconds: stats.avg_duration,
      avg_duration_formatted: avgDurationFormatted,
      median_duration_seconds: stats.median_duration,
      median_duration_formatted: medianDurationFormatted
    }
  };
}

/**
 * 초를 "X분 Y초" 형태로 포맷
 */
function formatDuration(seconds) {
  if (seconds < 60) {
    return `${seconds}초`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}분 ${secs}초` : `${mins}분`;
}

module.exports = {
  getCreativeOrders,
  getCreativeAnalysis,
  getCreativeJourney,
  getCreativeLandingPages,
  compareCreatives,
  getRawTrafficData,
  getRawAttributionData,
  getDurationDistribution
};
