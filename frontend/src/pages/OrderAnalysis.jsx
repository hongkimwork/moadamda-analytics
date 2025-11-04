import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Table, DatePicker, Select, Button, Tag, Space, Typography, Descriptions, Timeline, Spin, Alert, Statistic, Row, Col, Switch, Tooltip, Modal, message } from 'antd';
import { ReloadOutlined, ArrowLeftOutlined, ClockCircleOutlined, ShoppingOutlined, GlobalOutlined, HistoryOutlined, LinkOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import relativeTime from 'dayjs/plugin/relativeTime';
import { urlToKorean, getUrlDisplayMode, setUrlDisplayMode } from '../utils/urlToKorean';

dayjs.extend(relativeTime);
dayjs.locale('ko');

const { RangePicker } = DatePicker;
const { Title } = Typography;

const API_URL = import.meta.env.VITE_API_URL || '';

// ============================================================================
// 주문 목록 페이지
// ============================================================================
export function OrderListPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState([dayjs().subtract(7, 'day'), dayjs()]);
  const [deviceFilter, setDeviceFilter] = useState('all');
  const [totalOrders, setTotalOrders] = useState(0);
  
  // 모달 state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');
      
      const response = await axios.get(`${API_URL}/api/stats/orders`, {
        params: {
          start: startDate,
          end: endDate,
          device: deviceFilter,
          limit: 100,
          offset: 0
        }
      });

      setOrders(response.data.orders);
      setTotalOrders(response.data.total_orders);
      setLoading(false);
    } catch (error) {
      console.error('주문 목록 조회 실패:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [dateRange, deviceFilter]);

  // 모달 열기 핸들러
  const handleOpenModal = (orderId) => {
    setSelectedOrderId(orderId);
    setIsModalOpen(true);
  };

  // 모달 닫기 핸들러 (닫을 때 목록 새로고침)
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedOrderId(null);
    fetchOrders(); // 목록 자동 새로고침
  };

  // 주문 테이블 컬럼 정의
  const columns = [
    {
      title: '주문번호',
      dataIndex: 'order_id',
      key: 'order_id',
      width: 200,
      fixed: 'left',
      render: (text) => (
        <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{text}</span>
      )
    },
    {
      title: '주문시간',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (timestamp) => dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '금액',
      dataIndex: 'final_payment',
      key: 'final_payment',
      width: 120,
      align: 'right',
      render: (amount) => `${amount.toLocaleString()}원`
    },
    {
      title: '상품명',
      dataIndex: 'product_name',
      key: 'product_name',
      width: 300,
      ellipsis: true
    },
    {
      title: '디바이스',
      dataIndex: 'device_type',
      key: 'device_type',
      width: 100,
      render: (device) => (
        <Tag color={device === 'mobile' ? 'blue' : 'green'}>
          {device === 'mobile' ? '📱 Mobile' : '💻 PC'}
        </Tag>
      )
    },
    {
      title: 'IP',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 150,
      render: (ip) => (
        <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>
          {ip || 'unknown'}
        </span>
      )
    },
    {
      title: 'UTM Source',
      dataIndex: 'utm_source',
      key: 'utm_source',
      width: 120,
      render: (source) => source ? <Tag>{source}</Tag> : '-'
    },
    {
      title: '상세보기',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Button 
          type="primary" 
          size="small"
          onClick={() => handleOpenModal(record.order_id)}
        >
          보기
        </Button>
      )
    }
  ];

  return (
    <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
      {/* 헤더 */}
      <Card style={{ marginBottom: '16px' }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={2} style={{ margin: 0 }}>
              📦 주문 목록
            </Title>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={fetchOrders}
              loading={loading}
            >
              새로고침
            </Button>
          </div>

          {/* 필터 */}
          <Space size="middle">
            <span>기간:</span>
            <RangePicker
              value={dateRange}
              onChange={(dates) => dates && setDateRange(dates)}
              format="YYYY-MM-DD"
            />
            
            <span>디바이스:</span>
            <Select
              value={deviceFilter}
              onChange={setDeviceFilter}
              style={{ width: 120 }}
            >
              <Select.Option value="all">전체</Select.Option>
              <Select.Option value="pc">💻 PC</Select.Option>
              <Select.Option value="mobile">📱 Mobile</Select.Option>
            </Select>

            <Tag color="blue">총 {totalOrders}건</Tag>
          </Space>
        </Space>
      </Card>

      {/* 주문 목록 테이블 */}
      <Card>
        <Table 
          columns={columns}
          dataSource={orders}
          rowKey="order_id"
          loading={loading}
          pagination={{
            pageSize: 20,
            showTotal: (total) => `총 ${total}건`,
            showSizeChanger: true
          }}
          scroll={{ x: 1400 }}
        />
      </Card>

      {/* 푸터 */}
      <div style={{ marginTop: '16px', textAlign: 'center', color: '#999' }}>
        마지막 갱신: {dayjs().format('YYYY-MM-DD HH:mm:ss')}
      </div>

      {/* 주문 상세 모달 */}
      <Modal
        title="🎯 고객 여정 분석"
        open={isModalOpen}
        onCancel={handleCloseModal}
        footer={null}
        width={1200}
        style={{ top: 20, maxWidth: '95vw' }}
        styles={{ body: { padding: 0, maxHeight: '85vh', overflow: 'auto' } }}
        destroyOnClose={true}
      >
        {selectedOrderId && (
          <OrderDetailPageContent orderId={selectedOrderId} />
        )}
      </Modal>
    </div>
  );
}

