/**
 * Moadamda Analytics Tracker v26.0 (v054)
 * Updated: 2026-02-02
 * 
 * DEPLOYMENT INFO:
 * - Production Domain: marketingzon.com
 * - Backend Endpoint: https://marketingzon.com/api/track
 * - Dashboard: https://dashboard.marketingzon.com
 * - SSL: Let's Encrypt (Trusted Certificate)
 * 
 * LATEST UPDATE (v26.0):
 * - FIX: 빈 utm_content 복구 로직 추가
 *   - Meta 광고에서 일부 URL에 utm_content가 누락되어 전송되는 문제
 *   - utm_id를 기반으로 이전에 수집한 utm_content를 캐싱
 *   - 빈 utm_content가 들어오면 같은 utm_id의 캐시된 값으로 복구
 * 
 * PREVIOUS (v25.0):
 * - FIX: UTM 파라미터에서 + 문자를 공백으로 변환
 *   - URL 쿼리 스트링에서 +는 공백을 의미함 (application/x-www-form-urlencoded)
 *   - decodeURIComponent는 +를 공백으로 변환하지 않아서 직접 처리
 *   - "77%+그립" → "77% 그립" 으로 올바르게 디코딩
 * 
 * PREVIOUS (v24.0):
 * - FIX: UTM 파라미터 파싱 시 % 문자 인코딩 오류 처리
 *   - 메타 광고명에 "77% 할인" 같은 % 문자가 있으면 URL 디코딩 실패
 *   - fixMalformedPercent() 함수 추가: %XX 형식이 아닌 %를 %25로 치환
 * 
 * PREVIOUS (v23.0):
 * - CHANGED: 세션 타임아웃 60분 → 2시간 (카페24 애널리틱스 공식 기준)
 * - CHANGED: 방문자 쿠키 2년 → 1년 (카페24 순방문자 기준)
 * - KEPT: 슬라이딩 윈도우 - 활동 시 세션 쿠키 2시간 연장 (마지막 활동 기준)
 * 
 * PREVIOUS (v22.0):
 * - 세션 타임아웃 2시간 → 60분 (카페24 애널리틱스 호환)
 * 
 * PREVIOUS (v20.5):
 * - ADDED: 스크롤 깊이 추적 (scroll_depth) - 페이지별 최대 스크롤 위치(px) 수집
 * 
 * PREVIOUS (v20.4):
 * - ADDED: 인앱 브라우저 감지 (FB/IG/카카오/네이버/라인)
 * - ADDED: 인앱 브라우저 강화 전송 (sendBeacon + fetch 동시)
 * - ADDED: sendBeacon 실패 시 fetch fallback
 * - ADDED: 실패 이벤트 sessionStorage 저장 및 재시도
 * - ADDED: 쿠폰 선택 페이지 추적 (coupon_select)
 * 
 * PREVIOUS (v20.3):
 * - ADDED: visibilitychange 이벤트 - 앱 전환 시 데이터 전송 보장
 * - ADDED: checkout_attempt 이벤트 - 결제 시도 추적 (주문서 페이지)
 * - ADDED: heartbeat 기능 - 30초마다 체류시간 업데이트
 * - ADDED: 에러 로깅 - 트래커 오류 감지 및 보고
 * 
 * PREVIOUS (v046-fix):
 * - FIX: 로그인 페이지 리다이렉트 시 UTM 파라미터 유실 문제 해결
 * - ADDED: 세션 스토리지 기반 UTM 파라미터 유지 로직
 * 
 * Current features:
 * - Pageview tracking with UTM parameters
 * - Purchase tracking (order completion page only)
 * - Cart add tracking
 * - Session end tracking for UTM session duration
 * - Dynamic UTM parameter collection (all utm_* params)
 * - UTM persistence across redirects (login page, etc.)
 * - Checkout attempt tracking
 * - Heartbeat for accurate session duration
 * - Error logging
 * - In-app browser detection & enhanced sending
 * - Failed event retry mechanism
 * - Coupon select page tracking
 * - Scroll depth tracking (NEW)
 */
