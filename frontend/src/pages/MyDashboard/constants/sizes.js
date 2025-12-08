/**
 * 위젯 크기 시스템 정의
 */

/**
 * 너비 크기 (3단 그리드 기준)
 */
export const WIDTH_SIZES = {
  small: { cols: 1, label: '1/3' },
  medium: { cols: 2, label: '2/3' },
  large: { cols: 3, label: '전체' }
};

/**
 * 높이 크기 (3단계)
 */
export const HEIGHT_SIZES = {
  short: { height: 150, label: '작음' },
  medium: { height: 250, label: '중간' },
  tall: { height: 350, label: '큼' }
};

/**
 * cols 값에서 width size key 찾기
 */
export const getWidthSizeFromCols = (cols) => {
  if (cols <= 1) return 'small';
  if (cols <= 2) return 'medium';
  return 'large';
};

/**
 * height 픽셀에서 height size key 찾기
 */
export const getHeightSizeFromPixels = (pixels) => {
  if (pixels <= 175) return 'short';
  if (pixels <= 275) return 'medium';
  return 'tall';
};
