
require('dotenv').config(); // Load environment variables first
const db = require('./utils/database');
const { cleanUrl } = require('./utils/urlCleaner');

async function migrateMappings() {
  console.log('🚀 Starting URL mapping migration...');
  
  try {
    // 1. 모든 매핑 데이터 가져오기
    const mappingsResult = await db.query('SELECT id, url, korean_name FROM url_mappings');
    const mappings = mappingsResult.rows;
    console.log(`📊 Found ${mappings.length} mappings to process`);

    let updatedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // 2. 각 매핑에 대해 URL cleaning 적용 및 업데이트
    for (const mapping of mappings) {
      const originalUrl = mapping.url;
      const cleanedUrl = cleanUrl(originalUrl);

      // URL이 변경되지 않았으면 스킵
      if (originalUrl === cleanedUrl) {
        skippedCount++;
        continue;
      }

      console.log(`🔄 Updating: ${originalUrl} -> ${cleanedUrl}`);

      try {
        // 트랜잭션 시작
        await db.query('BEGIN');

        // 중복 확인 (이미 cleanedUrl로 매핑된 게 있는지)
        const duplicateCheck = await db.query(
          'SELECT id FROM url_mappings WHERE url = $1 AND id != $2',
          [cleanedUrl, mapping.id]
        );

        if (duplicateCheck.rows.length > 0) {
          console.warn(`⚠️ Duplicate found for ${cleanedUrl}. Deleting old mapping ID ${mapping.id} and keeping existing one.`);
          // 이미 존재하면 기존(더러운 URL) 매핑 삭제 (새로운 URL 매핑이 더 최신일 가능성/이미 존재함)
          // 주의: korean_name이 다를 수 있으므로 로그 남김
          await db.query('DELETE FROM url_mappings WHERE id = $1', [mapping.id]);
        } else {
          // 중복 없으면 업데이트
          await db.query(
            'UPDATE url_mappings SET url = $1, updated_at = NOW() WHERE id = $2',
            [cleanedUrl, mapping.id]
          );
        }

        await db.query('COMMIT');
        updatedCount++;
      } catch (err) {
        await db.query('ROLLBACK');
        console.error(`❌ Failed to update mapping ID ${mapping.id}:`, err.message);
        errorCount++;
      }
    }

    console.log('================================================');
    console.log('✅ Migration completed');
    console.log(`- Total processed: ${mappings.length}`);
    console.log(`- Updated/Merged: ${updatedCount}`);
    console.log(`- Skipped (No change): ${skippedCount}`);
    console.log(`- Errors: ${errorCount}`);
    console.log('================================================');

  } catch (error) {
    console.error('🚨 Migration fatal error:', error);
  } finally {
    // 연결 종료하지 않음 (웹 서버 컨텍스트가 아닐 경우 pool end 필요할 수 있음)
    // 여기서는 스크립트로 실행하므로 process.exit 사용 예정
    process.exit(0);
  }
}

// 실행
migrateMappings();

