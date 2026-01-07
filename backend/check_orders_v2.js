const db = require('./src/utils/database');

async function check() {
  const startDate = '2025-12-08';
  const endDate = '2026-01-06';
  const creativeName = '다이어트_고정_영상_77% 그립 다이어트(250612-01)_9대16_조예린_영괄식_1초';
  const utmSource = 'meta';
  const utmMedium = 'paid';
  
  console.log('=== 실제 API 로직과 동일하게 확인 ===');
  console.log('기간:', startDate, '~', endDate);
  
  // 확장된 기간 (30일 전)
  const extendedStart = new Date(startDate);
  extendedStart.setDate(extendedStart.getDate() - 30);
  console.log('확장된 visitor 조회 기간:', extendedStart.toISOString().split('T')[0], '~', endDate);
  
  // 1. 확장된 기간 내 모든 광고를 본 visitor
  const allVisitors = await db.query(`
    SELECT DISTINCT visitor_id
    FROM utm_sessions
    WHERE utm_params->>'utm_content' IS NOT NULL
      AND entry_timestamp >= $1
      AND entry_timestamp <= $2
  `, [extendedStart, endDate]);
  console.log('\n[1] 확장 기간 내 광고 본 visitor 수:', allVisitors.rows.length);
  
  // 2. 그 visitor들의 선택 기간 내 주문
  const visitorIds = allVisitors.rows.map(r => r.visitor_id);
  const orders = await db.query(`
    SELECT 
      c.order_id,
      c.visitor_id,
      c.final_payment,
      c.timestamp as order_date
    FROM conversions c
    WHERE c.visitor_id = ANY($1)
      AND c.order_id IS NOT NULL
      AND c.paid = 'T'
      AND c.final_payment > 0
      AND c.timestamp >= $2
      AND c.timestamp <= $3
    ORDER BY c.timestamp DESC
  `, [visitorIds, startDate, endDate]);
  console.log('[2] 선택 기간 내 총 주문 수:', orders.rows.length);
  
  // 3. 해당 광고가 기여한 주문 (30일 기여 인정)
  let contributedOrders = [];
  
  for (const order of orders.rows) {
    const orderDate = new Date(order.order_date);
    const windowStart = new Date(orderDate);
    windowStart.setDate(windowStart.getDate() - 30);
    
    // 이 주문의 구매자가 30일 이내에 해당 광고를 봤는지
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
      contributedOrders.push(order);
    }
  }
  
  console.log('[3] 해당 광고 기여 주문 수:', contributedOrders.length);
  
  if (contributedOrders.length > 0) {
    console.log('\n=== 기여 주문 목록 ===');
    contributedOrders.forEach((o, i) => {
      console.log(`${i+1}. ${new Date(o.order_date).toISOString().split('T')[0]} | ${o.final_payment}원`);
    });
  }
  
  // 4. 혹시 12월 8일 이전 주문이 있는지 확인 (버그 가능성)
  console.log('\n=== [4] 12월 8일 이전 주문 확인 (버그 체크) ===');
  const beforeOrders = await db.query(`
    SELECT 
      c.order_id,
      c.timestamp as order_date,
      c.final_payment
    FROM conversions c
    WHERE c.visitor_id IN (
      SELECT DISTINCT visitor_id
      FROM utm_sessions
      WHERE REPLACE(utm_params->>'utm_content', '+', ' ') = $1
    )
    AND c.order_id IS NOT NULL
    AND c.paid = 'T'
    AND c.final_payment > 0
    AND c.timestamp < $2
    ORDER BY c.timestamp DESC
    LIMIT 10
  `, [creativeName, '2025-12-08']);
  
  console.log('12월 8일 이전 주문 (최근 10건):');
  beforeOrders.rows.forEach((o, i) => {
    console.log(`${i+1}. ${new Date(o.order_date).toISOString().split('T')[0]} | ${o.final_payment}원`);
  });
  
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
