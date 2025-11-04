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
        title="📦 주문 상세 정보"
        open={isModalOpen}
        onCancel={handleCloseModal}
        footer={null}
        width="90%"
        style={{ top: 20 }}
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

  const { order, page_path, utm_history, same_ip_visits, past_purchases } = data;

  return (
    <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
      {/* 헤더 */}
      <Card style={{ marginBottom: '16px' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate('/')}
          >
            목록으로
          </Button>
          <Title level={3} style={{ margin: 0 }}>
            🎯 고객 여정 분석
          </Title>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={fetchOrderDetail}
          >
            새로고침
          </Button>
        </Space>
      </Card>

      {/* 1. 주문 기본 정보 */}
      <Card 
        title={<span><ShoppingOutlined /> 주문 정보</span>}
        style={{ marginBottom: '16px' }}
      >
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label="주문번호" span={2}>
            <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{order.order_id}</span>
          </Descriptions.Item>
          <Descriptions.Item label="주문시간">
            {dayjs(order.timestamp).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
          <Descriptions.Item label="결제금액">
            <span style={{ color: '#1890ff', fontWeight: 'bold', fontSize: '16px' }}>
              {order.final_payment.toLocaleString()}원
            </span>
          </Descriptions.Item>
          <Descriptions.Item label="상품명" span={2}>
            {order.product_name || '정보 없음'}
          </Descriptions.Item>
          <Descriptions.Item label="디바이스">
            <Tag color={order.device_type === 'mobile' ? 'blue' : 'green'}>
              {order.device_type === 'mobile' ? '📱 Mobile' : '💻 PC'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="브라우저/OS">
            {order.browser} / {order.os}
          </Descriptions.Item>
          <Descriptions.Item label="IP 주소">
            <span style={{ fontFamily: 'monospace' }}>{order.ip_address}</span>
          </Descriptions.Item>
          <Descriptions.Item label="쿠키 ID">
            <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{order.visitor_id}</span>
          </Descriptions.Item>
          <Descriptions.Item label="UTM Source">
            {order.utm_source ? <Tag>{order.utm_source}</Tag> : <span style={{ color: '#999' }}>direct</span>}
          </Descriptions.Item>
          <Descriptions.Item label="UTM Campaign">
            {order.utm_campaign ? <Tag color="blue">{order.utm_campaign}</Tag> : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="첫 방문">
            {dayjs(order.first_visit).format('YYYY-MM-DD HH:mm')}
          </Descriptions.Item>
          <Descriptions.Item label="첫 진입 URL">
            {order.entry_url ? (
              <Tooltip title={order.entry_url} placement="topLeft">
                <span 
                  style={{ 
                    fontSize: '11px', 
                    cursor: 'pointer',
                    color: '#1890ff',
                    textDecoration: 'underline',
                    userSelect: 'none'
                  }}
                  onDoubleClick={() => handleCopyUrl(order.entry_url)}
                >
                  {order.entry_url.length > 30 
                    ? `${order.entry_url.substring(0, 30)}...` 
                    : order.entry_url}
                </span>
              </Tooltip>
            ) : (
              '-'
            )}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 2. 페이지 이동 경로 */}
      <Card 
        title={<span><ClockCircleOutlined /> 페이지 이동 경로 (세션 내)</span>}
        style={{ marginBottom: '16px' }}
      >
        {page_path.length > 0 ? (
          <>
            {/* URL 표시 토글 */}
            <div style={{ marginBottom: '16px', textAlign: 'right' }}>
              <Space>
                <LinkOutlined />
                <span style={{ fontSize: '13px', color: '#666' }}>원본 URL</span>
                <Switch 
                  checked={showKoreanUrl} 
                  onChange={handleUrlDisplayToggle}
                  size="small"
                />
                <span style={{ fontSize: '13px', color: '#666' }}>한글 이름</span>
              </Space>
            </div>

            {/* 체류 시간 통계 */}
            <Row gutter={16} style={{ marginBottom: '24px' }}>
              <Col span={8}>
                <Card style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
                  <Statistic
                    title="총 체류 시간"
                    value={(() => {
                      const totalSeconds = page_path.reduce((sum, p) => sum + (p.time_spent_seconds || 0), 0);
                      return totalSeconds >= 60 
                        ? `${Math.floor(totalSeconds / 60)}분 ${totalSeconds % 60}초`
                        : `${totalSeconds}초`;
                    })()}
                    valueStyle={{ color: '#374151', fontSize: '18px', fontWeight: '600' }}
                    prefix="⏱️"
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
                  <Statistic
                    title="평균 체류 시간"
                    value={(() => {
                      const totalSeconds = page_path.reduce((sum, p) => sum + (p.time_spent_seconds || 0), 0);
                      const avgSeconds = page_path.length > 0 ? Math.round(totalSeconds / page_path.length) : 0;
                      return avgSeconds >= 60 
                        ? `${Math.floor(avgSeconds / 60)}분 ${avgSeconds % 60}초`
                        : `${avgSeconds}초`;
                    })()}
                    valueStyle={{ color: '#374151', fontSize: '18px', fontWeight: '600' }}
                    prefix="📊"
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
                  <Statistic
                    title="최대 체류 시간"
                    value={(() => {
                      const maxPage = page_path.reduce((max, p) => 
                        (p.time_spent_seconds || 0) > (max.time_spent_seconds || 0) ? p : max, 
                        { time_spent_seconds: 0 }
                      );
                      const maxSeconds = maxPage.time_spent_seconds || 0;
                      return maxSeconds >= 60 
                        ? `${Math.floor(maxSeconds / 60)}분 ${maxSeconds % 60}초`
                        : `${maxSeconds}초`;
                    })()}
                    valueStyle={{ color: '#374151', fontSize: '18px', fontWeight: '600' }}
                    prefix="🔥"
                  />
                </Card>
              </Col>
            </Row>

            {/* 타임라인 */}
            <Timeline style={{ marginTop: '16px', paddingLeft: '20px' }}>
              {page_path.map((page, idx) => {
                const urlInfo = urlToKorean(page.page_url);
                return (
                  <Timeline.Item
                    key={idx}
                    color={idx === 0 ? 'green' : idx === page_path.length - 1 ? 'red' : 'blue'}
                  >
                    <div>
                      <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>
                        {showKoreanUrl ? urlInfo.icon : '📄'} {idx === 0 ? '진입' : idx === page_path.length - 1 ? '구매 완료' : `${idx}단계`}
                        <span style={{ marginLeft: '12px', color: '#999', fontWeight: 'normal', fontSize: '13px' }}>
                          {dayjs(page.timestamp).format('HH:mm:ss')}
                        </span>
                      </div>
                      
                      {/* 상품명/페이지 제목 표시 */}
                      {page.page_title && page.page_title !== '모아담다 온라인 공식몰' && (
                        <div style={{ 
                          fontSize: '14px', 
                          marginBottom: '6px', 
                          color: '#f97316',
                          fontWeight: '600'
                        }}>
                          📦 {page.page_title}
                        </div>
                      )}

                      {/* URL 표시 (한글 또는 원본) */}
                      {showKoreanUrl ? (
                        <div style={{ 
                          fontSize: '12px', 
                          marginBottom: '8px', 
                          color: '#64748b'
                        }}>
                          {urlInfo.name}
                        </div>
                      ) : (
                        <div style={{ fontSize: '11px', wordBreak: 'break-all', marginBottom: '8px', color: '#666' }}>
                          {page.page_url}
                        </div>
                      )}

                      {/* 체류 시간 태그 */}
                      {page.time_spent_seconds > 0 && (
                        <Tag color={page.time_spent_seconds >= 60 ? 'red' : page.time_spent_seconds < 10 ? 'cyan' : 'orange'}>
                          {page.time_spent_seconds >= 60 ? '🔥' : page.time_spent_seconds < 10 ? '⚡' : '⏱️'} 
                          {' '}체류: {
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
          </>
        ) : (
          <Alert message="페이지 이동 기록이 없습니다." type="info" />
        )}
      </Card>

      {/* 3. 동일 쿠키 UTM 히스토리 */}
      <Card 
        title={<span><GlobalOutlined /> 동일 쿠키 유입 기록 (광고 접촉 이력)</span>}
        style={{ marginBottom: '16px' }}
      >
        {utm_history.length > 0 ? (
          <Table 
            dataSource={utm_history}
            rowKey={(record, idx) => idx}
            pagination={false}
            size="small"
            columns={[
              {
                title: '순서',
                key: 'index',
                width: 60,
                render: (_, __, idx) => idx + 1
              },
              {
                title: '유입 시간',
                dataIndex: 'entry_time',
                key: 'entry_time',
                width: 180,
                render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm:ss')
              },
              {
                title: 'UTM Source',
                dataIndex: 'utm_source',
                key: 'utm_source',
                render: (source) => <Tag>{source || 'direct'}</Tag>
              },
              {
                title: 'UTM Campaign',
                dataIndex: 'utm_campaign',
                key: 'utm_campaign',
                render: (campaign) => campaign ? <Tag color="blue">{campaign}</Tag> : '-'
              },
              {
                title: 'UTM Medium',
                dataIndex: 'utm_medium',
                key: 'utm_medium',
                render: (medium) => medium || '-'
              },
              {
                title: '체류 시간',
                dataIndex: 'total_duration',
                key: 'total_duration',
                width: 120,
                render: (duration) => duration ? `${Math.round(duration / 1000)}초` : '-'
              }
            ]}
          />
        ) : (
          <Alert message="UTM 유입 기록이 없습니다. (직접 방문)" type="info" />
        )}
      </Card>

      {/* 4. 동일 IP 방문 기록 */}
      <Card 
        title={<span><HistoryOutlined /> 동일 IP 과거 방문 기록</span>}
        style={{ marginBottom: '16px' }}
      >
        {same_ip_visits.length > 0 ? (
          <Table
            dataSource={same_ip_visits}
            rowKey="session_id"
            pagination={{ pageSize: 10 }}
            size="small"
            columns={[
              {
                title: '방문 시간',
                dataIndex: 'start_time',
                key: 'start_time',
                width: 180,
                render: (time) => (
                  <div>
                    <div>{dayjs(time).format('YYYY-MM-DD HH:mm')}</div>
                    <span style={{ fontSize: '11px', color: '#999' }}>
                      {dayjs(time).fromNow()}
                    </span>
                  </div>
                )
              },
              {
                title: '진입 URL',
                dataIndex: 'entry_url',
                key: 'entry_url',
                ellipsis: true,
                render: (url) => (
                  <span style={{ fontSize: '11px', wordBreak: 'break-all' }}>{url || '-'}</span>
                )
              },
              {
                title: 'UTM Source',
                dataIndex: 'utm_source',
                key: 'utm_source',
                width: 120,
                render: (source) => source ? <Tag>{source}</Tag> : <span style={{ color: '#999' }}>direct</span>
              },
              {
                title: 'UTM Campaign',
                dataIndex: 'utm_campaign',
                key: 'utm_campaign',
                width: 150,
                render: (campaign) => campaign ? <Tag color="blue">{campaign}</Tag> : '-'
              },
              {
                title: '디바이스',
                dataIndex: 'device_type',
                key: 'device_type',
                width: 100,
                render: (device) => (
                  <Tag color={device === 'mobile' ? 'blue' : 'green'}>
                    {device === 'mobile' ? '📱' : '💻'}
                  </Tag>
                )
              },
              {
                title: '구매 여부',
                dataIndex: 'has_purchase',
                key: 'has_purchase',
                width: 100,
                render: (hasPurchase) => (
                  hasPurchase ? 
                    <Tag color="success">✅ 구매</Tag> : 
                    <Tag>방문만</Tag>
                )
              }
            ]}
          />
        ) : (
          <Alert message="동일 IP에서의 과거 방문 기록이 없습니다." type="info" />
        )}
      </Card>

      {/* 5. 과거 구매 이력 */}
      <Card 
        title={<span><ShoppingOutlined /> 과거 구매 이력 (동일 고객)</span>}
        style={{ marginBottom: '16px' }}
      >
        {past_purchases.length > 0 ? (
          <Table
            dataSource={past_purchases}
            rowKey="order_id"
            pagination={false}
            size="small"
            columns={[
              {
                title: '순서',
                key: 'index',
                width: 60,
                render: (_, __, idx) => idx + 1
              },
              {
                title: '주문 시간',
                dataIndex: 'timestamp',
                key: 'timestamp',
                width: 180,
                render: (time) => (
                  <div>
                    <div>{dayjs(time).format('YYYY-MM-DD HH:mm')}</div>
                    <span style={{ fontSize: '11px', color: '#999' }}>
                      {dayjs(time).fromNow()}
                    </span>
                  </div>
                )
              },
              {
                title: '상품명',
                dataIndex: 'product_name',
                key: 'product_name',
                ellipsis: true
              },
              {
                title: '결제 금액',
                dataIndex: 'final_payment',
                key: 'final_payment',
                width: 120,
                align: 'right',
                render: (amount) => (
                  <span style={{ fontWeight: 'bold' }}>
                    {amount.toLocaleString()}원
                  </span>
                )
              },
              {
                title: '주문번호',
                dataIndex: 'order_id',
                key: 'order_id',
                width: 200,
                render: (id) => (
                  <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{id}</span>
                )
              }
            ]}
          />
        ) : (
          <Alert message="과거 구매 이력이 없습니다. (첫 구매 고객)" type="success" showIcon />
        )}
      </Card>

      {/* 푸터 */}
      <div style={{ marginTop: '16px', textAlign: 'center', color: '#999' }}>
        고객 여정 분석 완료 | 마지막 갱신: {dayjs().format('YYYY-MM-DD HH:mm:ss')}
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
