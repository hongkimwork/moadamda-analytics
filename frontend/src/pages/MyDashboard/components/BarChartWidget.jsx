/**
 * 바 차트 위젯 컴포넌트
 * 가로 막대 그래프로 데이터 표시
 */

import React from 'react';

const BarChartWidget = ({ widget, contentHeight }) => {
  return (
    <div style={{ height: contentHeight, overflow: 'auto', padding: '10px 0' }}>
      {widget.data.map((d, i) => (
        <div key={i} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 13, color: '#262626' }}>{d.name}</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{d.value.toLocaleString()}</span>
          </div>
          <div style={{ height: 8, background: '#f0f0f0', borderRadius: 4 }}>
            <div
              style={{
                height: '100%',
                width: `${(d.value / 6000) * 100}%`,
                background: ['#1890ff', '#52c41a', '#722ed1', '#fa8c16'][i],
                borderRadius: 4
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default BarChartWidget;
