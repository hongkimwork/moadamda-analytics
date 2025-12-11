import dayjs from 'dayjs';
import { STORAGE_KEY } from '../constants.jsx';

// ============================================================================
// localStorage 저장/불러오기
// ============================================================================

// 위젯 설정 저장 (data 제외, 설정만 저장)
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
      compareRanges: w.compareRanges || [] // 다중 비교 기간 배열
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

// 위젯 설정 불러오기 (레거시 마이그레이션 포함)
export const loadFromLocalStorage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    console.log('[Dashboard] Loaded from localStorage:', parsed.widgets?.length || 0, 'widgets');
    
    // tracker 카테고리 위젯 필터링 (제거된 기능)
    const filteredWidgets = (parsed.widgets || []).filter(w => {
      if (w.category === 'tracker') {
        console.log('[Dashboard] Filtered out tracker widget:', w.id);
        return false;
      }
      return true;
    });
    
    return {
      widgets: filteredWidgets.map(w => {
        // 레거시 마이그레이션: compareRange → compareRanges
        let compareRanges = w.compareRanges || [];
        if (w.compareRange && !w.compareRanges) {
          // 기존 단일 compareRange를 배열로 변환
          compareRanges = [{
            start: w.compareRange.start,
            end: w.compareRange.end,
            type: w.compareRange.type || 'auto',
            monthsAgo: 1
          }];
          console.log('[Dashboard] Migrated legacy compareRange to compareRanges:', w.id);
        }
        
        return {
          ...w,
          compareRanges,
          data: null,
          loading: !!w.presetId, // API 연결 위젯은 로딩 상태로
          error: null
        };
      }),
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
