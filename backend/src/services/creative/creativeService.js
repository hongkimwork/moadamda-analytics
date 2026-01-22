/**
 * 광고 소재 분석 Service
 * 비즈니스 로직 담당
 */

const { calculateCreativeAttribution } = require('../../utils/creativeAttribution');
const repository = require('./creativeRepository');
const { safeDecodeURIComponent, parseUtmFilters, validateSortColumn, isTruncated } = require('./utils');

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
    max_duration = 60
  } = params;

  // 1. 날짜 파라미터 검증
  if (!start || !end) {
    throw new Error('start and end dates are required (YYYY-MM-DD format)');
  }

  const startDate = new Date(start);
  startDate.setHours(0, 0, 0, 0);
  
  const endDate = new Date(end);
  endDate.setHours(23, 59, 59, 999);

  // 이상치 기준 검증 (30초~10분, 초 단위)
  const maxDurationSeconds = Math.min(Math.max(parseInt(max_duration) || 60, 30), 600);

  // 2. 페이지네이션 파라미터
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  // 3. 정렬 기준 검증 (SQL Injection 방지)
  const { sortBy, sortDirection, isDbSort, sortColumn, sortDirectionSQL } = 
    validateSortColumn(sort_by, sort_order);

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
  const { conditions: utmFilterConditions, nextIndex } = 
    parseUtmFilters(utm_filters, queryParams, paramIndex);
  paramIndex = nextIndex;

  // 6. Repository를 통해 데이터 조회 (병렬 처리)
  const [rawDataRows, totalCount] = await Promise.all([
    repository.getCreativeAggregation({
      startDate,
      endDate,
      searchCondition,
      utmFilterConditions,
      sortColumn,
      sortDirectionSQL,
      queryParams,
      maxDurationSeconds
    }),
    repository.getCreativeCount({
      startDate,
      endDate,
      searchCondition,
      utmFilterConditions,
      queryParams
    })
  ]);

  // 7. 응답 데이터 가공 (URL 디코딩 포함)
  const rawData = rawDataRows.map(row => ({
    creative_name: safeDecodeURIComponent(row.creative_name || '-'),
    utm_source: safeDecodeURIComponent(row.utm_source || '-'),
    utm_medium: safeDecodeURIComponent(row.utm_medium || '-'),
    utm_campaign: safeDecodeURIComponent(row.utm_campaign || '-'),
    unique_visitors: parseInt(row.unique_visitors) || 0,
    total_views: parseInt(row.total_views) || 0,
    avg_pageviews: parseFloat(row.avg_pageviews) || 0,
    avg_duration_seconds: parseFloat(row.avg_duration_seconds) || 0,
    avg_scroll_px: parseInt(row.avg_scroll_px) || 0,
    // 구매 데이터는 아래에서 병합
    purchase_count: 0,
    total_revenue: 0
  }));

  // 8. 디코딩된 키 기준으로 중복 데이터 병합 (인코딩 차이로 인한 중복 해결)
  const mergedDataMap = new Map();
  
  // 1단계: 정확히 일치하는 키로 먼저 그룹화
  rawData.forEach(row => {
    const key = `${row.creative_name}||${row.utm_source}||${row.utm_medium}||${row.utm_campaign}`;
    
    if (mergedDataMap.has(key)) {
      const existing = mergedDataMap.get(key);
      // UV 합산
      existing.unique_visitors += row.unique_visitors;
      // View 합산
      existing.total_views += row.total_views;
      // 총 페이지뷰, 총 체류시간, 총 스크롤 합산 (나중에 평균 재계산용)
      existing._total_pageviews += row.unique_visitors * row.avg_pageviews;
      existing._total_duration += row.unique_visitors * row.avg_duration_seconds;
      existing._total_scroll += row.unique_visitors * row.avg_scroll_px;
    } else {
      mergedDataMap.set(key, {
        ...row,
        _total_pageviews: row.unique_visitors * row.avg_pageviews,
        _total_duration: row.unique_visitors * row.avg_duration_seconds,
        _total_scroll: row.unique_visitors * row.avg_scroll_px
      });
    }
  });
  
  // 2단계: 잘린 광고명을 정상 광고명에 병합 (접두사 기반)
  const entries = Array.from(mergedDataMap.entries());
  const keysToDelete = new Set();
  
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
          longRow.total_views += shortRow.total_views;
          longRow._total_pageviews += shortRow._total_pageviews;
          longRow._total_duration += shortRow._total_duration;
          longRow._total_scroll += shortRow._total_scroll;
          
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
    total_views: row.total_views,
    avg_pageviews: row.unique_visitors > 0 
      ? Math.round((row._total_pageviews / row.unique_visitors) * 10) / 10 
      : 0,
    avg_duration_seconds: row.unique_visitors > 0 
      ? Math.round((row._total_duration / row.unique_visitors) * 10) / 10 
      : 0,
    avg_scroll_px: row.unique_visitors > 0 
      ? Math.round(row._total_scroll / row.unique_visitors) 
      : 0,
    purchase_count: row.purchase_count,
    total_revenue: row.total_revenue
  }));

  // 9. 기여도 계산 (결제건 기여 포함 수, 결제건 기여 금액, 기여 결제건 총 결제금액)
  const attributionData = await calculateCreativeAttribution(data, startDate, endDate);

  // 10. 기여도 데이터를 기본 데이터에 병합
  let finalData = data.map(row => {
    const creativeKey = `${row.creative_name}||${row.utm_source}||${row.utm_medium}||${row.utm_campaign}`;
    const attr = attributionData[creativeKey] || {};
    
    return {
      ...row,
      // 기존 purchase_count, total_revenue를 기여도 분석 결과로 대체
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

  // 11. JavaScript에서 정렬 (기여도 컬럼인 경우)
  if (!isDbSort) {
    finalData.sort((a, b) => {
      const aVal = a[sortBy] || 0;
      const bVal = b[sortBy] || 0;
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }

  // 12. 페이지네이션 처리
  const totalFinalCount = finalData.length;
  const paginatedData = finalData.slice(offset, offset + limitNum);

  // 13. 응답 데이터 반환
  return {
    success: true,
    period: {
      start: start,
      end: end
    },
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
