import { Modal, Table, Typography, Spin, Empty, Statistic, Row, Col, Tag, Tooltip, Card } from 'antd';
import { ShoppingCartOutlined, QuestionCircleOutlined, EyeOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import { OrderDetailPageContent } from '../pages/OrderAnalysis/OrderDetailPage';
import { useUserMappings } from '../hooks/useUserMappings';

const { Text, Title } = Typography;
const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * 광고 노출일시와 노출→구매 간격 계산
 * @param {Object} order - 주문 데이터 (journey 포함)
 * @param {Object} dateRange - 조회 기간 { start, end }
 * @returns {Object} { exposureDate, daysDiff, isOutOfRange }
 */
function getExposureInfo(order, dateRange) {
  if (!order.journey || order.journey.length === 0) {
    return { exposureDate: null, daysDiff: null, isOutOfRange: false };
  }
  
  // journey에서 is_target === true인 항목 찾기 (현재 조회 중인 광고)
  const targetTouch = order.journey.find(j => j.is_target);
  if (!targetTouch || !targetTouch.timestamp) {
    return { exposureDate: null, daysDiff: null, isOutOfRange: false };
  }
  
  const exposureDate = dayjs(targetTouch.timestamp);
  const orderDate = dayjs(order.order_date);
  const daysDiff = orderDate.diff(exposureDate, 'day');
  
  // 조회 기간 밖 노출 여부 확인
  const rangeStart = dateRange?.start ? dayjs(dateRange.start).startOf('day') : null;
  const rangeEnd = dateRange?.end ? dayjs(dateRange.end).endOf('day') : null;
  const isOutOfRange = rangeStart && rangeEnd && 
    (exposureDate.isBefore(rangeStart) || exposureDate.isAfter(rangeEnd));
  
  return { exposureDate, daysDiff, isOutOfRange };
}

/**
 * CreativeOrdersModal - 광고 소재별 기여 주문 목록 모달
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
  
  // 고객 여정 분석 모달 state
  const [journeyModalVisible, setJourneyModalVisible] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const { userMappings } = useUserMappings();

  useEffect(() => {
    if (visible && creative) {
      fetchOrders();
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

  // 주문 목록 테이블 컬럼
  const columns = [
    {
      title: '주문번호',
      dataIndex: 'order_id',
      key: 'order_id',
      width: 130,
      align: 'center',
      render: (text) => (
        <Text copyable={{ text }} style={{ fontFamily: 'monospace', fontSize: 11 }}>{text}</Text>
      )
    },
    {
      title: (
        <Tooltip title="이 광고를 언제 봤는지 (조회 기간 밖이면 파란색 표시)">
          <span>광고 노출일 <QuestionCircleOutlined style={{ fontSize: 11, color: '#8c8c8c' }} /></span>
        </Tooltip>
      ),
      key: 'exposure_date',
      width: 110,
      align: 'center',
      render: (_, record) => {
        const { exposureDate, isOutOfRange } = getExposureInfo(record, dateRange);
        if (!exposureDate) return <Text type="secondary">-</Text>;
        return (
          <div>
            <Text style={{ 
              fontSize: 12, 
              color: isOutOfRange ? '#1677ff' : 'inherit',
              fontWeight: isOutOfRange ? 600 : 400
            }}>
              {exposureDate.format('MM-DD HH:mm')}
            </Text>
            {isOutOfRange && (
              <Tooltip title="조회 기간 밖에서 광고를 봤지만, 구매일 기준 30일 이내이므로 기여로 인정됨">
                <ExclamationCircleOutlined style={{ marginLeft: 4, color: '#1677ff', fontSize: 11 }} />
              </Tooltip>
            )}
          </div>
        );
      }
    },
    {
      title: (
        <Tooltip title="광고를 본 후 구매까지 걸린 시간">
          <span>노출→구매 <QuestionCircleOutlined style={{ fontSize: 11, color: '#8c8c8c' }} /></span>
        </Tooltip>
      ),
      key: 'days_diff',
      width: 85,
      align: 'center',
      render: (_, record) => {
        const { daysDiff, isOutOfRange } = getExposureInfo(record, dateRange);
        if (daysDiff === null) return <Text type="secondary">-</Text>;
        
        let label = '';
        let color = 'default';
        if (daysDiff === 0) {
          label = '당일';
          color = 'green';
        } else if (daysDiff <= 3) {
          label = `${daysDiff}일 전`;
          color = 'cyan';
        } else if (daysDiff <= 7) {
          label = `${daysDiff}일 전`;
          color = 'blue';
        } else {
          label = `${daysDiff}일 전`;
          color = isOutOfRange ? 'purple' : 'default';
        }
        return <Tag color={color} style={{ margin: 0 }}>{label}</Tag>;
      }
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
      title: '결제금액',
      dataIndex: 'final_payment',
      key: 'final_payment',
      width: 95,
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
      width: 85,
      align: 'center',
      render: (role, record) => {
        const color = role === '막타(순수)' ? 'gold' : role === '막타' ? 'blue' : 'default';
        return <Tag color={color} style={{ margin: 0 }}>{role}</Tag>;
      }
    },
    {
      title: (
        <Tooltip title="고객이 구매 전 본 고유 광고 개수">
          <span>여정 <QuestionCircleOutlined style={{ fontSize: 11, color: '#8c8c8c' }} /></span>
        </Tooltip>
      ),
      dataIndex: 'journey_creative_count',
      key: 'journey_creative_count',
      width: 65,
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
      width: 70,
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
          <span>기여금액 <QuestionCircleOutlined style={{ fontSize: 11, color: '#8c8c8c' }} /></span>
        </Tooltip>
      ),
      dataIndex: 'attributed_amount',
      key: 'attributed_amount',
      width: 95,
      align: 'center',
      render: (amount) => <Text strong style={{ color: '#52c41a', fontSize: 13 }}>{formatCurrency(amount)}</Text>
    },
    {
      title: '여정상세',
      key: 'journey',
      width: 75,
      align: 'center',
      render: (_, record) => (
        <Tag 
          color="cyan" 
          style={{ cursor: 'pointer' }}
          onClick={() => {
            setSelectedOrderId(record.order_id);
            setJourneyModalVisible(true);
          }}
        >
          <EyeOutlined /> 보기
        </Tag>
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
          scroll={{ x: false }}
        />
      ) : !loading && (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="해당 광고 소재로 발생한 주문이 없습니다" />
      )}
    </>
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
      width={1350}
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
        <OrdersTab />
      </Spin>

      {dateRange && (
        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 12 }}>
          <div style={{ color: '#8c8c8c', marginBottom: 4 }}>
            조회 기간: {dateRange.start} ~ {dateRange.end}
          </div>
          <div style={{ color: '#1677ff', fontSize: 11 }}>
            <ExclamationCircleOutlined style={{ marginRight: 4 }} />
            파란색 날짜: 조회 기간 밖에서 광고를 봤지만, 구매일 기준 30일 이내이므로 기여로 인정
          </div>
        </div>
      )}

      {/* 고객 여정 분석 모달 */}
      <Modal
        open={journeyModalVisible}
        onCancel={() => {
          setJourneyModalVisible(false);
          setSelectedOrderId(null);
        }}
        footer={null}
        width="95vw"
        style={{ top: '2.5vh' }}
        styles={{ body: { padding: 0, height: 'calc(95vh - 55px)', overflow: 'hidden' } }}
        destroyOnClose
      >
        {selectedOrderId && (
          <OrderDetailPageContent
            orderId={selectedOrderId}
            userMappings={userMappings}
            onClose={() => {
              setJourneyModalVisible(false);
              setSelectedOrderId(null);
            }}
          />
        )}
      </Modal>
    </Modal>
  );
}

export default CreativeOrdersModal;
