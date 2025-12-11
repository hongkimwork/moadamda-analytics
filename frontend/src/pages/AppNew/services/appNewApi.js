import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * 통합 통계 데이터 조회
 * @param {string} startDate - YYYY-MM-DD 형식
 * @param {string} endDate - YYYY-MM-DD 형식
 * @param {string} deviceFilter - 'all' | 'pc' | 'mobile'
 */
export async function fetchAllStats(startDate, endDate, deviceFilter) {
  const [rangeResponse, dailyResponse, segmentsResponse] = await Promise.all([
    axios.get(`${API_URL}/api/stats/range`, {
      params: { start: startDate, end: endDate, compare: 'true', device: deviceFilter }
    }),
    axios.get(`${API_URL}/api/stats/daily`, {
      params: { start: startDate, end: endDate, device: deviceFilter }
    }),
    axios.get(`${API_URL}/api/stats/segments`, {
      params: { start: startDate, end: endDate, device: deviceFilter }
    })
  ]);

  return {
    range: rangeResponse.data,
    daily: dailyResponse.data.daily_data,
    segments: segmentsResponse.data
  };
}

/**
 * UTM 성과 데이터 조회
 * @param {string} startDate - YYYY-MM-DD 형식
 * @param {string} endDate - YYYY-MM-DD 형식
 * @param {string} deviceFilter - 'all' | 'pc' | 'mobile'
 */
export async function fetchUtmPerformance(startDate, endDate, deviceFilter) {
  try {
    const response = await axios.get(`${API_URL}/api/stats/utm-performance`, {
      params: { start: startDate, end: endDate, device: deviceFilter }
    });
    return response.data;
  } catch (error) {
    console.warn('UTM performance data unavailable:', error.message);
    return null;
  }
}

/**
 * 어트리뷰션 데이터 조회 (GA4 Last Click + Duration Based)
 * @param {string} startDate - YYYY-MM-DD 형식
 * @param {string} endDate - YYYY-MM-DD 형식
 */
export async function fetchAttributionData(startDate, endDate) {
  try {
    const [ga4Response, durationResponse] = await Promise.all([
      axios.get(`${API_URL}/api/stats/utm-attribution`, {
        params: { start: startDate, end: endDate, model: 'last_click' }
      }),
      axios.get(`${API_URL}/api/stats/utm-attribution`, {
        params: { start: startDate, end: endDate, model: 'duration_based' }
      })
    ]);
    
    return {
      ga4: ga4Response.data,
      duration: durationResponse.data
    };
  } catch (error) {
    console.warn('Attribution data unavailable:', error.message);
    return null;
  }
}

/**
 * 실시간 활동 데이터 조회
 */
export async function fetchRecentActivity() {
  try {
    const response = await axios.get(`${API_URL}/api/stats/recent-activity`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch recent activity:', error);
    return null;
  }
}
