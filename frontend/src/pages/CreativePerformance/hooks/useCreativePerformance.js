// ============================================================================
// 광고 소재 퍼포먼스 커스텀 훅
// ============================================================================

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { fetchCreativePerformance, fetchDistribution } from '../services/creativePerformanceApi';
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

  // 요청 ID 관리 (stale response 방지)
  const fetchIdRef = useRef(0);
  
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

  // 정렬 state (기본값: 기여한 결제액 내림차순, scoreSettings 로드 후 모수 평가점수로 전환)
  const [sortField, setSortField] = useState('attributed_revenue');
  const [sortOrder, setSortOrder] = useState('desc');

  // 초기 정렬 적용 여부 추적 (scoreSettings 로드 후 1회만 자동 전환)
  const initialSortAppliedRef = useRef(false);

  // 동적 UTM 필터 state
  const [activeUtmFilters, setActiveUtmFilters] = useState([]);
  
  // UTM Source 퀵 필터 state (저장된 값 우선 사용)
  const [quickFilterSources, setQuickFilterSources] = useState(() => {
    if (savedFilters?.quickFilterSources) {
      return savedFilters.quickFilterSources;
    }
    return ['meta', 'instagram', 'ig'];
  });

  // quickFilterSources는 플랫폼 퀵필터 버튼 상태 관리용 (데이터 조회에 직접 사용하지 않음)
  // 실제 데이터 조회 필터는 activeUtmFilters가 담당

  // 이상치 기준 state (저장된 값 우선 사용) - 상한선
  const [maxDuration, setMaxDuration] = useState(() => savedFilters?.maxDuration ?? 60);
  const [maxPv, setMaxPv] = useState(() => savedFilters?.maxPv ?? 15);
  const [maxScroll, setMaxScroll] = useState(() => savedFilters?.maxScroll ?? 10000);

  // 이하치 기준 state (저장된 값 우선 사용) - 하한선 (이 값 이하 제외)
  const [minDuration, setMinDuration] = useState(() => savedFilters?.minDuration ?? 0);
  const [minPv, setMinPv] = useState(() => savedFilters?.minPv ?? 0);
  const [minScroll, setMinScroll] = useState(() => savedFilters?.minScroll ?? 0);

  // UV 이하치 기준 state (이 값 이하인 광고 소재를 테이블 하단 배치)
  const [minUv, setMinUv] = useState(() => savedFilters?.minUv ?? 0);

  // FIX (2026-02-04): Attribution Window 선택 (30, 60, 90, 'all')
  const [attributionWindow, setAttributionWindow] = useState(() => savedFilters?.attributionWindow ?? '30');

  // FIX (2026-02-10): 매칭 방식 fingerprint 고정 (쿠키 + 회원ID + IP+기기+OS 3단계 매칭)
  const matchingMode = 'fingerprint';

  // 모달 state
  const [ordersModalVisible, setOrdersModalVisible] = useState(false);
  const [selectedCreative, setSelectedCreative] = useState(null);

  // 점수 설정 state
  const [scoreSettings, setScoreSettings] = useState(null);
  const [scoreSettingsLoading, setScoreSettingsLoading] = useState(true);

  // 분포 데이터 state
  const [distributionData, setDistributionData] = useState(null);
  const [distributionLoading, setDistributionLoading] = useState(false);

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

  // scoreSettings 로드 완료 후 초기 정렬 설정
  // 설정이 있으면 모수 평가점수 내림차순, 없으면 기여한 결제액 내림차순 유지
  useEffect(() => {
    if (scoreSettingsLoading) return;
    if (initialSortAppliedRef.current) return;
    initialSortAppliedRef.current = true;
    if (scoreSettings) {
      setSortField('traffic_score');
      setSortOrder('desc');
    }
  }, [scoreSettingsLoading, scoreSettings]);

  // 필터 설정 로컬스토리지 저장 (변경 시 자동 저장)
  useEffect(() => {
    if (!user?.id) return;
    
    const filtersToSave = {
      dateRange: filters.dateRange,
      quickFilterSources,
      maxDuration,
      maxPv,
      maxScroll,
      minDuration,
      minPv,
      minScroll,
      minUv,
      attributionWindow // FIX (2026-02-04): Attribution Window 저장
    };
    
    saveFiltersToStorage(user.id, filtersToSave);
  }, [user?.id, filters.dateRange, quickFilterSources, maxDuration, maxPv, maxScroll, minDuration, minPv, minScroll, minUv, attributionWindow]);

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

  // 서버 정렬 필드 계산 (클라이언트 전용 정렬 컬럼은 막타 결제액으로 대체)
  const CLIENT_SORT_COLUMNS = ['traffic_score', 'value_per_visitor', 'purchase_conversion_rate'];
  const serverSortField = CLIENT_SORT_COLUMNS.includes(sortField) ? 'total_revenue' : sortField;

  // 데이터 조회
  const fetchData = async (currentFetchId) => {
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
        sort_by: serverSortField,
        sort_order: sortOrder,
        max_duration: maxDuration,
        max_pv: maxPv,
        max_scroll: maxScroll,
        min_duration: minDuration,
        min_pv: minPv,
        min_scroll: minScroll,
        min_uv: minUv,
        attribution_window: attributionWindow, // FIX (2026-02-04): Attribution Window
        matching_mode: matchingMode // FIX (2026-02-10): 매칭 방식
      };

      // UTM 필터가 메인: activeUtmFilters를 그대로 사용
      if (activeUtmFilters.length > 0) {
        params.utm_filters = JSON.stringify(activeUtmFilters);
      }

      const response = await fetchCreativePerformance(params);

      // stale response 무시: 이 요청 이후 새로운 요청이 시작되었으면 무시
      if (currentFetchId !== fetchIdRef.current) {
        return;
      }

      if (response.success) {
        setData(response.data || []);
        setTotal(response.pagination.total || 0);
      } else {
        throw new Error(response.error || '데이터를 불러올 수 없습니다.');
      }

      setLoading(false);
    } catch (err) {
      // stale 요청의 에러도 무시
      if (currentFetchId !== fetchIdRef.current) return;
      console.error('광고 소재 분석 데이터 조회 실패:', err);
      setError(err.response?.data?.error || err.message || '데이터를 불러올 수 없습니다.');
      setData([]);
      setLoading(false);
    }
  };

  // 의존성 변경 시 재조회
  useEffect(() => {
    const id = ++fetchIdRef.current;
    fetchData(id);
  }, [currentPage, pageSize, filters, searchTerm, serverSortField, sortOrder, activeUtmFilters, maxDuration, maxPv, maxScroll, minDuration, minPv, minScroll, minUv, attributionWindow, matchingMode]);

  // 분포 데이터 조회 (날짜/플랫폼 필터 변경 시만 재조회)
  const fetchDistributionData = useCallback(async () => {
    setDistributionLoading(true);
    try {
      const params = {
        start: filters.dateRange[0],
        end: filters.dateRange[1]
      };

      // UTM 필터가 메인: activeUtmFilters를 그대로 사용
      if (activeUtmFilters.length > 0) {
        params.utm_filters = JSON.stringify(activeUtmFilters);
      }

      const response = await fetchDistribution(params);
      if (response.success) {
        setDistributionData(response.data);
      }
    } catch (err) {
      console.error('분포 데이터 조회 실패:', err);
    } finally {
      setDistributionLoading(false);
    }
  }, [filters.dateRange, activeUtmFilters]);

  // 분포 데이터 조회 (날짜/UTM 필터 변경 시)
  useEffect(() => {
    fetchDistributionData();
  }, [fetchDistributionData]);

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
    // 정렬 초기화: scoreSettings 유무에 따라 조건부 기본값
    if (scoreSettings) {
      setSortField('traffic_score');
    } else {
      setSortField('attributed_revenue');
    }
    setSortOrder('desc');
    setCurrentPage(1);
  };

  // 테이블 정렬 핸들러 (2단계 토글: 내림차순 ↔ 오름차순, 정렬 해제 없음)
  const handleTableChange = (pagination, filters, sorter) => {
    const key = sorter.columnKey || sorter.field;

    if (sorter.order) {
      // 정상 정렬 방향 변경 (새 컬럼 클릭 또는 방향 토글)
      if (!key) return;
      setSortField(key);
      setSortOrder(sorter.order === 'ascend' ? 'asc' : 'desc');
    } else {
      // 정렬 해제 시도 → 내림차순으로 되돌림 (현재 sortField 유지)
      // Ant Design은 취소 시 sorter.field/columnKey를 비워서 보내므로, 현재 sortField을 그대로 사용
      setSortOrder('desc');
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
    minDuration,
    minPv,
    minScroll,
    minUv,
    attributionWindow, // FIX (2026-02-04): Attribution Window
    // 모달 상태
    ordersModalVisible,
    selectedCreative,
    
    // 점수 설정 상태
    scoreSettings,
    scoreSettingsLoading,
    setScoreSettings,
    
    // 분포 데이터 상태
    distributionData,
    distributionLoading,
    
    // 상태 변경 함수
    setOrdersModalVisible,
    setSelectedCreative,
    setActiveUtmFilters,
    setQuickFilterSources,
    setMaxDuration,
    setMaxPv,
    setMaxScroll,
    setMinDuration,
    setMinPv,
    setMinScroll,
    setMinUv,
    setAttributionWindow, // FIX (2026-02-04): Attribution Window
    setError,
    
    // 핸들러
    handleSearch,
    handleFilterChange,
    handleReset,
    handleTableChange,
    handlePageChange,
    fetchData: () => { const id = ++fetchIdRef.current; fetchData(id); }
  };
};
