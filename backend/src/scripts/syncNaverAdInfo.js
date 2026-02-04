/**
 * 네이버 검색광고 정보 동기화 스크립트
 * 캠페인, 광고그룹, 키워드 목록을 가져와서 DB에 저장
 * 
 * 실행: node src/scripts/syncNaverAdInfo.js
 */

// FIX (2026-02-04): 서버에서는 .env 사용, 로컬에서는 .env.local 사용
const envFile = process.env.NODE_ENV === 'production' ? '.env' : '.env.local';
require('dotenv').config({ path: require('path').join(__dirname, '../../' + envFile) });

const db = require('../utils/database');
const naverAd = require('../utils/naverAd');

async function syncCampaigns() {
  console.log('\n📦 캠페인 동기화 시작...');
  
  const campaigns = await naverAd.getCampaigns();
  console.log(`  - ${campaigns.length}개 캠페인 발견`);
  
  let inserted = 0;
  let updated = 0;
  
  for (const camp of campaigns) {
    const query = `
      INSERT INTO naver_campaigns (campaign_id, customer_id, name, campaign_type, status, daily_budget, use_daily_budget)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (campaign_id) 
      DO UPDATE SET 
        name = EXCLUDED.name,
        campaign_type = EXCLUDED.campaign_type,
        status = EXCLUDED.status,
        daily_budget = EXCLUDED.daily_budget,
        use_daily_budget = EXCLUDED.use_daily_budget,
        updated_at = CURRENT_TIMESTAMP
      RETURNING (xmax = 0) AS is_insert
    `;
    
    const result = await db.query(query, [
      camp.nccCampaignId,
      camp.customerId,
      camp.name,
      camp.campaignTp,
      camp.status,
      camp.dailyBudget || 0,
      camp.useDailyBudget !== false
    ]);
    
    if (result.rows[0].is_insert) {
      inserted++;
    } else {
      updated++;
    }
  }
  
  console.log(`  ✅ 캠페인 동기화 완료: ${inserted}개 추가, ${updated}개 업데이트`);
  return campaigns;
}

async function syncAdGroups() {
  console.log('\n📦 광고그룹 동기화 시작...');
  
  let totalInserted = 0;
  let totalUpdated = 0;
  
  // 전체 광고그룹 한번에 조회 (캠페인ID 없이)
  const allAdGroups = await naverAd.getAdGroups();
  console.log(`  - ${allAdGroups.length}개 광고그룹 발견`);
  
  for (const ag of allAdGroups) {
    const query = `
      INSERT INTO naver_adgroups (adgroup_id, campaign_id, customer_id, name, status, bid_amount, use_enhanced_cpc)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (adgroup_id) 
      DO UPDATE SET 
        campaign_id = EXCLUDED.campaign_id,
        name = EXCLUDED.name,
        status = EXCLUDED.status,
        bid_amount = EXCLUDED.bid_amount,
        use_enhanced_cpc = EXCLUDED.use_enhanced_cpc,
        updated_at = CURRENT_TIMESTAMP
      RETURNING (xmax = 0) AS is_insert
    `;
    
    const result = await db.query(query, [
      ag.nccAdgroupId,
      ag.nccCampaignId,
      ag.customerId,
      ag.name,
      ag.status,
      ag.bidAmt || 0,
      ag.useEnhancedCpc === true
    ]);
    
    if (result.rows[0].is_insert) {
      totalInserted++;
    } else {
      totalUpdated++;
    }
  }
  
  console.log(`  ✅ 광고그룹 동기화 완료: ${totalInserted}개 추가, ${totalUpdated}개 업데이트`);
  return allAdGroups;
}

async function syncKeywords(adgroups) {
  console.log('\n📦 키워드 동기화 시작...');
  
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalKeywords = 0;
  
  for (const ag of adgroups) {
    try {
      const keywords = await naverAd.getKeywords(ag.nccAdgroupId);
      totalKeywords += keywords.length;
      
      for (const kw of keywords) {
        const query = `
          INSERT INTO naver_keywords (keyword_id, adgroup_id, campaign_id, customer_id, keyword, status, bid_amount, use_group_bid)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (keyword_id) 
          DO UPDATE SET 
            adgroup_id = EXCLUDED.adgroup_id,
            campaign_id = EXCLUDED.campaign_id,
            keyword = EXCLUDED.keyword,
            status = EXCLUDED.status,
            bid_amount = EXCLUDED.bid_amount,
            use_group_bid = EXCLUDED.use_group_bid,
            updated_at = CURRENT_TIMESTAMP
          RETURNING (xmax = 0) AS is_insert
        `;
        
        const result = await db.query(query, [
          kw.nccKeywordId,
          kw.nccAdgroupId,
          kw.nccCampaignId,
          kw.customerId,
          kw.keyword,
          kw.status,
          kw.bidAmt || 0,
          kw.useGroupBidAmt !== false
        ]);
        
        if (result.rows[0].is_insert) {
          totalInserted++;
        } else {
          totalUpdated++;
        }
      }
    } catch (err) {
      console.log(`  ⚠️ 광고그룹 ${ag.nccAdgroupId} 키워드 조회 실패: ${err.message}`);
    }
    
    // API 호출 제한 방지
    await new Promise(r => setTimeout(r, 100));
  }
  
  console.log(`  ✅ 키워드 동기화 완료: ${totalInserted}개 추가, ${totalUpdated}개 업데이트 (총 ${totalKeywords}개)`);
}

async function main() {
  console.log('========================================');
  console.log('🚀 네이버 검색광고 정보 동기화');
  console.log('========================================');
  
  try {
    // 설정 확인
    const config = naverAd.checkConfig();
    console.log('\n📋 설정 확인:');
    console.log(`  - API Key: ${config.apiKey}`);
    console.log(`  - Secret Key: ${config.secretKey}`);
    console.log(`  - Customer ID: ${config.customerId}`);
    
    // 1. 캠페인 동기화
    await syncCampaigns();
    
    // 2. 광고그룹 동기화
    const adgroups = await syncAdGroups();
    
    // 3. 키워드 동기화
    await syncKeywords(adgroups);
    
    console.log('\n========================================');
    console.log('✅ 동기화 완료!');
    console.log('========================================');
    
  } catch (err) {
    console.error('\n❌ 오류 발생:', err.message);
    process.exit(1);
  } finally {
    await db.pool.end();
  }
}

main();

