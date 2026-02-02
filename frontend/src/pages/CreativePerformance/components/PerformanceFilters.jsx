// ============================================================================
// 광고 소재 퍼포먼스 필터 섹션
// 검색/날짜 필터는 주문 분석 스타일, UTM 필터는 기존 유지
// ============================================================================

import { useState, useEffect } from 'react';
import { Card, Divider, DatePicker, InputNumber, Button } from 'antd';
import { 
  Search, X, RotateCcw, Calendar, Layers, AlertTriangle, Settings,
  Clock, Eye, MousePointerClick, Filter
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import DynamicUtmFilterBar from '../../../components/DynamicUtmFilterBar';
import UtmSourceQuickFilter from '../../../components/UtmSourceQuickFilter';
import ScoreSettingsCard from './ScoreSettingsCard';

const { RangePicker } = DatePicker;

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
  onScoreSettingsClick,
  quickFilterSources
}) {
  const defaultQuickDate = '30days';
  const [searchTerm, setSearchTerm] = useState('');
  const [activeQuickDate, setActiveQuickDate] = useState(defaultQuickDate);
  const [customDateRange, setCustomDateRange] = useState(null);
  const [isDateInitialized, setIsDateInitialized] = useState(false);
  
  // 저장된 dateRange에서 activeQuickDate 계산 (최초 1회만)
  useEffect(() => {
    if (isDateInitialized || !filters?.dateRange) return;
    
    const [start, end] = filters.dateRange;
    const startDate = dayjs(start);
    const endDate = dayjs(end);
    const now = dayjs();
    const diffDays = endDate.diff(startDate, 'day');
    
    // 날짜 범위로 퀵 필터 타입 계산
    let calculatedType = 'custom';
    if (diffDays === 0 && startDate.isSame(now, 'day')) {
      calculatedType = 'today';
    } else if (diffDays === 0 && startDate.isSame(now.subtract(1, 'day'), 'day')) {
      calculatedType = 'yesterday';
    } else if (diffDays === 6 && endDate.isSame(now, 'day')) {
      calculatedType = '7days';
    } else if (diffDays === 29 && endDate.isSame(now, 'day')) {
      calculatedType = '30days';
    }
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/546a3f56-d046-4164-8da1-9726e1a92f02',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PerformanceFilters.jsx:dateInit',message:'저장된 dateRange에서 activeQuickDate 계산',data:{dateRange:filters.dateRange,diffDays,calculatedType},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    
    if (calculatedType !== 'custom') {
      setActiveQuickDate(calculatedType);
    } else {
      setActiveQuickDate('custom');
      setCustomDateRange([startDate, endDate]);
    }
    setIsDateInitialized(true);
  }, [filters?.dateRange, isDateInitialized]);
  
  // 이상치 필터 로컬 state (적용 버튼 클릭 전까지 로컬에서만 관리)
  const [localDuration, setLocalDuration] = useState(maxDuration ? maxDuration / 60 : 1);
  const [localPv, setLocalPv] = useState(maxPv || 35);
  const [localScroll, setLocalScroll] = useState(maxScroll || 30000);
  
  // 상위 컴포넌트 값이 변경되면 로컬 state도 동기화
  useEffect(() => {
    if (maxDuration) setLocalDuration(maxDuration / 60);
  }, [maxDuration]);
  
  useEffect(() => {
    if (maxPv) setLocalPv(maxPv);
  }, [maxPv]);
  
  useEffect(() => {
    if (maxScroll) setLocalScroll(maxScroll);
  }, [maxScroll]);

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

  // 마운트 시 기본값 설정 제거 - 부모 훅에서 저장된 값 또는 기본값을 이미 사용함
  // useEffect에서 기본값으로 덮어쓰면 저장된 필터가 무시됨

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
    // 이상치 필터도 초기화
    setLocalDuration(maxDuration ? maxDuration / 60 : 1);
    setLocalPv(maxPv || 35);
    setLocalScroll(maxScroll || 30000);
    onFilterChange?.({ dateRange: getDateRange(defaultQuickDate) });
    onReset?.();
  };

  // 이상치 필터 적용 버튼 핸들러
  const handleApplyOutlierFilters = () => {
    if (localDuration && localDuration > 0) {
      onMaxDurationChange?.(localDuration * 60);
    }
    if (localPv && localPv > 0) {
      onMaxPvChange?.(localPv);
    }
    if (localScroll && localScroll > 0) {
      onMaxScrollChange?.(localScroll);
    }
  };

  // 이상치 필터 값이 변경되었는지 확인
  const isOutlierFilterChanged = () => {
    const currentDurationMin = maxDuration ? maxDuration / 60 : 1;
    const currentPv = maxPv || 35;
    const currentScroll = maxScroll || 30000;
    return localDuration !== currentDurationMin || localPv !== currentPv || localScroll !== currentScroll;
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
              initialSources={quickFilterSources}
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
              {/* 체류시간 초과 제외 (분 단위 입력, 내부는 초 단위) */}
              <div className="flex items-center gap-2 bg-gray-50 px-3 h-[42px] rounded-lg border border-gray-100">
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                  <Clock size={14} className="text-green-500" />
                  <span>체류시간</span>
                </div>
                <InputNumber
                  size="small"
                  value={localDuration}
                  onChange={(val) => setLocalDuration(val)}
                  min={0.5}
                  step={0.5}
                  style={{ width: 70 }}
                  disabled={loading}
                  className="bg-white rounded border border-gray-200"
                />
                <span className="text-xs text-gray-600">분 초과 제외</span>
              </div>
              
              {/* PV 초과 제외 */}
              <div className="flex items-center gap-2 bg-gray-50 px-3 h-[42px] rounded-lg border border-gray-100">
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                  <Eye size={14} className="text-purple-500" />
                  <span>PV</span>
                </div>
                <InputNumber
                  size="small"
                  value={localPv}
                  onChange={(val) => setLocalPv(val)}
                  min={1}
                  step={1}
                  style={{ width: 70 }}
                  disabled={loading}
                  className="bg-white rounded border border-gray-200"
                />
                <span className="text-xs text-gray-600">초과 제외</span>
              </div>
              
              {/* 스크롤 초과 제외 */}
              <div className="flex items-center gap-2 bg-gray-50 px-3 h-[42px] rounded-lg border border-gray-100">
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                  <MousePointerClick size={14} className="text-blue-500" />
                  <span>스크롤</span>
                </div>
                <InputNumber
                  size="small"
                  value={localScroll}
                  onChange={(val) => setLocalScroll(val)}
                  min={100}
                  step={1000}
                  style={{ width: 100 }}
                  disabled={loading}
                  className="bg-white rounded border border-gray-200"
                  formatter={(value) => value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''}
                  parser={(value) => value.replace(/,/g, '')}
                />
                <span className="text-xs text-gray-600">px 초과 제외</span>
              </div>
              
              {/* 적용 버튼 */}
              <Button
                type="primary"
                size="small"
                onClick={handleApplyOutlierFilters}
                disabled={loading || !isOutlierFilterChanged()}
                style={{
                  height: '42px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  boxShadow: 'none'
                }}
              >
                적용
              </Button>
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
