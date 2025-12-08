/**
 * 퍼널 위젯 컴포넌트
 * 단계별 전환율 시각화
 */

import React from 'react';

const FunnelWidget = ({ widget, contentHeight }) => {
  return (
    <div style={{ height: contentHeight, overflow: 'auto', padding: '10px 0' }}>
      {widget.data.map((d, i) => (
        <div key={i} style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 13 }}>{d.stage}</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{d.value.toLocaleString()} ({d.rate}%)</span>
          </div>
          <div
            style={{
              height: 24,
              background: `linear-gradient(90deg, #1890ff ${d.rate}%, #f0f0f0 ${d.rate}%)`,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 8
            }}
          >
            <span style={{ fontSize: 11, color: d.rate > 50 ? 'white' : '#8c8c8c' }}>
              {d.rate}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default FunnelWidget;
