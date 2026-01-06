const db = require('../../utils/database');
const { encodeSearchTerm, hasNonAsciiChars } = require('./utils');

/**
 * Tables Repository
 * 테이블 조회 관련 데이터베이스 쿼리 담당
 */

// ============================================================================
// 1. Visitors 테이블
// ============================================================================

/**
 * Visitors WHERE 조건 빌더
 */
function buildVisitorsFilters(filters = {}) {
  const {
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
  } = filters;

  let whereConditions = [];
  let queryParams = [];
  let paramIndex = 1;

  // 검색 조건 (visitor_id, IP 주소)
  if (search) {
    whereConditions.push(`(
      visitor_id ILIKE $${paramIndex} OR 
      last_ip ILIKE $${paramIndex}
    )`);
    queryParams.push(`%${search}%`);
    paramIndex++;
  }

  // 디바이스 필터
  if (device_type && device_type !== 'all') {
    whereConditions.push(`device_type = $${paramIndex}`);
    queryParams.push(device_type);
    paramIndex++;
  }

  // 브라우저 필터
  if (browser && browser !== 'all') {
    whereConditions.push(`browser = $${paramIndex}`);
    queryParams.push(browser);
    paramIndex++;
  }

  // OS 필터
  if (os && os !== 'all') {
    whereConditions.push(`os = $${paramIndex}`);
    queryParams.push(os);
    paramIndex++;
  }

  // UTM Source 필터
  if (utm_source && utm_source !== 'all') {
    whereConditions.push(`utm_source = $${paramIndex}`);
    queryParams.push(utm_source);
    paramIndex++;
  }

  // UTM Medium 필터
  if (utm_medium && utm_medium !== 'all') {
    whereConditions.push(`utm_medium = $${paramIndex}`);
    queryParams.push(utm_medium);
    paramIndex++;
  }

  // UTM Campaign 필터
  if (utm_campaign && utm_campaign !== 'all') {
    whereConditions.push(`utm_campaign = $${paramIndex}`);
    queryParams.push(utm_campaign);
    paramIndex++;
  }

  // Phase 4: 동적 UTM 필터 처리
  if (utm_filters) {
    try {
      const filters = JSON.parse(utm_filters);
      filters.forEach(filter => {
        const { key, value } = filter;
        
        // 기본 3개 컬럼은 직접 조회
        if (['utm_source', 'utm_medium', 'utm_campaign'].includes(key)) {
          whereConditions.push(`${key} = $${paramIndex}`);
          queryParams.push(value);
        } else {
          // 추가 UTM은 JSONB에서 조회
          whereConditions.push(`utm_params->>'${key}' = $${paramIndex}`);
          queryParams.push(value);
        }
        paramIndex++;
      });
    } catch (error) {
      console.error('UTM filters parsing error:', error);
    }
  }

  // 날짜 범위 필터 (첫 방문 기준)
  if (start_date) {
    whereConditions.push(`first_visit >= $${paramIndex}::date`);
    queryParams.push(start_date);
    paramIndex++;
  }

  if (end_date) {
    whereConditions.push(`first_visit < ($${paramIndex}::date + interval '1 day')`);
    queryParams.push(end_date);
    paramIndex++;
  }

  const whereClause = whereConditions.length > 0 
    ? 'WHERE ' + whereConditions.join(' AND ')
    : '';

  return { whereClause, queryParams, paramIndex };
}

/**
 * Visitors 데이터 조회
 */
