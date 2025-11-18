import React from 'react';
import { Tooltip, message } from 'antd';

/**
 * safeDecodeURI - URL 디코딩 유틸 함수 (안전하게 처리)
 *
 * @param {string} uri - 디코딩할 URI
 * @returns {string} 디코딩된 URI (실패 시 원본 반환)
 */
const safeDecodeURI = (uri) => {
  if (!uri) return uri;

  try {
    // 이미 디코딩된 URL인지 확인 (인코딩 후 다시 디코딩했을 때 동일하면 이미 디코딩됨)
    const decoded = decodeURIComponent(uri);
    const reEncoded = encodeURIComponent(decoded);

    // URI 인코딩된 부분만 디코딩
    if (uri.includes('%')) {
      return decoded;
    }
    return uri;
  } catch (e) {
    // 디코딩 실패 시 원본 반환
    return uri;
  }
};

/**
 * ShortUrl - URL에서 경로만 추출하는 컴포넌트
 *
 * @param {string} url - 원본 URL
 *
 * 기능:
 * - 도메인 제거하고 경로만 표시
 * - 한글 URL 디코딩 처리
 * - 25자 제한으로 표시
 * - 전체 URL은 Tooltip으로 표시
 * - 더블클릭 시 클립보드에 복사
 */
const ShortUrl = ({ url }) => {
  if (!url) return '-';

  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname + urlObj.search;

    // URL 디코딩 처리 (한글 표시)
    const decodedPath = safeDecodeURI(path);

    // 25자 제한, 앞부분 표시
    const shortPath = decodedPath.length > 25 ? decodedPath.substring(0, 22) + '...' : decodedPath;

    const handleDoubleClick = () => {
      navigator.clipboard.writeText(url).then(() => {
        message.success('URL이 복사되었습니다!');
      });
    };

    return (
      <Tooltip title={safeDecodeURI(url)}>
        <span
          style={{
            fontSize: '11px',
            cursor: 'pointer',
            userSelect: 'none',
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
          onDoubleClick={handleDoubleClick}
        >
          {shortPath}
        </span>
      </Tooltip>
    );
  } catch (e) {
    return <span style={{ fontSize: '11px' }}>{safeDecodeURI(url)}</span>;
  }
};

export default ShortUrl;
