// ============================================================================
// 데이터 분포 시각화 패널
// 모수 평가기준 하위에 PV/체류시간/스크롤 분포를 히스토그램으로 표시
// 이상치/이하치 필터 위치를 참조선으로 시각화
// ============================================================================

import { useState } from 'react';
import { Spin, Empty, Tabs } from 'antd';
import { BarChart2, TrendingUp } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  Cell, ReferenceLine
} from 'recharts';

// 차트 색상
const BAR_COLOR = '#8b5cf6';
const BAR_COLOR_EXCLUDED = '#d1d5db';
const BAR_COLOR_CAPPED = '#fbbf24';
const REF_LINE_MAX = '#ef4444';
const REF_LINE_MIN = '#3b82f6';
const REF_LINE_PERCENTILE = '#9ca3af';

/**
 * 커스텀 Tooltip
 */
const DistributionTooltip = ({ active, payload, label, total }) => {
  if (!active || !payload || !payload.length) return null;
  const count = payload[0].value;
  const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
  return (
    <div style={{
      background: '#fff',
      padding: '10px 14px',
      border: '1px solid #e5e7eb',
      borderRadius: 8,
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
    }}>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>
        {count.toLocaleString()}건
      </div>
      <div style={{ fontSize: 12, color: '#8b5cf6', fontWeight: 500 }}>
        {pct}%
      </div>
    </div>
  );
};

/**
 * 요약 통계 표시
 */
const PercentileSummary = ({ percentiles, total, unit = '' }) => {
  if (!percentiles || !total) return null;

  const items = [
    { label: 'P25', value: percentiles.p25 },
    { label: 'P50 (중앙값)', value: percentiles.p50 },
    { label: 'P75', value: percentiles.p75 },
    { label: 'P90', value: percentiles.p90 },
    { label: 'P95', value: percentiles.p95 },
  ];

  return (
    <div style={{
      display: 'flex',
      gap: '12px',
      flexWrap: 'wrap',
      marginTop: '8px'
    }}>
      {items.map(item => (
        <div key={item.label} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '12px'
        }}>
          <span style={{ color: '#9ca3af', fontWeight: 500 }}>{item.label}:</span>
          <span style={{ color: '#374151', fontWeight: 600 }}>
            {typeof item.value === 'number' ? Math.round(item.value).toLocaleString() : '-'}{unit}
          </span>
        </div>
      ))}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '12px'
      }}>
        <span style={{ color: '#9ca3af', fontWeight: 500 }}>전체:</span>
        <span style={{ color: '#374151', fontWeight: 600 }}>
          {total.toLocaleString()}건
        </span>
      </div>
    </div>
  );
};

/**
 * 필터 영향 표시 (제외/대체 건수)
 */
const FilterImpact = ({ histogram, minValue, maxValue, total, minLabel, maxLabel }) => {
  if (!histogram || !total) return null;

  let excludedCount = 0;
  let cappedCount = 0;

  histogram.forEach(item => {
    const rangeMin = item.range_min || 0;
    if (minValue > 0 && rangeMin <= minValue) {
      excludedCount += item.count;
    }
    if (maxValue > 0 && rangeMin > maxValue) {
      cappedCount += item.count;
    }
  });

  const excludedPct = total > 0 ? ((excludedCount / total) * 100).toFixed(1) : '0.0';
  const cappedPct = total > 0 ? ((cappedCount / total) * 100).toFixed(1) : '0.0';

  return (
    <div style={{
      display: 'flex',
      gap: '16px',
      marginTop: '8px',
      fontSize: '12px'
    }}>
      {minValue > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: 10, height: 3, background: REF_LINE_MIN, borderRadius: 2 }} />
          <span style={{ color: '#6b7280' }}>
            이하치 제외 ({minLabel}): <strong style={{ color: '#3b82f6' }}>{excludedCount.toLocaleString()}건 ({excludedPct}%)</strong>
          </span>
        </div>
      )}
      {maxValue > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: 10, height: 3, background: REF_LINE_MAX, borderRadius: 2 }} />
          <span style={{ color: '#6b7280' }}>
            이상치 대체 ({maxLabel}): <strong style={{ color: '#ef4444' }}>{cappedCount.toLocaleString()}건 ({cappedPct}%)</strong>
          </span>
        </div>
      )}
    </div>
  );
};

/**
 * 단일 히스토그램 차트
 */
