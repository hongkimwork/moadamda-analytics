/**
 * 빈 문자열 utm_content 복구 스크립트
 * - entry_url에서 utm_content를 추출하고 디코딩
 * - utm_sessions 테이블의 utm_params 업데이트
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || '49.50.139.223',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'moadamda',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'analytics',
});

/**
 * URL에서 utm_content를 추출하고 디코딩
 * 잘못된 % 인코딩 (77%%20 → 77%25%20) 처리
 */
function extractAndDecodeUtmContent(url) {
  if (!url) return null;
  
  try {
    const match = url.match(/[?&]utm_content=([^&]*)/);
    if (!match || !match[1]) return null;
    
    let encoded = match[1];
    
    // 빈 값 체크
    if (encoded === '') return null;
    
    // 잘못된 % 인코딩 수정: % 뒤에 두 자리 hex가 아닌 경우 %25로 변환
    // 예: 77%%20 → 77%25%20 (77% 공백)
    const fixed = encoded.replace(/%(?![0-9A-Fa-f]{2})/g, '%25');
    
    // 디코딩
    return decodeURIComponent(fixed);
  } catch (e) {
    console.error('디코딩 실패:', e.message, '- URL:', url.substring(0, 100));
    return null;
  }
}

async function fixEmptyUtmContent() {
  console.log('=== 빈 utm_content 복구 스크립트 시작 ===\n');
  
  const client = await pool.connect();
  
  try {
    // 1. 빈 utm_content를 가진 레코드 조회 (entry_url에 utm_content가 있는 것만)
    const selectQuery = `
      SELECT 
        us.id,
        us.entry_timestamp,
        us.utm_params,
        s.entry_url
      FROM utm_sessions us
      JOIN sessions s ON us.session_id = s.session_id
      WHERE (us.utm_params->>'utm_content' = '' OR us.utm_params->>'utm_content' IS NULL)
        AND s.entry_url LIKE '%utm_content=%'
        AND s.entry_url NOT LIKE '%utm_content=&%'
      ORDER BY us.entry_timestamp DESC
    `;
    
    const { rows } = await client.query(selectQuery);
    console.log(`복구 대상 레코드: ${rows.length}개\n`);
    
    if (rows.length === 0) {
      console.log('복구할 레코드가 없습니다.');
      return;
    }
    
    // 2. 각 레코드 업데이트
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    for (const row of rows) {
      const decodedContent = extractAndDecodeUtmContent(row.entry_url);
      
      if (!decodedContent) {
        skipCount++;
        continue;
      }
      
      try {
        // utm_params의 utm_content 업데이트
        const updatedParams = { ...row.utm_params, utm_content: decodedContent };
        
        const updateQuery = `
          UPDATE utm_sessions 
          SET utm_params = $1
          WHERE id = $2
        `;
        
        await client.query(updateQuery, [JSON.stringify(updatedParams), row.id]);
        successCount++;
        
        if (successCount <= 5 || successCount % 50 === 0) {
          console.log(`[${successCount}] ID ${row.id}: "${decodedContent.substring(0, 50)}..."`);
        }
      } catch (e) {
        errorCount++;
        console.error(`업데이트 실패 (ID ${row.id}):`, e.message);
      }
    }
    
    console.log('\n=== 복구 완료 ===');
    console.log(`성공: ${successCount}개`);
    console.log(`스킵: ${skipCount}개 (디코딩 불가)`);
    console.log(`실패: ${errorCount}개`);
    
  } finally {
    client.release();
    await pool.end();
  }
}

// 실행
fixEmptyUtmContent().catch(console.error);
