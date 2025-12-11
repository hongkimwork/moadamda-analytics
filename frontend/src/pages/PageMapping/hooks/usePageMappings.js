/**
 * usePageMappings Hook
 * 
 * 페이지 매핑 데이터 및 관련 작업을 관리하는 커스텀 훅
 */

import { useState, useEffect } from 'react';
import { message } from 'antd';
import * as api from '../services/pageMappingApi';
import { parseDataBadges } from '../utils/urlHelpers';

/**
 * 페이지 매핑 관리 훅
 * @returns {Object} 상태 및 핸들러
 */
export const usePageMappings = () => {
  // 데이터 상태
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [statistics, setStatistics] = useState({ total: 0, completed: 0, uncompleted: 0 });

  // 페이지네이션 상태
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // 검색/필터 상태
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('recent');

  /**
   * 데이터 조회
   */
  const fetchData = async () => {
    try {
      setLoading(true);
      const offset = (page - 1) * pageSize;

      const result = await api.fetchAllUrls({
        limit: pageSize,
        offset,
        search,
        status: statusFilter,
        sort: sortOrder
      });

      // 배지 파싱
      const processedData = parseDataBadges(result.data);

      setData(processedData);
      setTotal(result.total);
      setStatistics(result.statistics || { total: 0, completed: 0, uncompleted: 0 });
    } catch (error) {
      console.error('Failed to fetch all URLs:', error);
      message.error('URL 목록을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  // 의존성 변경 시 데이터 재조회
  useEffect(() => {
    fetchData();
  }, [page, pageSize, statusFilter, sortOrder]);

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
   * 매핑 제출 (생성 또는 수정)
   */
  const submitMapping = async (url, values, existingMapping) => {
    try {
      const isUpdate = existingMapping && existingMapping.is_mapped;

      let response;
      if (isUpdate) {
        // 업데이트
        response = await api.updateMapping(existingMapping.mapping_id, {
          korean_name: values.korean_name.trim(),
          is_product_page: values.is_product_page,
          badge_text: values.is_product_page ? values.badge_text : null,
          badge_color: values.is_product_page ? (typeof values.badge_color === 'string' ? values.badge_color : values.badge_color?.toHexString()) : null,
          badges: values.is_product_page && values.badges ? values.badges : null
        });
        message.success('페이지 매핑이 수정되었습니다');
      } else {
        // 생성
        response = await api.createMapping({
          url,
          korean_name: values.korean_name.trim(),
          is_product_page: values.is_product_page,
          badge_text: values.is_product_page ? values.badge_text : null,
          badge_color: values.is_product_page ? (typeof values.badge_color === 'string' ? values.badge_color : values.badge_color?.toHexString()) : null,
          badges: values.is_product_page && values.badges ? values.badges : null
        });
        message.success('페이지 매핑이 완료되었습니다');
      }

      // 배지 파싱
      let parsedBadges = null;
      try {
        if (typeof response.data.badges === 'string') {
          parsedBadges = JSON.parse(response.data.badges);
        } else if (Array.isArray(response.data.badges)) {
          parsedBadges = response.data.badges;
        }
      } catch (e) {
        console.error('Failed to parse badges in response:', e);
      }

      // 로컬 상태 업데이트
      setData(prevData => prevData.map(item =>
        (item.original_url || item.url) === url
          ? {
            ...item,
            korean_name: values.korean_name.trim(),
            mapping_id: response.data.id,
            is_mapped: true,
            is_product_page: response.data.is_product_page,
            badge_text: response.data.badge_text,
            badge_color: response.data.badge_color,
            badges: parsedBadges
          }
          : item
      ));

      return { success: true };
    } catch (error) {
      console.error('Failed to save mapping:', error);

      if (error.response?.status === 409) {
        message.error('이미 매핑된 URL입니다');
      } else if (error.response?.status === 400) {
        message.error(error.response.data.error || error.response.data.message || '입력값을 확인해주세요');
      } else {
        message.error('매핑 저장에 실패했습니다');
      }
      
      return { success: false, error };
    }
  };

  /**
   * URL 제외
   */
  const excludeUrl = async (displayUrl, originalUrl) => {
    try {
      const urlToExclude = originalUrl || displayUrl;
      await api.excludeUrl(urlToExclude);

      message.success('URL이 제외되었습니다');

      // 로컬 상태에서 제거
      setData(prevData => prevData.filter(item => item.url !== displayUrl));
      setTotal(prevTotal => prevTotal - 1);

      return { success: true };
    } catch (error) {
      console.error('Failed to exclude URL:', error);

      if (error.response?.status === 409) {
        message.error(error.response.data.message || '이미 처리된 URL입니다');
      } else {
        message.error('URL 제외에 실패했습니다');
      }
      
      return { success: false, error };
    }
  };

  /**
   * 매핑 해제 (URL은 유지)
   */
  const unmapUrl = async (mappingId) => {
    try {
      await api.deleteMapping(mappingId);

      message.success('매핑이 해제되었습니다');

      // 로컬 상태 업데이트
      setData(prevData => prevData.map(item =>
        item.mapping_id === mappingId
          ? {
            ...item,
            korean_name: null,
            mapping_id: null,
            is_mapped: false,
            is_product_page: false,
            badge_text: null,
            badge_color: null,
            badges: null
          }
          : item
      ));

      // 통계 업데이트
      setStatistics(prev => ({
        ...prev,
        completed: prev.completed - 1,
        uncompleted: prev.uncompleted + 1
      }));

      return { success: true };
    } catch (error) {
      console.error('Failed to unmap URL:', error);
      message.error('매핑 해제에 실패했습니다');
      
      return { success: false, error };
    }
  };

  /**
   * 수동 URL 추가
   */
  const addManualUrl = async (requestBody) => {
    try {
      await api.createMapping(requestBody);
      message.success('URL이 수동으로 추가되었습니다');
      
      // 데이터 새로고침
      await fetchData();
      
      return { success: true };
    } catch (error) {
      console.error('Failed to add URL manually:', error);

      if (error.response?.status === 409) {
        message.error('이미 존재하는 URL입니다');
      } else if (error.response?.status === 400) {
        message.error(error.response.data.message || '입력값을 확인해주세요');
      } else {
        message.error('URL 추가에 실패했습니다');
      }
      
      return { success: false, error };
    }
  };

  return {
    // 데이터 상태
    data,
    loading,
    total,
    statistics,

    // 페이지네이션
    page,
    pageSize,
    setPage,
    setPageSize,
    handlePageChange,

    // 검색/필터
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    sortOrder,
    setSortOrder,
    handleSearch,

    // 데이터 작업
    fetchData,
    submitMapping,
    excludeUrl,
    unmapUrl,
    addManualUrl
  };
};
