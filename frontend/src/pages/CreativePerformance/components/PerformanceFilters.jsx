// ============================================================================
// 광고 소재 퍼포먼스 필터 섹션
// UI 리팩토링: 검색/날짜는 항상 노출, 나머지는 토글 패널로 숨김
// ============================================================================

import { useState, useEffect } from 'react';
import { Card, Divider, DatePicker } from 'antd';
import {
  Search, X, RotateCcw, Calendar, Layers, Settings,
  Package, ChevronDown, SlidersHorizontal
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import DynamicUtmFilterBar from '../../../components/DynamicUtmFilterBar';
import UtmSourceQuickFilter from '../../../components/UtmSourceQuickFilter';

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
  const getButtonStyle = (position) => {
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
 * 토글 패널 버튼 - 클릭 시 패널 표시/숨김
 */
const TogglePanelButton = ({ icon: Icon, label, badge, isOpen, onClick, color = '#5f6368', showArrow = true }) => (
  <button
    onClick={onClick}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      height: '34px',
      padding: '0 12px',
      borderRadius: '8px',
      border: isOpen ? `1.5px solid ${color}` : '1px solid #dadce0',
      background: isOpen ? `${color}08` : '#fff',
      color: isOpen ? color : '#5f6368',
      fontSize: '13px',
      fontWeight: isOpen ? 600 : 500,
      cursor: 'pointer',
      transition: 'all 150ms ease',
      whiteSpace: 'nowrap'
    }}
  >
    <Icon size={15} style={{ flexShrink: 0 }} />
    <span>{label}</span>
    {badge && (
      <span style={{
        fontSize: '11px',
        color: '#8c8c8c',
        fontWeight: 400,
        marginLeft: '2px'
      }}>
        {badge}
      </span>
    )}
    {showArrow && (
      <ChevronDown
        size={13}
        style={{
          flexShrink: 0,
          transition: 'transform 150ms ease',
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)'
        }}
      />
    )}
  </button>
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
  minDuration,
  minPv,
  minScroll,
  minUv,
  quickFilterSources,
  // FIX (2026-02-04): Attribution Window 선택
  attributionWindow,
  onAttributionWindowChange,
  // 평가 설정 통합 모달 열기
  onEvaluationSettingsClick,
  // 컬럼 설정 모달 열기
  onColumnSettingsClick,
}) {
  // UTM 필터의 현재 source 값 (플랫폼 버튼 역방향 동기화용)
  // null = DynamicUtmFilterBar 초기화 전, [] = source 필터 없음(전체)
  const [utmSourceValues, setUtmSourceValues] = useState(null);

  // onUtmFilterChange를 가로채서 source 값 추출
  const handleUtmFilterChange = (filters) => {
    onUtmFilterChange(filters);
    const sourceFilter = filters.find(f => f.key === 'utm_source');
    if (sourceFilter) {
      const values = Array.isArray(sourceFilter.value) ? sourceFilter.value : [sourceFilter.value];
      setUtmSourceValues(values);
    } else {
      setUtmSourceValues([]);
    }
  };

  // DynamicUtmFilterBar 초기화 전에는 저장된 quickFilterSources, 이후에는 실제 UTM 필터 값
  const currentSourcesForButtons = utmSourceValues !== null ? utmSourceValues : quickFilterSources;

  const [searchTerm, setSearchTerm] = useState('');
  // 새로운 상태: 활성 그룹 (day, week, month, custom)
  const [activeGroup, setActiveGroup] = useState('month');
  // offset: 0이면 오늘/이번주/이번달, -1이면 이전, +1이면 다음
  const [offset, setOffset] = useState(0);
  const [customDateRange, setCustomDateRange] = useState(null);
  const [isDateInitialized, setIsDateInitialized] = useState(false);

  // 토글 패널 상태 (독립적으로 열고 닫기 가능)
  const [openPanels, setOpenPanels] = useState({
    utm: false,
    evaluation: false
  });

  const togglePanel = (panel) => {
    setOpenPanels(prev => ({ ...prev, [panel]: !prev[panel] }));
  };

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
    onFilterChange?.({ dateRange: getDateRangeByGroupAndOffset('month', 0) });
    onReset?.();
  };

  const isDefaultState = () => !searchTerm && activeGroup === 'month' && offset === 0;

  // 현재 표시할 날짜 범위
  const displayDateRange = customDateRange || (activeGroup !== 'custom' ? getDateRangeByGroupAndOffset(activeGroup, offset) : null);

  // UTM 필터 버튼 뱃지 (선택된 플랫폼 수)
  const utmBadge = quickFilterSources.length > 0 ? `(${quickFilterSources.length})` : null;


  return (
    <>
      {/* ================================================================ */}
      {/* 메인 필터 바: 검색 + 날짜 + 토글 버튼 (항상 노출) */}
      {/* ================================================================ */}
      <Card
        style={{
          marginBottom: '0',
          borderRadius: '16px',
          border: '1px solid #e8eaed',
          background: '#fff',
          boxShadow: 'none'
        }}
        styles={{ body: { padding: '14px 20px' } }}
      >
        {/* 1행: 검색 + 날짜 */}
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

        {/* 2행: 토글 패널 버튼 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: '1px solid #f0f0f0'
        }}>
          <TogglePanelButton
            icon={Package}
            label="광고 / UTM 필터"
            badge={utmBadge}
            isOpen={openPanels.utm}
            onClick={() => togglePanel('utm')}
            color="#722ed1"
          />
          <TogglePanelButton
            icon={Settings}
            label="모수 평가 설정"
            isOpen={false}
            onClick={onEvaluationSettingsClick}
            color="#fa8c16"
            showArrow={false}
          />
          <TogglePanelButton
            icon={SlidersHorizontal}
            label="컬럼 설정"
            isOpen={false}
            onClick={onColumnSettingsClick}
            color="#1890ff"
            showArrow={false}
          />

          {/* 광고 기여 인정 기간 탭 */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0',
            marginLeft: '4px'
          }}>
            <span style={{
              fontSize: '12px',
              color: '#8c8c8c',
              fontWeight: 500,
              marginRight: '8px',
              whiteSpace: 'nowrap'
            }}>
              광고 기여 인정 기간
            </span>
            <div style={{
              display: 'inline-flex',
              borderRadius: '8px',
              border: '1px solid #d9d9d9',
              overflow: 'hidden',
              background: '#f5f5f5'
            }}>
              {[
                { value: '7', label: '7일' },
                { value: '30', label: '30일' },
                { value: '60', label: '60일' },
                { value: '90', label: '90일' },
                { value: 'all', label: '전체' }
              ].map((opt, idx, arr) => (
                <button
                  key={opt.value}
                  onClick={() => onAttributionWindowChange?.(opt.value)}
                  style={{
                    height: '30px',
                    padding: '0 12px',
                    border: 'none',
                    borderRight: idx < arr.length - 1 ? '1px solid #d9d9d9' : 'none',
                    background: attributionWindow === opt.value ? '#1677ff' : 'transparent',
                    color: attributionWindow === opt.value ? '#fff' : '#595959',
                    fontSize: '12px',
                    fontWeight: attributionWindow === opt.value ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>


      {/* ================================================================ */}
      {/* 토글 패널 영역 (버튼 클릭 시에만 나타남) */}
      {/* ================================================================ */}

      {/* UTM 필터 패널 (display로 토글 — 재마운트/재조회 방지) */}
      <Card
        size="small"
        style={{
          marginTop: '12px',
          marginBottom: '0',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          border: '1px solid #e8eaed',
          display: openPanels.utm ? 'block' : 'none'
        }}
      >
          <div className="flex gap-6 flex-wrap">
            {/* 좌측: 광고 플랫폼 퀵 필터 (UTM Source 빠른 선택 도우미) */}
            <div className="flex-1 min-w-[300px]">
              <div className="mb-3 text-sm text-gray-700 font-semibold flex items-center gap-2">
                <Layers size={18} strokeWidth={2} className="text-blue-500" />
                광고 플랫폼 필터
              </div>
              <UtmSourceQuickFilter
                onFilterChange={(sources) => {
                  onQuickFilterChange(sources);
                }}
                loading={loading}
                currentSources={currentSourcesForButtons}
              />
            </div>

            {/* 구분선 */}
            <Divider type="vertical" className="h-auto m-0" />

            {/* 우측: UTM 필터 (메인 필터) */}
            <div className="flex-1 min-w-[300px]">
              <div className="mb-3 text-sm text-gray-700 font-semibold flex items-center gap-2">
                <Search size={18} strokeWidth={2} className="text-blue-500" />
                UTM 필터
              </div>
              <DynamicUtmFilterBar
                tableName="utm-sessions"
                onFilterChange={handleUtmFilterChange}
                loading={loading}
                excludeValues={{ utm_source: ['viral'] }}
                syncedSources={quickFilterSources}
              />
            </div>
          </div>
        </Card>
    </>
  );
}

export default PerformanceFilters;
