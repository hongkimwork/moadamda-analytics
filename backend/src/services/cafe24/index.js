/**
 * Cafe24 API Client - Main Entry Point
 * 모든 Cafe24 관련 기능을 통합 export
 * 
 * 레퍼런스: moadamda-access-log/src/core/cafe24.py
 * 
 * 주요 기능:
 * - 토큰 관리: getToken(), refreshToken()
 * - API 호출: callApi(), getOrders(), getOrderDetail() 등
 * - 주문 동기화: syncOrders(), syncOrdersForRange()
 * - 백필 작업: backfillVisitorIds(), backfillProductNames(), updatePendingPayments()
 * - 자동 실행: startTokenRefreshTask(), startAutoSyncTask()
 */

// Token Client (토큰 관리 + API 호출)
const {
  getToken,
  refreshToken,
  callApi,
  getOrders,
  getAllOrders,
  getOrderDetail,
  getBuyerInfo,
  getMemberInfo,
  getTokenInfo
} = require('./tokenClient');

// Order Sync (주문 동기화 + visitor 매칭)
const {
  findMatchingVisitor,
  syncOrders,
  syncOrdersForRange,
  backfillVisitorIds,
  backfillProductNames,
  updatePendingPayments,
  backfillFirstOrder,
  backfillMemberIds
} = require('./orderSync');

// Scheduler (자동 실행 작업)
const {
  startTokenRefreshTask,
  startAutoSyncTask
} = require('./scheduler');

// Utils (상수)
const {
  CAFE24_MALL_ID,
  CAFE24_API_VERSION
} = require('./utils');

// 모든 함수와 상수를 export (기존 호환성 유지)
module.exports = {
  // Token & API
  getToken,
  refreshToken,
  callApi,
  getOrders,
  getAllOrders,
  getOrderDetail,
  getBuyerInfo,
  getMemberInfo,
  getTokenInfo,
  
  // Order Sync
  findMatchingVisitor,
  syncOrders,
  syncOrdersForRange,
  backfillVisitorIds,
  backfillProductNames,
  updatePendingPayments,
  backfillFirstOrder,
  backfillMemberIds,
  
  // Scheduler
  startTokenRefreshTask,
  startAutoSyncTask,
  
  // Constants
  CAFE24_MALL_ID,
  CAFE24_API_VERSION
};
