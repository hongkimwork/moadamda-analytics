/**
 * Meta (Facebook/Instagram) 광고 API 유틸리티
 * 
 * 사용법:
 * const metaAd = require('./utils/metaAd');
 * const campaigns = await metaAd.getCampaigns();
 */

const https = require('https');

// 환경 변수
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID;
const API_VERSION = 'v20.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

/**
 * Meta Graph API 호출 함수
 * @param {string} endpoint - API 엔드포인트
 * @param {object} params - 요청 파라미터
 * @returns {Promise<object>} - API 응답
 */
async function callApi(endpoint, params = {}) {
  return new Promise((resolve, reject) => {
    params.access_token = META_ACCESS_TOKEN;
    
    const queryString = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'object') {
        queryString.append(key, JSON.stringify(value));
      } else {
        queryString.append(key, value);
      }
    }
    
    const url = `${BASE_URL}/${endpoint}?${queryString.toString()}`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          if (jsonData.error) {
            reject(new Error(jsonData.error.message));
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
 * 페이지네이션을 처리하여 모든 데이터 가져오기
 * @param {string} endpoint - API 엔드포인트
 * @param {object} params - 요청 파라미터
 * @returns {Promise<Array>} - 전체 데이터 배열
 */
async function fetchAllPages(endpoint, params = {}) {
  const allData = [];
  let nextUrl = null;
  
  // 첫 번째 요청
  const firstResult = await callApi(endpoint, { ...params, limit: 500 });
  allData.push(...(firstResult.data || []));
  
  // 페이지네이션 처리
  if (firstResult.paging && firstResult.paging.next) {
    nextUrl = firstResult.paging.next;
  }
  
  while (nextUrl) {
    const result = await fetchNextPage(nextUrl);
    allData.push(...(result.data || []));
    nextUrl = result.paging?.next || null;
  }
  
  return allData;
}

/**
 * 다음 페이지 가져오기
 */
async function fetchNextPage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

/**
 * 캠페인 목록 조회
 * @returns {Promise<Array>} - 캠페인 배열
 */
async function getCampaigns() {
  const fields = [
    'id', 'name', 'objective', 'status',
    'daily_budget', 'lifetime_budget',
    'created_time', 'updated_time'
  ].join(',');
  
  return await fetchAllPages(`${META_AD_ACCOUNT_ID}/campaigns`, { fields });
}

/**
 * 광고세트 목록 조회
 * @returns {Promise<Array>} - 광고세트 배열
 */
async function getAdsets() {
  const fields = [
    'id', 'name', 'campaign_id', 'status',
    'optimization_goal', 'billing_event',
    'daily_budget', 'lifetime_budget',
    'targeting', 'created_time', 'updated_time'
  ].join(',');
  
  return await fetchAllPages(`${META_AD_ACCOUNT_ID}/adsets`, { fields });
}

/**
 * 광고 목록 조회
 * @returns {Promise<Array>} - 광고 배열
 */
async function getAds() {
  const fields = [
    'id', 'name', 'adset_id', 'campaign_id', 'status',
    'creative', 'created_time', 'updated_time'
  ].join(',');
  
  return await fetchAllPages(`${META_AD_ACCOUNT_ID}/ads`, { fields });
}

/**
 * 광고 성과 조회 (Insights)
 * @param {string} startDate - 시작일 (YYYY-MM-DD)
 * @param {string} endDate - 종료일 (YYYY-MM-DD)
 * @param {string} level - 집계 레벨 ('campaign', 'adset', 'ad')
 * @returns {Promise<Array>} - 인사이트 배열
 */
async function getInsights(startDate, endDate, level = 'ad') {
  const fields = [
    'campaign_id', 'campaign_name',
    'adset_id', 'adset_name',
    'ad_id', 'ad_name',
    'impressions', 'reach', 'clicks',
    'outbound_clicks', 'spend',
    'actions', 'action_values',
    'purchase_roas',
    'video_play_actions',
    'video_p25_watched_actions',
    'video_p50_watched_actions',
    'video_p75_watched_actions',
    'video_p100_watched_actions',
    'video_avg_time_watched_actions'
  ].join(',');
  
  const params = {
    fields,
    level,
    time_range: { since: startDate, until: endDate },
    time_increment: 1,  // 일별 데이터
    limit: 500
  };
  
  return await fetchAllPages(`${META_AD_ACCOUNT_ID}/insights`, params);
}

/**
 * 계정 정보 조회
 * @returns {Promise<object>} - 계정 정보
 */
async function getAccountInfo() {
  const fields = 'name,account_status,currency,timezone_name';
  return await callApi(META_AD_ACCOUNT_ID, { fields });
}

/**
 * actions 배열에서 특정 액션 타입의 값 추출
 * @param {Array} actions - actions 배열
 * @param {string} actionType - 액션 타입 (예: 'purchase', 'add_to_cart')
 * @returns {number} - 해당 액션의 값
 */
function extractAction(actions, actionType) {
  if (!actions || !Array.isArray(actions)) return 0;
  const action = actions.find(a => a.action_type === actionType);
  return action ? parseInt(action.value, 10) : 0;
}

/**
 * action_values 배열에서 특정 액션의 금액 추출
 * @param {Array} actionValues - action_values 배열
 * @param {string} actionType - 액션 타입
 * @returns {number} - 해당 액션의 금액
 */
function extractActionValue(actionValues, actionType) {
  if (!actionValues || !Array.isArray(actionValues)) return 0;
  const action = actionValues.find(a => a.action_type === actionType);
  return action ? parseFloat(action.value) : 0;
}

/**
 * 동영상 지표 추출 (video_*_actions 배열에서)
 * @param {Array} videoActions - video actions 배열
 * @returns {number} - 값
 */
function extractVideoAction(videoActions) {
  if (!videoActions || !Array.isArray(videoActions)) return 0;
  // video 타입의 값 합산
  return videoActions.reduce((sum, action) => {
    return sum + (parseInt(action.value, 10) || 0);
  }, 0);
}

/**
 * outbound_clicks에서 값 추출
 * @param {Array} outboundClicks - outbound_clicks 배열
 * @returns {number} - 외부 클릭수
 */
function extractOutboundClicks(outboundClicks) {
  if (!outboundClicks || !Array.isArray(outboundClicks)) return 0;
  const click = outboundClicks.find(c => c.action_type === 'outbound_click');
  return click ? parseInt(click.value, 10) : 0;
}

module.exports = {
  callApi,
  getCampaigns,
  getAdsets,
  getAds,
  getInsights,
  getAccountInfo,
  extractAction,
  extractActionValue,
  extractVideoAction,
  extractOutboundClicks,
  META_AD_ACCOUNT_ID
};

