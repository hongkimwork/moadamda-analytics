/**
 * 주문 상세 커스텀 훅
 * 주문 상세 정보 조회 및 상태 관리
 */

import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * useOrderDetail 훅
 * @param {string} orderId - 주문 ID
 * @returns {object} 주문 상세 데이터 및 상태
 */
export function useOrderDetail(orderId) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const fetchOrderDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${API_URL}/api/stats/order-detail/${orderId}`);
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
  }, [orderId]);

  return {
    data,
    loading,
    error,
    refetch: fetchOrderDetail
  };
}

export default useOrderDetail;
