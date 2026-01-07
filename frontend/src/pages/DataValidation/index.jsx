import { useState } from 'react';
import { Card, Typography, Row, Col } from 'antd';
import { CheckCircleOutlined, BarChartOutlined, FileTextOutlined, DollarOutlined } from '@ant-design/icons';
import VisitorStatsModal from './VisitorStatsModal';
import PageviewStatsModal from './PageviewStatsModal';
import DailySalesModal from './DailySalesModal';

const { Title, Text } = Typography;

function DataValidation() {
  const [visitorModalOpen, setVisitorModalOpen] = useState(false);
  const [pageviewModalOpen, setPageviewModalOpen] = useState(false);
  const [salesModalOpen, setSalesModalOpen] = useState(false);

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>
        <CheckCircleOutlined style={{ marginRight: '12px' }} />
        데이터 검증
      </Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card
            hoverable
            onClick={() => setVisitorModalOpen(true)}
            style={{ cursor: 'pointer', height: '160px' }}
          >
            <div style={{ textAlign: 'center' }}>
              <BarChartOutlined style={{ fontSize: '36px', color: '#1890ff', marginBottom: '12px' }} />
              <Title level={4} style={{ margin: 0 }}>방문자 통계</Title>
              <Text type="secondary" style={{ fontSize: '13px' }}>
                일별 방문자 수를 확인합니다<br />
                (전체방문, 순방문, 재방문)
              </Text>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card
            hoverable
            onClick={() => setPageviewModalOpen(true)}
            style={{ cursor: 'pointer', height: '160px' }}
          >
            <div style={{ textAlign: 'center' }}>
              <FileTextOutlined style={{ fontSize: '36px', color: '#52c41a', marginBottom: '12px' }} />
              <Title level={4} style={{ margin: 0 }}>페이지뷰 통계</Title>
              <Text type="secondary" style={{ fontSize: '13px' }}>
                디바이스별 페이지뷰를 확인합니다<br />
                (페이지뷰, 처음접속수, 처음접속당PV)
              </Text>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card
            hoverable
            onClick={() => setSalesModalOpen(true)}
            style={{ cursor: 'pointer', height: '160px' }}
          >
            <div style={{ textAlign: 'center' }}>
              <DollarOutlined style={{ fontSize: '36px', color: '#faad14', marginBottom: '12px' }} />
              <Title level={4} style={{ margin: 0 }}>일별 매출 통계</Title>
              <Text type="secondary" style={{ fontSize: '13px' }}>
                일별 매출 현황을 확인합니다<br />
                (주문수, 결제합계, 환불, 순매출)
              </Text>
            </div>
          </Card>
        </Col>
      </Row>

      <VisitorStatsModal
        open={visitorModalOpen}
        onClose={() => setVisitorModalOpen(false)}
      />

      <PageviewStatsModal
        open={pageviewModalOpen}
        onClose={() => setPageviewModalOpen(false)}
      />

      <DailySalesModal
        open={salesModalOpen}
        onClose={() => setSalesModalOpen(false)}
      />
    </div>
  );
}

export default DataValidation;
