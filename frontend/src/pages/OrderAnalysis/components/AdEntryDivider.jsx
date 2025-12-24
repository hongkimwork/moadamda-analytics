/**
 * 광고 유입 카드 컴포넌트
 * TimelineItemContent와 동일한 스타일, 광고 전용 보라색 테마
 */

import React from 'react';
import { BarChart3 } from 'lucide-react';

// 광고 카드 전용 색상 (보라색 계열)
const AD_COLOR = '#8b5cf6';

/**
 * 광고 매체 라벨 변환
 */
function getAdSourceLabel(utmSource) {
  const source = (utmSource || '').toLowerCase();
  
  const labelMap = {
    naver: '네이버',
    meta: '메타',
    facebook: '페이스북',
    instagram: '인스타그램',
    google: '구글',
    kakao: '카카오',
    youtube: '유튜브',
  };
  
  return labelMap[source] || utmSource || '광고';
}

/**
 * 광고 소재 분석 페이지로 이동
 */
function navigateToCreativeAnalysis(utmContent) {
  if (!utmContent) return;
  const searchQuery = encodeURIComponent(utmContent);
  window.location.href = `/creative-performance?search=${searchQuery}`;
}

/**
 * AdEntryDivider 컴포넌트
 * TimelineItemContent 스타일을 따르는 광고 클릭 카드
 * @param {object} utmSession - UTM 세션 정보
 */
export function AdEntryDivider({ utmSession }) {
  if (!utmSession) return null;
  
  const { utm_source, utm_medium, utm_campaign, utm_content, entry_time } = utmSession;
  const sourceLabel = getAdSourceLabel(utm_source);
  
  // 시간 포맷 (HH:MM:SS)
  const entryTimeFormatted = entry_time ? new Date(entry_time).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }) : '';

  // 캠페인명 축약
  const campaignLabel = utm_campaign 
    ? (utm_campaign.length > 15 ? utm_campaign.slice(0, 15) + '...' : utm_campaign)
    : null;

  // 광고 소재명 축약
  const contentLabel = utm_content
    ? (utm_content.length > 15 ? utm_content.slice(0, 15) + '...' : utm_content)
    : null;

  // 카드 스타일 (깔끔한 버전 - 왼쪽 외곽선 없음)
  const cardStyle = {
    borderRadius: '12px',
    padding: '14px 16px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.03)',
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    cursor: 'default',
    marginBottom: '14px',
    position: 'relative',
    border: `1px solid ${AD_COLOR}25`,
    background: `linear-gradient(135deg, ${AD_COLOR}08 0%, #ffffff 100%)`
  };

  // 아이콘 클릭 가능 여부 (utm_content가 있어야 분석 페이지 이동 가능)
  const isIconClickable = !!utm_content;

  return (
    <div
      style={cardStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)';
        e.currentTarget.style.transform = 'translateY(-2px) translateX(2px)';
        e.currentTarget.style.borderColor = `${AD_COLOR}40`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.03)';
        e.currentTarget.style.transform = 'translateY(0) translateX(0)';
        e.currentTarget.style.borderColor = `${AD_COLOR}25`;
      }}
    >
      {/* 콘텐츠 wrapper */}
      <div style={{ paddingBottom: '0px' }}>
        {/* 첫 줄: 광고 클릭 */}
        <div style={{ marginBottom: '8px' }}>
          <span style={{
            fontSize: '13px',
            fontWeight: '700',
            color: AD_COLOR,
            letterSpacing: '-0.01em'
          }}>
            광고 클릭
          </span>
        </div>

        {/* 매체 정보 */}
        <div style={{
          fontSize: '11px',
          lineHeight: '1.5',
          display: 'flex',
          flexWrap: 'wrap'
        }}>
          <span style={{
            color: '#6b7280',
            fontWeight: '500',
            marginRight: '4px',
            whiteSpace: 'nowrap'
          }}>
            매체:
          </span>
          <span style={{ color: '#000000', fontWeight: '600', fontSize: '12px', wordBreak: 'break-word' }}>
            {sourceLabel}
            {utm_medium && (
              <span style={{ color: '#6b7280', fontWeight: '400', marginLeft: '4px' }}>
                ({utm_medium})
              </span>
            )}
          </span>
        </div>

        {/* 캠페인명 (있을 경우만) */}
        {campaignLabel && (
          <div style={{
            fontSize: '11px',
            marginTop: '4px'
          }}>
            <span style={{ color: '#6b7280', fontWeight: '500', marginRight: '4px' }}>캠페인:</span>
            <span style={{ color: '#000000', fontWeight: '600' }}>{campaignLabel}</span>
          </div>
        )}

        {/* 광고 소재명 (있을 경우만) */}
        {contentLabel && (
          <div style={{
            fontSize: '11px',
            marginTop: '4px'
          }}>
            <span style={{ color: '#6b7280', fontWeight: '500', marginRight: '4px' }}>소재:</span>
            <span style={{ color: '#000000', fontWeight: '600' }}>{contentLabel}</span>
          </div>
        )}

        {/* 접속 시간 */}
        {entryTimeFormatted && (
          <div style={{
            fontSize: '11px',
            marginTop: '6px',
            display: 'flex',
            alignItems: 'center'
          }}>
            <span style={{ color: '#6b7280', fontWeight: '500', marginRight: '4px' }}>접속 시간:</span>
            <span style={{ color: '#000000', fontWeight: '600' }}>{entryTimeFormatted}</span>
          </div>
        )}
      </div>

      {/* 차트 아이콘 - 우측 하단 (접속 시간과 수평) */}
      <BarChart3
        size={25}
        strokeWidth={3.5}
        style={{
          position: 'absolute',
          right: '8px',
          bottom: '10px',
          color: AD_COLOR,
          opacity: isIconClickable ? 0.5 : 0.2,
          cursor: isIconClickable ? 'pointer' : 'default',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          padding: '4px',
          borderRadius: '50%',
          background: 'transparent'
        }}
        onMouseEnter={(e) => {
          if (isIconClickable) {
            e.currentTarget.style.transform = 'translateY(-2px) scale(1.1)';
            e.currentTarget.style.color = AD_COLOR;
            e.currentTarget.style.opacity = '1';
            e.currentTarget.style.background = `${AD_COLOR}15`;
          }
        }}
        onMouseLeave={(e) => {
          if (isIconClickable) {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.color = AD_COLOR;
            e.currentTarget.style.opacity = '0.5';
            e.currentTarget.style.background = 'transparent';
          }
        }}
        onClick={(e) => {
          if (isIconClickable) {
            e.stopPropagation();
            navigateToCreativeAnalysis(utm_content);
          }
        }}
      />
    </div>
  );
}

export default AdEntryDivider;
