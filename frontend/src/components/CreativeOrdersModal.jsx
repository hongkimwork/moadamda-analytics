import { Modal, Table, Typography, Spin, Empty, Statistic, Row, Col, Tag, Tooltip } from 'antd';
import { ShoppingCartOutlined, DollarOutlined, UserOutlined, ShoppingOutlined, AimOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';

const { Text } = Typography;
const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * CreativeOrdersModal - 광고 소재별 주문 목록 모달
 * (테이블의 contributed_orders_count와 동일한 기여도 기반 주문만 표시)
 *
 * @param {boolean} visible - 모달 표시 여부
 * @param {function} onClose - 모달 닫기 핸들러
 * @param {object} creative - 광고 소재 정보 { creative_name, utm_source, utm_medium, utm_campaign }
 * @param {object} dateRange - 조회 기간 { start, end }
 */
function CreativeOrdersModal({ visible, onClose, creative, dateRange }) {
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState({
    total_orders: 0,
    total_revenue: 0,
    avg_order_value: 0,
    unique_visitors: 0,
    last_touch_count: 0
  });

  // 모달이 열릴 때 데이터 조회
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
        setSummary(response.data.summary || {
          total_orders: 0,
          total_revenue: 0,
          avg_order_value: 0,
          unique_visitors: 0
        });
      }
    } catch (error) {
      console.error('주문 목록 조회 실패:', error);
      setOrders([]);
      setSummary({
        total_orders: 0,
        total_revenue: 0,
        avg_order_value: 0,
        unique_visitors: 0
      });
    } finally {
      setLoading(false);
    }
  };

  // 금액 포맷
  const formatCurrency = (amount) => {
    if (!amount) return '0원';
    return `${parseInt(amount).toLocaleString()}원`;
  };

  // 테이블 컬럼
  const columns = [
    {
      title: '주문번호',
      dataIndex: 'order_id',
      key: 'order_id',
      width: 140,
      render: (text) => (
        <Text 
          copyable={{ text }}
          style={{ fontFamily: 'monospace', fontSize: '12px' }}
        >
          {text}
        </Text>
      )
    },
    {
      title: '주문일시',
      dataIndex: 'order_date',
      key: 'order_date',
      width: 150,
      render: (date) => (
        <Text style={{ fontSize: '12px' }}>
          {dayjs(date).format('YYYY-MM-DD HH:mm')}
        </Text>
      )
    },
    {
      title: '상품명',
      dataIndex: 'product_name',
      key: 'product_name',
      ellipsis: true,
      render: (text) => (
        <Text 
          ellipsis={{ tooltip: text }}
          style={{ fontSize: '13px' }}
        >
          {text || '-'}
        </Text>
      )
    },
    {
      title: '수량',
      dataIndex: 'product_count',
      key: 'product_count',
      width: 60,
      align: 'center',
      render: (count) => (
        <Tag color="blue" style={{ margin: 0 }}>{count}개</Tag>
      )
    },
    {
      title: '결제금액',
      dataIndex: 'final_payment',
      key: 'final_payment',
      width: 110,
      align: 'right',
      render: (amount) => (
        <Text strong style={{ color: '#0958d9', fontSize: '13px' }}>
          {formatCurrency(amount)}
        </Text>
      )
    },
    {
      title: (
        <Tooltip title="이 광고를 마지막으로 보고 구매한 주문">
          <span>막타</span>
        </Tooltip>
      ),
      dataIndex: 'is_last_touch',
      key: 'is_last_touch',
      width: 60,
      align: 'center',
      render: (isLastTouch) => (
        isLastTouch ? (
          <Tooltip title="마지막으로 본 광고">
            <Tag color="blue" style={{ margin: 0, fontWeight: 600 }}>
              <AimOutlined /> 막타
            </Tag>
          </Tooltip>
        ) : (
          <Tag color="default" style={{ margin: 0, color: '#8c8c8c' }}>어시</Tag>
        )
      )
    }
  ];

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShoppingCartOutlined style={{ fontSize: '20px', color: '#1890ff' }} />
          <span>광고 소재 주문 목록</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={900}
      style={{ top: '2.5vh' }}
      styles={{
        body: { 
          padding: '16px 24px',
          height: 'calc(95vh - 60px)',
          overflowY: 'auto'
        }
      }}
    >
      {/* 광고 소재 정보 */}
      {creative && (
        <div style={{
          marginBottom: '16px',
          padding: '12px 16px',
          background: 'linear-gradient(135deg, #f0f5ff 0%, #e6f4ff 100%)',
          borderRadius: '8px',
          border: '1px solid #d6e4ff'
        }}>
          <div style={{ 
            fontSize: '15px', 
            fontWeight: 600, 
            color: '#1d39c4',
            marginBottom: '8px'
          }}>
            {creative.creative_name}
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Tag color="blue">{creative.utm_source}</Tag>
            <Tag color="cyan">{creative.utm_medium}</Tag>
            <Tag color="purple">{creative.utm_campaign}</Tag>
          </div>
        </div>
      )}

      {/* 요약 통계 */}
      <Row gutter={12} style={{ marginBottom: '20px' }}>
        <Col span={5}>
          <div style={{
            background: '#fff',
            border: '1px solid #f0f0f0',
            borderRadius: '8px',
            padding: '12px',
            textAlign: 'center'
          }}>
            <Statistic
              title={<span style={{ fontSize: '11px', color: '#8c8c8c' }}>기여 주문</span>}
              value={summary.total_orders}
              suffix="건"
              prefix={<ShoppingOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ fontSize: '18px', fontWeight: 600 }}
            />
          </div>
        </Col>
        <Col span={5}>
          <div style={{
            background: '#fff',
            border: '1px solid #f0f0f0',
            borderRadius: '8px',
            padding: '12px',
            textAlign: 'center'
          }}>
            <Statistic
              title={
                <Tooltip title="마지막으로 본 광고로서 구매한 주문">
                  <span style={{ fontSize: '11px', color: '#8c8c8c' }}>막타 주문</span>
                </Tooltip>
              }
              value={summary.last_touch_count || 0}
              suffix="건"
              prefix={<AimOutlined style={{ color: '#0958d9' }} />}
              valueStyle={{ fontSize: '18px', fontWeight: 600, color: '#0958d9' }}
            />
          </div>
        </Col>
        <Col span={5}>
          <div style={{
            background: '#fff',
            border: '1px solid #f0f0f0',
            borderRadius: '8px',
            padding: '12px',
            textAlign: 'center'
          }}>
            <Statistic
              title={<span style={{ fontSize: '11px', color: '#8c8c8c' }}>총 매출액</span>}
              value={summary.total_revenue}
              prefix={<DollarOutlined style={{ color: '#52c41a' }} />}
              suffix="원"
              valueStyle={{ fontSize: '18px', fontWeight: 600, color: '#52c41a' }}
              formatter={(value) => parseInt(value).toLocaleString()}
            />
          </div>
        </Col>
        <Col span={5}>
          <div style={{
            background: '#fff',
            border: '1px solid #f0f0f0',
            borderRadius: '8px',
            padding: '12px',
            textAlign: 'center'
          }}>
            <Statistic
              title={<span style={{ fontSize: '11px', color: '#8c8c8c' }}>평균 객단가</span>}
              value={summary.avg_order_value}
              suffix="원"
              valueStyle={{ fontSize: '18px', fontWeight: 600, color: '#0050b3' }}
              formatter={(value) => parseInt(value).toLocaleString()}
            />
          </div>
        </Col>
        <Col span={4}>
          <div style={{
            background: '#fff',
            border: '1px solid #f0f0f0',
            borderRadius: '8px',
            padding: '12px',
            textAlign: 'center'
          }}>
            <Statistic
              title={<span style={{ fontSize: '11px', color: '#8c8c8c' }}>유입 방문자</span>}
              value={summary.unique_visitors}
              suffix="명"
              prefix={<UserOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ fontSize: '18px', fontWeight: 600, color: '#faad14' }}
            />
          </div>
        </Col>
      </Row>

      {/* 주문 목록 테이블 */}
      <Spin spinning={loading}>
        {orders.length > 0 ? (
          <Table
            columns={columns}
            dataSource={orders}
            rowKey="order_id"
            size="small"
            pagination={{
              pageSize: 10,
              showTotal: (total) => `총 ${total}건`,
              showSizeChanger: false
            }}
            style={{
              borderRadius: '8px',
              overflow: 'hidden'
            }}
          />
        ) : !loading && (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span style={{ color: '#8c8c8c' }}>
                해당 광고 소재로 발생한 주문이 없습니다
              </span>
            }
            style={{ padding: '40px 0' }}
          />
        )}
      </Spin>

      {/* 조회 기간 표시 */}
      {dateRange && (
        <div style={{ 
          marginTop: '16px', 
          textAlign: 'center', 
          color: '#8c8c8c',
          fontSize: '12px'
        }}>
          조회 기간: {dateRange.start} ~ {dateRange.end}
        </div>
      )}
    </Modal>
  );
}

export default CreativeOrdersModal;

