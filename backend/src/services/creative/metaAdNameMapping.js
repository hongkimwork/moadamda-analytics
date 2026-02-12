/**
 * 메타 광고명 매핑 유틸리티
 * 잘린/변형된 광고명을 메타 API의 정상 광고명으로 매핑
 */

const https = require('https');

// 메타 광고명 캐시 (10분 TTL)
let metaAdNamesCache = null;
let metaAdNamesCacheTime = null;
const CACHE_TTL = 10 * 60 * 1000; // 10분

// 광고명 → ad_id 매핑 캐시 (미리보기용)
let adNameToIdCache = new Map();

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID;
const API_VERSION = 'v20.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

/**
 * 메타 API 직접 호출 (광고명만 가져오기 - 간소화)
 */
function callMetaApiSimple(endpoint, params = {}) {
  return new Promise((resolve, reject) => {
    params.access_token = META_ACCESS_TOKEN;
    const queryString = new URLSearchParams(params).toString();
    const url = `${BASE_URL}/${endpoint}?${queryString}`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          if (jsonData.error) {
            reject(jsonData.error);
          } else {
            resolve(jsonData);
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

/**
 * 메타 API에서 전체 광고명 목록 가져오기 (캐시 적용)
 * FIX (2026-01-27): DB의 meta_ads 테이블에서도 광고명 가져오기
 * - 메타 API는 ACTIVE/PAUSED 상태만 반환하므로 ARCHIVED 광고가 누락됨
 * - DB에 저장된 광고명도 함께 사용하여 누락 방지
 * @returns {Promise<string[]>} - 고유한 광고명 배열
 */
async function getMetaAdNames() {
  // 캐시가 유효하면 캐시 반환
  if (metaAdNamesCache && metaAdNamesCacheTime && (Date.now() - metaAdNamesCacheTime < CACHE_TTL)) {
    return metaAdNamesCache;
  }

  let apiNames = [];
  let dbNames = [];

  const db = require('../../utils/database');
  
  // 1. 메타 API에서 광고명 가져오기 (ACTIVE, PAUSED, CAMPAIGN_PAUSED, ADSET_PAUSED 포함)
  // FIX (2026-02-03): 캠페인/광고세트가 중지된 광고도 조회하도록 상태 추가
  try {
    const [activeResult, pausedResult, campaignPausedResult, adsetPausedResult] = await Promise.all([
      callMetaApiSimple(`${META_AD_ACCOUNT_ID}/ads`, {
        fields: 'id,name,status',
        filtering: JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['ACTIVE'] }]),
        limit: 500
      }),
      callMetaApiSimple(`${META_AD_ACCOUNT_ID}/ads`, {
        fields: 'id,name,status',
        filtering: JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['PAUSED'] }]),
        limit: 500
      }),
      callMetaApiSimple(`${META_AD_ACCOUNT_ID}/ads`, {
        fields: 'id,name,status',
        filtering: JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['CAMPAIGN_PAUSED'] }]),
        limit: 500
      }),
      callMetaApiSimple(`${META_AD_ACCOUNT_ID}/ads`, {
        fields: 'id,name,status',
        filtering: JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['ADSET_PAUSED'] }]),
        limit: 500
      })
    ]);
    
    const apiAds = [
      ...(activeResult.data || []), 
      ...(pausedResult.data || []),
      ...(campaignPausedResult.data || []),
      ...(adsetPausedResult.data || [])
    ];
    apiNames = apiAds.map(ad => ad.name).filter(Boolean);
    
    // 광고명 → ad_id 매핑 캐시 업데이트 + DB 저장
    for (const ad of apiAds) {
      if (ad.name && ad.id) {
        adNameToIdCache.set(ad.name, ad.id);
        
        // DB에 저장 (중복 시 업데이트)
        try {
          await db.query(
            `INSERT INTO meta_ads (ad_id, account_id, name, status, created_time, updated_time)
             VALUES ($1, $2, $3, $4, NOW(), NOW())
             ON CONFLICT (ad_id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status, updated_time = NOW()`,
            [ad.id, META_AD_ACCOUNT_ID, ad.name, ad.status || 'ACTIVE']
          );
        } catch (dbSaveError) {
          // 저장 실패해도 계속 진행
        }
      }
    }
    console.log(`[MetaAdNameMapping] Synced ${apiAds.length} ads to DB`);
  } catch (apiError) {
    console.warn('[MetaAdNameMapping] Meta API failed:', apiError.message);
  }
  
  // 2. DB의 meta_ads 테이블에서 광고명 + ad_id 가져오기 (ARCHIVED 포함)
  // FIX (2026-02-02): ad_id도 함께 가져와서 캐시에 저장
  try {
    const dbResult = await db.query('SELECT ad_id, name FROM meta_ads WHERE name IS NOT NULL');
    for (const row of dbResult.rows) {
      dbNames.push(row.name);
      // 캐시에 없으면 추가 (API 데이터 우선)
      if (row.ad_id && !adNameToIdCache.has(row.name)) {
        adNameToIdCache.set(row.name, row.ad_id);
      }
    }
  } catch (dbError) {
    console.warn('[MetaAdNameMapping] Failed to fetch ad names from DB:', dbError.message);
  }
  
  // 3. API + DB 광고명 합치기 (중복 제거)
  const uniqueNames = [...new Set([...apiNames, ...dbNames])];
  
  // 아무것도 가져오지 못한 경우
  if (uniqueNames.length === 0) {
    // 캐시가 있으면 만료되었더라도 반환 (폴백)
    if (metaAdNamesCache) {
      console.log('[MetaAdNameMapping] Using cached ad names as fallback');
      return metaAdNamesCache;
    }
    return [];
  }
  
  // 캐시 저장
  metaAdNamesCache = uniqueNames;
  metaAdNamesCacheTime = Date.now();
  
  console.log(`[MetaAdNameMapping] Loaded ${uniqueNames.length} ad names (API: ${apiNames.length}, DB: ${dbNames.length})`);
  
  return uniqueNames;
}

