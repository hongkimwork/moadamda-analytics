import {
  NumberOutlined,
  LineChartOutlined,
  BarChartOutlined,
  TableOutlined,
  FundOutlined,
  FileTextOutlined
} from '@ant-design/icons';

/**
 * 위젯 타입 정의
 * 사용자가 추가할 수 있는 위젯의 종류와 기본 설정
 */
export const WIDGET_TYPES = [
  {
    key: 'kpi',
    icon: <NumberOutlined style={{ fontSize: 24, color: '#1890ff' }} />,
    label: 'KPI 숫자',
    description: '핵심 지표를 큰 숫자로 표시',
    defaultWidth: 'small',
    defaultHeight: 'short'
  },
  {
    key: 'line',
    icon: <LineChartOutlined style={{ fontSize: 24, color: '#52c41a' }} />,
    label: '라인 차트',
    description: '시간에 따른 추이 표시',
    defaultWidth: 'medium',
    defaultHeight: 'medium'
  },
  {
    key: 'bar',
    icon: <BarChartOutlined style={{ fontSize: 24, color: '#722ed1' }} />,
    label: '바 차트',
    description: '항목별 비교 분석',
    defaultWidth: 'medium',
    defaultHeight: 'medium'
  },
  {
    key: 'table',
    icon: <TableOutlined style={{ fontSize: 24, color: '#fa8c16' }} />,
    label: '테이블',
    description: '상세 데이터 목록',
    defaultWidth: 'large',
    defaultHeight: 'tall'
  },
  {
    key: 'funnel',
    icon: <FundOutlined style={{ fontSize: 24, color: '#eb2f96' }} />,
    label: '퍼널',
    description: '단계별 전환율 표시',
    defaultWidth: 'small',
    defaultHeight: 'medium'
  },
  {
    key: 'text',
    icon: <FileTextOutlined style={{ fontSize: 24, color: '#8c8c8c' }} />,
    label: '텍스트',
    description: '제목이나 설명 추가',
    defaultWidth: 'large',
    defaultHeight: 'short'
  }
];
