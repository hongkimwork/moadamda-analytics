import React from 'react';
import { Tooltip, message } from 'antd';

/**
 * EllipsisText - 긴 텍스트를 ellipsis 처리하는 컴포넌트
 *
 * @param {string} text - 원본 텍스트
 * @param {number} maxLength - 최대 표시 길이 (기본값: 20)
 *
 * 기능:
 * - 텍스트를 지정된 길이로 제한
 * - 전체 텍스트는 Tooltip으로 표시
 * - 더블클릭 시 클립보드에 복사
 */
const EllipsisText = ({ text, maxLength = 20 }) => {
  if (!text || text === '-') return '-';

  const shortText = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;

  const handleDoubleClick = () => {
    navigator.clipboard.writeText(text).then(() => {
      message.success('복사되었습니다!');
    });
  };

  if (text.length <= maxLength) {
    return <span>{text}</span>;
  }

  return (
    <Tooltip title={text}>
      <span
        style={{
          cursor: 'pointer',
          userSelect: 'none'
        }}
        onDoubleClick={handleDoubleClick}
      >
        {shortText}
      </span>
    </Tooltip>
  );
};

export default EllipsisText;
