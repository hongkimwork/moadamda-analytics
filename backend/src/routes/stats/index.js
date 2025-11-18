const express = require('express');
const router = express.Router();

// Import sub-routers
const basicRouter = require('./basic');
const rangeRouter = require('./range');
const activityRouter = require('./activity');
const utmRouter = require('./utm');
const ordersRouter = require('./orders');

// Mount sub-routers
router.use('/', basicRouter);      // /today, /conversion, /products
router.use('/', rangeRouter);      // /range, /daily
router.use('/', activityRouter);   // /recent-activity, /segments
router.use('/', utmRouter);        // /utm-performance, /utm-attribution, /utm-keys, /utm-values
router.use('/', ordersRouter);     // /orders, /order-detail/:orderId

module.exports = router;

