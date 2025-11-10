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
        title={null}
        open={isModalOpen}
        onCancel={handleCloseModal}
        footer={null}
        width="95vw"
        style={{ top: '2.5vh', padding: 0, maxWidth: '95vw', margin: '0 auto', left: 0, right: 0 }}
        styles={{ body: { padding: 0, height: 'calc(95vh - 55px)', overflow: 'hidden' } }}
        destroyOnClose={true}
        closable={false}
      >
        {selectedOrderId && (
          <OrderDetailPageContent 
            orderId={selectedOrderId} 
            userMappings={userMappings} 
            onClose={handleCloseModal}
          />
        )}
      </Modal>
    </div>
  );
}

// ============================================================================
// 주문 상세 페이지 콘텐츠 (모달과 페이지에서 공통 사용)
// ============================================================================
export function OrderDetailPageContent({ orderId, userMappings = {}, onClose = null }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [showKoreanUrl, setShowKoreanUrl] = useState(getUrlDisplayMode() === 'korean');
  const [showPreviousVisits, setShowPreviousVisits] = useState(false);
  const [expandedJourneys, setExpandedJourneys] = useState(['purchase']); // 펼침/축소 상태
  const [selectedStartDate, setSelectedStartDate] = useState(null); // DatePicker 선택 날짜

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
  
  // 시간 포맷 함수 (먼저 정의)
  const formatDuration = (seconds) => {
    if (seconds >= 60) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}분 ${secs}초`;
    }
    return `${seconds}초`;
  };
  
  // 연속 중복 페이지 제거 함수 (같은 URL 연속 방문 시 하나로 통합 + 체류시간 합산)
  const removeConcecutiveDuplicates = (pages) => {
    if (!pages || pages.length === 0) return [];
    
    const result = [];
    let current = null;
    
    for (const page of pages) {
      const currentUrl = page.clean_url || page.page_url;
      
      if (!current) {
        // 첫 페이지 - 깊은 복사로 시작
        current = { ...page };
      } else {
        const prevUrl = current.clean_url || current.page_url;
        
        if (currentUrl === prevUrl) {
          // 같은 URL 연속 방문 - 체류시간만 합산
          current.time_spent_seconds = (current.time_spent_seconds || 0) + (page.time_spent_seconds || 0);
          // timestamp는 첫 방문 시간 유지
        } else {
          // 다른 URL - 이전 것을 결과에 추가하고 새로 시작
          result.push(current);
          current = { ...page };
        }
      }
    }
    
    // 마지막 페이지 추가
    if (current) {
      result.push(current);
    }
    
    return result;
  };
  
  // 구매일 계산 (order.timestamp 사용)
  const purchaseDate = dayjs(order.timestamp).format('YYYY-MM-DD');
  
  // 이전 방문 필터링 로직 (기본 7일 or 사용자 선택 날짜)
  let filteredPreviousVisits = [];
  if (previous_visits && previous_visits.length > 0) {
    const purchaseDateObj = dayjs(order.timestamp);
    
    filteredPreviousVisits = previous_visits.filter(visit => {
      const visitDate = dayjs(visit.date);
      
      // 구매일 이후 방문은 제외 (데이터 무결성 체크)
      if (visitDate.isAfter(purchaseDateObj, 'day') || visitDate.isSame(purchaseDateObj, 'day')) {
        return false;
      }
      
      if (!selectedStartDate) {
        // 기본: 구매일 기준 최근 7일
        const sevenDaysAgo = purchaseDateObj.subtract(7, 'day');
        return visitDate.isAfter(sevenDaysAgo, 'day');
      } else {
        // 사용자 선택: 선택한 날짜 이후
        return visitDate.isAfter(selectedStartDate, 'day') || visitDate.isSame(selectedStartDate, 'day');
      }
    });
  }

  // 펼침/축소 토글 함수
  const toggleJourney = (journeyId) => {
    setExpandedJourneys(prev => 
      prev.includes(journeyId)
        ? prev.filter(id => id !== journeyId) // 축소
        : [...prev, journeyId] // 펼침
    );
  };

  // 모든 여정 통합 (연속 중복 제거 후 시간순 정렬 및 방문 순서 부여)
  const journeys = [
    // 필터링된 이전 방문들 (연속 중복 제거 적용)
    ...filteredPreviousVisits.map((visit) => {
      const deduplicatedPages = removeConcecutiveDuplicates(visit.pages || []);
      const totalDuration = deduplicatedPages.reduce((sum, p) => sum + (p.time_spent_seconds || 0), 0);
      
      return {
        id: `visit-${visit.date}`,
        date: visit.date,
        type: 'visit',
        dateLabel: dayjs(visit.date).format('YYYY-MM-DD'),
        pageCount: deduplicatedPages.length,
        duration: formatDuration(totalDuration),
        pages: deduplicatedPages,
        color: '#9ca3af' // 회색
      };
    }),
    // 구매 당일 (연속 중복 제거 적용)
    (() => {
      const deduplicatedPages = removeConcecutiveDuplicates(journeyPages);
      const totalDuration = deduplicatedPages.reduce((sum, p) => sum + (p.time_spent_seconds || 0), 0);
      
      return {
        id: 'purchase',
        date: purchaseDate,
        type: 'purchase',
        dateLabel: purchaseDate,
        pageCount: deduplicatedPages.length,
        duration: formatDuration(totalDuration),
        pages: deduplicatedPages,
        color: '#3b82f6' // 파란색
      };
    })()
  ];
  
  // 시간순 정렬 후 방문 순서 부여
  const allJourneys = journeys
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((journey, idx) => ({
      ...journey,
      visitNumber: idx + 1,
      label: journey.type === 'purchase' 
        ? `${idx + 1}차 방문 (구매)` 
        : `${idx + 1}차 방문 (이탈)`
    }));

  // 타임라인 다단 배치 계산 함수
  const MAX_ITEMS_PER_COLUMN = 7;
  const getColumns = (pages) => {
    const columnCount = Math.ceil(pages.length / MAX_ITEMS_PER_COLUMN);
    const columns = [];
    for (let i = 0; i < columnCount; i++) {
      const start = i * MAX_ITEMS_PER_COLUMN;
      const end = start + MAX_ITEMS_PER_COLUMN;
      columns.push(pages.slice(start, end));
    }
    return columns;
  };

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
    <div style={{ background: '#fff', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더: 제목 + DatePicker + 미니 카드들 + URL 토글 + 닫기 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 20px',
        borderBottom: '2px solid #e5e7eb',
        gap: '20px',
        overflowX: 'auto'
      }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
            고객 여정 분석
          </h3>
          <DatePicker 
            placeholder="시작 날짜 선택" 
            style={{ width: 200 }}
            onChange={(date) => setSelectedStartDate(date)}
            disabledDate={(current) => {
              if (!current) return false;
              const purchaseDateObj = dayjs(order.timestamp);
              // 구매일 이후는 선택 불가
              return current.isAfter(purchaseDateObj, 'day');
            }}
            value={selectedStartDate}
            allowClear
            format="YYYY-MM-DD"
          />
          
          {/* 미니 카드들 */}
          <div style={{
            display: 'flex',
            gap: '12px'
          }}>
            {allJourneys.map(journey => {
              const isExpanded = expandedJourneys.includes(journey.id);
              return (
                <div
                  key={journey.id}
                  onClick={() => toggleJourney(journey.id)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: isExpanded ? `3px solid ${journey.color}` : '2px solid #e5e7eb',
                    background: isExpanded ? '#f9fafb' : 'white',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    minWidth: '100px',
                    textAlign: 'center',
                    boxShadow: isExpanded ? '0 4px 12px rgba(0,0,0,0.1)' : '0 2px 4px rgba(0,0,0,0.05)',
                    transform: isExpanded ? 'translateY(-2px)' : 'none',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={(e) => {
                    if (!isExpanded) {
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isExpanded) {
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                    }
                  }}
                >
                  <div style={{ 
                    fontSize: '12px', 
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '4px'
                  }}>
                    {journey.dateLabel}
                  </div>
                  <div style={{ 
                    fontSize: '11px', 
                    fontWeight: 'bold',
                    color: journey.type === 'purchase' ? '#3b82f6' : '#9ca3af'
                  }}>
                    {journey.label}
                  </div>
                </div>
              );
            })}
          </div>
          
          <Space size="small" style={{ whiteSpace: 'nowrap' }}>
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
        {onClose && (
          <Button 
            type="text" 
            icon={<span style={{ fontSize: '20px' }}>×</span>}
            onClick={onClose}
            style={{ fontSize: '20px', padding: '4px 8px' }}
          />
        )}
      </div>

      {/* 펼쳐진 여정 표시 영역 */}
      <div style={{ 
        flex: 1,
        overflowX: 'auto',
        overflowY: 'auto',
        padding: '12px 20px'
      }}>
        {expandedJourneys.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '60px',
            color: '#9ca3af'
          }}>
            <p style={{ fontSize: '16px' }}>상단 카드를 클릭하여 고객 여정을 펼쳐보세요</p>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
            {allJourneys
              .filter(journey => expandedJourneys.includes(journey.id))
              .map(journey => {
                const columns = getColumns(journey.pages);
                return (
                  <div
                    key={journey.id}
                    style={{
                      border: `3px solid ${journey.color}`,
                      borderRadius: '12px',
                      padding: '12px 16px',
                      background: 'white',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      flex: '0 0 auto'
                    }}
                  >
                    {/* 여정 헤더 */}
                    <div style={{
                      marginBottom: '16px',
                      paddingBottom: '12px',
                      borderBottom: `2px solid ${journey.color}`
                    }}>
                      <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: journey.color }}>
                        {journey.label}
                      </h3>
                    </div>

                    {/* 타임라인 */}
                    {journey.pages.length > 0 ? (
                      <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                        {columns.map((columnItems, colIdx) => (
                          <div key={colIdx} style={{ width: '180px', flexShrink: 0 }}>
                            <Timeline style={{ fontSize: '11px' }}>
                              {columnItems.map((page, idx) => {
                                const globalIdx = colIdx * MAX_ITEMS_PER_COLUMN + idx;
                                const urlInfo = urlToKorean(page.clean_url || page.page_url, userMappings);
                                const isFirst = globalIdx === 0;
                                const isLast = globalIdx === journey.pages.length - 1;
                                
                                // 체류시간 배지 스타일
                                const durationSeconds = page.time_spent_seconds || 0;
                                const badgeStyle = durationSeconds >= 60 
                                  ? { background: '#fecaca', color: '#dc2626' }
                                  : durationSeconds >= 10
                                  ? { background: '#fed7aa', color: '#c2410c' }
                                  : { background: '#f3f4f6', color: '#6b7280' };
                                
                                const durationText = durationSeconds > 0
                                  ? durationSeconds >= 60 
                                    ? `${Math.floor(durationSeconds / 60)}분 ${durationSeconds % 60}초 체류`
                                    : `${durationSeconds}초 체류`
                                  : '';
                                
                                // 이탈 여부 판단
                                const isExit = isLast && journey.type !== 'purchase';
                                
                                // 카드 스타일
                                const cardStyle = {
                                  border: isFirst ? '2px solid #22c55e' : isExit ? '2px solid #dc2626' : isLast ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                                  borderLeft: isFirst ? '4px solid #22c55e' : isExit ? '4px solid #dc2626' : isLast ? '4px solid #3b82f6' : '1px solid #e5e7eb',
                                  borderRadius: '6px',
                                  padding: '8px',
                                  background: isFirst ? '#f0fdf4' : isExit ? '#fef2f2' : isLast ? '#eff6ff' : 'white',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                  transition: 'all 0.2s',
                                  cursor: 'default',
                                  marginBottom: '10px'
                                };
                                
                                return (
                                  <Timeline.Item
                                    key={globalIdx}
                                    color={isFirst ? 'green' : isExit ? 'red' : isLast ? 'blue' : 'gray'}
                                    style={{ paddingBottom: '0px' }}
                                  >
                                    <div 
                                      style={cardStyle}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                      }}
                                    >
                                      {/* 첫 줄: 단계 + 체류시간 */}
                                      <div style={{ marginBottom: '6px' }}>
                                        <span style={{ 
                                          fontSize: '13px', 
                                          fontWeight: 'bold',
                                          color: isFirst ? '#166534' : isExit ? '#991b1b' : isLast ? '#1e40af' : '#374151'
                                        }}>
                                          {journey.type === 'purchase' ? (isLast ? '구매 완료' : `${globalIdx + 1}단계`) : (isLast ? '이탈' : `${globalIdx + 1}단계`)}
                                        </span>
                                        {durationText && (
                                          <span style={{
                                            ...badgeStyle,
                                            padding: '1px 6px',
                                            borderRadius: '3px',
                                            fontSize: '10px',
                                            fontWeight: '500',
                                            marginLeft: '4px'
                                          }}>
                                            {durationText}
                                          </span>
                                        )}
                                      </div>
                                      
                                      {/* 상품명 (상품 상세 페이지만) */}
                                      {(() => {
                                        const title = page.page_title || '';
                                        const pageName = urlInfo.name || '';
                                        
                                        // 제외할 패턴들 (title 기준)
                                        const excludedTitlePatterns = [
                                          '전체상품',
                                          '이벤트 |',
                                          '모아담다 온라인 공식몰',
                                          '카테고리',
                                          '마이페이지',
                                          '장바구니',
                                          '주문',
                                          '결제',
                                          '로그인',
                                          '회원'
                                        ];
                                        
                                        const isExcludedByTitle = excludedTitlePatterns.some(pattern => 
                                          title.includes(pattern)
                                        );
                                        
                                        // 상세페이지 판단 (매핑 이름 기준)
                                        const isDetailPage = pageName.includes('상세페이지');
                                        
                                        if (title && !isExcludedByTitle && isDetailPage) {
                                          return (
                                            <div style={{ 
                                              fontSize: '10px', 
                                              marginBottom: '3px'
                                            }}>
                                              <span style={{ color: '#9ca3af' }}>상품명: </span>
                                              <span style={{ color: '#f97316', fontWeight: '600', fontSize: '11px' }}>
                                                {title}
                                              </span>
                                            </div>
                                          );
                                        }
                                        return null;
                                      })()}

                                      {/* 페이지명 또는 URL */}
                                      {showKoreanUrl ? (
                                        <div style={{ 
                                          fontSize: '12px', 
                                          color: '#1f2937',
                                          lineHeight: '1.4'
                                        }}>
                                          <span style={{ color: '#9ca3af', fontSize: '10px' }}>방문: </span>
                                          {urlInfo.name.replace(/_모바일$|_PC$/g, '')}
                                        </div>
                                      ) : (
                                        <div 
                                          style={{ 
                                            fontSize: '9px', 
                                            color: '#6b7280',
                                            maxWidth: '100%',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            cursor: 'pointer',
                                            padding: '3px 5px',
                                            background: '#f9fafb',
                                            borderRadius: '3px',
                                            border: '1px solid #e5e7eb'
                                          }}
                                          title="더블클릭하면 복사됩니다"
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
                );
              })}
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