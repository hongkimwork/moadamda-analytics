const express = require('express');
const router = express.Router();
const db = require('../utils/database');
const { calculateCreativeAttribution } = require('../utils/creativeAttribution');

/**
 * GET /api/creative-performance
 * 광고 소재 모수 분석 API
 * 
 * Query Parameters:
 *  - start: 시작일 (YYYY-MM-DD) - 필수
 *  - end: 종료일 (YYYY-MM-DD) - 필수
 *  - page: 페이지 번호 (default: 1)
 *  - limit: 페이지 크기 (default: 50)
 *  - search: 검색어 (광고 소재 이름)
 *  - sort_by: 정렬 기준 (default: total_revenue)
 *  - sort_order: 정렬 순서 (asc, desc) (default: desc)
 *  - utm_filters: 동적 UTM 필터 (JSON string)
 */
router.get('/creative-performance', async (req, res) => {
  try {
    const {
      start,
      end,
      page = 1,
      limit = 50,
      search = '',
      sort_by = 'total_revenue',
      sort_order = 'desc',
      utm_filters = '[]'
    } = req.query;

    // 1. 날짜 파라미터 검증
    if (!start || !end) {
      return res.status(400).json({ 
        error: 'start and end dates are required (YYYY-MM-DD format)' 
      });
    }

    const startDate = new Date(start);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    // 2. 페이지네이션 파라미터
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // 3. 정렬 기준 검증 (SQL Injection 방지)
    const dbSortColumns = [
      'creative_name',
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'unique_visitors',
      'avg_pageviews',
      'avg_duration_seconds'
    ];

    const attributionSortColumns = [
      'purchase_count',
      'total_revenue',
      'contributed_orders_count',
      'attributed_revenue',
      'total_contributed_revenue',
      'single_touch_count',
      'last_touch_count',
      'last_touch_revenue'
    ];

    const allAllowedSortColumns = [...dbSortColumns, ...attributionSortColumns];
    const sortBy = allAllowedSortColumns.includes(sort_by) ? sort_by : 'total_revenue';
    const sortDirection = sort_order.toLowerCase() === 'asc' ? 'asc' : 'desc';

    // DB 정렬 컬럼인지 기여도 정렬 컬럼인지 판단
    const isDbSort = dbSortColumns.includes(sortBy);
    const sortColumn = isDbSort ? sortBy : 'creative_name'; // 기여도 컬럼이면 일단 creative_name으로 정렬
    const sortDirectionSQL = isDbSort ? sortDirection.toUpperCase() : 'ASC';

    // 4. 검색 조건 구성
    let searchCondition = '';
    const queryParams = [startDate, endDate];
    let paramIndex = 3;

    if (search) {
      searchCondition = `AND us.utm_params->>'utm_content' ILIKE $${paramIndex}`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    // 5. 동적 UTM 필터 적용
    let utmFilterConditions = '';
    try {
      const filters = JSON.parse(utm_filters);
      if (Array.isArray(filters) && filters.length > 0) {
        const filterClauses = filters.map(filter => {
          const key = filter.key; // 예: 'utm_source'
          const operator = filter.operator || 'equals';
          const value = filter.value;
          
          // 키 이름 검증 (SQL Injection 방지)
          if (!/^utm_[a-z_]+$/.test(key)) {
            return null;
          }
          
          // IN 연산자 처리 (배열 값)
          if (operator === 'in' && Array.isArray(value) && value.length > 0) {
            const placeholders = value.map((v, i) => {
              queryParams.push(v);
              return `$${paramIndex++}`;
            });
            return `us.utm_params->>'${key}' IN (${placeholders.join(', ')})`;
          }
          
          // 기본 equals 연산자
          queryParams.push(value);
          const clause = `us.utm_params->>'${key}' = $${paramIndex}`;
          paramIndex++;
          return clause;
        }).filter(Boolean);
        
        if (filterClauses.length > 0) {
          utmFilterConditions = 'AND ' + filterClauses.join(' AND ');
        }
      }
    } catch (e) {
      console.error('UTM filters parsing error:', e);
    }

    // 6. 메인 쿼리: 광고 소재별 집계
    // 주의: 구매 데이터(conversions)는 여기서 조인하지 않음 (중복 집계 방지)
    // 구매 관련 데이터는 calculateCreativeAttribution에서 별도로 계산하여 병합함
    const dataQuery = `
      SELECT 
        us.utm_params->>'utm_content' as creative_name,
        us.utm_params->>'utm_source' as utm_source,
        us.utm_params->>'utm_medium' as utm_medium,
        us.utm_params->>'utm_campaign' as utm_campaign,
        
        -- 순방문자수 (UV)
        COUNT(DISTINCT us.visitor_id) as unique_visitors,
        
        -- 평균 페이지뷰 (방문자당 평균, 소수점 1자리)
        ROUND(
          COALESCE(SUM(us.pageview_count)::FLOAT / NULLIF(COUNT(DISTINCT us.visitor_id), 0), 0)::NUMERIC,
          1
        ) as avg_pageviews,
        
        -- 평균 체류시간 (방문자당 평균, 초 단위, 소수점 1자리)
        ROUND(
          COALESCE(SUM(us.duration_seconds)::FLOAT / NULLIF(COUNT(DISTINCT us.visitor_id), 0), 0)::NUMERIC,
          1
        ) as avg_duration_seconds

      FROM utm_sessions us
      WHERE us.utm_params->>'utm_content' IS NOT NULL
        AND us.entry_timestamp >= $1
        AND us.entry_timestamp <= $2
        ${searchCondition}
        ${utmFilterConditions}
      GROUP BY 
        us.utm_params->>'utm_content',
        us.utm_params->>'utm_source',
        us.utm_params->>'utm_medium',
        us.utm_params->>'utm_campaign'
      ORDER BY ${sortColumn} ${sortDirectionSQL}
    `;
    
    // LIMIT/OFFSET은 기여도 정렬일 때는 JavaScript에서 처리

    // 7. 총 개수 쿼리
    const countQuery = `
      SELECT COUNT(DISTINCT us.utm_params->>'utm_content') as total
      FROM utm_sessions us
      WHERE us.utm_params->>'utm_content' IS NOT NULL
        AND us.entry_timestamp >= $1
        AND us.entry_timestamp <= $2
        ${searchCondition}
        ${utmFilterConditions}
    `;

    // 8. 쿼리 실행 (전체 데이터 조회 - 정렬/페이지네이션은 나중에 처리)
    const [dataResult, countResult] = await Promise.all([
      db.query(dataQuery, queryParams),
      db.query(countQuery, queryParams)
    ]);

    // 9. 응답 데이터 가공 (URL 디코딩 포함)
    // URL 디코딩 함수 (불완전한 UTF-8 바이트 시퀀스 처리 및 정리)
    const safeDecodeURIComponent = (str) => {
      if (!str || str === '-') return str;
      
      let result = str;
      let prevResult;
      
      // 반복 디코딩 (이중 인코딩 처리)
      while (result !== prevResult) {
        prevResult = result;
        
        // 유효한 %XX 패턴 시퀀스를 찾아서 디코딩
        result = result.replace(/(%[0-9A-Fa-f]{2})+/g, (match) => {
          // 디코딩 시도, 실패 시 뒤에서부터 %XX 제거하며 재시도
          let toTry = match;
          while (toTry.length >= 3) {
            try {
              const decoded = decodeURIComponent(toTry);
              // 성공: 디코딩된 문자열만 반환 (불완전한 나머지는 버림)
              return decoded;
            } catch (e) {
              // 뒤에서 %XX 하나 제거 (3글자)
              toTry = toTry.slice(0, -3);
            }
          }
          // 모두 실패하면 빈 문자열 반환 (불완전한 인코딩 제거)
          return '';
        });
      }
      
      // 최종 정리: 끝에 남은 불완전한 % 패턴 제거 (%만 있거나 %X 형태)
      result = result.replace(/%[0-9A-Fa-f]?$/g, '');
      
      // Unicode 대체 문자(U+FFFD, �) 및 끝에 잘린 불완전한 문자 제거
      // 이 문자는 디코딩 실패 시 나타나는 깨진 문자
      result = result.replace(/\uFFFD/g, '');
      
      // 끝에 불완전하게 잘린 한글 제거 (자음/모음만 있는 경우)
      // 정상적인 한글 완성형이 아닌 문자가 끝에 있으면 제거
      result = result.replace(/[\u1100-\u11FF\u3130-\u318F]$/g, '');
      
      return result;
    };

    const rawData = dataResult.rows.map(row => ({
      creative_name: safeDecodeURIComponent(row.creative_name || '-'),
      utm_source: safeDecodeURIComponent(row.utm_source || '-'),
      utm_medium: safeDecodeURIComponent(row.utm_medium || '-'),
      utm_campaign: safeDecodeURIComponent(row.utm_campaign || '-'),
      unique_visitors: parseInt(row.unique_visitors) || 0,
      avg_pageviews: parseFloat(row.avg_pageviews) || 0,
      avg_duration_seconds: parseFloat(row.avg_duration_seconds) || 0,
      // 구매 데이터는 아래에서 병합
      purchase_count: 0,
      total_revenue: 0
    }));

    // 9-1. 디코딩된 키 기준으로 중복 데이터 병합 (인코딩 차이로 인한 중복 해결)
    const mergedDataMap = new Map();
    
    // 1단계: 정확히 일치하는 키로 먼저 그룹화
    rawData.forEach(row => {
      const key = `${row.creative_name}||${row.utm_source}||${row.utm_medium}||${row.utm_campaign}`;
      
      if (mergedDataMap.has(key)) {
        const existing = mergedDataMap.get(key);
        // UV 합산
        existing.unique_visitors += row.unique_visitors;
        // 총 페이지뷰, 총 체류시간 합산 (나중에 평균 재계산용)
        existing._total_pageviews += row.unique_visitors * row.avg_pageviews;
        existing._total_duration += row.unique_visitors * row.avg_duration_seconds;
      } else {
        mergedDataMap.set(key, {
          ...row,
          _total_pageviews: row.unique_visitors * row.avg_pageviews,
          _total_duration: row.unique_visitors * row.avg_duration_seconds
        });
      }
    });
    
    // 2단계: 잘린 광고명을 정상 광고명에 병합 (접두사 기반)
    // 조건: UTM 조합이 같고, 짧은 광고명이 긴 광고명의 접두사이고, 잘린 것처럼 보이는 경우
    const entries = Array.from(mergedDataMap.entries());
    const keysToDelete = new Set();
    
    // 잘린 광고명인지 판단하는 함수
    // - 끝이 불완전한 한글 (자음/모음만 남은 경우)
    // - 끝이 언더스코어(_)로 끝나는 경우
    // - 긴 광고명과의 차이가 단순히 공백 없이 이어지는 문자인 경우
    const isTruncated = (shortName, longName) => {
      // 긴 이름과의 차이 부분
      const diff = longName.slice(shortName.length);
      
      // " - 사본" 같은 별도 접미사가 붙은 경우는 잘린 것이 아님
      if (diff.startsWith(' - ') || diff.startsWith(' (') || diff.startsWith('_사본')) {
        return false;
      }
      
      // 짧은 이름이 언더스코어로 끝나면 잘린 것
      if (shortName.endsWith('_')) {
        return true;
      }
      
      // 차이가 한글로 시작하면 잘린 것 (단어 중간에서 잘림)
      // 예: "영괄" -> "영괄식" (식이 붙어야 함)
      if (/^[가-힣]/.test(diff)) {
        return true;
      }
      
      // 차이가 완전히 새로운 단어가 아닌 경우 (언더스코어 없이 바로 이어짐)
      if (!diff.startsWith('_') && !diff.startsWith(' ')) {
        return true;
      }
      
      return false;
    };
    
    for (let i = 0; i < entries.length; i++) {
      const [shortKey, shortRow] = entries[i];
      const shortName = shortRow.creative_name;
      
      // 이미 삭제 예정인 키는 스킵
      if (keysToDelete.has(shortKey)) continue;
      
      // 광고명이 너무 짧으면 접두사 병합 하지 않음 (최소 20자)
      if (shortName.length < 20) continue;
      
      for (let j = 0; j < entries.length; j++) {
        if (i === j) continue;
        
        const [longKey, longRow] = entries[j];
        const longName = longRow.creative_name;
        
        // 이미 삭제 예정인 키는 스킵
        if (keysToDelete.has(longKey)) continue;
        
        // UTM 조합이 같아야 함
        if (shortRow.utm_source !== longRow.utm_source ||
            shortRow.utm_medium !== longRow.utm_medium ||
            shortRow.utm_campaign !== longRow.utm_campaign) {
          continue;
        }
        
        // 짧은 광고명이 긴 광고명의 접두사인지 확인
        if (longName.length > shortName.length && longName.startsWith(shortName)) {
          // 잘린 것처럼 보이는 경우에만 병합
          if (isTruncated(shortName, longName)) {
            // 짧은 것의 데이터를 긴 것에 병합
            longRow.unique_visitors += shortRow.unique_visitors;
            longRow._total_pageviews += shortRow._total_pageviews;
            longRow._total_duration += shortRow._total_duration;
            
            // 짧은 것은 삭제 예정
            keysToDelete.add(shortKey);
            break; // 하나에만 병합
          }
        }
      }
    }
    
    // 삭제 예정인 키 제거
    keysToDelete.forEach(key => mergedDataMap.delete(key));
    
    // 평균값 재계산 후 최종 data 배열 생성
    const data = Array.from(mergedDataMap.values()).map(row => ({
      creative_name: row.creative_name,
      utm_source: row.utm_source,
      utm_medium: row.utm_medium,
      utm_campaign: row.utm_campaign,
      unique_visitors: row.unique_visitors,
      avg_pageviews: row.unique_visitors > 0 
        ? Math.round((row._total_pageviews / row.unique_visitors) * 10) / 10 
        : 0,
      avg_duration_seconds: row.unique_visitors > 0 
        ? Math.round((row._total_duration / row.unique_visitors) * 10) / 10 
        : 0,
      purchase_count: row.purchase_count,
      total_revenue: row.total_revenue
    }));

    // 10. 기여도 계산 (결제건 기여 포함 수, 결제건 기여 금액, 기여 결제건 총 결제금액)
    const attributionData = await calculateCreativeAttribution(data, startDate, endDate);

    // 11. 기여도 데이터를 기본 데이터에 병합
    let finalData = data.map(row => {
      const creativeKey = `${row.creative_name}||${row.utm_source}||${row.utm_medium}||${row.utm_campaign}`;
      const attr = attributionData[creativeKey] || {};
      
      return {
        ...row,
        // 기존 purchase_count, total_revenue를 기여도 분석 결과로 대체
        // purchase_count: 이 광고를 거쳐간 주문 수 (contributed_orders_count와 동일한 의미로 사용)
        purchase_count: attr.contributed_orders_count || 0,
        // total_revenue: 막타 결제액 (마지막으로 본 광고로서 구매한 결제금액)
        total_revenue: Math.round(attr.last_touch_revenue || 0),
        
        contributed_orders_count: attr.contributed_orders_count || 0,
        attributed_revenue: Math.round(attr.attributed_revenue || 0),
        total_contributed_revenue: Math.round(attr.total_contributed_revenue || 0),
        single_touch_count: attr.single_touch_count || 0,  // 순수전환 횟수 (이 광고만 보고 구매)
        last_touch_count: attr.last_touch_count || 0,      // 막타 횟수 (마지막으로 본 광고)
        last_touch_revenue: Math.round(attr.last_touch_revenue || 0)  // 막타 결제액
      };
    });

    // 12. JavaScript에서 정렬 (기여도 컬럼인 경우)
    if (!isDbSort) {
      finalData.sort((a, b) => {
        const aVal = a[sortBy] || 0;
        const bVal = b[sortBy] || 0;
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      });
    }

    // 13. 페이지네이션 처리
    const totalCount = finalData.length;
    const paginatedData = finalData.slice(offset, offset + limitNum);

    // 14. 응답
    res.json({
      success: true,
      period: {
        start: start,
        end: end
      },
      data: paginatedData,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        total_pages: Math.ceil(totalCount / limitNum)
      }
    });

  } catch (error) {
    console.error('Creative performance API error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch creative performance data',
      message: error.message 
    });
  }
});

