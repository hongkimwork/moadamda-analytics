/**
 * URL 디코딩 유틸 함수 (안전하게 처리)
 * @param {string} uri - 디코딩할 URI
 * @returns {string} 디코딩된 URI 또는 원본 URI
 */
export const safeDecodeURI = (uri) => {
  if (!uri) return '';
  try {
    return decodeURIComponent(uri);
  } catch (e) {
    return uri;
  }
};
