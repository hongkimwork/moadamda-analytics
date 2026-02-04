/**
 * 네이버 검색광고 성과 데이터 동기화 스크립트
 * 캠페인/광고그룹별 일별 성과 데이터를 가져와서 DB에 저장
 * 
 * 실행: node src/scripts/syncNaverAdStats.js [days]
 * 예: node src/scripts/syncNaverAdStats.js 7  (최근 7일)
 */

// FIX (2026-02-04): 서버에서는 .env 사용, 로컬에서는 .env.local 사용
const envFile = process.env.NODE_ENV === 'production' ? '.env' : '.env.local';
require('dotenv').config({ path: require('path').join(__dirname, '../../' + envFile) });

const db = require('../utils/database');
const naverAd = require('../utils/naverAd');

/**
 * 날짜 포맷 (YYYY-MM-DD)
 */
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

/**
 * 특정 날짜의 캠페인 성과 데이터 수집
 */
async function syncCampaignStatsForDate(date, campaignIds) {
  const dateStr = formatDate(date);
  let inserted = 0;
  let updated = 0;
  
  // 10개씩 배치로 조회
  const batchSize = 10;
  for (let i = 0; i < campaignIds.length; i += batchSize) {
    const batch = campaignIds.slice(i, i + batchSize);
    
    try {
      // 해당 날짜 하루만 조회 (since=until)
      const stats = await naverAd.getStats(batch, dateStr, dateStr);
      
      if (!stats.data || stats.data.length === 0) continue;
      
      for (const item of stats.data) {
        const query = `
          INSERT INTO naver_ad_stats (
            stat_date, customer_id, campaign_id, adgroup_id, keyword_id, ad_id, device_type,
            impressions, clicks, cost, conversions_direct, conversion_sales_direct
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (stat_date, customer_id, campaign_id, adgroup_id, keyword_id, ad_id, device_type)
          DO UPDATE SET
            impressions = EXCLUDED.impressions,
            clicks = EXCLUDED.clicks,
            cost = EXCLUDED.cost,
            conversions_direct = EXCLUDED.conversions_direct,
            conversion_sales_direct = EXCLUDED.conversion_sales_direct,
            updated_at = CURRENT_TIMESTAMP
          RETURNING (xmax = 0) AS is_insert
        `;
        
        try {
          const result = await db.query(query, [
            dateStr,
            naverAd.CUSTOMER_ID,
            item.id,            // campaign_id
            '',                 // adgroup_id
            '',                 // keyword_id
            '',                 // ad_id
            'ALL',              // device_type (합산)
            item.impCnt || 0,
            item.clkCnt || 0,
            item.salesAmt || 0,
            item.ccnt || 0,
            0                   // conversion_sales (API에서 제공 안함)
          ]);
          
          if (result.rows[0]?.is_insert) {
            inserted++;
          } else {
            updated++;
          }
        } catch (err) {
          // 무시
        }
      }
    } catch (err) {
      // 무시
    }
    
    // API 호출 제한 방지
    await new Promise(r => setTimeout(r, 100));
  }
  
  return { inserted, updated };
}

/**
 * 특정 날짜의 광고그룹 성과 데이터 수집
 */
