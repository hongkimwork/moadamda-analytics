/**
 * Meta 광고 데이터 동기화 스크립트
 * 
 * 사용법:
 *   node src/scripts/syncMetaAds.js           # 최근 7일 동기화
 *   node src/scripts/syncMetaAds.js 30        # 최근 30일 동기화
 *   node src/scripts/syncMetaAds.js info      # 캠페인/광고세트/광고 정보만 동기화
 *   node src/scripts/syncMetaAds.js stats     # 성과 데이터만 동기화
 */

require('dotenv').config({ path: '.env.local' });

const { Pool } = require('pg');
const metaAd = require('../utils/metaAd');

// DB 연결
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME || 'analytics',
  user: process.env.DB_USER || 'moadamda',
  password: process.env.DB_PASSWORD
});

const accountId = metaAd.META_AD_ACCOUNT_ID;

/**
 * 날짜 포맷 (YYYY-MM-DD)
 */
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

/**
 * 캠페인 정보 동기화
 */
async function syncCampaigns() {
  console.log('\n📊 캠페인 정보 동기화 중...');
  
  const campaigns = await metaAd.getCampaigns();
  console.log(`   ${campaigns.length}개 캠페인 발견`);
  
  let inserted = 0, updated = 0;
  
  for (const campaign of campaigns) {
    const query = `
      INSERT INTO meta_campaigns (
        campaign_id, account_id, name, objective, status,
        daily_budget, lifetime_budget, created_time, updated_time
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (campaign_id) DO UPDATE SET
        name = EXCLUDED.name,
        objective = EXCLUDED.objective,
        status = EXCLUDED.status,
        daily_budget = EXCLUDED.daily_budget,
        lifetime_budget = EXCLUDED.lifetime_budget,
        updated_time = EXCLUDED.updated_time
      RETURNING (xmax = 0) AS inserted
    `;
    
    const result = await pool.query(query, [
      campaign.id,
      accountId,
      campaign.name,
      campaign.objective,
      campaign.status,
      campaign.daily_budget ? Math.round(parseFloat(campaign.daily_budget) / 100) : null, // Meta는 센트 단위
      campaign.lifetime_budget ? Math.round(parseFloat(campaign.lifetime_budget) / 100) : null,
      campaign.created_time,
      campaign.updated_time
    ]);
    
    if (result.rows[0]?.inserted) inserted++;
    else updated++;
  }
  
  console.log(`   ✅ 캠페인: ${inserted}개 추가, ${updated}개 업데이트`);
  return campaigns.length;
}

/**
 * 광고세트 정보 동기화
 */
async function syncAdsets() {
  console.log('\n📊 광고세트 정보 동기화 중...');
  
  const adsets = await metaAd.getAdsets();
  console.log(`   ${adsets.length}개 광고세트 발견`);
  
  let inserted = 0, updated = 0;
  
  for (const adset of adsets) {
    const query = `
      INSERT INTO meta_adsets (
        adset_id, campaign_id, account_id, name, status,
        optimization_goal, billing_event, daily_budget, lifetime_budget,
        targeting, created_time, updated_time
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (adset_id) DO UPDATE SET
        name = EXCLUDED.name,
        status = EXCLUDED.status,
        optimization_goal = EXCLUDED.optimization_goal,
        billing_event = EXCLUDED.billing_event,
        daily_budget = EXCLUDED.daily_budget,
        lifetime_budget = EXCLUDED.lifetime_budget,
        targeting = EXCLUDED.targeting,
        updated_time = EXCLUDED.updated_time
      RETURNING (xmax = 0) AS inserted
    `;
    
    const result = await pool.query(query, [
      adset.id,
      adset.campaign_id,
      accountId,
      adset.name,
      adset.status,
      adset.optimization_goal,
      adset.billing_event,
      adset.daily_budget ? Math.round(parseFloat(adset.daily_budget) / 100) : null,
      adset.lifetime_budget ? Math.round(parseFloat(adset.lifetime_budget) / 100) : null,
      adset.targeting ? JSON.stringify(adset.targeting) : null,
      adset.created_time,
      adset.updated_time
    ]);
    
    if (result.rows[0]?.inserted) inserted++;
    else updated++;
  }
  
  console.log(`   ✅ 광고세트: ${inserted}개 추가, ${updated}개 업데이트`);
  return adsets.length;
}

