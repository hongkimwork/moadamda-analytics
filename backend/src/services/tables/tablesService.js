const repository = require('./tablesRepository');

/**
 * Tables Service
 * 테이블 조회 비즈니스 로직 담당
 */

/**
 * 공통 응답 포맷
 */
function formatTableResponse(data, total, limit, offset) {
  return {
    data: data,
    total: total,
    limit: parseInt(limit),
    offset: parseInt(offset)
  };
}

// ============================================================================
// 1. Visitors 테이블 조회
// ============================================================================

async function getVisitorsList(queryParams) {
  const {
    limit = 50,
    offset = 0,
    search = '',
    device_type = '',
    browser = '',
    os = '',
    utm_source = '',
    utm_medium = '',
    utm_campaign = '',
    utm_filters = '',
    start_date = '',
    end_date = ''
  } = queryParams;

  const filters = {
    search,
    device_type,
    browser,
    os,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_filters,
    start_date,
    end_date
  };

  const [data, total] = await Promise.all([
    repository.getVisitors(filters, limit, offset),
    repository.getVisitorsCount(filters)
  ]);

  return formatTableResponse(data, total, limit, offset);
}

// ============================================================================
// 2. Sessions 테이블 조회
// ============================================================================

async function getSessionsList(queryParams) {
  const {
    limit = 50,
    offset = 0,
    search = '',
    device_type = '',
    browser = '',
    os = '',
    is_bounced = '',
    is_converted = '',
    start_date = '',
    end_date = ''
  } = queryParams;

  const filters = {
    search,
    device_type,
    browser,
    os,
    is_bounced,
    is_converted,
    start_date,
    end_date
  };

  const [data, total] = await Promise.all([
    repository.getSessions(filters, limit, offset),
    repository.getSessionsCount(filters)
  ]);

  return formatTableResponse(data, total, limit, offset);
}

// ============================================================================
// 3. Events 테이블 조회
// ============================================================================

async function getEventsList(queryParams) {
  const {
    limit = 50,
    offset = 0,
    search = '',
    event_type = '',
    device_type = '',
    browser = '',
    start_date = '',
    end_date = ''
  } = queryParams;

  const filters = {
    search,
    event_type,
    device_type,
    browser,
    start_date,
    end_date
  };

  const [data, total] = await Promise.all([
    repository.getEvents(filters, limit, offset),
    repository.getEventsCount(filters)
  ]);

  return formatTableResponse(data, total, limit, offset);
}

// ============================================================================
// 4. Pageviews 테이블 조회
// ============================================================================

async function getPageviewsList(queryParams) {
  const {
    limit = 50,
    offset = 0,
    search = '',
    device_type = '',
    browser = '',
    start_date = '',
    end_date = ''
  } = queryParams;

  const filters = {
    search,
    device_type,
    browser,
    start_date,
    end_date
  };

  const [data, total] = await Promise.all([
    repository.getPageviews(filters, limit, offset),
    repository.getPageviewsCount(filters)
  ]);

  return formatTableResponse(data, total, limit, offset);
}

// ============================================================================
// 5. Conversions 테이블 조회
// ============================================================================

async function getConversionsList(queryParams) {
  const {
    limit = 50,
    offset = 0,
    search = '',
    device_type = '',
    browser = '',
    os = '',
    utm_source = '',
    utm_campaign = '',
    utm_filters = '',
    start_date = '',
    end_date = ''
  } = queryParams;

  const filters = {
    search,
    device_type,
    browser,
    os,
    utm_source,
    utm_campaign,
    utm_filters,
    start_date,
    end_date
  };

  const [data, total] = await Promise.all([
    repository.getConversions(filters, limit, offset),
    repository.getConversionsCount(filters)
  ]);

  return formatTableResponse(data, total, limit, offset);
}

// ============================================================================
// 6. UTM Sessions 테이블 조회
// ============================================================================

async function getUtmSessionsList(queryParams) {
  const {
    limit = 50,
    offset = 0,
    search = '',
    device_type = '',
    browser = '',
    utm_source = '',
    utm_medium = '',
    utm_campaign = '',
    utm_filters = '',
    start_date = '',
    end_date = ''
  } = queryParams;

  const filters = {
    search,
    device_type,
    browser,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_filters,
    start_date,
    end_date
  };

  const [data, total] = await Promise.all([
    repository.getUtmSessions(filters, limit, offset),
    repository.getUtmSessionsCount(filters)
  ]);

  return formatTableResponse(data, total, limit, offset);
}

// ============================================================================
// 7. Realtime Visitors 테이블 조회
// ============================================================================

async function getRealtimeVisitorsList(queryParams) {
  const { limit = 50, offset = 0 } = queryParams;

  const [data, total] = await Promise.all([
    repository.getRealtimeVisitors(limit, offset),
    repository.getRealtimeVisitorsCount()
  ]);

  return formatTableResponse(data, total, limit, offset);
}

module.exports = {
  getVisitorsList,
  getSessionsList,
  getEventsList,
  getPageviewsList,
  getConversionsList,
  getUtmSessionsList,
  getRealtimeVisitorsList
};
