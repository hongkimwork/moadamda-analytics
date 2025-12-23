// ============================================================================
// 광고 소재 퍼포먼스 필터 섹션
// ============================================================================

import React from 'react';
import { Card, Divider } from 'antd';
import { Search, Layers } from 'lucide-react';
import SearchFilterBar from '../../../components/SearchFilterBar';
import DynamicUtmFilterBar from '../../../components/DynamicUtmFilterBar';
import UtmSourceQuickFilter from '../../../components/UtmSourceQuickFilter';

/**
 * 퍼포먼스 필터 섹션 컴포넌트
 * @param {Object} props
 * @param {Function} props.onSearch - 검색 핸들러
 * @param {Function} props.onFilterChange - 필터 변경 핸들러
 * @param {Function} props.onReset - 초기화 핸들러
 * @param {Object} props.filters - 현재 필터 상태
 * @param {Function} props.onQuickFilterChange - 퀵 필터 변경 핸들러
 * @param {Function} props.onUtmFilterChange - UTM 필터 변경 핸들러
 * @param {boolean} props.loading - 로딩 상태
 */
function PerformanceFilters({
  onSearch,
  onFilterChange,
  onReset,
  filters,
  onQuickFilterChange,
  onUtmFilterChange,
  loading
}) {
  return (
    <>
      {/* 검색 및 필터 */}
      <SearchFilterBar
        searchPlaceholder="광고 소재 이름으로 검색..."
        onSearch={onSearch}
        onFilterChange={onFilterChange}
        onReset={onReset}
        filters={filters}
        showDeviceFilter={false}
        showBrowserFilter={false}
        showOsFilter={false}
        showBouncedFilter={false}
        showConvertedFilter={false}
        showUtmFilter={false}
        defaultActiveQuickDate="30days"
        loading={loading}
      />

      {/* UTM 필터 영역 (퀵 필터 + 동적 필터) */}
      <Card 
        size="small" 
        style={{ 
          marginBottom: '20px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          border: '1px solid #e8eaed'
        }}
      >
        <div style={{ 
          display: 'flex', 
          gap: '24px',
          flexWrap: 'wrap'
        }}>
          {/* 좌측: UTM Source 퀵 필터 */}
          <div style={{ flex: '1 1 45%', minWidth: '300px' }}>
            <div style={{ 
              marginBottom: '12px', 
              fontSize: '14px', 
              color: '#374151', 
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Layers size={18} strokeWidth={2} style={{ color: '#1890ff' }} />
              광고 플랫폼
            </div>
            <UtmSourceQuickFilter
              onFilterChange={onQuickFilterChange}
              loading={loading}
            />
          </div>

          {/* 구분선 */}
          <Divider type="vertical" style={{ height: 'auto', margin: '0' }} />

          {/* 우측: 동적 UTM 필터 */}
          <div style={{ flex: '1 1 45%', minWidth: '300px' }}>
            <div style={{ 
              marginBottom: '12px', 
              fontSize: '14px', 
              color: '#374151', 
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Search size={18} strokeWidth={2} style={{ color: '#1890ff' }} />
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
    </>
  );
}

export default PerformanceFilters;
