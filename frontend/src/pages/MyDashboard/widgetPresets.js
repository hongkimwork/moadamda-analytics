// ============================================================================
// 위젯 프리셋 정의 (Cafe24 주문/매출, 전환 퍼널)
// ============================================================================
export const WIDGET_PRESETS = {
  cafe24: {
    kpi: [
      {
        id: 'total_revenue',
        label: '총 매출',
        icon: '💵',
        description: '선택 기간의 총 매출액',
        type: 'kpi',
        apiEndpoint: '/api/stats/range',
        dataKey: 'revenue.final',
        suffix: '원',
        defaultWidth: 'small',
        defaultHeight: 'short'
      },
      {
        id: 'order_count',
        label: '주문 건수',
        icon: '📦',
        description: '선택 기간의 총 주문 수',
        type: 'kpi',
        apiEndpoint: '/api/stats/range',
        dataKey: 'orders.count',
        suffix: '건',
        defaultWidth: 'small',
        defaultHeight: 'short'
      },
      {
        id: 'aov',
        label: '평균 주문금액',
        icon: '💳',
        description: '주문 1건당 평균 결제 금액',
        type: 'kpi',
        apiEndpoint: '/api/stats/range',
        dataKey: 'orders.final_aov',
        suffix: '원',
        defaultWidth: 'small',
        defaultHeight: 'short'
      }
    ],
    chart: [
      {
        id: 'period_revenue_compare',
        label: '기간별 매출 비교',
        icon: '📊',
        description: '선택 기간 vs 이전 기간 매출 비교',
        type: 'period_compare',
        apiEndpoint: '/api/stats/range',
        dataKey: 'revenue.final',
        defaultWidth: 'medium',
        defaultHeight: 'medium'
      },
      {
        id: 'order_place_revenue',
        label: '주문경로별 매출',
        icon: '📊',
        description: '네이버페이, PC쇼핑몰 등 경로별 비교',
        type: 'bar',
        apiEndpoint: '/api/stats/orders',
        dataKey: 'by_order_place',
        defaultWidth: 'medium',
        defaultHeight: 'medium'
      }
    ],
    list: [
      {
        id: 'top_products',
        label: '상품별 판매순위',
        icon: '🏆',
        description: '가장 많이 팔린 상품 순위',
        type: 'table',
        apiEndpoint: '/api/stats/orders',
        dataKey: 'by_product',
        defaultWidth: 'medium',
        defaultHeight: 'tall'
      }
    ]
  },
  funnel: {
    chart: [
      {
        id: 'conversion_funnel',
        label: '전체 전환 퍼널',
        icon: '📊',
        description: '모든 채널을 합산한 전체 퍼널',
        type: 'conversion_funnel',
        apiEndpoint: '/api/stats/funnel/conversion',
        dataKey: 'funnel',
        defaultWidth: 'medium',
        defaultHeight: 'tall'
      },
      {
        id: 'channel_funnel_chart',
        label: '채널별 전환 퍼널',
        icon: '📊',
        description: '특정 채널의 방문→장바구니→결제→구매 단계 분석',
        type: 'channel_funnel',
        apiEndpoint: '/api/stats/channel-funnel/single',
        dataKey: 'funnel',
        defaultWidth: 'medium',
        defaultHeight: 'tall',
        requiresChannel: true  // 채널 선택 필수
      }
    ]
  }
};
