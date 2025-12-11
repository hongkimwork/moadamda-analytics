const express = require('express');
const router = express.Router();
const { getClientIp } = require('../services/track/utils');
const eventHandlers = require('../services/track/eventHandlers');

// POST /api/track - Main tracking endpoint
router.post('/track', async (req, res) => {
  try {
    const { site_id, events } = req.body;

    if (!events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'Invalid request: events array required' });
    }

    // Extract client IP once for all events in this request
    const clientIp = getClientIp(req);

    // Process each event
    for (const event of events) {
      await processEvent(event, clientIp);
    }

    res.json({ success: true, processed: events.length });
  } catch (error) {
    console.error('Track error:', error);
    res.status(500).json({ error: 'Failed to process tracking data' });
  }
});

/**
 * Process event by dispatching to appropriate handler
 */
async function processEvent(event, clientIp) {
  const { type } = event;

  switch (type) {
    case 'pageview':
      await eventHandlers.handlePageview(event, clientIp);
      break;
    case 'view_product':
    case 'add_to_cart':
    case 'checkout':
    case 'purchase':
      await eventHandlers.handleEcommerceEvent(event, clientIp);
      break;
    case 'session_end':
      await eventHandlers.handleSessionEnd(event);
      break;
    case 'checkout_attempt':
      await eventHandlers.handleCheckoutAttempt(event, clientIp);
      break;
    case 'heartbeat':
      await eventHandlers.handleHeartbeat(event);
      break;
    case 'tracker_error':
      eventHandlers.handleTrackerError(event);
      break;
    case 'coupon_select':
      await eventHandlers.handleCouponSelect(event, clientIp);
      break;
    default:
      console.warn('Unknown event type:', type);
  }
}


module.exports = router;

