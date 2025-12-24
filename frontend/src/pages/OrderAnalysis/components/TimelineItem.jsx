/**
 * 타임라인 아이템 컴포넌트
 * 개별 페이지 방문 카드 렌더링
 */

import React from 'react';
import { GlobalOutlined } from '@ant-design/icons';
import { urlToKorean } from '../../../utils/urlToKorean';
import ProductBadge from './ProductBadge';
import { getDurationText } from '../../../utils/orderAnalysis/dataTransform';

// Note: order와 findMatchingMapping props는 호환성을 위해 유지하지만 현재 사용하지 않음

/**
 * 체류시간 배지 스타일 계산
 */
function getDurationBadgeStyle(durationSeconds) {
  if (durationSeconds >= 30) {
    return {
      background: '#dbeafe',
      color: '#1e40af'
    };
  }
  if (durationSeconds >= 10) {
    return {
      background: '#fef3c7',
      color: '#92400e'
    };
  }
  return {
    background: '#fecaca',
    color: '#dc2626'
  };
}

/**
 * 카드 스타일 계산
 */
function getCardStyle(isExit) {
  const baseStyle = {
    borderRadius: '12px',
    padding: '14px 16px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.03)',
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    cursor: 'default',
    marginBottom: '14px',
    position: 'relative'
  };

  if (isExit) {
    return {
      ...baseStyle,
      border: '1px solid rgba(248, 113, 113, 0.25)',
      borderLeft: '4px solid #ef4444',
      background: 'linear-gradient(135deg, #fef2f2 0%, #fff 100%)'
    };
  }

  return {
    ...baseStyle,
    border: '1px solid rgba(229, 231, 235, 0.8)',
    borderLeft: '3px solid rgba(209, 213, 219, 0.6)',
    background: 'linear-gradient(135deg, #ffffff 0%, #fafbfc 100%)'
  };
}

/**
 * 타임라인 아이템의 색상 결정
 */
export function getTimelineItemColor(isExit) {
  return isExit ? 'red' : 'gray';
}

/**
 * TimelineItemContent 컴포넌트
 * Timeline items prop의 children으로 사용
 */
export function TimelineItemContent({
  page,
  globalIdx,
  totalPages,
  journeyType,
  userMappings,
  order,
  findMatchingMapping
}) {
  const urlInfo = urlToKorean(page.clean_url || page.page_url, userMappings);
  const isLast = globalIdx === totalPages - 1;
  const isExit = isLast && journeyType !== 'purchase';

  const durationSeconds = page.time_spent_seconds || 0;
  const badgeStyle = getDurationBadgeStyle(durationSeconds);
  const durationText = getDurationText(durationSeconds);
  const cardStyle = getCardStyle(isExit);

  // 접속 시간 포맷 (HH:MM:SS)
  const accessTime = page.timestamp ? new Date(page.timestamp).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }) : '';

  return (
    <div
      style={cardStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)';
        e.currentTarget.style.transform = 'translateY(-2px) translateX(2px)';
        e.currentTarget.style.borderColor = isExit
          ? 'rgba(248, 113, 113, 0.4)'
          : 'rgba(209, 213, 219, 1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.03)';
        e.currentTarget.style.transform = 'translateY(0) translateX(0)';
        e.currentTarget.style.borderColor = isExit
          ? 'rgba(248, 113, 113, 0.25)'
          : 'rgba(229, 231, 235, 0.8)';
      }}
    >
      {/* 체류시간 배지 - 우측 상단 고정 */}
      {durationText && (
        <span style={{
          ...badgeStyle,
          padding: '1px 6px',
          borderRadius: '3px',
          fontSize: '10px',
          fontWeight: '500',
          position: 'absolute',
          top: '10px',
          right: '10px',
          letterSpacing: '0.01em'
        }}>
          {durationText}
        </span>
      )}

      {/* 콘텐츠 wrapper */}
      <div style={{ paddingBottom: '0px' }}>
        {/* 첫 줄: 단계 */}
        <div style={{ marginBottom: '8px' }}>
          <span style={{
            fontSize: '13px',
            fontWeight: '700',
            color: isExit
              ? '#dc2626'
              : '#374151',
            letterSpacing: '-0.01em'
          }}>
            {isExit ? '이탈' : `${globalIdx + 1}단계`}
          </span>
        </div>

        {/* 상품 페이지 뱃지 표시 (페이지 매핑 기반) */}
        {(() => {
          // 페이지 매핑에서 is_product_page로 설정된 경우에만 표시
          if (urlInfo.isProductPage) {
            // 다중 배지 지원: badges 배열 우선, 없으면 단일 badge 폴백
            const badgesToDisplay = urlInfo.badges && urlInfo.badges.length > 0
              ? urlInfo.badges
              : (urlInfo.badgeText ? [{ text: urlInfo.badgeText, color: urlInfo.badgeColor || '#1677ff' }] : []);

            if (badgesToDisplay.length > 0) {
              return <ProductBadge badges={badgesToDisplay} />;
            }
          }
          return null;
        })()}

        {/* 페이지명 (한글 이름) */}
        <div style={{
          fontSize: '12px',
          color: '#111827',
          lineHeight: '1.5',
          fontWeight: '600',
          letterSpacing: '-0.01em'
        }}>
          <span style={{
            color: '#6b7280',
            fontWeight: '500',
            marginRight: '6px',
            fontSize: '11px'
          }}>
            경로:
          </span>
          <span style={{ color: '#1f2937' }}>
            {urlInfo.name}
          </span>
        </div>

        {/* 접속 시간 */}
        {accessTime && (
          <div style={{
            fontSize: '11px',
            color: '#6b7280',
            marginTop: '6px',
            fontWeight: '400',
            display: 'flex',
            alignItems: 'center'
          }}>
            <span style={{ marginRight: '4px' }}>접속 시간:</span>
            <span style={{ color: '#374151', fontWeight: '500' }}>{accessTime}</span>
          </div>
        )}
      </div>

      {/* 지구본 아이콘 - 우측 하단 (접속 시간과 수평) */}
      <GlobalOutlined
        style={{
          position: 'absolute',
          right: '10px',
          bottom: '10px',
          fontSize: '16px',
          color: '#9ca3af',
          cursor: 'pointer',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          opacity: 0.5,
          padding: '4px',
          borderRadius: '50%',
          background: 'transparent'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px) scale(1.1)';
          e.currentTarget.style.color = '#3b82f6';
          e.currentTarget.style.opacity = '1';
          e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0) scale(1)';
          e.currentTarget.style.color = '#9ca3af';
          e.currentTarget.style.opacity = '0.5';
          e.currentTarget.style.background = 'transparent';
        }}
        onClick={(e) => {
          e.stopPropagation();
          window.open(page.page_url, '_blank');
        }}
      />
    </div>
  );
}

export default TimelineItemContent;