/**
 * 광고명 정규화 (비교용)
 * FIX (2026-02-04): 양방향 비교를 위한 정규화 강화
 * - 플러스(+)와 공백을 동일하게 취급
 * - 끝에 붙은 불필요한 문자(_ 등) 제거
 * - 연속 공백을 단일 공백으로 변환
 * @param {string} name - 광고명
 * @returns {string} - 정규화된 광고명
 */
function normalizeAdName(name) {
  if (!name) return '';
  let normalized = name;
  // 플러스를 공백으로 통일
  normalized = normalized.replace(/\+/g, ' ');
  // 끝에 붙은 불필요한 문자 제거 (_ 등)
  normalized = normalized.replace(/_+$/, '');
  // 연속 공백을 단일 공백으로
  normalized = normalized.replace(/\s+/g, ' ');
  // 앞뒤 공백 제거
  normalized = normalized.trim();
  return normalized;
}

/**
 * URL 디코딩 시도
 * FIX (2026-01-30): 77% 같은 패턴 처리 및 끝부분 잘림 개선
 * FIX (2026-02-04): 더 강력한 디코딩 로직
 * - % 뒤에 유효한 16진수 두 자리가 아니면 %25로 치환
 * - 끝에 불완전한 UTF-8 시퀀스 제거 (반복적으로 시도)
 * - 부분 디코딩된 상태에서 끝에 %X, %XX 남은 경우도 처리
 * - 중간에 잘린 인코딩도 처리
 * 
 * @param {string} name - 광고명
 * @returns {string} - 디코딩된 광고명 (실패 시 원본 반환)
 */
