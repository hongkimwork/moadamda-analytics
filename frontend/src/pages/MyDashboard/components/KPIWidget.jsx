/**
 * KPI 위젯 컴포넌트
 * 단일 숫자 지표 표시 (비교 모드 지원)
 */

import React from 'react';

const KPIWidget = ({ widget, contentHeight }) => {
  // 비교 모드 확인 (compareValue가 숫자면 비교 모드)
  const hasCompare = widget.compareEnabled && (widget.data.compareValue !== null && widget.data.compareValue !== undefined);
  const changeValue = widget.data.change;
  const isNewData = changeValue === 'new';  // 이전 데이터 없음 (신규)
  const numericChange = isNewData ? 0 : (parseFloat(changeValue) || 0);

  // 날짜 포맷팅 (MM/DD 형식)
  const formatDateRange = (range) => {
    if (!range) return '';
    const start = range.start || '';
    const end = range.end || '';
    // YYYY-MM-DD → MM/DD 변환
    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      const parts = dateStr.split('-');
      return parts.length >= 3 ? `${parts[1]}/${parts[2]}` : dateStr;
    };
    return `${formatDate(start)}~${formatDate(end)}`;
  };

  const currentDateLabel = widget.dateRange ? formatDateRange(widget.dateRange) : '이번 기간';
  const compareDateLabel = widget.compareRange ? formatDateRange(widget.compareRange) : '이전 기간';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: contentHeight,
      padding: '10px 0'
    }}>
      {/* 비교 모드: 현재값 + 이전값 나란히 표시 */}
      {hasCompare ? (
        <>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 20,
            width: '100%'
          }}>
            {/* 현재 기간 */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#1890ff', marginBottom: 4, fontWeight: 500 }}>{currentDateLabel}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#1890ff' }}>
                {widget.data.prefix}{(widget.data.value || 0).toLocaleString()}<span style={{ fontSize: 13 }}>{widget.data.suffix}</span>
              </div>
            </div>

            {/* 구분선 */}
            <div style={{
              width: 1,
              height: 40,
              background: '#e8e8e8'
            }} />

            {/* 이전 기간 */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4, fontWeight: 500 }}>{compareDateLabel}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#8c8c8c' }}>
                {widget.data.prefix}{(widget.data.compareValue || 0).toLocaleString()}<span style={{ fontSize: 13 }}>{widget.data.suffix}</span>
              </div>
            </div>
          </div>

          {/* 증감률 */}
          <div style={{
            fontSize: 12,
            marginTop: 8,
            padding: '3px 10px',
            borderRadius: 10,
            background: isNewData ? '#e6f7ff' : (numericChange >= 0 ? '#f6ffed' : '#fff2f0'),
            color: isNewData ? '#1890ff' : (numericChange >= 0 ? '#52c41a' : '#ff4d4f')
          }}>
            {isNewData ? (
              '🆕 신규 (이전 데이터 없음)'
            ) : (
              <>
                {numericChange >= 0 ? '▲' : '▼'} {Math.abs(numericChange)}%
              </>
            )}
          </div>
        </>
      ) : (
        /* 비교 없음: 기존 단일 값 표시 */
        <div style={{ fontSize: 36, fontWeight: 700, color: '#1890ff' }}>
          {widget.data.prefix}{(widget.data.value || 0).toLocaleString()}{widget.data.suffix}
        </div>
      )}
    </div>
  );
};

export default KPIWidget;
