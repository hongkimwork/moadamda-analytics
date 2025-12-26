import { useState, useMemo, useEffect, useCallback } from 'react';
import { Table, Input, Typography, Tooltip, Empty, Alert, Button, Space } from 'antd';
import { SearchOutlined, SettingOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { Resizable } from 'react-resizable';
import 'react-resizable/css/styles.css';
import '../styles/table.css';
import '../styles/thumbnail.css';
import { 
  formatNumber, 
  formatCurrency, 
  formatPercent, 
  getStatusColor, 
  getStatusText 
} from '../utils/formatters';
import {
  getColumnsForTab,
  loadColumnSettings,
  saveColumnSettings,
  resetColumnSettings
} from '../utils/columnDefinitions';
import ColumnSettingsModal from './ColumnSettingsModal';
import AdThumbnailPreview from './AdThumbnailPreview';

const { Text } = Typography;

/**
 * Resizable 헤더 셀 - 메타 광고 관리자 스타일
 * 컬럼 경계선이 테이블 전체 높이로 표시됨 (16px 너비 핸들)
 */
const ResizableTitle = (props) => {
  const { onResize, width, minWidth = 80, ...restProps } = props;

  if (!width) {
    return <th {...restProps} />;
  }

  return (
    <Resizable
      width={width}
      height={0}
      minConstraints={[minWidth, 0]}
      handle={
        <div
          className="react-resizable-handle"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          onMouseDown={(e) => e.stopPropagation()}
        />
      }
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...restProps} style={{ ...restProps.style, position: 'relative', userSelect: 'none', overflow: 'visible' }} />
    </Resizable>
  );
};

/**
 * 렌더러 함수들
 */
const renderers = {
  name: (value, record, tabType) => {
    // 광고 탭인 경우 썸네일 포함
    if (tabType === 'ad') {
      return (
        <div className="ad-name-cell">
          <AdThumbnailPreview
            thumbnailUrl={record.thumbnailUrl}
            isVideo={record.isVideo}
            name={value}
            adId={record.id}
          />
          <div className="ad-name-info">
            <span className="ad-name-text" title={value}>{value}</span>
            <div className="ad-name-id">ID: {record.id}</div>
          </div>
        </div>
      );
    }
    
    // 캠페인/광고세트 탭
    return (
      <div>
        <Text strong style={{ color: '#1877F2' }}>{value}</Text>
        <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
          ID: {record.id}
        </div>
      </div>
    );
  },
  
  status: (value) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: getStatusColor(value)
      }} />
      <span>{getStatusText(value)}</span>
    </div>
  ),
  
  text: (value) => <Text type="secondary">{value || '-'}</Text>,
  
  number: (value, record, tabType, insightKey) => {
    const val = record.insights?.[insightKey];
    return formatNumber(val);
  },
  
  decimal: (value, record, tabType, insightKey) => {
    const val = record.insights?.[insightKey];
    if (val === null || val === undefined) return '-';
    return Number(val).toFixed(2);
  },
  
  currency: (value, record, tabType, insightKey) => {
    const val = record.insights?.[insightKey];
    return formatCurrency(val);
  },
  
  percent: (value, record, tabType, insightKey) => {
    const val = record.insights?.[insightKey];
    return formatPercent(val);
  },
  
  budget: (value) => {
    if (!value) return '-';
    // Meta API는 센트 단위로 반환하므로 100으로 나눔
    return formatCurrency(Number(value) / 100);
  },
  
  results: (value, record) => {
    const actions = record.insights?.actions;
    if (!actions) return '-';
    const purchase = actions.find(a => 
      a.action_type === 'purchase' || 
      a.action_type === 'omni_purchase' ||
      a.action_type === 'offsite_conversion.fb_pixel_purchase'
    );
    return purchase ? formatNumber(purchase.value) : '-';
  },
  
  costPerResult: (value, record) => {
    const costs = record.insights?.cost_per_action_type;
    if (!costs) return '-';
    const purchase = costs.find(a => 
      a.action_type === 'purchase' || 
      a.action_type === 'omni_purchase' ||
      a.action_type === 'offsite_conversion.fb_pixel_purchase'
    );
    return purchase ? formatCurrency(purchase.value) : '-';
  },
  
  roas: (value, record, tabType, insightKey) => {
    const roas = record.insights?.[insightKey];
    if (!roas || !roas[0]) return '-';
    return `${Number(roas[0].value).toFixed(2)}x`;
  },
  
  actionValue: (value, record, tabType, insightKey) => {
    const actions = record.insights?.[insightKey];
    if (!actions || !actions[0]) return '-';
    return formatNumber(actions[0].value);
  },
  
  actionCurrency: (value, record, tabType, insightKey) => {
    const actions = record.insights?.[insightKey];
    if (!actions || !actions[0]) return '-';
    return formatCurrency(actions[0].value);
  },
  
  actionValues: (value, record) => {
    const values = record.insights?.action_values;
    if (!values) return '-';
    const purchase = values.find(a => 
      a.action_type === 'purchase' || 
      a.action_type === 'omni_purchase' ||
      a.action_type === 'offsite_conversion.fb_pixel_purchase'
    );
    return purchase ? formatCurrency(purchase.value) : '-';
  }
};

