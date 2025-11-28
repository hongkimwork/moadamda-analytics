/**
 * 사용자 정의 URL 매핑 커스텀 훅
 */

import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * useUserMappings 훅
 * @returns {object} 매핑 데이터
 */
export function useUserMappings() {
  const [userMappings, setUserMappings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMappings = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_URL}/api/mappings/lookup`);
        const data = await response.json();
        setUserMappings(data);
        setLoading(false);
      } catch (err) {
        console.error('매핑 로드 실패:', err);
        setError(err);
        setLoading(false);
      }
    };

    fetchMappings();
  }, []);

  return {
    userMappings,
    loading,
    error
  };
}

export default useUserMappings;
