import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Card, Typography, Button, Modal, Empty } from 'antd';
import { AppstoreOutlined, PlusOutlined } from '@ant-design/icons';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import DashboardWidget from './components/DashboardWidget';
import AddWidgetModal from './components/AddWidgetModal';
import { fetchWidgetData } from './utils/api';
import { transformWidgetData } from './utils/dataTransform';
import { loadFromLocalStorage, saveToLocalStorage } from './utils/storage';
import { WIDTH_SIZES, HEIGHT_SIZES } from './constants.jsx';

const { Title, Text } = Typography;

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
  
  // 초기화 완료 플래그
  const [initialized, setInitialized] = useState(false);

  // 위젯 목록 state - 초기값은 빈 배열, localStorage에서 로드
  const [widgets, setWidgets] = useState([]);

  // 초기 로드: localStorage에서 위젯 불러오기
  useEffect(() => {
    const loadInitialData = async () => {
      const stored = loadFromLocalStorage();
      
      if (stored && stored.widgets.length > 0) {
        // 저장된 위젯이 있으면 불러오기 (heightSize 마이그레이션: short -> medium)
        const migratedWidgets = stored.widgets.map(widget => ({
          ...widget,
          heightSize: widget.heightSize === 'short' ? 'medium' : widget.heightSize
        }));
        setWidgets(migratedWidgets);
        
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
        saveToLocalStorage(widgets);
      }
    }
  }, [widgets, initialized]);

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

  // 첫 번째 빈 칸 찾기 (새 위젯 배치용)
  const findFirstEmptySlot = useCallback((widgetsList, newWidgetCols = 1, newWidgetUnits = 5) => {
    // 3열 그리드에서 빈 공간 찾기
    const occupiedCells = new Set();
    
    widgetsList.forEach(w => {
      const cols = WIDTH_SIZES[w.widthSize]?.cols || 1;
      const units = HEIGHT_SIZES[w.heightSize]?.units || 5;
      const startX = w.gridX !== undefined ? w.gridX : 0;
      const startY = w.gridY !== undefined ? w.gridY : 0;
      
      // 해당 위젯이 차지하는 모든 셀 표시
      for (let x = startX; x < startX + cols; x++) {
        for (let y = startY; y < startY + units; y++) {
          occupiedCells.add(`${x},${y}`);
        }
      }
    });

    // 행 단위로 빈 공간 찾기
    for (let y = 0; y < 100; y += newWidgetUnits) {
      for (let x = 0; x <= 3 - newWidgetCols; x++) {
        // 이 위치에 새 위젯이 들어갈 수 있는지 확인
        let canPlace = true;
        for (let dx = 0; dx < newWidgetCols && canPlace; dx++) {
          for (let dy = 0; dy < newWidgetUnits && canPlace; dy++) {
            if (occupiedCells.has(`${x + dx},${y + dy}`)) {
              canPlace = false;
            }
          }
        }
        if (canPlace) {
          return { x, y };
        }
      }
    }
    
    // 빈 공간을 찾지 못하면 기본값
    return { x: 0, y: 0 };
  }, []);

  // 위젯 추가 시 데이터 로드
  const handleAddWidget = useCallback(async (newWidget) => {
    // 새 위젯의 크기 계산
    const newCols = WIDTH_SIZES[newWidget.widthSize]?.cols || 1;
    const newUnits = HEIGHT_SIZES[newWidget.heightSize]?.units || 5;
    
    // 빈 칸 찾아서 위치 설정
    const emptySlot = findFirstEmptySlot(widgets, newCols, newUnits);
    const widgetWithPosition = {
      ...newWidget,
      gridX: emptySlot.x,
      gridY: emptySlot.y
    };

    // 먼저 로딩 상태로 추가
    setWidgets(prev => [...prev, widgetWithPosition]);

    // API 연결된 위젯이면 데이터 로드
    if (newWidget.presetId && newWidget.apiEndpoint) {
      const loadedWidget = await loadWidgetData(widgetWithPosition);
      setWidgets(prev => prev.map(w => w.id === loadedWidget.id ? loadedWidget : w));
    }
  }, [loadWidgetData, findFirstEmptySlot, widgets]);

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

  // 위젯 필터 변경 (디바이스 필터 등) - API 재호출 포함
  const handleWidgetFilterChange = useCallback(async (widgetId, filterUpdates) => {
    // 먼저 위젯 설정 업데이트 및 로딩 상태로
    setWidgets(prev => prev.map(w => 
      w.id === widgetId ? { ...w, ...filterUpdates, loading: true } : w
    ));

    // 업데이트된 위젯 찾기
    const updatedWidget = widgets.find(w => w.id === widgetId);
    if (updatedWidget && updatedWidget.presetId && updatedWidget.apiEndpoint) {
      const widgetWithFilters = { ...updatedWidget, ...filterUpdates };
      const loadedWidget = await loadWidgetData(widgetWithFilters);
      setWidgets(prev => prev.map(w => w.id === loadedWidget.id ? loadedWidget : w));
    }
  }, [widgets, loadWidgetData]);

  // 현재 레이아웃 저장 (위젯 추가 버튼 위치 계산용)
  const [currentLayout, setCurrentLayout] = useState([]);

  // 드래그 완료 시 위치 교환 처리
  const handleDragStop = useCallback((layout, oldItem, newItem) => {
    // 드래그한 위젯의 원래 상태 찾기
    const draggedWidget = widgets.find(w => w.id === newItem.i);
    if (!draggedWidget) return;

    const draggedOriginalX = draggedWidget.gridX !== undefined ? draggedWidget.gridX : 0;
    const draggedOriginalY = draggedWidget.gridY !== undefined ? draggedWidget.gridY : 0;

    // 위치가 변경되지 않았으면 무시
    if (draggedOriginalX === newItem.x && draggedOriginalY === newItem.y) return;

    // 새 위치에서 겹치는 위젯 찾기 (widgets 상태에서 직접 찾기)
    const newItemCols = WIDTH_SIZES[draggedWidget.widthSize]?.cols || 1;
    const newItemUnits = HEIGHT_SIZES[draggedWidget.heightSize]?.units || 5;

    const collidingWidget = widgets.find(w => {
      if (w.id === newItem.i) return false;
      
      const wX = w.gridX !== undefined ? w.gridX : 0;
      const wY = w.gridY !== undefined ? w.gridY : 0;
      const wCols = WIDTH_SIZES[w.widthSize]?.cols || 1;
      const wUnits = HEIGHT_SIZES[w.heightSize]?.units || 5;

      // 충돌 검사 (AABB)
      return !(
        newItem.x + newItemCols <= wX ||
        wX + wCols <= newItem.x ||
        newItem.y + newItemUnits <= wY ||
        wY + wUnits <= newItem.y
      );
    });

    if (collidingWidget) {
      // 겹치는 위젯이 있으면 위치 교환
      const collidingOriginalX = collidingWidget.gridX !== undefined ? collidingWidget.gridX : 0;
      const collidingOriginalY = collidingWidget.gridY !== undefined ? collidingWidget.gridY : 0;

      setWidgets(prev => prev.map(w => {
        if (w.id === newItem.i) {
          // 드래그한 위젯: 충돌한 위젯의 원래 위치로
          return { ...w, gridX: collidingOriginalX, gridY: collidingOriginalY };
        }
        if (w.id === collidingWidget.id) {
          // 충돌한 위젯: 드래그한 위젯의 원래 위치로
          return { ...w, gridX: draggedOriginalX, gridY: draggedOriginalY };
        }
        return w;
      }));
    } else {
      // 빈 공간이면 그대로 새 위치에 배치
      setWidgets(prev => prev.map(w => 
        w.id === newItem.i ? { ...w, gridX: newItem.x, gridY: newItem.y } : w
      ));
    }
  }, [widgets]);

  // 레이아웃 변경 핸들러 (currentLayout 동기화용)
  const handleLayoutChange = useCallback((newLayout) => {
    // 위젯 추가 버튼 제외한 레이아웃만 저장
    const widgetLayout = newLayout.filter(item => item.i !== 'add-widget-placeholder');
    setCurrentLayout(widgetLayout);
  }, []);

  const gap = 16;
  const rowHeight = 50; // react-grid-layout rowHeight

  // react-grid-layout용 레이아웃 생성
  const gridLayout = useMemo(() => {
    return widgets.map((w, index) => ({
      i: w.id,
      x: w.gridX !== undefined ? w.gridX : (index % 3),
      y: w.gridY !== undefined ? w.gridY : Math.floor(index / 3) * 3,
      w: WIDTH_SIZES[w.widthSize]?.cols || 1,
      h: HEIGHT_SIZES[w.heightSize]?.units || 3,
      minW: 1,
      maxW: 3,
      minH: 3,
      maxH: 7
    }));
  }, [widgets]);

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: 'calc(100vh + 100px)' }}>
      {/* 헤더 영역 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'flex-start', 
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
          <GridLayout
            className="layout"
            layout={gridLayout}
            cols={3}
            rowHeight={rowHeight}
            width={containerWidth}
            margin={[gap, 0]}
            containerPadding={[0, 0]}
            onLayoutChange={handleLayoutChange}
            onDragStop={handleDragStop}
            draggableHandle=".drag-handle"
            isResizable={false}
            useCSSTransforms={true}
            compactType={null}
            preventCollision={false}
          >
            {widgets.map(widget => (
              <div key={widget.id} style={{ 
                overflow: 'visible',
                paddingBottom: '12px'
              }}>
                <div style={{ height: 'calc(100% - 12px)' }}>
                  <DashboardWidget
                    widget={widget}
                    onDelete={handleDeleteWidget}
                    onEdit={handleEditWidget}
                    onResize={handleResizeWidget}
                    onFilterChange={handleWidgetFilterChange}
                    containerWidth={containerWidth}
                    containerRef={containerRef}
                  />
                </div>
              </div>
            ))}
          </GridLayout>
        )}
      </div>

      {/* 플로팅 위젯 추가 버튼 */}
      <div
        onClick={() => setAddModalVisible(true)}
        style={{
          position: 'fixed',
          right: 32,
          bottom: 32,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
          boxShadow: '0 4px 12px rgba(24, 144, 255, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          zIndex: 1000
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(24, 144, 255, 0.5)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(24, 144, 255, 0.4)';
        }}
      >
        <PlusOutlined style={{ fontSize: 24, color: 'white' }} />
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