(function() {
  'use strict';
  
  // CRITICAL: Prevent multiple script instances from initializing
  if (window._maTrackerInitialized) {
    console.log('[MA] Tracker already initialized, skipping duplicate initialization');
    return;
  }
  window._maTrackerInitialized = true;
  
  // Configuration
  const CONFIG = {
    apiUrl: 'https://moadamda-analytics.co.kr/api/track',
    siteId: 'moadamda',
    cookieName: '_ma_id',
    sessionCookieName: '_ma_ses',
    batchInterval: 180000,  // 3 minutes
    sessionTimeout: 7200000,  // 2 hours (Cafe24 Analytics official standard)
    heartbeatInterval: 30000  // 30 seconds
  };
  
  let eventQueue = [];
  let visitorId = getOrCreateVisitorId();
  let sessionId = getOrCreateSessionId();
  let heartbeatTimer = null;  // heartbeat timer reference
  let sessionEndSent = false;  // prevent duplicate session_end
  let retryTimer = null;  // retry timer for failed events
  
  // Scroll depth tracking variables
  let maxScrollY = 0;  // Maximum scroll position reached (px)
  let scrollDepthSent = false;  // Prevent duplicate scroll_depth events
  let lastScrollTime = 0;  // For throttling scroll events
  
  // NEW: Detect in-app browser (Facebook, Instagram, KakaoTalk, Naver, Line, etc.)
  function isInAppBrowser() {
    const ua = navigator.userAgent || '';
    return /FBAN|FBAV|Instagram|Line|KAKAOTALK|NAVER|SamsungBrowser.*CrossApp/i.test(ua);
  }
  
  const IS_IN_APP = isInAppBrowser();
  
  console.log('[MA] Initializing Moadamda Analytics v26.0 (v054)...');
  console.log('[MA] In-app browser detected:', IS_IN_APP);
  console.log('[MA] API URL:', CONFIG.apiUrl);
  console.log('[MA] Visitor ID:', visitorId);
  console.log('[MA] Session ID:', sessionId);
  
  // Generate UUID v4
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  // Cookie utilities
  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
  }
  
  function setCookie(name, value, days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = days ? `; expires=${date.toUTCString()}` : '';
    document.cookie = `${name}=${value}${expires}; path=/; SameSite=Lax`;
  }
  
  // Get or create visitor ID
  function getOrCreateVisitorId() {
    let id = getCookie(CONFIG.cookieName);
    if (!id) {
      id = generateUUID();
      setCookie(CONFIG.cookieName, id, 365); // 1 year (Cafe24 standard)
    }
    return id;
  }
  
  // Get or create session ID (2 hours = 0.0833 days for Cafe24 Analytics official standard)
  function getOrCreateSessionId() {
    let id = getCookie(CONFIG.sessionCookieName);
    if (!id) {
      id = generateUUID();
      setCookie(CONFIG.sessionCookieName, id, 0.0833); // 2 hours (Cafe24 standard)
    }
    return id;
  }
  
  // Refresh session cookie (sliding window - extends session on activity)
  // Called on every event to implement Cafe24 Analytics behavior:
  // "마지막 활동으로부터 2시간" (2 hours from last activity - Cafe24 standard)
  function refreshSessionCookie() {
    setCookie(CONFIG.sessionCookieName, sessionId, 0.0833); // 2 hours from now (Cafe24 standard)
  }
  
  // Detect device type
  function getDeviceType() {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
      return 'tablet';
    }
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
      return 'mobile';
    }
    return 'pc';
  }
  
  // Fix malformed percent encoding (e.g., "77%" should be "77%25")
  // Meta ads sometimes have unencoded % in ad names like "77% 할인"
  function fixMalformedPercent(str) {
    if (!str) return str;
    // Replace % that is NOT followed by two hex digits with %25
    // Pattern: % followed by anything that's not [0-9A-Fa-f]{2}
    return str.replace(/%(?![0-9A-Fa-f]{2})/g, '%25');
  }
  
  // Fully decode URL-encoded string (handles double/multiple encoding)
  // FIX (v052): Handle malformed percent encoding from ad platforms
  // FIX (v053): Handle + as space (URL query string standard)
  function fullyDecode(str) {
    if (!str) return str;
    
    // First, fix any malformed percent encoding
    let fixed = fixMalformedPercent(str);
    
    // Replace + with space BEFORE decoding
    // URL query strings use + for space (application/x-www-form-urlencoded)
    // decodeURIComponent does NOT convert + to space, only %20
    fixed = fixed.replace(/\+/g, ' ');
    
    let decoded = fixed;
    let prev;
    // Keep decoding until no more changes (handles multiple encoding layers)
    while (decoded !== prev) {
      prev = decoded;
      try {
        decoded = decodeURIComponent(decoded);
      } catch (e) {
        // If decoding still fails, try one more fix and decode
        try {
          decoded = decodeURIComponent(fixMalformedPercent(decoded));
        } catch (e2) {
          // If all attempts fail, return current state
          console.warn('[MA] URL decode failed, using raw value:', str);
          break;
        }
      }
    }
    return decoded;
  }
  
  // UTM Session Storage utilities (to persist UTM across redirects like login page)
  const UTM_STORAGE_KEY = '_ma_utm_params';
  
  function saveUtmToStorage(utmParams) {
    try {
      if (Object.keys(utmParams).length > 0) {
        sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utmParams));
        console.log('[MA] UTM params saved to storage:', utmParams);
      }
    } catch (e) {
      // sessionStorage not available
    }
  }
  
  function getUtmFromStorage() {
    try {
      const stored = sessionStorage.getItem(UTM_STORAGE_KEY);
      if (stored) {
        console.log('[MA] UTM params restored from storage');
        return JSON.parse(stored);
      }
      return null;
    } catch (e) {
      return null;
    }
  }
  
  // NEW (v054): UTM Content Cache - utm_id를 기반으로 utm_content 캐싱
  // Meta 광고에서 일부 URL에 utm_content가 누락되어 전송되는 문제 해결
  const UTM_CONTENT_CACHE_KEY = '_ma_utm_content_cache';
  
  // utm_id → utm_content 매핑을 localStorage에 저장
  function saveUtmContentToCache(utmId, utmContent) {
    if (!utmId || !utmContent) return;
    try {
      const cache = JSON.parse(localStorage.getItem(UTM_CONTENT_CACHE_KEY) || '{}');
      cache[utmId] = utmContent;
      // 캐시 크기 제한 (최대 50개, 오래된 것부터 삭제)
      const keys = Object.keys(cache);
      if (keys.length > 50) {
        delete cache[keys[0]];
      }
      localStorage.setItem(UTM_CONTENT_CACHE_KEY, JSON.stringify(cache));
      console.log('[MA] utm_content cached for utm_id:', utmId);
    } catch (e) {
      // localStorage not available
    }
  }
  
  // utm_id로 캐시된 utm_content 조회
  function getUtmContentFromCache(utmId) {
    if (!utmId) return null;
    try {
      const cache = JSON.parse(localStorage.getItem(UTM_CONTENT_CACHE_KEY) || '{}');
      return cache[utmId] || null;
    } catch (e) {
      return null;
    }
  }
  
  // NEW: Failed events storage key
  const FAILED_EVENTS_KEY = '_ma_failed_events';
  
  // NEW: Save failed event to sessionStorage for retry
  function saveFailedEvent(event) {
    try {
      const failed = JSON.parse(sessionStorage.getItem(FAILED_EVENTS_KEY) || '[]');
      // Avoid duplicates and limit to 10 events
      const exists = failed.some(e => e.type === event.type && e.timestamp === event.timestamp);
      if (!exists) {
        failed.push(event);
        // Keep only last 10 events to prevent storage overflow
        const trimmed = failed.slice(-10);
        sessionStorage.setItem(FAILED_EVENTS_KEY, JSON.stringify(trimmed));
        console.log('[MA] Failed event saved for retry:', event.type);
      }
    } catch (e) {
      // sessionStorage not available
    }
  }
  
  // NEW: Get failed events from sessionStorage
  function getFailedEvents() {
    try {
      return JSON.parse(sessionStorage.getItem(FAILED_EVENTS_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }
  
  // NEW: Clear failed events after successful retry
  function clearFailedEvents() {
    try {
      sessionStorage.removeItem(FAILED_EVENTS_KEY);
    } catch (e) {}
  }
  
  // NEW: Retry failed events
  function retryFailedEvents() {
    const failed = getFailedEvents();
    if (failed.length === 0) return;
    
    console.log('[MA] Retrying', failed.length, 'failed events...');
    
    const payload = {
      site_id: CONFIG.siteId,
      events: failed
    };
    
    fetch(CONFIG.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
      mode: 'cors',
      credentials: 'omit'
    })
    .then(response => {
      if (response.ok) {
        clearFailedEvents();
        console.log('[MA] Failed events retry successful');
      }
    })
    .catch(() => {
      console.log('[MA] Failed events retry failed, will try again later');
    });
  }
  
  // Send event immediately (for critical events like pageview, cart, purchase)
  // Enhanced for in-app browsers: uses both sendBeacon AND fetch for reliability
  function sendImmediately(event) {
    // Sliding window: refresh session cookie on every activity (Cafe24 Analytics compatible)
    refreshSessionCookie();
    
    console.log('[MA] Sending event immediately:', event.type);
    const payload = {
      site_id: CONFIG.siteId,
      events: [event]
    };
    
    // In-app browser: use BOTH sendBeacon and fetch for maximum reliability
    if (IS_IN_APP) {
      console.log('[MA] In-app browser detected, using dual send strategy');
      
      // Try sendBeacon first (works better during page transitions)
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon(CONFIG.apiUrl, blob);
      }
      
      // Also send via fetch as backup
      fetch(CONFIG.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
        mode: 'cors',
        credentials: 'omit'
      })
      .then(response => {
        if (response.ok) {
          console.log('[MA] Event sent successfully (in-app):', event.type);
        }
      })
      .catch(err => {
        console.error('[MA] In-app send failed:', err);
        saveFailedEvent(event);
      });
      
      return;
    }
    
    // Normal browser: use fetch with fallback
    fetch(CONFIG.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
      mode: 'cors',
      credentials: 'omit'
    })
    .then(response => {
      if (!response.ok) {
        console.error('[MA] Send failed:', response.status, response.statusText);
        saveFailedEvent(event);
      } else {
        console.log('[MA] Event sent successfully:', event.type);
      }
    })
    .catch(err => {
      console.error('[MA] Send failed:', err);
      saveFailedEvent(event);
    });
  }
  
  // Send event via sendBeacon with fetch fallback (for page unload scenarios)
  function sendViaBeacon(event) {
    // Sliding window: refresh session cookie on every activity (Cafe24 Analytics compatible)
    refreshSessionCookie();
    
    const payload = {
      site_id: CONFIG.siteId,
      events: [event]
    };
    
    // Try sendBeacon first
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      const sent = navigator.sendBeacon(CONFIG.apiUrl, blob);
      if (sent) return true;
    }
    
    // Fallback to fetch with keepalive (works during page unload in most browsers)
    try {
      fetch(CONFIG.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
        mode: 'cors',
        credentials: 'omit'
      });
      return true;
    } catch (e) {
      // Save for retry on next page load
      saveFailedEvent(event);
      return false;
    }
  }
  
  // Track pageview
  function trackPageView() {
    const data = {
      type: 'pageview',
      visitor_id: visitorId,
      session_id: sessionId,
      url: window.location.href,
      title: document.title,
      referrer: document.referrer,
      timestamp: new Date().toISOString(),
      screen_width: window.screen.width,
      screen_height: window.screen.height,
      device_type: getDeviceType(),
      user_agent: navigator.userAgent
    };
    
    // Extract ALL UTM parameters (utm_*) from current URL
    const urlParams = new URLSearchParams(window.location.search);
    let utmParams = {};
    
    // Collect all parameters that start with 'utm_'
    // Use fullyDecode to handle double/multiple URL encoding from ad platforms
    for (const [key, value] of urlParams.entries()) {
      if (key.startsWith('utm_')) {
        utmParams[key] = fullyDecode(value);
      }
    }
    
    // UTM Persistence Logic: Handle redirects (e.g., login page)
    // If URL has UTM params, save them to sessionStorage for later use
    // If URL has no UTM params, try to restore from sessionStorage
    if (Object.keys(utmParams).length > 0) {
      // URL has UTM params - save to storage
      saveUtmToStorage(utmParams);
    } else {
      // URL has no UTM params - try to restore from storage
      const storedUtm = getUtmFromStorage();
      if (storedUtm) {
        utmParams = storedUtm;
      }
    }
    
    // NEW (v054): 빈 utm_content 복구 로직
    // Meta 광고에서 일부 URL에 utm_content가 누락되어 전송되는 경우
    // 같은 utm_id의 이전에 캐시된 utm_content로 복구
    if (utmParams.utm_id) {
      if (!utmParams.utm_content || utmParams.utm_content === '') {
        // utm_content가 빈 문자열이면 캐시에서 복구 시도
        const cachedContent = getUtmContentFromCache(utmParams.utm_id);
        if (cachedContent) {
          utmParams.utm_content = cachedContent;
          console.log('[MA] Empty utm_content recovered from cache:', cachedContent);
        }
      } else {
        // utm_content가 있으면 캐시에 저장 (향후 복구용)
        saveUtmContentToCache(utmParams.utm_id, utmParams.utm_content);
      }
    }
    
    // If any UTM parameters exist (from URL or storage), add them to data
    if (Object.keys(utmParams).length > 0) {
      // Keep backward compatibility: send basic 3 UTM params separately
      data.utm_source = utmParams.utm_source || '';
      data.utm_medium = utmParams.utm_medium || '';
      data.utm_campaign = utmParams.utm_campaign || '';
      
      // Send all UTM params as JSON object for dynamic support
      data.utm_params = utmParams;
    }
    
    sendImmediately(data);
    console.log('[MA] Pageview tracked and sent immediately');
  }
  
  // Track checkout attempt (when user enters order form page)
  function trackCheckoutAttempt() {
    const checkoutEvent = {
      type: 'checkout_attempt',
      visitor_id: visitorId,
      session_id: sessionId,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      referrer: document.referrer
    };
    
    sendImmediately(checkoutEvent);
    console.log('[MA] Checkout attempt tracked');
  }
  
  // NEW: Track coupon select page (when user enters coupon selection page)
  function trackCouponSelect() {
    const couponEvent = {
      type: 'coupon_select',
      visitor_id: visitorId,
      session_id: sessionId,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      referrer: document.referrer
    };
    
    sendImmediately(couponEvent);
    console.log('[MA] Coupon select tracked');
  }
  
  // Send heartbeat for session duration tracking
  function sendHeartbeat() {
    const heartbeatEvent = {
      type: 'heartbeat',
      visitor_id: visitorId,
      session_id: sessionId,
      timestamp: Date.now()
    };
    
    // Use sendBeacon for heartbeat (lightweight, non-blocking)
    const sent = sendViaBeacon(heartbeatEvent);
    if (sent) {
      console.log('[MA] Heartbeat sent');
    }
  }
  
  // Start heartbeat timer
  function startHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
    }
    heartbeatTimer = setInterval(sendHeartbeat, CONFIG.heartbeatInterval);
    console.log('[MA] Heartbeat started (interval: ' + CONFIG.heartbeatInterval/1000 + 's)');
  }
  
  // Stop heartbeat timer
  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
      console.log('[MA] Heartbeat stopped');
    }
  }
  
  // Parse order data from DOM (fallback method)
  function parseOrderFromDOM() {
    try {
      const bodyText = document.body.innerText;
      
      // Extract order number
      const orderNumberMatch = bodyText.match(/주문번호[\s\t]*([0-9\-]+)/);
      const orderNumber = orderNumberMatch ? orderNumberMatch[1] : null;
      
      // Extract payment amount
      const priceMatch = bodyText.match(/결제금액[\s\t]*([\d,]+)원/);
      const paymentAmount = priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : 0;
      
      // Extract product name
      const productMatch = bodyText.match(/주문상품[\s\S]*?\[([^\]]+)\]/);
      const productName = productMatch ? productMatch[1] : '';
      
      if (!orderNumber) {
        console.warn('[MA] Could not extract order number from DOM');
        return null;
      }
      
      console.log('[MA] Extracted from DOM:', { orderNumber, paymentAmount, productName });
      
      return {
        order_id: orderNumber,
        final_payment: paymentAmount,
        total_amount: paymentAmount,
        product_name: productName,
        product_count: 1
      };
    } catch (error) {
      console.error('[MA] DOM parsing error:', error);
      return null;
    }
  }
  
  // Track purchase (polling for Cafe24 global object with DOM fallback)
  function trackPurchase() {
    let attempts = 0;
    const maxAttempts = 30; // Increased from 10 to 30
    const interval = 1000; // Increased from 500ms to 1000ms (total 30 seconds)
    
    console.log('[MA] Starting purchase tracking (max wait: 30 seconds)...');
    
    const pollForOrderData = setInterval(() => {
      attempts++;
      
      // Try Cafe24 global object first
      if (typeof window.EC_FRONT_EXTERNAL_SCRIPT_VARIABLE_DATA !== 'undefined' && 
          window.EC_FRONT_EXTERNAL_SCRIPT_VARIABLE_DATA.order_id) {
        clearInterval(pollForOrderData);
        
        console.log('[MA] Found EC_FRONT_EXTERNAL_SCRIPT_VARIABLE_DATA after', attempts, 'attempts');
        const orderData = window.EC_FRONT_EXTERNAL_SCRIPT_VARIABLE_DATA;
        
        console.log('[MA] Order data:', orderData);
        
        const purchaseEvent = {
          type: 'purchase',
          visitor_id: visitorId,
          session_id: sessionId,
          timestamp: new Date().toISOString(),
          order_id: String(orderData.order_id),
          total_amount: parseInt(orderData.payed_amount) || 0,
          final_payment: parseInt(orderData.payed_amount) || 0,
          product_count: orderData.order_product ? orderData.order_product.length : 1,
          product_id: orderData.order_product && orderData.order_product[0] ? String(orderData.order_product[0].product_no || '') : '',
          product_name: orderData.order_product && orderData.order_product[0] ? String(orderData.order_product[0].product_name || '') : '',
          product_price: orderData.order_product && orderData.order_product[0] ? parseInt(orderData.order_product[0].product_price || 0) : 0,
          discount_amount: 0,
          mileage_used: 0,
          shipping_fee: parseInt(orderData.total_basic_ship_fee) || 0,
          url: window.location.href
        };
        
        sendImmediately(purchaseEvent);
        console.log('[MA] Purchase event sent (Cafe24 object)');
        
      } else if (attempts >= maxAttempts) {
        // Max attempts reached - try DOM fallback
        clearInterval(pollForOrderData);
        console.warn('[MA] Cafe24 object not found after 30 seconds, trying DOM fallback...');
        
        const domData = parseOrderFromDOM();
        
        if (domData) {
          const purchaseEvent = {
            type: 'purchase',
            visitor_id: visitorId,
            session_id: sessionId,
            timestamp: new Date().toISOString(),
            order_id: domData.order_id,
            total_amount: domData.total_amount,
            final_payment: domData.final_payment,
            product_count: domData.product_count,
            product_id: '',
            product_name: domData.product_name,
            product_price: domData.final_payment,
            discount_amount: 0,
            mileage_used: 0,
            shipping_fee: 0,
            url: window.location.href
          };
          
          sendImmediately(purchaseEvent);
          console.log('[MA] Purchase event sent (DOM fallback)');
        } else {
          console.error('[MA] Purchase tracking failed: No order data available');
        }
      } else {
        // Still trying...
        if (attempts % 5 === 0) {
          console.log('[MA] Purchase tracking attempt', attempts, '/', maxAttempts);
        }
      }
    }, interval);
  }
  
  // Setup cart tracking
  function setupCartTracking() {
    console.log('[MA] Setting up cart tracking...');
    
    // Method 1: Intercept Cafe24 product_submit function
    if (typeof product_submit === 'function') {
      const originalSubmit = product_submit;
      window.product_submit = function() {
        setTimeout(() => handleCartAdd(), 100);
        return originalSubmit.apply(this, arguments);
      };
      console.log('[MA] product_submit interceptor installed');
    }
    
    // Method 2: Monitor jQuery AJAX calls
    if (typeof $ !== 'undefined' && $.ajaxSetup) {
      $(document).ajaxComplete(function(event, xhr, settings) {
        if (settings.url && settings.url.includes('/exec/front/order/basket/')) {
          setTimeout(() => handleCartAdd(), 200);
        }
      });
      console.log('[MA] jQuery AJAX monitor installed');
    }
  }
  
  // Handle cart add event
  function handleCartAdd() {
    const productData = extractProductData();
    
    if (!productData.product_id) {
      console.warn('[MA] Cannot track cart add: No product ID found');
      return;
    }
    
    // Deduplicate cart events
    const lastEvent = getLastCartEvent();
    const now = Date.now();
    
    if (lastEvent.productId === productData.product_id && 
        (now - lastEvent.timestamp) < 2000) {
      console.log('[MA] Duplicate cart event ignored (within 2 seconds)');
      return;
    }
    
    // Update last cart event
    setLastCartEvent(productData.product_id, now);
    
    const cartEvent = {
      type: 'add_to_cart',
      visitor_id: visitorId,
      session_id: sessionId,
      timestamp: new Date().toISOString(),
      product_id: productData.product_id,
      product_name: productData.product_name,
      product_price: productData.product_price,
      quantity: 1,
      url: window.location.href
    };
    
    sendImmediately(cartEvent);
    console.log('[MA] Cart add event sent');
  }
  
  // Extract product data from page
  function extractProductData() {
    let productId = '';
    let productName = '';
    let productPrice = 0;
    
    // Try multiple sources for product ID
    if (typeof iProductNo !== 'undefined') {
      productId = String(iProductNo);
    } else if (document.getElementById('ifdo_detail_product_no')) {
      productId = document.getElementById('ifdo_detail_product_no').value;
    } else {
      const urlMatch = window.location.href.match(/product_no=(\d+)/);
      if (urlMatch) productId = urlMatch[1];
    }
    
    // Try multiple sources for product name
    if (typeof product_name !== 'undefined') {
      productName = product_name;
    } else if (document.getElementById('ifdo_detail_product_name')) {
      productName = document.getElementById('ifdo_detail_product_name').value;
    } else {
      const nameEl = document.querySelector('.prdDetailInfoSubject, h3.tit_prd');
      if (nameEl) productName = nameEl.textContent.trim();
    }
    
    // Try multiple sources for product price
    if (typeof product_sale_price !== 'undefined') {
      productPrice = parseInt(product_sale_price);
    } else if (typeof product_price !== 'undefined') {
      productPrice = parseInt(product_price);
    } else if (document.getElementById('ifdo_detail_product_price')) {
      productPrice = parseInt(document.getElementById('ifdo_detail_product_price').value);
    } else {
      const priceEl = document.querySelector('.prdDetailInfoPrice strong, .price strong');
      if (priceEl) {
        productPrice = parseInt(priceEl.textContent.replace(/[^0-9]/g, ''));
      }
    }
    
    return { product_id: productId, product_name: productName, product_price: productPrice };
  }
  
  // Deduplicate cart events
  function getLastCartEvent() {
    try {
      const stored = sessionStorage.getItem('_maLastCartEvent');
      return stored ? JSON.parse(stored) : { productId: null, timestamp: 0 };
    } catch (e) {
      return { productId: null, timestamp: 0 };
    }
  }
  
  function setLastCartEvent(productId, timestamp) {
    try {
      sessionStorage.setItem('_maLastCartEvent', JSON.stringify({ productId, timestamp }));
    } catch (e) {
      console.warn('[MA] Could not save last cart event');
    }
  }
  
  // Send session end event (for UTM session tracking)
  function sendSessionEnd() {
    // Prevent duplicate session_end events
    if (sessionEndSent) {
      console.log('[MA] Session end already sent, skipping');
      return;
    }
    sessionEndSent = true;
    
    console.log('[MA] Sending session end event...');
    stopHeartbeat();  // Stop heartbeat when session ends
    
    // Send scroll depth before session end
    sendScrollDepth();
    
    const sessionEndEvent = {
      type: 'session_end',
      visitor_id: visitorId,
      session_id: sessionId,
      timestamp: Date.now()
    };
    
    const sent = sendViaBeacon(sessionEndEvent);
    console.log('[MA] Session end event sent:', sent);
  }
  
  // =====================================================
  // SCROLL DEPTH TRACKING
  // =====================================================
  
  // Get current scroll position (max of scrollY and page height that's been scrolled)
  function getCurrentScrollY() {
    return window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
  }
  
  // Get total document height
  function getDocumentHeight() {
    return Math.max(
      document.body.scrollHeight || 0,
      document.documentElement.scrollHeight || 0,
      document.body.offsetHeight || 0,
      document.documentElement.offsetHeight || 0
    );
  }
  
  // Get viewport height
  function getViewportHeight() {
    return window.innerHeight || document.documentElement.clientHeight || 0;
  }
  
  // Handle scroll event (throttled)
  function handleScroll() {
    const now = Date.now();
    // Throttle: only process every 100ms
    if (now - lastScrollTime < 100) return;
    lastScrollTime = now;
    
    const currentScroll = getCurrentScrollY();
    if (currentScroll > maxScrollY) {
      maxScrollY = currentScroll;
    }
  }
  
  // Send scroll depth event
  function sendScrollDepth() {
    // Prevent duplicate sends
    if (scrollDepthSent) return;
    
    // Only send if user has scrolled at least a little
    if (maxScrollY === 0) return;
    
    scrollDepthSent = true;
    
    const documentHeight = getDocumentHeight();
    const viewportHeight = getViewportHeight();
    
    const scrollDepthEvent = {
      type: 'scroll_depth',
      visitor_id: visitorId,
      session_id: sessionId,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      max_scroll_px: maxScrollY,
      document_height: documentHeight,
      viewport_height: viewportHeight
    };
    
    const sent = sendViaBeacon(scrollDepthEvent);
    console.log('[MA] Scroll depth sent:', maxScrollY, 'px /', documentHeight, 'px total');
    return sent;
  }
  
  // Setup scroll tracking
  function setupScrollTracking() {
    // Add scroll event listener (passive for better performance)
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Also track initial scroll position (in case page loads scrolled)
    maxScrollY = getCurrentScrollY();
    
    console.log('[MA] Scroll depth tracking initialized');
  }
  
  // Setup error logging
  function setupErrorLogging() {
    window.addEventListener('error', function(event) {
      // Only log errors from our tracker or related scripts
      const errorData = {
        type: 'tracker_error',
        visitor_id: visitorId,
        session_id: sessionId,
        timestamp: new Date().toISOString(),
        message: event.message || 'Unknown error',
        filename: event.filename || '',
        lineno: event.lineno || 0,
        colno: event.colno || 0
      };
      
      // Send via beacon (non-blocking)
      sendViaBeacon(errorData);
      console.error('[MA] Error logged:', errorData.message);
    });
    
    console.log('[MA] Error logging initialized');
  }
  
  // Initialize tracking
  function init() {
    // Setup error logging first
    setupErrorLogging();
    
    // NEW: Retry any failed events from previous page loads
    retryFailedEvents();
    
    // Track initial pageview
    trackPageView();
    
    // Setup cart tracking
    setupCartTracking();
    
    // Setup scroll depth tracking
    setupScrollTracking();
    
    // Start heartbeat for session duration tracking
    startHeartbeat();
    
    // Detect purchase completion page
    const url = window.location.href;
    const pathname = window.location.pathname;
    
    if (url.includes('order/order_result.html') || pathname.includes('/order/order_result')) {
      trackPurchase();
    }
    
    // Detect checkout attempt (order form page)
    if (url.includes('/order/orderform.html') || pathname.includes('/order/orderform')) {
      trackCheckoutAttempt();
    }
    
    // NEW: Detect coupon select page
    if (url.includes('/coupon/coupon_select.html') || pathname.includes('/coupon/coupon_select')) {
      trackCouponSelect();
    }
    
    // Send session end event when user leaves page
    window.addEventListener('beforeunload', function() {
      sendSessionEnd();
    });
    window.addEventListener('pagehide', function() {
      sendSessionEnd();
    });
    
    // Handle visibility change (app switching, tab switching)
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'hidden') {
        // Page is hidden (user switched to another app/tab)
        console.log('[MA] Page hidden, sending session data');
        stopHeartbeat();
        sendScrollDepth();  // Send scroll depth before session ends
        sendSessionEnd();
      } else if (document.visibilityState === 'visible') {
        // Page is visible again
        console.log('[MA] Page visible, resuming tracking');
        sessionEndSent = false;  // Reset flag to allow new session_end
        scrollDepthSent = false;  // Reset scroll depth flag
        startHeartbeat();
        // Also retry failed events when page becomes visible
        retryFailedEvents();
      }
    });
    
    // NEW: Set up periodic retry for failed events (every 30 seconds)
    retryTimer = setInterval(retryFailedEvents, 30000);
    
    console.log('[MA] Session end tracking initialized');
    console.log('[MA] Visibility change tracking initialized');
    if (IS_IN_APP) {
      console.log('[MA] In-app browser mode: enhanced sending enabled');
    }
  }
  
  // Start tracking when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
})();
