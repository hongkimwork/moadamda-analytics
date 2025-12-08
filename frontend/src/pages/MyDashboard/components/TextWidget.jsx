/**
 * 텍스트 위젯 컴포넌트
 * 제목과 본문 텍스트 표시
 */

import React from 'react';

const TextWidget = ({ widget, contentHeight }) => {
  return (
    <div style={{ height: contentHeight, overflow: 'auto', padding: '10px 0' }}>
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: '#262626' }}>
        {widget.data.title}
      </div>
      <div style={{ fontSize: 14, color: '#8c8c8c', lineHeight: 1.6 }}>
        {widget.data.content}
      </div>
    </div>
  );
};

export default TextWidget;