async function getVisitors(filters, limit, offset) {
  const { whereClause, queryParams, paramIndex } = buildVisitorsFilters(filters);

  const dataQuery = `
    SELECT 
      visitor_id,
      first_visit,
      last_visit,
      visit_count,
      device_type,
      browser,
      os,
      referrer_type,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_params,
      ip_address,
      last_ip,
      created_at
    FROM visitors
    ${whereClause}
    ORDER BY last_visit DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  queryParams.push(limit, offset);
  
  const result = await db.query(dataQuery, queryParams);
  return result.rows;
}

/**
 * Visitors 총 개수 조회
 */
async function getVisitorsCount(filters) {
  const { whereClause, queryParams } = buildVisitorsFilters(filters);

  const countQuery = `SELECT COUNT(*) as total FROM visitors ${whereClause}`;
  
  const result = await db.query(countQuery, queryParams);
  return parseInt(result.rows[0].total);
}

// ============================================================================
// 2. Sessions 테이블
// ============================================================================

/**
 * Sessions WHERE 조건 빌더
 */
function buildSessionsFilters(filters = {}) {
  const {
    search = '',
    device_type = '',
    browser = '',
    os = '',
    is_bounced = '',
    is_converted = '',
    start_date = '',
    end_date = ''
  } = filters;

  let whereConditions = [];
  let queryParams = [];
  let paramIndex = 1;

  // 검색 조건 (session_id, visitor_id, IP 주소, URL)
  // URL 검색 시 원본과 인코딩된 값 모두 검색
  if (search) {
    const encodedSearch = encodeSearchTerm(search);
    const hasNonAscii = hasNonAsciiChars(search);
    
    if (hasNonAscii) {
      // 한글 검색: 인코딩된 값으로 검색 (ESCAPE '!' 사용)
      whereConditions.push(`(
        s.session_id ILIKE $${paramIndex} OR 
        s.visitor_id ILIKE $${paramIndex + 1} OR 
        s.ip_address ILIKE $${paramIndex + 2} OR
        s.entry_url ILIKE $${paramIndex + 3} ESCAPE '!' OR
        s.exit_url ILIKE $${paramIndex + 4} ESCAPE '!'
      )`);
      queryParams.push(
        `%${search}%`,        // session_id
        `%${search}%`,        // visitor_id
        `%${search}%`,        // ip_address
        `%${encodedSearch}%`, // entry_url (인코딩)
        `%${encodedSearch}%`  // exit_url (인코딩)
      );
      paramIndex += 5;
    } else {
      // 영문/숫자 검색: 일반 검색
      whereConditions.push(`(
        s.session_id ILIKE $${paramIndex} OR 
        s.visitor_id ILIKE $${paramIndex + 1} OR 
        s.ip_address ILIKE $${paramIndex + 2} OR
        s.entry_url ILIKE $${paramIndex + 3} OR
        s.exit_url ILIKE $${paramIndex + 4}
      )`);
      queryParams.push(
        `%${search}%`,
        `%${search}%`,
        `%${search}%`,
        `%${search}%`,
        `%${search}%`
      );
      paramIndex += 5;
    }
  }

  // 디바이스 필터
  if (device_type && device_type !== 'all') {
    whereConditions.push(`v.device_type = $${paramIndex}`);
    queryParams.push(device_type);
    paramIndex++;
  }

  // 브라우저 필터
  if (browser && browser !== 'all') {
    whereConditions.push(`v.browser = $${paramIndex}`);
    queryParams.push(browser);
    paramIndex++;
  }

  // OS 필터
  if (os && os !== 'all') {
    whereConditions.push(`v.os = $${paramIndex}`);
    queryParams.push(os);
    paramIndex++;
  }

  // 즉시 이탈 여부 필터
  if (is_bounced !== '' && is_bounced !== 'all') {
    whereConditions.push(`s.is_bounced = $${paramIndex}`);
    queryParams.push(is_bounced === 'true');
    paramIndex++;
  }

  // 구매 여부 필터
  if (is_converted !== '' && is_converted !== 'all') {
    whereConditions.push(`s.is_converted = $${paramIndex}`);
    queryParams.push(is_converted === 'true');
    paramIndex++;
  }

  // 날짜 범위 필터 (시작 시간 기준)
  if (start_date) {
    whereConditions.push(`s.start_time >= $${paramIndex}::date`);
    queryParams.push(start_date);
    paramIndex++;
  }

  if (end_date) {
    whereConditions.push(`s.start_time < ($${paramIndex}::date + interval '1 day')`);
    queryParams.push(end_date);
    paramIndex++;
  }

  const whereClause = whereConditions.length > 0 
    ? 'WHERE ' + whereConditions.join(' AND ')
    : '';

  return { whereClause, queryParams, paramIndex };
}

/**
 * Sessions 데이터 조회
 */
async function getSessions(filters, limit, offset) {
  const { whereClause, queryParams, paramIndex } = buildSessionsFilters(filters);

  const dataQuery = `
    SELECT
      s.session_id,
      s.visitor_id,
      s.start_time,
      s.end_time,
      s.pageview_count,
      LEAST(s.duration_seconds, 300) as duration_seconds,
      s.entry_url,
      s.exit_url,
      s.is_bounced,
      s.is_converted,
      s.ip_address,
      s.created_at,
      v.device_type,
      v.browser,
      v.os
    FROM sessions s
    LEFT JOIN visitors v ON s.visitor_id = v.visitor_id
    ${whereClause}
    ORDER BY s.start_time DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  queryParams.push(limit, offset);

  const result = await db.query(dataQuery, queryParams);
  return result.rows;
}

