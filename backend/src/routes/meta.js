/**
 * Meta Ads API Routes
 * 메타 광고 성과 조회 API 엔드포인트
 */

const express = require('express');
const router = express.Router();
const metaService = require('../services/meta');

/**
 * GET /api/meta/campaigns
 * 캠페인 목록 + 인사이트 조회
 */
router.get('/meta/campaigns', async (req, res) => {
  try {
    const { status = 'ACTIVE', dateFrom, dateTo } = req.query;
    
    const campaigns = await metaService.getCampaignsWithInsights({
      status,
      dateFrom,
      dateTo
    });

    res.json({
      success: true,
      data: campaigns,
      count: campaigns.length
    });
  } catch (error) {
    console.error('[Meta API] getCampaigns error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch campaigns'
    });
  }
});

/**
 * GET /api/meta/adsets
 * 광고 세트 목록 + 인사이트 조회
 */
router.get('/meta/adsets', async (req, res) => {
  try {
    const { status = 'ACTIVE', campaignIds, dateFrom, dateTo } = req.query;
    
    const parsedCampaignIds = campaignIds ? campaignIds.split(',') : [];
    
    const adSets = await metaService.getAdSetsWithInsights({
      status,
      campaignIds: parsedCampaignIds,
      dateFrom,
      dateTo
    });

    res.json({
      success: true,
      data: adSets,
      count: adSets.length
    });
  } catch (error) {
    console.error('[Meta API] getAdSets error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch ad sets'
    });
  }
});

/**
 * GET /api/meta/ads
 * 광고 목록 + 인사이트 조회
 */
router.get('/meta/ads', async (req, res) => {
  try {
    const { status = 'ACTIVE', adSetIds, campaignIds, dateFrom, dateTo } = req.query;
    
    const parsedAdSetIds = adSetIds ? adSetIds.split(',') : [];
    const parsedCampaignIds = campaignIds ? campaignIds.split(',') : [];
    
    const ads = await metaService.getAdsWithInsights({
      status,
      adSetIds: parsedAdSetIds,
      campaignIds: parsedCampaignIds,
      dateFrom,
      dateTo
    });

    res.json({
      success: true,
      data: ads,
      count: ads.length
    });
  } catch (error) {
    console.error('[Meta API] getAds error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch ads'
    });
  }
});

/**
 * POST /api/meta/refresh
 * 캐시 초기화 (강제 새로고침)
 */
router.post('/meta/refresh', async (req, res) => {
  try {
    metaService.clearCache();
    res.json({
      success: true,
      message: 'Cache cleared successfully'
    });
  } catch (error) {
    console.error('[Meta API] refresh error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to clear cache'
    });
  }
});

/**
 * GET /api/meta/summary
 * 전체 요약 (캠페인/광고세트/광고 개수)
 */
router.get('/meta/summary', async (req, res) => {
  try {
    const { status = 'ACTIVE' } = req.query;
    
    const [campaigns, adSets, ads] = await Promise.all([
      metaService.getCampaigns({ status, limit: 500 }),
      metaService.getAdSets({ status, limit: 1000 }),
      metaService.getAds({ status, limit: 3000 })
    ]);

    res.json({
      success: true,
      data: {
        campaigns: campaigns.length,
        adSets: adSets.length,
        ads: ads.length
      }
    });
  } catch (error) {
    console.error('[Meta API] summary error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch summary'
    });
  }
});

/**
 * GET /api/meta/ad/:adId/media
 * 단일 광고의 미디어 상세 정보 조회 (미리보기용)
 */
router.get('/meta/ad/:adId/media', async (req, res) => {
  try {
    const { adId } = req.params;
    
    if (!adId) {
      return res.status(400).json({
        success: false,
        error: 'Ad ID is required'
      });
    }
    
    const mediaDetails = await metaService.getAdMediaDetails(adId);
    
    if (!mediaDetails) {
      return res.status(404).json({
        success: false,
        error: 'Ad not found'
      });
    }
    
    if (mediaDetails.error) {
      return res.status(500).json({
        success: false,
        error: mediaDetails.error
      });
    }

    res.json({
      success: true,
      data: mediaDetails
    });
  } catch (error) {
    console.error('[Meta API] getAdMedia error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch ad media'
    });
  }
});

