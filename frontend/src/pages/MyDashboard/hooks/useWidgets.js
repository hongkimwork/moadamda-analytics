/**
 * 위젯 CRUD 훅
 * 위젯 추가, 삭제, 편집, 리사이즈 로직 관리
 */

import { useState, useCallback, useEffect } from 'react';
import { Modal } from 'antd';
import dayjs from 'dayjs';
import { saveToLocalStorage, loadFromLocalStorage } from '../utils';

export const useWidgets = () => {
  const [widgets, setWidgets] = useState([]);
  const [initialized, setInitialized] = useState(false);

  /**
   * 위젯 추가
   */
  const addWidget = useCallback((newWidget) => {
    setWidgets(prev => [...prev, newWidget]);
  }, []);

  /**
   * 위젯 삭제
   */
  const deleteWidget = useCallback((widgetId) => {
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

  /**
   * 위젯 편집
   */
  const editWidget = useCallback((widget) => {
    console.log('Edit widget:', widget);
    // TODO: 편집 모달 구현
  }, []);

  /**
   * 위젯 크기 변경
   */
  const resizeWidget = useCallback((widgetId, newWidthSize, newHeightSize) => {
    setWidgets(prev => prev.map(w =>
      w.id === widgetId ? { ...w, widthSize: newWidthSize, heightSize: newHeightSize } : w
    ));
  }, []);

  /**
   * 위젯 데이터 업데이트
   */
  const updateWidgetData = useCallback((widgetId, data) => {
    setWidgets(prev => prev.map(w =>
      w.id === widgetId ? { ...w, ...data } : w
    ));
  }, []);

  /**
   * 여러 위젯 한 번에 업데이트
   */
  const updateMultipleWidgets = useCallback((updatedWidgets) => {
    setWidgets(prev => {
      const updateMap = new Map(updatedWidgets.map(w => [w.id, w]));
      return prev.map(w => updateMap.get(w.id) || w);
    });
  }, []);

  /**
   * 모든 위젯을 로딩 상태로 변경
   */
  const setWidgetsLoading = useCallback((loading = true) => {
    setWidgets(prev => prev.map(w =>
      w.presetId && w.apiEndpoint ? { ...w, loading } : w
    ));
  }, []);

  return {
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
  };
};

/**
 * 위젯 초기화 및 자동 저장 훅
 */
export const useWidgetPersistence = (widgets, dateRange, initialized) => {
  /**
   * 초기 로드
   */
  const loadInitialWidgets = useCallback(async () => {
    const stored = loadFromLocalStorage();

    if (stored && stored.widgets.length > 0) {
      return {
        widgets: stored.widgets,
        dateRange: stored.globalDateRange || [dayjs().subtract(7, 'days'), dayjs()]
      };
    }

    // 저장된 위젯이 없으면 기본 샘플 위젯 표시
    return {
      widgets: [
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
      ],
      dateRange: null
    };
  }, []);

  /**
   * 자동 저장
   */
  useEffect(() => {
    if (initialized && widgets.length > 0) {
      // 샘플 위젯만 있는 경우는 저장하지 않음
      const hasRealWidgets = widgets.some(w => !w.id.startsWith('sample-'));
      if (hasRealWidgets) {
        saveToLocalStorage(widgets, dateRange);
      }
    }
  }, [widgets, dateRange, initialized]);

  return { loadInitialWidgets };
};
