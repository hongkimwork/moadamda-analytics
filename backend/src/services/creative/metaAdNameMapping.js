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
 * @returns {Promise<string[]>} - 고유한 광고명 배열
 */
async function getMetaAdNames() {
  // 캐시가 유효하면 캐시 반환
  if (metaAdNamesCache && metaAdNamesCacheTime && (Date.now() - metaAdNamesCacheTime < CACHE_TTL)) {
    return metaAdNamesCache;
  }

  try {
    // 광고명만 가져오기 (fields 최소화로 데이터 양 줄임)
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
    
    const allAds = [...(activeResult.data || []), ...(pausedResult.data || [])];
    
    // 고유한 광고명 추출
    const uniqueNames = [...new Set(allAds.map(ad => ad.name).filter(Boolean))];
    
    // 캐시 저장
    metaAdNamesCache = uniqueNames;
    metaAdNamesCacheTime = Date.now();
    
    console.log(`[MetaAdNameMapping] Loaded ${uniqueNames.length} ad names from Meta API`);
    
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
 * 잘린/변형된 광고명을 정상 메타 광고명으로 매핑
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
  
  // 3. 접두사 매칭 (잘린 광고명이 정상 광고명의 시작 부분과 일치)
  // 최소 13자 이상이어야 의미있는 매칭
  if (truncatedName.length >= 13) {
    for (const metaName of adNames) {
      if (metaName.startsWith(truncatedName)) {
        return metaName;
      }
    }
  }
  
  // 4. 공백 제거 후 비교 (최소 30자 이상)
  if (truncatedName.length >= 30) {
    const noSpaceTruncated = truncatedName.replace(/\s+/g, '');
    for (const metaName of adNames) {
      const noSpaceMeta = metaName.replace(/\s+/g, '');
      if (noSpaceMeta.startsWith(noSpaceTruncated)) {
        return metaName;
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
 * - "...1초"와 "...1초 - 사본"은 별도 광고 (사본이 원본의 변형이 아님)
 * 
 * @param {string} metaAdName - 정상 메타 광고명
 * @param {string[]} dbCreativeNames - DB에 있는 모든 광고명 목록
 * @returns {string[]} - 매핑되는 모든 광고명 배열 (정상 광고명 포함)
 */
function getAllVariantNames(metaAdName, dbCreativeNames) {
  if (!metaAdName || !dbCreativeNames || dbCreativeNames.length === 0) {
    return metaAdName ? [metaAdName] : [];
  }
  
  const variants = new Set([metaAdName]);
  
  for (const dbName of dbCreativeNames) {
    // 정확히 일치
    if (dbName === metaAdName) continue;
    
    // 깨진 문자 포함 시 제외
    if (dbName.includes('\uFFFD') || dbName.includes('�')) continue;
    
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
