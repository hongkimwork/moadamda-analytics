/**
 * 위젯 데이터 로딩 훅
 */

import { useCallback } from 'react';
import { fetchWidgetData, transformWidgetData } from '../utils';

export const useWidgetData = () => {
  /**
   * 위젯 데이터 로드 함수
   */
  const loadWidgetData = useCallback(async (widget) => {
    // API 연결된 위젯만 처리 (presetId가 있는 경우)
    if (!widget.presetId || !widget.apiEndpoint) {
      return widget;
    }

    try {
      const { data: apiData, compareData: compareApiData, error } = await fetchWidgetData(widget);

      if (error) {
        return { ...widget, loading: false, error: error, data: null };
      }

      const transformedData = transformWidgetData(widget, apiData, compareApiData);
      return { ...widget, loading: false, error: null, data: transformedData };
    } catch (err) {
      console.error('[loadWidgetData Error]', err);
      return { ...widget, loading: false, error: err.message, data: null };
    }
  }, []);

  return { loadWidgetData };
};
