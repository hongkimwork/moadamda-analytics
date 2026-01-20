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

/**
 * 봇/크롤러 감지 (카페24 호환)
 * IP 대역 + User-Agent 패턴 기반 필터링
 * 
 * @param {string} ip - 클라이언트 IP 주소
 * @param {string} userAgent - User-Agent 문자열
 * @param {string} browser - 파싱된 브라우저 이름
 * @param {string} os - 파싱된 OS 이름
 * @returns {boolean} 봇 여부
 */
function detectBot(ip, userAgent, browser, os) {
  const ua = (userAgent || '').toLowerCase();
  
  // 1. User-Agent 패턴 기반 봇 감지 (가장 확실한 방법)
  const botPatterns = [
    'facebookexternalhit',  // Meta/Facebook 크롤러
    'facebookcatalog',      // Meta 카탈로그 크롤러
    'applebot',             // Apple 봇
    'googlebot',            // Google 봇
    'bingbot',              // Bing 봇
    'yandexbot',            // Yandex 봇
    'baiduspider',          // Baidu 봇
    'duckduckbot',          // DuckDuckGo 봇
    'slurp',                // Yahoo 봇
    'ia_archiver',          // Alexa 봇
    'mj12bot',              // Majestic 봇
    'semrushbot',           // SEMrush 봇
    'ahrefsbot',            // Ahrefs 봇
    'dotbot',               // OpenSite 봇
    'petalbot',             // Huawei 봇
    'bytespider',           // ByteDance 봇
    'crawler',              // 일반 크롤러
    'spider',               // 일반 스파이더
    'bot/',                 // 봇 시그니처
    'headless',             // 헤드리스 브라우저
    'phantomjs',            // PhantomJS
    'selenium',             // Selenium
    'puppeteer',            // Puppeteer
  ];
  
  for (const pattern of botPatterns) {
    if (ua.includes(pattern)) {
      return true;
    }
  }
  
  // 2. IP 대역 기반 봇 감지 (알려진 크롤러 IP)
  if (ip) {
    // Meta/Facebook IP 대역
    if (ip.startsWith('31.13.') ||      // Meta
        ip.startsWith('69.63.') ||      // Meta
        ip.startsWith('66.220.') ||     // Meta
        ip.startsWith('173.252.') ||    // Meta
        ip.startsWith('157.240.') ||    // Meta
        ip.startsWith('179.60.') ||     // Meta
        // Apple IP 대역
        ip.startsWith('17.') ||         // Apple (전체 17.0.0.0/8)
        // Google IP 대역 (크롤러용)
        ip.startsWith('66.249.') ||     // Googlebot
        ip.startsWith('64.233.') ||     // Google
        ip.startsWith('72.14.') ||      // Google
        ip.startsWith('74.125.') ||     // Google
        // Microsoft/Bing IP 대역
        ip.startsWith('40.77.') ||      // Bingbot
        ip.startsWith('157.55.') ||     // Bingbot
        ip.startsWith('207.46.') ||     // MSNBot
        // 기타 알려진 봇/호스팅 서버
        ip.startsWith('198.64.') ||     // 호스팅 서버
        ip.startsWith('198.55.')) {     // 호스팅 서버
      return true;
    }
  }
  
  // 3. 기존 로직: Unknown 브라우저 + Unknown OS = 봇 의심
  if (browser === 'Unknown' && os === 'Unknown') {
    return true;
  }
  
  return false;
}

module.exports = {
  getClientIp,
  parseBrowserInfo,
  determineReferrerType,
  detectBot
};