function tryDecodeURIComponent(name) {
  if (!name) return '';
  
  // FIX (2026-01-30): % 문자가 있으면 디코딩 시도 (부분 디코딩 상태도 처리)
  if (!name.includes('%')) return name;
  
  // 플러스를 먼저 공백으로 변환 (application/x-www-form-urlencoded 형식)
  let processed = name.replace(/\+/g, ' ');
  
  // 잘못된 인코딩 수정: %% → %25% (예: 77%%20 → 77%25%20)
  processed = processed.replace(/%%/g, '%25%');
  
  // FIX (2026-01-30): 끝에 불완전한 % 시퀀스 먼저 제거
  // 예: "건강_영상_%E" → "건강_영상_", "건강_영상_%2" → "건강_영상_"
  // 이것은 부분 디코딩된 상태에서 끝이 잘린 경우
  processed = processed.replace(/%[0-9A-Fa-f]?$/, '');
  
  // FIX (2026-01-30): % 뒤에 유효한 16진수 두 자리가 아닌 경우 %25로 치환
  // 예: "77% 그립" → "77%25 그립", "77%그" → "77%25그"
  processed = processed.replace(/%(?![0-9A-Fa-f]{2})/g, '%25');
  
  // FIX (2026-02-04): 중간에 잘린 UTF-8 시퀀스도 처리
  // UTF-8 한글은 3바이트, 중간이 잘리면 디코딩 실패
  // %XX%XX 또는 %XX 형태로 끝나는 불완전 시퀀스 제거
  processed = processed.replace(/%[89AB][0-9A-Fa-f](%[89AB][0-9A-Fa-f])?$/, '');
  
  // FIX (2026-01-30): 끝에 불완전한 UTF-8 시퀀스 제거
  // UTF-8 한글은 3바이트 (%XX%XX%XX), 끝이 잘리면 디코딩 실패
  // 반복적으로 끝에서 불완전한 인코딩 제거 후 디코딩 시도
  let maxTries = 10;
  while (maxTries > 0) {
    try {
      return decodeURIComponent(processed);
    } catch (e) {
      // 끝에서 %XX 또는 % 제거 후 재시도
      const beforeLength = processed.length;
      // 끝이 %로 끝나면 제거
      if (processed.endsWith('%')) {
        processed = processed.slice(0, -1);
      }
      // 끝이 %X로 끝나면 제거 (불완전한 %XX)
      else if (/%[0-9A-Fa-f]$/.test(processed)) {
        processed = processed.slice(0, -2);
      }
      // 끝이 %XX로 끝나고 그것이 불완전한 UTF-8 시퀀스면 제거
      else if (/%[0-9A-Fa-f]{2}$/.test(processed)) {
        processed = processed.slice(0, -3);
      }
      else {
        // 더 이상 제거할 것이 없으면 종료
        break;
      }
      
      // 무한루프 방지
      if (processed.length === beforeLength) break;
      maxTries--;
    }
  }
  
  // 모든 시도 실패 시 원본 반환
  return name;
}

/**
 * 잘린/변형된 광고명을 정상 메타 광고명으로 매핑
 * 
 * FIX (2026-01-29): 매칭 로직 개선
 * - (중지) 접두사 제거 후 비교
 * - 플러스(+) ↔ 공백 변환 후 비교
 * - URL 인코딩된 값 디코딩 후 비교
 * 
 * FIX (2026-02-04): 양방향 비교 및 (중지) 접두사 처리 강화
 * - 트래커 광고명도 정규화해서 비교 (플러스→공백, 끝 _ 제거)
 * - "(중지) " 공백 포함 접두사 처리
 * - 메타 광고명 끝에 _ 붙은 경우도 처리
 * 
 * @param {string} truncatedName - 잘린/변형된 광고명
 * @param {string[]} metaAdNames - 메타 광고명 목록 (옵션, 없으면 자동 조회)
 * @returns {Promise<string|null>} - 매핑된 정상 광고명 또는 null
 */
