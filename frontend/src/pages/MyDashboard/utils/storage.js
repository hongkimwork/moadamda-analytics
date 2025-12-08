/**
 * localStorage 관련 유틸리티
 * 대시보드 설정 저장 및 불러오기
 */

import dayjs from 'dayjs';

const STORAGE_KEY = 'moadamda_my_dashboard';

/**
 * 위젯 설정을 localStorage에 저장
 * @param {Array} widgets - 위젯 배열
 * @param {Array} globalDateRange - 전역 날짜 범위 [dayjs, dayjs]
 */
export const saveToLocalStorage = (widgets, globalDateRange) => {
  try {
    // data, loading, error는 제외하고 설정만 저장
    const widgetsToSave = widgets.map(w => ({
      id: w.id,
      type: w.type,
      title: w.title,
      widthSize: w.widthSize,
      heightSize: w.heightSize,
      presetId: w.presetId,
      category: w.category,
      apiEndpoint: w.apiEndpoint,
      dataKey: w.dataKey,
      suffix: w.suffix,
      dateRange: w.dateRange,
      compareEnabled: w.compareEnabled,
      compareRange: w.compareRange
    }));

    const dataToSave = {
      widgets: widgetsToSave,
      globalDateRange: globalDateRange ? {
        start: globalDateRange[0].format('YYYY-MM-DD'),
        end: globalDateRange[1].format('YYYY-MM-DD')
      } : null,
      lastUpdated: new Date().toISOString()
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    console.log('[Dashboard] Saved to localStorage:', dataToSave.widgets.length, 'widgets');
  } catch (error) {
    console.error('[Dashboard] Failed to save to localStorage:', error);
  }
};

/**
 * localStorage에서 위젯 설정 불러오기
 * @returns {Object|null} - { widgets, globalDateRange, lastUpdated } 또는 null
 */
export const loadFromLocalStorage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    console.log('[Dashboard] Loaded from localStorage:', parsed.widgets?.length || 0, 'widgets');

    return {
      widgets: (parsed.widgets || []).map(w => ({
        ...w,
        data: null,
        loading: !!w.presetId, // API 연결 위젯은 로딩 상태로
        error: null
      })),
      globalDateRange: parsed.globalDateRange ? [
        dayjs(parsed.globalDateRange.start),
        dayjs(parsed.globalDateRange.end)
      ] : null,
      lastUpdated: parsed.lastUpdated
    };
  } catch (error) {
    console.error('[Dashboard] Failed to load from localStorage:', error);
    return null;
  }
};
