/**
 * Meta (Facebook) Ads API Service
 * 캠페인, 광고 세트, 광고 데이터 및 성과 지표 조회
 */

const https = require('https');

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID;
const API_VERSION = 'v20.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

// 간단한 메모리 캐시 (5분 TTL)
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5분

/**
 * 캐시 키 생성
 */
function getCacheKey(endpoint, params) {
  return `${endpoint}:${JSON.stringify(params)}`;
}

/**
 * 캐시에서 데이터 조회
 */
function getFromCache(key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  cache.delete(key);
  return null;
}

/**
 * 캐시에 데이터 저장
 */
function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

/**
 * Meta Graph API 호출
 */
function callMetaApi(endpoint, params = {}, useCache = true) {
  return new Promise((resolve, reject) => {
    const cacheKey = getCacheKey(endpoint, params);
    
    if (useCache) {
      const cached = getFromCache(cacheKey);
      if (cached) {
        return resolve(cached);
      }
    }

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
            if (useCache) {
              setCache(cacheKey, jsonData);
            }
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
 * 페이지네이션 처리하여 모든 데이터 가져오기
 */
async function fetchAllPages(endpoint, params = {}, limit = 500) {
  const allData = [];
  let nextUrl = null;
  params.limit = Math.min(limit, 500);

  // 첫 페이지
  const firstPage = await callMetaApi(endpoint, params, false);
  if (firstPage.data) {
    allData.push(...firstPage.data);
  }

  // 다음 페이지들
  nextUrl = firstPage.paging?.next;
  while (nextUrl && allData.length < limit) {
    const pageData = await fetchNextPage(nextUrl);
    if (pageData.data) {
      allData.push(...pageData.data);
    }
    nextUrl = pageData.paging?.next;
  }

  return allData.slice(0, limit);
}

/**
 * 다음 페이지 URL로 데이터 가져오기
 */
function fetchNextPage(url) {
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

// ============================================================================
// 캠페인 관련 함수
// ============================================================================

/**
 * 캠페인 목록 조회
 */
async function getCampaigns(options = {}) {
  const { status = 'ACTIVE', limit = 100 } = options;
  
  const params = {
    fields: 'id,name,status,effective_status,objective,buying_type,daily_budget,lifetime_budget,budget_remaining,created_time,updated_time',
    limit
  };

  // 상태 필터링
  if (status && status !== 'ALL') {
    params.filtering = JSON.stringify([
      { field: 'effective_status', operator: 'IN', value: [status] }
    ]);
  }

  const data = await fetchAllPages(`${META_AD_ACCOUNT_ID}/campaigns`, params, limit);
  return data;
}

/**
 * 광고 세트 목록 조회
 */
async function getAdSets(options = {}) {
  const { status = 'ACTIVE', campaignIds = [], limit = 200 } = options;
  
  const params = {
    fields: 'id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget,budget_remaining,optimization_goal,billing_event,bid_strategy,targeting,created_time,updated_time',
    limit
  };

  const filtering = [];
  
  if (status && status !== 'ALL') {
    filtering.push({ field: 'effective_status', operator: 'IN', value: [status] });
  }
  
  if (campaignIds.length > 0) {
    filtering.push({ field: 'campaign.id', operator: 'IN', value: campaignIds });
  }

  if (filtering.length > 0) {
    params.filtering = JSON.stringify(filtering);
  }

  const data = await fetchAllPages(`${META_AD_ACCOUNT_ID}/adsets`, params, limit);
  return data;
}

/**
 * 광고 목록 조회
 */
async function getAds(options = {}) {
  const { status = 'ACTIVE', adSetIds = [], campaignIds = [], limit = 500 } = options;
  
  const params = {
    fields: 'id,name,adset_id,campaign_id,status,effective_status,creative{id,thumbnail_url,image_url,video_id,object_story_spec,asset_feed_spec},created_time,updated_time',
    limit
  };

  const filtering = [];
  
  if (status && status !== 'ALL') {
    filtering.push({ field: 'effective_status', operator: 'IN', value: [status] });
  }
  
  // 광고 세트 ID로 필터링 (우선순위 높음)
  if (adSetIds.length > 0) {
    filtering.push({ field: 'adset.id', operator: 'IN', value: adSetIds });
  }
  // 캠페인 ID로 필터링 (광고 세트 ID가 없을 때)
  else if (campaignIds.length > 0) {
    filtering.push({ field: 'campaign.id', operator: 'IN', value: campaignIds });
  }

  if (filtering.length > 0) {
    params.filtering = JSON.stringify(filtering);
  }

  const data = await fetchAllPages(`${META_AD_ACCOUNT_ID}/ads`, params, limit);
  return data;
}

// ============================================================================
// Insights (성과 지표) 관련 함수
// ============================================================================

/**
 * 성과 지표 조회
 */
async function getInsights(options = {}) {
  const { 
    level = 'campaign', // campaign, adset, ad
    ids = [],
    dateFrom,
    dateTo,
    fields = null
  } = options;

  // 기본 필드 (메타 광고 관리자와 동일한 지표들)
  const defaultFields = [
    'campaign_id', 'campaign_name',
    'adset_id', 'adset_name', 
    'ad_id', 'ad_name',
    'impressions', 'reach', 'frequency',
    'clicks', 'inline_link_clicks',
    'ctr', 'cpc', 'cpm', 'cpp',
    'spend',
    'actions', 'action_values',
    'conversions', 'conversion_values',
    'cost_per_action_type',
    'purchase_roas', 'website_purchase_roas',
    'video_play_actions',
    'video_p25_watched_actions', 'video_p50_watched_actions',
    'video_p75_watched_actions', 'video_p100_watched_actions',
    'video_avg_time_watched_actions',
    'cost_per_thruplay',
    'outbound_clicks', 'outbound_clicks_ctr',
    'inline_post_engagement'
  ].join(',');

  const params = {
    fields: fields || defaultFields,
    level
  };

  // 날짜 범위 설정
  if (dateFrom && dateTo) {
    params.time_range = JSON.stringify({
      since: dateFrom,
      until: dateTo
    });
  }

  // 특정 ID들에 대한 인사이트 조회
  if (ids.length > 0) {
    params.filtering = JSON.stringify([
      { field: `${level}.id`, operator: 'IN', value: ids }
    ]);
  }

  const result = await callMetaApi(`${META_AD_ACCOUNT_ID}/insights`, params, false);
  return result.data || [];
}

/**
 * 캠페인별 인사이트 조회
 */
async function getCampaignInsights(campaignIds, dateFrom, dateTo) {
  return getInsights({
    level: 'campaign',
    ids: campaignIds,
    dateFrom,
    dateTo
  });
}

/**
 * 광고 세트별 인사이트 조회
 */
async function getAdSetInsights(adSetIds, dateFrom, dateTo) {
  return getInsights({
    level: 'adset',
    ids: adSetIds,
    dateFrom,
    dateTo
  });
}

/**
 * 광고별 인사이트 조회
 */
async function getAdInsights(adIds, dateFrom, dateTo) {
  return getInsights({
    level: 'ad',
    ids: adIds,
    dateFrom,
    dateTo
  });
}

// ============================================================================
// 통합 데이터 조회 함수
// ============================================================================

/**
 * 캠페인 + 인사이트 통합 조회
 */
async function getCampaignsWithInsights(options = {}) {
  const { status = 'ACTIVE', dateFrom, dateTo } = options;
  
  // 1. 캠페인 목록 조회
  const campaigns = await getCampaigns({ status });
  
  if (campaigns.length === 0) {
    return [];
  }

  // 2. 인사이트 조회
  const campaignIds = campaigns.map(c => c.id);
  const insights = await getCampaignInsights(campaignIds, dateFrom, dateTo);

  // 3. 데이터 병합
  const insightsMap = new Map(insights.map(i => [i.campaign_id, i]));
  
  return campaigns.map(campaign => ({
    ...campaign,
    insights: insightsMap.get(campaign.id) || null
  }));
}

/**
 * 광고 세트 + 인사이트 통합 조회
 */
async function getAdSetsWithInsights(options = {}) {
  const { status = 'ACTIVE', campaignIds = [], dateFrom, dateTo } = options;
  
  const adSets = await getAdSets({ status, campaignIds });
  
  if (adSets.length === 0) {
    return [];
  }

  const adSetIds = adSets.map(a => a.id);
  const insights = await getAdSetInsights(adSetIds, dateFrom, dateTo);

  const insightsMap = new Map(insights.map(i => [i.adset_id, i]));
  
  return adSets.map(adSet => ({
    ...adSet,
    insights: insightsMap.get(adSet.id) || null
  }));
}

/**
 * 광고 + 인사이트 통합 조회 (크리에이티브 썸네일 포함)
 */
async function getAdsWithInsights(options = {}) {
  const { status = 'ACTIVE', adSetIds = [], campaignIds = [], dateFrom, dateTo, includeCreatives = true } = options;
  
  const ads = await getAds({ status, adSetIds, campaignIds });
  
  if (ads.length === 0) {
    return [];
  }

  const adIds = ads.map(a => a.id);
  const insights = await getAdInsights(adIds, dateFrom, dateTo);

  const insightsMap = new Map(insights.map(i => [i.ad_id, i]));
  
  // 크리에이티브 정보 추출 (이미 ads에 포함되어 있음)
  const adsWithData = ads.map(ad => {
    const creative = ad.creative || {};
    let thumbnailUrl = creative.thumbnail_url || creative.image_url;
    let isVideo = !!creative.video_id;
    let videoId = creative.video_id || null;
    
    // Advantage+ 크리에이티브 (asset_feed_spec) 처리
    if (creative.asset_feed_spec?.videos?.length > 0) {
      const firstVideo = creative.asset_feed_spec.videos[0];
      isVideo = true;
      videoId = firstVideo.video_id;
      if (firstVideo.thumbnail_url && !thumbnailUrl) {
        thumbnailUrl = firstVideo.thumbnail_url;
      }
    }
    
    // object_story_spec에서 이미지/동영상 URL 추출
    if (!thumbnailUrl && creative.object_story_spec) {
      const spec = creative.object_story_spec;
      if (spec.video_data) {
        thumbnailUrl = spec.video_data.image_url || spec.video_data.video_id;
        if (!isVideo) {
          isVideo = true;
          videoId = spec.video_data.video_id || videoId;
        }
      } else if (spec.link_data) {
        thumbnailUrl = spec.link_data.image_hash ? null : spec.link_data.picture;
        if (spec.link_data.video_id && !isVideo) {
          isVideo = true;
          videoId = spec.link_data.video_id;
        }
      } else if (spec.photo_data) {
        thumbnailUrl = spec.photo_data.url;
      }
    }
    
    return {
      ...ad,
      insights: insightsMap.get(ad.id) || null,
      thumbnailUrl,
      isVideo,
      videoId
    };
  });
  
  return adsWithData;
}

/**
 * 동영상 상세 정보 조회 (소스 URL, 고해상도 썸네일)
 */
async function getVideoDetails(videoId) {
  if (!videoId) return null;
  
  try {
    // source 필드는 동영상 소유자만 접근 가능할 수 있음
    // 먼저 기본 정보만 조회
    const videoData = await callMetaApi(videoId, {
      fields: 'id,source,picture,thumbnails{uri,height,width},title,description,length,permalink_url'
    }, false); // 캐시 사용 안함 (source URL은 임시 URL이므로)
    
    console.log(`[Meta API] Video ${videoId} data:`, JSON.stringify(videoData, null, 2));
    
    // 가장 큰 썸네일 선택
    let bestThumbnail = videoData.picture;
    if (videoData.thumbnails?.data?.length > 0) {
      const sorted = videoData.thumbnails.data.sort((a, b) => (b.height || 0) - (a.height || 0));
      bestThumbnail = sorted[0].uri || bestThumbnail;
    }
    
    return {
      videoId: videoData.id,
      source: videoData.source || null, // 동영상 재생 URL (없을 수 있음)
      thumbnail: bestThumbnail,
      title: videoData.title,
      description: videoData.description,
      length: videoData.length,
      permalinkUrl: videoData.permalink_url
    };
  } catch (e) {
    console.log(`[Meta API] Failed to get video details for ${videoId}:`, e.message);
    return null;
  }
}

/**
 * 단일 광고의 미디어 상세 정보 조회 (미리보기용)
 */
async function getAdMediaDetails(adId) {
  if (!adId) return null;
  
  try {
    // 광고 크리에이티브 정보 조회 - 더 많은 필드 요청
    const adData = await callMetaApi(adId, {
      fields: 'id,name,creative{id,name,thumbnail_url,image_url,image_hash,video_id,object_story_spec,effective_object_story_id,asset_feed_spec}'
    }, false);
    
    console.log(`[Meta API] Ad ${adId} creative data:`, JSON.stringify(adData, null, 2));
    
    if (!adData.creative) {
      return { adId, error: 'No creative found' };
    }
    
    const creative = adData.creative;
    const result = {
      adId,
      adName: adData.name,
      creativeId: creative.id,
      creativeName: creative.name,
      thumbnailUrl: creative.thumbnail_url,
      imageUrl: creative.image_url,
      isVideo: !!creative.video_id,
      videoId: creative.video_id,
      videoSource: null,
      videoThumbnail: null,
      adText: null
    };
    
    // object_story_spec에서 광고 텍스트 및 미디어 URL 추출
    // object_story_spec.video_data.video_id가 Facebook 영상이라 접근 가능한 경우가 많음
    if (creative.object_story_spec) {
      const spec = creative.object_story_spec;
      console.log(`[Meta API] object_story_spec:`, JSON.stringify(spec, null, 2));
      
      if (spec.video_data) {
        result.adText = spec.video_data.message || spec.video_data.title;
        result.isVideo = true;
        // object_story_spec의 video_id를 우선 사용 (Facebook 영상이라 접근 가능)
        if (spec.video_data.video_id) {
          result.videoId = spec.video_data.video_id;
        }
        if (!result.thumbnailUrl && spec.video_data.image_url) {
          result.thumbnailUrl = spec.video_data.image_url;
        }
      } else if (spec.link_data) {
        result.adText = spec.link_data.message || spec.link_data.name;
        if (!result.imageUrl && spec.link_data.picture) {
          result.imageUrl = spec.link_data.picture;
        }
        // link_data에 video_id가 있을 수 있음
        if (spec.link_data.video_id) {
          result.isVideo = true;
          result.videoId = spec.link_data.video_id;
        }
      } else if (spec.photo_data) {
        result.adText = spec.photo_data.caption;
        if (!result.imageUrl && spec.photo_data.url) {
          result.imageUrl = spec.photo_data.url;
        }
      }
    }
    
    // Advantage+ 크리에이티브 (asset_feed_spec) 처리
    // object_story_spec에서 video_id를 못 찾은 경우에만 asset_feed_spec 사용
    if (!result.videoId && creative.asset_feed_spec?.videos?.length > 0) {
      const firstVideo = creative.asset_feed_spec.videos[0];
      result.isVideo = true;
      result.videoId = firstVideo.video_id;
      if (firstVideo.thumbnail_url) {
        result.thumbnailUrl = firstVideo.thumbnail_url;
      }
      console.log(`[Meta API] Advantage+ creative detected, using video_id: ${result.videoId}`);
    }
    
    // 광고 텍스트가 없으면 asset_feed_spec에서 추출
    if (!result.adText && creative.asset_feed_spec?.bodies?.length > 0) {
      result.adText = creative.asset_feed_spec.bodies[0].text;
    }
    
    // 동영상인 경우 동영상 소스 URL 가져오기
    if (result.videoId) {
      const videoDetails = await getVideoDetails(result.videoId);
      if (videoDetails) {
        result.videoSource = videoDetails.source;
        result.videoThumbnail = videoDetails.thumbnail;
        result.videoLength = videoDetails.length;
        result.videoPermalink = videoDetails.permalinkUrl;
      }
    }
    
    console.log(`[Meta API] Final result for ad ${adId}:`, JSON.stringify(result, null, 2));
    
    return result;
  } catch (e) {
    console.log(`[Meta API] Failed to get ad media details for ${adId}:`, e.message);
    return { adId, error: e.message };
  }
}

/**
 * 캐시 초기화
 */
function clearCache() {
  cache.clear();
}

/**
 * 광고 미리보기 iframe URL 조회
 */
async function getAdPreview(adId, adFormat = 'MOBILE_FEED_STANDARD') {
  if (!adId) return null;
  
  try {
    const result = await callMetaApi(`${adId}/previews`, {
      ad_format: adFormat
    }, false);
    
    if (result.data && result.data.length > 0) {
      // iframe body에서 src URL 추출
      const body = result.data[0].body;
      const srcMatch = body.match(/src="([^"]+)"/);
      const iframeSrc = srcMatch ? srcMatch[1].replace(/&amp;/g, '&') : null;
      
      return {
        adId,
        adFormat,
        iframeHtml: body,
        iframeSrc
      };
    }
    
    return null;
  } catch (e) {
    console.log(`[Meta API] Failed to get ad preview for ${adId}:`, e.message);
    return null;
  }
}

module.exports = {
  getCampaigns,
  getAdSets,
  getAds,
  getInsights,
  getCampaignInsights,
  getAdSetInsights,
  getAdInsights,
  getCampaignsWithInsights,
  getAdSetsWithInsights,
  getAdsWithInsights,
  getAdMediaDetails,
  getVideoDetails,
  getAdPreview,
  clearCache
};
