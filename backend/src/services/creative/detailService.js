/**
 * 광고 소재 상세 분석 Service
 * POST 엔드포인트들의 비즈니스 로직 담당
 */

const repository = require('./detailRepository');
const { getMetaAdNames, getAllVariantNames } = require('./metaAdNameMapping');
const db = require('../../utils/database');
const { safeDecodeURIComponent } = require('./utils');

// 기여 인정 기간 기본값 (일 단위) - 구매일 기준 이 기간 내에 본 광고만 기여 인정
// FIX (2026-02-04): 사용자가 선택할 수 있도록 변경 (30, 60, 90, null=전체)
const DEFAULT_ATTRIBUTION_WINDOW_DAYS = 30;

/**
 * DB에서 해당 기간 내 존재하는 광고명 목록 조회 (변형 찾기용)
 * FIX (2026-02-02): URL 인코딩된 광고명을 safeDecodeURIComponent로 디코딩
 * - DB에 URL 인코딩된 광고명이 저장될 수 있음 (Tracker에서 인코딩된 상태로 전송)
 * - 테이블과 동일하게 디코딩해야 변형 찾기가 정확하게 동작함
 * 
 * @returns {Object} { decodedNames: string[], rawToDecoded: Map<string, string> }
 */
async function getDbCreativeNamesWithMapping(startDate, endDate) {
  const query = `
    SELECT DISTINCT us.utm_params->>'utm_content' as creative_name
    FROM utm_sessions us
    JOIN visitors v ON us.visitor_id = v.visitor_id
    WHERE us.utm_params->>'utm_content' IS NOT NULL
      AND us.entry_timestamp >= $1
      AND us.entry_timestamp <= $2
      AND v.is_bot = false
  `;
  const result = await db.query(query, [startDate, endDate]);
  
  // 원본 → 디코딩 매핑 생성
  const rawToDecoded = new Map();
  const decodedToRaw = new Map(); // 디코딩 결과 → 원본들 (여러 원본이 같은 결과로 디코딩될 수 있음)
  const decodedNames = new Set();
  
  for (const row of result.rows) {
    const raw = row.creative_name;
    const decoded = safeDecodeURIComponent(raw);
    if (decoded) {
      rawToDecoded.set(raw, decoded);
      decodedNames.add(decoded);
      
      // 디코딩 결과 → 원본 매핑 (배열로 저장)
      if (!decodedToRaw.has(decoded)) {
        decodedToRaw.set(decoded, []);
      }
      decodedToRaw.get(decoded).push(raw);
    }
  }
  
  return { 
    decodedNames: Array.from(decodedNames), 
    rawToDecoded, 
    decodedToRaw 
  };
}

/**
 * 광고명의 모든 변형을 찾아서 배열로 반환 (원본 DB 값 기준)
 * FIX (2026-02-02): 디코딩된 값으로 변형을 찾고, 해당 변형의 원본 DB 값을 반환
 * - detailRepository의 쿼리는 원본 DB 값을 기준으로 조회함
 * - URL 인코딩된 광고명도 쿼리에서 찾을 수 있도록 원본 값 반환
 * 
 * @param {string} creative_name - 요청받은 광고명
 * @param {Date} startDate - 시작일
 * @param {Date} endDate - 종료일
 * @returns {Promise<string[]>} - 변형 광고명들의 배열 (원본 DB 값)
 */
