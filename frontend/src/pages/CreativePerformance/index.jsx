// ============================================================================
// 광고 소재 퍼포먼스 페이지 (리팩토링)
// ============================================================================

import { useState, useEffect } from 'react';
import { Alert } from 'antd';
import dayjs from 'dayjs';
import { useCreativePerformance } from './hooks/useCreativePerformance';
import PerformanceHeader from './components/PerformanceHeader';
import InsightCards from './components/InsightCards';
import PerformanceFilters from './components/PerformanceFilters';
import PerformanceTable from './components/PerformanceTable';
import CreativeOrdersModal from '../../components/CreativeOrdersModal';
import CreativeJourneyModal from '../../components/CreativeJourneyModal';
import TestResultModal from '../../components/TestResultModal';

/**
 * 광고 소재 퍼포먼스 페이지
 */
function CreativePerformance() {
  // 마지막 갱신 시간 state
  const [lastUpdated, setLastUpdated] = useState(dayjs());
  
  // 테스트 결과 모달 state
  const [testResultModalVisible, setTestResultModalVisible] = useState(false);

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
    journeyModalVisible,
    journeyCreative,
    
    // 상태 변경 함수
    setOrdersModalVisible,
    setSelectedCreative,
    setJourneyModalVisible,
    setJourneyCreative,
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

  // 로딩 완료 시 갱신 시간 업데이트
  useEffect(() => {
    if (!loading && data.length >= 0) {
      setLastUpdated(dayjs());
    }
  }, [loading, data.length]);

  // 새로고침 핸들러 (갱신 시간 업데이트 포함)
  const handleRefresh = () => {
    fetchData();
    setLastUpdated(dayjs());
  };

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

  return (
    <div style={{ padding: '24px', background: '#f5f7fa', minHeight: '100vh' }}>
      {/* 헤더 */}
      <PerformanceHeader
        onRefresh={handleRefresh}
        loading={loading}
        lastUpdated={lastUpdated}
        onTestResult={() => setTestResultModalVisible(true)}
      />

      {/* 인사이트 카드 (Top 5 랭킹) */}
      <InsightCards data={data} />

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
        onTableChange={handleTableChange}
        onPageChange={handlePageChange}
        onViewOrders={handleViewOrders}
        onViewJourney={handleViewJourney}
      />

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

      {/* 테스트 결과 모달 */}
      <TestResultModal
        visible={testResultModalVisible}
        onClose={() => setTestResultModalVisible(false)}
      />
    </div>
  );
}

export default CreativePerformance;
