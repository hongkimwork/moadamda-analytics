/**
 * 타임라인 아이템 컴포넌트
 * 개별 페이지 방문 카드 렌더링
 */

import React from 'react';
import { GlobalOutlined } from '@ant-design/icons';
import { urlToKorean } from '../../../utils/urlToKorean';
import ProductBadge from './ProductBadge';
import { getDurationText } from '../../../utils/orderAnalysis/dataTransform';

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
function getCardStyle(isExit, isPurchaseComplete) {
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

  if (isPurchaseComplete) {
    return {
      ...baseStyle,
      border: '1px solid rgba(59, 130, 246, 0.25)',
      borderLeft: '4px solid #3b82f6',
      background: 'linear-gradient(135deg, #eff6ff 0%, #fff 100%)'
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
  const isPurchaseComplete = isLast && journeyType === 'purchase';

  const durationSeconds = page.time_spent_seconds || 0;
  const badgeStyle = getDurationBadgeStyle(durationSeconds);
  const durationText = getDurationText(durationSeconds, isPurchaseComplete);
  const cardStyle = getCardStyle(isExit, isPurchaseComplete);

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
          : isPurchaseComplete
            ? 'rgba(59, 130, 246, 0.4)'
            : 'rgba(209, 213, 219, 1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.03)';
        e.currentTarget.style.transform = 'translateY(0) translateX(0)';
        e.currentTarget.style.borderColor = isExit
          ? 'rgba(248, 113, 113, 0.25)'
          : isPurchaseComplete
            ? 'rgba(59, 130, 246, 0.25)'
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
      <div style={{ paddingBottom: '14px' }}>
        {/* 첫 줄: 단계 */}
        <div style={{ marginBottom: '8px' }}>
          <span style={{
            fontSize: '13px',
            fontWeight: '700',
            color: isExit
              ? '#dc2626'
              : isPurchaseComplete
                ? '#2563eb'
                : '#374151',
            letterSpacing: '-0.01em'
          }}>
            {journeyType === 'purchase' ? (isLast ? `${globalIdx + 1}단계: 구매 완료` : `${globalIdx + 1}단계`) : (isLast ? '이탈' : `${globalIdx + 1}단계`)}
          </span>
        </div>

        {/* 구매 완료 단계 - 제품 뱃지 먼저 표시 */}
        {journeyType === 'purchase' && isLast && (() => {
          const orderProductName = order.product_name;
          if (!orderProductName || orderProductName === '상품명 없음') {
            return null;
          }
          const matchedMapping = findMatchingMapping(orderProductName);

          // 제품 뱃지가 있으면 표시
          if (matchedMapping?.badges && matchedMapping.badges.length > 0) {
            return <ProductBadge badges={matchedMapping.badges} />;
          }
          return null;
        })()}

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
            marginBottom: isPurchaseComplete ? '8px' : '0'
          }}>
            <span style={{ marginRight: '4px' }}>접속 시간:</span>
            <span style={{ color: '#374151', fontWeight: '500' }}>{accessTime}</span>
          </div>
        )}

        {/* 구매 완료 단계 - 구매한 상품명 맨 마지막에 표시 */}
        {isPurchaseComplete && (() => {
          const orderProductName = order.product_name;
          if (!orderProductName || orderProductName === '상품명 없음') {
            return null;
          }

          return (
            <div style={{
              fontSize: '11px',
              marginBottom: '0',
              padding: '6px 10px',
              background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
              borderRadius: '6px',
              border: '1px solid #bae6fd'
            }}>
              <span style={{
                color: '#0c4a6e',
                fontWeight: '600',
                fontSize: '11px'
              }}>
                구매한 상품:
              </span>
              <span style={{
                color: '#0c4a6e',
                fontWeight: '700',
                fontSize: '11px',
                marginLeft: '4px'
              }}>
                {orderProductName}
              </span>
            </div>
          );
        })()}
      </div>

      {/* 지구본 아이콘 - 우측 하단 */}
      <GlobalOutlined
        style={{
          position: 'absolute',
          right: '10px',
          bottom: '6px',
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