async function getCreativeVariants(creative_name, startDate, endDate) {
  // DB에서 해당 기간 내 존재하는 광고명 목록 조회 (매핑 포함)
  const { decodedNames, decodedToRaw } = await getDbCreativeNamesWithMapping(startDate, endDate);
  
  // 메타 API에서 등록된 광고명 목록 조회 (별도 광고 판별용)
  const metaAdNames = await getMetaAdNames();
  
  // 요청받은 광고명이 메타 광고명인 경우 변형들 찾기
  // 메타에 별도로 등록된 광고는 변형에서 제외
  const decodedVariants = getAllVariantNames(creative_name, decodedNames, metaAdNames);
  
  // 디코딩된 변형들의 원본 DB 값들을 수집
  const rawVariants = new Set();
  for (const decoded of decodedVariants) {
    const rawValues = decodedToRaw.get(decoded);
    if (rawValues) {
      for (const raw of rawValues) {
        rawVariants.add(raw);
      }
    } else {
      // 매핑이 없으면 그대로 사용 (이미 원본 값일 수 있음)
      rawVariants.add(decoded);
    }
  }
  
  return rawVariants.size > 0 ? Array.from(rawVariants) : [creative_name];
}

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
 * FIX (2026-01-27): creative_name 빈 문자열 허용
 * - 실제로 utm_content가 빈 문자열로 저장된 데이터가 존재함
 * - 빈 문자열도 유효한 creative_name으로 처리
 */
