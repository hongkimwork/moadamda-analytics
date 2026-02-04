import { Modal, Table, Typography, Spin, Empty, Statistic, Row, Col, Tag, Tooltip, Card } from 'antd';
import { ShoppingCartOutlined, EyeOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
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
 * FIX (2026-02-04): Attribution Window 선택 기능 추가
 */
function CreativeOrdersModal({ visible, onClose, creative, dateRange, attributionWindow = '30' }) {
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

  // 테이블 페이지네이션 & 정렬 state
  const [currentPage, setCurrentPage] = useState(1);
  const [sortedInfo, setSortedInfo] = useState({});

  useEffect(() => {
    if (visible && creative) {
      setCurrentPage(1); // 새 소재 선택 시 페이지 초기화
      setSortedInfo({}); // 정렬 상태 초기화
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
        end: dateRange.end,
        attribution_window: attributionWindow // FIX (2026-02-04): Attribution Window
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
        <Text copyable={{ text }} style={{ fontFamily: 'monospace', fontSize: 13 }}>{text}</Text>
      )
    },
    {
      title: (
        <Tooltip title="이 광고를 언제 봤는지 (조회 기간 밖이면 파란색 표시)">
          <span style={{ cursor: 'help' }}>광고 노출일</span>
        </Tooltip>
      ),
      key: 'exposure_date',
      width: 110,
      align: 'center',
      sorter: (a, b) => {
        const aInfo = getExposureInfo(a, dateRange);
        const bInfo = getExposureInfo(b, dateRange);
        const aTime = aInfo.exposureDate ? aInfo.exposureDate.valueOf() : 0;
        const bTime = bInfo.exposureDate ? bInfo.exposureDate.valueOf() : 0;
        return aTime - bTime;
      },
      sortOrder: sortedInfo.columnKey === 'exposure_date' ? sortedInfo.order : null,
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
                <ExclamationCircleOutlined style={{ marginLeft: 4, color: '#1677ff', fontSize: 13 }} />
              </Tooltip>
            )}
          </div>
        );
      }
    },
    {
      title: (
        <Tooltip title="광고를 본 후 구매까지 걸린 시간">
          <span style={{ cursor: 'help' }}>노출→구매</span>
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
      sorter: (a, b) => dayjs(a.order_date).valueOf() - dayjs(b.order_date).valueOf(),
      sortOrder: sortedInfo.columnKey === 'order_date' ? sortedInfo.order : null,
      render: (date) => <Text style={{ fontSize: 12 }}>{dayjs(date).format('MM-DD HH:mm')}</Text>
    },
    {
      title: '결제금액',
      dataIndex: 'final_payment',
      key: 'final_payment',
      width: 95,
      align: 'center',
      sorter: (a, b) => (a.final_payment || 0) - (b.final_payment || 0),
      sortOrder: sortedInfo.columnKey === 'final_payment' ? sortedInfo.order : null,
      render: (amount) => <Text strong style={{ fontSize: 13 }}>{formatCurrency(amount)}</Text>
    },
    {
      title: (
        <Tooltip title="구매자가 이 광고를 총 몇 번 봤는지">
          <span style={{ cursor: 'help' }}>광고접촉</span>
        </Tooltip>
      ),
      dataIndex: 'ad_touch_count',
      key: 'ad_touch_count',
      width: 70,
      align: 'center',
      render: (count) => (
        <Tag color={count >= 3 ? 'purple' : count >= 2 ? 'blue' : 'default'} style={{ margin: 0 }}>
          {count || 0}회
        </Tag>
      )
    },
    {
      title: (
        <Tooltip title="이 광고가 해당 주문에서 수행한 역할">
          <span style={{ cursor: 'help' }}>역할</span>
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
        <Tooltip title="이 광고가 해당 주문에서 기여한 비율">
          <span style={{ cursor: 'help' }}>기여율</span>
        </Tooltip>
      ),
      dataIndex: 'contribution_rate',
      key: 'contribution_rate',
      width: 70,
      align: 'center',
      sorter: (a, b) => (a.contribution_rate || 0) - (b.contribution_rate || 0),
      sortOrder: sortedInfo.columnKey === 'contribution_rate' ? sortedInfo.order : null,
      render: (rate) => (
        <Text style={{ color: rate === 100 ? '#d48806' : rate >= 50 ? '#1677ff' : '#000000', fontWeight: rate >= 50 ? 600 : 400 }}>
          {rate}%
        </Text>
      )
    },
    {
      title: (
        <Tooltip title="결제금액 × 기여율">
          <span style={{ cursor: 'help' }}>기여금액</span>
        </Tooltip>
      ),
      dataIndex: 'attributed_amount',
      key: 'attributed_amount',
      width: 95,
      align: 'center',
      sorter: (a, b) => (a.attributed_amount || 0) - (b.attributed_amount || 0),
      sortOrder: sortedInfo.columnKey === 'attributed_amount' ? sortedInfo.order : null,
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
      <div style={{ 
        display: 'flex', 
        gap: '12px',
        flexWrap: 'wrap',
        marginBottom: '20px'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px 16px',
          background: '#fff',
          borderRadius: '12px',
          border: '1px solid #e8eaed',
          flex: 1,
          minWidth: '160px',
          textAlign: 'center'
        }}>
          <Text style={{ fontSize: '12px', display: 'block', marginBottom: '2px', color: '#374151' }}>
            기여한 주문 수
          </Text>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{ fontSize: '19px', fontWeight: 700, color: '#1a1a1a' }}>
              {summary.total_orders.toLocaleString()}
            </span>
            <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>
              건
            </span>
          </div>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px 16px',
          background: '#fff',
          borderRadius: '12px',
          border: '1px solid #e8eaed',
          flex: 1,
          minWidth: '160px',
          textAlign: 'center'
        }}>
          <Text style={{ fontSize: '12px', display: 'block', marginBottom: '2px', color: '#374151' }}>
            막타 주문
          </Text>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{ fontSize: '19px', fontWeight: 700, color: '#1677ff' }}>
              {summary.last_touch_orders.toLocaleString()}
            </span>
            <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>
              건 ({summary.last_touch_ratio}%)
            </span>
          </div>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px 16px',
          background: '#fff',
          borderRadius: '12px',
          border: '1px solid #e8eaed',
          flex: 1,
          minWidth: '160px',
          textAlign: 'center'
        }}>
          <Text style={{ fontSize: '12px', display: 'block', marginBottom: '2px', color: '#374151' }}>
            어시 주문
          </Text>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{ fontSize: '19px', fontWeight: 700, color: '#d48806' }}>
              {summary.assist_orders.toLocaleString()}
            </span>
            <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>
              건 ({summary.assist_ratio}%)
            </span>
          </div>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px 16px',
          background: '#fff',
          borderRadius: '12px',
          border: '1px solid #e8eaed',
          flex: 1,
          minWidth: '160px',
          textAlign: 'center'
        }}>
          <Text style={{ fontSize: '12px', display: 'block', marginBottom: '2px', color: '#374151' }}>
            순수 전환
          </Text>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{ fontSize: '19px', fontWeight: 700, color: '#faad14' }}>
              {summary.single_touch_orders.toLocaleString()}
            </span>
            <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>
              건
            </span>
          </div>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px 16px',
          background: '#fff',
          borderRadius: '12px',
          border: '1px solid #e8eaed',
          flex: 1,
          minWidth: '160px',
          textAlign: 'center'
        }}>
          <Text style={{ fontSize: '12px', display: 'block', marginBottom: '2px', color: '#374151' }}>
            기여한 결제액
          </Text>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{ fontSize: '19px', fontWeight: 700, color: '#52c41a' }}>
              {parseInt(summary.attributed_revenue).toLocaleString()}
            </span>
            <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>
              원
            </span>
          </div>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px 16px',
          background: '#fff',
          borderRadius: '12px',
          border: '1px solid #e8eaed',
          flex: 1,
          minWidth: '160px',
          textAlign: 'center'
        }}>
          <Text style={{ fontSize: '12px', display: 'block', marginBottom: '2px', color: '#374151' }}>
            막타 결제액
          </Text>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{ fontSize: '19px', fontWeight: 700, color: '#0958d9' }}>
              {parseInt(summary.last_touch_revenue).toLocaleString()}
            </span>
            <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>
              원
            </span>
          </div>
        </div>
      </div>

      {/* 주문 목록 테이블 */}
      {orders.length > 0 ? (
        <Table
          columns={columns}
          dataSource={orders}
          rowKey="order_id"
          size="small"
          pagination={{ 
            pageSize: 10, 
            showTotal: (total) => `총 ${total}건`, 
            showSizeChanger: false,
            current: currentPage
          }}
          onChange={(pagination, filters, sorter) => {
            setCurrentPage(pagination.current);
            setSortedInfo(sorter);
          }}
          scroll={{ x: 1300 }}
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
          <span>광고 소재 상세</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={1650}
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
          <div style={{ color: '#000000', marginBottom: 4 }}>
            조회 기간: {dateRange.start} ~ {dateRange.end}
          </div>
          <div style={{ color: '#1677ff', fontSize: 13 }}>
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
