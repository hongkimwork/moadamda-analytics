// ============================================================================
// 광고 소재 퍼포먼스 페이지 (리팩토링)
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { Alert, Modal, message, Spin } from 'antd';
import dayjs from 'dayjs';
import { useCreativePerformance } from './hooks/useCreativePerformance';
import { fetchCreativeOriginalUrl } from './services/creativePerformanceApi';
import { getRowKey } from './utils/helpers';
import PerformanceHeader from './components/PerformanceHeader';
import InsightCards from './components/InsightCards';
import PerformanceFilters from './components/PerformanceFilters';
import PerformanceTable from './components/PerformanceTable';
import CreativeOrdersModal from '../../components/CreativeOrdersModal';
import CreativeSessionsModal from '../../components/CreativeSessionsModal';
import CreativeEntriesModal from '../../components/CreativeEntriesModal';
import ScoreSettingsModal from './components/ScoreSettingsModal';
import CreativeMediaPreviewModal from './components/CreativeMediaPreviewModal';

/**
 * 광고 소재 퍼포먼스 페이지
 */
function CreativePerformance() {
  // 마지막 갱신 시간 state
  const [lastUpdated, setLastUpdated] = useState(dayjs());

  // 점수 설정 모달 state
  const [scoreSettingsModalVisible, setScoreSettingsModalVisible] = useState(false);

  // 세션 상세 모달 state (UV 클릭)
  const [sessionsModalVisible, setSessionsModalVisible] = useState(false);
  const [sessionsCreative, setSessionsCreative] = useState(null);

  // 진입 목록 모달 state (View 클릭)
  const [entriesModalVisible, setEntriesModalVisible] = useState(false);
  const [entriesCreative, setEntriesCreative] = useState(null);

  // 원본 URL 모달 state
  const [originalUrlModalVisible, setOriginalUrlModalVisible] = useState(false);
  const [originalUrlData, setOriginalUrlData] = useState(null);
  const [originalUrlLoading, setOriginalUrlLoading] = useState(false);

  // 미디어 프리뷰 모달 state
  const [mediaPreviewModalVisible, setMediaPreviewModalVisible] = useState(false);
  const [mediaPreviewCreativeName, setMediaPreviewCreativeName] = useState(null);

  // 인사이트 패널 토글 state (기본: 숨김)
  const [showInsight, setShowInsight] = useState(false);

  // 인사이트 카드 클릭 → 테이블 행 하이라이트 state
  const [highlightRowKey, setHighlightRowKey] = useState(null);

  // 인사이트 카드 항목 클릭 핸들러
  const handleInsightItemClick = useCallback((item) => {
    const key = getRowKey(item);
    // 동일 키 재클릭 시에도 다시 트리거되도록 한번 null로 리셋
    setHighlightRowKey(null);
    setTimeout(() => setHighlightRowKey(key), 0);
  }, []);

  const {
    // 데이터
    data,
    loading,
    total,
    error,
    summaryStats,

    // 필터 상태
    filters,
    activeUtmFilters,
    quickFilterSources,
    platformLinked,
    currentPage,
    pageSize,
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

    // 상태 변경 함수
    setOrdersModalVisible,
    setSelectedCreative,
    setActiveUtmFilters,
    setQuickFilterSources,
    setPlatformLinked,
    setMaxDuration,
    setMaxPv,
    setMaxScroll,
    setMinDuration,
    setMinPv,
    setMinScroll,
    setMinUv,
    setAttributionWindow, // FIX (2026-02-04): Attribution Window
    setError,

    // 점수 설정
    scoreSettings,
    setScoreSettings,

    // 분포 데이터
    distributionData,
    distributionLoading,

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
    if (!loading) {
      setLastUpdated(dayjs());
    }
  }, [loading]);

  // 새로고침 핸들러 (갱신 시간 업데이트 포함)
  const handleRefresh = () => {
    fetchData();
    setLastUpdated(dayjs());
  };

  // 주문 보기 버튼 클릭 핸들러
  // FIX (2026-02-05): ad_id 추가 (메인 테이블과 동일한 기준으로 조회)
  const handleViewOrders = (record) => {
    setSelectedCreative({
      ad_id: record.ad_id,
      creative_name: record.creative_name,
      utm_source: record.utm_source,
      utm_medium: record.utm_medium,
      utm_campaign: record.utm_campaign,
      unique_visitors: record.unique_visitors,
      avg_pageviews: record.avg_pageviews,
      avg_duration_seconds: record.avg_duration_seconds
    });
    setOrdersModalVisible(true);
  };

  // 세션 상세 보기 핸들러 (UV 클릭)
  // FIX (2026-02-05): ad_id 추가 (메인 테이블과 동일한 기준으로 조회)
  const handleViewSessions = (record) => {
    setSessionsCreative({
      ad_id: record.ad_id,
      creative_name: record.creative_name,
      utm_source: record.utm_source,
      utm_medium: record.utm_medium,
      utm_campaign: record.utm_campaign,
      last_touch_count: record.last_touch_count
    });
    setSessionsModalVisible(true);
  };

  // 진입 목록 보기 핸들러 (View 클릭)
  // FIX (2026-02-05): ad_id 추가 (메인 테이블과 동일한 기준으로 조회)
  const handleViewEntries = (record) => {
    setEntriesCreative({
      ad_id: record.ad_id,
      creative_name: record.creative_name,
      utm_source: record.utm_source,
      utm_medium: record.utm_medium,
      utm_campaign: record.utm_campaign
    });
    setEntriesModalVisible(true);
  };

  // 원본 URL 보기 핸들러
  const handleViewOriginalUrl = async (record) => {
    setOriginalUrlLoading(true);
    setOriginalUrlModalVisible(true);
    setOriginalUrlData({ creative_name: record.creative_name });

    try {
      const result = await fetchCreativeOriginalUrl({
        creative_name: record.creative_name,
        utm_source: record.utm_source,
        utm_medium: record.utm_medium,
        utm_campaign: record.utm_campaign,
        start: filters.dateRange[0],
        end: filters.dateRange[1]
      });

      if (result.success) {
        setOriginalUrlData({
          creative_name: record.creative_name,
          ...result.data
        });
      } else {
        message.error('원본 URL을 불러올 수 없습니다');
      }
    } catch (err) {
      console.error('원본 URL 조회 실패:', err);
      message.error('원본 URL 조회 중 오류가 발생했습니다');
    } finally {
      setOriginalUrlLoading(false);
    }
  };

  // URL 복사 핸들러
  const handleCopyUrl = (url) => {
    navigator.clipboard.writeText(url);
    message.success('URL이 복사되었습니다');
  };

  // 미디어 프리뷰 핸들러 (광고 소재 이름 클릭)
  const handleCreativeClick = (creativeName) => {
    setMediaPreviewCreativeName(creativeName);
    setMediaPreviewModalVisible(true);
  };

  // 메타 필터 적용 여부 계산 (meta, instagram, ig 소스 필터링 중인지)
  const isMetaFiltered = quickFilterSources.some(source =>
    ['meta', 'instagram', 'ig', 'facebook', 'fb'].includes(source.toLowerCase())
  );

  return (
    <div style={{ padding: '24px', background: '#f5f7fa', minHeight: '100vh' }}>
      {/* 헤더 */}
      <PerformanceHeader
        onRefresh={handleRefresh}
        loading={loading}
        lastUpdated={lastUpdated}

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
        maxDuration={maxDuration}
        maxPv={maxPv}
        maxScroll={maxScroll}
        onMaxDurationChange={setMaxDuration}
        onMaxPvChange={setMaxPv}
        onMaxScrollChange={setMaxScroll}
        minDuration={minDuration}
        minPv={minPv}
        minScroll={minScroll}
        minUv={minUv}
        onMinDurationChange={setMinDuration}
        onMinPvChange={setMinPv}
        onMinScrollChange={setMinScroll}
        onMinUvChange={setMinUv}
        scoreSettings={scoreSettings}
        onScoreSettingsClick={() => setScoreSettingsModalVisible(true)}
        quickFilterSources={quickFilterSources}
        attributionWindow={attributionWindow}
        onAttributionWindowChange={setAttributionWindow}
        distributionData={distributionData}
        distributionLoading={distributionLoading}
        platformLinked={platformLinked}
        onPlatformLinkedChange={setPlatformLinked}
        showInsight={showInsight}
        onInsightToggle={() => setShowInsight(prev => !prev)}
      />

      {/* 인사이트 카드 (Top 5 랭킹) - 토글 버튼으로 표시/숨김 */}
      {showInsight && (
        <div style={{ marginTop: '12px', animation: 'fadeSlideIn 200ms ease' }}>
          <InsightCards data={data} scoreSettings={scoreSettings} onItemClick={handleInsightItemClick} />
          <style>{`
            @keyframes fadeSlideIn {
              from { opacity: 0; transform: translateY(-8px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
      )}

      {/* 에러 표시 */}
      {error && (
        <Alert
          message="데이터 조회 실패"
          description={error}
          type="error"
          showIcon
          closable
          onClose={() => setError(null)}
          style={{ marginTop: '16px', marginBottom: '16px' }}
        />
      )}

      {/* 테이블 */}
      <div style={{ marginTop: '16px' }}>
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
        onViewSessions={handleViewSessions}
        onViewEntries={handleViewEntries}
        onViewOriginalUrl={handleViewOriginalUrl}
        scoreSettings={scoreSettings}
        isMetaFiltered={isMetaFiltered}
        onCreativeClick={handleCreativeClick}
        minUv={minUv}
        highlightRowKey={highlightRowKey}
        onHighlightDone={() => setHighlightRowKey(null)}
      />
      </div>

      {/* 주문 보기 모달 */}
      {/* FIX (2026-02-10): matchingMode 전달 - 메인 테이블과 동일한 매칭 조건으로 주문 조회 */}
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
        attributionWindow={attributionWindow}
        matchingMode="extended"
      />

      {/* 세션 상세 모달 (UV 클릭) */}
      <CreativeSessionsModal
        visible={sessionsModalVisible}
        onClose={() => {
          setSessionsModalVisible(false);
          setSessionsCreative(null);
        }}
        creative={sessionsCreative}
        dateRange={{
          start: filters.dateRange[0],
          end: filters.dateRange[1]
        }}
      />

      {/* 진입 목록 모달 (View 클릭) */}
      <CreativeEntriesModal
        visible={entriesModalVisible}
        onClose={() => {
          setEntriesModalVisible(false);
          setEntriesCreative(null);
        }}
        creative={entriesCreative}
        dateRange={{
          start: filters.dateRange[0],
          end: filters.dateRange[1]
        }}
      />

      {/* 원본 URL 모달 */}
      <Modal
        title="원본 URL"
        open={originalUrlModalVisible}
        onCancel={() => {
          setOriginalUrlModalVisible(false);
          setOriginalUrlData(null);
        }}
        footer={null}
        width={700}
      >
        {originalUrlLoading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
            <div style={{ marginTop: '16px', color: '#666' }}>URL 조회 중...</div>
          </div>
        ) : originalUrlData ? (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>광고 소재 이름</div>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>
                {/* URL에서 디코딩된 광고 소재 이름이 있으면 표시, 없으면 기존 값 */}
                {originalUrlData.decoded_creative_name || originalUrlData.creative_name || '-'}
              </div>
            </div>

            {originalUrlData.full_url ? (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>광고 랜딩 URL</div>
                  <div
                    style={{
                      fontSize: '13px',
                      padding: '12px',
                      background: '#f5f5f5',
                      borderRadius: '6px',
                      wordBreak: 'break-all',
                      cursor: 'pointer',
                      maxHeight: '200px',
                      overflow: 'auto'
                    }}
                    onClick={() => handleCopyUrl(originalUrlData.full_url)}
                    title="클릭하여 복사"
                  >
                    {originalUrlData.full_url}
                  </div>
                </div>

                <div style={{ fontSize: '12px', color: '#999' }}>
                  * 해당 기간 내 {originalUrlData.total_count?.toLocaleString()}회 유입된 대표 URL입니다. 클릭하면 복사됩니다.
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                해당 기간 내 유입 기록이 없습니다.
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      {/* 점수 설정 모달 */}
      <ScoreSettingsModal
        visible={scoreSettingsModalVisible}
        onClose={() => setScoreSettingsModalVisible(false)}
        currentSettings={scoreSettings}
        onSaveSuccess={(newSettings) => setScoreSettings(newSettings)}
        outlierFilters={{ maxScroll, maxPv, maxDuration }}
      />

      {/* 미디어 프리뷰 모달 */}
      <CreativeMediaPreviewModal
        visible={mediaPreviewModalVisible}
        onClose={() => {
          setMediaPreviewModalVisible(false);
          setMediaPreviewCreativeName(null);
        }}
        creativeName={mediaPreviewCreativeName}
      />
    </div>
  );
}

export default CreativePerformance;
