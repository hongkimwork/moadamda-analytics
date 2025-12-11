/**
 * Page Mapping API Service
 * 
 * 페이지 매핑 관련 API 호출을 관리합니다.
 * 모든 API 호출은 axios를 사용하며, 에러는 호출자에게 전파됩니다.
 */

import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * 모든 URL 목록 조회 (매핑됨 + 매핑 안됨)
 * @param {Object} params - 쿼리 파라미터
 * @param {number} params.limit - 페이지 크기
 * @param {number} params.offset - 오프셋
 * @param {string} params.search - 검색어
 * @param {string} params.status - 상태 필터 (all/completed/uncompleted)
 * @param {string} params.sort - 정렬 기준
 * @returns {Promise<Object>} { data, total, statistics }
 */
export const fetchAllUrls = async ({ limit, offset, search, status, sort }) => {
  const response = await axios.get(`${API_URL}/api/mappings/all`, {
    params: { limit, offset, search, status, sort }
  });
  return response.data;
};

/**
 * 제외된 URL 목록 조회
 * @param {Object} params - 쿼리 파라미터
 * @param {number} params.limit - 페이지 크기
 * @param {number} params.offset - 오프셋
 * @param {string} params.search - 검색어
 * @returns {Promise<Object>} { data, total }
 */
export const fetchExcludedUrls = async ({ limit, offset, search }) => {
  const response = await axios.get(`${API_URL}/api/mappings/excluded`, {
    params: { limit, offset, search }
  });
  return response.data;
};

/**
 * 새 페이지 매핑 생성
 * @param {Object} data - 매핑 데이터
 * @param {string} data.url - URL
 * @param {string} data.korean_name - 한글명
 * @param {boolean} data.is_product_page - 상품 페이지 여부
 * @param {string} data.badge_text - 배지 텍스트
 * @param {string} data.badge_color - 배지 색상
 * @param {Array} data.badges - 배지 배열
 * @param {string} data.source_type - 출처 유형 (manual/auto)
 * @param {Object} data.url_conditions - URL 조건 (복합 매핑용)
 * @returns {Promise<Object>} 생성된 매핑 데이터
 */
export const createMapping = async (data) => {
  const response = await axios.post(`${API_URL}/api/mappings`, data);
  return response.data;
};

/**
 * 기존 페이지 매핑 수정
 * @param {number} mappingId - 매핑 ID
 * @param {Object} data - 수정할 데이터
 * @returns {Promise<Object>} 수정된 매핑 데이터
 */
export const updateMapping = async (mappingId, data) => {
  const response = await axios.put(`${API_URL}/api/mappings/${mappingId}`, data);
  return response.data;
};

/**
 * URL을 제외 목록에 추가
 * @param {string} url - 제외할 URL (인코딩된 원본 URL)
 * @returns {Promise<Object>}
 */
export const excludeUrl = async (url) => {
  const response = await axios.post(`${API_URL}/api/mappings/exclude`, { url });
  return response.data;
};

/**
 * 제외된 URL 복원
 * @param {number} id - 제외된 URL의 ID
 * @returns {Promise<Object>}
 */
export const restoreExcludedUrl = async (id) => {
  const response = await axios.delete(`${API_URL}/api/mappings/excluded/${id}`);
  return response.data;
};

/**
 * 페이지 매핑 삭제 (매핑만 해제, URL은 유지)
 * @param {number} mappingId - 매핑 ID
 * @returns {Promise<Object>}
 */
export const deleteMapping = async (mappingId) => {
  const response = await axios.delete(`${API_URL}/api/mappings/${mappingId}`);
  return response.data;
};

/**
 * 특정 cleaned URL의 원본 URL 목록 조회
 * @param {string} cleanedUrl - 정제된 URL
 * @returns {Promise<Object>} { original_urls, total_original_urls, total_visits }
 */
export const fetchOriginalUrls = async (cleanedUrl) => {
  const response = await axios.get(`${API_URL}/api/mappings/original-urls`, {
    params: { cleaned_url: cleanedUrl }
  });
  return response.data;
};
