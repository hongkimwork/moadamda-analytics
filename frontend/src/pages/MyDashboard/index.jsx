import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Typography, Button, Modal, DatePicker, Space, Empty } from 'antd';
import { AppstoreOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import DashboardWidget from './components/DashboardWidget';
import AddWidgetModal from './components/AddWidgetModal';
import { fetchWidgetData } from './utils/api';
import { transformWidgetData } from './utils/dataTransform';
import { loadFromLocalStorage, saveToLocalStorage } from './utils/storage';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

function MyDashboard() {
  // 컨테이너 너비 측정 (ResizeObserver로 사이드바 변화도 감지)
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(1200);
  
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    
    updateWidth();
    
    // ResizeObserver로 컨테이너 크기 변화 감지 (사이드바 접힘 포함)
    const resizeObserver = new ResizeObserver(() => {
      updateWidth();
    });
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    window.addEventListener('resize', updateWidth);
    
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, []);
  
  // 날짜 필터 state
  const [dateRange, setDateRange] = useState([
    dayjs().subtract(7, 'days'),
    dayjs()
  ]);

  // 초기화 완료 플래그
  const [initialized, setInitialized] = useState(false);

  // 위젯 목록 state - 초기값은 빈 배열, localStorage에서 로드
  const [widgets, setWidgets] = useState([]);

  // 초기 로드: localStorage에서 위젯 불러오기
  useEffect(() => {
    const loadInitialData = async () => {
      const stored = loadFromLocalStorage();
      
      if (stored && stored.widgets.length > 0) {
        // 저장된 위젯이 있으면 불러오기
        setWidgets(stored.widgets);
        if (stored.globalDateRange) {
          setDateRange(stored.globalDateRange);
        }
        
        // API 연결된 위젯들 데이터 로드
        const apiWidgets = stored.widgets.filter(w => w.presetId && w.apiEndpoint);
        if (apiWidgets.length > 0) {
          const loadedWidgets = await Promise.all(
            apiWidgets.map(async (w) => {
              try {
                const { data: apiData, compareDataList, error } = await fetchWidgetData(w);
                if (error) {
                  return { ...w, loading: false, error, data: null };
                }
                const transformedData = transformWidgetData(w, apiData, compareDataList);
                return { ...w, loading: false, error: null, data: transformedData };
              } catch (err) {
                return { ...w, loading: false, error: err.message, data: null };
              }
            })
          );
          
          setWidgets(prev => {
            const loadedMap = new Map(loadedWidgets.map(w => [w.id, w]));
            return prev.map(w => loadedMap.get(w.id) || w);
          });
        }
      } else {
        // 저장된 위젯이 없으면 기본 샘플 위젯 표시
        setWidgets([
          {
            id: 'sample-1',
            type: 'text',
            title: '시작하기',
            widthSize: 'large',
            heightSize: 'short',
            data: { 
              title: '👋 나만의 대시보드에 오신 것을 환영합니다!', 
              content: '위젯 추가 버튼을 클릭하여 원하는 데이터를 추가해보세요.' 
            }
          }
        ]);
      }
      
      setInitialized(true);
    };

    loadInitialData();
  }, []);

  // 위젯 변경 시 자동 저장 (초기화 후에만)
  useEffect(() => {
    if (initialized && widgets.length > 0) {
      // 샘플 위젯만 있는 경우는 저장하지 않음
      const hasRealWidgets = widgets.some(w => !w.id.startsWith('sample-'));
      if (hasRealWidgets) {
        saveToLocalStorage(widgets, dateRange);
      }
    }
  }, [widgets, dateRange, initialized]);

  // 모달 state
  const [addModalVisible, setAddModalVisible] = useState(false);

  // 위젯 데이터 로드 함수
  const loadWidgetData = useCallback(async (widget) => {
    // API 연결된 위젯만 처리 (presetId가 있는 경우)
    if (!widget.presetId || !widget.apiEndpoint) {
      return widget;
    }

    try {
      const { data: apiData, compareDataList, error } = await fetchWidgetData(widget);

      if (error) {
        return { ...widget, loading: false, error: error, data: null };
      }

      const transformedData = transformWidgetData(widget, apiData, compareDataList);
      return { ...widget, loading: false, error: null, data: transformedData };
    } catch (err) {
      console.error('[loadWidgetData Error]', err);
      return { ...widget, loading: false, error: err.message, data: null };
    }
  }, []);

  // 위젯 추가 시 데이터 로드
  const handleAddWidget = useCallback(async (newWidget) => {
    // 먼저 로딩 상태로 추가
    setWidgets(prev => [...prev, newWidget]);

    // API 연결된 위젯이면 데이터 로드
    if (newWidget.presetId && newWidget.apiEndpoint) {
      const loadedWidget = await loadWidgetData(newWidget);
      setWidgets(prev => prev.map(w => w.id === loadedWidget.id ? loadedWidget : w));
    }
  }, [loadWidgetData]);

  // 대시보드 날짜 변경 시 모든 위젯 데이터 새로고침
  const refreshAllWidgets = useCallback(async () => {
    const widgetsToRefresh = widgets.filter(w => w.presetId && w.apiEndpoint);
    if (widgetsToRefresh.length === 0) return;

    // 모든 위젯을 로딩 상태로
    setWidgets(prev => prev.map(w => 
      w.presetId && w.apiEndpoint ? { ...w, loading: true } : w
    ));

    // 병렬로 데이터 로드
    const loadedWidgets = await Promise.all(
      widgetsToRefresh.map(w => loadWidgetData(w))
    );

    // 결과 업데이트
    setWidgets(prev => {
      const loadedMap = new Map(loadedWidgets.map(w => [w.id, w]));
      return prev.map(w => loadedMap.get(w.id) || w);
    });
  }, [widgets, loadWidgetData]);

  // 위젯 삭제
  const handleDeleteWidget = useCallback((widgetId) => {
    Modal.confirm({
      title: '위젯 삭제',
      content: '이 위젯을 삭제하시겠습니까?',
      okText: '삭제',
      cancelText: '취소',
      okButtonProps: { danger: true },
      onOk: () => {
        setWidgets(prev => prev.filter(w => w.id !== widgetId));
      }
    });
  }, []);

  // 위젯 편집
  const handleEditWidget = useCallback((widget) => {
    console.log('Edit widget:', widget);
  }, []);

  // 위젯 크기 변경 (너비 + 높이)
  const handleResizeWidget = useCallback((widgetId, newWidthSize, newHeightSize) => {
    setWidgets(prev => prev.map(w => 
      w.id === widgetId ? { ...w, widthSize: newWidthSize, heightSize: newHeightSize } : w
    ));
  }, []);

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
                onDelete={handleDeleteWidget}
                onEdit={handleEditWidget}
                onResize={handleResizeWidget}
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
