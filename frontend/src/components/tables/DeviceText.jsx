import React from 'react';

/**
 * DeviceText - 디바이스 타입을 텍스트로 표시하는 컴포넌트
 *
 * @param {string} device - 디바이스 타입 (mobile, pc, tablet)
 *
 * 기능:
 * - 디바이스 코드를 사람이 읽기 쉬운 텍스트로 변환
 */
const DeviceText = ({ device }) => {
  if (!device) return '-';

  const deviceMap = {
    'mobile': 'Mobile',
    'pc': 'PC',
    'tablet': 'Tablet'
  };

  return <span>{deviceMap[device] || device}</span>;
};

export default DeviceText;
