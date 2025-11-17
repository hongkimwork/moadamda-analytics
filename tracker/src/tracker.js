/**
 * Moadamda Analytics Tracker
 * Phase 1: Basic pageview and visitor tracking
 */
(function() {
  'use strict';
  
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
  
  // Track pageview
  function trackPageView() {
    const data = {
      type: 'pageview',
      visitor_id: visitorId,
      session_id: sessionId,
      url: window.location.href,
      title: document.title,
      referrer: document.referrer,
      timestamp: Date.now(),
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
    
    queueEvent(data);
  }
  
  // Queue event for batch sending
  function queueEvent(data) {
    eventQueue.push(data);
  }
  
  // Send batch of events
  function sendBatch() {
    if (eventQueue.length === 0) return;
    
    const payload = {
      site_id: CONFIG.siteId,
      events: eventQueue
    };
    
    // Use sendBeacon for reliability (works even during page unload)
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      const sent = navigator.sendBeacon(CONFIG.apiUrl, blob);
      if (sent) {
        eventQueue = [];
      }
    } else {
      // Fallback to fetch
      fetch(CONFIG.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      }).then(() => {
        eventQueue = [];
      }).catch(err => {
        console.error('[MA] Tracking failed:', err);
      });
    }
  }
  
  // Send session end event (for UTM session tracking)
  function sendSessionEnd() {
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
      navigator.sendBeacon(CONFIG.apiUrl, blob);
    }
  }
  
  // Track custom event (exposed as public API)
  function trackEvent(eventName, data) {
    queueEvent({
      type: eventName,
      visitor_id: visitorId,
      session_id: sessionId,
      timestamp: Date.now(),
      ...data
    });
  }
  
  // Initialize tracking
  function init() {
    // Track initial pageview
    trackPageView();
    
    // Set up batch sending interval
    setInterval(sendBatch, CONFIG.batchInterval);
    
    // Send session end and remaining events on page unload
    window.addEventListener('beforeunload', function() {
      sendSessionEnd();  // Close UTM sessions
      sendBatch();       // Send remaining events
    });
    window.addEventListener('pagehidden', function() {
      sendSessionEnd();
      sendBatch();
    });
    
    // Expose public API
    window._ma = {
      trackEvent: trackEvent,
      trackPageView: trackPageView
    };
    
    console.log('[MA] Moadamda Analytics initialized');
  }
  
  // Start tracking when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
})();

