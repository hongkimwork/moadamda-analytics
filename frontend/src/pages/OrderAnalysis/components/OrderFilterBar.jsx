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
  const [activeQuickDate, setActiveQuickDate] = useState(defaultQuickDate);
  const [customDateRange, setCustomDateRange] = useState(null);

  const getDateRange = (type) => {
    const now = dayjs();
    switch (type) {
      case 'today': return [now.startOf('day'), now.endOf('day')];
      case 'yesterday': return [now.subtract(1, 'day').startOf('day'), now.subtract(1, 'day').endOf('day')];
      case '7days': return [now.subtract(6, 'day').startOf('day'), now.endOf('day')];
      case '30days': return [now.subtract(29, 'day').startOf('day'), now.endOf('day')];
      default: return [now.startOf('day'), now.endOf('day')];
    }
  };

  useEffect(() => {
    if (defaultQuickDate && onDateChange) {
      onDateChange(getDateRange(defaultQuickDate));
    }
  }, []);

  const handleSearchSubmit = () => onSearch?.(searchTerm.trim());

  const handleQuickDateChange = (value) => {
    setActiveQuickDate(value);
    setCustomDateRange(null);
    onDateChange?.(getDateRange(value));
    onSearch?.(searchTerm.trim());
  };

  const handleCustomDateChange = (dates) => {
    if (!dates || dates.length === 0) {
      setActiveQuickDate(defaultQuickDate);
      setCustomDateRange(null);
      onDateChange?.(getDateRange(defaultQuickDate));
      return;
    }
    setCustomDateRange(dates);
    setActiveQuickDate('custom');
    onDateChange?.(dates);
  };

  const handleReset = () => {
    setSearchTerm('');
    setActiveQuickDate(defaultQuickDate);
    setCustomDateRange(null);
    onDateChange?.(getDateRange(defaultQuickDate));
    onCancelledChange?.(false);
    onPendingChange?.(false);
    onReset?.();
  };

  const isDefaultState = () => 
    !searchTerm && activeQuickDate === defaultQuickDate && !includeCancelled && !includePending;

  const dateOptions = [
    { label: '오늘', value: 'today' },
    { label: '어제', value: 'yesterday' },
    { label: '7일', value: '7days' },
    { label: '30일', value: '30days' }
  ];

  const displayDateRange = customDateRange || (activeQuickDate !== 'custom' ? getDateRange(activeQuickDate) : null);

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
            allowClear={activeQuickDate === 'custom'}
          />
        </div>

        <SegmentedButton
          options={dateOptions}
          value={activeQuickDate === 'custom' ? null : activeQuickDate}
          onChange={handleQuickDateChange}
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
