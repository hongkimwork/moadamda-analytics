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
      'total_contributed_revenue'
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
      
      return result;
    };

    const data = dataResult.rows.map(row => ({
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
        // total_revenue: 이 광고를 거쳐간 주문들의 총액 (total_contributed_revenue와 동일한 의미로 사용)
        total_revenue: Math.round(attr.total_contributed_revenue || 0),
        
        contributed_orders_count: attr.contributed_orders_count || 0,
        attributed_revenue: Math.round(attr.attributed_revenue || 0),
        total_contributed_revenue: Math.round(attr.total_contributed_revenue || 0)
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

module.exports = router;

