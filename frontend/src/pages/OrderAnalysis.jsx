import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Table, DatePicker, Select, Button, Tag, Space, Typography, Descriptions, Timeline, Spin, Alert, Statistic, Row, Col, Switch, Tooltip, Modal, message } from 'antd';
import { ReloadOutlined, ArrowLeftOutlined, ClockCircleOutlined, ShoppingOutlined, GlobalOutlined, HistoryOutlined, LinkOutlined, InfoCircleOutlined, UpOutlined, DownOutlined } from '@ant-design/icons';
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
  const [userMappings, setUserMappings] = useState({});
  
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
    
    // 사용자 정의 매핑 로드
    fetch(`${API_URL}/api/mappings/lookup`)
      .then(res => res.json())
      .then(data => setUserMappings(data))
      .catch(err => console.error('매핑 로드 실패:', err));
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
          {device === 'mobile' ? 'Mobile' : 'PC'}
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
              주문 목록
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
              <Select.Option value="pc">PC</Select.Option>
              <Select.Option value="mobile">Mobile</Select.Option>
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
        title="고객 여정 분석"
        open={isModalOpen}
        onCancel={handleCloseModal}
        footer={null}
        width={1728}
        style={{ top: 20, maxWidth: '95vw' }}
        styles={{ body: { padding: 0, maxHeight: '85vh', overflow: 'auto' } }}
        destroyOnClose={true}
      >
        {selectedOrderId && (
          <OrderDetailPageContent orderId={selectedOrderId} userMappings={userMappings} />
        )}
      </Modal>
    </div>
  );
}