async function mapToMetaAdName(truncatedName, metaAdNames = null) {
  if (!truncatedName) return null;
  
  const adNames = metaAdNames || await getMetaAdNames();
  if (adNames.length === 0) return null;
  
  // 1. 정확히 일치하는 경우
  if (adNames.includes(truncatedName)) {
    return truncatedName;
  }
  
  // 2. 깨진 문자(�) 포함 시 매핑하지 않음
  if (truncatedName.includes('\uFFFD') || truncatedName.includes('�')) {
    return null;
  }
  
  // 3. URL 디코딩 후 일치 확인
  const decodedName = tryDecodeURIComponent(truncatedName);
  if (decodedName !== truncatedName) {
    // 디코딩 성공 시 디코딩된 이름으로 재귀 호출
    const decodedMatch = await mapToMetaAdName(decodedName, adNames);
    if (decodedMatch) return decodedMatch;
  }
  
  // FIX (2026-02-04): 트래커 광고명도 정규화 (양방향 비교)
  const normalizedInput = normalizeAdName(truncatedName);
  
  // 4. 플러스(+) ↔ 공백 변환 후 비교 (양방향)
  for (const metaName of adNames) {
    const normalizedMeta = normalizeAdName(metaName);
    if (normalizedInput === normalizedMeta) {
      return metaName;
    }
  }
  
  // 5. (중지) 접두사 제거 후 비교
  // FIX (2026-02-04): '(중지) ' 공백 포함 및 다양한 형태 처리
  for (const metaName of adNames) {
    // Meta 광고명에서 (중지) 제거 (공백 포함)
    if (metaName.startsWith('(중지)')) {
      const withoutPrefix = metaName.replace(/^\(중지\)\s*/, '').trim();
      // 정확 일치
      if (truncatedName === withoutPrefix) {
        return metaName;
      }
      // 정규화 후 일치
      if (normalizedInput === normalizeAdName(withoutPrefix)) {
        return metaName;
      }
    }
  }
  
  // 6. 트래커 광고명에 (중지) 접두사가 있는 경우 제거 후 비교
  // FIX (2026-02-04): 트래커에서 (중지) 붙어서 수집된 경우도 처리
  if (truncatedName.startsWith('(중지)')) {
    const trackerWithoutPrefix = truncatedName.replace(/^\(중지\)\s*/, '').trim();
    const normalizedTrackerWithoutPrefix = normalizeAdName(trackerWithoutPrefix);
    
    for (const metaName of adNames) {
      // 메타에 (중지) 없는 원본이 있는지 확인
      if (metaName === trackerWithoutPrefix) {
        return metaName;
      }
      if (normalizeAdName(metaName) === normalizedTrackerWithoutPrefix) {
        return metaName;
      }
    }
  }
  
  // 7. 접두사 매칭 (잘린 광고명 → 원본 광고에 병합)
  // FIX (2026-01-30): 복구 - 잘린 광고명 세션이 전체의 0.19%로 미미하여 병합해도 무방
  // 최소 17자 이상이어야 의미있는 매칭
  if (truncatedName.length >= 17) {
    for (const metaName of adNames) {
      if (metaName.startsWith(truncatedName)) {
        return metaName;
      }
      // 정규화 후 접두사 매칭
      const normalizedMeta = normalizeAdName(metaName);
      if (normalizedMeta.startsWith(normalizedInput)) {
        return metaName;
      }
      // (중지) 제거 후 접두사 매칭
      // FIX (2026-02-04): '(중지) ' 공백 포함 처리
      if (metaName.startsWith('(중지)')) {
        const withoutPrefix = metaName.replace(/^\(중지\)\s*/, '').trim();
        if (withoutPrefix.startsWith(truncatedName)) {
          return metaName;
        }
        if (normalizeAdName(withoutPrefix).startsWith(normalizedInput)) {
          return metaName;
        }
      }
    }
  }
  
  // 8. 정규화된 트래커 이름으로 접두사 매칭 (역방향)
  // FIX (2026-02-04): 트래커 광고명이 정규화 후 메타 광고명의 접두사인 경우
  if (normalizedInput.length >= 17) {
    for (const metaName of adNames) {
      const normalizedMeta = normalizeAdName(metaName);
      // 메타 광고명이 정규화된 트래커 이름으로 시작하는 경우
      if (normalizedMeta.startsWith(normalizedInput)) {
        return metaName;
      }
    }
  }
  
  // (패키지 수정) 병합 로직 - 제거됨 (2026-01-30)
  // Meta에 "(패키지 수정)" 광고가 별도로 등록되어 있음
  // 원본과 다른 광고이므로 별도 취급 필요
  
  // "- 사본" 병합 로직 - 제거됨 (2026-01-30)
  // "- 사본" 광고는 원본과 별개의 광고로 취급
  // 타겟팅/예산이 다를 수 있으므로 별도 추적 필요
  
  // 날짜 버전 변형 매칭 - 제거됨 (2026-01-30)
  // 241216-02 → 241216-01 같은 임의 매칭은 데이터 왜곡 발생
  
  return null;
}