function validateCreativeParams({ creative_name, utm_source, utm_medium, utm_campaign, start, end }) {
  // creative_name은 빈 문자열도 허용 (undefined/null만 거부)
  if (creative_name === undefined || creative_name === null) {
    throw new Error('creative_name is required');
  }
  if (!utm_source || !utm_medium || !utm_campaign || !start || !end) {
    throw new Error('utm_source, utm_medium, utm_campaign, start, end are required');
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
 * 구매일 기준 N일 이내 여정만 필터링
 * FIX (2026-02-04): Attribution Window를 사용자가 선택할 수 있도록 변경
 * @param {Array} journey - 광고 여정 목록
 * @param {Date|string} purchaseDate - 구매일
 * @param {number|null} attributionWindowDays - Attribution Window 일수 (null이면 전체 기간)
 */
function filterJourneyByAttributionWindow(journey, purchaseDate, attributionWindowDays = DEFAULT_ATTRIBUTION_WINDOW_DAYS) {
  const orderDate = new Date(purchaseDate);
  
  // attributionWindowDays가 null이면 전체 기간 (구매일 이전 모든 광고)
  if (attributionWindowDays === null) {
    return journey.filter(touch => {
      const touchDate = new Date(touch.entry_timestamp);
      return touchDate <= orderDate;
    });
  }
  
  // N일 이내 필터링
  const windowStart = new Date(orderDate);
  windowStart.setDate(windowStart.getDate() - attributionWindowDays);
  
  return journey.filter(touch => {
    const touchDate = new Date(touch.entry_timestamp);
    return touchDate >= windowStart && touchDate <= orderDate;
  });
}

/**
 * 특정 광고 소재에 기여한 주문 목록 조회 (기여도 상세 정보 포함)
 * 
 * 중요: 테이블(creativeAttribution.js)과 동일한 로직으로 계산
 * FIX (2026-02-03): visitor 조회 방식을 creativeAttribution.js와 완전히 동일하게 변경
 * - 기존: UTM 세션 있는 visitor 먼저 조회 → 그 visitor들의 주문 조회 (IP/member_id 연결 누락)
 * - 수정: 모든 구매 먼저 조회 → IP/member_id로 여정 연결 (creativeAttribution.js와 동일)
 * - 구매일 기준 선택한 기간 이내에 본 광고만 기여 인정 (Attribution Window)
 * - 해당 광고가 기간 내 여정에 포함된 경우만 기여 주문으로 인정
 * 
 * FIX (2026-02-04): Attribution Window를 사용자가 선택할 수 있도록 변경
 * FIX (2026-02-05): ad_id 기반으로 변경 (메인 테이블과 동일한 기준)
 * - ad_id가 있으면 ad_id 기반으로 기여도 계산 (메인 테이블과 일치)
 * - ad_id가 없으면 기존 creative_name 기반 (fallback)
 */
async function getCreativeOrders(params) {
  const { ad_id, creative_name, utm_source, utm_medium, utm_campaign, start, end, max_duration = 600, attribution_window } = params;
  
  // FIX (2026-02-04): Attribution Window 파싱
  let attributionWindowDays = DEFAULT_ATTRIBUTION_WINDOW_DAYS;
  if (attribution_window !== undefined) {
    if (attribution_window === 'all' || attribution_window === null) {
      attributionWindowDays = null;
    } else {
      const parsed = parseInt(attribution_window, 10);
      if ([30, 60, 90].includes(parsed)) {
        attributionWindowDays = parsed;
      }
    }
  }
  
  // 파라미터 검증
  validateCreativeParams(params);
  
  const { startDate, endDate } = parseDates(start, end);
  
  // FIX (2026-02-05): ad_id 기반 모드 판별 (메인 테이블과 동일한 기준)
  const useAdId = ad_id && ad_id !== '' && !ad_id.startsWith('{{');
  
  // 타겟 광고 키 생성 (ad_id 기반 또는 creative_name 기반)
  const targetCreativeKey = useAdId
    ? `${ad_id}||${utm_medium}||${utm_campaign}`
    : `${creative_name}||${utm_source}||${utm_medium}||${utm_campaign}`;
  
  // 이상치 기준 검증 (5분~2시간30분, 초 단위)
  const maxDurationSeconds = Math.min(Math.max(parseInt(max_duration) || 600, 300), 9000);
  
  const emptyResponse = {
    success: true,
    data: [],
    attribution_window: attributionWindowDays, // FIX (2026-02-04): 사용자 선택 Attribution Window
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
  
  // FIX (2026-02-03): creativeAttribution.js와 동일하게 모든 구매 먼저 조회
  const allOrders = await repository.getAllOrdersInPeriod({ startDate, endDate });
  
  if (allOrders.length === 0) {
    return emptyResponse;
  }
  
  // 구매한 visitor들의 ID 수집 (인앱 브라우저 대응: session 기반 visitor_id도 포함)
  const purchaserIds = [...new Set(allOrders.flatMap(o => 
    [o.visitor_id, o.session_visitor_id].filter(Boolean)
  ))];
  
  // FIX (2026-02-05): IP 주소 수집 제거 - IP 기반 여정 병합 제거로 불필요
  // - moadamda-access-log 방식: IP 기반은 참고 정보로만 사용
  
  // member_id 수집 (회원 기반 연결)
  const purchaserMemberIds = [...new Set(allOrders
    .map(o => o.member_id)
    .filter(id => id && id !== '')
  )];
  
  // visitor_id 기반 여정 + member_id 기반 여정 병렬 조회
  // FIX (2026-02-05): ad_id 모드일 때 정상 utm_id만 포함 (메인 테이블과 동일)
  // FIX (2026-02-05): IP 기반 여정 병합 제거 - moadamda-access-log 방식 적용
  // - IP 기반은 다른 사용자의 행동이 병합될 수 있어 정확도 문제 발생
  // - member_id 기반만 유지 (동일 회원의 다른 기기)
  const [journeyRows, memberJourneyRows] = await Promise.all([
    repository.getVisitorJourneys({ visitorIds: purchaserIds, onlyValidAdId: useAdId }),
    repository.getVisitorJourneysByMemberId({ purchaserMemberIds, purchaserIds, onlyValidAdId: useAdId })
  ]);
  
  // visitor별 여정 그룹화
  const visitorJourneys = groupJourneysByVisitor(journeyRows);
  
  // member_id별 여정 그룹화
  const memberJourneys = {};
  memberJourneyRows.forEach(row => {
    if (!memberJourneys[row.member_id]) {
      memberJourneys[row.member_id] = [];
    }
    memberJourneys[row.member_id].push(row);
  });
  
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
    // 인앱 브라우저 대응: visitor_id로 못 찾으면 session_visitor_id로 시도
    let fullJourney = visitorJourneys[order.visitor_id] || [];
    if (fullJourney.length === 0 && order.session_visitor_id) {
      fullJourney = visitorJourneys[order.session_visitor_id] || [];
    }
    
    // FIX (2026-02-05): IP 기반 여정 병합 제거
    // - 같은 IP의 다른 사용자 행동이 병합되어 오매칭 발생
    // - moadamda-access-log 방식: IP 기반은 참고 정보로만 사용
    
    // member_id 기반 여정 병합 (회원 기반 연결 - 유지)
    if (order.member_id && order.member_id !== '') {
      const memberJourney = memberJourneys[order.member_id] || [];
      if (memberJourney.length > 0) {
        const existingKeys = new Set(fullJourney.map(j => 
          `${j.entry_timestamp}||${j.utm_content}`
        ));
        const newTouches = memberJourney.filter(j => {
          const key = `${j.entry_timestamp}||${j.utm_content}`;
          return !existingKeys.has(key);
        });
        fullJourney = [...fullJourney, ...newTouches];
      }
    }
    
    // member_id 병합 후 시간순 정렬 및 sequence_order 재할당
    if (fullJourney.length > 1) {
      fullJourney.sort((a, b) => new Date(a.entry_timestamp) - new Date(b.entry_timestamp));
      fullJourney = fullJourney.map((j, idx) => ({ ...j, sequence_order: idx + 1 }));
    }
    
    if (fullJourney.length === 0) return;
    
    // 구매일 기준 N일 이내 여정만 필터링 (사용자 선택 Attribution Window)
    const journey = filterJourneyByAttributionWindow(fullJourney, order.order_date, attributionWindowDays);
    if (journey.length === 0) return;
    
    // 고유한 광고 조합 수집
    // FIX (2026-02-05): ad_id 기반일 때 ad_id를 키로 사용 (메인 테이블과 동일)
    const uniqueCreativesMap = new Map();
    journey.forEach(touch => {
      const touchKey = useAdId
        ? `${touch.ad_id}||${touch.utm_medium}||${touch.utm_campaign}`
        : `${touch.utm_content}||${touch.utm_source}||${touch.utm_medium}||${touch.utm_campaign}`;
      if (!uniqueCreativesMap.has(touchKey) || touch.sequence_order > uniqueCreativesMap.get(touchKey).sequence_order) {
        uniqueCreativesMap.set(touchKey, touch);
      }
    });
    
    const uniqueCreativeKeys = Array.from(uniqueCreativesMap.keys());
    
    // 해당 광고가 Attribution Window 이내 여정에 포함되어 있는지 확인
    if (!uniqueCreativeKeys.includes(targetCreativeKey)) return;
    
    contributedVisitorIds.add(order.visitor_id);
    
    // 막타 찾기 (필터링된 여정 중 sequence_order가 가장 큰 것)
    const lastTouch = journey.reduce((max, current) => 
      current.sequence_order > max.sequence_order ? current : max
    );
    // FIX (2026-02-05): ad_id 기반일 때 ad_id를 키로 사용
    const lastTouchKey = useAdId
      ? `${lastTouch.ad_id}||${lastTouch.utm_medium}||${lastTouch.utm_campaign}`
      : `${lastTouch.utm_content}||${lastTouch.utm_source}||${lastTouch.utm_medium}||${lastTouch.utm_campaign}`;
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
        ad_id: touch.ad_id, // FIX (2026-02-05): ad_id 추가
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
  
  // FIX (2026-02-05): 광고 접촉 횟수는 여정에서 직접 계산하므로 getCreativeTouchCounts 호출 제거
  // - 기존: getCreativeTouchCounts가 visitor_id만 사용하여 IP/member_id 연결 세션 누락
  // - 수정: 기여도 계산 시 사용한 여정 (IP/member_id 병합)에서 직접 접촉 횟수 계산
  const [sessionInfoMap, visitCountMap] = await Promise.all([
    repository.getVisitorSessionInfoForCreative({
      visitorIds: contributedVisitorArray,
      ad_id,
      creative_name,
      utm_source,
      utm_medium,
      utm_campaign,
      startDate,
      endDate,
      maxDurationSeconds
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
    const sessionInfo = sessionInfoMap[order.visitor_id] || { 
      pageview_count: 0, 
      duration_seconds: 0, 
      last_touch_duration: 0,
      last_touch_pageviews: 0,
      visit_count: 0
    };
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
      last_touch_duration: sessionInfo.last_touch_duration,
      last_touch_pageviews: sessionInfo.last_touch_pageviews,
      ad_visit_count: sessionInfo.visit_count,
      total_visits: totalVisits
    };
  });
  
  return {
    success: true,
    creative: { creative_name, utm_source, utm_medium, utm_campaign },
    period: { start, end },
    attribution_window: attributionWindowDays, // FIX (2026-02-04): 사용자 선택 Attribution Window
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
      formula: '기여한 결제액 = 막타100% + 막타50% + 어시기여'
    }
  };
}

/**
 * 특정 광고 소재를 통해 유입된 세션 상세 목록 조회
 * 카페24 호환: visitors.is_bot = false 필터 적용
 * 
 * FIX (2026-02-05): ad_id 기반 조회 지원
 * - ad_id가 있으면 ad_id로 조회 (메인 테이블과 일치)
 * - ad_id가 없으면 기존 creative_name으로 조회 (fallback)
 */
async function getCreativeSessions(params) {
  const { ad_id, creative_name, utm_source, utm_medium, utm_campaign, start, end, page = 1, limit = 50, sortField, sortOrder } = params;
  
  // 파라미터 검증
  validateCreativeParams(params);
  
  const { startDate, endDate } = parseDates(start, end);
  
  // ad_id가 있으면 ad_id 기반 조회, 없으면 광고명 변형 찾아서 조회
  const useAdId = ad_id && ad_id !== '' && !ad_id.startsWith('{{');
  
  // 광고명 변형들 찾기 (ad_id 없을 때 fallback용)
  const creativeVariants = useAdId ? [creative_name] : await getCreativeVariants(creative_name, startDate, endDate);
  
  // 세션 목록 및 총 개수/UV 조회
  const [sessions, countResult] = await Promise.all([
    repository.getCreativeSessions({
      ad_id, creative_name: creativeVariants, utm_source, utm_medium, utm_campaign,
      startDate, endDate, page, limit, sortField, sortOrder
    }),
    repository.getCreativeSessionsCount({
      ad_id, creative_name: creativeVariants, utm_source, utm_medium, utm_campaign,
      startDate, endDate
    })
  ]);
  
  const { uvCount, total: totalCount } = countResult;
  
  // 체류시간 포맷 함수
  const formatDuration = (seconds) => {
    if (!seconds || seconds <= 0) return '0초';
    if (seconds < 60) return `${Math.round(seconds)}초`;
    if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      return secs > 0 ? `${mins}분 ${secs}초` : `${mins}분`;
    }
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
  };
  
  // 세션 데이터 가공
  const formattedSessions = sessions.map(s => ({
    session_id: s.session_id,
    visitor_id: s.visitor_id,
    start_time: s.start_time,
    end_time: s.end_time,
    duration_seconds: parseInt(s.duration_seconds) || 0,
    duration_formatted: formatDuration(parseInt(s.duration_seconds) || 0),
    pageview_count: parseInt(s.pageview_count) || 0,
    total_scroll_px: parseInt(s.total_scroll_px) || 0,
    entry_url: s.entry_url || '-',
    exit_url: s.exit_url || '-',
    is_converted: s.is_converted || false,
    device_type: s.device_type || 'unknown',
    browser: s.browser || 'unknown',
    os: s.os || 'unknown',
    ip_address: s.ip_address || 'unknown'
  }));
  
  return {
    success: true,
    creative: { creative_name, utm_source, utm_medium, utm_campaign },
    period: { start, end },
    data: formattedSessions,
    summary: {
      uvCount,
      totalSessions: totalCount
    },
    pagination: {
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit)
    }
  };
}


/**
 * 특정 광고 소재의 진입 목록 조회 (View 상세)
 * 각 진입 기록을 시간순으로 표시하며, 이전 진입과의 간격도 계산
 * 
 * FIX (2026-02-05): ad_id 기반 조회 지원
 * - ad_id가 있으면 ad_id로 조회 (메인 테이블과 일치)
 * - ad_id가 없으면 기존 creative_name으로 조회 (fallback)
 */
async function getCreativeEntries(params) {
  const { ad_id, creative_name, utm_source, utm_medium, utm_campaign, start, end, page = 1, limit = 50 } = params;
  
  // 파라미터 검증
  validateCreativeParams(params);
  
  const { startDate, endDate } = parseDates(start, end);
  
  // ad_id가 있으면 ad_id 기반 조회, 없으면 광고명 변형 찾아서 조회
  const useAdId = ad_id && ad_id !== '' && !ad_id.startsWith('{{');
  
  // 광고명 변형들 찾기 (ad_id 없을 때 fallback용)
  const creativeVariants = useAdId ? [creative_name] : await getCreativeVariants(creative_name, startDate, endDate);
  
  // 진입 목록 및 총 개수 조회
  const [entries, totalCount] = await Promise.all([
    repository.getCreativeEntries({
      ad_id, creative_name: creativeVariants, utm_source, utm_medium, utm_campaign,
      startDate, endDate, page, limit
    }),
    repository.getCreativeEntriesCount({
      ad_id, creative_name: creativeVariants, utm_source, utm_medium, utm_campaign,
      startDate, endDate
    })
  ]);
  
  // 진입 데이터 가공 (간격 계산)
  const formattedEntries = entries.map((entry, index) => {
    // 이전 진입과의 간격 계산 (같은 visitor 내에서만)
    let gapSeconds = null;
    let gapFormatted = '-';
    
    if (entry.gap_seconds !== null) {
      gapSeconds = parseInt(entry.gap_seconds);
      if (gapSeconds < 60) {
        gapFormatted = `+${gapSeconds}초`;
      } else if (gapSeconds < 3600) {
        const mins = Math.floor(gapSeconds / 60);
        const secs = gapSeconds % 60;
        gapFormatted = secs > 0 ? `+${mins}분 ${secs}초` : `+${mins}분`;
      } else {
        const hours = Math.floor(gapSeconds / 3600);
        const mins = Math.floor((gapSeconds % 3600) / 60);
        gapFormatted = mins > 0 ? `+${hours}시간 ${mins}분` : `+${hours}시간`;
      }
    }
    
    return {
      id: entry.id,
      entry_timestamp: entry.entry_timestamp,
      visitor_id: entry.visitor_id,
      session_id: entry.session_id,
      sequence_order: entry.sequence_order,
      gap_seconds: gapSeconds,
      gap_formatted: gapFormatted
    };
  });
  
  return {
    success: true,
    creative: { creative_name, utm_source, utm_medium, utm_campaign },
    period: { start, end },
    data: formattedEntries,
    pagination: {
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit)
    }
  };
}

