// ============================================================================
// 광고 소재 퍼포먼스 필터 섹션
// 검색/날짜 필터는 주문 분석 스타일, UTM 필터는 기존 유지
// ============================================================================

import { useState, useEffect } from 'react';
import { Card, Divider, DatePicker, Select } from 'antd';
import { 
  Search, X, RotateCcw, Calendar, Layers, AlertTriangle, Settings,
  Clock, Eye, MousePointerClick
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import DynamicUtmFilterBar from '../../../components/DynamicUtmFilterBar';
import UtmSourceQuickFilter from '../../../components/UtmSourceQuickFilter';
import ScoreSettingsCard from './ScoreSettingsCard';

const { RangePicker } = DatePicker;

// 이상치 기준 옵션 생성 (30초~10분, 30초 단위)
const durationOptions = [];
for (let seconds = 30; seconds <= 600; seconds += 30) {
  const minutes = Math.floor(seconds / 60);
  const remainSeconds = seconds % 60;
  
  let label;
  if (seconds < 60) {
    label = `${seconds}초`;
  } else if (remainSeconds === 0) {
    label = `${minutes}분`;
  } else {
    label = `${minutes}분 ${remainSeconds}초`;
  }
  
  durationOptions.push({ value: seconds, label });
}

// PV 옵션 (5, 10, 15, 20, 25, 30, 35)
const pvOptions = [5, 10, 15, 20, 25, 30, 35].map(v => ({ value: v, label: `${v}` }));

// 스크롤 옵션 (5,000px ~ 30,000px, 5,000px 단위)
const scrollOptions = [];
for (let px = 5000; px <= 30000; px += 5000) {
  scrollOptions.push({ value: px, label: `${px.toLocaleString()}px` });
}

/**
 * Segmented Button - 높이 36px 통일
 */
const SegmentedButton = ({ options, value, onChange, disabled }) => (
  <div style={{
    display: 'inline-flex',
    borderRadius: '8px',
    border: '1px solid #dadce0',
    overflow: 'hidden',
    background: '#fff'
  }}>
    {options.map((option, index) => {
      const isSelected = value === option.value;
      const isFirst = index === 0;
      const isLast = index === options.length - 1;
      
      return (
        <button
          key={option.value}
          onClick={() => !disabled && onChange(option.value)}
          disabled={disabled}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '36px',
            padding: '0 16px',
            border: 'none',
            borderLeft: !isFirst ? '1px solid #dadce0' : 'none',
            background: isSelected ? '#e8f0fe' : 'transparent',
            color: isSelected ? '#1a73e8' : '#5f6368',
            fontSize: '13px',
            fontWeight: isSelected ? 600 : 500,
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'all 150ms ease',
            opacity: disabled ? 0.5 : 1,
            borderRadius: isFirst ? '8px 0 0 8px' : isLast ? '0 8px 8px 0' : 0
          }}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);

/**
 * Search Input - 높이 36px, Enter로 검색
 */
const SearchInput = ({ value, onChange, onSearch, disabled, placeholder }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    height: '36px',
    padding: '0 14px',
    background: '#f8f9fa',
    border: '1px solid transparent',
    borderRadius: '8px',
    minWidth: '350px',
    width: '450px',
    transition: 'all 150ms ease'
  }}>
    <Search size={16} style={{ color: '#5f6368', flexShrink: 0 }} />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && onSearch()}
      disabled={disabled}
      placeholder={placeholder}
      style={{
        flex: 1,
        border: 'none',
        outline: 'none',
        background: 'transparent',
        fontSize: '14px',
        color: '#202124'
      }}
    />
    {value && (
      <button
        onClick={() => { onChange(''); onSearch(); }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '20px',
          height: '20px',
          padding: 0,
          border: 'none',
          background: '#dadce0',
          borderRadius: '50%',
          cursor: 'pointer',
          color: '#5f6368'
        }}
      >
        <X size={12} />
      </button>
    )}
  </div>
);

/**
 * 퍼포먼스 필터 섹션 컴포넌트
 */
