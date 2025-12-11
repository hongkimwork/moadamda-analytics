// ============================================================================
// 광고 소재 퍼포먼스 페이지 (리팩토링)
// ============================================================================

import React from 'react';
import { Alert, message } from 'antd';
import dayjs from 'dayjs';
import { useCreativePerformance } from './hooks/useCreativePerformance';
import { getRowKey } from './utils/helpers';
import PerformanceHeader from './components/PerformanceHeader';
import PerformanceFilters from './components/PerformanceFilters';
import PerformanceTable from './components/PerformanceTable';
import CreativeOrdersModal from '../../components/CreativeOrdersModal';
import CreativeAnalysisModal from '../../components/CreativeAnalysisModal';
import CreativeJourneyModal from '../../components/CreativeJourneyModal';
import CreativeLandingModal from '../../components/CreativeLandingModal';
import CreativeCompareModal from '../../components/CreativeCompareModal';

/**
 * 광고 소재 퍼포먼스 페이지
 */
function CreativePerformance() {
  const {
    // 데이터
    data,
    loading,
    total,
    error,
    summaryStats,
    
    // 필터 상태
    filters,
    currentPage,
    pageSize,
    
    // 모달 상태
    ordersModalVisible,
    selectedCreative,
    analysisModalVisible,
    analysisCreative,
    journeyModalVisible,
    journeyCreative,
    landingModalVisible,
    landingCreative,
    selectedCreatives,
    compareModalVisible,
    
    // 상태 변경 함수
    setOrdersModalVisible,
    setSelectedCreative,
    setAnalysisModalVisible,
    setAnalysisCreative,
    setJourneyModalVisible,
    setJourneyCreative,
    setLandingModalVisible,
    setLandingCreative,
    setSelectedCreatives,
    setCompareModalVisible,
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
  } = useCreativePerformance();

  // 주문 보기 버튼 클릭 핸들러
  const handleViewOrders = (record) => {
    setSelectedCreative({
      creative_name: record.creative_name,
      utm_source: record.utm_source,
      utm_medium: record.utm_medium,
      utm_campaign: record.utm_campaign
    });
    setOrdersModalVisible(true);
  };

  // 성과 분석 버튼 클릭 핸들러
  const handleViewAnalysis = (record) => {
    setAnalysisCreative({
      creative_name: record.creative_name,
      utm_source: record.utm_source,
      utm_medium: record.utm_medium,
      utm_campaign: record.utm_campaign
    });
    setAnalysisModalVisible(true);
  };

  // 고객 여정 버튼 클릭 핸들러
  const handleViewJourney = (record) => {
    setJourneyCreative({
      creative_name: record.creative_name,
      utm_source: record.utm_source,
      utm_medium: record.utm_medium,
      utm_campaign: record.utm_campaign
    });
    setJourneyModalVisible(true);
  };

  // 페이지 분석 버튼 클릭 핸들러
  const handleViewLanding = (record) => {
    setLandingCreative({
      creative_name: record.creative_name,
      utm_source: record.utm_source,
      utm_medium: record.utm_medium,
      utm_campaign: record.utm_campaign
    });
    setLandingModalVisible(true);
  };

  // 소재 선택 핸들러 (비교용)
  const handleSelectCreative = (record, checked) => {
    const key = getRowKey(record);
    if (checked) {
      if (selectedCreatives.length < 5) {
        setSelectedCreatives([...selectedCreatives, { key, ...record }]);
      } else {
        message.warning('최대 5개까지 선택할 수 있습니다');
      }
    } else {
      setSelectedCreatives(selectedCreatives.filter(item => item.key !== key));
    }
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      const firstFive = data.slice(0, 5).map(record => ({ key: getRowKey(record), ...record }));
      setSelectedCreatives(firstFive);
      if (data.length > 5) {
        message.info('최대 5개까지 선택되었습니다');
      }
    } else {
      setSelectedCreatives([]);
    }
  };

  // 소재 비교 모달 열기
  const handleOpenCompare = () => {
    if (selectedCreatives.length < 2) {
      message.warning('비교하려면 최소 2개 이상 선택해주세요');
      return;
    }
    setCompareModalVisible(true);
  };

  return (
    <div style={{ padding: '24px', background: '#f5f7fa', minHeight: '100vh' }}>
      {/* 헤더 */}
      <PerformanceHeader
        total={total}
        selectedCreatives={selectedCreatives}
        onRefresh={fetchData}
        onCompare={handleOpenCompare}
        loading={loading}
      />

      {/* 검색 및 필터 */}
      <PerformanceFilters
        onSearch={handleSearch}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
        filters={filters}
        onQuickFilterChange={setQuickFilterSources}
        onUtmFilterChange={setActiveUtmFilters}
        loading={loading}
      />

      {/* 에러 표시 */}
      {error && (
        <Alert
          message="데이터 조회 실패"
          description={error}
          type="error"
          showIcon
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: '16px' }}
        />
      )}

      {/* 테이블 */}
      <PerformanceTable
        data={data}
        loading={loading}
        total={total}
        currentPage={currentPage}
        pageSize={pageSize}
        summaryStats={summaryStats}
        selectedCreatives={selectedCreatives}
        onTableChange={handleTableChange}
        onPageChange={handlePageChange}
        onSelectCreative={handleSelectCreative}
        onSelectAll={handleSelectAll}
        onViewOrders={handleViewOrders}
        onViewAnalysis={handleViewAnalysis}
        onViewJourney={handleViewJourney}
        onViewLanding={handleViewLanding}
      />

      {/* 푸터 */}
      <div style={{ 
        marginTop: '24px', 
        textAlign: 'center', 
        color: '#9ca3af',
        fontSize: '13px',
        fontWeight: 500,
        paddingBottom: '16px'
      }}>
        마지막 갱신: {dayjs().format('YYYY-MM-DD HH:mm:ss')}
      </div>

      {/* 주문 보기 모달 */}
      <CreativeOrdersModal
        visible={ordersModalVisible}
        onClose={() => {
          setOrdersModalVisible(false);
          setSelectedCreative(null);
        }}
        creative={selectedCreative}
        dateRange={{
          start: filters.dateRange[0],
          end: filters.dateRange[1]
        }}
      />

      {/* 성과 분석 모달 */}
      <CreativeAnalysisModal
        visible={analysisModalVisible}
        onClose={() => {
          setAnalysisModalVisible(false);
          setAnalysisCreative(null);
        }}
        creative={analysisCreative}
        dateRange={{
          start: filters.dateRange[0],
          end: filters.dateRange[1]
        }}
      />

      {/* 고객 여정 모달 */}
      <CreativeJourneyModal
        visible={journeyModalVisible}
        onClose={() => {
          setJourneyModalVisible(false);
          setJourneyCreative(null);
        }}
        creative={journeyCreative}
        dateRange={{
          start: filters.dateRange[0],
          end: filters.dateRange[1]
        }}
      />

      {/* 페이지 분석 모달 */}
      <CreativeLandingModal
        visible={landingModalVisible}
        onClose={() => {
          setLandingModalVisible(false);
          setLandingCreative(null);
        }}
        creative={landingCreative}
        dateRange={{
          start: filters.dateRange[0],
          end: filters.dateRange[1]
        }}
      />

      {/* 소재 비교 모달 */}
      <CreativeCompareModal
        visible={compareModalVisible}
        onClose={() => setCompareModalVisible(false)}
        creatives={selectedCreatives}
        dateRange={{
          start: filters.dateRange[0],
          end: filters.dateRange[1]
        }}
      />
    </div>
  );
}

export default CreativePerformance;
