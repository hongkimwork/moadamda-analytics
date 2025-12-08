/**
 * 테이블 위젯 컴포넌트
 * 다양한 프리셋 지원 (최근 주문, 상위 상품, 기본 테이블)
 */

import React from 'react';

const TableWidget = ({ widget, contentHeight }) => {
  // 프리셋별 테이블 렌더링
  if (widget.presetId === 'recent_orders') {
    return (
      <div style={{ height: contentHeight, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
              <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>주문번호</th>
              <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>상품명</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>금액</th>
              <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>경로</th>
            </tr>
          </thead>
          <tbody>
            {(Array.isArray(widget.data) ? widget.data : []).map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '6px 8px', fontSize: 11 }}>{row.order_id}</td>
                <td style={{ padding: '6px 8px', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.product_name}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: '#1890ff' }}>
                  {(row.final_payment || 0).toLocaleString()}원
                </td>
                <td style={{ padding: '6px 8px', fontSize: 11, color: '#8c8c8c' }}>{row.order_place}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (widget.presetId === 'top_products') {
    return (
      <div style={{ height: contentHeight, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
              <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600, position: 'sticky', top: 0, background: 'white', width: 30 }}>#</th>
              <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>상품명</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>주문</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>매출</th>
            </tr>
          </thead>
          <tbody>
            {(Array.isArray(widget.data) ? widget.data : []).map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600, color: i < 3 ? '#fa8c16' : '#8c8c8c' }}>{i + 1}</td>
                <td style={{ padding: '6px 8px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.product_name}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right' }}>{row.order_count}건</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: '#1890ff' }}>
                  {(row.revenue || 0).toLocaleString()}원
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // 기본 테이블 (기존 더미 데이터 호환)
  return (
    <div style={{ height: contentHeight, overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>캠페인</th>
            <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>방문자</th>
            <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>주문</th>
            <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, position: 'sticky', top: 0, background: 'white' }}>매출</th>
          </tr>
        </thead>
        <tbody>
          {(Array.isArray(widget.data) ? widget.data : []).map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '8px 12px' }}>{row.campaign}</td>
              <td style={{ padding: '8px 12px', textAlign: 'right' }}>{(row.visitors || 0).toLocaleString()}</td>
              <td style={{ padding: '8px 12px', textAlign: 'right' }}>{row.orders}</td>
              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#1890ff' }}>
                {(row.revenue || 0).toLocaleString()}원
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TableWidget;