/**
 * URL에서 utm_content를 추출하고 디코딩
 * 메타 광고에서 77%처럼 %가 제대로 인코딩 안 된 경우 처리
 * @param {string} url - 전체 URL
 * @returns {string|null} 디코딩된 utm_content 또는 null
 */
function extractAndDecodeUtmContent(url) {
  if (!url) return null;
  
  try {
    const urlObj = new URL(url);
    const utmContent = urlObj.searchParams.get('utm_content');
    if (!utmContent) return null;
    
    // 이미 디코딩된 상태로 반환됨 (URL 클래스가 자동 디코딩)
    return utmContent;
  } catch (e) {
    // URL 파싱 실패 시 수동 추출 시도
    try {
      const match = url.match(/[?&]utm_content=([^&]*)/);
      if (!match) return null;
      
      let encoded = match[1];
      
      // 잘못된 % 인코딩 수정: % 뒤에 두 자리 hex가 아닌 경우 %25로 변환
      // 예: 77%%20 → 77%25%20 (77% 공백)
      encoded = encoded.replace(/%(?![0-9A-Fa-f]{2})/g, '%25');
      
      return decodeURIComponent(encoded);
    } catch (e2) {
      console.warn('[getCreativeOriginalUrl] utm_content 디코딩 실패:', e2.message);
      return null;
    }
  }
}

