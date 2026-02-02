// ============================================================================
// 광고 소재 퍼포먼스 커스텀 훅
// ============================================================================

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { fetchCreativePerformance } from '../services/creativePerformanceApi';
import { fetchActivePreset } from '../services/scoreSettingsApi';
import { useAuth } from '../../../contexts/AuthContext';

// ============================================================================
// 로컬스토리지 유틸리티
// ============================================================================
const STORAGE_KEY_PREFIX = 'moadamda_creative_filters_';

/**
 * 사용자별 필터 설정 저장
 */
const saveFiltersToStorage = (userId, filters) => {
  if (!userId) return;
  try {
    const key = `${STORAGE_KEY_PREFIX}${userId}`;
    localStorage.setItem(key, JSON.stringify(filters));
  } catch (error) {
    console.warn('필터 설정 저장 실패:', error);
  }
};

/**
 * 사용자별 필터 설정 불러오기
 */
const loadFiltersFromStorage = (userId) => {
  if (!userId) return null;
  try {
    const key = `${STORAGE_KEY_PREFIX}${userId}`;
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.warn('필터 설정 불러오기 실패:', error);
    return null;
  }
};

/**
 * 광고 소재 퍼포먼스 데이터 관리 훅
 * @returns {Object} 상태 및 핸들러
 */
export const useCreativePerformance = () => {
  // 인증 정보
  const { user } = useAuth();
  
  // URL 쿼리 파라미터 읽기 (광고 클릭 카드에서 이동 시 search 파라미터 사용)
  const [searchParams] = useSearchParams();
  const initialSearchTerm = searchParams.get('search') || '';

  // 저장된 필터 설정 불러오기
  const savedFilters = useMemo(() => {
    return loadFiltersFromStorage(user?.id);
  }, [user?.id]);

  // 데이터 state
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(null);

  // 페이지네이션 state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(500);

  // 검색 및 필터 state (저장된 값 우선 사용)
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [filters, setFilters] = useState(() => {
    // 저장된 날짜 범위가 있으면 사용, 없으면 기본값
    return savedFilters?.dateRange 
      ? { dateRange: savedFilters.dateRange }
      : { dateRange: [dayjs().subtract(29, 'day').format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD')] };
  });

  // 정렬 state
  const [sortField, setSortField] = useState('total_revenue');
  const [sortOrder, setSortOrder] = useState('desc');

  // 동적 UTM 필터 state
  const [activeUtmFilters, setActiveUtmFilters] = useState([]);
  
  // UTM Source 퀵 필터 state (저장된 값 우선 사용)
  const [quickFilterSources, setQuickFilterSources] = useState(() => {
    if (savedFilters?.quickFilterSources) {
      return savedFilters.quickFilterSources;
    }
    return ['meta', 'instagram', 'ig'];
  });

  // 이상치 기준 state (저장된 값 우선 사용)
  const [maxDuration, setMaxDuration] = useState(() => savedFilters?.maxDuration ?? 60);
  const [maxPv, setMaxPv] = useState(() => savedFilters?.maxPv ?? 15);
  const [maxScroll, setMaxScroll] = useState(() => savedFilters?.maxScroll ?? 10000);

  // 모달 state
  const [ordersModalVisible, setOrdersModalVisible] = useState(false);
  const [selectedCreative, setSelectedCreative] = useState(null);

  // 점수 설정 state
  const [scoreSettings, setScoreSettings] = useState(null);
  const [scoreSettingsLoading, setScoreSettingsLoading] = useState(true);

  // 점수 설정 조회 (적용 중인 프리셋)
  useEffect(() => {
    const loadScoreSettings = async () => {
      try {
        const result = await fetchActivePreset();
        if (result.success) {
          setScoreSettings(result.data);
        }
      } catch (error) {
        console.error('점수 설정 조회 실패:', error);
      } finally {
        setScoreSettingsLoading(false);
      }
    };
    loadScoreSettings();
  }, []);

  // 필터 설정 로컬스토리지 저장 (변경 시 자동 저장)
  useEffect(() => {
    if (!user?.id) return;
    
    const filtersToSave = {
      dateRange: filters.dateRange,
      quickFilterSources,
      maxDuration,
      maxPv,
      maxScroll
    };
    
    saveFiltersToStorage(user.id, filtersToSave);
  }, [user?.id, filters.dateRange, quickFilterSources, maxDuration, maxPv, maxScroll]);

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
        sort_order: sortOrder,
        max_duration: maxDuration,
        max_pv: maxPv,
        max_scroll: maxScroll
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
  }, [currentPage, pageSize, filters, searchTerm, sortField, sortOrder, activeUtmFilters, quickFilterSources, maxDuration, maxPv, maxScroll]);

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
    maxDuration,
    maxPv,
    maxScroll,
    
    // 모달 상태
    ordersModalVisible,
    selectedCreative,
    
    // 점수 설정 상태
    scoreSettings,
    scoreSettingsLoading,
    setScoreSettings,
    
    // 상태 변경 함수
    setOrdersModalVisible,
    setSelectedCreative,
    setActiveUtmFilters,
    setQuickFilterSources,
    setMaxDuration,
    setMaxPv,
    setMaxScroll,
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
