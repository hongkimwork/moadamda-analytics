// ============================================================================
// 광고 소재 퍼포먼스 API 서비스
// ============================================================================

import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * 광고 소재 퍼포먼스 데이터 조회
 * @param {Object} params - 조회 파라미터
 * @param {string} params.start - 시작일 (YYYY-MM-DD)
 * @param {string} params.end - 종료일 (YYYY-MM-DD)
 * @param {number} params.page - 페이지 번호
 * @param {number} params.limit - 페이지 크기
 * @param {string} params.search - 검색어
 * @param {string} params.sort_by - 정렬 기준
 * @param {string} params.sort_order - 정렬 순서
 * @param {string} [params.utm_filters] - UTM 필터 (JSON string)
 * @returns {Promise<Object>} API 응답
 */
export const fetchCreativePerformance = async (params) => {
  const response = await axios.get(`${API_URL}/api/creative-performance`, { params });
  return response.data;
};
