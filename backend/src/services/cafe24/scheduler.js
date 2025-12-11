/**
 * Cafe24 Background Schedulers
 * 토큰 갱신 및 주문 자동 동기화 스케줄러
 */

const { getToken } = require('./tokenClient');
const { syncOrders, updatePendingPayments } = require('./orderSync');

const LOG_PREFIX = '[Cafe24]';

/**
 * 토큰 갱신 태스크 (서버 시작 시 호출)
 * 1시간마다 토큰 갱신
 */
function startTokenRefreshTask() {
  console.log(`${LOG_PREFIX} Starting token refresh background task`);
  
  // 즉시 한 번 체크
  getToken().then(token => {
    console.log(`${LOG_PREFIX} Initial token check completed`);
  }).catch(err => {
    console.error(`${LOG_PREFIX} Initial token check failed:`, err.message);
  });
  
  // 1시간마다 갱신
  const REFRESH_INTERVAL = 60 * 60 * 1000; // 1시간
  
  setInterval(async () => {
    try {
      await getToken();
      console.log(`${LOG_PREFIX} Scheduled token refresh completed`);
    } catch (error) {
      console.error(`${LOG_PREFIX} Scheduled token refresh failed:`, error.message);
    }
  }, REFRESH_INTERVAL);
}

/**
 * 자동 동기화 스케줄러 시작
 * 10분마다 오늘 주문 동기화 + 입금대기 주문 상태 업데이트 실행
 */
function startAutoSyncTask() {
  console.log(`${LOG_PREFIX} Starting auto sync background task (10min interval)`);
  
  // 서버 시작 2분 후 첫 동기화 (서버 안정화 대기)
  setTimeout(async () => {
    console.log(`${LOG_PREFIX} Running initial auto sync...`);
    await syncOrders();
    await updatePendingPayments();
  }, 2 * 60 * 1000);
  
  // 10분마다 동기화
  const SYNC_INTERVAL = 10 * 60 * 1000; // 10분
  
  setInterval(async () => {
    console.log(`${LOG_PREFIX} Running scheduled auto sync...`);
    await syncOrders();
    // 입금대기(paid=F) 주문들의 결제 상태도 업데이트
    await updatePendingPayments();
  }, SYNC_INTERVAL);
}

module.exports = {
  startTokenRefreshTask,
  startAutoSyncTask
};
