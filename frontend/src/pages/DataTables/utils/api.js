import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * 테이블 데이터를 조회하는 API 호출 함수
 * 
 * @param {string} tableName - 테이블 이름
 * @param {Object} options - 조회 옵션
 * @param {number} options.currentPage - 현재 페이지 (1부터 시작)
 * @param {number} options.pageSize - 페이지 크기
 * @param {string} options.searchTerm - 검색어
 * @param {Object} options.filters - 필터 객체
 * @param {Array} options.activeUtmFilters - 활성화된 UTM 필터
 * @returns {Promise<{data: Array, total: number}>}
 */
export const fetchTableData = async (tableName, options = {}) => {
  const {
    currentPage = 1,
    pageSize = 50,
    searchTerm = '',
    filters = {},
    activeUtmFilters = []
  } = options;

  const offset = (currentPage - 1) * pageSize;

  // API 파라미터 구성
  const params = {
    limit: pageSize,
    offset: offset
  };

  // 검색어 추가
  if (searchTerm) {
    params.search = searchTerm;
  }

  // 디바이스 필터 추가
  if (filters.device && filters.device !== 'all') {
    params.device_type = filters.device;
  }

  // 브라우저 필터 추가
  if (filters.browser && filters.browser !== 'all') {
    params.browser = filters.browser;
  }

  // OS 필터 추가
  if (filters.os && filters.os !== 'all') {
    params.os = filters.os;
  }

  // 이벤트 타입 필터 추가
  if (filters.event_type && filters.event_type !== 'all') {
    params.event_type = filters.event_type;
  }

  // 즉시 이탈 여부 필터 추가
  if (filters.is_bounced && filters.is_bounced !== 'all') {
    params.is_bounced = filters.is_bounced === 'true';
  }

  // 구매 여부 필터 추가
  if (filters.is_converted && filters.is_converted !== 'all') {
    params.is_converted = filters.is_converted === 'true';
  }

  // 동적 UTM 필터 추가
  if (activeUtmFilters && activeUtmFilters.length > 0) {
    params.utm_filters = JSON.stringify(activeUtmFilters);
  }

  // 날짜 범위 필터 추가
  if (filters.dateRange && filters.dateRange[0] && filters.dateRange[1]) {
    params.start_date = filters.dateRange[0].format('YYYY-MM-DD');
    params.end_date = filters.dateRange[1].format('YYYY-MM-DD');
  }

  const response = await axios.get(`${API_URL}/api/tables/${tableName}`, { params });

  // 안전한 데이터 처리
  const fetchedData = response.data?.data || [];
  const filteredData = fetchedData.filter(item => item && Object.keys(item).length > 0);

  return {
    data: filteredData,
    total: parseInt(response.data?.total || 0)
  };
};
