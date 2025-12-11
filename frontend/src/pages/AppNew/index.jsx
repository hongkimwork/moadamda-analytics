import React, { useState } from 'react';
import dayjs from 'dayjs';
import { DashboardHeader } from '../../components/DashboardHeader';
import { MainTabs, OverviewTab, PerformanceTab, AudienceTab } from '../../components/MainTabs';
import { InsightsPanel } from '../../components/InsightsPanel';
import { useAppNewData } from './hooks/useAppNewData';
import { AttributionSection } from './components/AttributionSection';
import { UtmPerformanceSection } from './components/UtmPerformanceSection';
import { KpiCards } from './components/KpiCards';
import { RecentActivitySection } from './components/RecentActivitySection';
import { PerformanceCharts } from './components/PerformanceCharts';
import { ProductsTable } from './components/ProductsTable';
import { AudienceSegments } from './components/AudienceSegments';
import { DeviceAnalysis } from './components/DeviceAnalysis';

/**
 * 새로운 대시보드 페이지
 * 페이지 컨테이너 + 커스텀 훅 + 서비스/유틸 + 분리된 섹션 컴포넌트 구조
 */
function AppNew() {
  const [dateRange, setDateRange] = useState([dayjs(), dayjs()]);
  const [deviceFilter, setDeviceFilter] = useState('all');

  // 커스텀 훅으로 모든 데이터 관리
  const {
    stats,
    segments,
    dailyData,
    recentActivity,
    utmPerformance,
    attributionData,
    ga4Data,
    loading,
    refresh
  } = useAppNewData(dateRange, deviceFilter);

  // 로딩 상태
  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-lg font-medium">로딩 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        dateRange={dateRange}
        onDateRangeChange={(dates) => dates && setDateRange(dates)}
        deviceFilter={deviceFilter}
        onDeviceFilterChange={setDeviceFilter}
        onRefresh={refresh}
        loading={loading}
      />
      
      <div className="container mx-auto px-4 py-6">
        <MainTabs>
          {/* 개요 탭 */}
          <OverviewTab>
            <div className="space-y-6">
              {/* 🎯 체류시간 기반 어트리뷰션 */}
              <AttributionSection 
                attributionData={attributionData}
                ga4Data={ga4Data}
              />

              {/* 📢 광고 캠페인 성과 요약 */}
              <UtmPerformanceSection utmPerformance={utmPerformance} />

              {/* 핵심 KPI - 대형 카드 */}
              <KpiCards stats={stats} dailyData={dailyData} />

              {/* 인사이트 패널 */}
              <InsightsPanel />

              {/* 실시간 활동 */}
              <RecentActivitySection recentActivity={recentActivity} />
            </div>
          </OverviewTab>

          {/* 성과 탭 */}
          <PerformanceTab>
            <div className="space-y-6">
              {/* 트렌드 차트 */}
              <PerformanceCharts dailyData={dailyData} />

              {/* 상품 성과 테이블 */}
              <ProductsTable products={stats?.products} />
            </div>
          </PerformanceTab>

          {/* 고객 탭 */}
          <AudienceTab>
            <div className="space-y-6">
              {/* 세그먼트 비교 */}
              <AudienceSegments segments={segments} />

              {/* 디바이스 분석 */}
              <DeviceAnalysis stats={stats} />
            </div>
          </AudienceTab>
        </MainTabs>
      </div>
    </div>
  );
}

export default AppNew;
