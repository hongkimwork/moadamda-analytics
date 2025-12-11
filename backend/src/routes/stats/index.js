/**
 * Stats API Router Aggregator
 * 
 * 이 파일은 통계 관련 API들을 그룹화하여 마운트합니다.
 * 각 모듈은 도메인별로 분리되어 있습니다:
 * 
 * - basic.js:    /today, /conversion, /products (일일 기본 통계)
 * - range.js:    /range, /daily (기간별 통계)
 * - activity.js: /recent-activity, /segments (활동/세그먼트)
 * - utm.js:      /utm-performance, /utm-attribution, /utm-keys, /utm-values (UTM 분석)
 * - orders.js:   /orders, /order-detail/:orderId (주문 분석)
 * - funnel.js:   /funnel/conversion (전환 퍼널)
 */

const express = require('express');
const router = express.Router();

// Import sub-routers
const basicRouter = require('./basic');
const rangeRouter = require('./range');
const activityRouter = require('./activity');
const utmRouter = require('./utm');
const ordersRouter = require('./orders');
const funnelRouter = require('./funnel');

// Mount sub-routers at root level (same path as parent)
router.use('/', basicRouter);      // /today, /conversion, /products
router.use('/', rangeRouter);      // /range, /daily
router.use('/', activityRouter);   // /recent-activity, /segments
router.use('/', utmRouter);        // /utm-performance, /utm-attribution, /utm-keys, /utm-values
router.use('/', ordersRouter);     // /orders, /order-detail/:orderId

// Mount funnel at /funnel prefix
router.use('/funnel', funnelRouter); // /funnel/conversion

module.exports = router;
