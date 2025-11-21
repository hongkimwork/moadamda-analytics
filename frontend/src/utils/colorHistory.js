/**
 * 배지 색상 히스토리 관리 유틸리티
 * LocalStorage를 사용하여 최근 사용한 색상을 저장/조회
 */

const STORAGE_KEY = 'badge_color_history';
const MAX_HISTORY_SIZE = 16; // 2행 x 8열

/**
 * 색상 히스토리 가져오기
 * @returns {string[]} 최근 사용한 색상 배열 (최신순)
 */
export function getColorHistory() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const history = JSON.parse(stored);
    return Array.isArray(history) ? history : [];
  } catch (error) {
    console.error('Failed to load color history:', error);
    return [];
  }
}

/**
 * 색상 히스토리에 새 색상 추가
 * - 중복 제거: 이미 존재하면 맨 앞으로 이동
 * - 최대 개수 유지: 16개 초과 시 오래된 것 삭제
 * @param {string} color - 추가할 색상 (hex 형식)
 */
export function addColorToHistory(color) {
  try {
    if (!color || typeof color !== 'string') return;
    
    // 현재 히스토리 로드
    let history = getColorHistory();
    
    // 중복 제거 (대소문자 구분 없이)
    const normalizedColor = color.toLowerCase();
    history = history.filter(c => c.toLowerCase() !== normalizedColor);
    
    // 맨 앞에 추가
    history.unshift(color);
    
    // 최대 개수 유지
    if (history.length > MAX_HISTORY_SIZE) {
      history = history.slice(0, MAX_HISTORY_SIZE);
    }
    
    // 저장
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (error) {
    console.error('Failed to save color history:', error);
  }
}

/**
 * 색상 히스토리 초기화 (개발/디버깅용)
 */
export function clearColorHistory() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear color history:', error);
  }
}

