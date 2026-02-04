const express = require('express');
const router = express.Router();
const ordersService = require('../../services/stats/ordersService');

// GET /api/stats/orders - Get paginated orders list
router.get('/orders', async (req, res) => {
  try {
    const { 
      start, 
      end, 
      device = 'all', 
      limit = 100, 
      offset = 0,
      search = '',
      sort_by = 'timestamp',
      sort_order = 'desc',
      include_cancelled = 'false',
      include_pending = 'false'
    } = req.query;

    const result = await ordersService.getOrdersList({
      start,
      end,
      device,
      limit,
      offset,
      search,
      sortBy: sort_by,
      sortOrder: sort_order,
      includeCancelled: include_cancelled,
      includePending: include_pending
    });

    res.json(result);

  } catch (error) {
    console.error('Orders list error:', error);
    const statusCode = error.message.includes('required') ? 400 : 500;
    res.status(statusCode).json({ error: error.message || 'Failed to fetch orders list' });
  }
});

// GET /api/stats/order-detail/:orderId - Detailed customer journey for a specific order
// FIX (2026-02-04): Attribution Window 쿼리 파라미터 추가
router.get('/order-detail/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { attribution_window } = req.query;
    // Attribution Window 파싱: 30, 60, 90, 또는 'all' (null로 변환)
    let attributionWindowDays = 30; // 기본값
    if (attribution_window) {
      if (attribution_window === 'all') {
        attributionWindowDays = null;
      } else {
        const parsed = parseInt(attribution_window, 10);
        if ([30, 60, 90].includes(parsed)) {
          attributionWindowDays = parsed;
        }
      }
    }
    const result = await ordersService.getOrderDetail(orderId, attributionWindowDays);
    res.json(result);

  } catch (error) {
    console.error('Order detail error:', error);
    const statusCode = error.message === 'Order not found' ? 404 : 500;
    res.status(statusCode).json({ error: error.message || 'Failed to fetch order detail' });
  }
});

module.exports = router;
