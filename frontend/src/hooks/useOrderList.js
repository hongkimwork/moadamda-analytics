/**
 * 주문 목록 커스텀 훅
 * 주문 목록 조회 및 상태 관리
 */

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';

const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * useOrderList 훅
 * @returns {object} 주문 목록 데이터 및 상태
 */
export function useOrderList() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState([dayjs().subtract(7, 'day'), dayjs()]);
  const [deviceFilter, setDeviceFilter] = useState('all');
  const [totalOrders, setTotalOrders] = useState(0);
  
  // 검색 및 정렬 state
  // 초기값 null: 사용자가 클릭하기 전까지 정렬 화살표 미표시 (서버 기본 정렬 사용)
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState(null);
  const [sortOrder, setSortOrder] = useState(null);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');

      const response = await axios.get(`${API_URL}/api/stats/orders`, {
        params: {
          start: startDate,
          end: endDate,
          device: deviceFilter,
          search: searchTerm,
          // null이면 파라미터 제외 → 서버 기본 정렬(timestamp desc) 사용
          ...(sortField && { sort_by: sortField }),
          ...(sortOrder && { sort_order: sortOrder }),
          limit: 1000,
          offset: 0
        }
      });

      setOrders(response.data.orders);
      setTotalOrders(response.data.total_orders);
      setLoading(false);
    } catch (error) {
      console.error('주문 목록 조회 실패:', error);
      setLoading(false);
    }
  }, [dateRange, deviceFilter, searchTerm, sortField, sortOrder]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // 검색 핸들러
  const handleSearch = useCallback((term) => {
    setSearchTerm(term);
  }, []);

  // 정렬 핸들러
  const handleSort = useCallback((field, order) => {
    setSortField(field);
    setSortOrder(order);
  }, []);

  // 초기화 핸들러
  const handleReset = useCallback(() => {
    setSearchTerm('');
    setSortField(null);  // 정렬 화살표 미표시 (서버 기본 정렬 사용)
    setSortOrder(null);
    setDeviceFilter('all');
    setDateRange([dayjs().subtract(7, 'day'), dayjs()]);
  }, []);

  return {
    orders,
    loading,
    dateRange,
    setDateRange,
    deviceFilter,
    setDeviceFilter,
    totalOrders,
    refetch: fetchOrders,
    // 검색 및 정렬
    searchTerm,
    setSearchTerm,
    handleSearch,
    sortField,
    sortOrder,
    handleSort,
    handleReset
  };
}

export default useOrderList;
