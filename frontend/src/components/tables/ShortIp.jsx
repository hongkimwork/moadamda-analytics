import React from 'react';
import { Tooltip, message } from 'antd';

/**
 * ShortIp - IP 주소를 짧게 표시하는 컴포넌트
 *
 * @param {string} ip - IP 주소
 *
 * 기능:
 * - IP 주소를 6자로 제한하여 표시
 * - 전체 IP는 Tooltip으로 표시
 * - 더블클릭 시 클립보드에 복사
 */
const ShortIp = ({ ip }) => {
  if (!ip || ip === '-') return '-';

  // 6자로 제한
  const shortIp = ip.length > 6 ? ip.substring(0, 6) + '...' : ip;

  const handleDoubleClick = () => {
    navigator.clipboard.writeText(ip).then(() => {
      message.success('IP 주소가 복사되었습니다!');
    });
  };

  return (
    <Tooltip title={ip}>
      <span
        style={{
          fontFamily: 'monospace',
          fontSize: '11px',
          cursor: 'pointer',
          userSelect: 'none'
        }}
        onDoubleClick={handleDoubleClick}
      >
        {shortIp}
      </span>
    </Tooltip>
  );
};

export default ShortIp;