/**
 * POST /api/creative-performance/orders
 * 특정 광고 소재에 기여한 주문 목록 조회 API
 * (테이블의 contributed_orders_count와 동일한 로직 사용)
 * 
 * Request Body:
 *  - creative_name: 광고 소재 이름 (utm_content) - 필수
 *  - utm_source: UTM Source - 필수
 *  - utm_medium: UTM Medium - 필수
 *  - utm_campaign: UTM Campaign - 필수
 *  - start: 시작일 (YYYY-MM-DD) - 필수
 *  - end: 종료일 (YYYY-MM-DD) - 필수
 */
router.post('/creative-performance/orders', async (req, res) => {
  try {
    const {
      creative_name,
      utm_source,
      utm_medium,
      utm_campaign,
      start,
      end
    } = req.body;

    // 1. 필수 파라미터 검증
    if (!creative_name || !utm_source || !utm_medium || !utm_campaign || !start || !end) {
      return res.status(400).json({ 
        success: false,
        error: 'creative_name, utm_source, utm_medium, utm_campaign, start, end are required' 
      });
    }

    const startDate = new Date(start);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    // 대상 광고 소재 키 생성
    const targetCreativeKey = `${creative_name}||${utm_source}||${utm_medium}||${utm_campaign}`;

    // 2. 해당 광고 소재를 본 visitor_id 목록 조회
    const visitorQuery = `
      SELECT DISTINCT visitor_id
      FROM utm_sessions
      WHERE utm_params->>'utm_content' = $1
        AND COALESCE(NULLIF(utm_params->>'utm_source', ''), '-') = $2
        AND COALESCE(NULLIF(utm_params->>'utm_medium', ''), '-') = $3
        AND COALESCE(NULLIF(utm_params->>'utm_campaign', ''), '-') = $4
        AND entry_timestamp >= $5
        AND entry_timestamp <= $6
    `;

    const visitorResult = await db.query(visitorQuery, [
      creative_name,
      utm_source,
      utm_medium,
      utm_campaign,
      startDate,
      endDate
    ]);

    const visitorIds = visitorResult.rows.map(r => r.visitor_id);

    if (visitorIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        summary: {
          total_orders: 0,
          total_revenue: 0,
          avg_order_value: 0,
          unique_visitors: 0
        }
      });
    }

    // 3. 해당 visitor들의 결제 완료된 주문 조회
    const ordersQuery = `
      SELECT 
        c.order_id,
        c.visitor_id,
        c.final_payment,
        c.total_amount,
        c.product_name,
        c.product_count,
        c.discount_amount,
        c.timestamp as order_date,
        c.paid
      FROM conversions c
      WHERE c.visitor_id = ANY($1)
        AND c.order_id IS NOT NULL
        AND c.paid = 'T'
        AND c.final_payment > 0
      ORDER BY c.timestamp DESC
    `;

    const ordersResult = await db.query(ordersQuery, [visitorIds]);
    const allOrders = ordersResult.rows;

    if (allOrders.length === 0) {
      return res.json({
        success: true,
        data: [],
        summary: {
          total_orders: 0,
          total_revenue: 0,
          avg_order_value: 0,
          unique_visitors: visitorIds.length
        }
      });
    }

    // 4. 모든 visitor의 UTM 여정 조회 (기여도 계산용)
    const journeyQuery = `
      SELECT 
        visitor_id,
        utm_params->>'utm_content' as utm_content,
        COALESCE(NULLIF(utm_params->>'utm_source', ''), '-') as utm_source,
        COALESCE(NULLIF(utm_params->>'utm_medium', ''), '-') as utm_medium,
        COALESCE(NULLIF(utm_params->>'utm_campaign', ''), '-') as utm_campaign,
        sequence_order
      FROM utm_sessions
      WHERE visitor_id = ANY($1)
        AND utm_params->>'utm_content' IS NOT NULL
      ORDER BY visitor_id, sequence_order
    `;

    const journeyResult = await db.query(journeyQuery, [visitorIds]);
    
    // visitor별 여정 그룹화
    const visitorJourneys = {};
    journeyResult.rows.forEach(row => {
      if (!visitorJourneys[row.visitor_id]) {
        visitorJourneys[row.visitor_id] = [];
      }
      visitorJourneys[row.visitor_id].push(row);
    });

    // 5. 기여도 기반 주문 필터링 (테이블 로직과 동일)
    // 해당 광고가 구매 여정에 포함된 주문만 선택
    const contributedOrders = [];
    
    allOrders.forEach(order => {
      const journey = visitorJourneys[order.visitor_id] || [];
      
      if (journey.length === 0) {
        return; // UTM 여정이 없으면 스킵
      }

      // 해당 광고가 이 visitor의 여정에 포함되어 있는지 확인
      const hasTargetCreative = journey.some(touch => {
        const touchKey = `${touch.utm_content}||${touch.utm_source}||${touch.utm_medium}||${touch.utm_campaign}`;
        return touchKey === targetCreativeKey;
      });

      if (hasTargetCreative) {
        // 막타 여부 확인
        const lastTouch = journey.reduce((max, current) => 
          current.sequence_order > max.sequence_order ? current : max
        );
        const lastTouchKey = `${lastTouch.utm_content}||${lastTouch.utm_source}||${lastTouch.utm_medium}||${lastTouch.utm_campaign}`;
        const isLastTouch = lastTouchKey === targetCreativeKey;

        contributedOrders.push({
          ...order,
          is_last_touch: isLastTouch
        });
      }
    });

    // 6. 요약 통계 계산
    const totalRevenue = contributedOrders.reduce((sum, o) => sum + (parseFloat(o.final_payment) || 0), 0);
    const avgOrderValue = contributedOrders.length > 0 ? totalRevenue / contributedOrders.length : 0;
    const lastTouchCount = contributedOrders.filter(o => o.is_last_touch).length;

    // 7. 응답 데이터 가공
    const formattedOrders = contributedOrders.map(order => ({
      order_id: order.order_id,
      order_date: order.order_date,
      final_payment: Math.round(parseFloat(order.final_payment) || 0),
      total_amount: Math.round(parseFloat(order.total_amount) || 0),
      product_name: order.product_name || '-',
      product_count: parseInt(order.product_count) || 1,
      discount_amount: Math.round(parseFloat(order.discount_amount) || 0),
      is_last_touch: order.is_last_touch
    }));

    res.json({
      success: true,
      creative: {
        creative_name,
        utm_source,
        utm_medium,
        utm_campaign
      },
      period: {
        start: start,
        end: end
      },
      data: formattedOrders,
      summary: {
        total_orders: contributedOrders.length,
        total_revenue: Math.round(totalRevenue),
        avg_order_value: Math.round(avgOrderValue),
        unique_visitors: visitorIds.length,
        last_touch_count: lastTouchCount
      }
    });

  } catch (error) {
    console.error('Creative orders API error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch creative orders',
      message: error.message 
    });
  }
});

