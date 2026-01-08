import { Typography } from 'antd';
import { BarChartOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

function AdPerformance() {
  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>
        <BarChartOutlined style={{ marginRight: '12px' }} />
        광고 성과 분석
      </Title>
      <Text type="secondary">
        광고 성과를 분석하는 페이지입니다.
      </Text>
    </div>
  );
}

export default AdPerformance;
