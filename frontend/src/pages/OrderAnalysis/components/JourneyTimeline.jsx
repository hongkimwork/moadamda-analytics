/**
 * 고객 여정 타임라인 컴포넌트
 * 여정의 모든 페이지를 타임라인으로 표시
 * DOM 높이 측정 기반 동적 열 분할
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Timeline, Alert } from 'antd';
import { TimelineItemContent, getTimelineItemColor } from './TimelineItem';
import AdEntryDivider from './AdEntryDivider';
import PurchaseTimelineItem from './PurchaseTimelineItem';

// 열 최대 높이 (모달 내 가용 공간 기준)
const MAX_COLUMN_HEIGHT = 550;
// 타임라인 점과 연결선 등의 추가 높이
const TIMELINE_DOT_HEIGHT = 24;

/**
 * 타임라인 아이템 데이터 생성 (측정용 및 실제 렌더링용 공통)
 */
function buildTimelineItems(pages, journey, userMappings, order, findMatchingMapping) {
  const items = [];
  
  pages.forEach((page, globalIdx) => {
    const isLast = globalIdx === pages.length - 1;
    // 구매 여정인 경우 마지막 페이지는 이탈이 아님 (구매 완료 아이템이 뒤따름)
    const isExit = isLast && journey.type !== 'purchase';

    // 광고 유입 시점인 경우 광고 클릭 카드 먼저 추가
    if (page.adEntry) {
      items.push({
        key: `ad-entry-${globalIdx}`,
        type: 'ad',
        color: 'green',
        utmSession: page.adEntry,
        globalIdx
      });
    }

    // 페이지 아이템 추가
    items.push({
      key: `page-${globalIdx}`,
      type: 'page',
      color: getTimelineItemColor(isExit),
      page,
      globalIdx,
      isLast,
      isExit
    });
  });

  // 구매 여정인 경우 마지막에 구매 완료 아이템 추가
  if (journey.type === 'purchase') {
    // 이전 구매인 경우 pastPurchase 사용, 현재 주문인 경우 order 사용
    const purchaseData = journey.pastPurchase || order;
    if (purchaseData) {
      items.push({
        key: 'purchase-complete',
        type: 'purchase',
        color: 'blue',
        order: purchaseData
      });
    }
  }

  return items;
}

/**
 * 측정된 높이를 기반으로 열 분할
 */
function splitIntoColumnsByHeight(items, heights, maxHeight) {
  const columns = [];
  let currentColumn = [];
  let currentHeight = 0;

  items.forEach((item, idx) => {
    const itemHeight = (heights[idx] || 100) + TIMELINE_DOT_HEIGHT;
    
    // 현재 열에 추가 시 최대 높이 초과하면 새 열 시작
    if (currentHeight + itemHeight > maxHeight && currentColumn.length > 0) {
      columns.push(currentColumn);
      currentColumn = [];
      currentHeight = 0;
    }

    currentColumn.push(item);
    currentHeight += itemHeight;
  });

  // 마지막 열 추가
  if (currentColumn.length > 0) {
    columns.push(currentColumn);
  }

  return columns;
}

/**
 * JourneyTimeline 컴포넌트
 * @param {object} journey - 여정 데이터
 * @param {object} userMappings - 사용자 정의 매핑
 * @param {object} order - 주문 정보
 * @param {Function} findMatchingMapping - 매핑 찾기 함수
 */
export function JourneyTimeline({ journey, userMappings, order, findMatchingMapping }) {
  const measureRef = useRef(null);
  const [columns, setColumns] = useState([]);
  const [isMeasured, setIsMeasured] = useState(false);

  // 페이지 데이터 안정화 (참조 비교용)
  const pages = journey.pages || [];
  const journeyType = journey.type;

  // 모든 아이템 데이터 생성 (메모이제이션)
  const allItems = useMemo(() => 
    buildTimelineItems(pages, journey, userMappings, order, findMatchingMapping),
    [pages.length, journeyType] // 핵심 데이터만 의존성으로
  );

  // 측정 실행 (allItems 변경 시에만)
  useEffect(() => {
    if (!measureRef.current) return;

    // 다음 프레임에서 측정 (렌더링 완료 후)
    const timeoutId = setTimeout(() => {
      const itemElements = measureRef.current?.querySelectorAll('[data-measure-item]');
      if (!itemElements) return;

      const heights = Array.from(itemElements).map(el => el.offsetHeight);
      const newColumns = splitIntoColumnsByHeight(allItems, heights, MAX_COLUMN_HEIGHT);
      setColumns(newColumns);
      setIsMeasured(true);
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [allItems]);

  if (!journey.pages || journey.pages.length === 0) {
    return <Alert message="페이지 이동 기록이 없습니다." type="info" />;
  }

  // 아이템 렌더링 함수
  const renderItemContent = (item) => {
    if (item.type === 'ad') {
      return <AdEntryDivider utmSession={item.utmSession} />;
    }
    if (item.type === 'purchase') {
      return <PurchaseTimelineItem order={item.order} />;
    }
    return (
      <TimelineItemContent
        page={item.page}
        globalIdx={item.globalIdx}
        totalPages={journey.pages.length}
        journeyType={journey.type}
        userMappings={userMappings}
        order={order}
        findMatchingMapping={findMatchingMapping}
      />
    );
  };

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
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px'
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
          <div style={{
            display: 'flex',
            gap: '12px',
            fontSize: '12px',
            color: '#6b7280'
          }}>
            <span>PV: <strong style={{ color: '#374151' }}>{journey.pageCount}</strong></span>
            <span>체류시간: <strong style={{ color: '#374151' }}>{journey.duration}</strong></span>
          </div>
        </div>
      </div>

      {/* 숨겨진 측정용 컨테이너 */}
      <div
        ref={measureRef}
        style={{
          position: 'absolute',
          visibility: 'hidden',
          width: '190px',
          pointerEvents: 'none'
        }}
        aria-hidden="true"
      >
        {allItems.map((item, idx) => (
          <div key={item.key} data-measure-item>
            {renderItemContent(item)}
          </div>
        ))}
      </div>

      {/* 실제 타임라인 */}
      <div 
        style={{ 
          display: 'flex', 
          gap: '15px', 
          alignItems: 'flex-start',
          opacity: isMeasured ? 1 : 0,
          transition: 'opacity 0.15s ease-in-out'
        }}
      >
        {columns.map((columnItems, colIdx) => {
          const timelineItems = columnItems.map(item => ({
            key: item.key,
            color: item.color,
            children: renderItemContent(item)
          }));

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
