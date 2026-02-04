// ============================================================================
// 광고 소재 퍼포먼스 필터 섹션
// 검색/날짜 필터는 주문 분석 스타일, UTM 필터는 기존 유지
// ============================================================================

import { useState, useEffect } from 'react';
import { Card, Divider, DatePicker, InputNumber, Button, Select } from 'antd';
import { 
  Search, X, RotateCcw, Calendar, Layers, AlertTriangle, Settings,
  Clock, Eye, MousePointerClick, Filter, Target
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import DynamicUtmFilterBar from '../../../components/DynamicUtmFilterBar';
import UtmSourceQuickFilter from '../../../components/UtmSourceQuickFilter';
import ScoreSettingsCard from './ScoreSettingsCard';

const { RangePicker } = DatePicker;

/**
 * Date Navigator Group - 날짜 네비게이션 버튼 그룹
 * 구조: [-1단위] [중앙 버튼] [+1단위]
 */
const DateNavigatorGroup = ({ 
  label, 
  prevLabel, 
  nextLabel, 
  isActive, 
  offset, 
  onCenterClick, 
  onPrevClick, 
  onNextClick, 
  disabled 
}) => {
  // 활성화된 그룹인지, 그리고 offset에 따라 버튼 스타일 결정
  const getButtonStyle = (position) => {
    // position: 'prev' | 'center' | 'next'
    let isSelected = false;
    
    if (isActive) {
      if (position === 'center' && offset === 0) isSelected = true;
      if (position === 'prev' && offset < 0) isSelected = true;
      if (position === 'next' && offset > 0) isSelected = true;
    }
    
    return {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '36px',
      padding: position === 'center' ? '0 14px' : '0 10px',
      border: 'none',
      background: isSelected ? '#1a1a1a' : 'transparent',
      color: isSelected ? '#fff' : '#5f6368',
      fontSize: '13px',
      fontWeight: isSelected ? 600 : 500,
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'all 150ms ease',
      opacity: disabled ? 0.5 : 1,
      whiteSpace: 'nowrap'
    };
  };

  return (
    <div style={{
      display: 'inline-flex',
      borderRadius: '8px',
      border: '1px solid #dadce0',
      overflow: 'hidden',
      background: '#fff'
    }}>
      <button
        onClick={onPrevClick}
        disabled={disabled}
        style={getButtonStyle('prev')}
      >
        {prevLabel}
      </button>
      <div style={{ width: '1px', background: '#dadce0' }} />
      <button
        onClick={onCenterClick}
        disabled={disabled}
        style={getButtonStyle('center')}
      >
        {label}
      </button>
      <div style={{ width: '1px', background: '#dadce0' }} />
      <button
        onClick={onNextClick}
        disabled={disabled}
        style={getButtonStyle('next')}
      >
        {nextLabel}
      </button>
    </div>
  );
};

/**
 * Search Input - 높이 36px, Enter로 검색
 * FIX (2026-02-02): onClear prop 추가하여 X 버튼 클릭 시 명시적으로 빈 검색어 전달
 * - 기존: onChange('') 후 onSearch() 호출 시 React state 업데이트가 비동기라 이전 검색어로 검색됨
 * - 수정: onClear prop으로 빈 문자열을 명시적으로 전달하여 전체 보기로 전환
 */
const SearchInput = ({ value, onChange, onSearch, onClear, disabled, placeholder }) => (
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
        onClick={() => { onChange(''); onClear(); }}
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
  minDuration,
  minPv,
  minScroll,
  onMinDurationChange,
  onMinPvChange,
  onMinScrollChange,
  scoreSettings,
  onScoreSettingsClick,
  quickFilterSources,
  // FIX (2026-02-04): Attribution Window 선택
  attributionWindow,
  onAttributionWindowChange
}) {
  const [searchTerm, setSearchTerm] = useState('');
  // 새로운 상태: 활성 그룹 (day, week, month, custom)
  const [activeGroup, setActiveGroup] = useState('month');
  // offset: 0이면 오늘/이번주/이번달, -1이면 이전, +1이면 다음
  const [offset, setOffset] = useState(0);
  const [customDateRange, setCustomDateRange] = useState(null);
  const [isDateInitialized, setIsDateInitialized] = useState(false);
  
  /**
   * 그룹과 offset에 따라 날짜 범위 계산
   */
  const getDateRangeByGroupAndOffset = (group, offsetValue) => {
    const now = dayjs();
    
    switch (group) {
      case 'day': {
        const targetDay = now.add(offsetValue, 'day');
        return [targetDay.startOf('day'), targetDay.endOf('day')];
      }
      case 'week': {
        // 이번 주 기준으로 offset 적용 (월요일 ~ 일요일)
        const targetWeekStart = now.startOf('week').add(1, 'day').add(offsetValue, 'week'); // 월요일
        const targetWeekEnd = targetWeekStart.add(6, 'day'); // 일요일
        return [targetWeekStart.startOf('day'), targetWeekEnd.endOf('day')];
      }
      case 'month': {
        const targetMonth = now.add(offsetValue, 'month');
        return [targetMonth.startOf('month'), targetMonth.endOf('month')];
      }
      default:
        return [now.startOf('day'), now.endOf('day')];
    }
  };

  // 저장된 dateRange에서 activeGroup/offset 계산 (최초 1회만)
  useEffect(() => {
    if (isDateInitialized || !filters?.dateRange) return;
    
    const [start, end] = filters.dateRange;
    const startDate = dayjs(start);
    const endDate = dayjs(end);
    const now = dayjs();
    const diffDays = endDate.diff(startDate, 'day');
    
    // 날짜 범위로 그룹 타입 계산
    let calculatedGroup = 'custom';
    let calculatedOffset = 0;
    
    // 단일 일자인 경우 (day 그룹)
    if (diffDays === 0) {
      calculatedGroup = 'day';
      calculatedOffset = startDate.diff(now.startOf('day'), 'day');
    }
    // 7일 범위인 경우 (week 그룹 가능성)
    else if (diffDays === 6) {
      // 월요일 시작인지 확인
      if (startDate.day() === 1) {
        calculatedGroup = 'week';
        const thisWeekStart = now.startOf('week').add(1, 'day');
        calculatedOffset = startDate.diff(thisWeekStart, 'week');
      }
    }
    // 월 전체인 경우 (month 그룹)
    else if (startDate.date() === 1 && endDate.date() === endDate.endOf('month').date()) {
      calculatedGroup = 'month';
      calculatedOffset = startDate.month() - now.month() + (startDate.year() - now.year()) * 12;
    }
    
    if (calculatedGroup !== 'custom') {
      setActiveGroup(calculatedGroup);
      setOffset(calculatedOffset);
    } else {
      setActiveGroup('custom');
      setCustomDateRange([startDate, endDate]);
    }
    setIsDateInitialized(true);
  }, [filters?.dateRange, isDateInitialized]);
  
  // 이상치 필터 로컬 state (적용 버튼 클릭 전까지 로컬에서만 관리)
  const [localDuration, setLocalDuration] = useState(maxDuration ? maxDuration / 60 : 1);
  const [localPv, setLocalPv] = useState(maxPv || 35);
  const [localScroll, setLocalScroll] = useState(maxScroll || 30000);

  // 이하치 필터 로컬 state (적용 버튼 클릭 전까지 로컬에서만 관리)
  const [localMinDuration, setLocalMinDuration] = useState(minDuration ? minDuration : 0);
  const [localMinPv, setLocalMinPv] = useState(minPv || 0);
  const [localMinScroll, setLocalMinScroll] = useState(minScroll || 0);
  
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

  useEffect(() => {
    setLocalMinDuration(minDuration || 0);
  }, [minDuration]);

  useEffect(() => {
    setLocalMinPv(minPv || 0);
  }, [minPv]);

  useEffect(() => {
    setLocalMinScroll(minScroll || 0);
  }, [minScroll]);

  // 마운트 시 기본값 설정 제거 - 부모 훅에서 저장된 값 또는 기본값을 이미 사용함
  // useEffect에서 기본값으로 덮어쓰면 저장된 필터가 무시됨

  const handleSearchSubmit = () => onSearch?.(searchTerm.trim());

  /**
   * 날짜 그룹 중앙 버튼 클릭 (오늘/이번주/이번달)
   */
  const handleGroupCenterClick = (group) => {
    setActiveGroup(group);
    setOffset(0);
    setCustomDateRange(null);
    const dateRange = getDateRangeByGroupAndOffset(group, 0);
    onFilterChange?.({ dateRange });
  };

  /**
   * 이전 버튼 클릭 (-1일/-1주/-1개월)
   */
  const handleGroupPrevClick = (group) => {
    const newOffset = activeGroup === group ? offset - 1 : -1;
    setActiveGroup(group);
    setOffset(newOffset);
    setCustomDateRange(null);
    const dateRange = getDateRangeByGroupAndOffset(group, newOffset);
    onFilterChange?.({ dateRange });
  };

  /**
   * 다음 버튼 클릭 (+1일/+1주/+1개월)
   */
  const handleGroupNextClick = (group) => {
    const newOffset = activeGroup === group ? offset + 1 : 1;
    setActiveGroup(group);
    setOffset(newOffset);
    setCustomDateRange(null);
    const dateRange = getDateRangeByGroupAndOffset(group, newOffset);
    onFilterChange?.({ dateRange });
  };

  const handleCustomDateChange = (dates) => {
    if (!dates || dates.length === 0) {
      // 날짜 선택 취소시 기본값으로 (이번 달)
      setActiveGroup('month');
      setOffset(0);
      setCustomDateRange(null);
      onFilterChange?.({ dateRange: getDateRangeByGroupAndOffset('month', 0) });
      return;
    }
    setCustomDateRange(dates);
    setActiveGroup('custom');
    setOffset(0);
    onFilterChange?.({ dateRange: dates });
  };

  const handleReset = () => {
    setSearchTerm('');
    setActiveGroup('month');
    setOffset(0);
    setCustomDateRange(null);
    // 이상치 필터도 초기화
    setLocalDuration(maxDuration ? maxDuration / 60 : 1);
    setLocalPv(maxPv || 35);
    setLocalScroll(maxScroll || 30000);
    // 이하치 필터도 초기화
    setLocalMinDuration(minDuration || 0);
    setLocalMinPv(minPv || 0);
    setLocalMinScroll(minScroll || 0);
    onFilterChange?.({ dateRange: getDateRangeByGroupAndOffset('month', 0) });
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

  // 이하치 필터 적용 버튼 핸들러
  const handleApplyMinFilters = () => {
    // 범위 충돌 검사 (이하치는 이상치보다 작아야 함)
    const maxDurationSec = localDuration * 60;
    if (localMinDuration >= maxDurationSec) {
      return; // 충돌 시 적용 안 함
    }
    if (localMinPv >= localPv) {
      return;
    }
    if (localMinScroll >= localScroll) {
      return;
    }
    
    onMinDurationChange?.(localMinDuration);
    onMinPvChange?.(localMinPv);
    onMinScrollChange?.(localMinScroll);
  };

  // 이상치 필터 값이 변경되었는지 확인
  const isOutlierFilterChanged = () => {
    const currentDurationMin = maxDuration ? maxDuration / 60 : 1;
    const currentPv = maxPv || 35;
    const currentScroll = maxScroll || 30000;
    return localDuration !== currentDurationMin || localPv !== currentPv || localScroll !== currentScroll;
  };

  // 이하치 필터 값이 변경되었는지 확인
  const isMinFilterChanged = () => {
    const currentMinDuration = minDuration || 0;
    const currentMinPv = minPv || 0;
    const currentMinScroll = minScroll || 0;
    return localMinDuration !== currentMinDuration || localMinPv !== currentMinPv || localMinScroll !== currentMinScroll;
  };

  // 범위 충돌 여부 확인 (이하치 >= 이상치)
  const hasRangeConflict = () => {
    const maxDurationSec = localDuration * 60;
    return (localMinDuration > 0 && localMinDuration >= maxDurationSec) ||
           (localMinPv > 0 && localMinPv >= localPv) ||
           (localMinScroll > 0 && localMinScroll >= localScroll);
  };

  const isDefaultState = () => !searchTerm && activeGroup === 'month' && offset === 0;

  // 현재 표시할 날짜 범위
  const displayDateRange = customDateRange || (activeGroup !== 'custom' ? getDateRangeByGroupAndOffset(activeGroup, offset) : null);

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
            onClear={() => onSearch?.('')}
            disabled={loading}
            placeholder="광고 소재 이름으로 검색..."
          />

          {/* FIX (2026-02-04): 기여 기간 (Attribution Window) 선택 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            height: '36px',
            padding: '0 14px',
            background: '#f0f7ff',
            borderRadius: '8px',
            border: '1px solid #91caff'
          }}>
            <Target size={16} style={{ color: '#1677ff', flexShrink: 0 }} />
            <span style={{ fontSize: '13px', color: '#1677ff', fontWeight: 500 }}>기여 기간</span>
            <Select
              value={attributionWindow}
              onChange={onAttributionWindowChange}
              disabled={loading}
              size="small"
              style={{ width: 90 }}
              bordered={false}
              options={[
                { value: '30', label: '30일' },
                { value: '60', label: '60일' },
                { value: '90', label: '90일' },
                { value: 'all', label: '전체' }
              ]}
            />
          </div>

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
              allowClear={activeGroup === 'custom'}
            />
          </div>

          {/* 월 네비게이터 */}
          <DateNavigatorGroup
            label="이번 달"
            prevLabel="-1개월"
            nextLabel="+1개월"
            isActive={activeGroup === 'month'}
            offset={activeGroup === 'month' ? offset : 0}
            onCenterClick={() => handleGroupCenterClick('month')}
            onPrevClick={() => handleGroupPrevClick('month')}
            onNextClick={() => handleGroupNextClick('month')}
            disabled={loading}
          />

          {/* 주 네비게이터 */}
          <DateNavigatorGroup
            label="이번 주"
            prevLabel="-1주"
            nextLabel="+1주"
            isActive={activeGroup === 'week'}
            offset={activeGroup === 'week' ? offset : 0}
            onCenterClick={() => handleGroupCenterClick('week')}
            onPrevClick={() => handleGroupPrevClick('week')}
            onNextClick={() => handleGroupNextClick('week')}
            disabled={loading}
          />

          {/* 일 네비게이터 */}
          <DateNavigatorGroup
            label="오늘"
            prevLabel="-1일"
            nextLabel="+1일"
            isActive={activeGroup === 'day'}
            offset={activeGroup === 'day' ? offset : 0}
            onCenterClick={() => handleGroupCenterClick('day')}
            onPrevClick={() => handleGroupPrevClick('day')}
            onNextClick={() => handleGroupNextClick('day')}
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

      {/* 이상치 값 대체 필터 + 이하치 값 제외 필터 영역 */}
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
          {/* 좌측: 이상치 값 대체 필터 (상한선) */}
          <div className="flex-1 min-w-[300px]">
            <div className="mb-3 text-sm text-gray-700 font-semibold flex items-center gap-2">
              <AlertTriangle size={18} strokeWidth={2} className="text-amber-500" />
              이상치 값 대체 필터
              <span className="text-xs font-normal text-gray-400">(기준 초과 시 대체)</span>
            </div>
            <div className="flex gap-3 flex-wrap items-center">
              {/* 체류시간 초과 대체 (분 단위 입력, 내부는 초 단위) */}
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
                <span className="text-xs text-gray-600">분 초과 대체</span>
              </div>
              
              {/* PV 초과 대체 */}
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
                <span className="text-xs text-gray-600">초과 대체</span>
              </div>
              
              {/* 스크롤 초과 대체 */}
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
                <span className="text-xs text-gray-600">px 초과 대체</span>
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

          {/* 우측: 이하치 값 제외 필터 (하한선) */}
          <div className="flex-1 min-w-[300px]">
            <div className="mb-3 text-sm text-gray-700 font-semibold flex items-center gap-2">
              <Filter size={18} strokeWidth={2} className="text-blue-500" />
              이하치 값 제외 필터
              <span className="text-xs font-normal text-gray-400">(기준 이하 시 제외)</span>
            </div>
            <div className="flex gap-3 flex-wrap items-center">
              {/* 체류시간 이하 제외 (초 단위 입력) */}
              <div className="flex items-center gap-2 bg-gray-50 px-3 h-[42px] rounded-lg border border-gray-100">
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                  <Clock size={14} className="text-green-500" />
                  <span>체류시간</span>
                </div>
                <InputNumber
                  size="small"
                  value={localMinDuration}
                  onChange={(val) => setLocalMinDuration(val || 0)}
                  min={0}
                  step={1}
                  style={{ width: 70 }}
                  disabled={loading}
                  className="bg-white rounded border border-gray-200"
                />
                <span className="text-xs text-gray-600">초 이하 제외</span>
              </div>
              
              {/* PV 이하 제외 */}
              <div className="flex items-center gap-2 bg-gray-50 px-3 h-[42px] rounded-lg border border-gray-100">
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                  <Eye size={14} className="text-purple-500" />
                  <span>PV</span>
                </div>
                <InputNumber
                  size="small"
                  value={localMinPv}
                  onChange={(val) => setLocalMinPv(val || 0)}
                  min={0}
                  step={1}
                  style={{ width: 70 }}
                  disabled={loading}
                  className="bg-white rounded border border-gray-200"
                />
                <span className="text-xs text-gray-600">이하 제외</span>
              </div>
              
              {/* 스크롤 이하 제외 */}
              <div className="flex items-center gap-2 bg-gray-50 px-3 h-[42px] rounded-lg border border-gray-100">
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                  <MousePointerClick size={14} className="text-blue-500" />
                  <span>스크롤</span>
                </div>
                <InputNumber
                  size="small"
                  value={localMinScroll}
                  onChange={(val) => setLocalMinScroll(val || 0)}
                  min={0}
                  step={100}
                  style={{ width: 100 }}
                  disabled={loading}
                  className="bg-white rounded border border-gray-200"
                  formatter={(value) => value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''}
                  parser={(value) => value.replace(/,/g, '')}
                />
                <span className="text-xs text-gray-600">px 이하 제외</span>
              </div>
              
              {/* 적용 버튼 */}
              <Button
                type="primary"
                size="small"
                onClick={handleApplyMinFilters}
                disabled={loading || !isMinFilterChanged() || hasRangeConflict()}
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
            {/* 범위 충돌 경고 */}
            {hasRangeConflict() && (
              <div className="mt-2 text-xs text-red-500 flex items-center gap-1">
                <AlertTriangle size={12} />
                이하치 값은 이상치 값보다 작아야 합니다
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* 모수 평가 기준 설정 영역 (별도 카드) */}
      <Card 
        size="small" 
        style={{ 
          marginBottom: '20px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          border: '1px solid #e8eaed'
        }}
      >
        <div className="mb-3 text-sm text-gray-700 font-semibold flex items-center gap-2">
          <Settings size={18} strokeWidth={2} className="text-purple-600" />
          모수 평가 기준
        </div>
        <ScoreSettingsCard
          settings={scoreSettings}
          onClick={onScoreSettingsClick}
        />
      </Card>
    </>
  );
}

export default PerformanceFilters;
