/**
 * UTM Tracking Service
 * Phase 4.4: Multi-touch attribution을 위한 UTM 세션 트래킹
 */

const db = require('../../utils/database');

/**
 * Track UTM session history for multi-touch attribution
 * @param {Object} params - UTM session parameters
 */
async function trackUtmSession({ 
  session_id, 
  visitor_id, 
  utm_source, 
  utm_medium, 
  utm_campaign, 
  utm_params, 
  url, 
  timestamp 
}) {
  try {
    // Check if there's an existing UTM session for this visitor with same UTM params
    const existing = await db.query(`
      SELECT id, entry_timestamp, pageview_count
      FROM utm_sessions
      WHERE visitor_id = $1 
        AND session_id = $2
        AND utm_source = $3
        AND COALESCE(utm_medium, '') = COALESCE($4, '')
        AND COALESCE(utm_campaign, '') = COALESCE($5, '')
        AND exit_timestamp IS NULL
      ORDER BY entry_timestamp DESC
      LIMIT 1
    `, [visitor_id, session_id, utm_source, utm_medium, utm_campaign]);

    if (existing.rows.length > 0) {
      // Update existing UTM session: increase pageview count and update duration
      const utmSessionId = existing.rows[0].id;
      const entryTime = new Date(existing.rows[0].entry_timestamp);
      const durationSeconds = Math.floor((timestamp - entryTime) / 1000);

      await db.query(`
        UPDATE utm_sessions
        SET 
          exit_timestamp = $1,
          duration_seconds = $2,
          pageview_count = pageview_count + 1,
          utm_params = $4
        WHERE id = $3
      `, [timestamp, durationSeconds, utmSessionId, utm_params ? JSON.stringify(utm_params) : null]);
    } else {
      // Create new UTM session record
      // Calculate sequence order for this visitor
      const sequenceResult = await db.query(`
        SELECT COALESCE(MAX(sequence_order), 0) + 1 as next_order
        FROM utm_sessions
        WHERE visitor_id = $1
      `, [visitor_id]);

      const sequenceOrder = sequenceResult.rows[0].next_order;

      await db.query(`
        INSERT INTO utm_sessions (
          session_id, visitor_id, utm_source, utm_medium, utm_campaign,
          utm_params, page_url, entry_timestamp, sequence_order
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [session_id, visitor_id, utm_source, utm_medium, utm_campaign, 
          utm_params ? JSON.stringify(utm_params) : null, url, timestamp, sequenceOrder]);
    }
  } catch (error) {
    console.error('Error tracking UTM session:', error);
    // Don't throw error - UTM tracking failure shouldn't break pageview tracking
  }
}

/**
 * Close all open UTM sessions for a visitor/session
 * Used by session_end and heartbeat events
 */
async function closeUtmSessions(visitor_id, session_id, endTime) {
  try {
    await db.query(`
      UPDATE utm_sessions
      SET 
        exit_timestamp = $1,
        duration_seconds = EXTRACT(EPOCH FROM ($1 - entry_timestamp))::INTEGER
      WHERE visitor_id = $2
        AND session_id = $3
        AND exit_timestamp IS NULL
    `, [endTime, visitor_id, session_id]);
  } catch (error) {
    console.error('Error closing UTM sessions:', error);
  }
}

/**
 * Update UTM session duration (for heartbeat)
 * Same as closeUtmSessions but semantically different purpose
 */
async function updateUtmSessionDuration(visitor_id, session_id, currentTime) {
  return closeUtmSessions(visitor_id, session_id, currentTime);
}

module.exports = {
  trackUtmSession,
  closeUtmSessions,
  updateUtmSessionDuration
};
