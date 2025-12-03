/**
 * Moadamda Analytics Tracker v20.4 (v047)
 * Updated: 2025-12-03
 * 
 * DEPLOYMENT INFO:
 * - Production Domain: marketingzon.com
 * - Backend Endpoint: https://marketingzon.com/api/track
 * - Dashboard: https://dashboard.marketingzon.com
 * - SSL: Let's Encrypt (Trusted Certificate)
 * 
 * LATEST UPDATE (v20.4):
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
 * - In-app browser detection & enhanced sending (NEW)
 * - Failed event retry mechanism (NEW)
 * - Coupon select page tracking (NEW)
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
    sessionTimeout: 1800000,  // 30 minutes
    heartbeatInterval: 30000  // 30 seconds (NEW)
  };
  
  let eventQueue = [];
  let visitorId = getOrCreateVisitorId();
  let sessionId = getOrCreateSessionId();
  let heartbeatTimer = null;  // heartbeat timer reference
  let sessionEndSent = false;  // prevent duplicate session_end
  let retryTimer = null;  // NEW: retry timer for failed events
  
  // NEW: Detect in-app browser (Facebook, Instagram, KakaoTalk, Naver, Line, etc.)
  function isInAppBrowser() {
    const ua = navigator.userAgent || '';
    return /FBAN|FBAV|Instagram|Line|KAKAOTALK|NAVER|SamsungBrowser.*CrossApp/i.test(ua);
  }
  
  const IS_IN_APP = isInAppBrowser();
  
  console.log('[MA] Initializing Moadamda Analytics v20.4 (v047)...');
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
      setCookie(CONFIG.cookieName, id, 730); // 2 years
    }
    return id;
  }
  
  // Get or create session ID
  function getOrCreateSessionId() {
    let id = getCookie(CONFIG.sessionCookieName);
    if (!id) {
      id = generateUUID();
      setCookie(CONFIG.sessionCookieName, id, 0.0208); // 30 minutes
    }
    return id;
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
  
  // Fully decode URL-encoded string (handles double/multiple encoding)
  function fullyDecode(str) {
    if (!str) return str;
    let decoded = str;
    let prev;
    // Keep decoding until no more changes (handles multiple encoding layers)
    while (decoded !== prev) {
      prev = decoded;
      try {
        decoded = decodeURIComponent(decoded);
      } catch (e) {
        // If decoding fails, return current state
        break;
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
  
  // NEW: Send heartbeat for session duration tracking
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
  
  // NEW: Start heartbeat timer
  function startHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
    }
    heartbeatTimer = setInterval(sendHeartbeat, CONFIG.heartbeatInterval);
    console.log('[MA] Heartbeat started (interval: ' + CONFIG.heartbeatInterval/1000 + 's)');
  }
  
  // NEW: Stop heartbeat timer
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
    
    const sessionEndEvent = {
      type: 'session_end',
      visitor_id: visitorId,
      session_id: sessionId,
      timestamp: Date.now()
    };
    
    const sent = sendViaBeacon(sessionEndEvent);
    console.log('[MA] Session end event sent:', sent);
  }
  
  // NEW: Setup error logging
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
        sendSessionEnd();
      } else if (document.visibilityState === 'visible') {
        // Page is visible again
        console.log('[MA] Page visible, resuming tracking');
        sessionEndSent = false;  // Reset flag to allow new session_end
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

