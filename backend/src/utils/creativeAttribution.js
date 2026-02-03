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
 * FIX (2026-02-03): IP 기반 UTM 연결 추가 (쿠키 끊김 대응)
 * - visitor_id 기반 여정이 없거나 부족한 경우
 * - 동일 IP의 다른 visitor_id들의 UTM 여정도 조회하여 병합
 * - 이를 통해 쿠키가 끊어져도 과거 광고 노출 기여도 인정
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

  // [수정] 구매 기준 접근: 선택 기간 내 구매한 사람을 먼저 찾고, 각 구매의 30일 이내 여정을 분석
  // 이렇게 해야 "선택 기간 이전에만 광고를 보고, 선택 기간 내 구매한 케이스"도 놓치지 않음

  // 1단계: 선택 기간 내 모든 구매 조회
  // session_id도 함께 조회 (인앱 브라우저 쿠키 문제 대응)
  // FIX (2026-01-23): 취소/환불 주문 제외 - 실제 유효 매출만 기여도 계산
  // FIX (2026-02-03): IP 주소 추가 (쿠키 끊김 대응)
  // FIX (2026-02-03): member_id 추가 (회원 기반 연결)
  const purchaseQuery = `
    SELECT 
      c.visitor_id,
      c.session_id,
      c.order_id,
      c.final_payment,
      c.timestamp,
      c.member_id,
      s.visitor_id as session_visitor_id,
      COALESCE(s.ip_address, v.ip_address) as ip_address
    FROM conversions c
    LEFT JOIN sessions s ON c.session_id = s.session_id
    LEFT JOIN visitors v ON c.visitor_id = v.visitor_id
    WHERE c.order_id IS NOT NULL
      AND c.paid = 'T'
      AND c.final_payment > 0
      AND c.timestamp >= $1
      AND c.timestamp <= $2
      AND (c.canceled = 'F' OR c.canceled IS NULL)
      AND (c.order_status = 'confirmed' OR c.order_status IS NULL)
    ORDER BY c.visitor_id, c.timestamp
  `;

  const purchaseResult = await db.query(purchaseQuery, [startDate, endDate]);
  const purchases = purchaseResult.rows;

  if (purchases.length === 0) {
    return result;
  }

  // 2단계: 구매한 visitor들의 ID 수집 (인앱 브라우저 대응: session 기반 visitor_id도 포함)
  const purchaserIds = [...new Set(purchases.flatMap(p => 
    [p.visitor_id, p.session_visitor_id].filter(Boolean)
  ))];
  
  // FIX (2026-02-03): IP 주소 수집 (쿠키 끊김 대응)
  const purchaserIps = [...new Set(purchases
    .map(p => p.ip_address)
    .filter(ip => ip && ip !== 'unknown')
  )];
  
  // FIX (2026-02-03): member_id 수집 (회원 기반 연결)
  const purchaserMemberIds = [...new Set(purchases
    .map(p => p.member_id)
    .filter(id => id && id !== '')
  )];

  // 3단계: 구매한 visitor들의 전체 UTM 여정 조회 (30일 필터링은 각 구매별로 적용)
  // 카페24 호환: visitors 테이블과 조인하여 봇 트래픽 제외
  const journeyQuery = `
    SELECT 
      us.visitor_id,
      REPLACE(us.utm_params->>'utm_content', '+', ' ') as utm_content,
      COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') as utm_source,
      COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') as utm_medium,
      COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') as utm_campaign,
      us.sequence_order,
      us.entry_timestamp
    FROM utm_sessions us
    JOIN visitors v ON us.visitor_id = v.visitor_id
    WHERE us.visitor_id = ANY($1)
      AND us.utm_params->>'utm_content' IS NOT NULL
      AND v.is_bot = false
    ORDER BY us.visitor_id, us.sequence_order
  `;

  const journeyResult = await db.query(journeyQuery, [purchaserIds]);
  
  // visitor별 여정 그룹화
  const visitorJourneys = {};
  journeyResult.rows.forEach(row => {
    if (!visitorJourneys[row.visitor_id]) {
      visitorJourneys[row.visitor_id] = [];
    }
    visitorJourneys[row.visitor_id].push(row);
  });
  
  // FIX (2026-02-03): IP 기반 UTM 여정 조회 (쿠키 끊김 대응)
  // 동일 IP의 다른 visitor_id들의 UTM 세션도 조회
  const ipJourneyQuery = `
    SELECT 
      v.ip_address,
      us.visitor_id,
      REPLACE(us.utm_params->>'utm_content', '+', ' ') as utm_content,
      COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') as utm_source,
      COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') as utm_medium,
      COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') as utm_campaign,
      us.sequence_order,
      us.entry_timestamp
    FROM utm_sessions us
    JOIN visitors v ON us.visitor_id = v.visitor_id
    WHERE v.ip_address = ANY($1)
      AND us.visitor_id != ALL($2)
      AND us.utm_params->>'utm_content' IS NOT NULL
      AND v.is_bot = false
    ORDER BY v.ip_address, us.entry_timestamp
  `;
  
  const ipJourneyResult = purchaserIps.length > 0 
    ? await db.query(ipJourneyQuery, [purchaserIps, purchaserIds])
    : { rows: [] };
  
  // IP별 여정 그룹화
  const ipJourneys = {};
  ipJourneyResult.rows.forEach(row => {
    if (!ipJourneys[row.ip_address]) {
      ipJourneys[row.ip_address] = [];
    }
    ipJourneys[row.ip_address].push(row);
  });
  
  // FIX (2026-02-03): member_id 기반 UTM 여정 조회 (회원 기반 연결)
  // 동일 member_id의 다른 visitor_id들의 UTM 세션도 조회
  const memberJourneyQuery = `
    SELECT 
      c2.member_id,
      us.visitor_id,
      REPLACE(us.utm_params->>'utm_content', '+', ' ') as utm_content,
      COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') as utm_source,
      COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') as utm_medium,
      COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') as utm_campaign,
      us.sequence_order,
      us.entry_timestamp
    FROM utm_sessions us
    JOIN visitors v ON us.visitor_id = v.visitor_id
    JOIN conversions c2 ON c2.visitor_id = us.visitor_id
    WHERE c2.member_id = ANY($1)
      AND us.visitor_id != ALL($2)
      AND us.utm_params->>'utm_content' IS NOT NULL
      AND v.is_bot = false
    ORDER BY c2.member_id, us.entry_timestamp
  `;
  
  const memberJourneyResult = purchaserMemberIds.length > 0 
    ? await db.query(memberJourneyQuery, [purchaserMemberIds, purchaserIds])
    : { rows: [] };
  
  // member_id별 여정 그룹화
  const memberJourneys = {};
  memberJourneyResult.rows.forEach(row => {
    if (!memberJourneys[row.member_id]) {
      memberJourneys[row.member_id] = [];
    }
    memberJourneys[row.member_id].push(row);
  });

  // 각 구매건에 대해 기여도 계산
  purchases.forEach(purchase => {
    // 인앱 브라우저 대응: visitor_id로 못 찾으면 session_visitor_id로 시도
    let journey = visitorJourneys[purchase.visitor_id] || [];
    if (journey.length === 0 && purchase.session_visitor_id) {
      journey = visitorJourneys[purchase.session_visitor_id] || [];
    }
    
    // FIX (2026-02-03): IP 기반 여정 병합 (쿠키 끊김 대응)
    // visitor_id 기반 여정이 없거나 부족한 경우, IP 기반 여정 추가
    if (purchase.ip_address && purchase.ip_address !== 'unknown') {
      const ipJourney = ipJourneys[purchase.ip_address] || [];
      if (ipJourney.length > 0) {
        // 기존 여정과 IP 기반 여정 병합 (중복 제거)
        const existingKeys = new Set(journey.map(j => 
          `${j.entry_timestamp}||${j.utm_content}`
        ));
        
        const newTouches = ipJourney.filter(j => {
          const key = `${j.entry_timestamp}||${j.utm_content}`;
          return !existingKeys.has(key);
        });
        
        journey = [...journey, ...newTouches];
      }
    }
    
    // FIX (2026-02-03): member_id 기반 여정 병합 (회원 기반 연결)
    // 동일 회원 ID의 다른 visitor_id들의 여정도 추가
    if (purchase.member_id && purchase.member_id !== '') {
      const memberJourney = memberJourneys[purchase.member_id] || [];
      if (memberJourney.length > 0) {
        // 기존 여정과 member_id 기반 여정 병합 (중복 제거)
        const existingKeys = new Set(journey.map(j => 
          `${j.entry_timestamp}||${j.utm_content}`
        ));
        
        const newTouches = memberJourney.filter(j => {
          const key = `${j.entry_timestamp}||${j.utm_content}`;
          return !existingKeys.has(key);
        });
        
        journey = [...journey, ...newTouches];
      }
    }
    
    // IP/member_id 병합 후 시간순 정렬 및 sequence_order 재할당
    if (journey.length > 1) {
      journey.sort((a, b) => new Date(a.entry_timestamp) - new Date(b.entry_timestamp));
      journey = journey.map((j, idx) => ({ ...j, sequence_order: idx + 1 }));
    }
    
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

