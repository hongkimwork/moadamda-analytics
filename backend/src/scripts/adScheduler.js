/**
 * 광고 데이터 자동 동기화 스케줄러
 * 
 * 스케줄:
 * - 매일 오전 6시: 네이버 + Meta 광고 데이터 동기화
 * - 매주 월요일 오전 5시: Meta 토큰 갱신 확인
 * 
 * 사용법:
 *   node src/scripts/adScheduler.js          # 스케줄러 시작
 *   node src/scripts/adScheduler.js --now    # 지금 즉시 실행
 */

// FIX (2026-02-04): 서버에서는 .env 사용, 로컬에서는 .env.local 사용
require('dotenv').config({ path: process.env.NODE_ENV === 'production' ? '.env' : '.env.local' });

const cron = require('node-cron');
const { spawn } = require('child_process');
const path = require('path');

const SCRIPTS_DIR = path.join(__dirname);

/**
 * 스크립트 실행 함수
 * @param {string} scriptName - 스크립트 파일명
 * @param {Array} args - 추가 인자
 * @returns {Promise<boolean>} - 성공 여부
 */
function runScript(scriptName, args = []) {
  return new Promise((resolve) => {
    const scriptPath = path.join(SCRIPTS_DIR, scriptName);
    
    console.log(`\n🚀 [${new Date().toLocaleString('ko-KR')}] ${scriptName} 실행 중...`);
    
    const child = spawn('node', [scriptPath, ...args], {
      cwd: path.join(__dirname, '../..'),
      env: process.env,
      stdio: 'inherit'
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${scriptName} 완료\n`);
        resolve(true);
      } else {
        console.log(`❌ ${scriptName} 실패 (code: ${code})\n`);
        resolve(false);
      }
    });
    
    child.on('error', (err) => {
      console.log(`❌ ${scriptName} 오류: ${err.message}\n`);
      resolve(false);
    });
  });
}

/**
 * 네이버 광고 동기화 (정보 + 성과)
 */
async function syncNaverAds() {
  console.log('\n' + '='.repeat(50));
  console.log('📊 네이버 광고 동기화 시작');
  console.log('='.repeat(50));
  
  // 캠페인/광고그룹/키워드 정보 동기화
  await runScript('syncNaverAdInfo.js');
  
  // 최근 7일 성과 데이터 동기화
  await runScript('syncNaverAdStats.js', ['7']);
}

/**
 * Meta 광고 동기화 (정보 + 성과)
 */
async function syncMetaAds() {
  console.log('\n' + '='.repeat(50));
  console.log('📊 Meta 광고 동기화 시작');
  console.log('='.repeat(50));
  
  // 캠페인/광고세트/광고 정보 + 최근 7일 성과
  await runScript('syncMetaAds.js', ['7']);
}

/**
 * Meta 토큰 갱신 확인
 */
async function checkMetaToken() {
  console.log('\n' + '='.repeat(50));
  console.log('🔑 Meta 토큰 갱신 확인');
  console.log('='.repeat(50));
  
  await runScript('exchangeMetaToken.js');
}

/**
 * 전체 광고 데이터 동기화
 */
async function syncAllAds() {
  const startTime = Date.now();
  
  console.log('\n' + '▓'.repeat(50));
  console.log('▓ 광고 데이터 자동 동기화');
  console.log('▓ ' + new Date().toLocaleString('ko-KR'));
  console.log('▓'.repeat(50));
  
  // 네이버 광고
  await syncNaverAds();
  
  // Meta 광고
  await syncMetaAds();
  
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  
  console.log('\n' + '▓'.repeat(50));
  console.log(`▓ 동기화 완료! (소요 시간: ${elapsed}초)`);
  console.log('▓'.repeat(50) + '\n');
}

/**
 * 스케줄러 시작
 */
function startScheduler() {
  console.log('='.repeat(50));
  console.log('🕐 광고 데이터 자동 동기화 스케줄러 시작');
  console.log('='.repeat(50));
  console.log('\n📅 스케줄 설정:');
  console.log('   - 매일 오전 6시: 광고 데이터 동기화');
  console.log('   - 매주 월요일 오전 5시: Meta 토큰 갱신 확인');
  console.log('\n⏰ 대기 중...\n');
  
  // 매일 오전 6시 - 광고 데이터 동기화
  // cron 형식: 분 시 일 월 요일
  cron.schedule('0 6 * * *', async () => {
    await syncAllAds();
  }, {
    timezone: 'Asia/Seoul'
  });
  
  // 매주 월요일 오전 5시 - Meta 토큰 갱신 확인
  cron.schedule('0 5 * * 1', async () => {
    await checkMetaToken();
  }, {
    timezone: 'Asia/Seoul'
  });
  
  // 프로세스 종료 방지
  process.on('SIGINT', () => {
    console.log('\n\n👋 스케줄러 종료');
    process.exit(0);
  });
}

/**
 * 메인 실행
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--now') || args.includes('-n')) {
    // 즉시 실행 모드
    console.log('🚀 즉시 실행 모드\n');
    await syncAllAds();
    await checkMetaToken();
    process.exit(0);
  } else if (args.includes('--naver')) {
    // 네이버만 실행
    await syncNaverAds();
    process.exit(0);
  } else if (args.includes('--meta')) {
    // Meta만 실행
    await syncMetaAds();
    process.exit(0);
  } else if (args.includes('--token')) {
    // 토큰 갱신만 실행
    await checkMetaToken();
    process.exit(0);
  } else {
    // 스케줄러 모드
    startScheduler();
  }
}

main();