/**
 * Sessions 총 개수 조회
 */
async function getSessionsCount(filters) {
  const { whereClause, queryParams } = buildSessionsFilters(filters);

  const countQuery = `
    SELECT COUNT(*) as total 
    FROM sessions s
    LEFT JOIN visitors v ON s.visitor_id = v.visitor_id
    ${whereClause}
  `;

  const result = await db.query(countQuery, queryParams);
  return parseInt(result.rows[0].total);
}

// ============================================================================
// 3. Events 테이블
// ============================================================================

/**
 * Events WHERE 조건 빌더
 */
function buildEventsFilters(filters = {}) {
  const {
    search = '',
    event_type = '',
    device_type = '',
    browser = '',
    start_date = '',
    end_date = ''
  } = filters;

  let whereConditions = [];
  let queryParams = [];
  let paramIndex = 1;

  // 검색 조건 (visitor_id, session_id, product_id, product_name)
  if (search) {
    whereConditions.push(`(
      e.visitor_id ILIKE $${paramIndex} OR 
      e.session_id ILIKE $${paramIndex} OR 
      e.product_id ILIKE $${paramIndex} OR
      e.product_name ILIKE $${paramIndex}
    )`);
    queryParams.push(`%${search}%`);
    paramIndex++;
  }

  // 이벤트 타입 필터
  if (event_type && event_type !== 'all') {
    whereConditions.push(`e.event_type = $${paramIndex}`);
    queryParams.push(event_type);
    paramIndex++;
  }

  // 디바이스 필터
  if (device_type && device_type !== 'all') {
    whereConditions.push(`v.device_type = $${paramIndex}`);
    queryParams.push(device_type);
    paramIndex++;
  }

  // 브라우저 필터
  if (browser && browser !== 'all') {
    whereConditions.push(`v.browser = $${paramIndex}`);
    queryParams.push(browser);
    paramIndex++;
  }

  // 날짜 필터 (시작일 - 해당 날짜 00:00:00부터)
  if (start_date) {
    whereConditions.push(`e.timestamp >= $${paramIndex}::date`);
    queryParams.push(start_date);
    paramIndex++;
  }

  // 날짜 필터 (종료일 - 해당 날짜 23:59:59까지)
  if (end_date) {
    whereConditions.push(`e.timestamp < ($${paramIndex}::date + interval '1 day')`);
    queryParams.push(end_date);
    paramIndex++;
  }

  const whereClause = whereConditions.length > 0 
    ? 'WHERE ' + whereConditions.join(' AND ')
    : '';

  return { whereClause, queryParams, paramIndex };
}

/**
 * Events 데이터 조회
 */