/**
 * GET /api/meta/ad-by-name
 * 광고 이름으로 광고 ID 및 미디어 정보 조회
 * - creative_name을 Meta 광고명으로 매핑 후 미디어 정보 반환
 * FIX (2026-02-02): DB에 없는 경우 Meta API에서 직접 검색
 */
router.get('/meta/ad-by-name', async (req, res) => {
  try {
    const { name } = req.query;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Ad name is required'
      });
    }
    
    // 매핑 서비스 사용
    const { mapToMetaAdName, getAdIdByName } = require('../services/creative/metaAdNameMapping');
    
    // 1. creative_name을 Meta 광고명으로 매핑
    const metaAdName = await mapToMetaAdName(name);
    
    if (!metaAdName) {
      return res.json({
        success: false,
        matched: false,
        error: 'No matching Meta ad found',
        originalName: name
      });
    }
    
    // 2. DB에서 직접 광고 ID 검색 (캐시 역할)
    const db = require('../utils/database');
    const dbResult = await db.query(
      'SELECT ad_id, name FROM meta_ads WHERE name = $1 LIMIT 1',
      [metaAdName]
    );
    
    let adId = null;
    let adName = metaAdName;
    
    if (dbResult.rows.length > 0) {
      // DB에서 찾은 경우
      adId = dbResult.rows[0].ad_id;
      adName = dbResult.rows[0].name;
    } else {
      // 3. DB에 없으면 캐시에서 먼저 조회
      const cachedAdId = await getAdIdByName(metaAdName);
      
      if (cachedAdId) {
        adId = cachedAdId;
        adName = metaAdName;
        console.log(`[Meta API] Found ad in cache: ${adId}`);
        
        // DB에 캐시로 저장 (다음 조회 시 빠르게)
        try {
          await db.query(
            `INSERT INTO meta_ads (ad_id, account_id, name, status, created_time, updated_time)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (ad_id) DO UPDATE SET name = EXCLUDED.name, updated_time = EXCLUDED.updated_time`,
            [
              adId,
              process.env.META_AD_ACCOUNT_ID,
              metaAdName,
              'ACTIVE',
              new Date().toISOString(),
              new Date().toISOString()
            ]
          );
          console.log(`[Meta API] Cached ad to DB: ${adId}`);
        } catch (cacheError) {
          console.log(`[Meta API] Failed to cache ad: ${cacheError.message}`);
        }
      } else {
        console.log(`[Meta API] Ad not found in cache: ${metaAdName}`);
      }
    }
    
    if (!adId) {
      return res.json({
        success: false,
        matched: true,
        metaAdName,
        error: 'Ad name mapped but ad not found in Meta',
        originalName: name
      });
    }
    
    // 4. 미디어 정보 조회
    let mediaDetails = null;
    try {
      mediaDetails = await metaService.getAdMediaDetails(adId);
    } catch (mediaError) {
      console.log(`[Meta API] getAdMediaDetails failed for ${adId}:`, mediaError.message);
    }
    
    res.json({
      success: true,
      matched: true,
      data: {
        adId: adId,
        name: adName,
        originalName: name,
        thumbnailUrl: mediaDetails?.videoThumbnail || mediaDetails?.imageUrl || null,
        isVideo: mediaDetails?.isVideo || false,
        media: mediaDetails || null
      }
    });
  } catch (error) {
    console.error('[Meta API] getAdByName error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to find ad by name'
    });
  }
});

/**
 * GET /api/meta/ad/:adId/preview
 * 광고 미리보기 iframe URL 조회
 */
router.get('/meta/ad/:adId/preview', async (req, res) => {
  try {
    const { adId } = req.params;
    const { format = 'MOBILE_FEED_STANDARD' } = req.query;
    
    if (!adId) {
      return res.status(400).json({
        success: false,
        error: 'Ad ID is required'
      });
    }
    
    const preview = await metaService.getAdPreview(adId, format);
    
    if (!preview) {
      return res.status(404).json({
        success: false,
        error: 'Preview not available'
      });
    }

    res.json({
      success: true,
      data: preview
    });
  } catch (error) {
    console.error('[Meta API] getAdPreview error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch ad preview'
    });
  }
});

module.exports = router;
