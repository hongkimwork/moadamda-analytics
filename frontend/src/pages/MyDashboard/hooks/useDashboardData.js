import { useState, useEffect, useCallback } from 'react';
import { fetchWidgetData } from '../utils/api';
import { transformWidgetData } from '../utils/dataTransform';
import { loadFromLocalStorage, saveToLocalStorage } from '../utils/storage';

/**
 * 대시보드 데이터 관리를 위한 커스텀 훅
 * 
 * @param {Array} dateRange - 날짜 범위 [시작일, 종료일]
 * @returns {Object} - widgets, setWidgets, loadWidgetData, refreshAllWidgets, initialized
 */
export const useDashboardData = (dateRange) => {
  const [widgets, setWidgets] = useState([]);
  const [initialized, setInitialized] = useState(false);

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

  // 초기 로드: localStorage에서 위젯 불러오기
  useEffect(() => {
    const loadInitialData = async () => {
      const stored = loadFromLocalStorage();
      
      if (stored && stored.widgets.length > 0) {
        // 저장된 위젯이 있으면 불러오기
        setWidgets(stored.widgets);
        
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

  // 모든 위젯 데이터 새로고침
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

  return {
    widgets,
    setWidgets,
    loadWidgetData,
    refreshAllWidgets,
    initialized
  };
};