/**
 * POST /api/creative-performance/analysis
 * 특정 광고 소재의 상세 성과 분석 API
 * 
 * Request Body:
 *  - creative_name: 광고 소재 이름 (utm_content) - 필수
 *  - utm_source: UTM Source - 필수
 *  - utm_medium: UTM Medium - 필수
 *  - utm_campaign: UTM Campaign - 필수
 *  - start: 시작일 (YYYY-MM-DD) - 필수
 *  - end: 종료일 (YYYY-MM-DD) - 필수
 * 
 * Response:
 *  - daily_trend: 일별 UV, 전환수, 매출 추이
 *  - device_stats: 디바이스별 성과
 *  - product_sales: 상품별 매출 TOP 10
 *  - visitor_type: 신규 vs 재방문 비율
 */
router.post('/creative-performance/analysis', async (req, res) => {
  try {
    const {
      creative_name,
      utm_source,
      utm_medium,
      utm_campaign,
      start,
      end
    } = req.body;

    // 1. 필수 파라미터 검증
    if (!creative_name || !utm_source || !utm_medium || !utm_campaign || !start || !end) {
      return res.status(400).json({ 
        success: false,
        error: 'creative_name, utm_source, utm_medium, utm_campaign, start, end are required' 
      });
    }

    const startDate = new Date(start);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    const targetCreativeKey = `${creative_name}||${utm_source}||${utm_medium}||${utm_campaign}`;

    // 2. 해당 광고 소재를 본 visitor_id 목록 조회
    const visitorQuery = `
      SELECT DISTINCT visitor_id
      FROM utm_sessions
      WHERE utm_params->>'utm_content' = $1
        AND COALESCE(NULLIF(utm_params->>'utm_source', ''), '-') = $2
        AND COALESCE(NULLIF(utm_params->>'utm_medium', ''), '-') = $3
        AND COALESCE(NULLIF(utm_params->>'utm_campaign', ''), '-') = $4
        AND entry_timestamp >= $5
        AND entry_timestamp <= $6
    `;

    const visitorResult = await db.query(visitorQuery, [
      creative_name,
      utm_source,
      utm_medium,
      utm_campaign,
      startDate,
      endDate
    ]);

    const visitorIds = visitorResult.rows.map(r => r.visitor_id);

    if (visitorIds.length === 0) {
      return res.json({
        success: true,
        creative: { creative_name, utm_source, utm_medium, utm_campaign },
        period: { start, end },
        daily_trend: [],
        device_stats: [],
        product_sales: [],
        visitor_type: { new_visitors: 0, returning_visitors: 0, new_ratio: 0, returning_ratio: 0 }
      });
    }

    // 3. 일별 추이 데이터 조회 (UV, 전환수, 매출)
    // FIX (2025-12-03): KST 기준으로 일별 집계 (UTC 저장 → KST 변환)
    const dailyTrendQuery = `
      WITH daily_uv AS (
        SELECT 
          DATE(us.entry_timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul') as date,
          COUNT(DISTINCT us.visitor_id) as uv
        FROM utm_sessions us
        WHERE us.utm_params->>'utm_content' = $1
          AND COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') = $2
          AND COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') = $3
          AND COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') = $4
          AND us.entry_timestamp >= $5
          AND us.entry_timestamp <= $6
        GROUP BY DATE(us.entry_timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')
      ),
      daily_orders AS (
        SELECT 
          DATE(c.timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul') as date,
          COUNT(DISTINCT c.order_id) as orders,
          SUM(c.final_payment) as revenue
        FROM conversions c
        WHERE c.visitor_id = ANY($7)
          AND c.order_id IS NOT NULL
          AND c.paid = 'T'
          AND c.final_payment > 0
          AND c.timestamp >= $5
          AND c.timestamp <= $6
        GROUP BY DATE(c.timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')
      )
      SELECT 
        COALESCE(u.date, o.date) as date,
        COALESCE(u.uv, 0) as uv,
        COALESCE(o.orders, 0) as orders,
        COALESCE(o.revenue, 0) as revenue
      FROM daily_uv u
      FULL OUTER JOIN daily_orders o ON u.date = o.date
      ORDER BY date ASC
    `;

    // 4. 디바이스별 성과 조회
    const deviceStatsQuery = `
      WITH device_uv AS (
        SELECT 
          COALESCE(v.device_type, 'unknown') as device_type,
          COUNT(DISTINCT us.visitor_id) as uv
        FROM utm_sessions us
        JOIN visitors v ON us.visitor_id = v.visitor_id
        WHERE us.utm_params->>'utm_content' = $1
          AND COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') = $2
          AND COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') = $3
          AND COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') = $4
          AND us.entry_timestamp >= $5
          AND us.entry_timestamp <= $6
        GROUP BY v.device_type
      ),
      device_orders AS (
        SELECT 
          COALESCE(v.device_type, 'unknown') as device_type,
          COUNT(DISTINCT c.order_id) as orders,
          SUM(c.final_payment) as revenue
        FROM conversions c
        JOIN visitors v ON c.visitor_id = v.visitor_id
        WHERE c.visitor_id = ANY($7)
          AND c.order_id IS NOT NULL
          AND c.paid = 'T'
          AND c.final_payment > 0
        GROUP BY v.device_type
      )
      SELECT 
        COALESCE(u.device_type, o.device_type) as device_type,
        COALESCE(u.uv, 0) as uv,
        COALESCE(o.orders, 0) as orders,
        COALESCE(o.revenue, 0) as revenue
      FROM device_uv u
      FULL OUTER JOIN device_orders o ON u.device_type = o.device_type
      ORDER BY uv DESC
    `;

    // 5. 상품별 매출 TOP 10 조회
    const productSalesQuery = `
      SELECT 
        COALESCE(c.product_name, '상품명 없음') as product_name,
        COUNT(*) as order_count,
        SUM(c.final_payment) as revenue
      FROM conversions c
      WHERE c.visitor_id = ANY($1)
        AND c.order_id IS NOT NULL
        AND c.paid = 'T'
        AND c.final_payment > 0
      GROUP BY c.product_name
      ORDER BY revenue DESC
      LIMIT 10
    `;

    // 6. 신규 vs 재방문 비율 조회
    const visitorTypeQuery = `
      SELECT 
        COUNT(CASE WHEN v.visit_count = 1 THEN 1 END) as new_visitors,
        COUNT(CASE WHEN v.visit_count > 1 THEN 1 END) as returning_visitors
      FROM visitors v
      WHERE v.visitor_id = ANY($1)
    `;

    // 병렬 쿼리 실행
    const [dailyTrendResult, deviceStatsResult, productSalesResult, visitorTypeResult] = await Promise.all([
      db.query(dailyTrendQuery, [creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate, visitorIds]),
      db.query(deviceStatsQuery, [creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate, visitorIds]),
      db.query(productSalesQuery, [visitorIds]),
      db.query(visitorTypeQuery, [visitorIds])
    ]);

    // 7. 응답 데이터 가공
    const dailyTrend = dailyTrendResult.rows.map(row => ({
      date: row.date,
      uv: parseInt(row.uv) || 0,
      orders: parseInt(row.orders) || 0,
      revenue: Math.round(parseFloat(row.revenue) || 0)
    }));

    // 디바이스 타입 한글 변환
    const deviceTypeKorean = {
      'mobile': '모바일',
      'desktop': '데스크톱',
      'tablet': '태블릿',
      'unknown': '알 수 없음'
    };

    const deviceStats = deviceStatsResult.rows.map(row => {
      const uv = parseInt(row.uv) || 0;
      const orders = parseInt(row.orders) || 0;
      const conversionRate = uv > 0 ? (orders / uv * 100).toFixed(1) : '0.0';
      
      return {
        device_type: row.device_type,
        device_type_korean: deviceTypeKorean[row.device_type] || row.device_type,
        uv,
        orders,
        revenue: Math.round(parseFloat(row.revenue) || 0),
        conversion_rate: parseFloat(conversionRate)
      };
    });

    const productSales = productSalesResult.rows.map((row, index) => ({
      rank: index + 1,
      product_name: row.product_name,
      order_count: parseInt(row.order_count) || 0,
      revenue: Math.round(parseFloat(row.revenue) || 0)
    }));

    const newVisitors = parseInt(visitorTypeResult.rows[0]?.new_visitors) || 0;
    const returningVisitors = parseInt(visitorTypeResult.rows[0]?.returning_visitors) || 0;
    const totalVisitors = newVisitors + returningVisitors;

    const visitorType = {
      new_visitors: newVisitors,
      returning_visitors: returningVisitors,
      new_ratio: totalVisitors > 0 ? Math.round(newVisitors / totalVisitors * 100) : 0,
      returning_ratio: totalVisitors > 0 ? Math.round(returningVisitors / totalVisitors * 100) : 0
    };

    // 8. 응답
    res.json({
      success: true,
      creative: {
        creative_name,
        utm_source,
        utm_medium,
        utm_campaign
      },
      period: {
        start,
        end
      },
      summary: {
        total_uv: visitorIds.length,
        total_orders: dailyTrend.reduce((sum, d) => sum + d.orders, 0),
        total_revenue: dailyTrend.reduce((sum, d) => sum + d.revenue, 0)
      },
      daily_trend: dailyTrend,
      device_stats: deviceStats,
      product_sales: productSales,
      visitor_type: visitorType
    });

  } catch (error) {
    console.error('Creative analysis API error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch creative analysis data',
      message: error.message 
    });
  }
});

