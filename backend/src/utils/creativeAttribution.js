const db = require('./database');

// 기여 인정 기간 기본값 (일 단위) - 구매일 기준 이 기간 내에 본 광고만 기여 인정
const DEFAULT_ATTRIBUTION_WINDOW_DAYS = 30;

/**
 * 광고 소재별 기여도 계산 (Last Touch 50% + 어시 균등 분배 50%)
 * 
 * 계산 방식:
 * - 구매일 기준 선택한 기간 이내에 본 광고만 기여 인정 (Attribution Window)
 * - 광고 1개만 봤으면: 해당 광고가 100% 기여
 * - 여러 광고를 봤으면: 막타 50% + 나머지 어시 광고들이 50%를 균등 분배
 * - 같은 광고를 여러 번 봤어도 1개로 카운트 (고유 조합 기준)
 * 
 * FIX (2026-02-04): Attribution Window를 사용자가 선택할 수 있도록 변경
 * FIX (2026-02-05): ad_id 기반 기여도 계산으로 변경
 * FIX (2026-02-06): IP 기반 여정 병합 제거 - 다른 사용자의 행동이 잘못 병합되는 문제
 * - 여정 연결: visitor_id + member_id 기반만 사용 (detailService.js와 동일)
 * - 기존: utm_content(광고명) 기준 → 광고명 변경 시 매칭 실패
 * - 변경: utm_id(ad_id) 기준 → 광고명 변경해도 정확한 기여도 계산
 * FIX (2026-02-10): IP+기기+OS 기반 여정 연결 옵션 추가
 * - matching_mode='extended' 시 동일 IP + device_type + OS의 다른 visitor_id UTM도 포함
 * - 인앱 브라우저 간 쿠키 분리로 누락되던 광고 기여도 보충
 * 
 * @param {Array} creatives - 광고 소재 목록 [{ ad_id, creative_name, utm_source, utm_medium, utm_campaign, _variant_names, ... }]
 * @param {String} startDate - 시작일
 * @param {String} endDate - 종료일
 * @param {number|null} attributionWindowDays - Attribution Window 일수 (30, 60, 90, null=전체)
 * @param {string} matchingMode - 매칭 방식 ('default' = 방문자ID+회원ID, 'extended' = +IP+기기+OS)
 * @returns {Object} - 광고별 기여도 데이터 { creative_name: { contributed_orders, attributed_revenue, total_revenue } }
 */