function PerformanceFilters({
  onSearch,
  onFilterChange,
  onReset,
  filters,
  onQuickFilterChange,
  onUtmFilterChange,
  loading,
  maxDuration,
  maxPv,
  maxScroll,
  onMaxDurationChange,
  onMaxPvChange,
  onMaxScrollChange,
  scoreSettings,
  onScoreSettingsClick
}) {
  const defaultQuickDate = '30days';
  const [searchTerm, setSearchTerm] = useState('');
  const [activeQuickDate, setActiveQuickDate] = useState(defaultQuickDate);
  const [customDateRange, setCustomDateRange] = useState(null);

  const getDateRange = (type) => {
    const now = dayjs();
    switch (type) {
      case 'today': return [now.startOf('day'), now.endOf('day')];
      case 'yesterday': return [now.subtract(1, 'day').startOf('day'), now.subtract(1, 'day').endOf('day')];
      case '7days': return [now.subtract(6, 'day').startOf('day'), now.endOf('day')];
      case '30days': return [now.subtract(29, 'day').startOf('day'), now.endOf('day')];
      default: return [now.subtract(29, 'day').startOf('day'), now.endOf('day')];
    }
  };

  useEffect(() => {
    if (defaultQuickDate && onFilterChange) {
      onFilterChange({ dateRange: getDateRange(defaultQuickDate) });
    }
  }, []);

  const handleSearchSubmit = () => onSearch?.(searchTerm.trim());

  const handleQuickDateChange = (value) => {
    setActiveQuickDate(value);
    setCustomDateRange(null);
    onFilterChange?.({ dateRange: getDateRange(value) });
  };

  const handleCustomDateChange = (dates) => {
    if (!dates || dates.length === 0) {
      setActiveQuickDate(defaultQuickDate);
      setCustomDateRange(null);
      onFilterChange?.({ dateRange: getDateRange(defaultQuickDate) });
      return;
    }
    setCustomDateRange(dates);
    setActiveQuickDate('custom');
    onFilterChange?.({ dateRange: dates });
  };

  const handleReset = () => {
    setSearchTerm('');
    setActiveQuickDate(defaultQuickDate);
    setCustomDateRange(null);
    onFilterChange?.({ dateRange: getDateRange(defaultQuickDate) });
    onReset?.();
  };

  const isDefaultState = () => !searchTerm && activeQuickDate === defaultQuickDate;

  const dateOptions = [
    { label: '오늘', value: 'today' },
    { label: '어제', value: 'yesterday' },
    { label: '7일', value: '7days' },
    { label: '30일', value: '30days' }
  ];

  const displayDateRange = customDateRange || (activeQuickDate !== 'custom' ? getDateRange(activeQuickDate) : null);

  return (
    <>
      {/* 검색 및 날짜 필터 (주문 분석 스타일) */}
      <Card
        style={{
          marginBottom: '16px',
          borderRadius: '16px',
          border: '1px solid #e8eaed',
          background: '#fff',
          boxShadow: 'none'
        }}
        styles={{ body: { padding: '14px 20px' } }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap'
        }}>
          {/* 검색 */}
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            onSearch={handleSearchSubmit}
            disabled={loading}
            placeholder="광고 소재 이름으로 검색..."
          />

          {/* 날짜 선택 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            height: '36px',
            padding: '0 14px',
            background: '#f8f9fa',
            borderRadius: '8px',
            border: '1px solid #dadce0'
          }}>
            <Calendar size={16} style={{ color: '#5f6368', flexShrink: 0 }} />
            <span style={{ fontSize: '13px', color: '#5f6368', fontWeight: 500 }}>기간</span>
            <RangePicker
              value={displayDateRange}
              onChange={handleCustomDateChange}
              format="M월 D일"
              placeholder={['시작일', '종료일']}
              disabled={loading}
              size="middle"
              locale={dayjs.locale('ko')}
              style={{ 
                width: 200,
                height: '28px'
              }}
              bordered={false}
              allowClear={activeQuickDate === 'custom'}
            />
          </div>

          <SegmentedButton
            options={dateOptions}
            value={activeQuickDate === 'custom' ? null : activeQuickDate}
            onChange={handleQuickDateChange}
            disabled={loading}
          />

          {/* 초기화 */}
          {!isDefaultState() && (
            <button
              onClick={handleReset}
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                height: '36px',
                padding: '0 14px',
                borderRadius: '8px',
                border: 'none',
                background: '#fce8e6',
                color: '#c5221f',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 150ms ease'
              }}
            >
              <RotateCcw size={14} />
              초기화
            </button>
          )}
        </div>
      </Card>

      {/* UTM 필터 영역 (기존 유지) */}
      <Card 
        size="small" 
        style={{ 
          marginBottom: '20px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          border: '1px solid #e8eaed'
        }}
      >
        <div className="flex gap-6 flex-wrap">
          {/* 좌측: UTM Source 퀵 필터 */}
          <div className="flex-1 min-w-[300px]">
            <div className="mb-3 text-sm text-gray-700 font-semibold flex items-center gap-2">
              <Layers size={18} strokeWidth={2} className="text-blue-500" />
              광고 플랫폼
            </div>
            <UtmSourceQuickFilter
              onFilterChange={onQuickFilterChange}
              loading={loading}
            />
          </div>

          {/* 구분선 */}
          <Divider type="vertical" className="h-auto m-0" />

          {/* 우측: 동적 UTM 필터 */}
          <div className="flex-1 min-w-[300px]">
            <div className="mb-3 text-sm text-gray-700 font-semibold flex items-center gap-2">
              <Search size={18} strokeWidth={2} className="text-blue-500" />
              UTM 필터
            </div>
            <DynamicUtmFilterBar
              tableName="utm-sessions"
              onFilterChange={onUtmFilterChange}
              loading={loading}
              excludeValues={{ utm_source: ['viral'] }}
            />
          </div>
        </div>
      </Card>

      {/* 이상치 값 제외 필터 영역 */}
      <Card 
        size="small" 
        style={{ 
          marginBottom: '20px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          border: '1px solid #e8eaed'
        }}
      >
        <div className="flex gap-6 flex-wrap">
          {/* 좌측: 이상치 값 제외 필터 */}
          <div className="flex-1 min-w-[300px]">
            <div className="mb-3 text-sm text-gray-700 font-semibold flex items-center gap-2">
              <AlertTriangle size={18} strokeWidth={2} className="text-amber-500" />
              이상치 값 제외 필터
            </div>
            <div className="flex gap-3 flex-wrap items-center">
              {/* 체류시간 초과 제외 */}
              <div className="flex items-center gap-2 bg-gray-50 px-3 h-[42px] rounded-lg border border-gray-100">
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                  <Clock size={14} className="text-green-500" />
                  <span>체류시간</span>
                </div>
                <Select
                  size="small"
                  value={maxDuration}
                  onChange={onMaxDurationChange}
                  options={durationOptions}
                  style={{ width: 100 }}
                  disabled={loading}
                  bordered={false}
                  className="bg-white rounded border border-gray-200"
                />
                <span className="text-xs text-gray-400">초과 제외</span>
              </div>
              
              {/* PV 초과 제외 */}
              <div className="flex items-center gap-2 bg-gray-50 px-3 h-[42px] rounded-lg border border-gray-100">
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                  <Eye size={14} className="text-purple-500" />
                  <span>PV</span>
                </div>
                <Select
                  size="small"
                  value={maxPv}
                  onChange={onMaxPvChange}
                  options={pvOptions}
                  style={{ width: 70 }}
                  disabled={loading}
                  bordered={false}
                  className="bg-white rounded border border-gray-200"
                />
                <span className="text-xs text-gray-400">초과 제외</span>
              </div>
              
              {/* 스크롤 초과 제외 */}
              <div className="flex items-center gap-2 bg-gray-50 px-3 h-[42px] rounded-lg border border-gray-100">
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                  <MousePointerClick size={14} className="text-blue-500" />
                  <span>스크롤</span>
                </div>
                <Select
                  size="small"
                  value={maxScroll}
                  onChange={onMaxScrollChange}
                  options={scrollOptions}
                  style={{ width: 110 }}
                  disabled={loading}
                  bordered={false}
                  className="bg-white rounded border border-gray-200"
                />
                <span className="text-xs text-gray-400">초과 제외</span>
              </div>
            </div>
          </div>

          {/* 구분선 */}
          <Divider type="vertical" className="h-auto m-0" />

          {/* 우측: 모수 평가 기준 설정 */}
          <div className="flex-1 min-w-[300px]">
            <div className="mb-3 text-sm text-gray-700 font-semibold flex items-center gap-2">
              <Settings size={18} strokeWidth={2} className="text-purple-600" />
              모수 평가 기준
            </div>
            <ScoreSettingsCard
              settings={scoreSettings}
              onClick={onScoreSettingsClick}
            />
          </div>
        </div>
      </Card>
    </>
  );
}

export default PerformanceFilters;
