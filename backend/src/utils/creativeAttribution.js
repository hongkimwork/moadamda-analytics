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
 * FIX (2026-02-11): IP+기기+OS → 브라우저 핑거프린트 기반으로 전면 교체
 * - matching_mode='fingerprint' 시 동일 브라우저 핑거프린트의 다른 visitor_id UTM도 포함
 * - 인앱 브라우저 간 쿠키 분리로 누락되던 광고 기여도 보충
 * 
 * @param {Array} creatives - 광고 소재 목록 [{ ad_id, creative_name, utm_source, utm_medium, utm_campaign, _variant_names, ... }]
 * @param {String} startDate - 시작일
 * @param {String} endDate - 종료일
 * @param {number|null} attributionWindowDays - Attribution Window 일수 (30, 60, 90, null=전체)
 * @param {string} matchingMode - 매칭 방식 ('default' = 방문자ID+회원ID, 'fingerprint' = +브라우저핑거프린트)
 * @returns {Object} - 광고별 기여도 데이터 { creative_name: { contributed_orders, attributed_revenue, total_revenue } }
 */
async function calculateCreativeAttribution(creatives, startDate, endDate, attributionWindowDays = DEFAULT_ATTRIBUTION_WINDOW_DAYS, matchingMode = 'fingerprint', resolutionJson = '[]') {
  // FIX (2026-02-05): ad_id 기반 unique key 생성
  // 같은 creative_name이라도 ad_id가 다르면 별도로 기여도 계산
  // FIX (2026-02-11): utm_id 없는 플랫폼(카카오 등) 지원
  // ad_id가 creative_name과 같으면 utm_content 폴백이므로 creative_name 기반 키 사용
  // FIX (2026-02-11): utm_source를 키에서 제외 - 로그인 리디렉트 시 utm_source 누락으로
  // 같은 광고가 다른 키로 분리되는 문제 해결 (ad_id 모드와 동일한 키 구조로 통일)
  const getCreativeKey = (creative) => {
    const isUtmContentFallback = creative.ad_id === creative.creative_name;
    if (isUtmContentFallback) {
      return `${creative.creative_name}||${creative.utm_medium}||${creative.utm_campaign}`;
    }
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
  // FIX (2026-02-11): utm_id 없는 플랫폼 지원 - COALESCE(utm_id, utm_content)를 ad_id로 사용
  // FIX (2026-02-12): Meta utm_id 복원 매핑 적용 - 잘린 utm_content도 정확한 ad_id로 매칭
  // {{...}} 패턴만 제외, utm_id NULL은 허용 (카카오/자사몰 등)
  const journeyQuery = `
    WITH utm_resolution AS (
      SELECT * FROM jsonb_to_recordset($2::jsonb)
      AS t(utm_content text, resolved_ad_id text)
    )
    SELECT 
      us.visitor_id,
      COALESCE(
        NULLIF(CASE WHEN us.utm_params->>'utm_id' LIKE '{{%' THEN NULL ELSE us.utm_params->>'utm_id' END, ''),
        ur.resolved_ad_id,
        us.utm_params->>'utm_content'
      ) as ad_id,
      us.utm_params->>'utm_content' as utm_content,
      COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') as utm_source,
      COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') as utm_medium,
      COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') as utm_campaign,
      us.sequence_order,
      us.entry_timestamp
    FROM utm_sessions us
    JOIN visitors v ON us.visitor_id = v.visitor_id
    LEFT JOIN utm_resolution ur ON us.utm_params->>'utm_content' = ur.utm_content
    WHERE us.visitor_id = ANY($1)
      AND us.utm_params->>'utm_content' IS NOT NULL
      AND us.utm_params->>'utm_content' NOT LIKE '{{%'
      AND v.is_bot = false
    ORDER BY us.visitor_id, us.sequence_order
  `;

  const journeyResult = await db.query(journeyQuery, [purchaserIds, resolutionJson]);
  
  // visitor별 여정 그룹화
  const visitorJourneys = {};
  journeyResult.rows.forEach(row => {
    if (!visitorJourneys[row.visitor_id]) {
      visitorJourneys[row.visitor_id] = [];
    }
    visitorJourneys[row.visitor_id].push(row);
  });
  
  // member_id 기반 UTM 여정 조회 (회원 기반 연결)
  // FIX (2026-02-11): utm_id 없는 플랫폼 지원 - COALESCE(utm_id, utm_content)
  // FIX (2026-02-12): Meta utm_id 복원 매핑 적용
  const memberJourneyQuery = `
    WITH utm_resolution AS (
      SELECT * FROM jsonb_to_recordset($3::jsonb)
      AS t(utm_content text, resolved_ad_id text)
    )
    SELECT 
      c2.member_id,
      us.visitor_id,
      COALESCE(
        NULLIF(CASE WHEN us.utm_params->>'utm_id' LIKE '{{%' THEN NULL ELSE us.utm_params->>'utm_id' END, ''),
        ur.resolved_ad_id,
        us.utm_params->>'utm_content'
      ) as ad_id,
      us.utm_params->>'utm_content' as utm_content,
      COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') as utm_source,
      COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') as utm_medium,
      COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') as utm_campaign,
      us.sequence_order,
      us.entry_timestamp
    FROM utm_sessions us
    JOIN visitors v ON us.visitor_id = v.visitor_id
    JOIN conversions c2 ON c2.visitor_id = us.visitor_id
    LEFT JOIN utm_resolution ur ON us.utm_params->>'utm_content' = ur.utm_content
    WHERE c2.member_id = ANY($1)
      AND us.visitor_id != ALL($2)
      AND us.utm_params->>'utm_content' IS NOT NULL
      AND us.utm_params->>'utm_content' NOT LIKE '{{%'
      AND v.is_bot = false
    ORDER BY c2.member_id, us.entry_timestamp
  `;
  
  const memberJourneyResult = purchaserMemberIds.length > 0 
    ? await db.query(memberJourneyQuery, [purchaserMemberIds, purchaserIds, resolutionJson])
    : { rows: [] };
  
  // member_id별 여정 그룹화
  const memberJourneys = {};
  memberJourneyResult.rows.forEach(row => {
    if (!memberJourneys[row.member_id]) {
      memberJourneys[row.member_id] = [];
    }
    memberJourneys[row.member_id].push(row);
  });

  // FIX (2026-02-11): browser_fingerprint 기반 여정 연결 (fingerprint 모드)
  // 동일 browser_fingerprint를 가진 다른 visitor_id의 UTM 여정도 포함
  let fpJourneys = {}; // visitor_id → UTM 여정 배열
  
  if (matchingMode === 'fingerprint') {
    // 구매자들의 browser_fingerprint 조회
    const visitorInfoQuery = `
      SELECT visitor_id, browser_fingerprint
      FROM visitors
      WHERE visitor_id = ANY($1)
        AND browser_fingerprint IS NOT NULL
        AND browser_fingerprint != ''
    `;
    const visitorInfoResult = await db.query(visitorInfoQuery, [purchaserIds]);
    
    // browser_fingerprint별로 구매자 그룹화
    const fingerprintGroups = {};
    visitorInfoResult.rows.forEach(row => {
      const fp = row.browser_fingerprint;
      if (!fingerprintGroups[fp]) {
        fingerprintGroups[fp] = [];
      }
      fingerprintGroups[fp].push(row.visitor_id);
    });

    // FIX (2026-02-20): 핑거프린트 충돌 임계값 - 5명 이상 공유 시 매칭 제외
    const MAX_FINGERPRINT_COLLISION = 5;
    const fpKeys = Object.keys(fingerprintGroups);
    if (fpKeys.length > 0) {
      const fpCollisionQuery = `
        SELECT browser_fingerprint
        FROM visitors
        WHERE browser_fingerprint = ANY($1)
          AND is_bot = false
        GROUP BY browser_fingerprint
        HAVING COUNT(DISTINCT visitor_id) >= $2
      `;
      const fpCollisionResult = await db.query(fpCollisionQuery, [fpKeys, MAX_FINGERPRINT_COLLISION]);
      fpCollisionResult.rows.forEach(row => delete fingerprintGroups[row.browser_fingerprint]);
    }
    
    // 이미 찾은 visitor_id 목록 (중복 제외용)
    const alreadyFoundIds = new Set([...purchaserIds, ...purchaserMemberIds.length > 0 
      ? memberJourneyResult.rows.map(r => r.visitor_id) : []]);
    
    const uniqueFingerprints = Object.keys(fingerprintGroups);
    
    if (uniqueFingerprints.length > 0) {
      // 일괄 조회: browser_fingerprint가 같은 다른 visitor_id들의 UTM 여정
      // 동시 활동 필터 유지 (안전장치)
      // FIX (2026-02-12): Meta utm_id 복원 매핑 적용
      const fpJourneyQuery = `
        WITH utm_resolution AS (
          SELECT * FROM jsonb_to_recordset($4::jsonb)
          AS t(utm_content text, resolved_ad_id text)
        )
        SELECT 
          match_v.visitor_id as match_visitor_id,
          match_v.browser_fingerprint,
          us.visitor_id,
          COALESCE(
            NULLIF(CASE WHEN us.utm_params->>'utm_id' LIKE '{{%' THEN NULL ELSE us.utm_params->>'utm_id' END, ''),
            ur.resolved_ad_id,
            us.utm_params->>'utm_content'
          ) as ad_id,
          us.utm_params->>'utm_content' as utm_content,
          COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') as utm_source,
          COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') as utm_medium,
          COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') as utm_campaign,
          us.sequence_order,
          us.entry_timestamp
        FROM visitors match_v
        JOIN utm_sessions us ON us.visitor_id = match_v.visitor_id
        JOIN visitors v ON us.visitor_id = v.visitor_id
        LEFT JOIN utm_resolution ur ON us.utm_params->>'utm_content' = ur.utm_content
        WHERE match_v.visitor_id != ALL($1)
          AND match_v.is_bot = false
          AND v.is_bot = false
          AND match_v.browser_fingerprint = ANY($2)
          AND us.utm_params->>'utm_content' IS NOT NULL
          AND us.utm_params->>'utm_content' NOT LIKE '{{%'
          AND NOT EXISTS (
            SELECT 1
            FROM sessions match_s
            JOIN sessions purch_s ON purch_s.visitor_id = ANY($3)
            WHERE match_s.visitor_id = match_v.visitor_id
              AND match_s.start_time < COALESCE(purch_s.end_time, purch_s.start_time)
              AND purch_s.start_time < COALESCE(match_s.end_time, match_s.start_time)
              AND EXTRACT(EPOCH FROM (
                LEAST(COALESCE(match_s.end_time, match_s.start_time), COALESCE(purch_s.end_time, purch_s.start_time))
                - GREATEST(match_s.start_time, purch_s.start_time)
              )) >= 60
            LIMIT 1
          )
        ORDER BY match_v.visitor_id, us.entry_timestamp
      `;
      
      const allFoundIds = Array.from(alreadyFoundIds);
      const fpResult = await db.query(fpJourneyQuery, [allFoundIds, uniqueFingerprints, purchaserIds, resolutionJson]);
      
      // 매칭된 visitor의 browser_fingerprint → 원래 구매자 visitor_id 매핑
      fpResult.rows.forEach(row => {
        const fp = row.browser_fingerprint;
        const purchaserVisitorIds = fingerprintGroups[fp] || [];
        
        purchaserVisitorIds.forEach(purchaserVid => {
          if (!fpJourneys[purchaserVid]) {
            fpJourneys[purchaserVid] = [];
          }
          fpJourneys[purchaserVid].push(row);
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
    
    // FIX (2026-02-11): browser_fingerprint 기반 여정 병합 (fingerprint 모드)
    if (matchingMode === 'fingerprint') {
      const vid = purchase.visitor_id || purchase.session_visitor_id;
      const fpJourney = fpJourneys[vid] || [];
      if (fpJourney.length > 0) {
        const existingKeys = new Set(journey.map(j => 
          `${j.entry_timestamp}||${j.utm_content}`
        ));
        
        const newTouches = fpJourney.filter(j => {
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
    // FIX (2026-02-11): utm_id 없는 플랫폼 지원 - ad_id가 utm_content와 같으면 creative_name 기반 키
    const uniqueCreativesMap = new Map(); // ad_id 기반 key -> touch 정보
    
    // 터치포인트의 키 생성 함수 (getCreativeKey와 동일한 로직)
    // FIX (2026-02-11): utm_source를 키에서 제외 (getCreativeKey와 동일하게 통일)
    const getTouchKey = (touch) => {
      const isUtmContentFallback = touch.ad_id === touch.utm_content;
      if (isUtmContentFallback) {
        return `${touch.utm_content}||${touch.utm_medium}||${touch.utm_campaign}`;
      }
      return `${touch.ad_id}||${touch.utm_medium}||${touch.utm_campaign}`;
    };
    
    filteredJourney.forEach(touch => {
      const adIdKey = getTouchKey(touch);
      // 가장 마지막 sequence_order를 저장 (막타 판별용)
      if (!uniqueCreativesMap.has(adIdKey) || touch.sequence_order > uniqueCreativesMap.get(adIdKey).sequence_order) {
        uniqueCreativesMap.set(adIdKey, touch);
      }
    });
    
    const uniqueAdIdKeys = Array.from(uniqueCreativesMap.keys());
    const isSingleTouch = uniqueAdIdKeys.length === 1; // 하나의 광고만 봤는지

    // 막타 ad_id 키 생성
    const lastTouchAdIdKey = getTouchKey(lastTouch);

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