/**
 * POST /api/creative-performance/journey
 * 특정 광고 소재의 고객 여정 분석 API
 * 
 * Request Body:
 *  - creative_name: 광고 소재 이름 (utm_content) - 필수
 *  - utm_source: UTM Source - 필수
 *  - utm_medium: UTM Medium - 필수
 *  - utm_campaign: UTM Campaign - 필수
 *  - start: 시작일 (YYYY-MM-DD) - 필수
 *  - end: 종료일 (YYYY-MM-DD) - 필수
 * 
 * Response:
 *  - summary: 총 구매자 수, 평균 접촉 횟수, 평균 구매 소요 시간
 *  - role_distribution: 광고 역할 비율 (첫 접점/중간/막타)
 *  - co_viewed_creatives: 함께 본 광고 TOP 10
 *  - journey_patterns: 주요 여정 패턴 TOP 5
 */
router.post('/creative-performance/journey', async (req, res) => {
  try {
    const {
      creative_name,
      utm_source,
      utm_medium,
      utm_campaign,
      start,
      end
    } = req.body;

    // 1. 필수 파라미터 검증
    if (!creative_name || !utm_source || !utm_medium || !utm_campaign || !start || !end) {
      return res.status(400).json({ 
        success: false,
        error: 'creative_name, utm_source, utm_medium, utm_campaign, start, end are required' 
      });
    }

    const startDate = new Date(start);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    const targetCreativeKey = `${creative_name}||${utm_source}||${utm_medium}||${utm_campaign}`;

    // 2. 해당 광고 소재를 본 visitor_id 목록 조회
    const visitorQuery = `
      SELECT DISTINCT visitor_id
      FROM utm_sessions
      WHERE utm_params->>'utm_content' = $1
        AND COALESCE(NULLIF(utm_params->>'utm_source', ''), '-') = $2
        AND COALESCE(NULLIF(utm_params->>'utm_medium', ''), '-') = $3
        AND COALESCE(NULLIF(utm_params->>'utm_campaign', ''), '-') = $4
        AND entry_timestamp >= $5
        AND entry_timestamp <= $6
    `;

    const visitorResult = await db.query(visitorQuery, [
      creative_name,
      utm_source,
      utm_medium,
      utm_campaign,
      startDate,
      endDate
    ]);

    const visitorIds = visitorResult.rows.map(r => r.visitor_id);

    if (visitorIds.length === 0) {
      return res.json({
        success: true,
        creative: { creative_name, utm_source, utm_medium, utm_campaign },
        period: { start, end },
        summary: {
          total_visitors: 0,
          total_purchasers: 0,
          avg_touch_count: 0,
          avg_days_to_purchase: 0
        },
        role_distribution: {
          first_touch: { count: 0, ratio: 0 },
          mid_touch: { count: 0, ratio: 0 },
          last_touch: { count: 0, ratio: 0 }
        },
        co_viewed_creatives: [],
        journey_patterns: []
      });
    }

    // 3. 해당 visitor들의 결제 완료된 주문 조회
    const purchasesQuery = `
      SELECT 
        c.visitor_id,
        c.order_id,
        c.final_payment,
        c.timestamp as order_date
      FROM conversions c
      WHERE c.visitor_id = ANY($1)
        AND c.order_id IS NOT NULL
        AND c.paid = 'T'
        AND c.final_payment > 0
      ORDER BY c.timestamp DESC
    `;

    const purchasesResult = await db.query(purchasesQuery, [visitorIds]);
    const purchases = purchasesResult.rows;

    // 구매한 visitor 목록
    const purchaserIds = [...new Set(purchases.map(p => p.visitor_id))];

    // 4. 모든 visitor의 UTM 여정 조회
    const journeyQuery = `
      SELECT 
        visitor_id,
        utm_params->>'utm_content' as utm_content,
        COALESCE(NULLIF(utm_params->>'utm_source', ''), '-') as utm_source,
        COALESCE(NULLIF(utm_params->>'utm_medium', ''), '-') as utm_medium,
        COALESCE(NULLIF(utm_params->>'utm_campaign', ''), '-') as utm_campaign,
        sequence_order,
        entry_timestamp
      FROM utm_sessions
      WHERE visitor_id = ANY($1)
        AND utm_params->>'utm_content' IS NOT NULL
      ORDER BY visitor_id, sequence_order
    `;

    const journeyResult = await db.query(journeyQuery, [visitorIds]);
    
    // visitor별 여정 그룹화
    const visitorJourneys = {};
    journeyResult.rows.forEach(row => {
      if (!visitorJourneys[row.visitor_id]) {
        visitorJourneys[row.visitor_id] = [];
      }
      visitorJourneys[row.visitor_id].push(row);
    });

    // 5. 광고 역할 비율 계산 (구매자 기준)
    let firstTouchCount = 0;
    let midTouchCount = 0;
    let lastTouchCount = 0;
    let totalTouchCount = 0;
    let totalDaysToConvert = 0;
    let validDaysCount = 0;

    // 함께 본 광고 집계
    const coViewedMap = new Map(); // { creativeKey: { count, purchasers: Set } }
    
    // 여정 패턴 집계
    const journeyPatternMap = new Map(); // { patternString: count }

    purchaserIds.forEach(visitorId => {
      const journey = visitorJourneys[visitorId] || [];
      if (journey.length === 0) return;

      // 고유한 광고 조합 추출 (순서 유지)
      const uniqueCreatives = [];
      const seenKeys = new Set();
      
      journey.forEach(touch => {
        const touchKey = `${touch.utm_content}||${touch.utm_source}||${touch.utm_medium}||${touch.utm_campaign}`;
        if (!seenKeys.has(touchKey)) {
          seenKeys.add(touchKey);
          uniqueCreatives.push({
            key: touchKey,
            name: touch.utm_content,
            source: touch.utm_source,
            timestamp: touch.entry_timestamp
          });
        }
      });

      // 총 접촉 횟수 누적
      totalTouchCount += uniqueCreatives.length;

      // 타겟 광고의 역할 파악
      const targetIndex = uniqueCreatives.findIndex(c => c.key === targetCreativeKey);
      if (targetIndex === -1) return;

      if (targetIndex === 0 && uniqueCreatives.length === 1) {
        // 유일한 광고면 막타로 카운트
        lastTouchCount++;
      } else if (targetIndex === 0) {
        firstTouchCount++;
      } else if (targetIndex === uniqueCreatives.length - 1) {
        lastTouchCount++;
      } else {
        midTouchCount++;
      }

      // 함께 본 광고 집계 (타겟 광고 제외)
      uniqueCreatives.forEach(creative => {
        if (creative.key !== targetCreativeKey) {
          if (!coViewedMap.has(creative.key)) {
            coViewedMap.set(creative.key, {
              creative_name: creative.name,
              utm_source: creative.source,
              count: 0,
              purchasers: new Set()
            });
          }
          const data = coViewedMap.get(creative.key);
          data.count++;
          data.purchasers.add(visitorId);
        }
      });

      // 여정 패턴 집계 (광고명만 사용, 최대 5개까지)
      const patternNames = uniqueCreatives.slice(0, 5).map(c => c.name);
      patternNames.push('구매');
      const patternString = patternNames.join(' → ');
      journeyPatternMap.set(patternString, (journeyPatternMap.get(patternString) || 0) + 1);

      // 구매 소요 시간 계산 (첫 접촉 → 구매)
      const visitorPurchases = purchases.filter(p => p.visitor_id === visitorId);
      if (visitorPurchases.length > 0 && uniqueCreatives.length > 0) {
        const firstTouchTime = new Date(uniqueCreatives[0].timestamp);
        const purchaseTime = new Date(visitorPurchases[0].order_date);
        const daysDiff = (purchaseTime - firstTouchTime) / (1000 * 60 * 60 * 24);
        if (daysDiff >= 0) {
          totalDaysToConvert += daysDiff;
          validDaysCount++;
        }
      }
    });

    // 6. 결과 가공
    const totalRoleCount = firstTouchCount + midTouchCount + lastTouchCount;

    const roleDistribution = {
      first_touch: {
        count: firstTouchCount,
        ratio: totalRoleCount > 0 ? Math.round(firstTouchCount / totalRoleCount * 100 * 10) / 10 : 0
      },
      mid_touch: {
        count: midTouchCount,
        ratio: totalRoleCount > 0 ? Math.round(midTouchCount / totalRoleCount * 100 * 10) / 10 : 0
      },
      last_touch: {
        count: lastTouchCount,
        ratio: totalRoleCount > 0 ? Math.round(lastTouchCount / totalRoleCount * 100 * 10) / 10 : 0
      }
    };

    // 함께 본 광고 TOP 10
    const coViewedCreatives = Array.from(coViewedMap.entries())
      .map(([key, data]) => ({
        creative_name: data.creative_name,
        utm_source: data.utm_source,
        co_view_count: data.count,
        co_purchaser_count: data.purchasers.size,
        co_conversion_rate: data.count > 0 ? Math.round(data.purchasers.size / data.count * 100 * 10) / 10 : 0
      }))
      .sort((a, b) => b.co_view_count - a.co_view_count)
      .slice(0, 10)
      .map((item, index) => ({ rank: index + 1, ...item }));

    // 주요 여정 패턴 TOP 5
    const journeyPatterns = Array.from(journeyPatternMap.entries())
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 7. 응답
    res.json({
      success: true,
      creative: {
        creative_name,
        utm_source,
        utm_medium,
        utm_campaign
      },
      period: {
        start,
        end
      },
      summary: {
        total_visitors: visitorIds.length,
        total_purchasers: purchaserIds.length,
        avg_touch_count: purchaserIds.length > 0 ? Math.round(totalTouchCount / purchaserIds.length * 10) / 10 : 0,
        avg_days_to_purchase: validDaysCount > 0 ? Math.round(totalDaysToConvert / validDaysCount * 10) / 10 : 0
      },
      role_distribution: roleDistribution,
      co_viewed_creatives: coViewedCreatives,
      journey_patterns: journeyPatterns
    });

  } catch (error) {
    console.error('Creative journey API error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch creative journey data',
      message: error.message 
    });
  }
});

