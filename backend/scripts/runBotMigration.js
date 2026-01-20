/**
 * 봇 감지 로직 마이그레이션 스크립트
 * Meta/Apple/Google 크롤러 IP를 봇으로 표시
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

async function runMigration() {
  console.log('=== 봇 감지 마이그레이션 시작 ===\n');
  console.log('참고: IP 주소에 역슬래시(\\)가 붙어있는 경우도 처리합니다.\n');
  
  try {
    // 1. Meta/Facebook 크롤러 (역슬래시 유무 모두 처리)
    const meta = await pool.query(`
      UPDATE visitors SET is_bot = true 
      WHERE (
         ip_address LIKE '31.13.%' OR ip_address LIKE '%\\\\31.13.%'
         OR ip_address LIKE '69.63.%' OR ip_address LIKE '%\\\\69.63.%'
         OR ip_address LIKE '69.171.%' OR ip_address LIKE '%\\\\69.171.%'
         OR ip_address LIKE '66.220.%' OR ip_address LIKE '%\\\\66.220.%'
         OR ip_address LIKE '173.252.%' OR ip_address LIKE '%\\\\173.252.%'
         OR ip_address LIKE '157.240.%' OR ip_address LIKE '%\\\\157.240.%'
         OR ip_address LIKE '179.60.%' OR ip_address LIKE '%\\\\179.60.%'
      )
        AND is_bot = false
    `);
    console.log(`✅ Meta/Facebook 크롤러: ${meta.rowCount}명 업데이트`);

    // 2. Apple 봇
    const apple = await pool.query(`
      UPDATE visitors SET is_bot = true 
      WHERE (ip_address LIKE '17.%' OR ip_address LIKE '%\\\\17.%')
        AND is_bot = false
    `);
    console.log(`✅ Apple 봇: ${apple.rowCount}명 업데이트`);

    // 3. Google 크롤러
    const google = await pool.query(`
      UPDATE visitors SET is_bot = true 
      WHERE (
         ip_address LIKE '66.249.%' OR ip_address LIKE '%\\\\66.249.%'
         OR ip_address LIKE '64.233.%' OR ip_address LIKE '%\\\\64.233.%'
         OR ip_address LIKE '72.14.%' OR ip_address LIKE '%\\\\72.14.%'
         OR ip_address LIKE '74.125.%' OR ip_address LIKE '%\\\\74.125.%'
      )
        AND is_bot = false
    `);
    console.log(`✅ Google 크롤러: ${google.rowCount}명 업데이트`);

    // 4. Microsoft/Bing 크롤러
    const bing = await pool.query(`
      UPDATE visitors SET is_bot = true 
      WHERE (
         ip_address LIKE '40.77.%' OR ip_address LIKE '%\\\\40.77.%'
         OR ip_address LIKE '157.55.%' OR ip_address LIKE '%\\\\157.55.%'
         OR ip_address LIKE '207.46.%' OR ip_address LIKE '%\\\\207.46.%'
      )
        AND is_bot = false
    `);
    console.log(`✅ Microsoft/Bing 크롤러: ${bing.rowCount}명 업데이트`);

    // 5. 기타 호스팅 서버
    const hosting = await pool.query(`
      UPDATE visitors SET is_bot = true 
      WHERE (
         ip_address LIKE '198.64.%' OR ip_address LIKE '%\\\\198.64.%'
         OR ip_address LIKE '198.55.%' OR ip_address LIKE '%\\\\198.55.%'
      )
        AND is_bot = false
    `);
    console.log(`✅ 기타 호스팅 서버: ${hosting.rowCount}명 업데이트`);

    // 결과 요약
    const summary = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_bot = true THEN 1 ELSE 0 END) as bots,
        SUM(CASE WHEN is_bot = false THEN 1 ELSE 0 END) as normal
      FROM visitors
    `);
    
    console.log('\n=== 최종 결과 ===');
    console.log(`총 방문자: ${summary.rows[0].total}명`);
    console.log(`봇으로 표시: ${summary.rows[0].bots}명`);
    console.log(`일반 방문자: ${summary.rows[0].normal}명`);
    
    const totalUpdated = meta.rowCount + apple.rowCount + google.rowCount + bing.rowCount + hosting.rowCount;
    console.log(`\n🎉 총 ${totalUpdated}명이 봇으로 업데이트되었습니다.`);

  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error.message);
  } finally {
    await pool.end();
  }
}

runMigration();
