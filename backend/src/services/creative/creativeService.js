/**
 * 광고 소재 분석 Service
 * 비즈니스 로직 담당
 * 
 * FIX (2026-02-05): ad_id 기반 병합으로 전환
 * - 기존: 광고명 기반 복잡한 병합 로직 (URL 디코딩, 접두사 매칭, (중지) 제거 등)
 * - 변경: DB에서 ad_id 기준으로 이미 병합된 데이터 사용
 * - 장점: 광고명 변경해도 자동 병합, 코드 단순화
 */

const { calculateCreativeAttribution } = require('../../utils/creativeAttribution');
const repository = require('./creativeRepository');
const { safeDecodeURIComponent, parseUtmFilters, validateSortColumn } = require('./utils');

/**
 * 광고 소재 성과 데이터 조회 및 분석
 * @param {Object} params - 요청 파라미터
 * @returns {Promise<Object>} - 성과 데이터 및 페이지네이션 정보
 */
async function getCreativePerformance(params) {
  const {
    start,
    end,
    page = 1,
    limit = 50,
    search = '',
    sort_by = 'total_revenue',
    sort_order = 'desc',
    utm_filters = '[]',
    max_duration = 60,
    max_pv = 15,
    max_scroll = 10000,
    min_duration = 0,
    min_pv = 0,
    min_scroll = 0,
    attribution_window = '30'
  } = params;
  
  // Attribution Window 파싱
  let attributionWindowDays = 30;
  if (attribution_window === 'all') {
    attributionWindowDays = null;
  } else {
    const parsed = parseInt(attribution_window, 10);
    if ([30, 60, 90].includes(parsed)) {
      attributionWindowDays = parsed;
    }
  }

  // 1. 날짜 파라미터 검증
  if (!start || !end) {
    throw new Error('start and end dates are required (YYYY-MM-DD format)');
  }

  const startDate = new Date(start);
  startDate.setHours(0, 0, 0, 0);
  
  const endDate = new Date(end);
  endDate.setHours(23, 59, 59, 999);

  // 이상치/이하치 기준 검증
  const maxDurationSeconds = Math.min(Math.max(parseInt(max_duration) || 60, 30), 600);
  const maxPvCount = Math.min(Math.max(parseInt(max_pv) || 15, 5), 35);
  const maxScrollPx = Math.min(Math.max(parseInt(max_scroll) || 10000, 5000), 30000);

  let minDurationSeconds = Math.max(parseInt(min_duration) || 0, 0);
  let minPvCount = Math.max(parseInt(min_pv) || 0, 0);
  let minScrollPx = Math.max(parseInt(min_scroll) || 0, 0);

  // 범위 충돌 방지
  if (minDurationSeconds >= maxDurationSeconds) minDurationSeconds = 0;
  if (minPvCount >= maxPvCount) minPvCount = 0;
  if (minScrollPx >= maxScrollPx) minScrollPx = 0;

  // 2. 페이지네이션 파라미터
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  // 3. 정렬 기준 검증
  const { sortBy, sortDirection, sortColumn, sortDirectionSQL } = 
    validateSortColumn(sort_by, sort_order);

  // 4. UTM 필터 파싱
  // FIX (2026-02-06): utm_source 필터는 광고 단위로 적용, 나머지는 진입 기록 단위로 적용
  // utm_source가 빈 값이어도 ad_id가 동일한 실제 광고 클릭이 누락되지 않도록 함
  const allFilters = utm_filters ? (typeof utm_filters === 'string' ? JSON.parse(utm_filters) : utm_filters) : [];
  const sourceFilters = allFilters.filter(f => f.key === 'utm_source');
  const entryFilters = allFilters.filter(f => f.key !== 'utm_source');

  const queryParams = [startDate, endDate];
  let paramIndex = 3;

  // 진입 기록 단위 조건 (utm_medium, utm_campaign 등 - all_entries CTE 내부에서 적용)
  const { conditions: entryUtmConditions, nextIndex: ni1 } = 
    parseUtmFilters(entryFilters.length > 0 ? entryFilters : null, queryParams, paramIndex);
  paramIndex = ni1;

  // 광고 단위 조건 (utm_source - 최종 SELECT WHERE에서 적용)
  // 집계된 컬럼(ec.utm_source)에 대해 필터링하므로 columnFormat: 'column' 사용
  const { conditions: adLevelSourceConditions, nextIndex: ni2 } = 
    parseUtmFilters(sourceFilters.length > 0 ? sourceFilters : null, queryParams, paramIndex, { columnFormat: 'column' });
  paramIndex = ni2;

  // 5. Repository를 통해 데이터 조회 (ad_id 기준으로 이미 병합됨)
  const [rawDataRows, totalCount] = await Promise.all([
    repository.getCreativeAggregation({
      startDate,
      endDate,
      searchCondition: '', // 검색은 JS에서 처리
      utmFilterConditions: entryUtmConditions,
      adLevelFilterConditions: adLevelSourceConditions,
      sortColumn,
      sortDirectionSQL,
      queryParams,
      maxDurationSeconds,
      maxPvCount,
      maxScrollPx,
      minDurationSeconds,
      minPvCount,
      minScrollPx
    }),
    repository.getCreativeCount({
      startDate,
      endDate,
      searchCondition: '',
      utmFilterConditions: entryUtmConditions,
      adLevelFilterConditions: adLevelSourceConditions,
      queryParams,
      minDurationSeconds,
      minPvCount,
      minScrollPx
    })
  ]);

  // 6. 응답 데이터 가공
  // FIX (2026-02-05): DB에서 이미 ad_id 기준으로 병합됨, 복잡한 병합 로직 불필요
  const data = rawDataRows.map(row => {
    // variant_names 배열 디코딩 (수집된 광고명 이력)
    const variantNames = (row.variant_names || []).map(name => safeDecodeURIComponent(name));
    
    return {
      ad_id: row.ad_id, // ad_id 추가 (기여도 계산용)
      creative_name: safeDecodeURIComponent(row.creative_name ?? '-'),
      utm_source: safeDecodeURIComponent(row.utm_source ?? '-'),
      utm_medium: safeDecodeURIComponent(row.utm_medium ?? '-'),
      utm_campaign: safeDecodeURIComponent(row.utm_campaign ?? '-'),
      unique_visitors: parseInt(row.unique_visitors) || 0,
      total_views: parseInt(row.total_views) || 0,
      avg_pageviews: parseFloat(row.avg_pageviews) || 0,
      avg_duration_seconds: parseFloat(row.avg_duration_seconds) || 0,
      avg_scroll_px: parseInt(row.avg_scroll_px) || 0,
      purchase_count: 0,
      total_revenue: 0,
      _variant_names: variantNames, // 수집된 광고명 이력 (상세 조회용)
      is_meta_matched: row.is_meta_matched === true
    };
  });

  // 7. 검색 필터 적용 (JavaScript에서 처리)
  let filteredData = data;
  if (search) {
    const searchLower = search.toLowerCase();
    filteredData = data.filter(row => 
      row.creative_name && row.creative_name.toLowerCase().includes(searchLower)
    );
  }

  // 8. 기여도 계산
  // FIX (2026-02-05): ad_id 기반으로 기여도 계산
  const attributionData = await calculateCreativeAttribution(filteredData, startDate, endDate, attributionWindowDays);

  // 9. 기여도 데이터 병합
  // FIX (2026-02-05): ad_id 기반 키로 기여도 매칭
  let finalData = filteredData.map(row => {
    const creativeKey = `${row.ad_id}||${row.utm_medium}||${row.utm_campaign}`;
    const attr = attributionData[creativeKey] || {};
    
    return {
      ...row,
      purchase_count: attr.contributed_orders_count || 0,
      total_revenue: Math.round(attr.last_touch_revenue || 0),
      contributed_orders_count: attr.contributed_orders_count || 0,
      attributed_revenue: Math.round(attr.attributed_revenue || 0),
      total_contributed_revenue: Math.round(attr.total_contributed_revenue || 0),
      single_touch_count: attr.single_touch_count || 0,
      last_touch_count: attr.last_touch_count || 0,
      last_touch_revenue: Math.round(attr.last_touch_revenue || 0)
    };
  });

  // 10. JavaScript에서 정렬
  finalData.sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];
    
    const numA = Number(aVal);
    const numB = Number(bVal);
    
    if (!isNaN(numA) && !isNaN(numB)) {
      aVal = numA;
      bVal = numB;
    } else {
      aVal = aVal || '';
      bVal = bVal || '';
    }
    
    if (aVal === bVal) return 0;
    return sortDirection === 'asc' 
      ? (aVal > bVal ? 1 : -1) 
      : (aVal < bVal ? 1 : -1);
  });

  // 11. 페이지네이션 처리
  const totalFinalCount = finalData.length;
  const paginatedData = finalData.slice(offset, offset + limitNum);

  // 12. 응답 데이터 반환
  return {
    success: true,
    period: { start, end },
    attribution_window: attributionWindowDays,
    data: paginatedData,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: totalFinalCount,
      total_pages: Math.ceil(totalFinalCount / limitNum)
    }
  };
}

module.exports = {
  getCreativePerformance
};
