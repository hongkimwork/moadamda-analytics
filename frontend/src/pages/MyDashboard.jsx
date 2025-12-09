import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, Typography, Button, Modal, DatePicker, Space, Dropdown, Empty, Input, Radio, Steps, Checkbox, Spin } from 'antd';
import {
  AppstoreOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  DragOutlined,
  MoreOutlined,
  LockOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckOutlined,
  LoadingOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  DATA_SOURCES,
  WIDGET_PRESETS,
  DATE_PRESETS,
  getComparisonPeriod,
  WIDTH_SIZES,
  HEIGHT_SIZES,
  getWidthSizeFromCols,
  getHeightSizeFromPixels,
  WIDGET_TYPES
} from './constants';
import {
  saveToLocalStorage,
  loadFromLocalStorage,
  fetchWidgetData,
  getValueFromData,
  calculateChange,
  transformWidgetData,
  generateDummyData
} from './utils';
import {
  useContainerSize,
  useWidgetData,
  useWidgets,
  useWidgetPersistence
} from './hooks';
import {
  DashboardWidget,
  AddWidgetModal
} from './components';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;



// ============================================================================
// 메인 대시보드 컴포넌트
// ============================================================================
function MyDashboard() {
  // 컨테이너 너비 측정 (커스텀 훅)
  const containerRef = useRef(null);
  const containerWidth = useContainerSize(containerRef);

  // 날짜 필터 state
  const [dateRange, setDateRange] = useState([
    dayjs().subtract(7, 'days'),
    dayjs()
  ]);

  // 위젯 CRUD 훅
  const {
    widgets,
    setWidgets,
    initialized,
    setInitialized,
    addWidget,
    deleteWidget,
    editWidget,
    resizeWidget,
    updateWidgetData,
    updateMultipleWidgets,
    setWidgetsLoading
  } = useWidgets();

  // 위젯 데이터 로딩 훅
  const { loadWidgetData } = useWidgetData();

  // 위젯 초기화 및 자동 저장 훅
  const { loadInitialWidgets } = useWidgetPersistence(widgets, dateRange, initialized);

  // 초기 로드: localStorage에서 위젯 불러오기
  useEffect(() => {
    const loadInitialData = async () => {
      const { widgets: initialWidgets, dateRange: initialDateRange } = await loadInitialWidgets();

      setWidgets(initialWidgets);
      if (initialDateRange) {
        setDateRange(initialDateRange);
      }

      // API 연결된 위젯들 데이터 로드
      const apiWidgets = initialWidgets.filter(w => w.presetId && w.apiEndpoint);
      if (apiWidgets.length > 0) {
        const loadedWidgets = await Promise.all(apiWidgets.map(loadWidgetData));
        updateMultipleWidgets(loadedWidgets);
      }

      setInitialized(true);
    };

    loadInitialData();
  }, []);

  // 모달 state
  const [addModalVisible, setAddModalVisible] = useState(false);

  // 위젯 추가 시 데이터 로드
  const handleAddWidget = useCallback(async (newWidget) => {
    // 먼저 로딩 상태로 추가
    addWidget(newWidget);

    // API 연결된 위젯이면 데이터 로드
    if (newWidget.presetId && newWidget.apiEndpoint) {
      const loadedWidget = await loadWidgetData(newWidget);
      updateWidgetData(loadedWidget.id, loadedWidget);
    }
  }, [addWidget, loadWidgetData, updateWidgetData]);

  // 대시보드 날짜 변경 시 모든 위젯 데이터 새로고침
  const refreshAllWidgets = useCallback(async () => {
    const widgetsToRefresh = widgets.filter(w => w.presetId && w.apiEndpoint);
    if (widgetsToRefresh.length === 0) return;

    // 모든 위젯을 로딩 상태로
    setWidgetsLoading(true);

    // 병렬로 데이터 로드
    const loadedWidgets = await Promise.all(widgetsToRefresh.map(loadWidgetData));

    // 결과 업데이트
    updateMultipleWidgets(loadedWidgets);
  }, [widgets, loadWidgetData, setWidgetsLoading, updateMultipleWidgets]);

  const gap = 16;
  const colWidth = (containerWidth - gap * 2) / 3;

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      {/* 헤더 영역 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 24,
        background: 'white',
        padding: '16px 24px',
        borderRadius: 8,
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <AppstoreOutlined style={{ fontSize: 24, color: '#1890ff' }} />
          <Title level={4} style={{ margin: 0 }}>나만의 대시보드</Title>
        </div>
        
        <Space size="middle">
          <RangePicker
            value={dateRange}
            onChange={setDateRange}
            format="YYYY-MM-DD"
            allowClear={false}
            style={{ width: 260 }}
            presets={[
              { label: '오늘', value: [dayjs(), dayjs()] },
              { label: '최근 7일', value: [dayjs().subtract(7, 'days'), dayjs()] },
              { label: '최근 30일', value: [dayjs().subtract(30, 'days'), dayjs()] },
              { label: '이번 달', value: [dayjs().startOf('month'), dayjs()] }
            ]}
          />
          
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => setAddModalVisible(true)}
          >
            위젯 추가
          </Button>
        </Space>
      </div>

      {/* 위젯 그리드 영역 */}
      <div ref={containerRef}>
        {widgets.length === 0 ? (
          <Card style={{ textAlign: 'center', padding: 60 }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div>
                  <Text type="secondary" style={{ fontSize: 16, display: 'block', marginBottom: 16 }}>
                    아직 추가된 위젯이 없습니다
                  </Text>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalVisible(true)}>
                    첫 번째 위젯 추가하기
                  </Button>
                </div>
              }
            />
          </Card>
        ) : (
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: gap,
            alignItems: 'flex-start',
            paddingBottom: 40
          }}>
            {widgets.map(widget => (
              <DashboardWidget
                key={widget.id}
                widget={widget}
                onDelete={deleteWidget}
                onEdit={editWidget}
                onResize={resizeWidget}
                containerWidth={containerWidth}
                containerRef={containerRef}
              />
            ))}
            
            {/* 위젯 추가 플레이스홀더 */}
            <div 
              onClick={() => setAddModalVisible(true)}
              style={{ 
                width: colWidth,
                minWidth: 200,
                height: 150,
                border: '2px dashed #d9d9d9',
                borderRadius: 8,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                background: 'white',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#1890ff';
                e.currentTarget.style.background = '#fafafa';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#d9d9d9';
                e.currentTarget.style.background = 'white';
              }}
            >
              <PlusOutlined style={{ fontSize: 32, color: '#bfbfbf', marginBottom: 8 }} />
              <Text type="secondary">위젯 추가</Text>
            </div>
          </div>
        )}
      </div>

      {/* 위젯 추가 모달 */}
      <AddWidgetModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onAdd={handleAddWidget}
      />
    </div>
  );
}

export default MyDashboard;