/**
 * 정상 메타 광고명에 매핑되는 모든 변형 광고명들을 찾기
 * (상세 API에서 사용: 정상 광고명 클릭 시 잘린 광고명 데이터도 포함해서 조회)
 * 
 * 중요: "잘린" 광고명도 변형으로 인정
 * - DB 광고명이 메타 광고명보다 짧고, 메타 광고명이 DB 광고명으로 시작하는 경우 변형
 * - 단, DB 광고명이 메타에 별도로 등록된 광고면 변형이 아님 (예: "...1초"와 "...1초 - 사본")
 * 
 * FIX (2026-01-27): 빈 문자열 처리
 * - metaAdName이 빈 문자열이어도 유효한 값으로 처리
 * - 실제로 utm_content가 빈 문자열로 저장된 데이터가 존재함
 * 
 * FIX (2026-02-02): 접두사 매칭 로직 추가 (테이블과 동일하게)
 * - 잘린 광고명도 변형으로 인정 (mapToMetaAdName과 동일한 로직)
 * - 최소 17자 이상이어야 의미있는 매칭
 * - 다른 메타 광고가 같은 접두사를 가지지 않는 경우만 변형으로 인정
 * 
 * FIX (2026-02-04): normalizeAdName 함수 사용으로 통일
 * - 플러스→공백, 끝 _ 제거, 연속 공백 처리 등 일관성 유지
 * 
 * @param {string} metaAdName - 정상 메타 광고명
 * @param {string[]} dbCreativeNames - DB에 있는 모든 광고명 목록
 * @param {string[]} metaAdNames - 메타 API에서 가져온 광고명 목록 (옵션)
 * @returns {string[]} - 매핑되는 모든 광고명 배열 (정상 광고명 포함)
 */
function getAllVariantNames(metaAdName, dbCreativeNames, metaAdNames = []) {
  // null/undefined만 거부, 빈 문자열은 유효한 값으로 처리
  if (metaAdName === null || metaAdName === undefined) {
    return [];
  }
  if (!dbCreativeNames || dbCreativeNames.length === 0) {
    return [metaAdName];
  }
  // 빈 문자열인 경우 변형 찾기 로직 스킵하고 그대로 반환
  if (metaAdName === '') {
    return [metaAdName];
  }
  
  const variants = new Set([metaAdName]);
  // FIX (2026-02-04): normalizeAdName 함수 사용으로 통일
  const normalizedMeta = normalizeAdName(metaAdName);
  
  // (중지) 접두사 제거한 버전도 준비
  // FIX (2026-02-04): '(중지) ' 공백 포함 처리
  const metaWithoutPrefix = metaAdName.startsWith('(중지)') 
    ? metaAdName.replace(/^\(중지\)\s*/, '').trim()
    : null;
  const normalizedMetaWithoutPrefix = metaWithoutPrefix 
    ? normalizeAdName(metaWithoutPrefix)
    : null;
  
  for (const dbName of dbCreativeNames) {
    // 정확히 일치
    if (dbName === metaAdName) continue;
    
    // 깨진 문자 포함 시 제외
    if (dbName.includes('\uFFFD') || dbName.includes('�')) continue;
    
    // 메타에 별도로 등록된 광고면 변형이 아님 (별도 광고)
    if (metaAdNames.includes(dbName)) continue;
    
    // FIX (2026-02-04): normalizeAdName 함수 사용
    const normalizedDb = normalizeAdName(dbName);
    
    // 1. 정규화 후 정확히 일치하는 경우 변형으로 인정
    if (normalizedDb === normalizedMeta) {
      variants.add(dbName);
      continue;
    }
    
    // 2. (중지) 접두사 제거 후 비교
    if (normalizedMetaWithoutPrefix && normalizedDb === normalizedMetaWithoutPrefix) {
      variants.add(dbName);
      continue;
    }
    
    // 3. DB 광고명에 (중지) 접두사가 있는 경우
    if (dbName.startsWith('(중지)')) {
      const dbWithoutPrefix = dbName.replace(/^\(중지\)\s*/, '').trim();
      const normalizedDbWithoutPrefix = normalizeAdName(dbWithoutPrefix);
      if (normalizedDbWithoutPrefix === normalizedMeta) {
        variants.add(dbName);
        continue;
      }
    }
    
    // 4. 접두사 매칭 (잘린 광고명 → 원본에 병합)
    // 최소 17자 이상이어야 의미있는 매칭
    if (dbName.length >= 17 && dbName.length < metaAdName.length) {
      // 원본이 DB 광고명으로 시작하면 변형으로 인정
      if (metaAdName.startsWith(dbName)) {
        variants.add(dbName);
        continue;
      }
      // 정규화 후 접두사 매칭
      if (normalizedMeta.startsWith(normalizedDb)) {
        variants.add(dbName);
        continue;
      }
      // (중지) 제거 후 접두사 매칭
      if (metaWithoutPrefix && metaWithoutPrefix.startsWith(dbName)) {
        variants.add(dbName);
        continue;
      }
      if (normalizedMetaWithoutPrefix && normalizedMetaWithoutPrefix.startsWith(normalizedDb)) {
        variants.add(dbName);
        continue;
      }
    }
    
    // 5. 정규화된 DB 이름이 정규화된 메타 이름의 접두사인 경우
    if (normalizedDb.length >= 17 && normalizedDb.length < normalizedMeta.length) {
      if (normalizedMeta.startsWith(normalizedDb)) {
        variants.add(dbName);
        continue;
      }
    }
  }
  
  return Array.from(variants);
}

