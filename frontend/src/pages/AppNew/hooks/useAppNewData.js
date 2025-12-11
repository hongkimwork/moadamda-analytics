import { useState, useEffect } from 'react';
import { 
  fetchAllStats, 
  fetchUtmPerformance, 
  fetchAttributionData,
  fetchRecentActivity 
} from '../services/appNewApi';
import { transformStatsData } from '../utils/dataTransforms';

/**
 * AppNew 페이지의 모든 데이터를 관리하는 커스텀 훅
 * @param {Array} dateRange - [dayjs, dayjs] 형식의 날짜 범위
 * @param {string} deviceFilter - 'all' | 'pc' | 'mobile'
 */
export function useAppNewData(dateRange, deviceFilter) {
  const [stats, setStats] = useState(null);
  const [segments, setSegments] = useState(null);
  const [dailyData, setDailyData] = useState([]);
  const [recentActivity, setRecentActivity] = useState(null);
  const [utmPerformance, setUtmPerformance] = useState(null);
  const [attributionData, setAttributionData] = useState(null);
  const [ga4Data, setGa4Data] = useState(null);
  const [loading, setLoading] = useState(true);

  // 메인 통계 데이터 가져오기
  const loadAllStats = async () => {
    try {
      setLoading(true);
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');
      
      // 기본 통계 데이터
      const { range, daily, segments: segmentsData } = await fetchAllStats(
        startDate, 
        endDate, 
        deviceFilter
      );
      
      setStats(transformStatsData(range));
      setDailyData(daily);
      setSegments(segmentsData);
      
      // UTM 성과 데이터
      const utmData = await fetchUtmPerformance(startDate, endDate, deviceFilter);
      setUtmPerformance(utmData);
      
      // 어트리뷰션 데이터
      const attribution = await fetchAttributionData(startDate, endDate);
      if (attribution) {
        setGa4Data(attribution.ga4);
        setAttributionData(attribution.duration);
      } else {
        setGa4Data(null);
        setAttributionData(null);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      setLoading(false);
    }
  };

  // 실시간 활동 데이터 가져오기
  const loadRecentActivity = async () => {
    const activity = await fetchRecentActivity();
    setRecentActivity(activity);
  };

  // dateRange 또는 deviceFilter 변경 시 데이터 다시 가져오기
  useEffect(() => {
    loadAllStats();
    loadRecentActivity();
  }, [dateRange, deviceFilter]);

  // 3분마다 실시간 활동 데이터 갱신
  useEffect(() => {
    const activityInterval = setInterval(loadRecentActivity, 180000); // 3분(180초)
    return () => clearInterval(activityInterval);
  }, []);

  return {
    stats,
    segments,
    dailyData,
    recentActivity,
    utmPerformance,
    attributionData,
    ga4Data,
    loading,
    refresh: loadAllStats
  };
}
