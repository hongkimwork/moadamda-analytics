import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Table, DatePicker, Select, Button, Tag, Space, Typography, Descriptions, Timeline, Spin, Alert, Statistic, Row, Col, Tooltip, Modal, message } from 'antd';
import { ReloadOutlined, ArrowLeftOutlined, ClockCircleOutlined, ShoppingOutlined, GlobalOutlined, HistoryOutlined, InfoCircleOutlined, UpOutlined, DownOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import relativeTime from 'dayjs/plugin/relativeTime';
import { urlToKorean } from '../utils/urlToKorean';

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
  const [showPreviousVisits, setShowPreviousVisits] = useState(false);
  const [expandedJourneys, setExpandedJourneys] = useState(['purchase']); // 펼침/축소 상태
  const [selectedStartDate, setSelectedStartDate] = useState(null); // DatePicker 선택 날짜

  useEffect(() => {
    fetchOrderDetail();
  }, [orderId]);

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

  // 실제 구매 상품명을 기준으로 페이지 매핑 테이블에서 직접 매칭 정보 찾기
  const findMatchingMapping = (orderProductName) => {
    if (!orderProductName || !userMappings) {
      return null;
    }

    // userMappings에서 korean_name에 order.product_name이 포함된 매핑 찾기
    const matchedEntry = Object.entries(userMappings).find(([url, mapping]) => {
      // 상품 페이지이고 뱃지가 있는 경우만
      if (!mapping.is_product_page || !mapping.badges?.length) {
        return false;
      }
      
      const koreanName = mapping.korean_name || '';
      
      // 예: "건강을 모아담다 상품 페이지".includes("건강을 모아담다") → true
      return koreanName.includes(orderProductName);
    });
    
    // 매칭된 mapping 객체 반환 (badges 포함)
    return matchedEntry ? matchedEntry[1] : null;
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

  // 체류시간 필터링: 최대 10분(600초)으로 제한 (데이터 검증)
  const validJourneyPages = journeyPages.map(page => ({
    ...page,
    time_spent_seconds: Math.min(page.time_spent_seconds || 0, 600)
  }));

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
          // 같은 URL 연속 방문 - 체류시간만 합산 (최대 600초 제한)
          const combinedTime = (current.time_spent_seconds || 0) + (page.time_spent_seconds || 0);
          current.time_spent_seconds = Math.min(combinedTime, 600);
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
      const deduplicatedPages = removeConcecutiveDuplicates(validJourneyPages);
      const totalDuration = deduplicatedPages.reduce((sum, p) => sum + (p.time_spent_seconds || 0), 0);

      return {
        id: 'purchase',
        date: purchaseDate,
        type: 'purchase',
        dateLabel: purchaseDate,
        pageCount: deduplicatedPages.length,
        duration: formatDuration(totalDuration),
        pages: deduplicatedPages,
        color: '#60a5fa' // 밝은 파스텔 블루 (톤 다운)
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
  const MAX_ITEMS_PER_COLUMN = 6;
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

  // 데이터 검증 (백엔드가 제대로 처리했는지 확인)
  const overLimitPages = journeyPages.filter(p => p.time_spent_seconds > 600);
  if (overLimitPages.length > 0) {
    console.warn('[데이터 검증] 10분 초과 페이지 발견 (필터링 적용됨):', overLimitPages);
  }

  // 체류시간 계산 (이미 필터링된 validJourneyPages 사용)
  const totalSeconds = validJourneyPages.reduce((sum, p) => sum + (p.time_spent_seconds || 0), 0);
  const avgSeconds = validJourneyPages.length > 0 ? Math.round(totalSeconds / validJourneyPages.length) : 0;
  const maxPage = validJourneyPages.reduce((max, p) =>
    (p.time_spent_seconds || 0) > (max.time_spent_seconds || 0) ? p : max,
    { time_spent_seconds: 0 }
  );
  const maxSeconds = maxPage.time_spent_seconds || 0;

  // 최종 검증
  if (totalSeconds > 3600) {
    console.warn('[데이터 검증] 비정상적으로 긴 총 체류시간:', totalSeconds, '초');
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
    <div style={{ background: '#fafbfc', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더: 제목 + DatePicker + 미니 카드들 + URL 토글 + 닫기 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 24px',
        background: 'linear-gradient(to bottom, #ffffff 0%, #fafbfc 100%)',
        borderBottom: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        gap: '20px',
        overflowX: 'auto'
      }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <h3 style={{ 
            margin: 0, 
            fontSize: '20px', 
            fontWeight: '700', 
            whiteSpace: 'nowrap',
            color: '#1f2937',
            letterSpacing: '-0.02em'
          }}>
            고객 여정 분석
          </h3>
          <DatePicker
            placeholder="시작 날짜 선택"
            style={{ 
              width: 200,
              borderRadius: '8px',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
            }}
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
            gap: '10px'
          }}>
            {allJourneys.map(journey => {
              const isExpanded = expandedJourneys.includes(journey.id);
              return (
                <div
                  key={journey.id}
                  onClick={() => toggleJourney(journey.id)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '10px',
                    border: isExpanded ? `2px solid ${journey.color}` : '1.5px solid #e5e7eb',
                    background: isExpanded 
                      ? journey.type === 'purchase'
                        ? 'linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)'
                        : 'linear-gradient(135deg, #f3f4f6 0%, #f9fafb 100%)'
                      : 'white',
                    cursor: 'pointer',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    minWidth: '110px',
                    textAlign: 'center',
                    boxShadow: isExpanded 
                      ? '0 8px 16px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)' 
                      : '0 1px 3px rgba(0, 0, 0, 0.06)',
                    transform: isExpanded ? 'translateY(-3px) scale(1.02)' : 'none',
                    whiteSpace: 'nowrap',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onMouseEnter={(e) => {
                    if (!isExpanded) {
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.12)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.borderColor = journey.color;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isExpanded) {
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.06)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.borderColor = '#e5e7eb';
                    }
                  }}
                >
                  {/* 활성 인디케이터 */}
                  {isExpanded && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '3px',
                      background: `linear-gradient(90deg, ${journey.color}, ${journey.color}dd)`,
                      borderRadius: '10px 10px 0 0'
                    }} />
                  )}
                  
                  <div style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#1f2937',
                    marginBottom: '4px',
                    letterSpacing: '-0.01em'
                  }}>
                    {journey.dateLabel}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    color: journey.type === 'purchase' ? '#2563eb' : '#6b7280',
                    letterSpacing: '0.01em'
                  }}>
                    {journey.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {onClose && (
          <Button
            type="text"
            icon={<span style={{ fontSize: '24px', lineHeight: 1 }}>×</span>}
            onClick={onClose}
            style={{ 
              fontSize: '24px', 
              padding: '8px 12px',
              borderRadius: '8px',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#fee2e2';
              e.currentTarget.style.color = '#dc2626';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'rgba(0, 0, 0, 0.45)';
            }}
          />
        )}
      </div>

      {/* 펼쳐진 여정 표시 영역 */}
      <div style={{
        flex: 1,
        overflowX: 'auto',
        overflowY: 'auto',
        padding: '20px 24px',
        background: '#fafbfc'
      }}>
        {expandedJourneys.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '80px 60px',
            background: 'white',
            borderRadius: '16px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            border: '1px solid #e5e7eb',
            margin: '20px auto',
            maxWidth: '500px'
          }}>
            <div style={{
              fontSize: '48px',
              marginBottom: '16px',
              opacity: 0.6
            }}>
              📊
            </div>
            <p style={{ 
              fontSize: '16px',
              fontWeight: '600',
              color: '#374151',
              margin: '0 0 8px 0'
            }}>
              고객 여정을 선택해주세요
            </p>
            <p style={{
              fontSize: '14px',
              color: '#9ca3af',
              margin: 0
            }}>
              상단 카드를 클릭하여 상세한 여정을 확인할 수 있습니다
            </p>
          </div>
        ) : (
          (() => {
            const expandedJourneysList = allJourneys.filter(journey => expandedJourneys.includes(journey.id));
            const isLongJourney = expandedJourneysList.length === 1 && expandedJourneysList[0].pages.length >= 34;
            const shouldCenterAlign = expandedJourneys.length === 1 && !isLongJourney;

            return (
              <div style={{
                display: 'flex',
                gap: '20px',
                alignItems: 'flex-start',
                justifyContent: shouldCenterAlign ? 'center' : 'flex-start'
              }}>
                {expandedJourneysList.map(journey => {
                  const columns = getColumns(journey.pages);
                  return (
                    <div
                      key={journey.id}
                      style={{
                        border: `2px solid ${journey.color}40`,
                        borderRadius: '16px',
                        padding: '20px 24px',
                        background: 'white',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)',
                        flex: '0 0 auto',
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                    >
                      {/* 상단 컬러 인디케이터 */}
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '4px',
                        background: `linear-gradient(90deg, ${journey.color}, ${journey.color}cc)`
                      }} />
                      
                      {/* 여정 헤더 */}
                      <div style={{
                        marginBottom: '20px',
                        paddingBottom: '16px',
                        borderBottom: `1px solid ${journey.color}20`
                      }}>
                        <h3 style={{ 
                          margin: 0, 
                          fontSize: '15px', 
                          fontWeight: '700', 
                          color: journey.color,
                          letterSpacing: '-0.01em'
                        }}>
                          {journey.label}
                        </h3>
                      </div>

                      {/* 타임라인 */}
                      {journey.pages.length > 0 ? (
                        <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                          {columns.map((columnItems, colIdx) => (
                            <div key={colIdx} style={{ width: '190px', flexShrink: 0 }}>
                              <Timeline style={{ fontSize: '11px' }}>
                                {columnItems.map((page, idx) => {
                                  const globalIdx = colIdx * MAX_ITEMS_PER_COLUMN + idx;
                                  const urlInfo = urlToKorean(page.clean_url || page.page_url, userMappings);
                                  const isFirst = globalIdx === 0;
                                  const isLast = globalIdx === journey.pages.length - 1;

                                  // 체류시간 배지 스타일 (심플한 색상)
                                  const durationSeconds = page.time_spent_seconds || 0;
                                  const badgeStyle = durationSeconds >= 30
                                    ? { 
                                        background: '#dbeafe', 
                                        color: '#1e40af'
                                      }
                                    : durationSeconds >= 10
                                      ? { 
                                          background: '#fef3c7', 
                                          color: '#92400e'
                                        }
                                      : { 
                                          background: '#fecaca', 
                                          color: '#dc2626'
                                        };

                                  // 이탈 여부 판단
                                  const isExit = isLast && journey.type !== 'purchase';
                                  const isPurchaseComplete = isLast && journey.type === 'purchase';

                                  // 체류시간 텍스트 (구매 완료 카드는 제외)
                                  const durationText = isPurchaseComplete
                                    ? ''
                                    : durationSeconds >= 60
                                      ? `${Math.floor(durationSeconds / 60)}분 ${durationSeconds % 60}초 체류`
                                      : durationSeconds >= 1
                                        ? `${durationSeconds}초 체류`
                                        : '1초미만 체류';

                                  // 카드 스타일 (더욱 세련된 디자인)
                                  const cardStyle = {
                                    border: isExit 
                                      ? '1px solid rgba(248, 113, 113, 0.25)' 
                                      : isPurchaseComplete
                                        ? '1px solid rgba(59, 130, 246, 0.25)'
                                        : '1px solid rgba(229, 231, 235, 0.8)',
                                    borderLeft: isExit 
                                      ? '4px solid #ef4444' 
                                      : isPurchaseComplete
                                        ? '4px solid #3b82f6'
                                        : '3px solid rgba(209, 213, 219, 0.6)',
                                    borderRadius: '12px',
                                    padding: '14px 16px',
                                    background: isExit 
                                      ? 'linear-gradient(135deg, #fef2f2 0%, #fff 100%)' 
                                      : isPurchaseComplete
                                        ? 'linear-gradient(135deg, #eff6ff 0%, #fff 100%)'
                                        : 'linear-gradient(135deg, #ffffff 0%, #fafbfc 100%)',
                                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.03)',
                                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                    cursor: 'default',
                                    marginBottom: '14px',
                                    position: 'relative'
                                  };

                                  return (
                                    <Timeline.Item
                                      key={globalIdx}
                                      color={isExit ? 'red' : 'gray'}
                                      style={{ paddingBottom: '0px' }}
                                    >
                                      <div
                                        style={cardStyle}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)';
                                          e.currentTarget.style.transform = 'translateY(-2px) translateX(2px)';
                                          e.currentTarget.style.borderColor = isExit 
                                            ? 'rgba(248, 113, 113, 0.4)' 
                                            : isPurchaseComplete
                                              ? 'rgba(59, 130, 246, 0.4)'
                                              : 'rgba(209, 213, 219, 1)';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.03)';
                                          e.currentTarget.style.transform = 'translateY(0) translateX(0)';
                                          e.currentTarget.style.borderColor = isExit 
                                            ? 'rgba(248, 113, 113, 0.25)' 
                                            : isPurchaseComplete
                                              ? 'rgba(59, 130, 246, 0.25)'
                                              : 'rgba(229, 231, 235, 0.8)';
                                        }}
                                      >
                                        {/* 체류시간 배지 - 우측 상단 고정 */}
                                        {durationText && (
                                          <span style={{
                                            ...badgeStyle,
                                            padding: '1px 6px',
                                            borderRadius: '3px',
                                            fontSize: '10px',
                                            fontWeight: '500',
                                            position: 'absolute',
                                            top: '10px',
                                            right: '10px',
                                            letterSpacing: '0.01em'
                                          }}>
                                            {durationText}
                                          </span>
                                        )}

                                        {/* 콘텐츠 wrapper */}
                                        <div style={{ paddingBottom: '14px' }}>
                                          {/* 첫 줄: 단계 */}
                                          <div style={{ marginBottom: '8px' }}>
                                            <span style={{
                                              fontSize: '13px',
                                              fontWeight: '700',
                                              color: isExit 
                                                ? '#dc2626' 
                                                : isPurchaseComplete
                                                  ? '#2563eb'
                                                  : '#374151',
                                              letterSpacing: '-0.01em'
                                            }}>
                                              {journey.type === 'purchase' ? (isLast ? `${globalIdx + 1}단계: 구매 완료` : `${globalIdx + 1}단계`) : (isLast ? '이탈' : `${globalIdx + 1}단계`)}
                                            </span>
                                          </div>

                                          {/* 구매 완료 단계 - 제품 뱃지 먼저 표시 */}
                                          {journey.type === 'purchase' && isLast && (() => {
                                            const orderProductName = order.product_name;
                                            if (!orderProductName || orderProductName === '상품명 없음') {
                                              return null;
                                            }
                                            const matchedMapping = findMatchingMapping(orderProductName);
                                            
                                            // 제품 뱃지가 있으면 표시
                                            if (matchedMapping?.badges && matchedMapping.badges.length > 0) {
                                              return (
                                                <div style={{
                                                  fontSize: '10px',
                                                  marginBottom: '6px',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  gap: '4px',
                                                  flexWrap: 'wrap'
                                                }}>
                                                  <span style={{ 
                                                    color: '#6b7280', 
                                                    fontWeight: '500',
                                                    fontSize: '10px'
                                                  }}>
                                                    제품:
                                                  </span>
                                                  {matchedMapping.badges.map((badge, idx) => (
                                                    <span
                                                      key={idx}
                                                      style={{
                                                        display: 'inline-block',
                                                        padding: '1px 6px',
                                                        borderRadius: '3px',
                                                        fontSize: '10px',
                                                        fontWeight: '600',
                                                        color: '#fff',
                                                        backgroundColor: badge.color,
                                                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                                      }}
                                                    >
                                                      {badge.text}
                                                    </span>
                                                  ))}
                                                </div>
                                              );
                                            }
                                            return null;
                                          })()}

                                          {/* 상품 페이지 뱃지 표시 (페이지 매핑 기반) */}
                                          {(() => {
                                            // 페이지 매핑에서 is_product_page로 설정된 경우에만 표시
                                            if (urlInfo.isProductPage) {
                                              // 다중 배지 지원: badges 배열 우선, 없으면 단일 badge 폴백
                                              const badgesToDisplay = urlInfo.badges && urlInfo.badges.length > 0
                                                ? urlInfo.badges
                                                : (urlInfo.badgeText ? [{ text: urlInfo.badgeText, color: urlInfo.badgeColor || '#1677ff' }] : []);

                                              if (badgesToDisplay.length > 0) {
                                                return (
                                                  <div style={{
                                                    fontSize: '10px',
                                                    marginBottom: '6px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    flexWrap: 'wrap'
                                                  }}>
                                                    <span style={{ 
                                                      color: '#6b7280', 
                                                      fontWeight: '500',
                                                      fontSize: '10px'
                                                    }}>
                                                      제품:
                                                    </span>
                                                    {badgesToDisplay.map((badge, idx) => (
                                                      <span
                                                        key={idx}
                                                        style={{
                                                          display: 'inline-block',
                                                          padding: '1px 6px',
                                                          borderRadius: '3px',
                                                          fontSize: '10px',
                                                          fontWeight: '600',
                                                          color: '#fff',
                                                          backgroundColor: badge.color,
                                                          boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                                        }}
                                                      >
                                                        {badge.text}
                                                      </span>
                                                    ))}
                                                  </div>
                                                );
                                              }
                                            }
                                            return null;
                                          })()}

                                          {/* 페이지명 (한글 이름) */}
                                          <div style={{
                                            fontSize: '12px',
                                            color: '#111827',
                                            lineHeight: '1.5',
                                            fontWeight: '600',
                                            letterSpacing: '-0.01em',
                                            marginBottom: isPurchaseComplete ? '8px' : '0'
                                          }}>
                                            <span style={{ 
                                              color: '#6b7280', 
                                              fontWeight: '500', 
                                              marginRight: '6px',
                                              fontSize: '11px'
                                            }}>
                                              경로:
                                            </span>
                                            <span style={{ color: '#1f2937' }}>
                                              {urlInfo.name}
                                            </span>
                                          </div>

                                          {/* 구매 완료 단계 - 구매한 상품명 맨 마지막에 표시 */}
                                          {isPurchaseComplete && (() => {
                                            const orderProductName = order.product_name;
                                            if (!orderProductName || orderProductName === '상품명 없음') {
                                              return null;
                                            }

                                            return (
                                              <div style={{
                                                fontSize: '11px',
                                                marginBottom: '0',
                                                padding: '6px 10px',
                                                background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                                                borderRadius: '6px',
                                                border: '1px solid #bae6fd'
                                              }}>
                                                <span style={{ 
                                                  color: '#0c4a6e', 
                                                  fontWeight: '600',
                                                  fontSize: '11px'
                                                }}>
                                                  구매한 상품: 
                                                </span>
                                                <span style={{ 
                                                  color: '#0c4a6e', 
                                                  fontWeight: '700', 
                                                  fontSize: '11px',
                                                  marginLeft: '4px'
                                                }}>
                                                  {orderProductName}
                                                </span>
                                              </div>
                                            );
                                          })()}
                                        </div>

                                        {/* 지구본 아이콘 - 우측 하단 */}
                                        <GlobalOutlined
                                          style={{
                                            position: 'absolute',
                                            right: '10px',
                                            bottom: '10px',
                                            fontSize: '16px',
                                            color: '#9ca3af',
                                            cursor: 'pointer',
                                            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                            opacity: 0.5,
                                            padding: '4px',
                                            borderRadius: '50%',
                                            background: 'transparent'
                                          }}
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'translateY(-2px) scale(1.1)';
                                            e.currentTarget.style.color = '#3b82f6';
                                            e.currentTarget.style.opacity = '1';
                                            e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                            e.currentTarget.style.color = '#9ca3af';
                                            e.currentTarget.style.opacity = '0.5';
                                            e.currentTarget.style.background = 'transparent';
                                          }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            window.open(page.page_url, '_blank');
                                          }}
                                        />
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
              </div >
            );
          })()
        )}
      </div >
    </div >
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