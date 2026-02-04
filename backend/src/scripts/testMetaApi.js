/**
 * Meta API 연동 테스트 스크립트
 * 광고 계정의 기본 정보와 최근 광고 성과를 가져옵니다.
 */

// FIX (2026-02-04): 서버에서는 .env 사용, 로컬에서는 .env.local 사용
require('dotenv').config({ path: process.env.NODE_ENV === 'production' ? '.env' : '.env.local' });

const https = require('https');

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID;

// API 버전
const API_VERSION = 'v20.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

/**
 * Meta Graph API 호출 함수
 */
function callMetaApi(endpoint, params = {}) {
  return new Promise((resolve, reject) => {
    // 기본 파라미터에 access_token 추가
    params.access_token = META_ACCESS_TOKEN;
    
    const queryString = new URLSearchParams(params).toString();
    const url = `${BASE_URL}/${endpoint}?${queryString}`;
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
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
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * 테스트 1: 광고 계정 정보 확인
 */
async function testAccountInfo() {
  console.log('\n📊 [테스트 1] 광고 계정 정보 확인...\n');
  
  try {
    const result = await callMetaApi(META_AD_ACCOUNT_ID, {
      fields: 'name,account_status,currency,timezone_name'
    });
    
    console.log('✅ 광고 계정 정보:');
    console.log(`   - 이름: ${result.name}`);
    console.log(`   - 상태: ${result.account_status === 1 ? '활성' : '비활성'}`);
    console.log(`   - 통화: ${result.currency}`);
    console.log(`   - 시간대: ${result.timezone_name}`);
    
    return true;
  } catch (error) {
    console.log('❌ 실패:', error.message || error);
    return false;
  }
}

/**
 * 테스트 2: 최근 캠페인 목록 가져오기
 */
async function testCampaigns() {
  console.log('\n📊 [테스트 2] 캠페인 목록 가져오기...\n');
  
  try {
    const result = await callMetaApi(`${META_AD_ACCOUNT_ID}/campaigns`, {
      fields: 'id,name,status,objective',
      limit: 5
    });
    
    if (result.data && result.data.length > 0) {
      console.log(`✅ 캠페인 ${result.data.length}개 발견:`);
      result.data.forEach((campaign, i) => {
        console.log(`   ${i + 1}. ${campaign.name} (${campaign.status})`);
      });
    } else {
      console.log('ℹ️ 캠페인이 없습니다.');
    }
    
    return true;
  } catch (error) {
    console.log('❌ 실패:', error.message || error);
    return false;
  }
}

/**
 * 테스트 3: 최근 7일 광고 성과 가져오기
 */
async function testInsights() {
  console.log('\n📊 [테스트 3] 최근 7일 광고 성과...\n');
  
  // 최근 7일 날짜 계산
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  const formatDate = (d) => d.toISOString().split('T')[0];
  
  try {
    const result = await callMetaApi(`${META_AD_ACCOUNT_ID}/insights`, {
      fields: 'impressions,clicks,spend,reach',
      time_range: JSON.stringify({
        since: formatDate(weekAgo),
        until: formatDate(today)
      }),
      level: 'account'
    });
    
    if (result.data && result.data.length > 0) {
      const data = result.data[0];
      console.log('✅ 최근 7일 성과:');
      console.log(`   - 노출수: ${Number(data.impressions || 0).toLocaleString()}`);
      console.log(`   - 클릭수: ${Number(data.clicks || 0).toLocaleString()}`);
      console.log(`   - 도달: ${Number(data.reach || 0).toLocaleString()}`);
      console.log(`   - 비용: ${Number(data.spend || 0).toLocaleString()}원`);
    } else {
      console.log('ℹ️ 최근 7일간 데이터가 없습니다.');
    }
    
    return true;
  } catch (error) {
    console.log('❌ 실패:', error.message || error);
    return false;
  }
}

/**
 * 메인 테스트 실행
 */
async function main() {
  console.log('='.repeat(50));
  console.log('🚀 Meta API 연동 테스트 시작');
  console.log('='.repeat(50));
  
  // 환경변수 확인
  if (!META_ACCESS_TOKEN) {
    console.log('❌ META_ACCESS_TOKEN이 설정되지 않았습니다.');
    return;
  }
  if (!META_AD_ACCOUNT_ID) {
    console.log('❌ META_AD_ACCOUNT_ID가 설정되지 않았습니다.');
    return;
  }
  
  console.log(`\n📌 광고 계정 ID: ${META_AD_ACCOUNT_ID}`);
  
  // 테스트 실행
  const test1 = await testAccountInfo();
  const test2 = await testCampaigns();
  const test3 = await testInsights();
  
  // 결과 요약
  console.log('\n' + '='.repeat(50));
  console.log('📋 테스트 결과 요약');
  console.log('='.repeat(50));
  console.log(`   계정 정보: ${test1 ? '✅ 성공' : '❌ 실패'}`);
  console.log(`   캠페인 목록: ${test2 ? '✅ 성공' : '❌ 실패'}`);
  console.log(`   광고 성과: ${test3 ? '✅ 성공' : '❌ 실패'}`);
  console.log('='.repeat(50));
  
  if (test1 && test2 && test3) {
    console.log('\n🎉 모든 테스트 통과! Meta API 연동이 정상입니다.\n');
  }
}

main().catch(console.error);