async function calculateCreativeAttribution(creatives, startDate, endDate, attributionWindowDays = DEFAULT_ATTRIBUTION_WINDOW_DAYS, matchingMode = 'extended') {
  // FIX (2026-02-05): ad_id 기반 unique key 생성
  // 같은 creative_name이라도 ad_id가 다르면 별도로 기여도 계산
  const getCreativeKey = (creative) => {
    return `${creative.ad_id}||${creative.utm_medium}||${creative.utm_campaign}`;
  };
  
  const result = {};
  
  // ad_id 기반 키 → creative 인덱스 매핑 (여정에서 찾기용)
  const adIdToCreativeKey = new Map();
  
  // 각 광고별로 초기화 (ad_id 기반 unique key 사용)
  creatives.forEach(creative => {
    const key = getCreativeKey(creative);
    result[key] = {
      contributed_orders_count: 0,
      attributed_revenue: 0,
      total_contributed_revenue: 0,
      single_touch_count: 0,
      last_touch_count: 0,
      last_touch_revenue: 0
    };
    
    // ad_id 기반 매핑
    adIdToCreativeKey.set(key, key);
  });

  // [수정] 구매 기준 접근: 선택 기간 내 구매한 사람을 먼저 찾고, 각 구매의 30일 이내 여정을 분석
  // 이렇게 해야 "선택 기간 이전에만 광고를 보고, 선택 기간 내 구매한 케이스"도 놓치지 않음

  // 1단계: 선택 기간 내 모든 구매 조회
  // session_id도 함께 조회 (인앱 브라우저 쿠키 문제 대응)
  // FIX (2026-01-23): 취소/환불 주문 제외 - 실제 유효 매출만 기여도 계산
  // FIX (2026-02-03): member_id 추가 (회원 기반 연결)
  const purchaseQuery = `
    SELECT 
      c.visitor_id,
      c.session_id,
      c.order_id,
      c.final_payment,
      c.timestamp,
      c.member_id,
      s.visitor_id as session_visitor_id
    FROM conversions c
    LEFT JOIN sessions s ON c.session_id = s.session_id
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
  
  // member_id 수집 (회원 기반 연결)
  const purchaserMemberIds = [...new Set(purchases
    .map(p => p.member_id)
    .filter(id => id && id !== '')
  )];

  // 3단계: 구매한 visitor들의 전체 UTM 여정 조회 (30일 필터링은 각 구매별로 적용)
  // FIX (2026-02-05): utm_id(ad_id) 기반 - 정상 utm_id만 포함
  const journeyQuery = `
    SELECT 
      us.visitor_id,
      us.utm_params->>'utm_id' as ad_id,
      us.utm_params->>'utm_content' as utm_content,
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
      -- 정상 utm_id만 포함 (빈 값, {{ad.id}} 등 제외)
      AND NULLIF(us.utm_params->>'utm_id', '') IS NOT NULL
      AND us.utm_params->>'utm_id' NOT LIKE '{{%'
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
  
  // member_id 기반 UTM 여정 조회 (회원 기반 연결)
  // FIX (2026-02-05): utm_id(ad_id) 기반 - 정상 utm_id만 포함
  const memberJourneyQuery = `
    SELECT 
      c2.member_id,
      us.visitor_id,
      us.utm_params->>'utm_id' as ad_id,
      us.utm_params->>'utm_content' as utm_content,
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
      -- 정상 utm_id만 포함
      AND NULLIF(us.utm_params->>'utm_id', '') IS NOT NULL
      AND us.utm_params->>'utm_id' NOT LIKE '{{%'
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

  // FIX (2026-02-10): IP+기기+OS 기반 여정 연결 (extended 모드)
  // 동일 IP + device_type + OS를 가진 다른 visitor_id의 UTM 여정도 포함
  let ipDeviceJourneys = {}; // visitor_id → UTM 여정 배열
  
  if (matchingMode === 'extended') {
    // 구매자들의 IP, device_type, OS 정보 일괄 조회
    const visitorInfoQuery = `
      SELECT visitor_id, ip_address, device_type, os
      FROM visitors
      WHERE visitor_id = ANY($1)
        AND ip_address IS NOT NULL
        AND ip_address != 'unknown'
        AND device_type IS NOT NULL
        AND os IS NOT NULL
    `;
    const visitorInfoResult = await db.query(visitorInfoQuery, [purchaserIds]);
    
    // IP+device_type+OS 조합별로 구매자 그룹화
    const fingerprintGroups = {};
    visitorInfoResult.rows.forEach(row => {
      const fingerprint = `${row.ip_address}||${row.device_type}||${row.os}`;
      if (!fingerprintGroups[fingerprint]) {
        fingerprintGroups[fingerprint] = [];
      }
      fingerprintGroups[fingerprint].push(row.visitor_id);
    });
    
    // 이미 찾은 visitor_id 목록 (중복 제외용)
    const alreadyFoundIds = new Set([...purchaserIds, ...purchaserMemberIds.length > 0 
      ? memberJourneyResult.rows.map(r => r.visitor_id) : []]);
    
    // 각 fingerprint 그룹에 대해 동일 조건의 다른 visitor_id 찾기
    const uniqueFingerprints = Object.keys(fingerprintGroups);
    
    if (uniqueFingerprints.length > 0) {
      // 일괄 조회: IP+device_type+OS가 같은 다른 visitor_id들의 UTM 여정
      const ipDeviceJourneyQuery = `
        SELECT 
          match_v.visitor_id as match_visitor_id,
          match_v.ip_address,
          match_v.device_type,
          match_v.os,
          us.visitor_id,
          us.utm_params->>'utm_id' as ad_id,
          us.utm_params->>'utm_content' as utm_content,
          COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') as utm_source,
          COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') as utm_medium,
          COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') as utm_campaign,
          us.sequence_order,
          us.entry_timestamp
        FROM visitors match_v
        JOIN utm_sessions us ON us.visitor_id = match_v.visitor_id
        JOIN visitors v ON us.visitor_id = v.visitor_id
        WHERE match_v.visitor_id != ALL($1)
          AND match_v.is_bot = false
          AND v.is_bot = false
          AND (match_v.ip_address, match_v.device_type, match_v.os) IN (
            SELECT unnest($2::text[]), unnest($3::text[]), unnest($4::text[])
          )
          AND us.utm_params->>'utm_content' IS NOT NULL
          AND NULLIF(us.utm_params->>'utm_id', '') IS NOT NULL
          AND us.utm_params->>'utm_id' NOT LIKE '{{%'
        ORDER BY match_v.visitor_id, us.entry_timestamp
      `;
      
      // fingerprint 분해
      const ips = [];
      const deviceTypes = [];
      const oses = [];
      uniqueFingerprints.forEach(fp => {
        const [ip, dt, os] = fp.split('||');
        ips.push(ip);
        deviceTypes.push(dt);
        oses.push(os);
      });
      
      const allFoundIds = Array.from(alreadyFoundIds);
      const ipDeviceResult = await db.query(ipDeviceJourneyQuery, [allFoundIds, ips, deviceTypes, oses]);
      
      // 매칭된 visitor의 IP+device+OS → 원래 구매자 visitor_id 매핑
      ipDeviceResult.rows.forEach(row => {
        const fingerprint = `${row.ip_address}||${row.device_type}||${row.os}`;
        const purchaserVisitorIds = fingerprintGroups[fingerprint] || [];
        
        purchaserVisitorIds.forEach(purchaserVid => {
          if (!ipDeviceJourneys[purchaserVid]) {
            ipDeviceJourneys[purchaserVid] = [];
          }
          ipDeviceJourneys[purchaserVid].push(row);
        });
      });
    }
  }

  // 각 구매건에 대해 기여도 계산
  purchases.forEach(purchase => {
    // 인앱 브라우저 대응: visitor_id로 못 찾으면 session_visitor_id로 시도
    let journey = visitorJourneys[purchase.visitor_id] || [];
    if (journey.length === 0 && purchase.session_visitor_id) {
      journey = visitorJourneys[purchase.session_visitor_id] || [];
    }
    
    // member_id 기반 여정 병합 (회원 기반 연결)
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
    
    // FIX (2026-02-10): IP+기기+OS 기반 여정 병합 (extended 모드)
    if (matchingMode === 'extended') {
      const vid = purchase.visitor_id || purchase.session_visitor_id;
      const ipJourney = ipDeviceJourneys[vid] || [];
      if (ipJourney.length > 0) {
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
    
    // 여정 병합 후 시간순 정렬 및 sequence_order 재할당
    if (journey.length > 1) {
      journey.sort((a, b) => new Date(a.entry_timestamp) - new Date(b.entry_timestamp));
      journey = journey.map((j, idx) => ({ ...j, sequence_order: idx + 1 }));
    }
    
    if (journey.length === 0) {
      return; // UTM 여정이 없으면 스킵
    }

    const purchaseDate = new Date(purchase.timestamp);
    
    // FIX (2026-02-04): Attribution Window를 사용자가 선택할 수 있도록 변경
    // attributionWindowDays가 null이면 전체 기간, 아니면 해당 일수 적용
    let filteredJourney;
    if (attributionWindowDays === null) {
      // 전체 기간: 구매일 이전 모든 광고
      filteredJourney = journey.filter(touch => {
        const touchDate = new Date(touch.entry_timestamp);
        return touchDate <= purchaseDate;
      });
    } else {
      // 선택한 기간: 구매일 기준 N일 이내 광고만
      const attributionWindowStart = new Date(purchaseDate);
      attributionWindowStart.setDate(attributionWindowStart.getDate() - attributionWindowDays);
      
      filteredJourney = journey.filter(touch => {
        const touchDate = new Date(touch.entry_timestamp);
        return touchDate >= attributionWindowStart && touchDate <= purchaseDate;
      });
    }

    if (filteredJourney.length === 0) {
      return; // 기간 내 본 광고가 없으면 스킵
    }

    // 막타 찾기 (필터링된 여정 중 sequence_order가 가장 큰 것)
    const lastTouch = filteredJourney.reduce((max, current) => 
      current.sequence_order > max.sequence_order ? current : max
    );

    const finalPayment = parseFloat(purchase.final_payment) || 0;

    // FIX (2026-02-05): ad_id 기반으로 고유 광고 수집
    // 여정에 있는 고유한 광고 조합 수집 (같은 광고를 여러 번 봤어도 1개로 카운트)
    const uniqueCreativesMap = new Map(); // ad_id 기반 key -> touch 정보
    filteredJourney.forEach(touch => {
      // ad_id 기반 키 (utm_medium, utm_campaign 포함)
      const adIdKey = `${touch.ad_id}||${touch.utm_medium}||${touch.utm_campaign}`;
      // 가장 마지막 sequence_order를 저장 (막타 판별용)
      if (!uniqueCreativesMap.has(adIdKey) || touch.sequence_order > uniqueCreativesMap.get(adIdKey).sequence_order) {
        uniqueCreativesMap.set(adIdKey, touch);
      }
    });
    
    const uniqueAdIdKeys = Array.from(uniqueCreativesMap.keys());
    const isSingleTouch = uniqueAdIdKeys.length === 1; // 하나의 광고만 봤는지

    // 막타 ad_id 키 생성
    const lastTouchAdIdKey = `${lastTouch.ad_id}||${lastTouch.utm_medium}||${lastTouch.utm_campaign}`;

    // 막타 제외한 고유 광고 목록 (어시 광고들)
    const assistAdIdKeys = uniqueAdIdKeys.filter(key => key !== lastTouchAdIdKey);
    const assistCount = assistAdIdKeys.length;

    // 막타 광고 기여도 계산
    let lastTouchAttributedAmount;

    // 광고 1개만 봤으면 100% 기여
    if (assistCount === 0) {
      lastTouchAttributedAmount = finalPayment; // 100%
    } else {
      // 여러 광고를 봤으면: 막타 50% + 어시들이 50%를 균등 분배
      lastTouchAttributedAmount = finalPayment * 0.5; // 막타 고정 50%
    }

    // FIX (2026-02-05): ad_id 기반 키로 직접 찾기
    // 키 형식: ad_id||utm_medium||utm_campaign
    const findCreativeKey = (adIdKey) => {
      if (result[adIdKey]) {
        return adIdKey;
      }
      return null;
    };

    // 막타 광고 기여도 누적
    const lastTouchCreativeKey = findCreativeKey(lastTouchAdIdKey);
    
    if (lastTouchCreativeKey && result[lastTouchCreativeKey]) {
      result[lastTouchCreativeKey].contributed_orders_count += 1;
      result[lastTouchCreativeKey].attributed_revenue += lastTouchAttributedAmount;
      result[lastTouchCreativeKey].total_contributed_revenue += finalPayment;
      
      // 막타(Last Touch): 마지막으로 본 광고에 항상 카운트
      result[lastTouchCreativeKey].last_touch_count += 1;
      result[lastTouchCreativeKey].last_touch_revenue += finalPayment;
      
      // 순수 전환: 이 광고만 보고 구매한 경우에만 카운트
      if (isSingleTouch) {
        result[lastTouchCreativeKey].single_touch_count += 1;
      }
    }

    // 어시 광고들의 기여도 계산 (균등 분배)
    const assistAttributedAmount = assistCount > 0 ? (finalPayment * 0.5) / assistCount : 0;
    
    assistAdIdKeys.forEach(assistAdIdKey => {
      const assistCreativeKey = findCreativeKey(assistAdIdKey);
      
      if (!assistCreativeKey || !result[assistCreativeKey]) {
        return;
      }

      // 기여도 누적 (균등 분배)
      result[assistCreativeKey].contributed_orders_count += 1;
      result[assistCreativeKey].attributed_revenue += assistAttributedAmount;
      result[assistCreativeKey].total_contributed_revenue += finalPayment;
    });
  });

  return result;
}

module.exports = {
  calculateCreativeAttribution
};

