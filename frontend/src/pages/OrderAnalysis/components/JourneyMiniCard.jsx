/**
 * 고객 여정 미니 카드 컴포넌트
 * 상단에 표시되는 여정 선택 카드
 */

import React from 'react';

/**
 * JourneyMiniCard 컴포넌트
 * @param {object} journey - 여정 데이터
 * @param {boolean} isExpanded - 펼침 상태
 * @param {Function} onToggle - 토글 핸들러
 */
export function JourneyMiniCard({ journey, isExpanded, onToggle }) {
  return (
    <div
      onClick={onToggle}
      style={{
        padding: '10px 16px',
        borderRadius: '10px',
        border: isExpanded ? `2px solid ${journey.color}` : '1.5px solid #e5e7eb',
        background: isExpanded
          ? journey.type === 'purchase'
            ? 'linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)'
            : 'linear-gradient(135deg, #f3f4f6 0%, #f9fafb 100%)'
          : 'white',
        cursor: 'pointer',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        minWidth: '110px',
        textAlign: 'center',
        boxShadow: isExpanded
          ? '0 8px 16px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)'
          : '0 1px 3px rgba(0, 0, 0, 0.06)',
        transform: isExpanded ? 'translateY(-3px) scale(1.02)' : 'none',
        whiteSpace: 'nowrap',
        position: 'relative',
        overflow: 'hidden'
      }}
      onMouseEnter={(e) => {
        if (!isExpanded) {
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.12)';
          e.currentTarget.style.transform = 'translateY(-1px)';
          e.currentTarget.style.borderColor = journey.color;
        }
      }}
      onMouseLeave={(e) => {
        if (!isExpanded) {
          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.06)';
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.borderColor = '#e5e7eb';
        }
      }}
    >
      {/* 활성 인디케이터 */}
      {isExpanded && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: `linear-gradient(90deg, ${journey.color}, ${journey.color}dd)`,
          borderRadius: '10px 10px 0 0'
        }} />
      )}

      <div style={{
        fontSize: '13px',
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: '4px',
        letterSpacing: '-0.01em'
      }}>
        {journey.dateLabel}
      </div>
      <div style={{
        fontSize: '11px',
        fontWeight: '700',
        color: journey.type === 'purchase' ? '#2563eb' : '#6b7280',
        letterSpacing: '0.01em'
      }}>
        {journey.label}
      </div>
    </div>
  );
}

export default JourneyMiniCard;