/**
 * 특정 광고 소재의 원본 URL (대표 랜딩 URL) 조회
 * 
 * @param {Object} params
 * @returns {Object} 대표 URL 정보
 */
async function getCreativeOriginalUrl(params) {
  const { creative_name, utm_source, utm_medium, utm_campaign, start, end } = params;
  
  // 파라미터 검증
  validateCreativeParams(params);
  
  const { startDate, endDate } = parseDates(start, end);
  
  // 광고명 변형들 찾기
  const creativeVariants = await getCreativeVariants(creative_name, startDate, endDate);
  
  // 대표 URL 조회 (가장 많이 유입된 entry_url)
  const result = await repository.getCreativeOriginalUrl({
    creative_name: creativeVariants,
    utm_source,
    utm_medium,
    utm_campaign,
    startDate,
    endDate
  });
  
  // URL에서 utm_content 추출 및 디코딩하여 원본 광고 소재 이름 반환
  const decodedCreativeName = extractAndDecodeUtmContent(result.full_url);
  
  return {
    success: true,
    creative: { creative_name, utm_source, utm_medium, utm_campaign },
    period: { start, end },
    data: {
      ...result,
      // 디코딩된 원본 광고 소재 이름 추가
      decoded_creative_name: decodedCreativeName
    }
  };
}