async function getEvents(filters, limit, offset) {
  const { whereClause, queryParams, paramIndex } = buildEventsFilters(filters);

  const dataQuery = `
    SELECT 
      e.id,
      e.session_id,
      e.visitor_id,
      e.event_type,
      e.product_id,
      e.product_name,
      e.product_price,
      e.quantity,
      e.timestamp,
      e.metadata,
      e.created_at,
      v.device_type,
      v.browser
    FROM events e
    LEFT JOIN visitors v ON e.visitor_id = v.visitor_id
    ${whereClause}
    ORDER BY e.timestamp DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  queryParams.push(limit, offset);

  const result = await db.query(dataQuery, queryParams);
  return result.rows;
}

/**
 * Events 총 개수 조회
 */
async function getEventsCount(filters) {
  const { whereClause, queryParams } = buildEventsFilters(filters);

  const countQuery = `
    SELECT COUNT(*) as total 
    FROM events e
    LEFT JOIN visitors v ON e.visitor_id = v.visitor_id
    ${whereClause}
  `;

  const result = await db.query(countQuery, queryParams);
  return parseInt(result.rows[0].total);
}

// ============================================================================
// 4. Pageviews 테이블
// ============================================================================

/**
 * Pageviews WHERE 조건 빌더
 */
function buildPageviewsFilters(filters = {}) {
  const {
    search = '',
    device_type = '',
    browser = '',
    start_date = '',
    end_date = ''
  } = filters;

  let whereConditions = [];
  let queryParams = [];
  let paramIndex = 1;

  // 검색 조건 (visitor_id, session_id, page_url, page_title)
  // URL 검색 시 원본과 인코딩된 값 모두 검색
  if (search) {
    const encodedSearch = encodeSearchTerm(search);
    const hasNonAscii = hasNonAsciiChars(search);

    if (hasNonAscii) {
      // 한글 검색: 인코딩된 값으로 검색 (ESCAPE '!' 사용)
      const whereClause = `(
        p.visitor_id ILIKE $${paramIndex} OR 
        p.session_id ILIKE $${paramIndex + 1} OR 
        p.page_title ILIKE $${paramIndex + 2} OR
        p.page_url ILIKE $${paramIndex + 3} ESCAPE '!'
      )`;
      whereConditions.push(whereClause);

      const params = [
        `%${search}%`,        // visitor_id
        `%${search}%`,        // session_id
        `%${search}%`,        // page_title
        `%${encodedSearch}%`  // page_url (인코딩)
      ];
      queryParams.push(...params);
      paramIndex += 4;
    } else {
      // 영문/숫자 검색: 일반 검색
      whereConditions.push(`(
        p.visitor_id ILIKE $${paramIndex} OR 
        p.session_id ILIKE $${paramIndex + 1} OR 
        p.page_url ILIKE $${paramIndex + 2} OR
        p.page_title ILIKE $${paramIndex + 3}
      )`);
      queryParams.push(
        `%${search}%`,
        `%${search}%`,
        `%${search}%`,
        `%${search}%`
      );
      paramIndex += 4;
    }
  }

  // 디바이스 필터
  if (device_type && device_type !== 'all') {
    whereConditions.push(`v.device_type = $${paramIndex}`);
    queryParams.push(device_type);
    paramIndex++;
  }

  // 브라우저 필터
  if (browser && browser !== 'all') {
    whereConditions.push(`v.browser = $${paramIndex}`);
    queryParams.push(browser);
    paramIndex++;
  }

  // 날짜 필터 (시작일 - 해당 날짜 00:00:00부터)
  if (start_date) {
    whereConditions.push(`p.timestamp >= $${paramIndex}::date`);
    queryParams.push(start_date);
    paramIndex++;
  }

  // 날짜 필터 (종료일 - 해당 날짜 23:59:59까지)
  if (end_date) {
    whereConditions.push(`p.timestamp < ($${paramIndex}::date + interval '1 day')`);
    queryParams.push(end_date);
    paramIndex++;
  }

  const whereClause = whereConditions.length > 0
    ? 'WHERE ' + whereConditions.join(' AND ')
    : '';

  return { whereClause, queryParams, paramIndex };
}

/**
 * Pageviews 데이터 조회 (체류 시간 자동 계산)
 */
async function getPageviews(filters, limit, offset) {
  const { whereClause, queryParams, paramIndex } = buildPageviewsFilters(filters);

  const dataQuery = `
    WITH page_times AS (
      SELECT 
        p.id,
        p.session_id,
        p.visitor_id,
        p.page_url,
        p.page_title,
        p.timestamp,
        p.created_at,
        v.device_type,
        v.browser,
        LEAD(p.timestamp) OVER (PARTITION BY p.session_id ORDER BY p.timestamp) as next_timestamp,
        (
          SELECT MIN(e.timestamp)
          FROM events e
          WHERE e.session_id = p.session_id AND e.event_type = 'purchase'
        ) as purchase_timestamp
      FROM pageviews p
      LEFT JOIN visitors v ON p.visitor_id = v.visitor_id
      ${whereClause}
    )
    SELECT
      pt.id,
      pt.session_id,
      pt.visitor_id,
      pt.page_url,
      pt.page_title,
      pt.timestamp,
      CASE
        WHEN pt.next_timestamp IS NOT NULL THEN
          LEAST(EXTRACT(EPOCH FROM (pt.next_timestamp - pt.timestamp))::INTEGER, 600)
        WHEN pt.purchase_timestamp IS NOT NULL THEN
          LEAST(EXTRACT(EPOCH FROM (pt.purchase_timestamp - pt.timestamp))::INTEGER, 600)
        ELSE 0
      END as time_spent_seconds,
      pt.created_at,
      pt.device_type,
      pt.browser
    FROM page_times pt
    ORDER BY pt.timestamp DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  queryParams.push(limit, offset);

  const result = await db.query(dataQuery, queryParams);
  return result.rows;
}

