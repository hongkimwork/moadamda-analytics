/**
 * Track Service Utils
 * 공통 유틸 함수: IP 추출, 브라우저 파싱, Referrer 판별
 */

/**
 * Extract client IP address (supports proxies like Cloudflare)
 * @param {Object} req - Express request object
 * @returns {string} Client IP address
 */
function getClientIp(req) {
  // Try x-forwarded-for (Cloudflare, Nginx, etc.)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  // Try x-real-ip
  if (req.headers['x-real-ip']) {
    return req.headers['x-real-ip'];
  }
  
  // Fallback to connection remote address
  return req.connection?.remoteAddress 
    || req.socket?.remoteAddress 
    || 'unknown';
}

/**
 * Parse browser and OS from user agent
 * @param {Object} event - Event object with user_agent
 * @returns {Object} { browser, os }
 */
function parseBrowserInfo(event) {
  // Simple user agent parsing (can be enhanced)
  const ua = event.user_agent || '';
  
  let browser = 'Unknown';
  let os = 'Unknown';

  if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edge')) browser = 'Edge';

  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iOS')) os = 'iOS';
  else if (ua.includes('Linux')) os = 'Linux';

  return { browser, os };
}

/**
 * Determine referrer type from referrer URL
 * @param {string} referrer - Referrer URL
 * @returns {string} Referrer type: 'direct', 'search', 'social', 'ad', 'referral'
 */
function determineReferrerType(referrer) {
  if (!referrer || referrer === '') return 'direct';
  
  const ref = referrer.toLowerCase();
  
  if (ref.includes('google')) return 'search';
  if (ref.includes('naver')) return 'search';
  if (ref.includes('daum')) return 'search';
  if (ref.includes('facebook') || ref.includes('instagram')) return 'social';
  if (ref.includes('twitter') || ref.includes('linkedin')) return 'social';
  if (ref.includes('ad') || ref.includes('campaign')) return 'ad';
  
  return 'referral';
}

module.exports = {
  getClientIp,
  parseBrowserInfo,
  determineReferrerType
};
