/**
 * 주문 상세 커스텀 훅
 * 주문 상세 정보 조회 및 상태 관리
 * 
 * FIX (2026-02-04): Attribution Window 선택 기능 추가
 */

import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * useOrderDetail 훅
 * @param {string} orderId - 주문 ID
 * @param {string} attributionWindow - Attribution Window (30, 60, 90, 'all')
 * @param {string} matchingMode - 매칭 방식 ('default' = 방문자ID+회원ID, 'extended' = +IP+기기+OS)
 * @returns {object} 주문 상세 데이터 및 상태
 */
export function useOrderDetail(orderId, attributionWindow = '30', matchingMode = 'extended') {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const fetchOrderDetail = async (attrWindow = attributionWindow) => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${API_URL}/api/stats/order-detail/${orderId}`, {
        params: { 
          attribution_window: attrWindow,
          matching_mode: matchingMode
        }
      });
      setData(response.data);
      setLoading(false);
    } catch (err) {
      console.error('주문 상세 조회 실패:', err);
      setError(err.response?.data?.error || '주문 상세 정보를 불러올 수 없습니다.');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      fetchOrderDetail();
    }
  }, [orderId, attributionWindow, matchingMode]);

  return {
    data,
    loading,
    error,
    refetch: fetchOrderDetail
  };
}

export default useOrderDetail;
