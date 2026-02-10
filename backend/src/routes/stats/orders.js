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
// FIX (2026-02-10): matching_mode 쿼리 파라미터 추가 (default/extended)
router.get('/order-detail/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { attribution_window, matching_mode } = req.query;
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
    // Matching Mode 파싱: 기본값 extended (쿠키 + 회원ID + IP+기기+OS 전체 매칭)
    // FIX (2026-02-10): 기본값을 extended로 변경 (3단계 매칭 항상 적용)
    const matchingMode = matching_mode === 'default' ? 'default' : 'extended';
    const result = await ordersService.getOrderDetail(orderId, attributionWindowDays, matchingMode);
    res.json(result);

  } catch (error) {
    console.error('Order detail error:', error);
    const statusCode = error.message === 'Order not found' ? 404 : 500;
    res.status(statusCode).json({ error: error.message || 'Failed to fetch order detail' });
  }
});

module.exports = router;
