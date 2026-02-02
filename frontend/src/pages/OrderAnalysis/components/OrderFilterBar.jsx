/**
 * 주문 목록 페이지 전용 필터 바
 * 미니멀 통합형 디자인
 */

import { useState, useEffect } from 'react';
import { DatePicker, Card } from 'antd';
import { Search, X, RotateCcw, Calendar, Clock } from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';

const { RangePicker } = DatePicker;

/**
 * Filter Chip - 높이 36px 통일
 */
const FilterChip = ({ selected, onClick, children, disabled, variant = 'default' }) => {
  // variant별 색상 설정
  const getColors = () => {
    if (!selected) {
      return {
        border: '#dadce0',
        background: '#fff',
        color: '#5f6368'
      };
    }
    switch (variant) {
      case 'danger':
        return {
          border: '#f5222d',
          background: '#fff1f0',
          color: '#cf1322'
        };
      case 'warning':
        return {
          border: '#faad14',
          background: '#fffbe6',
          color: '#d48806'
        };
      default:
        return {
          border: '#1a73e8',
          background: '#e8f0fe',
          color: '#1a73e8'
        };
    }
  };

  const colors = getColors();

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        height: '36px',
        padding: '0 14px',
        borderRadius: '8px',
        fontSize: '13px',
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 150ms ease',
        border: `1px solid ${colors.border}`,
        background: colors.background,
        color: colors.color,
        opacity: disabled ? 0.5 : 1,
        whiteSpace: 'nowrap'
      }}
    >
      {children}
    </button>
  );
};

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
    minWidth: '400px',
    width: '505px',
    transition: 'all 150ms ease',
    borderRadius: '8px'
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

function OrderFilterBar({
  onSearch,
  onDateChange,
  onCancelledChange,
  onPendingChange,
  onReset,
  includeCancelled = false,
  includePending = false,
  defaultQuickDate = 'today',
  loading = false
}) {
  const [searchTerm, setSearchTerm] = useState('');
  // 새로운 상태: 활성 그룹 (day, week, month, custom)
  const [activeGroup, setActiveGroup] = useState('day');
  // offset: 0이면 오늘/이번주/이번달, -1이면 이전, +1이면 다음
  const [offset, setOffset] = useState(0);
  const [customDateRange, setCustomDateRange] = useState(null);

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

  // 기존 defaultQuickDate를 새로운 시스템으로 변환
  useEffect(() => {
    if (onDateChange) {
      onDateChange(getDateRangeByGroupAndOffset('day', 0));
    }
  }, []);

  const handleSearchSubmit = () => onSearch?.(searchTerm.trim());

  /**
   * 날짜 그룹 중앙 버튼 클릭 (오늘/이번주/이번달)
   */
  const handleGroupCenterClick = (group) => {
    setActiveGroup(group);
    setOffset(0);
    setCustomDateRange(null);
    const dateRange = getDateRangeByGroupAndOffset(group, 0);
    onDateChange?.(dateRange);
    onSearch?.(searchTerm.trim());
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
    onDateChange?.(dateRange);
    onSearch?.(searchTerm.trim());
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
    onDateChange?.(dateRange);
    onSearch?.(searchTerm.trim());
  };

  const handleCustomDateChange = (dates) => {
    if (!dates || dates.length === 0) {
      // 날짜 선택 취소시 기본값으로
      setActiveGroup('day');
      setOffset(0);
      setCustomDateRange(null);
      onDateChange?.(getDateRangeByGroupAndOffset('day', 0));
      return;
    }
    setCustomDateRange(dates);
    setActiveGroup('custom');
    setOffset(0);
    onDateChange?.(dates);
  };

  const handleReset = () => {
    setSearchTerm('');
    setActiveGroup('day');
    setOffset(0);
    setCustomDateRange(null);
    onDateChange?.(getDateRangeByGroupAndOffset('day', 0));
    onCancelledChange?.(false);
    onPendingChange?.(false);
    onReset?.();
  };

  const isDefaultState = () => 
    !searchTerm && activeGroup === 'day' && offset === 0 && !includeCancelled && !includePending;

  // 현재 표시할 날짜 범위
  const displayDateRange = customDateRange || (activeGroup !== 'custom' ? getDateRangeByGroupAndOffset(activeGroup, offset) : null);

  return (
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
          placeholder="주문번호/상품명 검색"
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

        {/* 필터 칩 */}
        <FilterChip
          selected={includeCancelled}
          onClick={() => onCancelledChange?.(!includeCancelled)}
          disabled={loading}
          variant="danger"
        >
          <X size={14} />
          취소/반품 포함
        </FilterChip>
        
        <FilterChip
          selected={includePending}
          onClick={() => onPendingChange?.(!includePending)}
          disabled={loading}
          variant="warning"
        >
          <Clock size={14} />
          입금대기 포함
        </FilterChip>

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
  );
}

export default OrderFilterBar;
