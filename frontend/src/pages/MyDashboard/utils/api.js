import { API_BASE_URL } from '../constants.jsx';

// ============================================================================
// API 호출 유틸리티
// ============================================================================

// 위젯 데이터 fetch 함수 (다중 비교 기간 지원)
export const fetchWidgetData = async (widget) => {
  const { presetId, category, apiEndpoint, dataKey, dateRange, compareEnabled, compareRanges, compareRange } = widget;
  
  console.log('[fetchWidgetData] Widget config:', {
    presetId,
    apiEndpoint,
    dataKey,
    dateRange,
    compareEnabled,
    compareRanges,
    compareRange // 레거시 호환
  });
  
  if (!apiEndpoint || !dateRange) {
    return { data: null, compareDataList: [], error: 'Missing configuration' };
  }

  try {
    const params = new URLSearchParams({
      start: dateRange.start,
      end: dateRange.end
    });

    // 메인 데이터 fetch
    const mainUrl = `${API_BASE_URL}${apiEndpoint}?${params.toString()}`;
    console.log('[fetchWidgetData] Main API URL:', mainUrl);
    const response = await fetch(mainUrl);
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    const result = await response.json();
    console.log('[fetchWidgetData] Main API Result:', result);

    // 다중 비교 데이터 병렬 fetch
    let compareDataList = [];
    
    // 새로운 compareRanges 배열 사용
    if (compareEnabled && compareRanges && compareRanges.length > 0) {
      console.log('[fetchWidgetData] Fetching multiple compare ranges:', compareRanges.length);
      
      const comparePromises = compareRanges.map(async (range) => {
        const compareParams = new URLSearchParams({
          start: range.start,
          end: range.end
        });
        const compareUrl = `${API_BASE_URL}${apiEndpoint}?${compareParams.toString()}`;
        console.log('[fetchWidgetData] Compare API URL:', compareUrl);
        
        try {
          const compareResponse = await fetch(compareUrl);
          if (compareResponse.ok) {
            const data = await compareResponse.json();
            return { ...range, data };
          }
          console.error('[fetchWidgetData] Compare API Error:', compareResponse.status);
          return { ...range, data: null };
        } catch (err) {
          console.error('[fetchWidgetData] Compare fetch error:', err);
          return { ...range, data: null };
        }
      });
      
      compareDataList = await Promise.all(comparePromises);
      console.log('[fetchWidgetData] Compare Data List:', compareDataList);
    } 
    // 레거시 호환: 기존 단일 compareRange 지원
    else if (compareEnabled && compareRange) {
      const compareParams = new URLSearchParams({
        start: compareRange.start,
        end: compareRange.end
      });
      const compareUrl = `${API_BASE_URL}${apiEndpoint}?${compareParams.toString()}`;
      const compareResponse = await fetch(compareUrl);
      if (compareResponse.ok) {
        const data = await compareResponse.json();
        compareDataList = [{ ...compareRange, data }];
      }
    } else {
      console.log('[fetchWidgetData] Compare skipped - compareEnabled:', compareEnabled);
    }

    return { data: result, compareDataList, error: null };
  } catch (error) {
    console.error('[Widget Fetch Error]', error);
    return { data: null, compareDataList: [], error: error.message };
  }
};
