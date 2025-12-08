/**
 * 위젯 프리셋 정의
 * 데이터 소스별로 사용 가능한 위젯 템플릿
 */
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
        id: 'daily_revenue',
        label: '일별 매출 추이',
        icon: '📈',
        description: '날짜별 매출 변화 그래프',
        type: 'line',
        apiEndpoint: '/api/stats/daily',
        dataKey: 'daily',
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
        id: 'recent_orders',
        label: '최근 주문 목록',
        icon: '📋',
        description: '최근 주문 내역 상세 보기',
        type: 'table',
        apiEndpoint: '/api/stats/orders',
        dataKey: 'orders',
        defaultWidth: 'large',
        defaultHeight: 'tall'
      },
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
  }
};
