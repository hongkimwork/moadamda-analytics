import React from 'react';
import { EnhancedMetricCard } from '../../../components/EnhancedMetricCard';
import { Users, Eye, DollarSign, Percent } from 'lucide-react';
import { createSparklineData } from '../utils/dataTransforms';

/**
 * 핵심 KPI 카드 그리드
 */
export function KpiCards({ stats, dailyData }) {
  const revenueSparkline = createSparklineData(dailyData, 'revenue');
  const visitorsSparkline = createSparklineData(dailyData, 'visitors');

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <EnhancedMetricCard
        title="총 방문자"
        value={stats?.visitors?.total || 0}
        subtitle={`신규: ${stats?.visitors?.new || 0} / 재방문: ${stats?.visitors?.returning || 0}`}
        change={stats?.visitors?.change_percent || 0}
        icon={Users}
        sparklineData={visitorsSparkline}
        status={(stats?.visitors?.change_percent || 0) > 0 ? 'good' : (stats?.visitors?.change_percent || 0) < 0 ? 'bad' : 'neutral'}
      />
      <EnhancedMetricCard
        title="총 페이지뷰"
        value={stats?.pageviews?.total || 0}
        change={stats?.pageviews?.change_percent || 0}
        icon={Eye}
        status={(stats?.pageviews?.change_percent || 0) > 0 ? 'good' : 'neutral'}
      />
      <EnhancedMetricCard
        title="총 매출"
        value={stats?.revenue?.total || 0}
        change={stats?.revenue?.change_percent || 0}
        icon={DollarSign}
        sparklineData={revenueSparkline}
        format="currency"
        status={(stats?.revenue?.change_percent || 0) > 10 ? 'good' : (stats?.revenue?.change_percent || 0) < -10 ? 'bad' : 'warning'}
        size="large"
      />
      <EnhancedMetricCard
        title="구매 전환율"
        value={stats?.conversion?.rate || 0}
        subtitle={`주문: ${stats?.orders?.count || 0}건`}
        icon={Percent}
        format="percent"
        status={(stats?.conversion?.rate || 0) > 3 ? 'good' : (stats?.conversion?.rate || 0) < 1 ? 'bad' : 'warning'}
      />
    </div>
  );
}