/**
 * 광고 정보 동기화
 */
async function syncAds() {
  console.log('\n📊 광고 정보 동기화 중...');
  
  const ads = await metaAd.getAds();
  console.log(`   ${ads.length}개 광고 발견`);
  
  let inserted = 0, updated = 0;
  
  for (const ad of ads) {
    const query = `
      INSERT INTO meta_ads (
        ad_id, adset_id, campaign_id, account_id, name, status,
        creative_id, created_time, updated_time
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (ad_id) DO UPDATE SET
        name = EXCLUDED.name,
        status = EXCLUDED.status,
        creative_id = EXCLUDED.creative_id,
        updated_time = EXCLUDED.updated_time
      RETURNING (xmax = 0) AS inserted
    `;
    
    const result = await pool.query(query, [
      ad.id,
      ad.adset_id,
      ad.campaign_id,
      accountId,
      ad.name,
      ad.status,
      ad.creative?.id || null,
      ad.created_time,
      ad.updated_time
    ]);
    
    if (result.rows[0]?.inserted) inserted++;
    else updated++;
  }
  
  console.log(`   ✅ 광고: ${inserted}개 추가, ${updated}개 업데이트`);
  return ads.length;
}

/**
 * 일별 성과 데이터 동기화
 */
async function syncStats(days = 7) {
  console.log(`\n📊 최근 ${days}일 성과 데이터 동기화 중...`);
  
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const startStr = formatDate(startDate);
  const endStr = formatDate(endDate);
  
  console.log(`   기간: ${startStr} ~ ${endStr}`);
  
  // 광고 레벨로 인사이트 조회
  const insights = await metaAd.getInsights(startStr, endStr, 'ad');
  console.log(`   ${insights.length}개 인사이트 레코드 발견`);
  
  let inserted = 0, updated = 0;
  
  for (const insight of insights) {
    // 날짜 추출 (date_start 사용)
    const statDate = insight.date_start;
    if (!statDate) continue;
    
    // 지표 추출
    const purchases = metaAd.extractAction(insight.actions, 'purchase');
    const purchaseValue = metaAd.extractActionValue(insight.action_values, 'purchase');
    const addToCart = metaAd.extractAction(insight.actions, 'add_to_cart');
    const initiateCheckout = metaAd.extractAction(insight.actions, 'initiate_checkout');
    const leads = metaAd.extractAction(insight.actions, 'lead');
    
    const outboundClicks = metaAd.extractOutboundClicks(insight.outbound_clicks);
    
    const videoPlays = metaAd.extractVideoAction(insight.video_play_actions);
    const videoP25 = metaAd.extractVideoAction(insight.video_p25_watched_actions);
    const videoP50 = metaAd.extractVideoAction(insight.video_p50_watched_actions);
    const videoP75 = metaAd.extractVideoAction(insight.video_p75_watched_actions);
    const videoP100 = metaAd.extractVideoAction(insight.video_p100_watched_actions);
    
    // video_avg_time_watched_actions에서 평균 시청 시간 추출
    let videoAvgTime = null;
    if (insight.video_avg_time_watched_actions && insight.video_avg_time_watched_actions.length > 0) {
      videoAvgTime = parseFloat(insight.video_avg_time_watched_actions[0].value) || null;
    }
    
    // purchase_roas 추출
    let purchaseRoas = null;
    if (insight.purchase_roas && insight.purchase_roas.length > 0) {
      purchaseRoas = parseFloat(insight.purchase_roas[0].value) || null;
    }
    
    const query = `
      INSERT INTO meta_ad_stats (
        stat_date, account_id, campaign_id, adset_id, ad_id,
        impressions, reach, clicks, outbound_clicks, spend,
        purchases, purchase_value, add_to_cart, initiate_checkout, leads,
        purchase_roas,
        video_plays, video_p25_watched, video_p50_watched, video_p75_watched, video_p100_watched,
        video_avg_time_watched, actions_json
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23
      )
      ON CONFLICT (stat_date, account_id, campaign_id, adset_id, ad_id) DO UPDATE SET
        impressions = EXCLUDED.impressions,
        reach = EXCLUDED.reach,
        clicks = EXCLUDED.clicks,
        outbound_clicks = EXCLUDED.outbound_clicks,
        spend = EXCLUDED.spend,
        purchases = EXCLUDED.purchases,
        purchase_value = EXCLUDED.purchase_value,
        add_to_cart = EXCLUDED.add_to_cart,
        initiate_checkout = EXCLUDED.initiate_checkout,
        leads = EXCLUDED.leads,
        purchase_roas = EXCLUDED.purchase_roas,
        video_plays = EXCLUDED.video_plays,
        video_p25_watched = EXCLUDED.video_p25_watched,
        video_p50_watched = EXCLUDED.video_p50_watched,
        video_p75_watched = EXCLUDED.video_p75_watched,
        video_p100_watched = EXCLUDED.video_p100_watched,
        video_avg_time_watched = EXCLUDED.video_avg_time_watched,
        actions_json = EXCLUDED.actions_json
      RETURNING (xmax = 0) AS inserted
    `;
    
    try {
      const result = await pool.query(query, [
        statDate,
        accountId,
        insight.campaign_id,
        insight.adset_id || null,
        insight.ad_id || null,
        parseInt(insight.impressions) || 0,
        parseInt(insight.reach) || 0,
        parseInt(insight.clicks) || 0,
        outboundClicks,
        parseFloat(insight.spend) || 0,
        purchases,
        purchaseValue,
        addToCart,
        initiateCheckout,
        leads,
        purchaseRoas,
        videoPlays,
        videoP25,
        videoP50,
        videoP75,
        videoP100,
        videoAvgTime,
        insight.actions ? JSON.stringify(insight.actions) : null
      ]);
      
      if (result.rows[0]?.inserted) inserted++;
      else updated++;
    } catch (err) {
      console.log(`   ⚠️ 오류: ${err.message}`);
    }
  }
  
  console.log(`   ✅ 성과 데이터: ${inserted}개 추가, ${updated}개 업데이트`);
  return insights.length;
}

