const db = require('./src/utils/database');

async function checkCreativeOrders() {
  const startDate = '2024-12-08';
  const endDate = '2025-01-06';
  const creativeName = '다이어트_고정_영상_77% 그립 다이어트(250612-01)_9대16_조예린_영괄식_1초';
  
  console.log('=== 광고 소재 주문 데이터 확인 ===');
  console.log(`기간: ${startDate} ~ ${endDate}`);
  console.log(`광고: ${creativeName}\n`);
  
  // 1. 이 광고를 본 visitor 목록 (30일 확장 기간 포함)
  const extendedStartDate = new Date(startDate);
  extendedStartDate.setDate(extendedStartDate.getDate() - 30);
  
  console.log(`[1] visitor 조회 기간: ${extendedStartDate.toISOString().split('T')[0]} ~ ${endDate}`);
  
  const visitorResult = await db.query(`
    SELECT DISTINCT visitor_id, MIN(entry_timestamp) as first_seen
    FROM utm_sessions
    WHERE REPLACE(utm_params->>'utm_content', '+', ' ') = $1
      AND entry_timestamp >= $2
      AND entry_timestamp <= $3
    GROUP BY visitor_id
    ORDER BY first_seen
  `, [creativeName, extendedStartDate, endDate]);
  
  console.log(`이 광고를 본 visitor 수: ${visitorResult.rows.length}명\n`);
  
  // 2. 이 visitor들 중 선택 기간 내 결제한 주문
  if (visitorResult.rows.length > 0) {
    const visitorIds = visitorResult.rows.map(r => r.visitor_id);
    
    const orderResult = await db.query(`
      SELECT 
        order_id,
        visitor_id,
        final_payment,
        timestamp as order_date,
        product_name
      FROM conversions
      WHERE visitor_id = ANY($1)
        AND order_id IS NOT NULL
        AND paid = 'T'
        AND final_payment > 0
        AND timestamp >= $2
        AND timestamp <= $3
      ORDER BY timestamp DESC
    `, [visitorIds, startDate, endDate]);
    
    console.log(`[2] 선택 기간(${startDate} ~ ${endDate}) 내 결제 주문: ${orderResult.rows.length}건\n`);
    
    if (orderResult.rows.length > 0) {
      console.log('=== 주문 목록 (최근 10건) ===');
      orderResult.rows.slice(0, 10).forEach((order, i) => {
        console.log(`${i+1}. ${order.order_date.toISOString().split('T')[0]} | ${order.final_payment}원 | ${order.order_id}`);
      });
      
      // 가장 오래된 주문과 최신 주문
      console.log('\n=== 주문 날짜 범위 ===');
      console.log(`가장 오래된 주문: ${orderResult.rows[orderResult.rows.length-1].order_date}`);
      console.log(`가장 최신 주문: ${orderResult.rows[0].order_date}`);
    }
    
    // 3. 12월 8일 이후 주문이 있는지 확인
    const afterDec8 = orderResult.rows.filter(o => new Date(o.order_date) > new Date('2024-12-08'));
    console.log(`\n[3] 12월 8일 이후 주문: ${afterDec8.length}건`);
    
    // 4. 이 광고를 30일 이내에 보고 결제한 주문만 필터링
    console.log('\n=== [4] 30일 기여 인정 기간 적용 후 ===');
    
    for (const order of orderResult.rows.slice(0, 5)) {
      const orderDate = new Date(order.order_date);
      const windowStart = new Date(orderDate);
      windowStart.setDate(windowStart.getDate() - 30);
      
      // 이 주문의 구매자가 30일 이내에 해당 광고를 봤는지 확인
      const journeyCheck = await db.query(`
        SELECT entry_timestamp
        FROM utm_sessions
        WHERE visitor_id = $1
          AND REPLACE(utm_params->>'utm_content', '+', ' ') = $2
          AND entry_timestamp >= $3
          AND entry_timestamp <= $4
        ORDER BY entry_timestamp DESC
        LIMIT 1
      `, [order.visitor_id, creativeName, windowStart, orderDate]);
      
      const isContributed = journeyCheck.rows.length > 0;
      console.log(`주문 ${order.order_date.toISOString().split('T')[0]}: ${isContributed ? '✅ 기여 인정' : '❌ 기여 안됨 (30일 초과)'}`);
      
      if (!isContributed) {
        // 언제 광고를 봤는지 확인
        const whenSeen = await db.query(`
          SELECT entry_timestamp
          FROM utm_sessions
          WHERE visitor_id = $1
            AND REPLACE(utm_params->>'utm_content', '+', ' ') = $2
          ORDER BY entry_timestamp DESC
          LIMIT 1
        `, [order.visitor_id, creativeName]);
        
        if (whenSeen.rows.length > 0) {
          const seenDate = new Date(whenSeen.rows[0].entry_timestamp);
          const daysDiff = Math.floor((orderDate - seenDate) / (1000 * 60 * 60 * 24));
          console.log(`  → 광고 본 날: ${seenDate.toISOString().split('T')[0]} (${daysDiff}일 전)`);
        }
      }
    }
  }
  
  process.exit(0);
}

checkCreativeOrders().catch(e => { console.error(e); process.exit(1); });
