/**
 * 고객 여정 타임라인 컴포넌트
 * 여정의 모든 페이지를 타임라인으로 표시
 */

import React from 'react';
import { Timeline, Alert } from 'antd';
import { TimelineItemContent, getTimelineItemColor } from './TimelineItem';
import { getColumns } from '../../../utils/orderAnalysis/journeyCalculations';

const MAX_ITEMS_PER_COLUMN = 4;

/**
 * JourneyTimeline 컴포넌트
 * @param {object} journey - 여정 데이터
 * @param {object} userMappings - 사용자 정의 매핑
 * @param {object} order - 주문 정보
 * @param {Function} findMatchingMapping - 매핑 찾기 함수
 */
export function JourneyTimeline({ journey, userMappings, order, findMatchingMapping }) {
  if (!journey.pages || journey.pages.length === 0) {
    return <Alert message="페이지 이동 기록이 없습니다." type="info" />;
  }

  const columns = getColumns(journey.pages, MAX_ITEMS_PER_COLUMN);

  return (
    <div
      style={{
        border: `2px solid ${journey.color}40`,
        borderRadius: '16px',
        padding: '20px 24px',
        background: 'white',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)',
        flex: '0 0 auto',
        position: 'relative',
        overflow: 'hidden',
        maxHeight: 'calc(95vh - 185px)'
      }}
    >
      {/* 상단 컬러 인디케이터 */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '4px',
        background: `linear-gradient(90deg, ${journey.color}, ${journey.color}cc)`
      }} />

      {/* 여정 헤더 */}
      <div style={{
        marginBottom: '20px',
        paddingBottom: '16px',
        borderBottom: `1px solid ${journey.color}20`
      }}>
        <h3 style={{
          margin: 0,
          fontSize: '15px',
          fontWeight: '700',
          color: journey.color,
          letterSpacing: '-0.01em'
        }}>
          {journey.label}
        </h3>
      </div>

      {/* 타임라인 */}
      <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
        {columns.map((columnItems, colIdx) => {
          // Ant Design items prop 형식으로 변환
          const timelineItems = columnItems.map((page, idx) => {
            const globalIdx = colIdx * MAX_ITEMS_PER_COLUMN + idx;
            const isLast = globalIdx === journey.pages.length - 1;
            const isExit = isLast && journey.type !== 'purchase';

            return {
              key: globalIdx,
              color: getTimelineItemColor(isExit),
              children: (
                <TimelineItemContent
                  page={page}
                  globalIdx={globalIdx}
                  totalPages={journey.pages.length}
                  journeyType={journey.type}
                  userMappings={userMappings}
                  order={order}
                  findMatchingMapping={findMatchingMapping}
                />
              )
            };
          });

          return (
            <div key={colIdx} style={{ width: '190px', flexShrink: 0 }}>
              <Timeline
                style={{ fontSize: '11px' }}
                items={timelineItems}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default JourneyTimeline;
