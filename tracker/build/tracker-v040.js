/**
 * Moadamda Analytics Tracker v17.0 (v040)
 * Updated: 2025-10-29
 * 
 * DEPLOYMENT INFO:
 * - Production Domain: moadamda-analytics.co.kr
 * - Backend Endpoint: https://moadamda-analytics.co.kr/api/track
 * - SSL: Let's Encrypt (Trusted Certificate)
 * 
 * LATEST UPDATE (v040):
 * - UPDATED: Production domain with trusted SSL certificate
 * - FIXED: Mixed Content error resolved (HTTPS → HTTPS)
 * - IMPROVED: Browser trust and security
 * 
 * Previous features (v037):
 * - Session end tracking for accurate UTM session duration
 * - Dynamic UTM parameter collection (all utm_* params)
 * - Increased polling attempts to 30 (30 seconds total wait)
 * - DOM parsing fallback for order data
 * - Product tracking with multiple fallback sources
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
    sessionTimeout: 1800000  // 30 minutes
  };
  
  let eventQueue = [];
  let visitorId = getOrCreateVisitorId();
  let sessionId = getOrCreateSessionId();
  
  console.log('[MA] Initializing Moadamda Analytics v13.0...');
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
  
  // Send event immediately (for critical events like pageview, cart, purchase)
  function sendImmediately(event) {
    console.log('[MA] Sending event immediately:', event.type);
    const payload = {
      site_id: CONFIG.siteId,
      events: [event]
    };
    
    // Use fetch instead of sendBeacon to avoid CORS issues
    fetch(CONFIG.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
      mode: 'cors',
      credentials: 'omit'  // Explicitly omit credentials to avoid CORS issues
    })
    .then(response => {
      if (!response.ok) {
        console.error('[MA] Send failed:', response.status, response.statusText);
      } else {
        console.log('[MA] Event sent successfully:', event.type);
      }
    })
    .catch(err => console.error('[MA] Send failed:', err));
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
    
    // Extract ALL UTM parameters (utm_*)
    const urlParams = new URLSearchParams(window.location.search);
    const utmParams = {};
    
    // Collect all parameters that start with 'utm_'
    for (const [key, value] of urlParams.entries()) {
      if (key.startsWith('utm_')) {
        utmParams[key] = value;
      }
    }
    
    // If any UTM parameters exist, add them to data
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
    console.log('[MA] Sending session end event...');
    const sessionEndEvent = {
      type: 'session_end',
      visitor_id: visitorId,
      session_id: sessionId,
      timestamp: Date.now()
    };
    
    const payload = {
      site_id: CONFIG.siteId,
      events: [sessionEndEvent]
    };
    
    // Use sendBeacon for reliability during page unload
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      const sent = navigator.sendBeacon(CONFIG.apiUrl, blob);
      console.log('[MA] Session end event sent:', sent);
    } else {
      // Fallback to fetch with keepalive
      fetch(CONFIG.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(err => console.error('[MA] Session end failed:', err));
    }
  }
  
  // Initialize tracking
  function init() {
    // Track initial pageview
    trackPageView();
    
    // Setup cart tracking
    setupCartTracking();
    
    // Detect purchase completion page
    const url = window.location.href;
    const pathname = window.location.pathname;
    
    if (url.includes('order/order_result.html') || pathname.includes('/order/order_result')) {
      trackPurchase();
    }
    
    // Send session end event when user leaves page
    window.addEventListener('beforeunload', function() {
      sendSessionEnd();
    });
    window.addEventListener('pagehidden', function() {
      sendSessionEnd();
    });
    
    console.log('[MA] Session end tracking initialized');
  }
  
  // Start tracking when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
})();