/**
 * 통합 Meta 테이블 컴포넌트
 */
function MetaTable({
  tabType, // 'campaign' | 'adset' | 'ad'
  data,
  loading,
  selectedIds,
  onSelectionChange,
  filterAlert
}) {
  const [searchText, setSearchText] = useState('');
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  
  // 컬럼 설정 상태
  const [visibleColumns, setVisibleColumns] = useState([]);
  const [columnWidths, setColumnWidths] = useState({});
  const [columnOrder, setColumnOrder] = useState([]);

  // 초기 설정 로드
  useEffect(() => {
    const settings = loadColumnSettings(tabType);
    setVisibleColumns(settings.visibleColumns);
    setColumnWidths(settings.columnWidths);
    setColumnOrder(settings.columnOrder || settings.visibleColumns);
  }, [tabType]);

  // 검색 필터링
  const filteredData = useMemo(() => {
    if (!searchText) return data;
    const lower = searchText.toLowerCase();
    return data.filter(item => item.name?.toLowerCase().includes(lower));
  }, [data, searchText]);

  // 컬럼 너비 변경 핸들러
  const handleResize = useCallback((columnKey) => (e, { size }) => {
    // 최소 너비 적용
    const availableColumns = getColumnsForTab(tabType);
    const colDef = availableColumns.find(c => c.key === columnKey);
    const minWidth = colDef?.minWidth || 80;
    const newWidth = Math.max(size.width, minWidth);
    
    const newWidths = { ...columnWidths, [columnKey]: newWidth };
    setColumnWidths(newWidths);
    saveColumnSettings(tabType, { columnWidths: newWidths });
  }, [columnWidths, tabType]);

  // 컬럼 설정 적용
  const handleApplyColumns = useCallback((newVisibleColumns, newColumnOrder) => {
    setVisibleColumns(newVisibleColumns);
    setColumnOrder(newColumnOrder);
    saveColumnSettings(tabType, { 
      visibleColumns: newVisibleColumns,
      columnOrder: newColumnOrder 
    });
  }, [tabType]);

  // 설정 초기화
  const handleResetSettings = useCallback(() => {
    resetColumnSettings(tabType);
    const settings = loadColumnSettings(tabType);
    setVisibleColumns(settings.visibleColumns);
    setColumnWidths(settings.columnWidths);
    setColumnOrder(settings.visibleColumns);
  }, [tabType]);

  // 테이블 컬럼 생성 (columnOrder 순서 적용)
  const tableColumns = useMemo(() => {
    const availableColumns = getColumnsForTab(tabType);
    
    // columnOrder 순서대로 정렬, 없으면 visibleColumns 순서
    const orderedKeys = columnOrder.length > 0 
      ? columnOrder.filter(k => visibleColumns.includes(k))
      : visibleColumns;
    
    return orderedKeys
      .map(colKey => {
        const colDef = availableColumns.find(c => c.key === colKey);
        if (!colDef) return null;

        const width = columnWidths[colKey] || colDef.width;
        const minWidth = colDef.minWidth || 80;
        
        const column = {
          key: colDef.key,
          dataIndex: colDef.key === 'status' ? 'effective_status' : colDef.key,
          title: colDef.tooltip ? (
            <Tooltip title={colDef.tooltip}>
              {colDef.title} <InfoCircleOutlined style={{ fontSize: '12px' }} />
            </Tooltip>
          ) : colDef.title,
          width,
          align: colDef.align,
          ellipsis: true, // 모든 컬럼에 ellipsis 적용 (너비 조절 가능하도록)
          onHeaderCell: () => ({
            width,
            minWidth,
            onResize: handleResize(colDef.key)
          })
        };

        // 렌더러 설정
        const renderer = renderers[colDef.render];
        if (renderer) {
          column.render = (value, record) => 
            renderer(value, record, tabType, colDef.insightKey);
        }

        // 정렬
        if (['number', 'currency', 'percent', 'decimal'].includes(colDef.render)) {
          column.sorter = (a, b) => {
            const aVal = Number(a.insights?.[colDef.insightKey] || 0);
            const bVal = Number(b.insights?.[colDef.insightKey] || 0);
            return aVal - bVal;
          };
        }

        return column;
      })
      .filter(Boolean);
  }, [visibleColumns, columnWidths, columnOrder, tabType, handleResize]);

  // 행 선택 설정
  const rowSelection = onSelectionChange ? {
    selectedRowKeys: selectedIds || [],
    onChange: (selectedRowKeys) => onSelectionChange(selectedRowKeys)
  } : undefined;

  // 테이블 컴포넌트 설정
  const components = {
    header: {
      cell: ResizableTitle
    }
  };

  const labelMap = { campaign: '캠페인', adset: '광고 세트', ad: '광고' };

  return (
    <div className="meta-table-wrapper">
      {/* 필터 알림 */}
      {filterAlert && (
        <Alert
          message={filterAlert}
          type="info"
          showIcon
          style={{ marginBottom: '16px' }}
        />
      )}

      {/* 툴바 */}
      <div style={{ 
        marginBottom: '16px', 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Space>
          <Input
            placeholder={`${labelMap[tabType]} 이름 검색...`}
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: '300px' }}
            allowClear
          />
          <Text type="secondary">
            총 {filteredData.length}개 {labelMap[tabType]}
          </Text>
        </Space>

        <Button 
          icon={<SettingOutlined />}
          onClick={() => setSettingsModalOpen(true)}
        >
          컬럼 설정
        </Button>
      </div>

      {/* 테이블 */}
      <Table
        rowKey="id"
        columns={tableColumns}
        dataSource={filteredData}
        loading={loading}
        rowSelection={rowSelection}
        components={components}
        scroll={{ x: 'max-content' }}
        pagination={{
          pageSize: 50,
          showSizeChanger: true,
          showTotal: (total) => `총 ${total}개`
        }}
        size="middle"
        locale={{
          emptyText: <Empty description={`활성화된 ${labelMap[tabType]}이(가) 없습니다`} />
        }}
      />

      {/* 컬럼 설정 모달 */}
      <ColumnSettingsModal
        open={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        tabType={tabType}
        visibleColumns={visibleColumns}
        columnOrder={columnOrder}
        onApply={handleApplyColumns}
        onReset={handleResetSettings}
      />
    </div>
  );
}

export default MetaTable;
