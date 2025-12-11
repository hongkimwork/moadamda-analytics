/**
 * useOriginalUrls Hook
 * 
 * 원본 URL 목록 조회를 관리하는 커스텀 훅
 */

import { useState } from 'react';
import { message } from 'antd';
import * as api from '../services/pageMappingApi';

/**
 * 원본 URL 조회 훅
 * @returns {Object} 상태 및 핸들러
 */
export const useOriginalUrls = () => {
  // 모달 상태
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // 데이터 상태
  const [data, setData] = useState([]);
  const [currentCleanedUrl, setCurrentCleanedUrl] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    totalVisits: 0
  });

  /**
   * 원본 URL 조회
   */
  const fetchOriginalUrls = async (cleanedUrl) => {
    try {
      setLoading(true);
      
      const result = await api.fetchOriginalUrls(cleanedUrl);

      setData(result.original_urls);
      setStats({
        total: result.total_original_urls,
        totalVisits: result.total_visits
      });
    } catch (error) {
      console.error('Failed to fetch original URLs:', error);
      message.error('원본 URL 목록을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 모달 열기
   */
  const openModal = async (cleanedUrl, originalUrl) => {
    const urlToFetch = originalUrl || cleanedUrl;
    setCurrentCleanedUrl(urlToFetch);
    setVisible(true);
    await fetchOriginalUrls(urlToFetch);
  };

  /**
   * 모달 닫기
   */
  const closeModal = () => {
    setVisible(false);
    setData([]);
    setCurrentCleanedUrl('');
    setStats({ total: 0, totalVisits: 0 });
  };

  return {
    // 모달 상태
    visible,
    loading,
    
    // 데이터
    data,
    currentCleanedUrl,
    stats,

    // 핸들러
    openModal,
    closeModal
  };
};
