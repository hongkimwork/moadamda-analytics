/**
 * 메타 광고명 매핑 유틸리티
 * 잘린/변형된 광고명을 메타 API의 정상 광고명으로 매핑
 */

const https = require('https');

// 메타 광고명 캐시 (10분 TTL)
let metaAdNamesCache = null;
let metaAdNamesCacheTime = null;
const CACHE_TTL = 10 * 60 * 1000; // 10분

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

  try {
    // 1. 메타 API에서 ACTIVE/PAUSED 광고명 가져오기
    const [activeResult, pausedResult] = await Promise.all([
      callMetaApiSimple(`${META_AD_ACCOUNT_ID}/ads`, {
        fields: 'name',
        filtering: JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['ACTIVE'] }]),
        limit: 500
      }),
      callMetaApiSimple(`${META_AD_ACCOUNT_ID}/ads`, {
        fields: 'name',
        filtering: JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['PAUSED'] }]),
        limit: 500
      })
    ]);
    
    const apiAds = [...(activeResult.data || []), ...(pausedResult.data || [])];
    const apiNames = apiAds.map(ad => ad.name).filter(Boolean);
    
    // 2. DB의 meta_ads 테이블에서 광고명 가져오기 (ARCHIVED 포함)
    let dbNames = [];
    try {
      const db = require('../../utils/database');
      const dbResult = await db.query('SELECT DISTINCT name FROM meta_ads WHERE name IS NOT NULL');
      dbNames = dbResult.rows.map(row => row.name);
    } catch (dbError) {
      console.warn('[MetaAdNameMapping] Failed to fetch ad names from DB:', dbError.message);
    }
    
    // 3. API + DB 광고명 합치기 (중복 제거)
    const uniqueNames = [...new Set([...apiNames, ...dbNames])];
    
    // 캐시 저장
    metaAdNamesCache = uniqueNames;
    metaAdNamesCacheTime = Date.now();
    
    console.log(`[MetaAdNameMapping] Loaded ${uniqueNames.length} ad names (API: ${apiNames.length}, DB: ${dbNames.length})`);
    
    return uniqueNames;
  } catch (error) {
    console.error('[MetaAdNameMapping] Failed to fetch meta ad names:', error.message);
    // 캐시가 있으면 만료되었더라도 반환 (폴백)
    if (metaAdNamesCache) {
      console.log('[MetaAdNameMapping] Using cached ad names as fallback');
      return metaAdNamesCache;
    }
    return [];
  }
}

/**
 * 광고명 정규화 (비교용)
 * - 플러스(+)와 공백을 동일하게 취급
 * @param {string} name - 광고명
 * @returns {string} - 정규화된 광고명
 */
function normalizeAdName(name) {
  if (!name) return '';
  // 플러스를 공백으로 통일
  return name.replace(/\+/g, ' ');
}

/**
 * URL 디코딩 시도
 * @param {string} name - 광고명
 * @returns {string} - 디코딩된 광고명 (실패 시 원본 반환)
 */
function tryDecodeURIComponent(name) {
  if (!name) return '';
  // URL 인코딩 패턴이 있는지 확인 (%XX 형태)
  if (!/%[0-9A-Fa-f]{2}/.test(name)) return name;
  
  try {
    // 플러스를 먼저 공백으로 변환 (application/x-www-form-urlencoded 형식)
    let processed = name.replace(/\+/g, ' ');
    
    // 잘못된 인코딩 수정: %% → %25% (예: 77%%20 → 77%25%20)
    // %가 인코딩되지 않은 채로 저장된 경우
    processed = processed.replace(/%%/g, '%25%');
    
    // 끝에 잘린 인코딩 제거 (예: ...%EB%8B%A4%EC%9D%B4%EC%96%B4% → 끝의 % 제거)
    processed = processed.replace(/%[0-9A-Fa-f]?$/, '');
    
    return decodeURIComponent(processed);
  } catch (e) {
    // 디코딩 실패 시 원본 반환
    return name;
  }
}

