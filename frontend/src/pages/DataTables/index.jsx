import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Table, Tag, Typography, Space, Button, Alert } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import SearchFilterBar from '../../components/SearchFilterBar';
import DynamicUtmFilterBar from '../../components/DynamicUtmFilterBar';
import { useDataTable } from './hooks/useDataTable';
import { 
  TABLE_CONFIGS, 
  SEARCH_PLACEHOLDERS, 
  UTM_FILTER_ENABLED_TABLES,
  FILTER_VISIBILITY 
} from './config/tablesConfig.jsx';

const { Title } = Typography;

// ============================================================================
// DataTables 컴포넌트
// ============================================================================
function DataTables() {
  const { tableName } = useParams();
  const tableConfig = TABLE_CONFIGS[tableName];

  // 공통 훅 사용
  const {
    data,
    loading,
    total,
    error,
    currentPage,
    pageSize,
    activeUtmFilters,
    handleSearch,
    handleFilterChange,
    handleReset,
    handlePageChange,
    handleUtmFilterChange,
    refreshData,
    setError
  } = useDataTable(tableName);

  // 동적 컬럼을 useMemo로 메모이제이션하여 불필요한 재생성 방지
  const tableColumns = useMemo(() => {
    if (!tableConfig || !tableConfig.columns) return [];
    
    const baseColumns = tableConfig.columns;
    
    // UTM 필터가 없거나 비어있으면 원본 컬럼 반환
    if (!activeUtmFilters || activeUtmFilters.length === 0) {
      return baseColumns;
    }
    
    // 기본 UTM 컬럼 위치 찾기 (utm_source, utm_medium, utm_campaign)
    const utmSourceIndex = baseColumns.findIndex(col => col.key === 'utm_source');
    const utmMediumIndex = baseColumns.findIndex(col => col.key === 'utm_medium');
    const utmCampaignIndex = baseColumns.findIndex(col => col.key === 'utm_campaign');
    
    // 가장 마지막 기본 UTM 컬럼 위치 찾기
    const lastUtmIndex = Math.max(utmSourceIndex, utmMediumIndex, utmCampaignIndex);
    
    // UTM 컬럼이 없으면 원본 반환
    if (lastUtmIndex === -1) {
      return baseColumns;
    }
    
    // 컬럼 복사 (원본 변경 방지)
    const columns = [...baseColumns];
    
    // 추가 UTM 컬럼 생성 (기본 3개 제외)
    const additionalUtmColumns = activeUtmFilters
      .filter(filter => !['utm_source', 'utm_medium', 'utm_campaign'].includes(filter.key))
      .map(filter => ({
        title: filter.key.replace('utm_', '').replace(/_/g, ' ').toUpperCase(),
        dataIndex: ['utm_params', filter.key],
        key: `dynamic_${filter.key}`,
        width: 120,
        render: (value, record) => {
          // JSONB 데이터 확인
          if (record.utm_params && record.utm_params[filter.key]) {
            return <Tag color="purple">{record.utm_params[filter.key]}</Tag>;
          }
          return '-';
        }
      }));
    
    // 기본 UTM 컬럼 뒤에 동적 컬럼 삽입
    columns.splice(lastUtmIndex + 1, 0, ...additionalUtmColumns);
    
    return columns;
  }, [tableConfig, activeUtmFilters]);

  // 테이블 설정이 없는 경우
  if (!tableConfig) {
    return (
      <div style={{ padding: '24px' }}>
        <Alert
          message="잘못된 테이블 이름"
          description={`'${tableName}' 테이블을 찾을 수 없습니다.`}
          type="error"
          showIcon
        />
      </div>
    );
  }

  // 필터 표시 여부 가져오기
  const filterVisibility = FILTER_VISIBILITY[tableName] || {};

  return (
    <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
      {/* 헤더 */}
      <Card style={{ marginBottom: '16px' }}>
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Title level={2} style={{ margin: 0 }}>
                {tableConfig.title}
              </Title>
              <div style={{ color: '#999', fontSize: '14px', marginTop: '4px' }}>
                {tableConfig.description}
              </div>
            </div>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={refreshData}
              loading={loading}
            >
              새로고침
            </Button>
          </div>
          <Tag color="blue">총 {total.toLocaleString()}건</Tag>
        </Space>
      </Card>

      {/* 검색 및 필터 */}
      <SearchFilterBar
        searchPlaceholder={SEARCH_PLACEHOLDERS[tableName] || '검색어를 입력하세요'}
        onSearch={handleSearch}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
        showDeviceFilter={filterVisibility.showDeviceFilter}
        showBrowserFilter={filterVisibility.showBrowserFilter}
        showOsFilter={filterVisibility.showOsFilter}
        showEventTypeFilter={filterVisibility.showEventTypeFilter}
        showBouncedFilter={filterVisibility.showBouncedFilter}
        showConvertedFilter={filterVisibility.showConvertedFilter}
        showDateFilter={true}
        loading={loading}
      />

      {/* 동적 UTM 필터 - 지원되는 테이블만 */}
      {UTM_FILTER_ENABLED_TABLES.includes(tableName) && (
        <Card size="small" style={{ marginBottom: '16px' }}>
          <div style={{ marginBottom: '8px', fontSize: '13px', color: '#666', fontWeight: 500 }}>
            🔍 UTM 필터
          </div>
          <DynamicUtmFilterBar
            tableName={tableName}
            onFilterChange={handleUtmFilterChange}
            loading={loading}
          />
        </Card>
      )}

      {/* 에러 표시 */}
      {error && (
        <Alert
          message="데이터 조회 실패"
          description={error}
          type="error"
          showIcon
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: '16px' }}
        />
      )}

      {/* 테이블 */}
      <Card>
        <Table
          columns={tableColumns}
          dataSource={data}
          rowKey={(record) => record.id || record.visitor_id || record.session_id}
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: total,
            showTotal: (total) => `총 ${total.toLocaleString()}건`,
            showSizeChanger: true,
            pageSizeOptions: ['20', '50', '100', '200'],
            onChange: handlePageChange
          }}
          scroll={{ x: 'max-content' }}
          size="small"
        />
      </Card>

      {/* 푸터 */}
      <div style={{ marginTop: '16px', textAlign: 'center', color: '#999' }}>
        마지막 갱신: {dayjs().format('YYYY-MM-DD HH:mm:ss')}
      </div>
    </div>
  );
}

export default DataTables;
