/**
 * 페이지 경로 데이터를 React Flow 노드/엣지로 변환
 * Moadamda Analytics - Customer Journey Flow Converter
 */

import { urlToKorean } from './urlToKorean';

/**
 * 페이지 타입별 색상 정의
 */
const PAGE_TYPE_COLORS = {
  entry: { bg: '#dcfce7', border: '#22c55e', text: '#166534' },      // 진입 (초록)
  product: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },    // 상품 (주황)
  cart: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },       // 장바구니 (파랑)
  order: { bg: '#e0e7ff', border: '#6366f1', text: '#3730a3' },      // 주문서 (인디고)
  login: { bg: '#f3e8ff', border: '#a855f7', text: '#6b21a8' },      // 로그인 (보라)
  purchase: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },   // 구매완료 (빨강)
  default: { bg: '#f3f4f6', border: '#9ca3af', text: '#374151' }     // 기타 (회색)
};

/**
 * URL 패턴으로 페이지 타입 결정
 */
function getPageType(pageUrl) {
  if (/\/order\/order_result\.html/.test(pageUrl)) return 'purchase';
  if (/\/order\/orderform\.html/.test(pageUrl)) return 'order';
  if (/\/order\/basket\.html/.test(pageUrl)) return 'cart';
  if (/\/member\/login\.html/.test(pageUrl)) return 'login';
  if (/\/surl\/[Pp]\/\d+/.test(pageUrl) || /\/product\/.+\/\d+\//.test(pageUrl)) return 'product';
  return 'default';
}

/**
 * 체류 시간을 포맷팅
 */
function formatTimeSpent(seconds) {
  if (!seconds || seconds === 0) return '';
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}분 ${secs}초`;
  }
  return `${seconds}초`;
}

/**
 * 페이지 경로 데이터를 React Flow 형식으로 변환
 * @param {Array} pagePath - 페이지 경로 배열
 * @param {boolean} useKoreanNames - 한글 이름 사용 여부
 * @returns {Object} { nodes, edges }
 */
export function convertPagePathToFlow(pagePath, useKoreanNames = true) {
  if (!pagePath || pagePath.length === 0) {
    return { nodes: [], edges: [] };
  }

  const nodes = [];
  const edges = [];
  const horizontalSpacing = 280; // 노드 간 가로 간격
  const verticalSpacing = 100;   // 세로 간격

  pagePath.forEach((page, index) => {
    const urlInfo = urlToKorean(page.page_url);
    const pageType = index === 0 ? 'entry' : 
                     index === pagePath.length - 1 ? 'purchase' : 
                     getPageType(page.page_url);
    const colors = PAGE_TYPE_COLORS[pageType];

    // 노드 라벨 생성
    let label = '';
    if (index === 0) {
      label = '🚪 진입';
    } else if (index === pagePath.length - 1) {
      label = '✅ 구매 완료';
    } else {
      label = `${index}단계`;
    }

    // 페이지 이름 결정
    const pageName = useKoreanNames ? urlInfo.name : page.page_url;
    // 상품명은 상품 상세 페이지(pageType === 'product')일 때만 표시
    const productName = pageType === 'product' && page.page_title && page.page_title !== '모아담다 온라인 공식몰' 
      ? page.page_title 
      : null;

    // 노드 생성
    nodes.push({
      id: `node-${index}`,
      type: 'default',
      data: {
        label: (
          <div style={{ padding: '8px', textAlign: 'center' }}>
            <div style={{ 
              fontWeight: 'bold', 
              fontSize: '13px', 
              marginBottom: '6px',
              color: colors.text
            }}>
              {label}
            </div>
            {productName && (
              <div style={{ 
                fontSize: '12px', 
                fontWeight: '600',
                color: '#f97316',
                marginBottom: '4px'
              }}>
                📦 {productName}
              </div>
            )}
            <div style={{ 
              fontSize: '11px', 
              color: '#64748b',
              maxWidth: '200px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {useKoreanNames ? urlInfo.icon + ' ' + urlInfo.name : page.page_url}
            </div>
            {page.time_spent_seconds > 0 && (
              <div style={{ 
                marginTop: '6px',
                fontSize: '12px',
                fontWeight: '600',
                color: page.time_spent_seconds >= 60 ? '#dc2626' : '#3b82f6'
              }}>
                ⏱️ {formatTimeSpent(page.time_spent_seconds)}
              </div>
            )}
          </div>
        )
      },
      position: { 
        x: index * horizontalSpacing, 
        y: 0 
      },
      style: {
        background: colors.bg,
        border: `2px solid ${colors.border}`,
        borderRadius: '12px',
        padding: '10px',
        minWidth: '220px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }
    });

    // 엣지 생성 (다음 노드와 연결)
    if (index < pagePath.length - 1) {
      const timeLabel = page.time_spent_seconds > 0 
        ? formatTimeSpent(page.time_spent_seconds)
        : '';
      
      edges.push({
        id: `edge-${index}-${index + 1}`,
        source: `node-${index}`,
        target: `node-${index + 1}`,
        label: timeLabel,
        type: 'smoothstep',
        animated: true,
        style: { 
          stroke: '#94a3b8', 
          strokeWidth: 2 
        },
        labelStyle: {
          fontSize: '11px',
          fontWeight: '600',
          fill: '#475569',
          background: '#fff',
          padding: '4px 8px',
          borderRadius: '4px'
        },
        labelBgStyle: {
          fill: '#ffffff',
          fillOpacity: 0.9
        }
      });
    }
  });

  return { nodes, edges };
}

/**
 * 플로우차트 통계 계산
 */
export function calculateFlowStats(pagePath) {
  if (!pagePath || pagePath.length === 0) {
    return {
      totalPages: 0,
      totalTime: 0,
      averageTime: 0,
      longestPage: null
    };
  }

  const totalTime = pagePath.reduce((sum, p) => sum + (p.time_spent_seconds || 0), 0);
  const longestPage = pagePath.reduce((max, p) => 
    (p.time_spent_seconds || 0) > (max.time_spent_seconds || 0) ? p : max,
    { time_spent_seconds: 0 }
  );

  return {
    totalPages: pagePath.length,
    totalTime,
    averageTime: Math.round(totalTime / pagePath.length),
    longestPage: longestPage.time_spent_seconds > 0 ? longestPage : null
  };
}

