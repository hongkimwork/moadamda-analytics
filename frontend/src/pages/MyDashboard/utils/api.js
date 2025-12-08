/**
 * API 호출 유틸리티
 */

// API Base URL 설정 (개발/프로덕션 환경 자동 감지)
const getApiBaseUrl = () => {
  // Vite 환경변수 사용
  if (import.meta.env.DEV) {
    return 'http://localhost:3003';
  }
  // 프로덕션에서는 상대 경로 사용 (same origin)
  return '';
};

export const API_BASE_URL = getApiBaseUrl();

/**
 * 위젯 데이터를 API에서 가져오기
 * @param {Object} widget - 위젯 설정 객체
 * @returns {Promise<Object>} - { data, compareData, error }
 */
export const fetchWidgetData = async (widget) => {
  const { presetId, category, apiEndpoint, dataKey, dateRange, compareEnabled, compareRange } = widget;

  console.log('[fetchWidgetData] Widget config:', {
    presetId,
    apiEndpoint,
    dataKey,
    dateRange,
    compareEnabled,
    compareRange
  });

  if (!apiEndpoint || !dateRange) {
    return { data: null, compareData: null, error: 'Missing configuration' };
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

    // 비교 데이터 fetch (필요 시)
    let compareResult = null;
    if (compareEnabled && compareRange) {
      const compareParams = new URLSearchParams({
        start: compareRange.start,
        end: compareRange.end
      });
      const compareUrl = `${API_BASE_URL}${apiEndpoint}?${compareParams.toString()}`;
      console.log('[fetchWidgetData] Compare API URL:', compareUrl);
      const compareResponse = await fetch(compareUrl);
      if (compareResponse.ok) {
        compareResult = await compareResponse.json();
        console.log('[fetchWidgetData] Compare API Result:', compareResult);
      } else {
        console.error('[fetchWidgetData] Compare API Error:', compareResponse.status);
      }
    } else {
      console.log('[fetchWidgetData] Compare skipped - compareEnabled:', compareEnabled, 'compareRange:', compareRange);
    }

    return { data: result, compareData: compareResult, error: null };
  } catch (error) {
    console.error('[Widget Fetch Error]', error);
    return { data: null, compareData: null, error: error.message };
  }
};