/**
 * Pageviews 총 개수 조회
 */
async function getPageviewsCount(filters) {
  const { whereClause, queryParams } = buildPageviewsFilters(filters);

  const countQuery = `
    SELECT COUNT(*) as total 
    FROM pageviews p
    LEFT JOIN visitors v ON p.visitor_id = v.visitor_id
    ${whereClause}
  `;

  const result = await db.query(countQuery, queryParams);
  return parseInt(result.rows[0].total);
}

// ============================================================================
// 5. Conversions 테이블
// ============================================================================

/**
 * Conversions WHERE 조건 빌더
 */
function buildConversionsFilters(filters = {}) {
  const {
    search = '',
    device_type = '',
    browser = '',
    os = '',
    utm_source = '',
    utm_campaign = '',
    utm_filters = '',
    start_date = '',
    end_date = ''
  } = filters;

  let whereConditions = [];
  let queryParams = [];
  let paramIndex = 1;

  // 검색 조건 (visitor_id, session_id, order_id, ip_address)
  if (search) {
    whereConditions.push(`(
      c.visitor_id ILIKE $${paramIndex} OR
      c.session_id ILIKE $${paramIndex} OR
      c.order_id ILIKE $${paramIndex} OR
      s.ip_address ILIKE $${paramIndex}
    )`);
    queryParams.push(`%${search}%`);
    paramIndex++;
  }

  // 디바이스 필터
  if (device_type && device_type !== 'all') {
    whereConditions.push(`v.device_type = $${paramIndex}`);
    queryParams.push(device_type);
    paramIndex++;
  }

  // 브라우저 필터
  if (browser && browser !== 'all') {
    whereConditions.push(`v.browser = $${paramIndex}`);
    queryParams.push(browser);
    paramIndex++;
  }

  // 운영체제 필터
  if (os && os !== 'all') {
    whereConditions.push(`v.os = $${paramIndex}`);
    queryParams.push(os);
    paramIndex++;
  }

  // UTM Source 필터
  if (utm_source && utm_source !== 'all') {
    whereConditions.push(`c.utm_source = $${paramIndex}`);
    queryParams.push(utm_source);
    paramIndex++;
  }

  // UTM Campaign 필터
  if (utm_campaign && utm_campaign !== 'all') {
    whereConditions.push(`c.utm_campaign = $${paramIndex}`);
    queryParams.push(utm_campaign);
    paramIndex++;
  }

  // Phase 4: 동적 UTM 필터 처리
  if (utm_filters) {
    try {
      const filters = JSON.parse(utm_filters);
      filters.forEach(filter => {
        const { key, value } = filter;
        
        // 기본 컬럼은 직접 조회
        if (['utm_source', 'utm_campaign'].includes(key)) {
          whereConditions.push(`c.${key} = $${paramIndex}`);
          queryParams.push(value);
        } else {
          // 추가 UTM은 JSONB에서 조회
          whereConditions.push(`c.utm_params->>'${key}' = $${paramIndex}`);
          queryParams.push(value);
        }
        paramIndex++;
      });
    } catch (error) {
      console.error('UTM filters parsing error:', error);
    }
  }

  // 날짜 필터 (시작일 - 해당 날짜 00:00:00부터)
  if (start_date) {
    whereConditions.push(`c.timestamp >= $${paramIndex}::date`);
    queryParams.push(start_date);
    paramIndex++;
  }

  // 날짜 필터 (종료일 - 해당 날짜 23:59:59까지)
  if (end_date) {
    whereConditions.push(`c.timestamp < ($${paramIndex}::date + interval '1 day')`);
    queryParams.push(end_date);
    paramIndex++;
  }

  const whereClause = whereConditions.length > 0
    ? 'WHERE ' + whereConditions.join(' AND ')
    : '';

  return { whereClause, queryParams, paramIndex };
}

