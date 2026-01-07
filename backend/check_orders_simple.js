const db = require('./src/utils/database');

async function check() {
  const startDate = '2024-12-08';
  const endDate = '2025-01-06';
  const creativeName = '다이어트_고정_영상_77% 그립 다이어트(250612-01)_9대16_조예린_영괄식_1초';
  
  console.log('=== 광고 소재 주문 데이터 확인 ===');
  console.log('기간:', startDate, '~', endDate);
  console.log('광고:', creativeName.substring(0, 40) + '...\n');
  
  // 1. 이 광고를 본 visitor 수
  const visitorResult = await db.query(`
    SELECT COUNT(DISTINCT visitor_id) as cnt
    FROM utm_sessions
    WHERE REPLACE(utm_params->>'utm_content', '+', ' ') = $1
  `, [creativeName]);
  console.log('[1] 이 광고를 본 총 visitor 수:', visitorResult.rows[0].cnt);
  
  // 2. 이 광고를 본 visitor들의 선택 기간 내 주문
  const orderResult = await db.query(`
    SELECT 
      c.order_id,
      c.visitor_id,
      c.final_payment,
      c.timestamp as order_date
    FROM conversions c
    WHERE c.visitor_id IN (
      SELECT DISTINCT visitor_id
      FROM utm_sessions
      WHERE REPLACE(utm_params->>'utm_content', '+', ' ') = $1
    )
    AND c.order_id IS NOT NULL
    AND c.paid = 'T'
    AND c.final_payment > 0
    AND c.timestamp >= $2
    AND c.timestamp <= $3
    ORDER BY c.timestamp DESC
  `, [creativeName, startDate, endDate]);
  
  console.log('[2] 선택 기간 내 주문 수:', orderResult.rows.length);
  
  if (orderResult.rows.length > 0) {
    console.log('\n=== 주문 날짜 목록 (최근 20건) ===');
    orderResult.rows.slice(0, 20).forEach((r, i) => {
      const date = new Date(r.order_date);
      console.log(`${i+1}. ${date.toISOString().split('T')[0]} | ${r.final_payment}원`);
    });
    
    console.log('\n=== 날짜 범위 ===');
    console.log('가장 최신:', new Date(orderResult.rows[0].order_date).toISOString());
    console.log('가장 오래된:', new Date(orderResult.rows[orderResult.rows.length-1].order_date).toISOString());
    
    // 12월 8일 이후 주문 수
    const afterDec8 = orderResult.rows.filter(r => new Date(r.order_date) > new Date('2024-12-08T23:59:59'));
    console.log('\n12월 8일 이후 주문:', afterDec8.length, '건');
  }
  
  // 3. 30일 기여 인정 기간 적용 시 실제 기여 주문 확인
  console.log('\n=== [3] 30일 기여 인정 기간 적용 후 ===');
  
  let contributedCount = 0;
  for (const order of orderResult.rows) {
    const orderDate = new Date(order.order_date);
    const windowStart = new Date(orderDate);
    windowStart.setDate(windowStart.getDate() - 30);
    
    const journeyCheck = await db.query(`
      SELECT entry_timestamp
      FROM utm_sessions
      WHERE visitor_id = $1
        AND REPLACE(utm_params->>'utm_content', '+', ' ') = $2
        AND entry_timestamp >= $3
        AND entry_timestamp <= $4
      LIMIT 1
    `, [order.visitor_id, creativeName, windowStart, orderDate]);
    
    if (journeyCheck.rows.length > 0) {
      contributedCount++;
    }
  }
  
  console.log('30일 기여 인정 주문 수:', contributedCount, '/', orderResult.rows.length);
  
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
