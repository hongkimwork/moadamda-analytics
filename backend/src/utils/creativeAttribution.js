const db = require('./database');

// 기여 인정 기간 (일 단위) - 구매일 기준 이 기간 내에 본 광고만 기여 인정
const ATTRIBUTION_WINDOW_DAYS = 30;

/**
 * 광고 소재별 기여도 계산 (Last Touch 50% + 어시 균등 분배 50%)
 * 
 * 계산 방식:
 * - 구매일 기준 30일 이내에 본 광고만 기여 인정 (Attribution Window)
 * - 광고 1개만 봤으면: 해당 광고가 100% 기여
 * - 여러 광고를 봤으면: 막타 50% + 나머지 어시 광고들이 50%를 균등 분배
 * - 같은 광고를 여러 번 봤어도 1개로 카운트 (고유 조합 기준)
 * 
 * @param {Array} creatives - 광고 소재 목록 [{ creative_name, utm_source, utm_medium, utm_campaign, ... }]
 * @param {String} startDate - 시작일
 * @param {String} endDate - 종료일
 * @returns {Object} - 광고별 기여도 데이터 { creative_name: { contributed_orders, attributed_revenue, total_revenue } }
 */
async function calculateCreativeAttribution(creatives, startDate, endDate) {
  // 광고 소재를 unique key로 식별 (creative_name + utm_source + utm_medium + utm_campaign)
  const getCreativeKey = (creative) => {
    return `${creative.creative_name}||${creative.utm_source}||${creative.utm_medium}||${creative.utm_campaign}`;
  };
  const result = {};
  
  // 각 광고별로 초기화 (unique key 사용)
  creatives.forEach(creative => {
    const key = getCreativeKey(creative);
    result[key] = {
      contributed_orders_count: 0,      // 결제건 기여 포함 수
      attributed_revenue: 0,             // 결제건 기여 금액
      total_contributed_revenue: 0,      // 기여 결제건 총 결제금액
      single_touch_count: 0,             // 순수전환 횟수 (이 광고만 보고 구매한 횟수)
      last_touch_count: 0,               // 막타 횟수 (마지막으로 본 광고로서 구매한 횟수)
      last_touch_revenue: 0              // 막타 결제액 (마지막으로 본 광고로서 구매한 결제금액)
    };
  });

  // visitor 조회 시작일을 30일 전으로 확장 (기여 인정 기간만큼)
  // 이렇게 해야 선택 기간 시작일에 결제한 사람이 30일 전에 본 광고도 집계됨
  const extendedStartDate = new Date(startDate);
  extendedStartDate.setDate(extendedStartDate.getDate() - ATTRIBUTION_WINDOW_DAYS);

  // [최적화] 모든 광고의 visitor를 단일 쿼리로 조회 (N+1 문제 해결)
  const allVisitorIds = new Set();
  const creativeVisitorMap = {}; // { creative_key: Set<visitor_ids> }
  
  // 결과 키 초기화
  creatives.forEach(creative => {
    const key = getCreativeKey(creative);
    creativeVisitorMap[key] = new Set();
  });

  // 단일 쿼리로 모든 광고-방문자 매핑 조회 (확장된 기간 사용)
  const bulkVisitorQuery = `
    SELECT 
      REPLACE(utm_params->>'utm_content', '+', ' ') as utm_content,
      COALESCE(NULLIF(utm_params->>'utm_source', ''), '-') as utm_source,
      COALESCE(NULLIF(utm_params->>'utm_medium', ''), '-') as utm_medium,
      COALESCE(NULLIF(utm_params->>'utm_campaign', ''), '-') as utm_campaign,
      visitor_id
    FROM utm_sessions
    WHERE utm_params->>'utm_content' IS NOT NULL
      AND entry_timestamp >= $1
      AND entry_timestamp <= $2
  `;
  
  const bulkVisitorResult = await db.query(bulkVisitorQuery, [extendedStartDate, endDate]);
  
  // 조회 결과를 광고별로 매핑
  bulkVisitorResult.rows.forEach(row => {
    const key = `${row.utm_content}||${row.utm_source}||${row.utm_medium}||${row.utm_campaign}`;
    if (creativeVisitorMap[key]) {
      creativeVisitorMap[key].add(row.visitor_id);
      allVisitorIds.add(row.visitor_id);
    }
  });

  // 모든 visitor의 구매 내역 한 번에 조회
  if (allVisitorIds.size === 0) {
    return result;
  }

  // 주문 분석 페이지와 동일한 조건으로 구매 조회 (선택한 기간의 주문만)
  const purchaseQuery = `
    SELECT 
      visitor_id,
      order_id,
      final_payment,
      timestamp
    FROM conversions
    WHERE visitor_id = ANY($1)
      AND order_id IS NOT NULL
      AND paid = 'T'
      AND final_payment > 0
      AND timestamp >= $2
      AND timestamp <= $3
    ORDER BY visitor_id, timestamp
  `;

  const purchaseResult = await db.query(purchaseQuery, [Array.from(allVisitorIds), startDate, endDate]);
  const purchases = purchaseResult.rows;

  if (purchases.length === 0) {
    return result;
  }

  // 모든 visitor의 UTM 여정 한 번에 조회 (성능 최적화)
  const journeyQuery = `
    SELECT 
      visitor_id,
      REPLACE(utm_params->>'utm_content', '+', ' ') as utm_content,
      COALESCE(NULLIF(utm_params->>'utm_source', ''), '-') as utm_source,
      COALESCE(NULLIF(utm_params->>'utm_medium', ''), '-') as utm_medium,
      COALESCE(NULLIF(utm_params->>'utm_campaign', ''), '-') as utm_campaign,
      sequence_order,
      entry_timestamp
    FROM utm_sessions
    WHERE visitor_id = ANY($1)
      AND utm_params->>'utm_content' IS NOT NULL
    ORDER BY visitor_id, sequence_order
  `;

  const journeyResult = await db.query(journeyQuery, [Array.from(allVisitorIds)]);
  
  // visitor별 여정 그룹화
  const visitorJourneys = {};
  journeyResult.rows.forEach(row => {
    if (!visitorJourneys[row.visitor_id]) {
      visitorJourneys[row.visitor_id] = [];
    }
    visitorJourneys[row.visitor_id].push(row);
  });

  // 각 구매건에 대해 기여도 계산
  purchases.forEach(purchase => {
    const journey = visitorJourneys[purchase.visitor_id] || [];
    
    if (journey.length === 0) {
      return; // UTM 여정이 없으면 스킵
    }

    const purchaseDate = new Date(purchase.timestamp);
    const attributionWindowStart = new Date(purchaseDate);
    attributionWindowStart.setDate(attributionWindowStart.getDate() - ATTRIBUTION_WINDOW_DAYS);

    // 구매일 기준 30일 이내에 본 광고만 필터링
    const filteredJourney = journey.filter(touch => {
      const touchDate = new Date(touch.entry_timestamp);
      return touchDate >= attributionWindowStart && touchDate <= purchaseDate;
    });

    if (filteredJourney.length === 0) {
      return; // 30일 이내 본 광고가 없으면 스킵
    }

    // 막타 찾기 (필터링된 여정 중 sequence_order가 가장 큰 것)
    const lastTouch = filteredJourney.reduce((max, current) => 
      current.sequence_order > max.sequence_order ? current : max
    );

    const finalPayment = parseFloat(purchase.final_payment) || 0;

    // 여정에 있는 고유한 광고 조합 수집 (같은 광고를 여러 번 봤어도 1개로 카운트)
    const uniqueCreativesMap = new Map(); // key -> touch 정보
    filteredJourney.forEach(touch => {
      const touchKey = `${touch.utm_content}||${touch.utm_source}||${touch.utm_medium}||${touch.utm_campaign}`;
      // 가장 마지막 sequence_order를 저장 (막타 판별용)
      if (!uniqueCreativesMap.has(touchKey) || touch.sequence_order > uniqueCreativesMap.get(touchKey).sequence_order) {
        uniqueCreativesMap.set(touchKey, touch);
      }
    });
    
    const uniqueCreativeKeys = Array.from(uniqueCreativesMap.keys());
    const isSingleTouch = uniqueCreativeKeys.length === 1; // 하나의 광고 조합만 봤는지

    // 막타 키 생성
    const lastTouchKey = `${lastTouch.utm_content}||${lastTouch.utm_source}||${lastTouch.utm_medium}||${lastTouch.utm_campaign}`;

    // 막타 제외한 고유 광고 조합 목록 (어시 광고들)
    const assistCreativeKeys = uniqueCreativeKeys.filter(key => key !== lastTouchKey);
    const assistCount = assistCreativeKeys.length;

    // 막타 광고 기여도 계산
    let lastTouchAttributedAmount;

    // 광고 1개만 봤으면 100% 기여
    if (assistCount === 0) {
      lastTouchAttributedAmount = finalPayment; // 100%
    } else {
      // 여러 광고를 봤으면: 막타 50% + 어시들이 50%를 균등 분배
      lastTouchAttributedAmount = finalPayment * 0.5; // 막타 고정 50%
    }

    // 막타 광고 기여도 누적 (정확한 조합에만 누적)
    const contributedKeys = new Set(); // 이 구매에서 이미 기여도 받은 조합들
    
    if (result[lastTouchKey]) {
      result[lastTouchKey].contributed_orders_count += 1;
      result[lastTouchKey].attributed_revenue += lastTouchAttributedAmount;
      result[lastTouchKey].total_contributed_revenue += finalPayment;
      
      // 막타(Last Touch): 마지막으로 본 광고에 항상 카운트
      result[lastTouchKey].last_touch_count += 1;
      result[lastTouchKey].last_touch_revenue += finalPayment;
      
      // 순수 전환: 이 광고만 보고 구매한 경우에만 카운트
      if (isSingleTouch) {
        result[lastTouchKey].single_touch_count += 1;
      }
      
      contributedKeys.add(lastTouchKey); // 막타는 이미 처리했음을 표시
    }

    // 어시 광고들의 기여도 계산 (균등 분배)
    // 50%를 어시 광고 수로 나눔
    const assistAttributedAmount = assistCount > 0 ? (finalPayment * 0.5) / assistCount : 0;
    
    assistCreativeKeys.forEach(assistKey => {
      // 이 조합이 result에 있는지 확인
      if (!result[assistKey]) {
        return;
      }

      // 기여도 누적 (균등 분배)
      result[assistKey].contributed_orders_count += 1;
      result[assistKey].attributed_revenue += assistAttributedAmount;
      result[assistKey].total_contributed_revenue += finalPayment;
    });
  });

  return result;
}

module.exports = {
  calculateCreativeAttribution
};

