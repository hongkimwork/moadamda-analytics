// ============================================================================
// 평가 설정 통합 모달
// 기여 기간 / 이상치 필터 / 이하치 필터 / 모수 평가 기준 / 데이터 분포를
// 하나의 모달에서 통합 관리
// ============================================================================

import { useState, useEffect, useMemo } from 'react';
import { Modal, InputNumber, Button, Tabs, Spin, Empty, message } from 'antd';
import {
  Settings, Target, AlertTriangle, Filter, Clock, Eye,
  MousePointerClick, Users, RotateCcw, Save, BarChart2,
  TrendingUp, ChevronRight
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  Cell, ReferenceLine
} from 'recharts';

// ============================================================================
// 차트 색상 상수
// ============================================================================
const BAR_COLOR = '#8b5cf6';
const BAR_COLOR_EXCLUDED = '#d1d5db';
const BAR_COLOR_CAPPED = '#fbbf24';
const REF_LINE_MAX = '#ef4444';
const REF_LINE_MIN = '#3b82f6';

// ============================================================================
// 기여 기간 선택 버튼
// ============================================================================
const AttributionWindowSelector = ({ value, onChange }) => {
  const options = [
    { value: '30', label: '30일' },
    { value: '60', label: '60일' },
    { value: '90', label: '90일' },
    { value: 'all', label: '전체' }
  ];

  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            height: '36px',
            padding: '0 20px',
            borderRadius: '8px',
            border: value === opt.value ? '2px solid #1677ff' : '1px solid #d9d9d9',
            background: value === opt.value ? '#e6f4ff' : '#fff',
            color: value === opt.value ? '#1677ff' : '#595959',
            fontSize: '14px',
            fontWeight: value === opt.value ? 600 : 400,
            cursor: 'pointer',
            transition: 'all 150ms ease'
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};

// ============================================================================
// 지표별 필터 카드
// ============================================================================
const MetricFilterCard = ({
  icon: Icon,
  iconColor,
  label,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  minUnit,
  maxUnit,
  minStep,
  maxStep,
  minMin,
  maxMin,
  maxFormatter,
  maxParser,
  minFormatter,
  minParser,
  hasConflict,
  isActive,
  onClick,
  showMaxOnly = false,
  showMinOnly = false
}) => (
  <div
    onClick={onClick}
    style={{
      padding: '16px 20px',
      borderRadius: '12px',
      border: isActive ? '2px solid #1677ff' : '1px solid #e8eaed',
      background: isActive ? '#fafbff' : '#fff',
      cursor: 'pointer',
      transition: 'all 150ms ease',
      boxShadow: isActive ? '0 0 0 3px rgba(22,119,255,0.08)' : 'none'
    }}
  >
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '14px'
    }}>
      <div style={{
        width: '28px',
        height: '28px',
        borderRadius: '8px',
        background: `${iconColor}15`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Icon size={16} style={{ color: iconColor }} />
      </div>
      <span style={{ fontSize: '14px', fontWeight: 600, color: '#262626' }}>{label}</span>
      {hasConflict && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          marginLeft: 'auto',
          fontSize: '11px',
          color: '#ff4d4f',
          fontWeight: 500
        }}>
          <AlertTriangle size={12} />
          범위 충돌
        </div>
      )}
    </div>

    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* 하한 (이하치 제외) */}
      {!showMaxOnly && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <div style={{
            width: '56px',
            fontSize: '12px',
            color: '#3b82f6',
            fontWeight: 600,
            flexShrink: 0
          }}>
            하한
          </div>
          <InputNumber
            size="small"
            value={minValue}
            onChange={onMinChange}
            min={minMin ?? 0}
            step={minStep ?? 1}
            style={{ width: 90 }}
            formatter={minFormatter}
            parser={minParser}
            onClick={(e) => e.stopPropagation()}
          />
          <span style={{ fontSize: '12px', color: '#8c8c8c' }}>{minUnit}</span>
        </div>
      )}

      {/* 상한 (이상치 대체) */}
      {!showMinOnly && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <div style={{
            width: '56px',
            fontSize: '12px',
            color: '#ef4444',
            fontWeight: 600,
            flexShrink: 0
          }}>
            상한
          </div>
          <InputNumber
            size="small"
            value={maxValue}
            onChange={onMaxChange}
            min={maxMin ?? 1}
            step={maxStep ?? 1}
            style={{ width: 90 }}
            formatter={maxFormatter}
            parser={maxParser}
            onClick={(e) => e.stopPropagation()}
          />
          <span style={{ fontSize: '12px', color: '#8c8c8c' }}>{maxUnit}</span>
        </div>
      )}
    </div>
  </div>
);

