import { Modal, Table, Typography, Spin, Empty, Statistic, Row, Col, Tag, Tooltip, Card, Tabs, Select } from 'antd';
import { ShoppingCartOutlined, QuestionCircleOutlined, EyeOutlined, ExclamationCircleOutlined, TeamOutlined } from '@ant-design/icons';
import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import { OrderDetailPageContent } from '../pages/OrderAnalysis/OrderDetailPage';
import { useUserMappings } from '../hooks/useUserMappings';

const { Text, Title } = Typography;
const API_URL = import.meta.env.VITE_API_URL || '';

// 이상치 기준 옵션 생성 (5분~2시간30분, 5분 단위)
const durationOptions = [];
for (let minutes = 5; minutes <= 150; minutes += 5) {
  const seconds = minutes * 60;
  const label = minutes < 60 
    ? `${minutes}분` 
    : minutes % 60 === 0 
      ? `${Math.floor(minutes / 60)}시간`
      : `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`;
  durationOptions.push({ value: seconds, label });
}

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
  const [trafficStats, setTrafficStats] = useState({
    total_views: 0,
    unique_visitors: 0,
    avg_pageviews: 0,
    avg_duration_seconds: 0
  });
  
  // 전체 트래픽 탭 state
  const [activeTab, setActiveTab] = useState('orders');
  const [trafficLoading, setTrafficLoading] = useState(false);
  const [trafficSessions, setTrafficSessions] = useState([]);
  const [trafficPagination, setTrafficPagination] = useState({ page: 1, limit: 50, total: 0 });
  const [trafficFilter, setTrafficFilter] = useState('all');
  
  // 이상치 기준 state (초 단위, 기본값 5분=300초)
  const [orderMaxDuration, setOrderMaxDuration] = useState(300);
  
  // 고객 여정 분석 모달 state
  const [journeyModalVisible, setJourneyModalVisible] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const { userMappings } = useUserMappings();

  useEffect(() => {
    if (visible && creative) {
      fetchOrders();
      fetchTrafficStats();
      setActiveTab('orders');
      setTrafficFilter('all');
    }
  }, [visible, creative]);

  // 전체 트래픽 탭 선택 시 데이터 로드
  useEffect(() => {
    if (activeTab === 'traffic' && creative && dateRange) {
      fetchTrafficSessions(1, trafficFilter);
    }
  }, [activeTab]);

  // 필터 변경 시 데이터 다시 로드
  useEffect(() => {
    if (activeTab === 'traffic' && creative && dateRange) {
      fetchTrafficSessions(1, trafficFilter);
    }
  }, [trafficFilter]);

  // 이상치 기준 변경 시 데이터 다시 로드
  useEffect(() => {
    if (visible && creative && dateRange) {
      fetchOrders();
    }
  }, [orderMaxDuration]);

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
        max_duration: orderMaxDuration
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

  const fetchTrafficStats = async () => {
    if (!creative || !dateRange) return;
    try {
      const response = await axios.post(`${API_URL}/api/creative-performance/raw-traffic`, {
        creative_name: creative.creative_name,
        utm_source: creative.utm_source,
        utm_medium: creative.utm_medium,
        utm_campaign: creative.utm_campaign,
        start: dateRange.start,
        end: dateRange.end,
        page: 1,
        limit: 1
      });
      if (response.data.success) {
        setTrafficStats(response.data.summary || {});
      }
    } catch (error) {
      console.error('트래픽 통계 조회 실패:', error);
    }
  };

  const fetchTrafficSessions = async (page = 1, filter = 'all') => {
    if (!creative || !dateRange) return;
    setTrafficLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/creative-performance/raw-traffic`, {
        creative_name: creative.creative_name,
        utm_source: creative.utm_source,
        utm_medium: creative.utm_medium,
        utm_campaign: creative.utm_campaign,
        start: dateRange.start,
        end: dateRange.end,
        page,
        limit: 50,
        filter
      });
      if (response.data.success) {
        setTrafficSessions(response.data.sessions || []);
        setTrafficPagination(response.data.pagination || { page: 1, limit: 50, total: 0 });
      }
    } catch (error) {
      console.error('트래픽 세션 조회 실패:', error);
      setTrafficSessions([]);
    } finally {
      setTrafficLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount) return '0원';
    return `${parseInt(amount).toLocaleString()}원`;
  };

  const formatDuration = (seconds) => {
    if (!seconds || seconds <= 0) return '0초';
    if (seconds < 60) return `${Math.round(seconds)}초`;
    if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      return secs > 0 ? `${mins}분 ${secs}초` : `${mins}분`;
    }
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
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
          <span>광고 노출일 <QuestionCircleOutlined style={{ fontSize: 13, color: '#000000' }} /></span>
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
          <span>노출→구매 <QuestionCircleOutlined style={{ fontSize: 13, color: '#000000' }} /></span>
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
        <Tooltip title="이 광고로 유입 시 방문자가 본 페이지 수">
          <span>세션PV <QuestionCircleOutlined style={{ fontSize: 13, color: '#000000' }} /></span>
        </Tooltip>
      ),
      dataIndex: 'session_pageviews',
      key: 'session_pageviews',
      width: 70,
      align: 'center',
      render: (pv) => (
        <Text style={{ 
          fontSize: 12, 
          color: pv >= 5 ? '#389e0d' : pv >= 2 ? '#1677ff' : '#000000',
          fontWeight: pv >= 5 ? 600 : 400 
        }}>
          {pv || 0}
        </Text>
      )
    },
    {
      title: (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <Tooltip title="이 광고로 유입된 모든 방문의 총 체류시간 (이상치 기준 선택 가능)">
            <span>총 체류 <QuestionCircleOutlined style={{ fontSize: 13, color: '#000000' }} /></span>
          </Tooltip>
          <Select
            size="small"
            value={orderMaxDuration}
            onChange={setOrderMaxDuration}
            options={durationOptions}
            style={{ width: 80, fontSize: 10 }}
            onClick={(e) => e.stopPropagation()}
            popupMatchSelectWidth={false}
          />
        </div>
      ),
      dataIndex: 'session_duration',
      key: 'session_duration',
      width: 95,
      align: 'center',
      render: (seconds) => (
        <Text style={{ 
          fontSize: 13, 
          color: seconds >= 120 ? '#389e0d' : seconds >= 30 ? '#1677ff' : '#000000',
          fontWeight: seconds >= 120 ? 600 : 400 
        }}>
          {formatDuration(seconds)}
        </Text>
      )
    },
    {
      title: (
        <Tooltip title="구매 직전 마지막 방문의 체류시간">
          <span>막타 체류 <QuestionCircleOutlined style={{ fontSize: 13, color: '#000000' }} /></span>
        </Tooltip>
      ),
      dataIndex: 'last_touch_duration',
      key: 'last_touch_duration',
      width: 80,
      align: 'center',
      render: (seconds) => (
        <Text style={{ 
          fontSize: 13, 
          color: seconds >= 120 ? '#389e0d' : seconds >= 30 ? '#1677ff' : '#000000',
          fontWeight: seconds >= 120 ? 600 : 400 
        }}>
          {formatDuration(seconds)}
        </Text>
      )
    },
    {
      title: (
        <Tooltip title="이 구매자가 이 광고를 총 몇 번 봤는지">
          <span>광고접촉 <QuestionCircleOutlined style={{ fontSize: 13, color: '#000000' }} /></span>
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
        <Tooltip title="이 구매자의 전체 방문 횟수 (구매 결정 과정 맥락)">
          <span>총방문 <QuestionCircleOutlined style={{ fontSize: 13, color: '#000000' }} /></span>
        </Tooltip>
      ),
      dataIndex: 'total_visits',
      key: 'total_visits',
      width: 65,
      align: 'center',
      render: (count) => (
        <Text style={{ 
          fontSize: 12, 
          color: count >= 5 ? '#722ed1' : '#000000',
          fontWeight: count >= 5 ? 600 : 400 
        }}>
          {count || 0}
        </Text>
      )
    },
    {
      title: (
        <Tooltip title="이 광고가 해당 주문에서 수행한 역할">
          <span>역할 <QuestionCircleOutlined style={{ fontSize: 13, color: '#000000' }} /></span>
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
          <span>여정 <QuestionCircleOutlined style={{ fontSize: 13, color: '#000000' }} /></span>
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
          <span>기여율 <QuestionCircleOutlined style={{ fontSize: 13, color: '#000000' }} /></span>
        </Tooltip>
      ),
      dataIndex: 'contribution_rate',
      key: 'contribution_rate',
      width: 70,
      align: 'center',
      render: (rate) => (
        <Text style={{ color: rate === 100 ? '#d48806' : rate >= 50 ? '#1677ff' : '#000000', fontWeight: rate >= 50 ? 600 : 400 }}>
          {rate}%
        </Text>
      )
    },
    {
      title: (
        <Tooltip title="결제금액 × 기여율">
          <span>기여금액 <QuestionCircleOutlined style={{ fontSize: 13, color: '#000000' }} /></span>
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
              title={<span style={{ fontSize: 13, color: '#000000' }}>영향준 주문</span>}
              value={summary.total_orders}
              suffix="건"
              valueStyle={{ fontSize: 18, fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small" style={{ textAlign: 'center', background: '#f0f5ff' }}>
            <Statistic
              title={<span style={{ fontSize: 13, color: '#000000' }}>막타 주문</span>}
              value={summary.last_touch_orders}
              suffix={<span style={{ fontSize: 12 }}>건 ({summary.last_touch_ratio}%)</span>}
              valueStyle={{ fontSize: 18, fontWeight: 600, color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small" style={{ textAlign: 'center', background: '#fff7e6' }}>
            <Statistic
              title={<span style={{ fontSize: 13, color: '#000000' }}>어시 주문</span>}
              value={summary.assist_orders}
              suffix={<span style={{ fontSize: 12 }}>건 ({summary.assist_ratio}%)</span>}
              valueStyle={{ fontSize: 18, fontWeight: 600, color: '#d48806' }}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small" style={{ textAlign: 'center', background: '#f6ffed' }}>
            <Statistic
              title={<span style={{ fontSize: 13, color: '#000000' }}>기여한 매출액</span>}
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
              title={<span style={{ fontSize: 13, color: '#000000' }}>막타 결제액</span>}
              value={summary.last_touch_revenue}
              suffix="원"
              valueStyle={{ fontSize: 18, fontWeight: 600, color: '#0958d9' }}
              formatter={(value) => parseInt(value).toLocaleString()}
            />
          </Card>
        </Col>
      </Row>

      {/* 추가 지표 (기존 + 트래픽 지표) */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        <Col span={4}>
          <Card size="small">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#000000' }}>순수 전환</span>
              <Text strong style={{ color: '#d48806' }}>{summary.single_touch_orders}건</Text>
            </div>
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#000000' }}>평균 기여율</span>
              <Text strong style={{ color: '#1677ff' }}>{summary.avg_contribution_rate}%</Text>
            </div>
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#000000' }}>유입 방문자</span>
              <Text strong>{summary.unique_visitors}명</Text>
            </div>
          </Card>
        </Col>
        <Col span={4}>
          <Tooltip title="이 광고를 통해 유입된 순 방문자 수">
            <Card size="small" style={{ background: '#ffffff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#000000' }}>UV</span>
                <Text strong style={{ color: '#722ed1' }}>{trafficStats.unique_visitors?.toLocaleString() || 0}</Text>
              </div>
            </Card>
          </Tooltip>
        </Col>
        <Col span={4}>
          <Tooltip title="이 광고 유입 시 평균 페이지뷰">
            <Card size="small" style={{ background: '#ffffff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#000000' }}>평균 PV</span>
                <Text strong style={{ color: '#722ed1' }}>{trafficStats.avg_pageviews || 0}</Text>
              </div>
            </Card>
          </Tooltip>
        </Col>
        <Col span={4}>
          <Tooltip title="이 광고 유입 시 평균 체류시간">
            <Card size="small" style={{ background: '#ffffff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#000000' }}>평균 체류</span>
                <Text strong style={{ color: '#722ed1' }}>{formatDuration(trafficStats.avg_duration_seconds || 0)}</Text>
              </div>
            </Card>
          </Tooltip>
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
          scroll={{ x: 1500 }}
        />
      ) : !loading && (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="해당 광고 소재로 발생한 주문이 없습니다" />
      )}
    </>
  );

  // 전체 트래픽 탭 테이블 컬럼
  const trafficColumns = [
    {
      title: '최근 방문',
      dataIndex: 'last_visit',
      key: 'last_visit',
      width: 120,
      align: 'center',
      render: (date) => <Text style={{ fontSize: 12 }}>{dayjs(date).format('MM-DD HH:mm')}</Text>
    },
    {
      title: (
        <Tooltip title="이 광고를 통해 방문한 횟수">
          <span>방문수 <QuestionCircleOutlined style={{ fontSize: 13, color: '#000000' }} /></span>
        </Tooltip>
      ),
      dataIndex: 'visit_count',
      key: 'visit_count',
      width: 80,
      align: 'center',
      render: (count) => (
        <Tag color={count >= 3 ? 'purple' : count >= 2 ? 'blue' : 'default'}>
          {count}회
        </Tag>
      )
    },
    {
      title: (
        <Tooltip title="이 광고로 유입된 모든 방문의 총 체류시간">
          <span>총 체류시간 <QuestionCircleOutlined style={{ fontSize: 13, color: '#000000' }} /></span>
        </Tooltip>
      ),
      dataIndex: 'total_duration_seconds',
      key: 'total_duration_seconds',
      width: 100,
      align: 'center',
      render: (seconds) => (
        <Text style={{ 
          fontSize: 13, 
          color: seconds >= 120 ? '#389e0d' : seconds >= 30 ? '#1677ff' : '#000000',
          fontWeight: seconds >= 120 ? 600 : 400 
        }}>
          {formatDuration(seconds)}
        </Text>
      )
    },
    {
      title: (
        <Tooltip title="이 광고로 유입된 모든 방문에서 본 총 페이지 수">
          <span>총 PV <QuestionCircleOutlined style={{ fontSize: 13, color: '#000000' }} /></span>
        </Tooltip>
      ),
      dataIndex: 'total_pageviews',
      key: 'total_pageviews',
      width: 70,
      align: 'center',
      render: (pv) => (
        <Text style={{ 
          fontSize: 12, 
          color: pv >= 5 ? '#389e0d' : pv >= 2 ? '#1677ff' : '#000000',
          fontWeight: pv >= 5 ? 600 : 400 
        }}>
          {pv || 0}
        </Text>
      )
    },
    {
      title: '기기',
      dataIndex: 'device_type',
      key: 'device_type',
      width: 80,
      align: 'center',
      render: (device) => (
        <Tag color={device === 'mobile' ? 'blue' : device === 'desktop' ? 'green' : 'default'}>
          {device === 'mobile' ? '모바일' : device === 'desktop' ? 'PC' : device || '-'}
        </Tag>
      )
    },
    {
      title: '구매여부',
      key: 'purchase_status',
      width: 140,
      align: 'center',
      render: (_, record) => {
        if (record.is_purchased) {
          return (
            <div>
              <Tag color="green">구매</Tag>
              <Text strong style={{ fontSize: 12, color: '#52c41a', marginLeft: 4 }}>
                {formatCurrency(record.final_payment)}
              </Text>
            </div>
          );
        }
        return <Tag color="default">이탈</Tag>;
      }
    },
    {
      title: '주문번호',
      dataIndex: 'order_id',
      key: 'order_id',
      width: 150,
      align: 'center',
      render: (orderId) => orderId ? (
        <Text copyable={{ text: orderId }} style={{ fontFamily: 'monospace', fontSize: 11 }}>{orderId}</Text>
      ) : <Text type="secondary">-</Text>
    },
    {
      title: '주문일시',
      dataIndex: 'order_date',
      key: 'order_date',
      width: 110,
      align: 'center',
      render: (date) => date ? <Text style={{ fontSize: 12 }}>{dayjs(date).format('MM-DD HH:mm')}</Text> : <Text type="secondary">-</Text>
    }
  ];

  // 전체 트래픽 탭 내용
  const TrafficTab = () => (
    <>
      {/* 요약 통계 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        <Col span={6}>
          <Card size="small" style={{ textAlign: 'center', background: '#f0f5ff' }}>
            <Statistic
              title={<span style={{ fontSize: 13, color: '#000000' }}>총 조회수 (View)</span>}
              value={trafficStats.total_views}
              suffix="회"
              valueStyle={{ fontSize: 18, fontWeight: 600, color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ textAlign: 'center', background: '#f9f0ff' }}>
            <Statistic
              title={<span style={{ fontSize: 13, color: '#000000' }}>순방문자 (UV)</span>}
              value={trafficStats.unique_visitors}
              suffix="명"
              valueStyle={{ fontSize: 18, fontWeight: 600, color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ textAlign: 'center', background: '#fff7e6' }}>
            <Statistic
              title={<span style={{ fontSize: 13, color: '#000000' }}>평균 PV</span>}
              value={trafficStats.avg_pageviews}
              suffix="페이지"
              valueStyle={{ fontSize: 18, fontWeight: 600, color: '#d48806' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ textAlign: 'center', background: '#f6ffed' }}>
            <Statistic
              title={<span style={{ fontSize: 13, color: '#000000' }}>평균 체류시간</span>}
              value={formatDuration(trafficStats.avg_duration_seconds)}
              valueStyle={{ fontSize: 18, fontWeight: 600, color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 필터 */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#000000' }}>필터:</span>
          <Select
            value={trafficFilter}
            onChange={(value) => setTrafficFilter(value)}
            style={{ width: 140 }}
            size="small"
            options={[
              { value: 'all', label: '전체' },
              { value: 'purchased', label: '구매자만' },
              { value: 'not_purchased', label: '이탈자만' }
            ]}
          />
        </div>
        <Text type="secondary" style={{ fontSize: 12 }}>
          총 {trafficPagination.total?.toLocaleString()}건
        </Text>
      </div>

      {/* 세션 목록 테이블 */}
      <Spin spinning={trafficLoading}>
        {trafficSessions.length > 0 ? (
          <Table
            columns={trafficColumns}
            dataSource={trafficSessions}
            rowKey="visitor_id"
            size="small"
            pagination={{
              current: trafficPagination.page,
              pageSize: trafficPagination.limit,
              total: trafficPagination.total,
              showTotal: (total) => `총 ${total?.toLocaleString()}건`,
              showSizeChanger: false,
              onChange: (page) => fetchTrafficSessions(page, trafficFilter)
            }}
            scroll={{ x: 900 }}
          />
        ) : !trafficLoading && (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="해당 광고 소재로 유입된 방문자가 없습니다" />
        )}
      </Spin>
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

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'orders',
            label: (
              <span>
                <ShoppingCartOutlined />
                기여 주문
              </span>
            ),
            children: (
              <Spin spinning={loading}>
                <OrdersTab />
              </Spin>
            )
          },
          {
            key: 'traffic',
            label: (
              <span>
                <TeamOutlined />
                전체 트래픽
              </span>
            ),
            children: <TrafficTab />
          }
        ]}
      />

      {activeTab === 'orders' && dateRange && (
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