/**
 * 잘린/변형된 광고명을 정상 메타 광고명으로 매핑
 * 
 * FIX (2026-01-29): 매칭 로직 개선
 * - (중지) 접두사 제거 후 비교
 * - 플러스(+) ↔ 공백 변환 후 비교
 * - URL 인코딩된 값 디코딩 후 비교
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
  
  // 4. 플러스(+) ↔ 공백 변환 후 비교
  const normalizedInput = normalizeAdName(truncatedName);
  for (const metaName of adNames) {
    const normalizedMeta = normalizeAdName(metaName);
    if (normalizedInput === normalizedMeta) {
      return metaName;
    }
  }
  
  // 5. (중지) 접두사 제거 후 비교
  for (const metaName of adNames) {
    // Meta 광고명에서 (중지) 제거
    if (metaName.startsWith('(중지)')) {
      const withoutPrefix = metaName.substring(4); // '(중지)' 는 4글자
      // 정확 일치
      if (truncatedName === withoutPrefix) {
        return metaName;
      }
      // 정규화 후 일치
      if (normalizeAdName(truncatedName) === normalizeAdName(withoutPrefix)) {
        return metaName;
      }
    }
  }
  
  // 6. 접두사 매칭 (잘린 광고명이 정상 광고명의 시작 부분과 일치)
  // 최소 13자 이상이어야 의미있는 매칭
  if (truncatedName.length >= 13) {
    for (const metaName of adNames) {
      if (metaName.startsWith(truncatedName)) {
        return metaName;
      }
      // 정규화 후 접두사 매칭
      if (normalizeAdName(metaName).startsWith(normalizedInput)) {
        return metaName;
      }
      // (중지) 제거 후 접두사 매칭
      if (metaName.startsWith('(중지)')) {
        const withoutPrefix = metaName.substring(4);
        if (withoutPrefix.startsWith(truncatedName)) {
          return metaName;
        }
        if (normalizeAdName(withoutPrefix).startsWith(normalizedInput)) {
          return metaName;
        }
      }
    }
  }
  
  // 7. 공백 제거 후 비교 (최소 30자 이상)
  if (truncatedName.length >= 30) {
    const noSpaceTruncated = truncatedName.replace(/\s+/g, '');
    for (const metaName of adNames) {
      const noSpaceMeta = metaName.replace(/\s+/g, '');
      if (noSpaceMeta.startsWith(noSpaceTruncated)) {
        return metaName;
      }
    }
  }
  
  // 8. (패키지 수정) 접미사 제거 후 비교
  // FIX (2026-01-29): UTM creative_name에 붙은 "(패키지 수정)" 접미사 처리
  if (truncatedName.includes('(패키지 수정)')) {
    const withoutPkgSuffix = truncatedName.replace(/\s*\(패키지 수정\)\s*$/, '').trim();
    if (withoutPkgSuffix !== truncatedName) {
      const pkgMatch = await mapToMetaAdName(withoutPkgSuffix, adNames);
      if (pkgMatch) {
        return pkgMatch;
      }
    }
  }
  
  // 9. "- 사본" 접미사 제거 후 비교
  // FIX (2026-01-29): UTM creative_name에 붙은 "- 사본" 접미사 처리
  if (truncatedName.includes('- 사본')) {
    const withoutCopySuffix = truncatedName.replace(/\s*-\s*사본\s*$/, '').trim();
    if (withoutCopySuffix !== truncatedName) {
      const copyMatch = await mapToMetaAdName(withoutCopySuffix, adNames);
      if (copyMatch) {
        return copyMatch;
      }
      
      // "- 사본" 제거 후에도 매칭 안 되면, 숫자 변형도 시도 (예: 글램미홍지윤1 → 글램미홍지윤)
      // 패턴: 이름 끝에 붙은 숫자 제거 (예: _글램미홍지윤1_250925 → _글램미홍지윤_250925)
      const withoutTrailingNum = withoutCopySuffix.replace(/(\d+)_(\d{6})$/, (match, num, date) => {
        // 숫자가 날짜 앞에 있고, 앞에 글자가 있는 경우에만 제거
        return '_' + date;
      });
      if (withoutTrailingNum !== withoutCopySuffix) {
        const numMatch = await mapToMetaAdName(withoutTrailingNum, adNames);
        if (numMatch) {
          return numMatch;
        }
      }
    }
  }
  
  // 10. 날짜 코드의 마이너 버전 변형 매칭 (예: 241216-02 → 241216-01)
  // FIX (2026-01-29): 날짜 코드에서 -XX 부분을 변형하여 매칭 시도
  const dateCodeMatch = truncatedName.match(/\((\d{6})-(\d{2})\)/);
  if (dateCodeMatch) {
    const [fullMatch, dateCode, versionNum] = dateCodeMatch;
    // 버전 번호를 01~05까지 시도
    for (let v = 1; v <= 5; v++) {
      if (v === parseInt(versionNum, 10)) continue; // 현재 버전은 스킵
      const altVersion = String(v).padStart(2, '0');
      const altName = truncatedName.replace(`(${dateCode}-${versionNum})`, `(${dateCode}-${altVersion})`);
      const versionMatch = await mapToMetaAdName(altName, adNames);
      if (versionMatch) {
        return versionMatch;
      }
    }
  }
  
  return null;
}

/**
 * 정상 메타 광고명에 매핑되는 모든 변형 광고명들을 찾기
 * (상세 API에서 사용: 정상 광고명 클릭 시 잘린 광고명 데이터도 포함해서 조회)
 * 
 * 중요: "잘린" 광고명만 변형으로 인정
 * - DB 광고명이 메타 광고명보다 짧고, 메타 광고명이 DB 광고명으로 시작하는 경우만 변형
 * - 단, DB 광고명이 메타에 별도로 등록된 광고면 변형이 아님 (예: "...1초"와 "...1초 - 사본")
 * 
 * FIX (2026-01-27): 빈 문자열 처리
 * - metaAdName이 빈 문자열이어도 유효한 값으로 처리
 * - 실제로 utm_content가 빈 문자열로 저장된 데이터가 존재함
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
  
  for (const dbName of dbCreativeNames) {
    // 정확히 일치
    if (dbName === metaAdName) continue;
    
    // 깨진 문자 포함 시 제외
    if (dbName.includes('\uFFFD') || dbName.includes('�')) continue;
    
    // 메타에 별도로 등록된 광고면 변형이 아님 (별도 광고)
    if (metaAdNames.includes(dbName)) continue;
    
    // 잘린 광고명 매칭: DB 이름이 메타 이름보다 짧고, 메타 이름이 DB 이름으로 시작하는 경우
    // (URL 인코딩 등으로 광고명이 잘린 경우만 변형으로 인정)
    if (dbName.length >= 13 && dbName.length < metaAdName.length && metaAdName.startsWith(dbName)) {
      variants.add(dbName);
      continue;
    }
    
    // 공백 제거 후 비교 (잘린 경우만)
    if (dbName.length >= 30 && dbName.length < metaAdName.length) {
      const noSpaceDb = dbName.replace(/\s+/g, '');
      const noSpaceMeta = metaAdName.replace(/\s+/g, '');
      if (noSpaceMeta.startsWith(noSpaceDb) && noSpaceDb.length < noSpaceMeta.length) {
        variants.add(dbName);
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
}

module.exports = {
  getMetaAdNames,
  mapToMetaAdName,
  getAllVariantNames,
  groupByMetaAdName,
  clearCache
};
