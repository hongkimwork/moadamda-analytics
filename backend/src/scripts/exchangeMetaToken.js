/**
 * Meta 단기 토큰 → 장기 토큰(60일) 교환 스크립트
 * 
 * 사용법: node src/scripts/exchangeMetaToken.js
 */

require('dotenv').config({ path: '.env.local' });
const https = require('https');
const fs = require('fs');
const path = require('path');

const META_APP_ID = process.env.META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

const API_VERSION = 'v20.0';

/**
 * HTTPS GET 요청
 */
function httpsGet(url) {
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
 * 토큰 정보 확인 (만료일 등)
 */
async function debugToken(token) {
  const appAccessToken = `${META_APP_ID}|${META_APP_SECRET}`;
  const url = `https://graph.facebook.com/${API_VERSION}/debug_token?input_token=${token}&access_token=${appAccessToken}`;
  
  const result = await httpsGet(url);
  
  if (result.error) {
    throw new Error(result.error.message);
  }
  
  return result.data;
}

/**
 * 단기 토큰 → 장기 토큰 교환
 */
async function exchangeToken(shortLivedToken) {
  const url = `https://graph.facebook.com/${API_VERSION}/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${shortLivedToken}`;
  
  const result = await httpsGet(url);
  
  if (result.error) {
    throw new Error(result.error.message);
  }
  
  return result;
}

/**
 * .env.local 파일에서 토큰 업데이트
 */
function updateEnvFile(newToken) {
  const envPath = path.join(__dirname, '../../.env.local');
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  // META_ACCESS_TOKEN 라인 찾아서 교체
  const tokenRegex = /META_ACCESS_TOKEN=.*/;
  if (tokenRegex.test(envContent)) {
    envContent = envContent.replace(tokenRegex, `META_ACCESS_TOKEN=${newToken}`);
  } else {
    envContent += `\nMETA_ACCESS_TOKEN=${newToken}`;
  }
  
  fs.writeFileSync(envPath, envContent);
  console.log('✅ .env.local 파일에 새 토큰 저장 완료');
}

/**
 * 메인 실행
 */
async function main() {
  console.log('='.repeat(50));
  console.log('🔄 Meta 토큰 교환 시작');
  console.log('='.repeat(50));
  
  // 환경변수 확인
  if (!META_APP_ID || !META_APP_SECRET || !META_ACCESS_TOKEN) {
    console.log('❌ 환경변수가 설정되지 않았습니다.');
    console.log('   META_APP_ID, META_APP_SECRET, META_ACCESS_TOKEN을 확인하세요.');
    return;
  }
  
  try {
    // 1. 현재 토큰 정보 확인
    console.log('\n📊 [1단계] 현재 토큰 정보 확인...');
    const tokenInfo = await debugToken(META_ACCESS_TOKEN);
    
    const expiresAt = tokenInfo.expires_at ? new Date(tokenInfo.expires_at * 1000) : null;
    const isValid = tokenInfo.is_valid;
    
    console.log(`   - 유효 여부: ${isValid ? '✅ 유효' : '❌ 무효'}`);
    console.log(`   - 앱 ID: ${tokenInfo.app_id}`);
    console.log(`   - 유형: ${tokenInfo.type}`);
    
    if (expiresAt) {
      const now = new Date();
      const daysLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
      console.log(`   - 만료일: ${expiresAt.toLocaleString('ko-KR')}`);
      console.log(`   - 남은 일수: ${daysLeft}일`);
      
      // 이미 장기 토큰인지 확인 (7일 이상 남음)
      if (daysLeft > 7) {
        console.log(`\n✅ 현재 토큰이 아직 유효합니다 (${daysLeft}일 남음)`);
        console.log('   장기 토큰으로 이미 교환되었거나 충분한 유효기간이 있습니다.');
        return;
      }
    } else {
      console.log('   - 만료일: 없음 (영구 토큰)');
      console.log('\n✅ 이미 영구 토큰입니다. 교환이 필요없습니다.');
      return;
    }
    
    if (!isValid) {
      console.log('\n❌ 토큰이 만료되었습니다. Graph API Explorer에서 새 토큰을 발급받으세요.');
      return;
    }
    
    // 2. 장기 토큰으로 교환
    console.log('\n📊 [2단계] 장기 토큰으로 교환 중...');
    const exchangeResult = await exchangeToken(META_ACCESS_TOKEN);
    
    const newToken = exchangeResult.access_token;
    const expiresIn = exchangeResult.expires_in; // 초 단위
    
    console.log('   ✅ 토큰 교환 성공!');
    console.log(`   - 새 토큰 길이: ${newToken.length}자`);
    console.log(`   - 유효 기간: ${Math.floor(expiresIn / 86400)}일`);
    
    // 3. 새 토큰 정보 확인
    console.log('\n📊 [3단계] 새 토큰 정보 확인...');
    const newTokenInfo = await debugToken(newToken);
    const newExpiresAt = new Date(newTokenInfo.expires_at * 1000);
    console.log(`   - 만료일: ${newExpiresAt.toLocaleString('ko-KR')}`);
    
    // 4. .env.local 파일 업데이트
    console.log('\n📊 [4단계] 환경 파일 업데이트...');
    updateEnvFile(newToken);
    
    console.log('\n' + '='.repeat(50));
    console.log('🎉 토큰 교환 완료!');
    console.log('='.repeat(50));
    console.log(`\n📌 새 토큰 만료일: ${newExpiresAt.toLocaleString('ko-KR')}`);
    console.log('📌 만료 전에 이 스크립트를 다시 실행하면 자동 갱신됩니다.\n');
    
  } catch (error) {
    console.log('\n❌ 오류 발생:', error.message);
    
    if (error.message.includes('expired')) {
      console.log('\n💡 토큰이 만료되었습니다.');
      console.log('   Graph API Explorer에서 새 토큰을 발급받으세요:');
      console.log('   https://developers.facebook.com/tools/explorer/');
    }
  }
}

main();

