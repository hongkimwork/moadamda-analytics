/**
 * Stats API Router (Thin Layer)
 * 
 * 이 파일은 stats/ 모듈들의 진입점입니다.
 * 실제 로직은 stats/ 폴더 내의 모듈들에 있습니다:
 * 
 * - stats/basic.js:    /today, /conversion, /products
 * - stats/range.js:    /range, /daily
 * - stats/activity.js: /recent-activity, /segments
 * - stats/utm.js:      /utm-performance, /utm-attribution, /utm-keys, /utm-values
 * - stats/orders.js:   /orders, /order-detail/:orderId
 * - stats/funnel.js:   /funnel/conversion
 * 
 * 총 14개 API 핸들러가 6개 모듈로 분리되어 있습니다.
 */

// Re-export the stats router from stats/index.js
module.exports = require('./stats/index');