/**
 * Conversions 데이터 조회
 */
async function getConversions(filters, limit, offset) {
  const { whereClause, queryParams, paramIndex } = buildConversionsFilters(filters);

  const dataQuery = `
    SELECT 
      c.id,
      c.session_id,
      c.visitor_id,
      c.order_id,
      c.total_amount,
      c.discount_amount,
      c.mileage_used,
      c.shipping_fee,
      c.final_payment,
      c.product_count,
      c.timestamp,
      c.utm_source,
      c.utm_campaign,
      c.utm_params,
      c.created_at,
      v.device_type,
      v.browser,
      v.os,
      s.ip_address
    FROM conversions c
    LEFT JOIN visitors v ON c.visitor_id = v.visitor_id
    LEFT JOIN sessions s ON c.session_id = s.session_id
    ${whereClause}
    ORDER BY c.timestamp DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  queryParams.push(limit, offset);

  const result = await db.query(dataQuery, queryParams);
  return result.rows;
}

/**
 * Conversions 총 개수 조회
 */
async function getConversionsCount(filters) {
  const { whereClause, queryParams } = buildConversionsFilters(filters);

  const countQuery = `
    SELECT COUNT(*) as total
    FROM conversions c
    LEFT JOIN visitors v ON c.visitor_id = v.visitor_id
    LEFT JOIN sessions s ON c.session_id = s.session_id
    ${whereClause}
  `;

  const result = await db.query(countQuery, queryParams);
  return parseInt(result.rows[0].total);
}

// ============================================================================
// 6. UTM Sessions 테이블
// ============================================================================

/**
 * UTM Sessions WHERE 조건 빌더
 */
function buildUtmSessionsFilters(filters = {}) {
  const {
    search = '',
    device_type = '',
    browser = '',
    utm_source = '',
    utm_medium = '',
    utm_campaign = '',
    utm_filters = '',
    start_date = '',
    end_date = ''
  } = filters;

  let whereConditions = [];
  let queryParams = [];
  let paramIndex = 1;

  // 검색 조건 (visitor_id, session_id, page_url)
  // URL 검색 시 원본과 인코딩된 값 모두 검색
  if (search) {
    const encodedSearch = encodeSearchTerm(search);
    const hasNonAscii = hasNonAsciiChars(search);
    
    if (hasNonAscii) {
      // 한글 검색: 인코딩된 값으로 검색 (ESCAPE '!' 사용)
      whereConditions.push(`(
        us.visitor_id ILIKE $${paramIndex} OR
        us.session_id ILIKE $${paramIndex + 1} OR
        us.page_url ILIKE $${paramIndex + 2} ESCAPE '!'
      )`);
      queryParams.push(
        `%${search}%`,        // visitor_id
        `%${search}%`,        // session_id
        `%${encodedSearch}%`  // page_url (인코딩)
      );
      paramIndex += 3;
    } else {
      // 영문/숫자 검색: 일반 검색
      whereConditions.push(`(
        us.visitor_id ILIKE $${paramIndex} OR
        us.session_id ILIKE $${paramIndex + 1} OR
        us.page_url ILIKE $${paramIndex + 2}
      )`);
      queryParams.push(
        `%${search}%`,
        `%${search}%`,
        `%${search}%`
      );
      paramIndex += 3;
    }
  }

  // 디바이스 필터
  if (device_type && device_type !== 'all') {
    whereConditions.push(`v.device_type = $${paramIndex}`);
    queryParams.push(device_type);
    paramIndex++;
  }

  // 브라우저 필터
  if (browser && browser !== 'all') {
    whereConditions.push(`v.browser = $${paramIndex}`);
    queryParams.push(browser);
    paramIndex++;
  }

  // UTM Source 필터
  if (utm_source && utm_source !== 'all') {
    whereConditions.push(`us.utm_source = $${paramIndex}`);
    queryParams.push(utm_source);
    paramIndex++;
  }

  // UTM Medium 필터
  if (utm_medium && utm_medium !== 'all') {
    whereConditions.push(`us.utm_medium = $${paramIndex}`);
    queryParams.push(utm_medium);
    paramIndex++;
  }

  // UTM Campaign 필터
  if (utm_campaign && utm_campaign !== 'all') {
    whereConditions.push(`us.utm_campaign = $${paramIndex}`);
    queryParams.push(utm_campaign);
    paramIndex++;
  }

  // Phase 4: 동적 UTM 필터 처리
  if (utm_filters) {
    try {
      const filters = JSON.parse(utm_filters);
      filters.forEach(filter => {
        const { key, value } = filter;
        
        // 기본 3개 컬럼은 직접 조회
        if (['utm_source', 'utm_medium', 'utm_campaign'].includes(key)) {
          whereConditions.push(`us.${key} = $${paramIndex}`);
          queryParams.push(value);
        } else {
          // 추가 UTM은 JSONB에서 조회
          whereConditions.push(`us.utm_params->>'${key}' = $${paramIndex}`);
          queryParams.push(value);
        }
        paramIndex++;
      });
    } catch (error) {
      console.error('UTM filters parsing error:', error);
    }
  }

  // 날짜 필터 (시작일 - 해당 날짜 00:00:00부터)
  if (start_date) {
    whereConditions.push(`us.entry_timestamp >= $${paramIndex}::date`);
    queryParams.push(start_date);
    paramIndex++;
  }

  // 날짜 필터 (종료일 - 해당 날짜 23:59:59까지)
  if (end_date) {
    whereConditions.push(`us.entry_timestamp < ($${paramIndex}::date + interval '1 day')`);
    queryParams.push(end_date);
    paramIndex++;
  }

  const whereClause = whereConditions.length > 0
    ? 'WHERE ' + whereConditions.join(' AND ')
    : '';

  return { whereClause, queryParams, paramIndex };
}

/**
 * UTM Sessions 데이터 조회
 */
async function getUtmSessions(filters, limit, offset) {
  const { whereClause, queryParams, paramIndex } = buildUtmSessionsFilters(filters);

  const dataQuery = `
    SELECT 
      us.id,
      us.session_id,
      us.visitor_id,
      us.utm_source,
      us.utm_medium,
      us.utm_campaign,
      us.utm_params,
      us.page_url,
      us.entry_timestamp,
      us.exit_timestamp,
      us.duration_seconds,
      us.pageview_count,
      us.sequence_order,
      us.created_at,
      v.device_type,
      v.browser
    FROM utm_sessions us
    LEFT JOIN visitors v ON us.visitor_id = v.visitor_id
    ${whereClause}
    ORDER BY us.entry_timestamp DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  queryParams.push(limit, offset);

  const result = await db.query(dataQuery, queryParams);
  return result.rows;
}