// ============================================================================
// 차트 Tooltip
// ============================================================================
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

// ============================================================================
// 분포 차트 컴포넌트 (오른쪽 패널)
// ============================================================================
const DistributionPreview = ({
  distributionData,
  distributionLoading,
  activeMetric,
  localMaxDuration,
  localMaxPv,
  localMaxScroll,
  localMinDuration,
  localMinPv,
  localMinScroll,
  onMetricChange
}) => {
  const metricConfigs = {
    pv: {
      title: 'PV (페이지뷰) 분포',
      subtitle: '세션당 페이지뷰 수',
      data: distributionData?.pv?.histogram || [],
      percentiles: distributionData?.pv?.percentiles,
      total: distributionData?.pv?.total || 0,
      minValue: localMinPv,
      maxValue: localMaxPv,
      minLabel: `${localMinPv}`,
      maxLabel: `${localMaxPv}`,
      unit: ''
    },
    duration: {
      title: '체류시간 분포',
      subtitle: '세션당 체류시간',
      data: distributionData?.duration?.histogram || [],
      percentiles: distributionData?.duration?.percentiles,
      total: distributionData?.duration?.total || 0,
      minValue: localMinDuration,
      maxValue: localMaxDuration,
      minLabel: `${localMinDuration}초`,
      maxLabel: localMaxDuration >= 60 ? `${localMaxDuration / 60}분` : `${localMaxDuration}초`,
      unit: '초'
    },
    scroll: {
      title: '스크롤 깊이 분포',
      subtitle: '세션당 스크롤 거리 (px)',
      data: distributionData?.scroll?.histogram || [],
      percentiles: distributionData?.scroll?.percentiles,
      total: distributionData?.scroll?.total || 0,
      minValue: localMinScroll,
      maxValue: localMaxScroll,
      minLabel: `${localMinScroll.toLocaleString()}px`,
      maxLabel: `${localMaxScroll.toLocaleString()}px`,
      unit: 'px'
    }
  };

  const config = metricConfigs[activeMetric];
  if (!config) return null;

  // 막대 색상 계산
  const getBarColor = (entry) => {
    const rangeMin = entry.range_min || 0;
    if (config.minValue > 0 && rangeMin <= config.minValue) return BAR_COLOR_EXCLUDED;
    if (config.maxValue > 0 && rangeMin > config.maxValue) return BAR_COLOR_CAPPED;
    return BAR_COLOR;
  };

  // 참조선 위치 계산
  const findRangeForValue = (value, isMax) => {
    if (!value || value <= 0) return null;
    const data = config.data;
    for (let i = 0; i < data.length; i++) {
      const rangeMin = data[i].range_min || 0;
      const nextRangeMin = i < data.length - 1 ? (data[i + 1].range_min || 0) : Infinity;
      if (value >= rangeMin && value < nextRangeMin) {
        return data[i].range;
      }
    }
    return isMax ? data[data.length - 1]?.range : data[0]?.range;
  };

  // 영향 건수 계산
  const calculateImpact = () => {
    let excludedCount = 0;
    let cappedCount = 0;
    const total = config.total;

    (config.data || []).forEach(item => {
      const rangeMin = item.range_min || 0;
      if (config.minValue > 0 && rangeMin <= config.minValue) {
        excludedCount += item.count;
      }
      if (config.maxValue > 0 && rangeMin > config.maxValue) {
        cappedCount += item.count;
      }
    });

    return {
      excludedCount,
      cappedCount,
      excludedPct: total > 0 ? ((excludedCount / total) * 100).toFixed(1) : '0.0',
      cappedPct: total > 0 ? ((cappedCount / total) * 100).toFixed(1) : '0.0'
    };
  };

  const minRefRange = findRangeForValue(config.minValue, false);
  const maxRefRange = findRangeForValue(config.maxValue, true);
  const impact = calculateImpact();

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 탭 */}
      <div style={{
        display: 'flex',
        gap: '4px',
        marginBottom: '20px',
        padding: '4px',
        background: '#f5f5f5',
        borderRadius: '10px'
      }}>
        {[
          { key: 'duration', label: '체류시간' },
          { key: 'pv', label: 'PV' },
          { key: 'scroll', label: '스크롤' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => onMetricChange(tab.key)}
            style={{
              flex: 1,
              height: '32px',
              borderRadius: '8px',
              border: 'none',
              background: activeMetric === tab.key ? '#fff' : 'transparent',
              color: activeMetric === tab.key ? '#1677ff' : '#8c8c8c',
              fontSize: '13px',
              fontWeight: activeMetric === tab.key ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 150ms ease',
              boxShadow: activeMetric === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 차트 영역 */}
      {distributionLoading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin size="large" />
        </div>
      ) : !config.data || config.data.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="분포 데이터 없음" />
        </div>
      ) : (
        <>
          {/* 차트 제목 */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#262626' }}>
              {config.title}
            </div>
            <div style={{ fontSize: '12px', color: '#8c8c8c', marginTop: '2px' }}>
              {config.subtitle}
            </div>
          </div>

          {/* 히스토그램 */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={config.data} margin={{ top: 25, right: 20, left: 0, bottom: 5 }}>
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
                <RechartsTooltip content={<DistributionTooltip total={config.total} />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={50}>
                  {config.data.map((entry, index) => (
                    <Cell key={index} fill={getBarColor(entry)} />
                  ))}
                </Bar>

                {/* 이하치 참조선 */}
                {minRefRange && (
                  <ReferenceLine
                    x={minRefRange}
                    stroke={REF_LINE_MIN}
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    label={{
                      value: `MIN ${config.minLabel}`,
                      position: 'top',
                      fill: REF_LINE_MIN,
                      fontSize: 11,
                      fontWeight: 600
                    }}
                  />
                )}

                {/* 이상치 참조선 */}
                {maxRefRange && (
                  <ReferenceLine
                    x={maxRefRange}
                    stroke={REF_LINE_MAX}
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    label={{
                      value: `MAX ${config.maxLabel}`,
                      position: 'top',
                      fill: REF_LINE_MAX,
                      fontSize: 11,
                      fontWeight: 600
                    }}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 영향도 + 백분위 요약 */}
          <div style={{
            marginTop: '16px',
            padding: '14px 16px',
            background: '#fafafa',
            borderRadius: '10px',
            border: '1px solid #f0f0f0'
          }}>
            {/* 영향도 */}
            <div style={{ display: 'flex', gap: '20px', marginBottom: '10px', flexWrap: 'wrap' }}>
              {config.minValue > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                  <div style={{ width: 10, height: 3, background: REF_LINE_MIN, borderRadius: 2 }} />
                  <span style={{ color: '#6b7280' }}>
                    이하치 제외: <strong style={{ color: '#3b82f6' }}>{impact.excludedCount.toLocaleString()}건 ({impact.excludedPct}%)</strong>
                  </span>
                </div>
              )}
              {config.maxValue > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                  <div style={{ width: 10, height: 3, background: REF_LINE_MAX, borderRadius: 2 }} />
                  <span style={{ color: '#6b7280' }}>
                    이상치 대체: <strong style={{ color: '#ef4444' }}>{impact.cappedCount.toLocaleString()}건 ({impact.cappedPct}%)</strong>
                  </span>
                </div>
              )}
            </div>

            {/* 범례 */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '10px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#8c8c8c' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: BAR_COLOR }} />
                유효 데이터
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#8c8c8c' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: BAR_COLOR_EXCLUDED }} />
                이하치 제외
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#8c8c8c' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: BAR_COLOR_CAPPED }} />
                이상치 대체
              </div>
            </div>

            {/* 백분위 */}
            {config.percentiles && (
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {[
                  { label: 'P25', value: config.percentiles.p25 },
                  { label: 'P50', value: config.percentiles.p50 },
                  { label: 'P75', value: config.percentiles.p75 },
                  { label: 'P90', value: config.percentiles.p90 },
                  { label: 'P95', value: config.percentiles.p95 }
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                    <span style={{ color: '#9ca3af', fontWeight: 500 }}>{item.label}:</span>
                    <span style={{ color: '#374151', fontWeight: 600 }}>
                      {typeof item.value === 'number' ? Math.round(item.value).toLocaleString() : '-'}{config.unit}
                    </span>
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                  <span style={{ color: '#9ca3af', fontWeight: 500 }}>전체:</span>
                  <span style={{ color: '#374151', fontWeight: 600 }}>{config.total.toLocaleString()}건</span>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// ============================================================================
// 모수 평가 기준 요약 카드
// ============================================================================
const ScoreSettingsSummary = ({ settings, onDetailClick }) => {
  const metricLabels = {
    scroll: { label: '스크롤', field: 'weight_scroll' },
    pv: { label: 'PV', field: 'weight_pv' },
    duration: { label: '체류', field: 'weight_duration' },
    view: { label: 'View', field: 'weight_view' },
    uv: { label: 'UV', field: 'weight_uv' }
  };

  if (!settings) {
    return (
      <button
        onClick={onDetailClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          width: '100%',
          padding: '14px 18px',
          background: '#fff',
          border: '2px dashed #d9d9d9',
          borderRadius: '12px',
          cursor: 'pointer',
          transition: 'all 200ms ease',
          fontSize: '14px',
          color: '#8c8c8c'
        }}
      >
        <Settings size={18} style={{ color: '#bfbfbf' }} />
        <span style={{ fontWeight: 500 }}>모수 평가 기준 설정하기</span>
        <ChevronRight size={16} style={{ marginLeft: 'auto', color: '#bfbfbf' }} />
      </button>
    );
  }

  const enabledMetrics = settings.enabled_metrics || ['scroll', 'pv', 'duration'];

  return (
    <button
      onClick={onDetailClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        width: '100%',
        padding: '14px 18px',
        background: '#fff',
        border: '1px solid #e8eaed',
        borderRadius: '12px',
        cursor: 'pointer',
        transition: 'all 200ms ease',
        textAlign: 'left'
      }}
    >
      <div style={{
        width: '32px',
        height: '32px',
        borderRadius: '8px',
        background: '#f6ffed',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        <TrendingUp size={16} style={{ color: '#52c41a' }} />
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#262626', marginBottom: '2px' }}>
          절대평가
        </div>
        <div style={{ fontSize: '12px', color: '#8c8c8c', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {enabledMetrics.map((metric, idx) => {
            const def = metricLabels[metric];
            if (!def) return null;
            return (
              <span key={metric}>
                {idx > 0 && <span style={{ color: '#d9d9d9', marginRight: '8px' }}>|</span>}
                {def.label} <strong style={{ color: '#595959' }}>{settings[def.field] || 0}%</strong>
              </span>
            );
          })}
        </div>
      </div>
      <ChevronRight size={16} style={{ color: '#bfbfbf', flexShrink: 0 }} />
    </button>
  );
};

// ============================================================================
// 메인 모달 컴포넌트
// ============================================================================
function EvaluationSettingsModal({
  visible,
  onClose,
  // 현재 설정값
  attributionWindow,
  maxDuration,
  maxPv,
  maxScroll,
  minDuration,
  minPv,
  minScroll,
  minUv,
  scoreSettings,
  // 분포 데이터
  distributionData,
  distributionLoading,
  // 저장 콜백
  onSave,
  // 모수 평가 상세 설정 모달 열기
  onOpenScoreSettings,
  loading
}) {
  // 로컬 상태 (모달 내에서만 편집, "저장 및 적용" 시 부모에 반영)
  const [localAttributionWindow, setLocalAttributionWindow] = useState(attributionWindow || '30');
  const [localMaxDuration, setLocalMaxDuration] = useState(maxDuration ? maxDuration / 60 : 1); // 분 단위
  const [localMaxPv, setLocalMaxPv] = useState(maxPv || 15);
  const [localMaxScroll, setLocalMaxScroll] = useState(maxScroll || 10000);
  const [localMinDuration, setLocalMinDuration] = useState(minDuration || 0); // 초 단위
  const [localMinPv, setLocalMinPv] = useState(minPv || 0);
  const [localMinScroll, setLocalMinScroll] = useState(minScroll || 0);
  const [localMinUv, setLocalMinUv] = useState(minUv || 0);

  // 오른쪽 분포 차트 선택 지표
  const [activeMetric, setActiveMetric] = useState('duration');

  // 모달 열릴 때 현재 설정값으로 로컬 상태 초기화
  useEffect(() => {
    if (visible) {
      setLocalAttributionWindow(attributionWindow || '30');
      setLocalMaxDuration(maxDuration ? maxDuration / 60 : 1);
      setLocalMaxPv(maxPv || 15);
      setLocalMaxScroll(maxScroll || 10000);
      setLocalMinDuration(minDuration || 0);
      setLocalMinPv(minPv || 0);
      setLocalMinScroll(minScroll || 0);
      setLocalMinUv(minUv || 0);
    }
  }, [visible, attributionWindow, maxDuration, maxPv, maxScroll, minDuration, minPv, minScroll, minUv]);

  // 범위 충돌 검사
  const hasConflict = useMemo(() => {
    const maxDurationSec = localMaxDuration * 60;
    return {
      duration: localMinDuration > 0 && localMinDuration >= maxDurationSec,
      pv: localMinPv > 0 && localMinPv >= localMaxPv,
      scroll: localMinScroll > 0 && localMinScroll >= localMaxScroll,
      any: false
    };
  }, [localMaxDuration, localMaxPv, localMaxScroll, localMinDuration, localMinPv, localMinScroll]);

  // any 충돌 여부
  const hasAnyConflict = hasConflict.duration || hasConflict.pv || hasConflict.scroll;

  // 변경 여부 확인
  const hasChanges = useMemo(() => {
    return (
      localAttributionWindow !== (attributionWindow || '30') ||
      localMaxDuration !== (maxDuration ? maxDuration / 60 : 1) ||
      localMaxPv !== (maxPv || 15) ||
      localMaxScroll !== (maxScroll || 10000) ||
      localMinDuration !== (minDuration || 0) ||
      localMinPv !== (minPv || 0) ||
      localMinScroll !== (minScroll || 0) ||
      localMinUv !== (minUv || 0)
    );
  }, [
    localAttributionWindow, attributionWindow,
    localMaxDuration, maxDuration,
    localMaxPv, maxPv,
    localMaxScroll, maxScroll,
    localMinDuration, minDuration,
    localMinPv, minPv,
    localMinScroll, minScroll,
    localMinUv, minUv
  ]);

  // 저장 핸들러
  const handleSave = () => {
    if (hasAnyConflict) {
      message.error('범위 충돌이 있습니다. 하한 값이 상한 값보다 작은지 확인해주세요.');
      return;
    }

    onSave({
      attributionWindow: localAttributionWindow,
      maxDuration: localMaxDuration * 60, // 초 단위로 변환
      maxPv: localMaxPv,
      maxScroll: localMaxScroll,
      minDuration: localMinDuration,
      minPv: localMinPv,
      minScroll: localMinScroll,
      minUv: localMinUv
    });
    onClose();
  };

  // 초기화 핸들러
  const handleReset = () => {
    setLocalAttributionWindow('30');
    setLocalMaxDuration(1); // 1분 = 60초
    setLocalMaxPv(15);
    setLocalMaxScroll(10000);
    setLocalMinDuration(0);
    setLocalMinPv(0);
    setLocalMinScroll(0);
    setLocalMinUv(0);
  };

  // 지표 카드 클릭 시 분포 차트 자동 전환
  const handleMetricCardClick = (metric) => {
    setActiveMetric(metric);
  };

  // 숫자 콤마 포맷터
  const commaFormatter = (value) => value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '';
  const commaParser = (value) => value.replace(/,/g, '');

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      width="95vw"
      style={{ top: '2.5vh', maxWidth: '1400px' }}
      styles={{
        body: {
          height: 'calc(95vh - 110px)',
          padding: 0,
          overflow: 'hidden'
        }
      }}
      destroyOnClose
      closable
    >
      <div style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* ============================================================ */}
        {/* 헤더: 제목 + 기여 기간 */}
        {/* ============================================================ */}
        <div style={{
          padding: '24px 28px 20px',
          borderBottom: '1px solid #f0f0f0'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: '#f0f5ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Settings size={20} style={{ color: '#1677ff' }} />
            </div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#141414' }}>모수 평가 설정</div>
              <div style={{ fontSize: '12px', color: '#8c8c8c', marginTop: '2px' }}>
                데이터 정제 기준과 평가 방식을 한 곳에서 관리합니다
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Target size={16} style={{ color: '#1677ff' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#595959' }}>광고 기여 인정 기간</span>
            </div>
            <AttributionWindowSelector
              value={localAttributionWindow}
              onChange={setLocalAttributionWindow}
            />
          </div>
        </div>

        {/* ============================================================ */}
        {/* 메인 컨텐츠: 2단 구성 */}
        {/* ============================================================ */}
        <div style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          minHeight: 0
        }}>
          {/* 왼쪽: 설정 영역 (55%) */}
          <div style={{
            width: '55%',
            padding: '24px 28px',
            overflowY: 'auto',
            borderRight: '1px solid #f0f0f0'
          }}>
            {/* 데이터 정제 섹션 */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px'
              }}>
                <Filter size={18} style={{ color: '#595959' }} />
                <span style={{ fontSize: '15px', fontWeight: 600, color: '#262626' }}>
                  데이터 정제
                </span>
                <span style={{ fontSize: '12px', color: '#8c8c8c', marginLeft: '4px' }}>
                  각 지표의 유효 범위를 설정합니다
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* 체류시간 */}
                <MetricFilterCard
                  icon={Clock}
                  iconColor="#52c41a"
                  label="체류시간"
                  minValue={localMinDuration}
                  maxValue={localMaxDuration}
                  onMinChange={(val) => setLocalMinDuration(val || 0)}
                  onMaxChange={(val) => setLocalMaxDuration(val || 0.5)}
                  minUnit="초 이하 제외"
                  maxUnit="분 초과 대체"
                  minStep={1}
                  maxStep={0.5}
                  minMin={0}
                  maxMin={0.5}
                  hasConflict={hasConflict.duration}
                  isActive={activeMetric === 'duration'}
                  onClick={() => handleMetricCardClick('duration')}
                />

                {/* PV */}
                <MetricFilterCard
                  icon={Eye}
                  iconColor="#722ed1"
                  label="PV (페이지뷰)"
                  minValue={localMinPv}
                  maxValue={localMaxPv}
                  onMinChange={(val) => setLocalMinPv(val || 0)}
                  onMaxChange={(val) => setLocalMaxPv(val || 1)}
                  minUnit="이하 제외"
                  maxUnit="초과 대체"
                  minStep={1}
                  maxStep={1}
                  minMin={0}
                  maxMin={1}
                  hasConflict={hasConflict.pv}
                  isActive={activeMetric === 'pv'}
                  onClick={() => handleMetricCardClick('pv')}
                />

                {/* 스크롤 */}
                <MetricFilterCard
                  icon={MousePointerClick}
                  iconColor="#1677ff"
                  label="스크롤"
                  minValue={localMinScroll}
                  maxValue={localMaxScroll}
                  onMinChange={(val) => setLocalMinScroll(val || 0)}
                  onMaxChange={(val) => setLocalMaxScroll(val || 100)}
                  minUnit="px 이하 제외"
                  maxUnit="px 초과 대체"
                  minStep={100}
                  maxStep={1000}
                  minMin={0}
                  maxMin={100}
                  minFormatter={commaFormatter}
                  minParser={commaParser}
                  maxFormatter={commaFormatter}
                  maxParser={commaParser}
                  hasConflict={hasConflict.scroll}
                  isActive={activeMetric === 'scroll'}
                  onClick={() => handleMetricCardClick('scroll')}
                />

                {/* UV (하한만) */}
                <MetricFilterCard
                  icon={Users}
                  iconColor="#fa8c16"
                  label="UV (방문자 수)"
                  minValue={localMinUv}
                  onMinChange={(val) => setLocalMinUv(val || 0)}
                  minUnit="이하 하단 배치"
                  minStep={1}
                  minMin={0}
                  showMinOnly
                  isActive={false}
                  onClick={() => {}}
                />
              </div>
            </div>

            {/* 구분선 */}
            <div style={{
              height: '1px',
              background: '#f0f0f0',
              margin: '0 0 24px 0'
            }} />

            {/* 모수 평가 기준 */}
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px'
              }}>
                <TrendingUp size={18} style={{ color: '#722ed1' }} />
                <span style={{ fontSize: '15px', fontWeight: 600, color: '#262626' }}>
                  모수 평가 점수 설정
                </span>
              </div>

              <ScoreSettingsSummary
                settings={scoreSettings}
                onDetailClick={onOpenScoreSettings}
              />
            </div>
          </div>

          {/* 오른쪽: 데이터 분포 미리보기 (45%) */}
          <div style={{
            width: '45%',
            padding: '24px 28px',
            background: '#fafbfc',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px'
            }}>
              <BarChart2 size={18} style={{ color: '#8b5cf6' }} />
              <span style={{ fontSize: '15px', fontWeight: 600, color: '#262626' }}>
                데이터 분포 미리보기
              </span>
            </div>

            <div style={{ flex: 1, minHeight: 0 }}>
              <DistributionPreview
                distributionData={distributionData}
                distributionLoading={distributionLoading}
                activeMetric={activeMetric}
                localMaxDuration={localMaxDuration * 60}
                localMaxPv={localMaxPv}
                localMaxScroll={localMaxScroll}
                localMinDuration={localMinDuration}
                localMinPv={localMinPv}
                localMinScroll={localMinScroll}
                onMetricChange={setActiveMetric}
              />
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* 하단 버튼 바 */}
        {/* ============================================================ */}
        <div style={{
          padding: '16px 28px',
          borderTop: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#fff'
        }}>
          <Button
            icon={<RotateCcw size={14} />}
            onClick={handleReset}
            danger
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            초기화
          </Button>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {hasAnyConflict && (
              <span style={{ fontSize: '12px', color: '#ff4d4f', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertTriangle size={14} />
                하한 값이 상한 값보다 큽니다
              </span>
            )}
            <Button onClick={onClose}>
              취소
            </Button>
            <Button
              type="primary"
              icon={<Save size={14} />}
              onClick={handleSave}
              disabled={hasAnyConflict || loading}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              저장 및 적용
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default EvaluationSettingsModal;
