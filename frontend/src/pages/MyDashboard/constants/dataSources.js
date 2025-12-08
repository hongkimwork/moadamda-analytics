import { ShoppingCartOutlined, TeamOutlined, SoundOutlined } from '@ant-design/icons';

/**
 * 데이터 소스 정의
 * 대시보드에서 사용할 수 있는 데이터 카테고리
 */
export const DATA_SOURCES = {
  cafe24: {
    id: 'cafe24',
    name: '주문 / 매출',
    icon: <ShoppingCartOutlined style={{ fontSize: 28, color: '#1890ff' }} />,
    description: '오늘 매출, 주문 건수, 상품별 판매 등',
    enabled: true
  },
  tracker: {
    id: 'tracker',
    name: '방문자 분석',
    icon: <TeamOutlined style={{ fontSize: 28, color: '#52c41a' }} />,
    description: '방문자수, 페이지뷰, 유입경로 등',
    enabled: false,
    comingSoon: true
  },
  ad_platforms: {
    id: 'ad_platforms',
    name: '광고 성과',
    icon: <SoundOutlined style={{ fontSize: 28, color: '#722ed1' }} />,
    description: '네이버/메타 광고 성과, ROAS 등',
    enabled: false,
    comingSoon: true
  }
};