const DistributionChart = ({
  title,
  subtitle,
  data,
  percentiles,
  total,
  minValue = 0,
  maxValue = 0,
  minLabel = '',
  maxLabel = '',
  unit = ''
}) => {
  if (!data || data.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="데이터 없음" />
      </div>
    );
  }

  // 막대 색상: 제외/대체 구간 구분
  const getBarColor = (entry) => {
    const rangeMin = entry.range_min || 0;
    if (minValue > 0 && rangeMin <= minValue) return BAR_COLOR_EXCLUDED;
    if (maxValue > 0 && rangeMin > maxValue) return BAR_COLOR_CAPPED;
    return BAR_COLOR;
  };

  // ReferenceLine의 X축 위치 계산 (구간 이름으로)
  const findRangeForValue = (value, isMax) => {
    if (!value || value <= 0) return null;
    for (let i = 0; i < data.length; i++) {
      const rangeMin = data[i].range_min || 0;
      const nextRangeMin = i < data.length - 1 ? (data[i + 1].range_min || 0) : Infinity;
      if (value >= rangeMin && value < nextRangeMin) {
        return data[i].range;
      }
    }
    return isMax ? data[data.length - 1]?.range : data[0]?.range;
  };

  const minRefRange = findRangeForValue(minValue, false);
  const maxRefRange = findRangeForValue(maxValue, true);

  return (
    <div style={{
      background: '#fafafa',
      borderRadius: 10,
      padding: '16px 20px',
      border: '1px solid #f0f0f0'
    }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#262626' }}>
          {title}
          <span style={{ fontSize: 12, fontWeight: 400, color: '#9ca3af', marginLeft: 8 }}>
            {subtitle}
          </span>
        </div>
        <FilterImpact
          histogram={data}
          minValue={minValue}
          maxValue={maxValue}
          total={total}
          minLabel={minLabel}
          maxLabel={maxLabel}
        />
      </div>

      <ResponsiveContainer width="100%" height={270}>
        <BarChart data={data} margin={{ top: 25, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="range"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <RechartsTooltip content={<DistributionTooltip total={total} />} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={50}>
            {data.map((entry, index) => (
              <Cell key={index} fill={getBarColor(entry)} />
            ))}
          </Bar>

          {/* 이하치 제외 참조선 (MIN) */}
          {minRefRange && (
            <ReferenceLine
              x={minRefRange}
              stroke={REF_LINE_MIN}
              strokeWidth={2}
              strokeDasharray="5 3"
              label={{
                value: `MIN ${minLabel}`,
                position: 'top',
                fill: REF_LINE_MIN,
                fontSize: 11,
                fontWeight: 600
              }}
            />
          )}

          {/* 이상치 대체 참조선 (MAX) */}
          {maxRefRange && (
            <ReferenceLine
              x={maxRefRange}
              stroke={REF_LINE_MAX}
              strokeWidth={2}
              strokeDasharray="5 3"
              label={{
                value: `MAX ${maxLabel}`,
                position: 'top',
                fill: REF_LINE_MAX,
                fontSize: 11,
                fontWeight: 600
              }}
            />
          )}
        </BarChart>
      </ResponsiveContainer>

      <PercentileSummary percentiles={percentiles} total={total} unit={unit} />
    </div>
  );
};

/**
 * 데이터 분포 시각화 패널 메인 컴포넌트
 */
function DataDistributionPanel({
  distributionData,
  distributionLoading,
  maxDuration,
  maxPv,
  maxScroll,
  minDuration,
  minPv,
  minScroll
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasData = distributionData &&
    (distributionData.pv?.histogram?.length > 0 ||
     distributionData.duration?.histogram?.length > 0 ||
     distributionData.scroll?.histogram?.length > 0);

  return (
    <div style={{ marginTop: '12px' }}>
      {/* 토글 버튼 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 14px',
          background: isExpanded ? '#f0f0ff' : '#f8f9fa',
          border: `1px solid ${isExpanded ? '#d6d6ff' : '#e5e7eb'}`,
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 500,
          color: isExpanded ? '#5b21b6' : '#6b7280',
          transition: 'all 150ms ease',
          width: '100%',
          justifyContent: 'center'
        }}
      >
        <BarChart2 size={16} />
        {isExpanded ? '데이터 분포 접기' : '데이터 분포 보기'}
        <TrendingUp size={14} style={{ opacity: 0.6 }} />
        <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: '4px' }}>
          PV / 체류시간 / 스크롤 히스토그램
        </span>
      </button>

      {/* 확장 패널 */}
      {isExpanded && (
        <div style={{ marginTop: '12px' }}>
          {distributionLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin size="large" />
              <div style={{ marginTop: '12px', color: '#9ca3af', fontSize: '13px' }}>
                분포 데이터를 불러오는 중...
              </div>
            </div>
          ) : !hasData ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="분포 데이터가 없습니다. 날짜 범위와 플랫폼 필터를 확인해주세요."
            />
          ) : (
            <Tabs
              defaultActiveKey="pv"
              type="card"
              size="small"
              items={[
                {
                  key: 'pv',
                  label: 'PV (페이지뷰)',
                  children: (
                    <DistributionChart
                      title="페이지뷰 분포"
                      subtitle="세션당 페이지뷰 수"
                      data={distributionData.pv?.histogram || []}
                      percentiles={distributionData.pv?.percentiles}
                      total={distributionData.pv?.total || 0}
                      minValue={minPv}
                      maxValue={maxPv}
                      minLabel={`${minPv}`}
                      maxLabel={`${maxPv}`}
                    />
                  )
                },
                {
                  key: 'duration',
                  label: '체류시간',
                  children: (
                    <DistributionChart
                      title="체류시간 분포"
                      subtitle="세션당 체류시간"
                      data={distributionData.duration?.histogram || []}
                      percentiles={distributionData.duration?.percentiles}
                      total={distributionData.duration?.total || 0}
                      minValue={minDuration}
                      maxValue={maxDuration}
                      minLabel={`${minDuration}초`}
                      maxLabel={`${maxDuration >= 60 ? (maxDuration / 60) + '분' : maxDuration + '초'}`}
                      unit="초"
                    />
                  )
                },
                {
                  key: 'scroll',
                  label: '스크롤',
                  children: (
                    <DistributionChart
                      title="스크롤 깊이 분포"
                      subtitle="세션당 스크롤 거리 (px)"
                      data={distributionData.scroll?.histogram || []}
                      percentiles={distributionData.scroll?.percentiles}
                      total={distributionData.scroll?.total || 0}
                      minValue={minScroll}
                      maxValue={maxScroll}
                      minLabel={`${minScroll.toLocaleString()}px`}
                      maxLabel={`${maxScroll.toLocaleString()}px`}
                      unit="px"
                    />
                  )
                }
              ]}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default DataDistributionPanel;