/**
 * 여러 광고명을 한 번에 매핑 (테이블 데이터 병합용)
 * @param {Array<{creative_name: string, ...}>} rows - DB에서 조회한 광고 데이터 행들
 * @returns {Promise<Map<string, Array>>} - 메타광고명 → [병합할 행들] 맵
 */
async function groupByMetaAdName(rows) {
  const metaAdNames = await getMetaAdNames();
  const resultMap = new Map();
  const unmapped = [];
  
  for (const row of rows) {
    const metaName = await mapToMetaAdName(row.creative_name, metaAdNames);
    
    if (metaName) {
      if (!resultMap.has(metaName)) {
        resultMap.set(metaName, []);
      }
      resultMap.get(metaName).push(row);
    } else {
      // 매핑 안 되는 것은 그대로 유지 (깨진 문자, 과거 캠페인 등)
      unmapped.push(row);
    }
  }
  
  return { mapped: resultMap, unmapped };
}

/**
 * 캐시 초기화
 */
function clearCache() {
  metaAdNamesCache = null;
  metaAdNamesCacheTime = null;
  adNameToIdCache.clear();
}

/**
 * 광고명으로 ad_id 조회 (캐시에서)
 * FIX (2026-02-02): 미리보기 모달용 - DB 조회 없이 캐시에서 직접 조회
 * @param {string} adName - 메타 광고명
 * @returns {Promise<string|null>} - ad_id 또는 null
 */
async function getAdIdByName(adName) {
  if (!adName) return null;
  
  // 캐시가 비어 있으면 먼저 로드
  if (adNameToIdCache.size === 0) {
    await getMetaAdNames();
  }
  
  return adNameToIdCache.get(adName) || null;
}

// utm_content → ad_id 복원 맵 캐시 (5분 TTL)
let resolutionMapCache = null;
let resolutionMapCacheTime = null;
const RESOLUTION_CACHE_TTL = 5 * 60 * 1000;

/**
 * utm_id 없는 Meta 세션의 utm_content → ad_id 복원 맵 생성
 * URL이 잘려서 utm_id가 누락된 Meta 광고 세션을 meta_ads 테이블과 매칭하여 복원
 * 
 * 매칭 단계:
 * 1. utm_content와 meta_ads.name 정확 일치 (정규화 포함)
 * 2. utm_content가 meta_ads.name의 접두사 (15자 이상, 정규화 포함)
 * 3. URL 디코딩(이중인코딩 처리) 후 위 1-2 반복
 * 4. URL 디코딩 후 다른 세션(utm_id 있는)의 utm_content와 접두사 매칭
 * 
 * @returns {Promise<Array<{utm_content: string, resolved_ad_id: string}>>}
 */
