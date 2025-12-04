/**
 * 네이버 검색광고 API 유틸리티
 * 작성일: 2025-12-04
 */

const crypto = require('crypto');
const https = require('https');

const API_KEY = process.env.NAVER_AD_API_KEY;
const SECRET_KEY = process.env.NAVER_AD_SECRET_KEY;
const CUSTOMER_ID = process.env.NAVER_AD_CUSTOMER_ID;

const BASE_URL = 'api.searchad.naver.com';

/**
 * API 요청 서명 생성
 */
function generateSignature(timestamp, method, path) {
  return crypto
    .createHmac('sha256', SECRET_KEY)
    .update(`${timestamp}.${method}.${path}`)
    .digest('base64');
}

/**
 * 네이버 검색광고 API 호출
 */
function callApi(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now().toString();
    
    // 서명 생성 시 쿼리스트링 제외 (경로만 사용)
    const pathWithoutQuery = path.split('?')[0];
    const signature = generateSignature(timestamp, method, pathWithoutQuery);

    const options = {
      hostname: BASE_URL,
      path: path,
      method: method,
      headers: {
        'X-Timestamp': timestamp,
        'X-API-KEY': API_KEY,
        'X-Customer': CUSTOMER_ID,
        'X-Signature': signature,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(data);
          }
        } else {
          reject(new Error(`API Error ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

/**
 * 캠페인 목록 조회
 */
async function getCampaigns() {
  const campaigns = await callApi('GET', '/ncc/campaigns');
  return campaigns;
}

/**
 * 광고그룹 목록 조회 (캠페인별)
 */
async function getAdGroups(campaignId = null) {
  let path = '/ncc/adgroups';
  if (campaignId) {
    path += `?nccCampaignId=${campaignId}`;
  }
  const adgroups = await callApi('GET', path);
  return adgroups;
}

/**
 * 키워드 목록 조회 (광고그룹별)
 */
async function getKeywords(adGroupId) {
  const path = `/ncc/keywords?nccAdgroupId=${adGroupId}`;
  const keywords = await callApi('GET', path);
  return keywords;
}

/**
 * 광고 목록 조회 (광고그룹별)
 */
async function getAds(adGroupId) {
  const path = `/ncc/ads?nccAdgroupId=${adGroupId}`;
  const ads = await callApi('GET', path);
  return ads;
}

/**
 * 성과 데이터 조회
 * @param {string[]} ids - 조회할 엔티티 ID 목록 (캠페인, 광고그룹, 키워드 등)
 * @param {string} since - 시작일 (YYYY-MM-DD)
 * @param {string} until - 종료일 (YYYY-MM-DD)
 * @param {string} breakdown - 분류 타입 (pcMblTp: PC/Mobile 구분, 없으면 합산)
 */
/**
 * 성과 데이터 조회 (공식 문서 방식)
 * @param {string[]} ids - 조회할 엔티티 ID 목록 (캠페인, 광고그룹, 키워드 등)
 * @param {string} since - 시작일 (YYYY-MM-DD)
 * @param {string} until - 종료일 (YYYY-MM-DD)
 */
async function getStats(ids, since, until) {
  // 공식 문서 필드 목록
  const fields = '["clkCnt","impCnt","salesAmt","ctr","cpc","avgRnk","ccnt"]';
  const timeRange = `{"since":"${since}","until":"${until}"}`;
  
  // ids는 배열로 전달 (각각 ids=xxx 형태로)
  const idsParam = ids.map(id => `ids=${id}`).join('&');
  
  // 기본 합산 데이터 조회 (timeIncrement 생략 = allDays)
  const path = `/stats?${idsParam}&fields=${encodeURIComponent(fields)}&timeRange=${encodeURIComponent(timeRange)}`;
  
  const stats = await callApi('GET', path);
  return stats;
}

/**
 * 설정 확인
 */
function checkConfig() {
  const missing = [];
  if (!API_KEY) missing.push('NAVER_AD_API_KEY');
  if (!SECRET_KEY) missing.push('NAVER_AD_SECRET_KEY');
  if (!CUSTOMER_ID) missing.push('NAVER_AD_CUSTOMER_ID');
  
  if (missing.length > 0) {
    throw new Error(`Missing env variables: ${missing.join(', ')}`);
  }
  
  return {
    apiKey: API_KEY ? '✅' : '❌',
    secretKey: SECRET_KEY ? '✅' : '❌',
    customerId: CUSTOMER_ID
  };
}

module.exports = {
  callApi,
  getCampaigns,
  getAdGroups,
  getKeywords,
  getAds,
  getStats,
  checkConfig,
  CUSTOMER_ID
};