/**
 * UTM Sessions 총 개수 조회
 */
async function getUtmSessionsCount(filters) {
  const { whereClause, queryParams } = buildUtmSessionsFilters(filters);

  const countQuery = `
    SELECT COUNT(*) as total
    FROM utm_sessions us
    LEFT JOIN visitors v ON us.visitor_id = v.visitor_id
    ${whereClause}
  `;

  const result = await db.query(countQuery, queryParams);
  return parseInt(result.rows[0].total);
}

// ============================================================================
// 7. Realtime Visitors 테이블
// ============================================================================

/**
 * Realtime Visitors 데이터 조회
 */
async function getRealtimeVisitors(limit, offset) {
  const dataQuery = `
    SELECT 
      rv.visitor_id,
      rv.current_url,
      rv.last_activity,
      rv.device_type,
      v.browser,
      v.os
    FROM realtime_visitors rv
    LEFT JOIN visitors v ON rv.visitor_id = v.visitor_id
    ORDER BY rv.last_activity DESC
    LIMIT $1 OFFSET $2
  `;

  const result = await db.query(dataQuery, [limit, offset]);
  return result.rows;
}

/**
 * Realtime Visitors 총 개수 조회
 */
async function getRealtimeVisitorsCount() {
  const countQuery = `SELECT COUNT(*) as total FROM realtime_visitors`;
  
  const result = await db.query(countQuery);
  return parseInt(result.rows[0].total);
}

module.exports = {
  getVisitors,
  getVisitorsCount,
  getSessions,
  getSessionsCount,
  getEvents,
  getEventsCount,
  getPageviews,
  getPageviewsCount,
  getConversions,
  getConversionsCount,
  getUtmSessions,
  getUtmSessionsCount,
  getRealtimeVisitors,
  getRealtimeVisitorsCount
};
