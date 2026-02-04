/**
 * 광고 미디어 API 테스트 스크립트
 * 실행: node backend/src/scripts/testAdMedia.js <adId>
 */

// FIX (2026-02-04): 서버에서는 .env 사용, 로컬에서는 .env.local 사용
const envFile = process.env.NODE_ENV === 'production' ? '.env' : '.env.local';
require('dotenv').config({ path: require('path').join(__dirname, '../../' + envFile) });

const metaService = require('../services/meta');

async function testAdMedia(adId) {
  console.log('=== 광고 미디어 테스트 ===');
  console.log('Ad ID:', adId);
  console.log('');
  
  try {
    // 1. 광고 미디어 상세 정보 조회
    console.log('1. getAdMediaDetails 호출...');
    const mediaDetails = await metaService.getAdMediaDetails(adId);
    console.log('결과:', JSON.stringify(mediaDetails, null, 2));
    console.log('');
    
    // 2. 동영상이 있는 경우 동영상 상세 정보 조회
    if (mediaDetails?.videoId) {
      console.log('2. getVideoDetails 호출...');
      const videoDetails = await metaService.getVideoDetails(mediaDetails.videoId);
      console.log('동영상 상세:', JSON.stringify(videoDetails, null, 2));
    }
    
  } catch (error) {
    console.error('에러:', error);
  }
}

// 명령줄 인자에서 adId 가져오기
const adId = process.argv[2];
if (!adId) {
  console.log('사용법: node testAdMedia.js <adId>');
  console.log('');
  console.log('먼저 광고 목록에서 adId를 확인하세요.');
  process.exit(1);
}

testAdMedia(adId);
