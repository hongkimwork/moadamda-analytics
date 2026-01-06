import { Modal, Table, Typography, Spin, Empty, Statistic, Row, Col, Tag, Tooltip, Tabs, Card, Progress, Popover, Timeline, Divider } from 'antd';
import { ShoppingCartOutlined, DollarOutlined, UserOutlined, AimOutlined, QuestionCircleOutlined, CheckCircleOutlined, CalculatorOutlined, EyeOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';

const { Text, Title } = Typography;
const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * CreativeOrdersModal - 광고 소재별 기여 주문 목록 모달 (기여도 상세 정보 + 계산 검증)
 */
function CreativeOrdersModal({ visible, onClose, creative, dateRange }) {
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState({
    total_orders: 0,
    last_touch_orders: 0,
    last_touch_ratio: 0,
    assist_orders: 0,
    assist_ratio: 0,
    single_touch_orders: 0,
    attributed_revenue: 0,
    last_touch_revenue: 0,
    avg_contribution_rate: 0,
    unique_visitors: 0
  });
  const [verification, setVerification] = useState({
    last_touch_100_percent: { count: 0, revenue: 0 },
    last_touch_50_percent: { count: 0, revenue: 0 },
    assist_contribution: { count: 0, revenue: 0 },
    total_attributed: 0
  });
  const [activeTab, setActiveTab] = useState('orders');

  useEffect(() => {
    if (visible && creative) {
      fetchOrders();
      setActiveTab('orders');
    }
  }, [visible, creative]);

  const fetchOrders = async () => {
    if (!creative || !dateRange) return;
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/creative-performance/orders`, {
        creative_name: creative.creative_name,
        utm_source: creative.utm_source,
        utm_medium: creative.utm_medium,
        utm_campaign: creative.utm_campaign,
        start: dateRange.start,
        end: dateRange.end
      });
      if (response.data.success) {
        setOrders(response.data.data || []);
        setSummary(response.data.summary || {});
        setVerification(response.data.verification || {});
      }
    } catch (error) {
      console.error('주문 목록 조회 실패:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount) return '0원';
    return `${parseInt(amount).toLocaleString()}원`;
  };

  // 광고 여정 팝오버 내용
  const JourneyPopover = ({ journey, finalPayment }) => {
    if (!journey || journey.length === 0) return <Text type="secondary">여정 정보 없음</Text>;
    
    const lastTouchCreative = journey.find(j => j.is_last_touch);
    const assistCreatives = journey.filter(j => !j.is_last_touch);
    const assistCount = assistCreatives.length;
    
    return (
      <div style={{ maxWidth: 400, padding: '8px 0' }}>
        <Title level={5} style={{ marginBottom: 12, fontSize: 14 }}>광고 여정 ({journey.length}개 광고)</Title>
        <Timeline style={{ marginBottom: 16 }}>
          {journey.map((item, idx) => (
            <Timeline.Item 
              key={idx}
              color={item.is_target ? 'blue' : item.is_last_touch ? 'green' : 'gray'}
              dot={item.is_last_touch ? <AimOutlined style={{ fontSize: 14 }} /> : null}
            >
              <div style={{ 
                background: item.is_target ? '#e6f4ff' : 'transparent',
                padding: item.is_target ? '6px 10px' : '2px 0',
                borderRadius: 6,
                border: item.is_target ? '1px solid #91caff' : 'none'
              }}>
                <div style={{ fontWeight: item.is_target ? 600 : 400, fontSize: 13 }}>
                  {item.order}. {item.creative_name}
                  {item.is_target && <Tag color="blue" style={{ marginLeft: 6, fontSize: 10 }}>현재 광고</Tag>}
                  {item.is_last_touch && <Tag color="green" style={{ marginLeft: 6, fontSize: 10 }}>막타</Tag>}
                </div>
                <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>
                  {item.utm_source} · {dayjs(item.timestamp).format('MM/DD HH:mm')}
                </div>
              </div>
            </Timeline.Item>
          ))}
          <Timeline.Item color="gold" dot={<ShoppingCartOutlined style={{ fontSize: 14 }} />}>
            <div style={{ fontWeight: 600, color: '#d48806' }}>
              구매 완료: {formatCurrency(finalPayment)}
            </div>
          </Timeline.Item>
        </Timeline>
        
        <Divider style={{ margin: '12px 0' }} />
        <Title level={5} style={{ marginBottom: 8, fontSize: 13 }}>기여도 분배</Title>
        <div style={{ fontSize: 12 }}>
          {journey.map((item, idx) => {
            let contribution = 0;
            let percent = 0;
            if (item.is_last_touch) {
              percent = assistCount === 0 ? 100 : 50;
              contribution = finalPayment * (percent / 100);
            } else {
              percent = assistCount > 0 ? Math.round((50 / assistCount) * 10) / 10 : 0;
              contribution = finalPayment * 0.5 / assistCount;
            }
            return (
              <div key={idx} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                padding: '4px 0',
                background: item.is_target ? '#f0f5ff' : 'transparent',
                borderRadius: 4,
                paddingLeft: item.is_target ? 8 : 0,
                paddingRight: item.is_target ? 8 : 0
              }}>
                <span style={{ fontWeight: item.is_target ? 600 : 400 }}>
                  {item.creative_name.length > 20 ? item.creative_name.slice(0, 20) + '...' : item.creative_name}
                  <Tag color={item.is_last_touch ? 'green' : 'default'} style={{ marginLeft: 4, fontSize: 10 }}>
                    {item.is_last_touch ? '막타' : '어시'}
                  </Tag>
                </span>
                <span style={{ fontWeight: item.is_target ? 600 : 400, color: item.is_target ? '#1677ff' : 'inherit' }}>
                  {formatCurrency(Math.round(contribution))} ({percent}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // 주문 목록 테이블 컬럼
  const columns = [
    {
      title: '주문번호',
      dataIndex: 'order_id',
      key: 'order_id',
      width: 140,
      align: 'center',
      render: (text) => (
        <Text copyable={{ text }} style={{ fontFamily: 'monospace', fontSize: 11 }}>{text}</Text>
      )
    },
    {
      title: '주문일시',
      dataIndex: 'order_date',
      key: 'order_date',
      width: 100,
      align: 'center',
      render: (date) => <Text style={{ fontSize: 12 }}>{dayjs(date).format('MM-DD HH:mm')}</Text>
    },
    {
      title: (
        <Tooltip title="이 광고를 마지막으로 본 날짜 (구매 전 30일 이내)">
          <span>광고 노출일 <QuestionCircleOutlined style={{ fontSize: 11, color: '#8c8c8c' }} /></span>
        </Tooltip>
      ),
      key: 'target_ad_date',
      width: 100,
      align: 'center',
      render: (_, record) => {
        const targetTouch = record.journey?.find(j => j.is_target);
        if (!targetTouch) return <Text type="secondary">-</Text>;
        return <Text style={{ fontSize: 12, color: '#1677ff' }}>{dayjs(targetTouch.timestamp).format('MM-DD HH:mm')}</Text>;
      }
    },
    {
      title: '결제금액',
      dataIndex: 'final_payment',
      key: 'final_payment',
      width: 100,
      align: 'center',
      render: (amount) => <Text strong style={{ fontSize: 13 }}>{formatCurrency(amount)}</Text>
    },
    {
      title: (
        <Tooltip title="이 광고가 해당 주문에서 수행한 역할">
          <span>역할 <QuestionCircleOutlined style={{ fontSize: 11, color: '#8c8c8c' }} /></span>
        </Tooltip>
      ),
      dataIndex: 'role',
      key: 'role',
      width: 90,
      align: 'center',
      render: (role, record) => {
        const color = role === '막타(순수)' ? 'gold' : role === '막타' ? 'blue' : 'default';
        return <Tag color={color} style={{ margin: 0 }}>{role}</Tag>;
      }
    },
    {
      title: (
        <Tooltip title="고객이 구매 전 본 고유 광고 개수">
          <span>여정 광고 <QuestionCircleOutlined style={{ fontSize: 11, color: '#8c8c8c' }} /></span>
        </Tooltip>
      ),
      dataIndex: 'journey_creative_count',
      key: 'journey_creative_count',
      width: 80,
      align: 'center',
      render: (count) => <Tag color="purple">{count}개</Tag>
    },
    {
      title: (
        <Tooltip title="이 광고가 해당 주문에서 기여한 비율">
          <span>기여율 <QuestionCircleOutlined style={{ fontSize: 11, color: '#8c8c8c' }} /></span>
        </Tooltip>
      ),
      dataIndex: 'contribution_rate',
      key: 'contribution_rate',
      width: 80,
      align: 'center',
      render: (rate) => (
        <Text style={{ color: rate === 100 ? '#d48806' : rate >= 50 ? '#1677ff' : '#8c8c8c', fontWeight: rate >= 50 ? 600 : 400 }}>
          {rate}%
        </Text>
      )
    },
    {
      title: (
        <Tooltip title="결제금액 × 기여율">
          <span>기여 금액 <QuestionCircleOutlined style={{ fontSize: 11, color: '#8c8c8c' }} /></span>
        </Tooltip>
      ),
      dataIndex: 'attributed_amount',
      key: 'attributed_amount',
      width: 100,
      align: 'center',
      render: (amount) => <Text strong style={{ color: '#52c41a', fontSize: 13 }}>{formatCurrency(amount)}</Text>
    },
    {
      title: '광고 여정',
      key: 'journey',
      width: 80,
      align: 'center',
      render: (_, record) => (
        <Popover 
          content={<JourneyPopover journey={record.journey} finalPayment={record.final_payment} />}
          title={null}
          trigger="click"
          placement="left"
          overlayStyle={{ maxWidth: 450 }}
        >
          <Tag color="cyan" style={{ cursor: 'pointer' }}>
            <EyeOutlined /> 보기
          </Tag>
        </Popover>
      )
    }
  ];

  // 기여 주문 탭 내용
  const OrdersTab = () => (
    <>
      {/* 요약 통계 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        <Col span={4}>
          <Card size="small" style={{ textAlign: 'center', background: '#fafafa' }}>
            <Statistic
              title={<span style={{ fontSize: 11 }}>영향준 주문</span>}
              value={summary.total_orders}
              suffix="건"
              valueStyle={{ fontSize: 18, fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small" style={{ textAlign: 'center', background: '#f0f5ff' }}>
            <Statistic
              title={<span style={{ fontSize: 11 }}>막타 주문</span>}
              value={summary.last_touch_orders}
              suffix={<span style={{ fontSize: 12 }}>건 ({summary.last_touch_ratio}%)</span>}
              valueStyle={{ fontSize: 18, fontWeight: 600, color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small" style={{ textAlign: 'center', background: '#fff7e6' }}>
            <Statistic
              title={<span style={{ fontSize: 11 }}>어시 주문</span>}
              value={summary.assist_orders}
              suffix={<span style={{ fontSize: 12 }}>건 ({summary.assist_ratio}%)</span>}
              valueStyle={{ fontSize: 18, fontWeight: 600, color: '#d48806' }}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small" style={{ textAlign: 'center', background: '#f6ffed' }}>
            <Statistic
              title={<span style={{ fontSize: 11 }}>기여한 매출액</span>}
              value={summary.attributed_revenue}
              suffix="원"
              valueStyle={{ fontSize: 18, fontWeight: 600, color: '#52c41a' }}
              formatter={(value) => parseInt(value).toLocaleString()}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small" style={{ textAlign: 'center', background: '#e6f4ff' }}>
            <Statistic
              title={<span style={{ fontSize: 11 }}>막타 결제액</span>}
              value={summary.last_touch_revenue}
              suffix="원"
              valueStyle={{ fontSize: 18, fontWeight: 600, color: '#0958d9' }}
              formatter={(value) => parseInt(value).toLocaleString()}
            />
          </Card>
        </Col>
      </Row>

      {/* 추가 지표 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        <Col span={8}>
          <Card size="small">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#8c8c8c' }}>순수 전환 (이 광고만 보고 구매)</span>
              <Text strong style={{ color: '#d48806' }}>{summary.single_touch_orders}건</Text>
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#8c8c8c' }}>평균 기여율</span>
              <Text strong style={{ color: '#1677ff' }}>{summary.avg_contribution_rate}%</Text>
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#8c8c8c' }}>유입 방문자</span>
              <Text strong>{summary.unique_visitors}명</Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 주문 목록 테이블 */}
      {orders.length > 0 ? (
        <Table
          columns={columns}
          dataSource={orders}
          rowKey="order_id"
          size="small"
          pagination={{ pageSize: 10, showTotal: (total) => `총 ${total}건`, showSizeChanger: false }}
          scroll={{ x: 900 }}
        />
      ) : !loading && (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="해당 광고 소재로 발생한 주문이 없습니다" />
      )}
    </>
  );

  // 계산 검증 탭 내용
  const VerificationTab = () => (
    <div style={{ padding: '0 12px' }}>
      {/* 기여한 매출액 검증 */}
      <Card 
        title={<span><CalculatorOutlined style={{ marginRight: 8 }} />기여한 매출액 검증</span>}
        size="small"
        style={{ marginBottom: 16 }}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#fffbe6', borderRadius: 6, marginBottom: 8 }}>
            <span>
              <Tag color="gold">막타 100%</Tag>
              {verification.last_touch_100_percent?.description}
            </span>
            <span>
              <Text strong>{verification.last_touch_100_percent?.count}건</Text>
              <Text style={{ marginLeft: 12 }}>{formatCurrency(verification.last_touch_100_percent?.revenue)}</Text>
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#e6f4ff', borderRadius: 6, marginBottom: 8 }}>
            <span>
              <Tag color="blue">막타 50%</Tag>
              {verification.last_touch_50_percent?.description}
            </span>
            <span>
              <Text strong>{verification.last_touch_50_percent?.count}건</Text>
              <Text style={{ marginLeft: 12 }}>{formatCurrency(verification.last_touch_50_percent?.revenue)}</Text>
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f5f5f5', borderRadius: 6, marginBottom: 8 }}>
            <span>
              <Tag color="default">어시 기여</Tag>
              {verification.assist_contribution?.description}
            </span>
            <span>
              <Text strong>{verification.assist_contribution?.count}건</Text>
              <Text style={{ marginLeft: 12 }}>{formatCurrency(verification.assist_contribution?.revenue)}</Text>
            </span>
          </div>
          <Divider style={{ margin: '12px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f6ffed', borderRadius: 6 }}>
            <span><CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} /><Text strong>기여한 매출액 합계</Text></span>
            <Text strong style={{ color: '#52c41a', fontSize: 16 }}>{formatCurrency(verification.total_attributed)}</Text>
          </div>
        </div>
        <div style={{ background: '#fafafa', padding: 12, borderRadius: 6, fontSize: 12 }}>
          <Text type="secondary">
            <InfoCircleOutlined style={{ marginRight: 6 }} />
            {verification.formula}
          </Text>
        </div>
      </Card>

      {/* 영향준 주문 수 검증 */}
      <Card 
        title={<span><ShoppingCartOutlined style={{ marginRight: 8 }} />영향준 주문 수 검증</span>}
        size="small"
        style={{ marginBottom: 16 }}
      >
        <Row gutter={16}>
          <Col span={8}>
            <div style={{ textAlign: 'center', padding: 16, background: '#f0f5ff', borderRadius: 8 }}>
              <div style={{ fontSize: 24, fontWeight: 600, color: '#1677ff' }}>{summary.last_touch_orders}</div>
              <div style={{ fontSize: 12, color: '#8c8c8c' }}>막타 주문</div>
            </div>
          </Col>
          <Col span={2} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 20 }}>+</Text>
          </Col>
          <Col span={8}>
            <div style={{ textAlign: 'center', padding: 16, background: '#fff7e6', borderRadius: 8 }}>
              <div style={{ fontSize: 24, fontWeight: 600, color: '#d48806' }}>{summary.assist_orders}</div>
              <div style={{ fontSize: 12, color: '#8c8c8c' }}>어시 주문</div>
            </div>
          </Col>
          <Col span={2} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 20 }}>=</Text>
          </Col>
          <Col span={4}>
            <div style={{ textAlign: 'center', padding: 16, background: '#f6ffed', borderRadius: 8 }}>
              <div style={{ fontSize: 24, fontWeight: 600, color: '#52c41a' }}>{summary.total_orders}</div>
              <div style={{ fontSize: 12, color: '#8c8c8c' }}>합계</div>
            </div>
          </Col>
        </Row>
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 12 }}>막타 비율</Text>
            <Progress percent={summary.last_touch_ratio} strokeColor="#1677ff" size="small" />
          </div>
          <div>
            <Text style={{ fontSize: 12 }}>어시 비율</Text>
            <Progress percent={summary.assist_ratio} strokeColor="#d48806" size="small" />
          </div>
        </div>
      </Card>

      {/* 계산 방식 안내 */}
      <Card 
        title={<span><QuestionCircleOutlined style={{ marginRight: 8 }} />기여도 계산 방식</span>}
        size="small"
      >
        <div style={{ fontSize: 13, lineHeight: 2 }}>
          <div style={{ padding: '8px 12px', background: '#fffbe6', borderRadius: 6, marginBottom: 8 }}>
            <Text strong>광고 1개만 보고 구매</Text>
            <br />
            → 해당 광고가 <Text strong style={{ color: '#d48806' }}>100% 기여</Text>
          </div>
          <div style={{ padding: '8px 12px', background: '#e6f4ff', borderRadius: 6, marginBottom: 8 }}>
            <Text strong>여러 광고를 보고 구매</Text>
            <br />
            → 막타(마지막 광고): <Text strong style={{ color: '#1677ff' }}>50% 기여</Text>
            <br />
            → 어시(나머지 광고들): <Text strong>50%를 균등 분배</Text>
          </div>
          <div style={{ padding: '8px 12px', background: '#f5f5f5', borderRadius: 6 }}>
            <Text strong>예시: 고객이 100만원 구매, 광고 A→B→C 순서로 봄</Text>
            <br />
            → 광고 A (어시): 25만원 (50% ÷ 2)
            <br />
            → 광고 B (어시): 25만원 (50% ÷ 2)
            <br />
            → 광고 C (막타): 50만원 (50%)
          </div>
        </div>
      </Card>
    </div>
  );

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShoppingCartOutlined style={{ fontSize: 20, color: '#1890ff' }} />
          <span>광고 소재 기여 주문 상세</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={1000}
      style={{ top: '2.5vh' }}
      styles={{ body: { padding: '16px 24px', height: 'calc(95vh - 60px)', overflowY: 'auto' } }}
    >
      {/* 광고 소재 정보 */}
      {creative && (
        <div style={{ marginBottom: 16, padding: '12px 16px', background: 'linear-gradient(135deg, #f0f5ff 0%, #e6f4ff 100%)', borderRadius: 8, border: '1px solid #d6e4ff' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#1d39c4', marginBottom: 8 }}>{creative.creative_name}</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Tag color="blue">{creative.utm_source}</Tag>
            <Tag color="cyan">{creative.utm_medium}</Tag>
            <Tag color="purple">{creative.utm_campaign}</Tag>
          </div>
        </div>
      )}

      <Spin spinning={loading}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            { key: 'orders', label: <span><ShoppingCartOutlined /> 기여 주문</span>, children: <OrdersTab /> },
            { key: 'verification', label: <span><CalculatorOutlined /> 계산 검증</span>, children: <VerificationTab /> }
          ]}
        />
      </Spin>

      {dateRange && (
        <div style={{ marginTop: 16, textAlign: 'center', color: '#8c8c8c', fontSize: 12 }}>
          조회 기간: {dateRange.start} ~ {dateRange.end}
        </div>
      )}
    </Modal>
  );
}

export default CreativeOrdersModal;