async function syncAdGroupStatsForDate(date, adgroups, adgroupMap) {
  const dateStr = formatDate(date);
  let inserted = 0;
  let updated = 0;
  
  const adgroupIds = adgroups.map(r => r.adgroup_id);
  
  // 10개씩 배치로 조회
  const batchSize = 10;
  for (let i = 0; i < adgroupIds.length; i += batchSize) {
    const batch = adgroupIds.slice(i, i + batchSize);
    
    try {
      const stats = await naverAd.getStats(batch, dateStr, dateStr);
      
      if (!stats.data || stats.data.length === 0) continue;
      
      for (const item of stats.data) {
        const campaignId = adgroupMap[item.id] || '';
        
        const query = `
          INSERT INTO naver_ad_stats (
            stat_date, customer_id, campaign_id, adgroup_id, keyword_id, ad_id, device_type,
            impressions, clicks, cost, conversions_direct, conversion_sales_direct
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (stat_date, customer_id, campaign_id, adgroup_id, keyword_id, ad_id, device_type)
          DO UPDATE SET
            impressions = EXCLUDED.impressions,
            clicks = EXCLUDED.clicks,
            cost = EXCLUDED.cost,
            conversions_direct = EXCLUDED.conversions_direct,
            conversion_sales_direct = EXCLUDED.conversion_sales_direct,
            updated_at = CURRENT_TIMESTAMP
          RETURNING (xmax = 0) AS is_insert
        `;
        
        try {
          const result = await db.query(query, [
            dateStr,
            naverAd.CUSTOMER_ID,
            campaignId,
            item.id,            // adgroup_id
            '',                 // keyword_id
            '',                 // ad_id
            'ALL',
            item.impCnt || 0,
            item.clkCnt || 0,
            item.salesAmt || 0,
            item.ccnt || 0,
            0
          ]);
          
          if (result.rows[0]?.is_insert) {
            inserted++;
          } else {
            updated++;
          }
        } catch (err) {
          // 무시
        }
      }
    } catch (err) {
      // 무시
    }
    
    await new Promise(r => setTimeout(r, 100));
  }
  
  return { inserted, updated };
}

async function main() {
  console.log('========================================');
  console.log('🚀 네이버 검색광고 성과 데이터 동기화');
  console.log('========================================');
  
  try {
    // 설정 확인
    const config = naverAd.checkConfig();
    console.log('\n📋 설정 확인:');
    console.log(`  - API Key: ${config.apiKey}`);
    console.log(`  - Secret Key: ${config.secretKey}`);
    console.log(`  - Customer ID: ${config.customerId}`);
    
    // 기간 설정 (기본 7일)
    const days = parseInt(process.argv[2]) || 7;
    console.log(`\n📅 조회 기간: 최근 ${days}일`);
    
    // DB에서 캠페인/광고그룹 목록 조회
    const campaignsResult = await db.query('SELECT campaign_id FROM naver_campaigns');
    const campaignIds = campaignsResult.rows.map(r => r.campaign_id);
    
    const adgroupsResult = await db.query('SELECT adgroup_id, campaign_id FROM naver_adgroups');
    const adgroups = adgroupsResult.rows;
    const adgroupMap = {};
    adgroups.forEach(ag => { adgroupMap[ag.adgroup_id] = ag.campaign_id; });
    
    console.log(`  - 캠페인 ${campaignIds.length}개, 광고그룹 ${adgroups.length}개`);
    
    let totalCampInserted = 0, totalCampUpdated = 0;
    let totalAgInserted = 0, totalAgUpdated = 0;
    
    // 날짜별로 데이터 수집
    for (let d = days - 1; d >= 0; d--) {
      const date = new Date();
      date.setDate(date.getDate() - d);
      const dateStr = formatDate(date);
      
      process.stdout.write(`\r  📊 ${dateStr} 처리 중...`);
      
      // 캠페인 성과
      const campResult = await syncCampaignStatsForDate(date, campaignIds);
      totalCampInserted += campResult.inserted;
      totalCampUpdated += campResult.updated;
      
      // 광고그룹 성과
      const agResult = await syncAdGroupStatsForDate(date, adgroups, adgroupMap);
      totalAgInserted += agResult.inserted;
      totalAgUpdated += agResult.updated;
    }
    
    console.log(`\r  ✅ 캠페인 성과: ${totalCampInserted}개 추가, ${totalCampUpdated}개 업데이트`);
    console.log(`  ✅ 광고그룹 성과: ${totalAgInserted}개 추가, ${totalAgUpdated}개 업데이트`);
    
    console.log('\n========================================');
    console.log('✅ 성과 데이터 동기화 완료!');
    console.log('========================================');
    
  } catch (err) {
    console.error('\n❌ 오류 발생:', err.message);
    process.exit(1);
  } finally {
    await db.pool.end();
  }
}

main();
