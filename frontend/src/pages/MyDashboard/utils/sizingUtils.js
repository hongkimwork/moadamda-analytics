import { WIDTH_SIZES, HEIGHT_SIZES } from '../constants.jsx';

// cols에서 width size key 찾기
export const getWidthSizeFromCols = (cols) => {
  if (cols <= 1) return 'small';
  if (cols <= 2) return 'medium';
  return 'large';
};

// height에서 height size key 찾기
export const getHeightSizeFromPixels = (pixels) => {
  if (pixels <= 175) return 'short';
  if (pixels <= 275) return 'medium';
  return 'tall';
};

// 위젯 너비 계산 (cols에서 실제 픽셀로)
export const getWidthFromCols = (cols, colWidth, gap) => {
  return cols * colWidth + (cols - 1) * gap;
};

// cols별 WIDTH_SIZES 매핑
export const getWidthSizeConfig = (widthSize) => {
  return WIDTH_SIZES[widthSize] || WIDTH_SIZES.small;
};

// heightSize별 HEIGHT_SIZES 매핑
export const getHeightSizeConfig = (heightSize) => {
  return HEIGHT_SIZES[heightSize] || HEIGHT_SIZES.short;
};