// ============================================================================
// 주문 상세 페이지 콘텐츠 (모달과 페이지에서 공통 사용)
// ============================================================================
function OrderDetailPageContent({ orderId }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [showKoreanUrl, setShowKoreanUrl] = useState(getUrlDisplayMode() === 'korean');

  useEffect(() => {
    fetchOrderDetail();
  }, [orderId]);

  const handleUrlDisplayToggle = (checked) => {
    setShowKoreanUrl(checked);
    setUrlDisplayMode(checked ? 'korean' : 'original');
  };

  // URL 복사 핸들러
  const handleCopyUrl = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      message.success('URL이 클립보드에 복사되었습니다!');
    } catch (err) {
      console.error('복사 실패:', err);
      message.error('URL 복사에 실패했습니다.');
    }
  };

  const fetchOrderDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${API_URL}/api/stats/order-detail/${orderId}`);
      setData(response.data);
      setLoading(false);
    } catch (err) {
      console.error('주문 상세 조회 실패:', err);
      setError(err.response?.data?.error || '주문 상세 정보를 불러올 수 없습니다.');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', minHeight: '100vh' }}>
        <Spin size="large" tip="주문 정보를 불러오는 중..." />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <Alert
            message="오류 발생"
            description={error}
            type="error"
            showIcon
          />
          <Button 
            type="primary" 
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/')}
            style={{ marginTop: '16px' }}
          >
            목록으로 돌아가기
          </Button>
        </Card>
      </div>
    );
  }

  const { order, page_path } = data;

  // 타임라인 다단 배치 계산
  const MAX_ITEMS_PER_COLUMN = 5;
  const columnCount = Math.ceil(page_path.length / MAX_ITEMS_PER_COLUMN);
  const columns = [];
  
  for (let i = 0; i < columnCount; i++) {
    const start = i * MAX_ITEMS_PER_COLUMN;
    const end = start + MAX_ITEMS_PER_COLUMN;
    columns.push(page_path.slice(start, end));
  }

  // 체류시간 계산
  const totalSeconds = page_path.reduce((sum, p) => sum + (p.time_spent_seconds || 0), 0);
  const avgSeconds = page_path.length > 0 ? Math.round(totalSeconds / page_path.length) : 0;
  const maxPage = page_path.reduce((max, p) => 
    (p.time_spent_seconds || 0) > (max.time_spent_seconds || 0) ? p : max, 
    { time_spent_seconds: 0 }
  );
  const maxSeconds = maxPage.time_spent_seconds || 0;

  return (
    <div style={{ background: '#fff' }}>
      {/* 주문 정보 + 체류시간 통계 */}
      <div style={{ 
        background: '#fafafa', 
        padding: '16px', 
        borderBottom: '1px solid #f0f0f0',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '13px', marginBottom: '8px' }}>
          <span><strong>주문번호:</strong> {order.order_id}</span>
          <span><strong>시간:</strong> {dayjs(order.timestamp).format('YYYY-MM-DD HH:mm:ss')}</span>
          <span><strong>금액:</strong> <span style={{ color: '#1890ff', fontWeight: 'bold' }}>{order.final_payment.toLocaleString()}원</span></span>
          <Tag color={order.device_type === 'mobile' ? 'blue' : 'green'}>
            {order.device_type === 'mobile' ? '📱 Mobile' : '💻 PC'}
          </Tag>
          <span><strong>IP:</strong> {order.ip_address}</span>
          <span><strong>UTM:</strong> {order.utm_source || 'direct'}</span>
        </div>
        {order.product_name && (
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center', fontSize: '12px', color: '#666' }}>
            <div>
              <strong>상품:</strong> {order.product_name}
            </div>
            {/* 체류시간 통계 - 가로 배치 */}
            <div style={{ 
              display: 'flex', 
              gap: '16px',
              fontSize: '11px',
              marginLeft: 'auto'
            }}>
              <span>
                <span style={{ color: '#999' }}>⏱️ 총:</span>{' '}
                <strong>{totalSeconds >= 60 
                  ? `${Math.floor(totalSeconds / 60)}분 ${totalSeconds % 60}초`
                  : `${totalSeconds}초`}</strong>
              </span>
              <span>
                <span style={{ color: '#999' }}>📊 평균:</span>{' '}
                <strong>{avgSeconds >= 60 
                  ? `${Math.floor(avgSeconds / 60)}분 ${avgSeconds % 60}초`
                  : `${avgSeconds}초`}</strong>
              </span>
              <span>
                <span style={{ color: '#999' }}>🔥 최대:</span>{' '}
                <strong>{maxSeconds >= 60 
                  ? `${Math.floor(maxSeconds / 60)}분 ${maxSeconds % 60}초`
                  : `${maxSeconds}초`}</strong>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 페이지 이동 경로 */}
      <div style={{ padding: '0 20px 20px 20px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <h3 style={{ margin: 0, fontSize: '16px' }}>
            <ClockCircleOutlined /> 페이지 이동 경로 (세션 내)
          </h3>
          <Space size="small">
            <LinkOutlined />
            <span style={{ fontSize: '12px', color: '#666' }}>원본 URL</span>
            <Switch 
              checked={showKoreanUrl} 
              onChange={handleUrlDisplayToggle}
              size="small"
            />
            <span style={{ fontSize: '12px', color: '#666' }}>한글 이름</span>
          </Space>
        </div>

        {/* 다단 타임라인 */}
        {page_path.length > 0 ? (
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
            {columns.map((columnItems, colIdx) => (
              <div key={colIdx} style={{ flex: 1 }}>
                <Timeline style={{ fontSize: '12px' }}>
                  {columnItems.map((page, idx) => {
                    const globalIdx = colIdx * MAX_ITEMS_PER_COLUMN + idx;
                    const urlInfo = urlToKorean(page.page_url);
                    const isFirst = globalIdx === 0;
                    const isLast = globalIdx === page_path.length - 1;
                    
                    return (
                      <Timeline.Item
                        key={globalIdx}
                        color={isFirst ? 'green' : isLast ? 'red' : 'blue'}
                        style={{ paddingBottom: '8px' }}
                      >
                        <div style={{ minHeight: '50px' }}>
                          <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '12px' }}>
                            {showKoreanUrl ? urlInfo.icon : '📄'} {isFirst ? '진입' : isLast ? '구매 완료' : `${globalIdx}단계`}
                            <span style={{ marginLeft: '6px', color: '#999', fontWeight: 'normal', fontSize: '11px' }}>
                              {dayjs(page.timestamp).format('HH:mm:ss')}
                            </span>
                          </div>
                          
                          {page.page_title && page.page_title !== '모아담다 온라인 공식몰' && (
                            <div style={{ 
                              fontSize: '11px', 
                              marginBottom: '3px', 
                              color: '#f97316',
                              fontWeight: '500'
                            }}>
                              📦 {page.page_title}
                            </div>
                          )}

                          {showKoreanUrl ? (
                            <div style={{ 
                              fontSize: '10px', 
                              marginBottom: '4px', 
                              color: '#64748b'
                            }}>
                              {urlInfo.name}
                            </div>
                          ) : (
                            <Tooltip title="더블클릭하면 복사됩니다">
                              <div 
                                style={{ 
                                  fontSize: '9px', 
                                  marginBottom: '4px', 
                                  color: '#666',
                                  maxWidth: '250px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  cursor: 'pointer'
                                }}
                                onDoubleClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(page.page_url);
                                    message.success('URL이 복사되었습니다!');
                                  } catch (err) {
                                    message.error('복사에 실패했습니다.');
                                  }
                                }}
                              >
                                {page.page_url}
                              </div>
                            </Tooltip>
                          )}

                          {page.time_spent_seconds > 0 && (
                            <Tag 
                              color={page.time_spent_seconds >= 60 ? 'red' : page.time_spent_seconds < 10 ? 'cyan' : 'orange'}
                              style={{ fontSize: '10px', padding: '0 6px', lineHeight: '18px' }}
                            >
                              {page.time_spent_seconds >= 60 ? '🔥' : page.time_spent_seconds < 10 ? '⚡' : '⏱️'} 
                              {' '}{
                                page.time_spent_seconds >= 60 
                                  ? `${Math.floor(page.time_spent_seconds / 60)}분 ${page.time_spent_seconds % 60}초`
                                  : `${page.time_spent_seconds}초`
                              }
                            </Tag>
                          )}
                        </div>
                      </Timeline.Item>
                    );
                  })}
                </Timeline>
              </div>
            ))}
          </div>
        ) : (
          <Alert message="페이지 이동 기록이 없습니다." type="info" />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 주문 상세 페이지 (라우팅용 래퍼)
// ============================================================================
export function OrderDetailPage() {
  const { orderId } = useParams();
  return <OrderDetailPageContent orderId={orderId} />;
}
