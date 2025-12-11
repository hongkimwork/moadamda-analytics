import { useState, useEffect } from 'react';
import { fetchTableData } from '../utils/api';

/**
 * 데이터 테이블 공통 훅
 * 검색, 필터, 페이지네이션, 데이터 페칭을 관리
 * 
 * @param {string} tableName - 테이블 이름
 * @returns {Object} 테이블 상태 및 핸들러
 */
export const useDataTable = (tableName) => {
  // 데이터 상태
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(null);

  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // 검색 및 필터 상태
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    device: 'all',
    browser: 'all',
    os: 'all',
    is_bounced: 'all',
    is_converted: 'all',
    utm_source: 'all',
    utm_medium: 'all',
    utm_campaign: 'all',
    dateRange: null
  });

  // 동적 UTM 필터 상태
  const [activeUtmFilters, setActiveUtmFilters] = useState([]);

  // 데이터 조회 함수
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      setData([]); // 로딩 시작 시 데이터 초기화

      const result = await fetchTableData(tableName, {
        currentPage,
        pageSize,
        searchTerm,
        filters,
        activeUtmFilters
      });

      setData(result.data);
      setTotal(result.total);
      setLoading(false);
    } catch (err) {
      console.error('테이블 데이터 조회 실패:', err);
      setError(err.response?.data?.error || '데이터를 불러올 수 없습니다.');
      setData([]); // 에러 시에도 빈 배열로 초기화
      setLoading(false);
    }
  };

  // 테이블, 페이지, 검색어, 필터 변경 시 데이터 재조회
  useEffect(() => {
    if (tableName) {
      loadData();
    }
  }, [tableName, currentPage, pageSize, searchTerm, filters, activeUtmFilters]);

  // 검색 핸들러
  const handleSearch = (term) => {
    setSearchTerm(term);
    setCurrentPage(1); // 검색 시 첫 페이지로 이동
  };

  // 필터 변경 핸들러
  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    setCurrentPage(1); // 필터 변경 시 첫 페이지로 이동
  };

  // 초기화 핸들러
  const handleReset = () => {
    setSearchTerm('');
    setFilters({
      device: 'all',
      browser: 'all',
      os: 'all',
      is_bounced: 'all',
      is_converted: 'all',
      utm_source: 'all',
      utm_medium: 'all',
      utm_campaign: 'all',
      dateRange: null
    });
    setCurrentPage(1);
  };

  // 페이지 변경 핸들러
  const handlePageChange = (page, size) => {
    setCurrentPage(page);
    setPageSize(size);
  };

  // UTM 필터 변경 핸들러
  const handleUtmFilterChange = (utmFilters) => {
    setActiveUtmFilters(utmFilters);
  };

  return {
    // 데이터 상태
    data,
    loading,
    total,
    error,
    
    // 페이지네이션 상태
    currentPage,
    pageSize,
    
    // 검색/필터 상태
    searchTerm,
    filters,
    activeUtmFilters,
    
    // 핸들러
    handleSearch,
    handleFilterChange,
    handleReset,
    handlePageChange,
    handleUtmFilterChange,
    refreshData: loadData,
    setError
  };
};