// ============================================================================
// 주문 상세 페이지 콘텐츠 (모달과 페이지에서 공통 사용)
// ============================================================================
function OrderDetailPageContent({ orderId, userMappings = {} }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [showKoreanUrl, setShowKoreanUrl] = useState(getUrlDisplayMode() === 'korean');
  const [showPreviousVisits, setShowPreviousVisits] = useState(false);

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

  const { order, purchase_journey, previous_visits, page_path, utm_history, past_purchases } = data;

  // 구매 직전 경로 (광고 클릭 후 ~ 구매까지)
  const journeyPages = purchase_journey?.pages || page_path || [];

  // 타임라인 다단 배치 계산
  const MAX_ITEMS_PER_COLUMN = 5;
  const columnCount = Math.ceil(journeyPages.length / MAX_ITEMS_PER_COLUMN);
  const columns = [];
  
  for (let i = 0; i < columnCount; i++) {
    const start = i * MAX_ITEMS_PER_COLUMN;
    const end = start + MAX_ITEMS_PER_COLUMN;
    columns.push(journeyPages.slice(start, end));
  }

  // 체류시간 계산 (구매 직전 경로만)
  const totalSeconds = purchase_journey?.total_duration || journeyPages.reduce((sum, p) => sum + (p.time_spent_seconds || 0), 0);
  const avgSeconds = journeyPages.length > 0 ? Math.round(totalSeconds / journeyPages.length) : 0;
  const maxPage = journeyPages.reduce((max, p) => 
    (p.time_spent_seconds || 0) > (max.time_spent_seconds || 0) ? p : max, 
    { time_spent_seconds: 0 }
  );
  const maxSeconds = maxPage.time_spent_seconds || 0;

  // 데이터 검증 (백엔드가 제대로 처리했는지 확인)
  if (totalSeconds > 3600) {
    console.warn('[데이터 검증] 비정상적으로 긴 총 체류시간:', totalSeconds, '초');
  }
  const overLimitPages = journeyPages.filter(p => p.time_spent_seconds > 600);
  if (overLimitPages.length > 0) {
    console.warn('[데이터 검증] 10분 초과 페이지 발견:', overLimitPages);
  }

  // 시간 포맷 함수
  const formatDuration = (seconds) => {
    if (seconds >= 60) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}분 ${secs}초`;
    }
    return `${seconds}초`;
  };

  // 마케팅 지표 계산
  const purchaseCount = (past_purchases?.length || 0) + 1; // 현재 주문 포함
  const repurchaseCount = purchaseCount - 1; // 재구매 횟수
  const daysSinceFirstVisit = order.first_visit 
    ? dayjs(order.timestamp).diff(dayjs(order.first_visit), 'day')
    : null;
  
  // UTM Last-Touch Attribution (최종 접촉 기준)
  const lastTouch = utm_history && utm_history.length > 0 
    ? utm_history[utm_history.length - 1] 
    : null;
  
  // 광고 클릭 후 구매까지 시간 계산
  const adToPurchaseSeconds = lastTouch 
    ? dayjs(order.timestamp).diff(dayjs(lastTouch.entry_time), 'second')
    : null;

  return (
    <div style={{ background: '#fff' }}>
      {/* 카드형 상단 영역 */}
      <div style={{ 
        display: 'flex',
        gap: '16px',
        padding: '20px',
        background: '#fafafa',
        borderBottom: '1px solid #e5e7eb',
        marginBottom: '20px'
      }}>
        {/* 광고 정보 카드 */}
        <div style={{
          flex: 1,
          padding: '16px',
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: '8px'
        }}>
          <h4 style={{ 
            fontSize: '14px', 
            fontWeight: 'bold', 
            color: 'rgb(0,0,0)',
            marginBottom: '12px',
            marginTop: 0
          }}>
            광고 정보
          </h4>
          
          {lastTouch ? (
            <>
              <div style={{ fontSize: '13px', marginBottom: '8px' }}>
                <span style={{ color: 'rgb(102,102,102)' }}>매체: </span>
                <span style={{ color: 'rgb(0,0,0)', fontWeight: 'bold' }}>{lastTouch.utm_source || '-'}</span>
              </div>
              
              <div style={{ fontSize: '13px', marginBottom: '8px' }}>
                <span style={{ color: 'rgb(102,102,102)' }}>유형: </span>
                <span style={{ color: 'rgb(0,0,0)', fontWeight: 'bold' }}>{lastTouch.utm_medium || '-'}</span>
              </div>
              
              <div style={{ fontSize: '13px', marginBottom: '8px' }}>
                <span style={{ color: 'rgb(102,102,102)' }}>캠페인: </span>
                <span style={{ color: 'rgb(0,0,0)', fontWeight: 'bold' }}>{lastTouch.utm_campaign || '-'}</span>
              </div>
              
              <div style={{ fontSize: '13px', marginBottom: '8px' }}>
                <span style={{ color: 'rgb(102,102,102)' }}>소재: </span>
                <span style={{ color: 'rgb(0,0,0)', fontWeight: 'bold' }}>{lastTouch.utm_content || '-'}</span>
              </div>
              
              {adToPurchaseSeconds !== null && (
                <div style={{ fontSize: '13px', marginTop: '12px' }}>
                  <span style={{ color: 'rgb(102,102,102)' }}>전환 속도: </span>
                  <span style={{ color: 'rgb(0,0,0)' }}>광고 클릭 후 </span>
                  <span style={{ color: 'rgb(24,144,255)', fontWeight: 'bold' }}>{formatDuration(adToPurchaseSeconds)} 만에 구매</span>
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: '13px', color: 'rgb(0,0,0)' }}>Direct 방문 (광고 없음)</div>
          )}
        </div>
        
        {/* 구매 정보 카드 */}
        <div style={{
          flex: 1,
          padding: '16px',
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: '8px'
        }}>
          <h4 style={{ 
            fontSize: '14px', 
            fontWeight: 'bold', 
            color: 'rgb(0,0,0)',
            marginBottom: '12px',
            marginTop: 0
          }}>
            구매 정보
          </h4>
          
          <div style={{ fontSize: '13px', marginBottom: '8px' }}>
            <span style={{ color: 'rgb(102,102,102)' }}>상품명: </span>
            <span style={{ color: 'rgb(0,0,0)', fontWeight: 'bold' }}>{order.product_name || '상품명 없음'}</span>
          </div>
          
          <div style={{ fontSize: '13px', marginBottom: '8px' }}>
            <span style={{ color: 'rgb(102,102,102)' }}>구매금액: </span>
            <span style={{ color: 'rgb(24,144,255)', fontWeight: 'bold', fontSize: '16px' }}>{order.final_payment.toLocaleString()}원</span>
          </div>
          
          <div style={{ fontSize: '13px' }}>
            <span style={{ color: 'rgb(102,102,102)' }}>주문시간: </span>
            <span style={{ color: 'rgb(0,0,0)', fontWeight: 'bold' }}>{dayjs(order.timestamp).format('YYYY-MM-DD HH:mm:ss')}</span>
          </div>
        </div>
        
        {/* 고객 분석 카드 */}
        <div style={{
          flex: 1,
          padding: '16px',
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: '8px'
        }}>
          <h4 style={{ 
            fontSize: '14px', 
            fontWeight: 'bold', 
            color: 'rgb(0,0,0)',
            marginBottom: '12px',
            marginTop: 0
          }}>
            고객 분석
          </h4>
          
          <div style={{ fontSize: '13px', marginBottom: '8px' }}>
            <span style={{ color: 'rgb(102,102,102)' }}>구매여정: </span>
            {daysSinceFirstVisit !== null ? (
              <>
                <span style={{ color: 'rgb(0,0,0)' }}>첫 방문 후 </span>
                <span style={{ color: 'rgb(24,144,255)', fontWeight: 'bold' }}>{daysSinceFirstVisit}일</span>
                <span style={{ color: 'rgb(0,0,0)' }}> 만에 구매</span>
              </>
            ) : (
              <span style={{ color: 'rgb(0,0,0)', fontWeight: 'bold' }}>신규 방문</span>
            )}
          </div>
          
          <div style={{ fontSize: '13px', marginBottom: '8px' }}>
            <span style={{ color: 'rgb(102,102,102)' }}>재구매 횟수: </span>
            <span style={{ color: 'rgb(0,0,0)', fontWeight: 'bold' }}>{repurchaseCount}회</span>
          </div>
          
          <div style={{ fontSize: '13px', marginBottom: '8px' }}>
            <span style={{ color: 'rgb(102,102,102)' }}>디바이스: </span>
            <span style={{ color: 'rgb(0,0,0)', fontWeight: 'bold' }}>{order.device_type === 'mobile' ? 'Mobile' : 'PC'}</span>
          </div>
          
          <div style={{ fontSize: '13px' }}>
            <span style={{ color: 'rgb(102,102,102)' }}>페이지 체류시간: </span>
            <span style={{ color: 'rgb(0,0,0)' }}>총 </span>
            <span style={{ color: 'rgb(24,144,255)', fontWeight: 'bold' }}>{formatDuration(totalSeconds)}</span>
            <span style={{ color: 'rgb(0,0,0)' }}>, 평균 </span>
            <span style={{ color: 'rgb(24,144,255)', fontWeight: 'bold' }}>{formatDuration(avgSeconds)}</span>
            <span style={{ color: 'rgb(0,0,0)' }}>, 최대 </span>
            <span style={{ color: 'rgb(24,144,255)', fontWeight: 'bold' }}>{formatDuration(maxSeconds)}</span>
          </div>
        </div>
      </div>

      {/* 페이지 이동 경로 */}
      <div style={{ padding: '0 20px 20px 20px' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center',
          gap: '12px',
          marginBottom: '16px'
        }}>
          <h3 style={{ margin: 0, fontSize: '16px' }}>
            <ClockCircleOutlined /> 구매 당일 경로
          </h3>
          <Tag color="orange" style={{ fontSize: '11px' }}>
            {journeyPages.length}개 페이지 • {formatDuration(totalSeconds)}
          </Tag>
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
        {journeyPages.length > 0 ? (
          <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
            {columns.map((columnItems, colIdx) => (
              <div key={colIdx} style={{ width: '250px', flexShrink: 0 }}>
                <Timeline style={{ fontSize: '12px' }}>
                  {columnItems.map((page, idx) => {
                    const globalIdx = colIdx * MAX_ITEMS_PER_COLUMN + idx;
                    const urlInfo = urlToKorean(page.clean_url || page.page_url, userMappings);
                    const isFirst = globalIdx === 0;
                    const isLast = globalIdx === journeyPages.length - 1;
                    
                    return (
                      <Timeline.Item
                        key={globalIdx}
                        color={isFirst ? 'green' : isLast ? 'red' : 'blue'}
                        style={{ paddingBottom: '8px' }}
                      >
                        <div style={{ minHeight: '50px' }}>
                          <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '12px' }}>
                            {isFirst ? '진입' : isLast ? '구매 완료' : `${globalIdx}단계`}
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
                              {page.page_title}
                            </div>
                          )}

                          {showKoreanUrl ? (
                            <div style={{ 
                              fontSize: '12px', 
                              marginBottom: '4px', 
                              color: '#000'
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
                              {page.time_spent_seconds >= 60 
                                ? `${Math.floor(page.time_spent_seconds / 60)}분 ${page.time_spent_seconds % 60}초`
                                : `${page.time_spent_seconds}초`}
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
        
        {/* 이전 방문 이력 토글 */}
        {previous_visits && previous_visits.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <Button 
              type="text" 
              icon={showPreviousVisits ? <UpOutlined /> : <DownOutlined />}
              onClick={() => setShowPreviousVisits(!showPreviousVisits)}
              style={{ padding: '4px 8px', fontSize: '13px', color: '#666' }}
            >
              {showPreviousVisits ? '이전 방문 이력 접기' : `이전 방문 이력 보기 (${previous_visits.length}회)`}
            </Button>
            
            {showPreviousVisits && (
              <div style={{ marginTop: '16px' }}>
                {previous_visits.map((visit, visitIdx) => {
                  const visitPages = visit.pages || [];
                  const visitColumns = [];
                  const visitColumnCount = Math.ceil(visitPages.length / MAX_ITEMS_PER_COLUMN);
                  
                  for (let i = 0; i < visitColumnCount; i++) {
                    const start = i * MAX_ITEMS_PER_COLUMN;
                    const end = start + MAX_ITEMS_PER_COLUMN;
                    visitColumns.push(visitPages.slice(start, end));
                  }
                  
                  return (
                    <div key={visitIdx} style={{ 
                      marginBottom: '16px',
                      padding: '16px',
                      background: '#fafafa',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb'
                    }}>
                      <div style={{ 
                        display: 'flex', 
                        gap: '12px', 
                        alignItems: 'center',
                        marginBottom: '12px'
                      }}>
                        <h4 style={{ margin: 0, fontSize: '14px', color: '#666' }}>
                          {dayjs(visit.date).format('YYYY-MM-DD')} 방문
                        </h4>
                        <Tag color="default" style={{ fontSize: '10px' }}>
                          {visit.page_count}개 페이지 • {formatDuration(visit.total_duration)}
                        </Tag>
                        <Tag color="default" style={{ fontSize: '10px' }}>
                          구매 안 함
                        </Tag>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                        {visitColumns.map((columnItems, colIdx) => (
                          <div key={colIdx} style={{ width: '250px', flexShrink: 0 }}>
                            <Timeline style={{ fontSize: '12px' }}>
                              {columnItems.map((page, idx) => {
                                const globalIdx = colIdx * MAX_ITEMS_PER_COLUMN + idx;
                                const urlInfo = urlToKorean(page.clean_url || page.page_url, userMappings);
                                const isFirst = globalIdx === 0;
                                const isLast = globalIdx === visitPages.length - 1;
                                
                                return (
                                  <Timeline.Item
                                    key={globalIdx}
                                    color={isFirst ? 'green' : isLast ? 'gray' : 'blue'}
                                    style={{ paddingBottom: '8px' }}
                                  >
                                    <div style={{ minHeight: '50px' }}>
                                      <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '12px', color: '#000' }}>
                                        {isFirst ? '진입' : isLast ? '이탈' : `${globalIdx}단계`}
                                        <span style={{ marginLeft: '6px', color: '#000', fontWeight: 'normal', fontSize: '11px' }}>
                                          {dayjs(page.timestamp).format('HH:mm:ss')}
                                        </span>
                                      </div>
                                      
                                      {page.page_title && page.page_title !== '모아담다 온라인 공식몰' && (
                                        <div style={{ 
                                          fontSize: '11px', 
                                          marginBottom: '3px', 
                                          color: '#000',
                                          fontWeight: '500'
                                        }}>
                                          {page.page_title}
                                        </div>
                                      )}

                                      {showKoreanUrl ? (
                                        <div style={{ 
                                          fontSize: '12px', 
                                          marginBottom: '4px', 
                                          color: '#000'
                                        }}>
                                          {urlInfo.name}
                                        </div>
                                      ) : (
                                        <div 
                                          style={{ 
                                            fontSize: '9px', 
                                            marginBottom: '4px', 
                                            color: '#000',
                                            maxWidth: '250px',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                          }}
                                        >
                                          {page.page_url}
                                        </div>
                                      )}

                                      {page.time_spent_seconds > 0 && (
                                        <Tag 
                                          color="default"
                                          style={{ fontSize: '10px', padding: '0 6px', lineHeight: '18px' }}
                                        >
                                          {page.time_spent_seconds >= 60 
                                            ? `${Math.floor(page.time_spent_seconds / 60)}분 ${page.time_spent_seconds % 60}초`
                                            : `${page.time_spent_seconds}초`}
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
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
  const [userMappings, setUserMappings] = useState({});

  useEffect(() => {
    // 사용자 정의 매핑 로드
    fetch(`${API_URL}/api/mappings/lookup`)
      .then(res => res.json())
      .then(data => setUserMappings(data))
      .catch(err => console.error('매핑 로드 실패:', err));
  }, []);

  return <OrderDetailPageContent orderId={orderId} userMappings={userMappings} />;
}
