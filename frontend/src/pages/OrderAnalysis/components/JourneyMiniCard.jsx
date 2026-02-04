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
        cursor: 'pointer',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: isExpanded ? 'translateY(-3px) scale(1.02)' : 'none',
        minWidth: '110px'
      }}
      onMouseEnter={(e) => {
        if (!isExpanded) {
          const mainCard = e.currentTarget.querySelector('[data-main-card]');
          if (mainCard) {
            mainCard.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.12)';
            mainCard.style.borderColor = journey.color;
          }
          e.currentTarget.style.transform = 'translateY(-1px)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isExpanded) {
          const mainCard = e.currentTarget.querySelector('[data-main-card]');
          if (mainCard) {
            mainCard.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.06)';
            mainCard.style.borderColor = '#e5e7eb';
          }
          e.currentTarget.style.transform = 'translateY(0)';
        }
      }}
    >
      {/* 메인 카드 영역 */}
      <div
        data-main-card
        style={{
          padding: '10px 16px',
          borderRadius: '10px 10px 0 0',
          border: isExpanded ? `2px solid ${journey.color}` : '1.5px solid #e5e7eb',
          borderBottom: 'none',
          background: isExpanded
            ? journey.type === 'purchase'
              ? 'linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)'
              : 'linear-gradient(135deg, #f3f4f6 0%, #f9fafb 100%)'
            : 'white',
          boxShadow: isExpanded
            ? '0 8px 16px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)'
            : '0 1px 3px rgba(0, 0, 0, 0.06)',
          whiteSpace: 'nowrap',
          position: 'relative',
          overflow: 'hidden',
          textAlign: 'center'
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
          color: journey.type === 'purchase' 
            ? '#2563eb' // 파란색 (구매)
            : '#6b7280', // 회색 (이탈)
          letterSpacing: '0.01em'
        }}>
          {journey.label}
        </div>
      </div>

      {/* 하단 요약 정보 영역 */}
      <div
        style={{
          padding: '6px 12px',
          borderRadius: '0 0 10px 10px',
          border: isExpanded ? `2px solid ${journey.color}` : '1.5px solid #e5e7eb',
          borderTop: `1px solid ${isExpanded ? journey.color + '40' : '#e5e7eb'}`,
          background: isExpanded ? '#f8fafc' : '#f9fafb',
          fontSize: '10px',
          color: '#6b7280',
          textAlign: 'center',
          whiteSpace: 'nowrap'
        }}
      >
        {`PV:${journey.pageCount} · ${journey.duration}`}
      </div>
    </div>
  );
}

export default JourneyMiniCard;