/**
 * POST /api/creative-performance/landing-pages
 * 특정 광고 소재의 랜딩페이지 분석 API
 * 
 * Request Body:
 *  - creative_name: 광고 소재 이름 (utm_content) - 필수
 *  - utm_source: UTM Source - 필수
 *  - utm_medium: UTM Medium - 필수
 *  - utm_campaign: UTM Campaign - 필수
 *  - start: 시작일 (YYYY-MM-DD) - 필수
 *  - end: 종료일 (YYYY-MM-DD) - 필수
 * 
 * Response:
 *  - summary: 평균 페이지뷰, 평균 체류시간, 이탈률, 전환율
 *  - top_pages: 많이 본 페이지 TOP 10
 *  - exit_pages: 이탈이 많은 페이지 TOP 5
 *  - purchaser_comparison: 구매자 vs 비구매자 비교
 */
router.post('/creative-performance/landing-pages', async (req, res) => {
  try {
    const {
      creative_name,
      utm_source,
      utm_medium,
      utm_campaign,
      start,
      end
    } = req.body;

    // 1. 필수 파라미터 검증
    if (!creative_name || !utm_source || !utm_medium || !utm_campaign || !start || !end) {
      return res.status(400).json({ 
        success: false,
        error: 'creative_name, utm_source, utm_medium, utm_campaign, start, end are required' 
      });
    }

    const startDate = new Date(start);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    // 2. 해당 광고 소재를 본 visitor_id 목록 조회
    const visitorQuery = `
      SELECT DISTINCT visitor_id
      FROM utm_sessions
      WHERE utm_params->>'utm_content' = $1
        AND COALESCE(NULLIF(utm_params->>'utm_source', ''), '-') = $2
        AND COALESCE(NULLIF(utm_params->>'utm_medium', ''), '-') = $3
        AND COALESCE(NULLIF(utm_params->>'utm_campaign', ''), '-') = $4
        AND entry_timestamp >= $5
        AND entry_timestamp <= $6
    `;

    const visitorResult = await db.query(visitorQuery, [
      creative_name,
      utm_source,
      utm_medium,
      utm_campaign,
      startDate,
      endDate
    ]);

    const visitorIds = visitorResult.rows.map(r => r.visitor_id);

    if (visitorIds.length === 0) {
      return res.json({
        success: true,
        creative: { creative_name, utm_source, utm_medium, utm_campaign },
        period: { start, end },
        summary: {
          total_visitors: 0,
          avg_pageviews: 0,
          avg_duration_seconds: 0,
          bounce_rate: 0,
          conversion_rate: 0
        },
        top_pages: [],
        exit_pages: [],
        purchaser_comparison: {
          purchasers: { count: 0, avg_pageviews: 0, avg_duration: 0 },
          non_purchasers: { count: 0, avg_pageviews: 0, avg_duration: 0 }
        }
      });
    }

    // 3. 구매자 visitor 목록 조회
    const purchaserQuery = `
      SELECT DISTINCT visitor_id
      FROM conversions
      WHERE visitor_id = ANY($1)
        AND order_id IS NOT NULL
        AND paid = 'T'
        AND final_payment > 0
    `;
    const purchaserResult = await db.query(purchaserQuery, [visitorIds]);
    const purchaserIds = purchaserResult.rows.map(r => r.visitor_id);
    const nonPurchaserIds = visitorIds.filter(id => !purchaserIds.includes(id));

    // 4. 요약 통계 조회 (세션 기준)
    const summaryQuery = `
      SELECT 
        COUNT(DISTINCT s.session_id) as total_sessions,
        COUNT(DISTINCT s.visitor_id) as total_visitors,
        ROUND(AVG(s.pageview_count)::NUMERIC, 1) as avg_pageviews,
        ROUND(AVG(s.duration_seconds)::NUMERIC, 0) as avg_duration_seconds,
        ROUND(
          (COUNT(CASE WHEN s.is_bounced = true THEN 1 END)::FLOAT / 
           NULLIF(COUNT(DISTINCT s.session_id), 0) * 100)::NUMERIC, 1
        ) as bounce_rate
      FROM sessions s
      WHERE s.visitor_id = ANY($1)
        AND s.start_time >= $2
        AND s.start_time <= $3
    `;
    const summaryResult = await db.query(summaryQuery, [visitorIds, startDate, endDate]);
    const summary = summaryResult.rows[0] || {};

    // 전환율 계산
    const conversionRate = visitorIds.length > 0 
      ? Math.round(purchaserIds.length / visitorIds.length * 1000) / 10 
      : 0;

    // 5. 많이 본 페이지 TOP 10 조회
    const topPagesQuery = `
      SELECT 
        p.page_url,
        MAX(p.page_title) as page_title,
        COUNT(DISTINCT p.visitor_id) as visitor_count,
        COUNT(*) as view_count,
        ROUND(AVG(COALESCE(p.time_spent, 0))::NUMERIC, 0) as avg_time_spent
      FROM pageviews p
      WHERE p.visitor_id = ANY($1)
        AND p.timestamp >= $2
        AND p.timestamp <= $3
      GROUP BY p.page_url
      ORDER BY visitor_count DESC
      LIMIT 10
    `;
    const topPagesResult = await db.query(topPagesQuery, [visitorIds, startDate, endDate]);
    
    const totalVisitors = visitorIds.length;
    const topPages = topPagesResult.rows.map((row, index) => ({
      rank: index + 1,
      page_url: row.page_url,
      page_title: row.page_title || null,
      visitor_count: parseInt(row.visitor_count) || 0,
      view_count: parseInt(row.view_count) || 0,
      visitor_ratio: totalVisitors > 0 
        ? Math.round(parseInt(row.visitor_count) / totalVisitors * 100) 
        : 0,
      avg_time_spent: parseInt(row.avg_time_spent) || 0
    }));

    // 6. 이탈 페이지 TOP 5 조회 (세션의 exit_url 기준)
    const exitPagesQuery = `
      SELECT 
        s.exit_url as page_url,
        COUNT(*) as exit_count,
        COUNT(DISTINCT s.visitor_id) as visitor_count
      FROM sessions s
      WHERE s.visitor_id = ANY($1)
        AND s.start_time >= $2
        AND s.start_time <= $3
        AND s.exit_url IS NOT NULL
        AND s.exit_url != ''
      GROUP BY s.exit_url
      ORDER BY exit_count DESC
      LIMIT 5
    `;
    const exitPagesResult = await db.query(exitPagesQuery, [visitorIds, startDate, endDate]);
    
    // 각 이탈 페이지의 총 방문 수 조회 (이탈률 계산용)
    const exitPages = await Promise.all(exitPagesResult.rows.map(async (row, index) => {
      // 해당 페이지의 총 방문자 수 조회
      const totalVisitQuery = `
        SELECT COUNT(DISTINCT visitor_id) as total_visitors
        FROM pageviews
        WHERE visitor_id = ANY($1)
          AND page_url = $2
          AND timestamp >= $3
          AND timestamp <= $4
      `;
      const totalVisitResult = await db.query(totalVisitQuery, [visitorIds, row.page_url, startDate, endDate]);
      const pageVisitors = parseInt(totalVisitResult.rows[0]?.total_visitors) || 0;
      
      const exitCount = parseInt(row.exit_count) || 0;
      const exitRate = pageVisitors > 0 ? Math.round(exitCount / pageVisitors * 100) : 0;

      // 개선 힌트 생성
      let improvementHint = '';
      const urlLower = (row.page_url || '').toLowerCase();
      
      if (urlLower.includes('cart') || urlLower.includes('basket') || urlLower.includes('장바구니')) {
        improvementHint = '결제 유도 필요';
      } else if (urlLower.includes('product') || urlLower.includes('detail') || urlLower.includes('goods')) {
        improvementHint = '상품 정보 보완';
      } else if (urlLower.includes('category') || urlLower.includes('list')) {
        improvementHint = '상품 추천 강화';
      } else if (urlLower.includes('main') || urlLower === '/' || urlLower.endsWith('.com/') || urlLower.endsWith('.com')) {
        improvementHint = '흥미 유발 콘텐츠 필요';
      } else if (urlLower.includes('order') || urlLower.includes('checkout')) {
        improvementHint = '결제 과정 간소화';
      } else {
        improvementHint = '페이지 콘텐츠 점검';
      }

      return {
        rank: index + 1,
        page_url: row.page_url,
        exit_count: exitCount,
        exit_rate: exitRate,
        improvement_hint: improvementHint
      };
    }));

    // 7. 구매자 vs 비구매자 비교
    const purchaserStatsQuery = `
      SELECT 
        ROUND(AVG(s.pageview_count)::NUMERIC, 1) as avg_pageviews,
        ROUND(AVG(s.duration_seconds)::NUMERIC, 0) as avg_duration
      FROM sessions s
      WHERE s.visitor_id = ANY($1)
        AND s.start_time >= $2
        AND s.start_time <= $3
    `;

    const [purchaserStats, nonPurchaserStats] = await Promise.all([
      purchaserIds.length > 0 
        ? db.query(purchaserStatsQuery, [purchaserIds, startDate, endDate])
        : { rows: [{ avg_pageviews: 0, avg_duration: 0 }] },
      nonPurchaserIds.length > 0
        ? db.query(purchaserStatsQuery, [nonPurchaserIds, startDate, endDate])
        : { rows: [{ avg_pageviews: 0, avg_duration: 0 }] }
    ]);

    // 구매자의 상품 상세 페이지 방문 횟수
    const productViewQuery = `
      SELECT 
        ROUND((COUNT(*)::FLOAT / NULLIF($2, 0))::NUMERIC, 1) as avg_product_views
      FROM pageviews p
      WHERE p.visitor_id = ANY($1)
        AND (p.page_url LIKE '%product%' OR p.page_url LIKE '%detail%' OR p.page_url LIKE '%goods%')
    `;

    const [purchaserProductViews, nonPurchaserProductViews] = await Promise.all([
      purchaserIds.length > 0
        ? db.query(productViewQuery, [purchaserIds, purchaserIds.length])
        : { rows: [{ avg_product_views: 0 }] },
      nonPurchaserIds.length > 0
        ? db.query(productViewQuery, [nonPurchaserIds, nonPurchaserIds.length])
        : { rows: [{ avg_product_views: 0 }] }
    ]);

    const purchaserComparison = {
      purchasers: {
        count: purchaserIds.length,
        avg_pageviews: parseFloat(purchaserStats.rows[0]?.avg_pageviews) || 0,
        avg_duration: parseInt(purchaserStats.rows[0]?.avg_duration) || 0,
        avg_product_views: parseFloat(purchaserProductViews.rows[0]?.avg_product_views) || 0
      },
      non_purchasers: {
        count: nonPurchaserIds.length,
        avg_pageviews: parseFloat(nonPurchaserStats.rows[0]?.avg_pageviews) || 0,
        avg_duration: parseInt(nonPurchaserStats.rows[0]?.avg_duration) || 0,
        avg_product_views: parseFloat(nonPurchaserProductViews.rows[0]?.avg_product_views) || 0
      }
    };

    // 8. 인사이트 생성
    let insight = '';
    const pvRatio = purchaserComparison.non_purchasers.avg_pageviews > 0
      ? (purchaserComparison.purchasers.avg_pageviews / purchaserComparison.non_purchasers.avg_pageviews).toFixed(1)
      : 0;
    
    if (purchaserComparison.purchasers.count > 0 && purchaserComparison.non_purchasers.count > 0) {
      if (parseFloat(pvRatio) > 1.5) {
        insight = `구매자는 비구매자보다 평균 ${pvRatio}배 더 많은 페이지를 봅니다. 상품 상세 페이지 노출을 늘리면 전환율이 높아질 수 있습니다.`;
      } else if (purchaserComparison.purchasers.avg_product_views > purchaserComparison.non_purchasers.avg_product_views * 1.5) {
        insight = `구매자는 상품 상세 페이지를 더 많이 봅니다. 추천 상품 노출을 강화해보세요.`;
      } else {
        insight = `구매자와 비구매자의 페이지 탐색 패턴이 유사합니다. 결제 과정 개선에 집중해보세요.`;
      }
    } else if (purchaserComparison.purchasers.count === 0) {
      insight = `아직 구매 전환이 발생하지 않았습니다. 랜딩페이지와 상품 구성을 점검해보세요.`;
    }

    // 9. 응답
    res.json({
      success: true,
      creative: {
        creative_name,
        utm_source,
        utm_medium,
        utm_campaign
      },
      period: {
        start,
        end
      },
      summary: {
        total_visitors: visitorIds.length,
        avg_pageviews: parseFloat(summary.avg_pageviews) || 0,
        avg_duration_seconds: parseInt(summary.avg_duration_seconds) || 0,
        bounce_rate: parseFloat(summary.bounce_rate) || 0,
        conversion_rate: conversionRate
      },
      top_pages: topPages,
      exit_pages: exitPages,
      purchaser_comparison: purchaserComparison,
      insight: insight
    });

  } catch (error) {
    console.error('Landing pages API error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch landing pages data',
      message: error.message 
    });
  }
});

