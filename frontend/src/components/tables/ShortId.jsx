import React from 'react';
import { Tooltip, message } from 'antd';

/**
 * ShortId - ID를 짧게 표시하는 컴포넌트
 *
 * @param {string} id - 원본 ID
 * @param {number} length - 표시할 길이 (기본값: 8)
 *
 * 기능:
 * - ID를 지정된 길이만큼 잘라서 표시
 * - 전체 ID는 Tooltip으로 표시
 * - 더블클릭 시 클립보드에 복사
 */
const ShortId = ({ id, length = 8 }) => {
  const shortId = id ? id.substring(0, length) + '...' : '-';

  const handleDoubleClick = () => {
    if (id) {
      navigator.clipboard.writeText(id).then(() => {
        message.success('복사되었습니다!');
      });
    }
  };

  return (
    <Tooltip title={id || '-'}>
      <span
        style={{
          fontFamily: 'monospace',
          fontSize: '11px',
          cursor: 'pointer',
          userSelect: 'none'
        }}
        onDoubleClick={handleDoubleClick}
      >
        {shortId}
      </span>
    </Tooltip>
  );
};

export default ShortId;