/**
 * 메인 실행
 */
async function main() {
  const arg = process.argv[2];
  
  console.log('='.repeat(50));
  console.log('🚀 Meta 광고 데이터 동기화 시작');
  console.log('='.repeat(50));
  console.log(`\n📌 광고 계정: ${accountId}`);
  
  try {
    // 계정 정보 확인
    const accountInfo = await metaAd.getAccountInfo();
    console.log(`📌 계정명: ${accountInfo.name}`);
    
    if (arg === 'info') {
      // 정보만 동기화
      await syncCampaigns();
      await syncAdsets();
      await syncAds();
    } else if (arg === 'stats') {
      // 성과만 동기화 (기본 7일)
      await syncStats(7);
    } else {
      // 전체 동기화
      const days = parseInt(arg) || 7;
      
      await syncCampaigns();
      await syncAdsets();
      await syncAds();
      await syncStats(days);
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('🎉 동기화 완료!');
    console.log('='.repeat(50));
    
  } catch (error) {
    console.log('\n❌ 오류 발생:', error.message);
    
    if (error.message.includes('token')) {
      console.log('\n💡 토큰이 만료되었을 수 있습니다.');
      console.log('   node src/scripts/exchangeMetaToken.js 를 실행하세요.');
    }
  } finally {
    await pool.end();
  }
}

main();

