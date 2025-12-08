/**
 * 라인 차트 위젯 컴포넌트
 * 시계열 데이터를 막대 그래프로 표시
 */

import React from 'react';

const LineChartWidget = ({ widget, contentHeight }) => {
  return (
    <div style={{ height: contentHeight, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', height: contentHeight - 30, gap: 8 }}>
        {widget.data.map((d, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div
              style={{
                width: '100%',
                height: `${(d.value / 1500) * (contentHeight - 50)}px`,
                background: 'linear-gradient(180deg, #1890ff 0%, #69c0ff 100%)',
                borderRadius: '4px 4px 0 0',
                minHeight: 20
              }}
            />
            <div style={{ fontSize: 10, color: '#8c8c8c', marginTop: 4 }}>{d.date}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LineChartWidget;
