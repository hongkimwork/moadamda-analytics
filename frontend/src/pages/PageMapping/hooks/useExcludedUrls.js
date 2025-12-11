/**
 * useExcludedUrls Hook
 * 
 * 제외된 URL 데이터 및 관련 작업을 관리하는 커스텀 훅
 */

import { useState, useEffect } from 'react';
import { message } from 'antd';
import * as api from '../services/pageMappingApi';

/**
 * 제외된 URL 관리 훅
 * @returns {Object} 상태 및 핸들러
 */
export const useExcludedUrls = () => {
  // 데이터 상태
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  // 페이지네이션 상태
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // 검색 상태
  const [search, setSearch] = useState('');

  /**
   * 데이터 조회
   */
  const fetchData = async () => {
    try {
      setLoading(true);
      const offset = (page - 1) * pageSize;

      const result = await api.fetchExcludedUrls({
        limit: pageSize,
        offset,
        search
      });

      setData(result.data);
      setTotal(result.total);
    } catch (error) {
      console.error('Failed to fetch excluded URLs:', error);
      message.error('제외된 URL 목록을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  // 의존성 변경 시 데이터 재조회
  useEffect(() => {
    fetchData();
  }, [page, pageSize]);

  /**
   * 검색 실행
   */
  const handleSearch = () => {
    setPage(1);
    fetchData();
  };

  /**
   * 페이지 변경
   */
  const handlePageChange = (newPage, newPageSize) => {
    setPage(newPage);
    setPageSize(newPageSize);
  };

  /**
   * 제외 해제 (복원)
   */
  const restoreUrl = async (id) => {
    try {
      await api.restoreExcludedUrl(id);

      message.success('제외가 해제되었습니다. 매핑하지 않은 URL 탭에서 다시 확인할 수 있습니다');

      // 로컬 상태에서 제거
      setData(prevData => prevData.filter(item => item.id !== id));
      setTotal(prevTotal => prevTotal - 1);

      return { success: true };
    } catch (error) {
      console.error('Failed to restore URL:', error);
      message.error('제외 해제에 실패했습니다');
      
      return { success: false, error };
    }
  };

  return {
    // 데이터 상태
    data,
    loading,
    total,

    // 페이지네이션
    page,
    pageSize,
    setPage,
    setPageSize,
    handlePageChange,

    // 검색
    search,
    setSearch,
    handleSearch,

    // 데이터 작업
    fetchData,
    restoreUrl
  };
};
