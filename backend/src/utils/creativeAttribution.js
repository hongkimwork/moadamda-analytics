const db = require('./database');

/**
 * 광고 소재별 기여도 계산 (Last Touch 50% + Weighted 50%)
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

  // [최적화] 모든 광고의 visitor를 단일 쿼리로 조회 (N+1 문제 해결)
  const allVisitorIds = new Set();
  const creativeVisitorMap = {}; // { creative_key: Set<visitor_ids> }
  
  // 결과 키 초기화
  creatives.forEach(creative => {
    const key = getCreativeKey(creative);
    creativeVisitorMap[key] = new Set();
  });

  // 단일 쿼리로 모든 광고-방문자 매핑 조회
  const bulkVisitorQuery = `
    SELECT 
      utm_params->>'utm_content' as utm_content,
      COALESCE(NULLIF(utm_params->>'utm_source', ''), '-') as utm_source,
      COALESCE(NULLIF(utm_params->>'utm_medium', ''), '-') as utm_medium,
      COALESCE(NULLIF(utm_params->>'utm_campaign', ''), '-') as utm_campaign,
      visitor_id
    FROM utm_sessions
    WHERE utm_params->>'utm_content' IS NOT NULL
      AND entry_timestamp >= $1
      AND entry_timestamp <= $2
  `;
  
  const bulkVisitorResult = await db.query(bulkVisitorQuery, [startDate, endDate]);
  
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
      utm_params->>'utm_content' as utm_content,
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

    // 막타 찾기 (sequence_order가 가장 큰 것)
    const lastTouch = journey.reduce((max, current) => 
      current.sequence_order > max.sequence_order ? current : max
    );

    const finalPayment = parseFloat(purchase.final_payment) || 0;

    // 순수 전환(막타) 체크: 이 광고만 보고 구매했는지 확인
    // 여정에 있는 고유한 광고 조합 수를 계산
    const uniqueCreatives = new Set();
    journey.forEach(touch => {
      const touchKey = `${touch.utm_content}||${touch.utm_source}||${touch.utm_medium}||${touch.utm_campaign}`;
      uniqueCreatives.add(touchKey);
    });
    
    const isSingleTouch = uniqueCreatives.size === 1; // 하나의 광고만 봤는지

    // 막타 제외한 터치 목록 (막타 터치 하나만 제외, 같은 이름이어도 다른 터치는 포함)
    const nonLastTouches = journey.filter((touch) => 
      !(touch.sequence_order === lastTouch.sequence_order && 
        touch.utm_content === lastTouch.utm_content)
    );

    // 막타 제외한 광고별 터치 횟수 계산
    const nonLastTouchCounts = {};
    nonLastTouches.forEach(touch => {
      const creativeName = touch.utm_content;
      nonLastTouchCounts[creativeName] = (nonLastTouchCounts[creativeName] || 0) + 1;
    });

    const totalNonLastTouches = nonLastTouches.length;

    // 막타 광고 기여도 계산
    const lastTouchCreative = lastTouch.utm_content;
    let lastTouchAttributedAmount;

    // 광고 1개만 봤으면 100% 기여
    if (totalNonLastTouches === 0) {
      lastTouchAttributedAmount = finalPayment; // 100%
    } else {
      // 여러 광고를 봤으면: 막타 50% + 비막타 50% 분배
      lastTouchAttributedAmount = finalPayment * 0.5; // 막타 기본 50%
      
      // 막타 광고가 중간에도 있었다면 추가 기여
      if (nonLastTouchCounts[lastTouchCreative]) {
        lastTouchAttributedAmount += finalPayment * 0.5 * (nonLastTouchCounts[lastTouchCreative] / totalNonLastTouches);
      }
    }

    // 막타 광고 기여도 누적 (정확한 조합에만 누적)
    const lastTouchKey = `${lastTouch.utm_content}||${lastTouch.utm_source}||${lastTouch.utm_medium}||${lastTouch.utm_campaign}`;
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

    // 막타가 아닌 터치들의 기여도 계산 (조합별로 정확하게 계산)
    const processedKeys = new Set(); // 중복 처리 방지
    
    nonLastTouches.forEach(touch => {
      const touchKey = `${touch.utm_content}||${touch.utm_source}||${touch.utm_medium}||${touch.utm_campaign}`;
      
      // 이미 이 구매에서 기여도를 받은 조합은 스킵 (막타든 중간이든 1번만!)
      if (contributedKeys.has(touchKey) || processedKeys.has(touchKey)) {
        return;
      }
      
      // 이 조합이 result에 있는지 확인
      if (!result[touchKey]) {
        return;
      }

      // 이 조합의 터치 횟수 계산
      const touchCount = nonLastTouches.filter(t => 
        t.utm_content === touch.utm_content &&
        t.utm_source === touch.utm_source &&
        t.utm_medium === touch.utm_medium &&
        t.utm_campaign === touch.utm_campaign
      ).length;

      // 기여도 계산: 결제금액 × 50% × (이 조합 터치 횟수 / 총 비막타 터치 횟수)
      const attributedAmount = totalNonLastTouches > 0 
        ? finalPayment * 0.5 * (touchCount / totalNonLastTouches)
        : 0;

      // 기여도 누적
      result[touchKey].contributed_orders_count += 1;
      result[touchKey].attributed_revenue += attributedAmount;
      result[touchKey].total_contributed_revenue += finalPayment;
      
      processedKeys.add(touchKey);
    });
  });

  return result;
}

module.exports = {
  calculateCreativeAttribution
};

