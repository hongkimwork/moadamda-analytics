// ============================================================================
// 광고 소재 퍼포먼스 커스텀 훅
// ============================================================================

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { fetchCreativePerformance } from '../services/creativePerformanceApi';

/**
 * 광고 소재 퍼포먼스 데이터 관리 훅
 * @returns {Object} 상태 및 핸들러
 */
export const useCreativePerformance = () => {
  // URL 쿼리 파라미터 읽기 (광고 클릭 카드에서 이동 시 search 파라미터 사용)
  const [searchParams] = useSearchParams();
  const initialSearchTerm = searchParams.get('search') || '';

  // 데이터 state
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(null);

  // 페이지네이션 state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(500);

  // 검색 및 필터 state
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [filters, setFilters] = useState({
    dateRange: [
      dayjs().subtract(29, 'day').format('YYYY-MM-DD'),
      dayjs().format('YYYY-MM-DD')
    ]
  });

  // 정렬 state
  const [sortField, setSortField] = useState('total_revenue');
  const [sortOrder, setSortOrder] = useState('desc');

  // 동적 UTM 필터 state
  const [activeUtmFilters, setActiveUtmFilters] = useState([]);
  
  // UTM Source 퀵 필터 state
  const [quickFilterSources, setQuickFilterSources] = useState([]);

  // 모달 state
  const [ordersModalVisible, setOrdersModalVisible] = useState(false);
  const [selectedCreative, setSelectedCreative] = useState(null);
  const [journeyModalVisible, setJourneyModalVisible] = useState(false);
  const [journeyCreative, setJourneyCreative] = useState(null);
  const [rawDataModalVisible, setRawDataModalVisible] = useState(false);
  const [rawDataCreative, setRawDataCreative] = useState(null);

  // 요약 통계 계산
  const summaryStats = useMemo(() => {
    if (!data || data.length === 0) {
      return { 
        totalRevenue: 0, 
        totalOrders: 0, 
        totalUV: 0, 
        maxRevenue: 0,
        totalLastTouchRevenue: 0,
        totalAttributedRevenue: 0,
        totalLastTouchCount: 0
      };
    }

    return data.reduce((acc, curr) => {
      acc.totalRevenue += (curr.attributed_revenue || 0);
      acc.totalOrders += (curr.contributed_orders_count || 0);
      acc.totalUV += (curr.unique_visitors || 0);
      acc.totalLastTouchRevenue += (curr.total_revenue || 0);
      acc.totalAttributedRevenue += (curr.attributed_revenue || 0);
      acc.totalLastTouchCount += (curr.last_touch_count || 0);
      acc.maxRevenue = Math.max(
        acc.maxRevenue,
        curr.total_revenue || 0,
        curr.attributed_revenue || 0
      );
      return acc;
    }, { 
      totalRevenue: 0, 
      totalOrders: 0, 
      totalUV: 0, 
      maxRevenue: 0,
      totalLastTouchRevenue: 0,
      totalAttributedRevenue: 0,
      totalLastTouchCount: 0
    });
  }, [data]);

  // 데이터 조회
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setData([]);

    try {
      const params = {
        start: filters.dateRange[0],
        end: filters.dateRange[1],
        page: currentPage,
        limit: pageSize,
        search: searchTerm,
        sort_by: sortField,
        sort_order: sortOrder
      };

      // 동적 UTM 필터 + 퀵 필터 병합
      const combinedFilters = [...activeUtmFilters];
      
      // 퀵 필터가 있으면 utm_source IN 조건 추가
      if (quickFilterSources.length > 0) {
        combinedFilters.push({
          key: 'utm_source',
          operator: 'in',
          value: quickFilterSources
        });
      }
      
      if (combinedFilters.length > 0) {
        params.utm_filters = JSON.stringify(combinedFilters);
      }

      const response = await fetchCreativePerformance(params);

      if (response.success) {
        setData(response.data || []);
        setTotal(response.pagination.total || 0);
      } else {
        throw new Error(response.error || '데이터를 불러올 수 없습니다.');
      }

      setLoading(false);
    } catch (err) {
      console.error('광고 소재 분석 데이터 조회 실패:', err);
      setError(err.response?.data?.error || err.message || '데이터를 불러올 수 없습니다.');
      setData([]);
      setLoading(false);
    }
  };

  // 의존성 변경 시 재조회
  useEffect(() => {
    fetchData();
  }, [currentPage, pageSize, filters, searchTerm, sortField, sortOrder, activeUtmFilters, quickFilterSources]);

  // 검색 핸들러
  const handleSearch = (term) => {
    setSearchTerm(term);
    setCurrentPage(1);
  };

  // 필터 변경 핸들러
  const handleFilterChange = (newFilters) => {
    const formattedFilters = { ...newFilters };
    
    if (newFilters.dateRange && newFilters.dateRange[0] && newFilters.dateRange[1]) {
      formattedFilters.dateRange = [
        newFilters.dateRange[0].format ? newFilters.dateRange[0].format('YYYY-MM-DD') : newFilters.dateRange[0],
        newFilters.dateRange[1].format ? newFilters.dateRange[1].format('YYYY-MM-DD') : newFilters.dateRange[1]
      ];
    } else if (!newFilters.dateRange) {
      formattedFilters.dateRange = [
        dayjs().format('YYYY-MM-DD'),
        dayjs().format('YYYY-MM-DD')
      ];
    }
    
    setFilters(formattedFilters);
    setCurrentPage(1);
  };

  // 초기화 핸들러
  const handleReset = () => {
    setSearchTerm('');
    setFilters({
      dateRange: [
        dayjs().subtract(29, 'day').format('YYYY-MM-DD'),
        dayjs().format('YYYY-MM-DD')
      ]
    });
    setSortField('total_revenue');
    setSortOrder('desc');
    setCurrentPage(1);
  };

  // 테이블 정렬 핸들러
  const handleTableChange = (pagination, filters, sorter) => {
    if (sorter.field) {
      setSortField(sorter.field);
      setSortOrder(sorter.order === 'ascend' ? 'asc' : 'desc');
    }
  };

  // 페이지네이션 핸들러
  const handlePageChange = (page, size) => {
    setCurrentPage(page);
    setPageSize(size);
  };

  return {
    // 데이터
    data,
    loading,
    total,
    error,
    summaryStats,
    
    // 필터 상태
    searchTerm,
    filters,
    sortField,
    sortOrder,
    currentPage,
    pageSize,
    activeUtmFilters,
    quickFilterSources,
    
    // 모달 상태
    ordersModalVisible,
    selectedCreative,
    journeyModalVisible,
    journeyCreative,
    rawDataModalVisible,
    rawDataCreative,
    
    // 상태 변경 함수
    setOrdersModalVisible,
    setSelectedCreative,
    setJourneyModalVisible,
    setJourneyCreative,
    setRawDataModalVisible,
    setRawDataCreative,
    setActiveUtmFilters,
    setQuickFilterSources,
    setError,
    
    // 핸들러
    handleSearch,
    handleFilterChange,
    handleReset,
    handleTableChange,
    handlePageChange,
    fetchData
  };
};