async function buildUtmResolutionMap() {
  // 캐시가 유효하면 반환
  if (resolutionMapCache && resolutionMapCacheTime && (Date.now() - resolutionMapCacheTime < RESOLUTION_CACHE_TTL)) {
    return resolutionMapCache;
  }

  const db = require('../../utils/database');

  // 1. utm_id 없는 Meta 세션의 고유 utm_content 값 조회
  const needsResolutionResult = await db.query(`
    SELECT DISTINCT us.utm_params->>'utm_content' as utm_content
    FROM utm_sessions us
    JOIN visitors v ON us.visitor_id = v.visitor_id
    WHERE (us.utm_params->>'utm_id' IS NULL OR us.utm_params->>'utm_id' = '' OR us.utm_params->>'utm_id' LIKE '{{%')
      AND LOWER(COALESCE(us.utm_params->>'utm_source', '')) IN ('meta', 'facebook', 'fb', 'instagram', 'ig')
      AND us.utm_params->>'utm_content' IS NOT NULL
      AND us.utm_params->>'utm_content' NOT LIKE '{{%'
      AND v.is_bot = false
  `);

  if (needsResolutionResult.rows.length === 0) {
    resolutionMapCache = [];
    resolutionMapCacheTime = Date.now();
    return [];
  }

  // 2. Meta API + DB에서 최신 광고명 목록 로드
  // getMetaAdNames()는 Meta API 호출 + meta_ads DB 조회를 하며,
  // 결과를 adNameToIdCache에 자동 저장 (10분 캐시)
  // → 미리보기와 동일한 데이터 소스 사용으로 매칭 일관성 보장
  // → meta_ads DB도 부수 효과로 자동 갱신
  const adNames = await getMetaAdNames();

  if (adNames.length === 0) {
    resolutionMapCache = [];
    resolutionMapCacheTime = Date.now();
    return [];
  }

  // 3. utm_id 있는 Meta 세션의 utm_content → utm_id 매핑 (폴백용)
  // mapToMetaAdName으로 매칭 실패 시, 다른 세션의 utm_content와 접두사 매칭 시도
  const withUtmIdResult = await db.query(`
    SELECT DISTINCT
      us.utm_params->>'utm_content' as utm_content,
      us.utm_params->>'utm_id' as utm_id
    FROM utm_sessions us
    WHERE us.utm_params->>'utm_id' IS NOT NULL
      AND us.utm_params->>'utm_id' != ''
      AND us.utm_params->>'utm_id' NOT LIKE '{{%'
      AND LOWER(COALESCE(us.utm_params->>'utm_source', '')) IN ('meta', 'facebook', 'fb', 'instagram', 'ig')
      AND us.utm_params->>'utm_content' IS NOT NULL
  `);
  const contentWithUtmId = withUtmIdResult.rows;

  // 4. 매칭: mapToMetaAdName() 재활용 (미리보기와 동일한 로직)
  // → 기존 4단계 자체 매칭을 미리보기와 동일한 함수로 교체
  // → 매칭 로직 단일화: 미리보기에서 되면 테이블에서도 됨
  const resolutionEntries = [];

  for (const row of needsResolutionResult.rows) {
    const utmContent = row.utm_content;
    if (!utmContent) continue;

    let resolvedAdId = null;

    // FIX (2026-02-12): 세션 기반 매칭을 먼저 시도
    // 같은 소재가 Meta에서 재생성되면 ad_id가 바뀌는데,
    // meta_ads 테이블에는 이전(중지) 광고의 ad_id가 남아있어
    // 잘린 세션이 이전 광고 ID로 잘못 연결되는 문제 해결
    // → 실제 트래픽의 utm_id를 우선 사용하여 현재 활성 광고 ID로 복원

    // Primary: 다른 세션의 utm_content와 접두사 매칭 (실제 트래픽 기반)
    // utm_id 있는 다른 세션의 utm_content와 비교하여 utm_id 복원
    // → 현재 활성 광고의 실제 ad_id를 사용하므로 가장 정확
    const decoded = tryDecodeURIComponent(utmContent);
    const target = decoded !== utmContent ? decoded : utmContent;
    if (target.length >= 15) {
      const sessionMatch = contentWithUtmId.find(s =>
        s.utm_content && s.utm_content.startsWith(target)
      );
      if (sessionMatch) {
        resolvedAdId = sessionMatch.utm_id;
      }
    }

    // Fallback: mapToMetaAdName으로 Meta 광고명 매칭
    // 세션 기반 매칭 실패 시 (해당 소재의 정상 세션이 없는 경우),
    // meta_ads 테이블의 광고명과 매칭하여 ad_id 복원
    if (!resolvedAdId) {
      const metaAdName = await mapToMetaAdName(utmContent, adNames);
      if (metaAdName) {
        const adId = await getAdIdByName(metaAdName);
        if (adId) {
          resolvedAdId = adId;
        }
      }
    }

    if (resolvedAdId) {
      resolutionEntries.push({
        utm_content: utmContent,
        resolved_ad_id: resolvedAdId
      });
    }
  }

  console.log(`[UtmResolution] Resolved ${resolutionEntries.length}/${needsResolutionResult.rows.length} Meta utm_content entries (API+DB)`);

  // 캐시 저장
  resolutionMapCache = resolutionEntries;
  resolutionMapCacheTime = Date.now();

  return resolutionEntries;
}

module.exports = {
  getMetaAdNames,
  mapToMetaAdName,
  getAllVariantNames,
  groupByMetaAdName,
  clearCache,
  getAdIdByName,
  buildUtmResolutionMap
};
