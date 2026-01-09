/**
 * Stats API Router Aggregator
 * 
 * 이 파일은 통계 관련 API들을 그룹화하여 마운트합니다.
 * 각 모듈은 도메인별로 분리되어 있습니다:
 * 
 * - basic.js:         /today, /conversion, /products (일일 기본 통계)
 * - range.js:         /range, /daily (기간별 통계)
 * - activity.js:      /recent-activity, /segments (활동/세그먼트)
 * - utm.js:           /utm-performance, /utm-attribution, /utm-keys, /utm-values (UTM 분석)
 * - orders.js:        /orders, /order-detail/:orderId (주문 분석)
 * - funnel.js:        /funnel/conversion (전환 퍼널)
 * - channel-funnel.js: /channel-funnel/conversion (채널별 전환 퍼널)
 * - customer-type.js: /customer-type (신규/재구매 고객 분석)
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
const channelFunnelRouter = require('./channel-funnel');
const customerTypeRouter = require('./customer-type');
const validationRouter = require('./validation');
const cafe24CompareRouter = require('./cafe24-compare');

// Mount sub-routers at root level (same path as parent)
router.use('/', basicRouter);      // /today, /conversion, /products
router.use('/', rangeRouter);      // /range, /daily
router.use('/', activityRouter);   // /recent-activity, /segments
router.use('/', utmRouter);        // /utm-performance, /utm-attribution, /utm-keys, /utm-values
router.use('/', ordersRouter);     // /orders, /order-detail/:orderId
router.use('/', customerTypeRouter); // /customer-type

// Mount funnel at /funnel prefix
router.use('/funnel', funnelRouter); // /funnel/conversion

// Mount channel-funnel at /channel-funnel prefix
router.use('/channel-funnel', channelFunnelRouter); // /channel-funnel/conversion

// Mount validation at /validation prefix
router.use('/validation', validationRouter); // /validation/daily-visits

// Mount cafe24-compare at /cafe24-compare prefix
router.use('/cafe24-compare', cafe24CompareRouter); // /cafe24-compare

module.exports = router;
