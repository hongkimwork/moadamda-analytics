/**
 * 광고 소재 분석 Service
 * 비즈니스 로직 담당
 */

const { calculateCreativeAttribution } = require('../../utils/creativeAttribution');
const repository = require('./creativeRepository');
const { safeDecodeURIComponent, parseUtmFilters, validateSortColumn } = require('./utils');
const { getMetaAdNames, mapToMetaAdName } = require('./metaAdNameMapping');

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
    max_scroll = 10000
  } = params;

  // 1. 날짜 파라미터 검증
  if (!start || !end) {
    throw new Error('start and end dates are required (YYYY-MM-DD format)');
  }

  const startDate = new Date(start);
  startDate.setHours(0, 0, 0, 0);
  
  const endDate = new Date(end);
  endDate.setHours(23, 59, 59, 999);

  // 이상치 기준 검증
  // 체류시간: 30초~10분 (초 단위)
  const maxDurationSeconds = Math.min(Math.max(parseInt(max_duration) || 60, 30), 600);
  // PV: 5~35
  const maxPvCount = Math.min(Math.max(parseInt(max_pv) || 15, 5), 35);
  // 스크롤: 5000~30000 (px 단위)
  const maxScrollPx = Math.min(Math.max(parseInt(max_scroll) || 10000, 5000), 30000);

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
      maxDurationSeconds,
      maxPvCount,
      maxScrollPx
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
  // FIX (2026-01-27): 빈 문자열도 유효한 값으로 유지 (|| 대신 ?? 사용)
  // - utm_content가 빈 문자열인 경우가 실제로 존재함
  // - 빈 문자열을 '-'로 변환하면 원본 URL 조회 등에서 문제 발생
  
  
  const rawData = rawDataRows.map(row => ({
    creative_name: safeDecodeURIComponent(row.creative_name ?? '-'),
    utm_source: safeDecodeURIComponent(row.utm_source ?? '-'),
    utm_medium: safeDecodeURIComponent(row.utm_medium ?? '-'),
    utm_campaign: safeDecodeURIComponent(row.utm_campaign ?? '-'),
    unique_visitors: parseInt(row.unique_visitors) || 0,
    total_views: parseInt(row.total_views) || 0,
    avg_pageviews: parseFloat(row.avg_pageviews) || 0,
    avg_duration_seconds: parseFloat(row.avg_duration_seconds) || 0,
    avg_scroll_px: parseInt(row.avg_scroll_px) || 0,
    // 구매 데이터는 아래에서 병합
    purchase_count: 0,
    total_revenue: 0
  }));

  // 8. 메타 광고명 기준으로 데이터 병합
  // 메타 API에서 전체 광고명 목록 가져오기
  const metaAdNames = await getMetaAdNames();
  
  // 메타 광고명별로 데이터 그룹화
  const mergedDataMap = new Map();
  const unmappedRows = [];
  
  for (const row of rawData) {
    // 메타 광고명으로 매핑 시도
    const metaName = await mapToMetaAdName(row.creative_name, metaAdNames);
    
    if (metaName) {
      // 매핑 성공: 메타 광고명 기준으로 그룹화
      // utm_source가 '-' 또는 null인 경우도 동일 광고로 병합
      const key = `${metaName}||${row.utm_medium}||${row.utm_campaign}`;
      // FIX (2026-01-27): utm_source가 '-'인 경우 'meta'로 통일
      const normalizedUtmSource = (row.utm_source === '-' || !row.utm_source) ? 'meta' : row.utm_source;
      
      if (mergedDataMap.has(key)) {
        const existing = mergedDataMap.get(key);
        existing.unique_visitors += row.unique_visitors;
        existing.total_views += row.total_views;
        existing._total_pageviews += row.unique_visitors * row.avg_pageviews;
        existing._total_duration += row.unique_visitors * row.avg_duration_seconds;
        existing._total_scroll += row.unique_visitors * row.avg_scroll_px;
        // 원본 광고명들 추적 (상세 조회용)
        if (!existing._variant_names.includes(row.creative_name)) {
          existing._variant_names.push(row.creative_name);
        }
      } else {
        mergedDataMap.set(key, {
          creative_name: metaName, // 메타 광고명으로 통일
          utm_source: normalizedUtmSource, // '-'이면 meta로
          utm_medium: row.utm_medium,
          utm_campaign: row.utm_campaign,
          unique_visitors: row.unique_visitors,
          total_views: row.total_views,
          _total_pageviews: row.unique_visitors * row.avg_pageviews,
          _total_duration: row.unique_visitors * row.avg_duration_seconds,
          _total_scroll: row.unique_visitors * row.avg_scroll_px,
          purchase_count: 0,
          total_revenue: 0,
          _variant_names: [row.creative_name] // 원본 광고명 추적
        });
      }
    } else {
      // 매핑 실패: 그대로 유지 (깨진 문자, 메타에 없는 광고 등)
      unmappedRows.push({
        ...row,
        _total_pageviews: row.unique_visitors * row.avg_pageviews,
        _total_duration: row.unique_visitors * row.avg_duration_seconds,
        _total_scroll: row.unique_visitors * row.avg_scroll_px,
        _variant_names: [row.creative_name]
      });
    }
  }
  
  // 매핑되지 않은 행들도 맵에 추가 (원래 키 그대로)
  unmappedRows.forEach(row => {
    const key = `${row.creative_name}||${row.utm_source}||${row.utm_medium}||${row.utm_campaign}`;
    if (!mergedDataMap.has(key)) {
      mergedDataMap.set(key, row);
    }
  });
  
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
    total_revenue: row.total_revenue,
    _variant_names: row._variant_names // 상세 조회용 원본 광고명들
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

  // 11. JavaScript에서 정렬 (기여도 컬럼이거나 DB 정렬 이후 병합 과정에서 순서가 섞인 경우)
  if (true) { // 항상 JS 정렬 수행 (병합 로직 때문)
    finalData.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      
      // 숫자로 변환 가능한 경우 숫자로 비교 (문자열 정렬 방지)
      const numA = Number(aVal);
      const numB = Number(bVal);
      
      if (!isNaN(numA) && !isNaN(numB)) {
        aVal = numA;
        bVal = numB;
      } else {
        // 문자열인 경우 null 처리 및 기본값
        aVal = aVal || '';
        bVal = bVal || '';
      }
      
      if (aVal === bVal) return 0;
      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
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
