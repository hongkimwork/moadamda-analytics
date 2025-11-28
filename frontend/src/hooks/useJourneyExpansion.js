/**
 * 고객 여정 펼침/축소 상태 관리 훅
 */

import { useState, useCallback } from 'react';

/**
 * useJourneyExpansion 훅
 * @param {Array} defaultExpanded - 기본 펼침 상태 (기본값: ['purchase'])
 * @returns {object} 펼침 상태 및 토글 함수
 */
export function useJourneyExpansion(defaultExpanded = ['purchase']) {
  const [expandedJourneys, setExpandedJourneys] = useState(defaultExpanded);

  const toggleJourney = useCallback((journeyId) => {
    setExpandedJourneys(prev =>
      prev.includes(journeyId)
        ? prev.filter(id => id !== journeyId) // 축소
        : [...prev, journeyId] // 펼침
    );
  }, []);

  return {
    expandedJourneys,
    toggleJourney
  };
}

export default useJourneyExpansion;
