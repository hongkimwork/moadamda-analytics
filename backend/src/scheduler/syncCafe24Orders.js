const cafe24Client = require('../utils/cafe24Client');
const db = require('../utils/database');

/**
 * Cafe24 Order Synchronization Scheduler
 * 
 * Fetches orders from Cafe24 and syncs them to conversions table
 * Extracts visitor_id from order additional options
 * Runs every hour to catch new orders (especially external payment orders like Kakao Pay)
 */

/**
 * Sync orders from Cafe24 to local database
 * 
 * @param {Object} options - Sync options
 * @param {string} options.startDate - Start date (YYYY-MM-DD) or null for last 7 days
 * @param {string} options.endDate - End date (YYYY-MM-DD) or null for today
 * @returns {Promise<{synced: number, skipped: number, errors: number}>}
 */
async function syncOrders(options = {}) {
  const startTime = Date.now();
  let stats = {
    synced: 0,
    skipped: 0,
    errors: 0,
    totalFetched: 0
  };

  try {
    // Default: sync last 7 days
    const startDate = options.startDate || getDateString(-7);
    const endDate = options.endDate || getDateString(0);

    console.log(`[Cafe24 Sync] Starting order sync: ${startDate} to ${endDate}`);

    // Fetch orders from Cafe24
    let allOrders = [];
    let offset = 0;
    const limit = 100; // Cafe24 max limit per request

    // Pagination: fetch all orders
    while (true) {
      const orders = await cafe24Client.getOrders({
        start_date: startDate,
        end_date: endDate,
        limit: limit,
        offset: offset
      });

      if (orders.length === 0) break;

      allOrders = allOrders.concat(orders);
      stats.totalFetched += orders.length;

      console.log(`[Cafe24 Sync] Fetched ${orders.length} orders (offset: ${offset})`);

      if (orders.length < limit) break; // Last page
      offset += limit;
    }

    console.log(`[Cafe24 Sync] Total orders fetched: ${stats.totalFetched}`);

    // DEBUG: Log first order structure to verify embed=items is working
    if (allOrders.length > 0) {
      console.log('[Cafe24 Sync] DEBUG: First order structure:');
      console.log('[Cafe24 Sync] - order_id:', allOrders[0].order_id);
      console.log('[Cafe24 Sync] - has items?', !!allOrders[0].items);
      console.log('[Cafe24 Sync] - items count:', allOrders[0].items ? allOrders[0].items.length : 0);
      if (allOrders[0].items && allOrders[0].items.length > 0) {
        console.log('[Cafe24 Sync] - first item has additional_option_values?', !!allOrders[0].items[0].additional_option_values);
        if (allOrders[0].items[0].additional_option_values) {
          console.log('[Cafe24 Sync] - additional_option_values:', JSON.stringify(allOrders[0].items[0].additional_option_values));
        }
      }
    }

    // Process each order
    for (const order of allOrders) {
      try {
        await processOrder(order);
        stats.synced++;
      } catch (error) {
        console.error(`[Cafe24 Sync] Error processing order ${order.order_id}:`, error.message);
        stats.errors++;
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[Cafe24 Sync] Completed in ${duration}s:`, stats);

    return stats;

  } catch (error) {
    console.error('[Cafe24 Sync] Sync failed:', error.message);
    throw error;
  }
}

/**
 * Process a single order and upsert to conversions table
 * 
 * @param {Object} order - Order object from Cafe24
 */
async function processOrder(order) {
  try {
    // Extract visitor_id from additional options
    const visitorId = cafe24Client.extractVisitorId(order);

    if (!visitorId) {
      console.log(`[Cafe24 Sync] Order ${order.order_id}: No visitor_id found, skipping`);
      return;
    }

    // Check if visitor exists in our database
    const visitorCheck = await db.query(
      'SELECT visitor_id FROM visitors WHERE visitor_id = $1',
      [visitorId]
    );

    if (visitorCheck.rows.length === 0) {
      console.log(`[Cafe24 Sync] Order ${order.order_id}: visitor_id ${visitorId} not found in visitors table, skipping`);
      return;
    }

    // Get visitor's UTM information for attribution
    const visitorUtm = await db.query(
      'SELECT utm_source, utm_medium, utm_campaign, last_visit FROM visitors WHERE visitor_id = $1',
      [visitorId]
    );

    const utm = visitorUtm.rows[0] || {};

    // Get session_id (most recent session for this visitor)
    const sessionResult = await db.query(
      'SELECT session_id FROM sessions WHERE visitor_id = $1 ORDER BY start_time DESC LIMIT 1',
      [visitorId]
    );

    const sessionId = sessionResult.rows.length > 0 ? sessionResult.rows[0].session_id : null;

    // Extract order data
    const orderDate = new Date(order.order_date);
    const totalAmount = parseInt(order.order_price_amount) || 0;
    const finalPayment = parseInt(order.actual_order_amount) || 0;
    const productCount = order.items ? order.items.length : 1;

    // Calculate payment details
    const discountAmount = parseInt(order.discount_amount || 0);
    const mileageUsed = parseInt(order.mileage_spent_amount || 0);
    const shippingFee = parseInt(order.shipping_fee || 0);

    // Upsert into conversions table
    await db.query(`
      INSERT INTO conversions (
        session_id, visitor_id, order_id, total_amount, 
        product_count, timestamp, discount_amount, 
        mileage_used, shipping_fee, final_payment,
        utm_source, utm_campaign
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (order_id) DO UPDATE SET
        visitor_id = EXCLUDED.visitor_id,
        session_id = EXCLUDED.session_id,
        total_amount = EXCLUDED.total_amount,
        product_count = EXCLUDED.product_count,
        discount_amount = EXCLUDED.discount_amount,
        mileage_used = EXCLUDED.mileage_used,
        shipping_fee = EXCLUDED.shipping_fee,
        final_payment = EXCLUDED.final_payment,
        utm_source = EXCLUDED.utm_source,
        utm_campaign = EXCLUDED.utm_campaign
    `, [
      sessionId,
      visitorId,
      order.order_id,
      totalAmount,
      productCount,
      orderDate,
      discountAmount,
      mileageUsed,
      shippingFee,
      finalPayment,
      utm.utm_source || null,
      utm.utm_campaign || null
    ]);

    console.log(`[Cafe24 Sync] ✓ Order ${order.order_id} synced (visitor_id: ${visitorId.substring(0, 8)}...)`);

  } catch (error) {
    console.error(`[Cafe24 Sync] Error processing order:`, error);
    throw error;
  }
}

/**
 * Get date string for N days ago
 * 
 * @param {number} daysAgo - Number of days ago (negative for past, 0 for today)
 * @returns {string} - Date string in YYYY-MM-DD format
 */
function getDateString(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() + daysAgo);
  return date.toISOString().split('T')[0];
}

/**
 * Start the scheduler (runs every hour)
 */
function startScheduler() {
  const intervalHours = 1;
  const intervalMs = intervalHours * 60 * 60 * 1000;

  console.log(`[Cafe24 Sync] Scheduler started (runs every ${intervalHours} hour(s))`);

  // Run immediately on startup
  syncOrders().catch(error => {
    console.error('[Cafe24 Sync] Initial sync failed:', error.message);
  });

  // Run every hour
  setInterval(() => {
    console.log('[Cafe24 Sync] Running scheduled sync...');
    syncOrders().catch(error => {
      console.error('[Cafe24 Sync] Scheduled sync failed:', error.message);
    });
  }, intervalMs);
}

module.exports = {
  syncOrders,
  startScheduler
};

