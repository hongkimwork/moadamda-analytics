/**
 * Cafe24 API Client
 * 
 * 이 파일은 이전 버전과의 호환성을 위해 유지됩니다.
 * 실제 구현은 services/cafe24/ 폴더의 모듈화된 구조로 이동되었습니다.
 * 
 * 구조:
 * - services/cafe24/tokenClient.js: 토큰 관리 및 API 호출
 * - services/cafe24/orderSync.js: 주문 동기화 및 visitor 매칭
 * - services/cafe24/scheduler.js: 자동 실행 작업
 * - services/cafe24/utils.js: 공통 유틸리티 및 상수
 * - services/cafe24/index.js: 통합 export
 * 
 * 모든 기존 함수와 상수는 동일한 방식으로 사용 가능합니다.
 */

module.exports = require('../services/cafe24');