/**
 * 특정 광고 소재의 세션 차트용 집계 데이터 조회
 * 체류시간/PV/기기/전환/시간대별 분포를 한번에 집계하여 반환
 * 
 * FIX (2026-02-06): 방문자별 세션 상세 모달에서 차트 보기 기능 지원
 */
async function getCreativeSessionsChart(params) {
  const { ad_id, creative_name, utm_source, utm_medium, utm_campaign, start, end } = params;
  
  // 파라미터 검증
  validateCreativeParams(params);
  
  const { startDate, endDate } = parseDates(start, end);
  
  // ad_id가 있으면 ad_id 기반, 없으면 광고명 변형 찾기
  const useAdId = ad_id && ad_id !== '' && !ad_id.startsWith('{{');
  const creativeVariants = useAdId ? [creative_name] : await getCreativeVariants(creative_name, startDate, endDate);
  
  // DB에서 전체 세션의 raw 집계 데이터 조회
  const rows = await repository.getCreativeSessionsChartData({
    ad_id, creative_name: creativeVariants, utm_source, utm_medium, utm_campaign,
    startDate, endDate
  });
  
  if (rows.length === 0) {
    return {
      success: true,
      totalSessions: 0,
      duration_distribution: [],
      device_distribution: [],
      conversion_distribution: [],
      pv_distribution: [],
      hourly_distribution: []
    };
  }
  
  // 1. 체류시간 분포 (구간별 집계)
  const durationBuckets = [
    { label: '0~30초', min: 0, max: 30, count: 0 },
    { label: '30초~2분', min: 30, max: 120, count: 0 },
    { label: '2~5분', min: 120, max: 300, count: 0 },
    { label: '5~10분', min: 300, max: 600, count: 0 },
    { label: '10분+', min: 600, max: Infinity, count: 0 }
  ];
  
  // 2. PV 분포 (구간별 집계)
  const pvBuckets = [
    { label: '1', min: 0, max: 2, count: 0 },
    { label: '2~3', min: 2, max: 4, count: 0 },
    { label: '4~5', min: 4, max: 6, count: 0 },
    { label: '6~10', min: 6, max: 11, count: 0 },
    { label: '11+', min: 11, max: Infinity, count: 0 }
  ];
  
  // 3. 기기 분포
  const deviceMap = {};
  const deviceKorean = { 'mobile': '모바일', 'desktop': 'PC', 'tablet': '태블릿', 'unknown': '기타' };
  
  // 4. 전환 분포
  let convertedCount = 0;
  let bouncedCount = 0;
  
  // 5. 시간대별 분포 (0~23시)
  const hourlyMap = {};
  for (let h = 0; h < 24; h++) {
    hourlyMap[h] = 0;
  }
  
  // 데이터 순회하며 각 분포 집계
  rows.forEach(row => {
    const duration = parseInt(row.duration_seconds) || 0;
    const pv = parseInt(row.pageview_count) || 0;
    const device = row.device_type || 'unknown';
    const converted = row.is_converted;
    const hour = parseInt(row.start_hour) || 0;
    
    // 체류시간 분포
    for (const bucket of durationBuckets) {
      if (duration >= bucket.min && duration < bucket.max) {
        bucket.count++;
        break;
      }
    }
    
    // PV 분포
    for (const bucket of pvBuckets) {
      if (pv >= bucket.min && pv < bucket.max) {
        bucket.count++;
        break;
      }
    }
    
    // 기기 분포
    const deviceLabel = deviceKorean[device] || '기타';
    deviceMap[deviceLabel] = (deviceMap[deviceLabel] || 0) + 1;
    
    // 전환 분포
    if (converted) {
      convertedCount++;
    } else {
      bouncedCount++;
    }
    
    // 시간대별 분포
    hourlyMap[hour]++;
  });
  
  // 결과 가공
  const duration_distribution = durationBuckets
    .filter(b => b.count > 0)
    .map(b => ({ range: b.label, count: b.count }));
  
  // 비어있는 구간도 포함 (시각적 연속성)
  const duration_distribution_full = durationBuckets.map(b => ({ range: b.label, count: b.count }));
  
  const pv_distribution = pvBuckets.map(b => ({ range: b.label, count: b.count }));
  
  const device_distribution = Object.entries(deviceMap)
    .map(([device, count]) => ({ device, count }))
    .sort((a, b) => b.count - a.count);
  
  const conversion_distribution = [
    { type: '구매', count: convertedCount },
    { type: '이탈', count: bouncedCount }
  ];
  
  // 시간대별: 3시간 단위로 묶기 (가독성)
  const hourlyGrouped = [
    { range: '0~3시', count: hourlyMap[0] + hourlyMap[1] + hourlyMap[2] },
    { range: '3~6시', count: hourlyMap[3] + hourlyMap[4] + hourlyMap[5] },
    { range: '6~9시', count: hourlyMap[6] + hourlyMap[7] + hourlyMap[8] },
    { range: '9~12시', count: hourlyMap[9] + hourlyMap[10] + hourlyMap[11] },
    { range: '12~15시', count: hourlyMap[12] + hourlyMap[13] + hourlyMap[14] },
    { range: '15~18시', count: hourlyMap[15] + hourlyMap[16] + hourlyMap[17] },
    { range: '18~21시', count: hourlyMap[18] + hourlyMap[19] + hourlyMap[20] },
    { range: '21~24시', count: hourlyMap[21] + hourlyMap[22] + hourlyMap[23] }
  ];
  
  // FIX (2026-02-06): 세션 내 구매 중 이 광고가 막타인 건수 = 공통 건수 (차이 안내용)
  let sessionPurchaseLastTouchCount = null;
  if (convertedCount > 0 && useAdId) {
    try {
      sessionPurchaseLastTouchCount = await repository.getSessionPurchaseLastTouchCount({
        ad_id, utm_medium, utm_campaign, startDate, endDate
      });
    } catch (e) {
      // 조회 실패 시 null 유지 (안내 UI에만 영향)
    }
  }
  
  return {
    success: true,
    totalSessions: rows.length,
    duration_distribution: duration_distribution_full,
    device_distribution,
    conversion_distribution,
    pv_distribution,
    hourly_distribution: hourlyGrouped,
    // FIX (2026-02-06): UV-막타 차이 안내용 - 세션 내 구매 중 이 광고가 막타인 건수 (공통 건수)
    session_purchase_last_touch_count: sessionPurchaseLastTouchCount
  };
}

module.exports = {
  getCreativeOrders,
  getCreativeSessions,
  getCreativeEntries,
  getCreativeOriginalUrl,
  getCreativeSessionsChart
};
