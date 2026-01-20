/**
 * 봇 IP 대역 확인 스크립트
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

async function checkBotIps() {
  console.log('=== 봇 IP 대역 확인 ===\n');
  
  try {
    // Meta/Facebook IP 확인
    const meta = await pool.query(`
      SELECT ip_address, is_bot, COUNT(*) as cnt
      FROM visitors 
      WHERE ip_address LIKE '31.13.%' 
         OR ip_address LIKE '69.63.%' 
         OR ip_address LIKE '66.220.%' 
         OR ip_address LIKE '173.252.%'
      GROUP BY ip_address, is_bot
      ORDER BY ip_address
      LIMIT 20
    `);
    console.log('📌 Meta/Facebook IP:', meta.rowCount, '개');
    if (meta.rows.length > 0) {
      console.table(meta.rows);
    }

    // Apple IP 확인
    const apple = await pool.query(`
      SELECT ip_address, is_bot, COUNT(*) as cnt
      FROM visitors 
      WHERE ip_address LIKE '17.%'
      GROUP BY ip_address, is_bot
      ORDER BY ip_address
      LIMIT 20
    `);
    console.log('\n📌 Apple IP:', apple.rowCount, '개');
    if (apple.rows.length > 0) {
      console.table(apple.rows);
    }

    // Google IP 확인
    const google = await pool.query(`
      SELECT ip_address, is_bot, COUNT(*) as cnt
      FROM visitors 
      WHERE ip_address LIKE '66.249.%' 
         OR ip_address LIKE '74.125.%'
      GROUP BY ip_address, is_bot
      ORDER BY ip_address
      LIMIT 20
    `);
    console.log('\n📌 Google IP:', google.rowCount, '개');
    if (google.rows.length > 0) {
      console.table(google.rows);
    }

    // 현재 봇으로 표시된 IP 샘플
    const currentBots = await pool.query(`
      SELECT ip_address, browser, os, first_visit
      FROM visitors 
      WHERE is_bot = true
      ORDER BY first_visit DESC
      LIMIT 10
    `);
    console.log('\n📌 현재 봇으로 표시된 방문자 (최근 10명):');
    console.table(currentBots.rows);

  } catch (error) {
    console.error('❌ 확인 실패:', error.message);
  } finally {
    await pool.end();
  }
}

checkBotIps();