/**
 * POST /api/creative-performance/compare
 * 여러 광고 소재 비교 분석 API
 * 
 * Request Body:
 *  - creatives: 비교할 광고 소재 배열 (2~5개)
 *    각 항목: { creative_name, utm_source, utm_medium, utm_campaign }
 *  - start: 시작일 (YYYY-MM-DD) - 필수
 *  - end: 종료일 (YYYY-MM-DD) - 필수
 * 
 * Response:
 *  - creatives_data: 각 소재별 핵심 지표
 *  - daily_trends: 각 소재별 일별 추이
 *  - role_comparison: 각 소재별 광고 역할 분포
 */
router.post('/creative-performance/compare', async (req, res) => {
  try {
    const {
      creatives,
      start,
      end
    } = req.body;

    // 1. 필수 파라미터 검증
    if (!creatives || !Array.isArray(creatives) || creatives.length < 2 || creatives.length > 5) {
      return res.status(400).json({ 
        success: false,
        error: '2~5개의 광고 소재를 선택해주세요' 
      });
    }

    if (!start || !end) {
      return res.status(400).json({ 
        success: false,
        error: 'start, end are required' 
      });
    }

    const startDate = new Date(start);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    // 2. 각 소재별 데이터 조회
    const creativesData = [];
    const dailyTrends = [];
    const roleComparison = [];

    for (const creative of creatives) {
      const { creative_name, utm_source, utm_medium, utm_campaign } = creative;
      const targetKey = `${creative_name}||${utm_source}||${utm_medium}||${utm_campaign}`;

      // 2-1. 해당 소재를 본 visitor 조회
      const visitorQuery = `
        SELECT DISTINCT visitor_id
        FROM utm_sessions
        WHERE utm_params->>'utm_content' = $1
          AND COALESCE(NULLIF(utm_params->>'utm_source', ''), '-') = $2
          AND COALESCE(NULLIF(utm_params->>'utm_medium', ''), '-') = $3
          AND COALESCE(NULLIF(utm_params->>'utm_campaign', ''), '-') = $4
          AND entry_timestamp >= $5
          AND entry_timestamp <= $6
      `;
      const visitorResult = await db.query(visitorQuery, [
        creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate
      ]);
      const visitorIds = visitorResult.rows.map(r => r.visitor_id);

      if (visitorIds.length === 0) {
        // 데이터 없는 소재
        creativesData.push({
          creative_name,
          utm_source,
          uv: 0,
          conversion_count: 0,
          conversion_rate: 0,
          revenue: 0,
          attributed_revenue: 0,
          avg_duration: 0,
          avg_pageviews: 0,
          bounce_rate: 0
        });
        dailyTrends.push([]);
        roleComparison.push({
          creative_name,
          first_touch_ratio: 0,
          mid_touch_ratio: 0,
          last_touch_ratio: 0,
          dominant_role: null
        });
        continue;
      }

      // 2-2. 핵심 지표 조회
      const metricsQuery = `
        SELECT 
          COUNT(DISTINCT us.visitor_id) as uv,
          ROUND(AVG(us.pageview_count)::NUMERIC, 1) as avg_pageviews,
          ROUND(AVG(us.duration_seconds)::NUMERIC, 0) as avg_duration
        FROM utm_sessions us
        WHERE us.utm_params->>'utm_content' = $1
          AND COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') = $2
          AND COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') = $3
          AND COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') = $4
          AND us.entry_timestamp >= $5
          AND us.entry_timestamp <= $6
      `;
      const metricsResult = await db.query(metricsQuery, [
        creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate
      ]);
      const metrics = metricsResult.rows[0] || {};

      // 2-3. 이탈률 조회
      const bounceQuery = `
        SELECT 
          ROUND(
            (COUNT(CASE WHEN s.is_bounced = true THEN 1 END)::FLOAT / 
             NULLIF(COUNT(DISTINCT s.session_id), 0) * 100)::NUMERIC, 1
          ) as bounce_rate
        FROM sessions s
        WHERE s.visitor_id = ANY($1)
          AND s.start_time >= $2
          AND s.start_time <= $3
      `;
      const bounceResult = await db.query(bounceQuery, [visitorIds, startDate, endDate]);
      const bounceRate = parseFloat(bounceResult.rows[0]?.bounce_rate) || 0;

      // 2-4. 전환 관련 지표 (구매자 및 막타 매출)
      const conversionQuery = `
        SELECT 
          COUNT(DISTINCT c.order_id) as conversion_count,
          SUM(c.final_payment) as total_revenue
        FROM conversions c
        WHERE c.visitor_id = ANY($1)
          AND c.order_id IS NOT NULL
          AND c.paid = 'T'
          AND c.final_payment > 0
      `;
      const conversionResult = await db.query(conversionQuery, [visitorIds]);
      const conversionCount = parseInt(conversionResult.rows[0]?.conversion_count) || 0;
      const totalRevenue = parseFloat(conversionResult.rows[0]?.total_revenue) || 0;
      const uv = parseInt(metrics.uv) || 0;
      const conversionRate = uv > 0 ? Math.round(conversionCount / uv * 1000) / 10 : 0;

      // 2-5. 막타 매출 계산 (마지막으로 본 광고가 이 소재인 경우)
      const lastTouchQuery = `
        WITH visitor_journeys AS (
          SELECT 
            us.visitor_id,
            us.utm_params->>'utm_content' as utm_content,
            COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') as utm_source,
            COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') as utm_medium,
            COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') as utm_campaign,
            us.sequence_order
          FROM utm_sessions us
          WHERE us.visitor_id = ANY($1)
            AND us.utm_params->>'utm_content' IS NOT NULL
        ),
        last_touches AS (
          SELECT DISTINCT ON (visitor_id) 
            visitor_id, utm_content, utm_source, utm_medium, utm_campaign
          FROM visitor_journeys
          ORDER BY visitor_id, sequence_order DESC
        )
        SELECT 
          SUM(c.final_payment) as last_touch_revenue
        FROM conversions c
        JOIN last_touches lt ON c.visitor_id = lt.visitor_id
        WHERE c.order_id IS NOT NULL
          AND c.paid = 'T'
          AND c.final_payment > 0
          AND lt.utm_content = $2
          AND lt.utm_source = $3
          AND lt.utm_medium = $4
          AND lt.utm_campaign = $5
      `;
      const lastTouchResult = await db.query(lastTouchQuery, [
        visitorIds, creative_name, utm_source, utm_medium, utm_campaign
      ]);
      const lastTouchRevenue = Math.round(parseFloat(lastTouchResult.rows[0]?.last_touch_revenue) || 0);

      creativesData.push({
        creative_name,
        utm_source,
        uv,
        conversion_count: conversionCount,
        conversion_rate: conversionRate,
        revenue: lastTouchRevenue,
        attributed_revenue: Math.round(totalRevenue * 0.5), // 간단한 기여 매출 추정
        avg_duration: parseInt(metrics.avg_duration) || 0,
        avg_pageviews: parseFloat(metrics.avg_pageviews) || 0,
        bounce_rate: bounceRate
      });

      // 2-6. 일별 추이 조회
      // FIX (2025-12-03): KST 기준으로 일별 집계
      const dailyQuery = `
        WITH daily_uv AS (
          SELECT 
            DATE(us.entry_timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul') as date,
            COUNT(DISTINCT us.visitor_id) as uv
          FROM utm_sessions us
          WHERE us.utm_params->>'utm_content' = $1
            AND COALESCE(NULLIF(us.utm_params->>'utm_source', ''), '-') = $2
            AND COALESCE(NULLIF(us.utm_params->>'utm_medium', ''), '-') = $3
            AND COALESCE(NULLIF(us.utm_params->>'utm_campaign', ''), '-') = $4
            AND us.entry_timestamp >= $5
            AND us.entry_timestamp <= $6
          GROUP BY DATE(us.entry_timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')
        ),
        daily_conv AS (
          SELECT 
            DATE(c.timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul') as date,
            COUNT(DISTINCT c.order_id) as conversion_count,
            SUM(c.final_payment) as revenue
          FROM conversions c
          WHERE c.visitor_id = ANY($7)
            AND c.order_id IS NOT NULL
            AND c.paid = 'T'
            AND c.final_payment > 0
            AND c.timestamp >= $5
            AND c.timestamp <= $6
          GROUP BY DATE(c.timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')
        )
        SELECT 
          COALESCE(u.date, c.date) as date,
          COALESCE(u.uv, 0) as uv,
          COALESCE(c.conversion_count, 0) as conversion_count,
          COALESCE(c.revenue, 0) as revenue
        FROM daily_uv u
        FULL OUTER JOIN daily_conv c ON u.date = c.date
        ORDER BY date ASC
      `;
      const dailyResult = await db.query(dailyQuery, [
        creative_name, utm_source, utm_medium, utm_campaign, startDate, endDate, visitorIds
      ]);
      dailyTrends.push(dailyResult.rows.map(row => ({
        date: row.date,
        uv: parseInt(row.uv) || 0,
        conversion_count: parseInt(row.conversion_count) || 0,
        revenue: Math.round(parseFloat(row.revenue) || 0)
      })));

      // 2-7. 광고 역할 분포 (구매자 기준)
      const purchaserQuery = `
        SELECT DISTINCT visitor_id
        FROM conversions
        WHERE visitor_id = ANY($1)
          AND order_id IS NOT NULL
          AND paid = 'T'
          AND final_payment > 0
      `;
      const purchaserResult = await db.query(purchaserQuery, [visitorIds]);
      const purchaserIds = purchaserResult.rows.map(r => r.visitor_id);

      if (purchaserIds.length === 0) {
        roleComparison.push({
          creative_name,
          first_touch_ratio: 0,
          mid_touch_ratio: 0,
          last_touch_ratio: 0,
          dominant_role: null
        });
        continue;
      }

      // 구매자들의 여정 조회
      const journeyQuery = `
        SELECT 
          visitor_id,
          utm_params->>'utm_content' as utm_content,
          COALESCE(NULLIF(utm_params->>'utm_source', ''), '-') as utm_source,
          COALESCE(NULLIF(utm_params->>'utm_medium', ''), '-') as utm_medium,
          COALESCE(NULLIF(utm_params->>'utm_campaign', ''), '-') as utm_campaign,
          sequence_order
        FROM utm_sessions
        WHERE visitor_id = ANY($1)
          AND utm_params->>'utm_content' IS NOT NULL
        ORDER BY visitor_id, sequence_order
      `;
      const journeyResult = await db.query(journeyQuery, [purchaserIds]);
      
      // visitor별 여정 그룹화
      const visitorJourneys = {};
      journeyResult.rows.forEach(row => {
        if (!visitorJourneys[row.visitor_id]) {
          visitorJourneys[row.visitor_id] = [];
        }
        visitorJourneys[row.visitor_id].push(row);
      });

      // 역할 카운트
      let firstTouchCount = 0;
      let midTouchCount = 0;
      let lastTouchCount = 0;

      purchaserIds.forEach(vid => {
        const journey = visitorJourneys[vid] || [];
        if (journey.length === 0) return;

        // 고유한 광고 조합 추출
        const uniqueCreatives = [];
        const seenKeys = new Set();
        
        journey.forEach(touch => {
          const touchKey = `${touch.utm_content}||${touch.utm_source}||${touch.utm_medium}||${touch.utm_campaign}`;
          if (!seenKeys.has(touchKey)) {
            seenKeys.add(touchKey);
            uniqueCreatives.push(touchKey);
          }
        });

        const targetIndex = uniqueCreatives.indexOf(targetKey);
        if (targetIndex === -1) return;

        if (targetIndex === 0 && uniqueCreatives.length === 1) {
          lastTouchCount++;
        } else if (targetIndex === 0) {
          firstTouchCount++;
        } else if (targetIndex === uniqueCreatives.length - 1) {
          lastTouchCount++;
        } else {
          midTouchCount++;
        }
      });

      const totalRoleCount = firstTouchCount + midTouchCount + lastTouchCount;
      const firstRatio = totalRoleCount > 0 ? Math.round(firstTouchCount / totalRoleCount * 100) : 0;
      const midRatio = totalRoleCount > 0 ? Math.round(midTouchCount / totalRoleCount * 100) : 0;
      const lastRatio = totalRoleCount > 0 ? Math.round(lastTouchCount / totalRoleCount * 100) : 0;

      // 지배적 역할 판단
      let dominantRole = null;
      if (lastRatio >= 40) {
        dominantRole = '막타형';
      } else if (firstRatio >= 40) {
        dominantRole = '첫 접점형';
      } else if (midRatio >= 30) {
        dominantRole = '중간 터치형';
      }

      roleComparison.push({
        creative_name,
        first_touch_ratio: firstRatio,
        mid_touch_ratio: midRatio,
        last_touch_ratio: lastRatio,
        dominant_role: dominantRole
      });
    }

    // 3. 응답
    res.json({
      success: true,
      period: { start, end },
      creatives_data: creativesData,
      daily_trends: dailyTrends,
      role_comparison: roleComparison
    });

  } catch (error) {
    console.error('Creative compare API error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to compare creatives',
      message: error.message 
    });
  }
});

module.exports = router;

