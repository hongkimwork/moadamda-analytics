import React, { useState, useCallback, useEffect } from 'react';
import { Input, Select, DatePicker, Button, Space, Card } from 'antd';
import { SearchOutlined, FilterOutlined, ReloadOutlined, CloseCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

/**
 * SearchFilterBar 컴포넌트
 * 
 * @param {Object} props
 * @param {string} props.searchPlaceholder - 검색창 placeholder
 * @param {Function} props.onSearch - 검색 실행 콜백 (searchTerm)
 * @param {Function} props.onFilterChange - 필터 변경 콜백 (filters)
 * @param {Function} props.onReset - 초기화 콜백
 * @param {boolean} props.showDeviceFilter - 기기 필터 표시 여부
 * @param {boolean} props.showBrowserFilter - 브라우저 필터 표시 여부
 * @param {boolean} props.showOsFilter - OS 필터 표시 여부
 * @param {boolean} props.showEventTypeFilter - 이벤트 타입 필터 표시 여부
 * @param {boolean} props.showBouncedFilter - 즉시 이탈 여부 필터 표시 여부
 * @param {boolean} props.showConvertedFilter - 구매 여부 필터 표시 여부
 * @param {boolean} props.showDateFilter - 날짜 필터 표시 여부
 * @param {boolean} props.loading - 로딩 상태
 * 
 * Note: UTM 필터는 동적 UTM 필터 컴포넌트 (DynamicUtmFilterBar)를 사용하세요
 */
function SearchFilterBar({
  searchPlaceholder = '검색어를 입력하세요',
  onSearch,
  onFilterChange,
  onReset,
  showDeviceFilter = true,
  showBrowserFilter = false,
  showOsFilter = false,
  showEventTypeFilter = false,
  showBouncedFilter = false,
  showConvertedFilter = false,
  showDateFilter = true,
  loading = false
}) {
  // 검색어 state
  const [searchTerm, setSearchTerm] = useState('');
  
  // 필터 state
  const [filters, setFilters] = useState({
    device: 'all',
    browser: 'all',
    os: 'all',
    event_type: 'all',
    is_bounced: 'all',
    is_converted: 'all',
    dateRange: null
  });

  // 퀵 날짜 버튼 state (선택된 버튼 추적)
  const [activeQuickDate, setActiveQuickDate] = useState(null);

  // 필터 활성화 카운트
  const [activeFilterCount, setActiveFilterCount] = useState(0);

  // 필터 활성화 카운트 계산
  useEffect(() => {
    let count = 0;
    if (filters.device !== 'all') count++;
    if (filters.browser !== 'all') count++;
    if (filters.os !== 'all') count++;
    if (filters.event_type !== 'all') count++;
    if (filters.is_bounced !== 'all') count++;
    if (filters.is_converted !== 'all') count++;
    if (filters.dateRange && filters.dateRange[0] && filters.dateRange[1]) count++;
    setActiveFilterCount(count);
  }, [filters]);

  // 검색 실행 (디바운싱)
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
  };

  // 검색 버튼 클릭 또는 엔터키
  const handleSearchSubmit = () => {
    if (onSearch) {
      onSearch(searchTerm.trim());
    }
  };

  // 디바이스 필터 변경
  const handleDeviceChange = (value) => {
    const newFilters = { ...filters, device: value };
    setFilters(newFilters);
    if (onFilterChange) {
      onFilterChange(newFilters);
    }
  };

  // 브라우저 필터 변경
  const handleBrowserChange = (value) => {
    const newFilters = { ...filters, browser: value };
    setFilters(newFilters);
    if (onFilterChange) {
      onFilterChange(newFilters);
    }
  };

  // OS 필터 변경
  const handleOsChange = (value) => {
    const newFilters = { ...filters, os: value };
    setFilters(newFilters);
    if (onFilterChange) {
      onFilterChange(newFilters);
    }
  };

  // 이벤트 타입 필터
  const handleEventTypeChange = (value) => {
    const newFilters = { ...filters, event_type: value };
    setFilters(newFilters);
    if (onFilterChange) {
      onFilterChange(newFilters);
    }
  };

  // 즉시 이탈 여부 필터 변경
  const handleBouncedChange = (value) => {
    const newFilters = { ...filters, is_bounced: value };
    setFilters(newFilters);
    if (onFilterChange) {
      onFilterChange(newFilters);
    }
  };

  // 구매 여부 필터 변경
  const handleConvertedChange = (value) => {
    const newFilters = { ...filters, is_converted: value };
    setFilters(newFilters);
    if (onFilterChange) {
      onFilterChange(newFilters);
    }
  };

  // 날짜 범위 필터 변경
  const handleDateRangeChange = (dates) => {
    const newFilters = { ...filters, dateRange: dates };
    setFilters(newFilters);
    setActiveQuickDate(null); // 직접 날짜 선택 시 퀵 버튼 선택 해제
    if (onFilterChange) {
      onFilterChange(newFilters);
    }
  };

  // 퀵 날짜 버튼 클릭 핸들러
  const handleQuickDateClick = (type) => {
    const now = dayjs();
    let startDate, endDate;

    switch (type) {
      case 'today':
        startDate = now.startOf('day');
        endDate = now.endOf('day');
        break;
      case 'yesterday':
        startDate = now.subtract(1, 'day').startOf('day');
        endDate = now.subtract(1, 'day').endOf('day');
        break;
      case '7days':
        startDate = now.subtract(6, 'day').startOf('day'); // 오늘 포함 7일
        endDate = now.endOf('day');
        break;
      case '30days':
        startDate = now.subtract(29, 'day').startOf('day'); // 오늘 포함 30일
        endDate = now.endOf('day');
        break;
      default:
        return;
    }

    // 날짜 범위 설정
    const dateRange = [startDate, endDate];
    const newFilters = { ...filters, dateRange };
    
    // state 업데이트
    setFilters(newFilters);
    setActiveQuickDate(type);
    
    // 즉시 조회 (부모 컴포넌트에 전달)
    if (onFilterChange) {
      onFilterChange(newFilters);
    }
    
    // 검색어도 함께 적용 (검색 버튼과 동일한 동작)
    if (onSearch) {
      onSearch(searchTerm.trim());
    }
  };

  // 초기화
  const handleReset = () => {
    setSearchTerm('');
    const resetFilters = {
      device: 'all',
      browser: 'all',
      os: 'all',
      event_type: 'all',
      is_bounced: 'all',
      is_converted: 'all',
      dateRange: null
    };
    setFilters(resetFilters);
    setActiveQuickDate(null); // 퀵 버튼 선택 해제
    
    // 부모 컴포넌트에도 초기화된 필터 전달
    if (onFilterChange) {
      onFilterChange(resetFilters);
    }
    
    if (onReset) {
      onReset();
    }
  };

  // 디바이스 옵션
  const deviceOptions = [
    { label: '전체', value: 'all' },
    { label: '📱 Mobile', value: 'mobile' },
    { label: '💻 PC', value: 'pc' }
  ];

  // 브라우저 옵션
  const browserOptions = [
    { label: '전체', value: 'all' },
    { label: '🌐 Chrome', value: 'Chrome' },
    { label: '🧭 Safari', value: 'Safari' },
    { label: '❓ Unknown', value: 'Unknown' }
  ];

  // OS 옵션
  const osOptions = [
    { label: '전체', value: 'all' },
    { label: '🍎 macOS', value: 'macOS' },
    { label: '🪟 Windows', value: 'Windows' },
    { label: '🤖 Android', value: 'Android' },
    { label: '🐧 Linux', value: 'Linux' },
    { label: '❓ Unknown', value: 'Unknown' }
  ];

  // 이벤트 타입 옵션
  const eventTypeOptions = [
    { label: '전체', value: 'all' },
    { label: '🔍 상품 조회', value: 'view_product' },
    { label: '🛒 장바구니', value: 'add_to_cart' },
    { label: '💰 구매', value: 'purchase' }
  ];

  // 즉시 이탈 여부 옵션
  const bouncedOptions = [
    { label: '전체', value: 'all' },
    { label: '정상 (N)', value: 'false' },
    { label: '즉시 이탈 (Y)', value: 'true' }
  ];

  // 구매 여부 옵션
  const convertedOptions = [
    { label: '전체', value: 'all' },
    { label: '구매 (✅)', value: 'true' },
    { label: '미구매 (-)', value: 'false' }
  ];

  return (
    <Card 
      size="small" 
      style={{ marginBottom: '16px' }}
      bodyStyle={{ padding: '12px 16px' }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        {/* 검색창 + 날짜 필터 + 퀵 버튼 */}
        <Space wrap style={{ width: '100%' }} size="small">
          <Input
            placeholder={searchPlaceholder}
            prefix={<SearchOutlined />}
            value={searchTerm}
            onChange={handleSearchChange}
            onPressEnter={handleSearchSubmit}
            allowClear
            disabled={loading}
            style={{ width: '45%', minWidth: '350px' }}
          />
          <Button 
            type="primary" 
            icon={<SearchOutlined />}
            onClick={handleSearchSubmit}
            loading={loading}
          >
            검색
          </Button>
          
          {/* 날짜 범위 선택 */}
          {showDateFilter && (
            <>
              <RangePicker
                value={filters.dateRange}
                onChange={handleDateRangeChange}
                format="YYYY-MM-DD"
                placeholder={['시작일', '종료일']}
                disabled={loading}
                size="middle"
                style={{ width: 240 }}
              />
              
              {/* 퀵 날짜 버튼 */}
              <Button
                size="middle"
                onClick={() => handleQuickDateClick('today')}
                disabled={loading}
                type={activeQuickDate === 'today' ? 'primary' : 'default'}
              >
                오늘
              </Button>
              <Button
                size="middle"
                onClick={() => handleQuickDateClick('yesterday')}
                disabled={loading}
                type={activeQuickDate === 'yesterday' ? 'primary' : 'default'}
              >
                어제
              </Button>
              <Button
                size="middle"
                onClick={() => handleQuickDateClick('7days')}
                disabled={loading}
                type={activeQuickDate === '7days' ? 'primary' : 'default'}
              >
                최근 7일
              </Button>
              <Button
                size="middle"
                onClick={() => handleQuickDateClick('30days')}
                disabled={loading}
                type={activeQuickDate === '30days' ? 'primary' : 'default'}
              >
                최근 30일
              </Button>
              
              {/* 기기 필터 - 날짜 버튼 우측에 배치 */}
              {showDeviceFilter && (
                <Select
                  value={filters.device}
                  onChange={handleDeviceChange}
                  options={deviceOptions}
                  style={{ width: 110 }}
                  disabled={loading}
                  size="middle"
                  placeholder="기기"
                />
              )}
              
              {/* 초기화 버튼 - 두 번째 줄 필터가 없을 때 첫 번째 줄에 표시 */}
              {!(showBrowserFilter || showOsFilter || showEventTypeFilter || showBouncedFilter || showConvertedFilter) && (searchTerm || activeFilterCount > 0) && (
                <Button
                  icon={<CloseCircleOutlined />}
                  onClick={handleReset}
                  disabled={loading}
                  size="middle"
                  danger
                >
                  초기화
                </Button>
              )}
            </>
          )}
        </Space>

        {/* 필터 영역 (기기 필터 제외한 나머지) */}
        {(showBrowserFilter || showOsFilter || showEventTypeFilter || showBouncedFilter || showConvertedFilter) && (
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Space wrap style={{ width: '100%', alignItems: 'center' }} size="small">
              <FilterOutlined style={{ color: activeFilterCount > 0 ? '#1890ff' : '#999', fontSize: '16px' }} />

              {/* 브라우저 필터 */}
              {showBrowserFilter && (
                <Space.Compact>
                  <Button size="small" style={{ pointerEvents: 'none', backgroundColor: '#f0f0f0', border: '1px solid #d9d9d9' }}>
                    브라우저
                  </Button>
                  <Select
                    value={filters.browser}
                    onChange={handleBrowserChange}
                    options={browserOptions}
                    style={{ width: 120 }}
                    disabled={loading}
                    size="small"
                  />
                </Space.Compact>
              )}

              {/* OS 필터 */}
              {showOsFilter && (
                <Space.Compact>
                  <Button size="small" style={{ pointerEvents: 'none', backgroundColor: '#f0f0f0', border: '1px solid #d9d9d9' }}>
                    운영체제
                  </Button>
                  <Select
                    value={filters.os}
                    onChange={handleOsChange}
                    options={osOptions}
                    style={{ width: 120 }}
                    disabled={loading}
                    size="small"
                  />
                </Space.Compact>
              )}

              {/* 이벤트 타입 필터 */}
              {showEventTypeFilter && (
                <Space.Compact>
                  <Button size="small" style={{ pointerEvents: 'none', backgroundColor: '#e6f7ff', border: '1px solid #91d5ff' }}>
                    이벤트 타입
                  </Button>
                  <Select
                    value={filters.event_type}
                    onChange={handleEventTypeChange}
                    options={eventTypeOptions}
                    style={{ width: 130 }}
                    disabled={loading}
                    size="small"
                  />
                </Space.Compact>
              )}

              {/* 즉시 이탈 여부 필터 */}
              {showBouncedFilter && (
                <Space.Compact>
                  <Button size="small" style={{ pointerEvents: 'none', backgroundColor: '#fff7e6', border: '1px solid #ffd591' }}>
                    즉시 이탈
                  </Button>
                  <Select
                    value={filters.is_bounced}
                    onChange={handleBouncedChange}
                    options={bouncedOptions}
                    style={{ width: 140 }}
                    disabled={loading}
                    size="small"
                  />
                </Space.Compact>
              )}

              {/* 구매 여부 필터 */}
              {showConvertedFilter && (
                <Space.Compact>
                  <Button size="small" style={{ pointerEvents: 'none', backgroundColor: '#f6ffed', border: '1px solid #b7eb8f' }}>
                    구매 여부
                  </Button>
                  <Select
                    value={filters.is_converted}
                    onChange={handleConvertedChange}
                    options={convertedOptions}
                    style={{ width: 120 }}
                    disabled={loading}
                    size="small"
                  />
                </Space.Compact>
              )}

              {/* 초기화 버튼 */}
              {(searchTerm || activeFilterCount > 0) && (
                <Button
                  icon={<CloseCircleOutlined />}
                  onClick={handleReset}
                  disabled={loading}
                  size="small"
                  danger
                >
                  초기화
                </Button>
              )}

              {/* 필터 활성화 표시 */}
              {activeFilterCount > 0 && (
                <span style={{ 
                  color: '#1890ff', 
                  fontSize: '12px',
                  fontWeight: 'bold',
                  marginLeft: '8px'
                }}>
                  {activeFilterCount}개 필터 적용 중
                </span>
              )}
            </Space>
          </Space>
        )}
      </Space>
    </Card>
  );
}

export default SearchFilterBar;

