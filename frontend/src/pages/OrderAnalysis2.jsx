import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Table, DatePicker, Select, Button, Tag, Space, Typography, Statistic, Row, Col, Alert, Modal, message, Progress } from 'antd';
import { ReloadOutlined, TrophyOutlined, StarOutlined, ThunderboltOutlined, RiseOutlined, ShoppingOutlined } from '@ant-design/icons';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import axios from 'axios';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import relativeTime from 'dayjs/plugin/relativeTime';
import { OrderDetailPageContent } from './OrderAnalysis';

dayjs.extend(relativeTime);
dayjs.locale('ko');

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

const API_URL = import.meta.env.VITE_API_URL || '';

// ============================================================================
// 주문분석2 - 인사이트 중심 페이지
// ============================================================================
export function OrderAnalysis2Page() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState([dayjs().subtract(7, 'day'), dayjs()]);
  const [deviceFilter, setDeviceFilter] = useState('all');
  const [totalOrders, setTotalOrders] = useState(0);
  const [userMappings, setUserMappings] = useState({});
  
  // 인사이트 데이터
  const [insights, setInsights] = useState({
    topChannel: null,
    highValueOrders: 0,
    trend: null,
    avgPayment: 0,
  });

  // 모달 state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  // 스마트 필터 state
  const [activePreset, setActivePreset] = useState(null);

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
          limit: 1000,
          offset: 0
        }
      });

      const fetchedOrders = response.data.orders || [];
      setOrders(fetchedOrders);
      setTotalOrders(response.data.total_orders || 0);
      
      // 인사이트 계산
      calculateInsights(fetchedOrders);
      
      setLoading(false);
    } catch (error) {
      console.error('주문 목록 조회 실패:', error);
      setLoading(false);
    }
  };

  // 인사이트 계산 함수
  const calculateInsights = (orderList) => {
    if (!orderList || orderList.length === 0) {
      setInsights({
        topChannel: null,
        highValueOrders: 0,
        trend: null,
        avgPayment: 0,
      });
      return;
    }

    // 평균 결제 금액
    const avgPayment = orderList.reduce((sum, o) => sum + o.final_payment, 0) / orderList.length;

    // 고액 주문 (평균의 1.5배 이상)
    const highValueOrders = orderList.filter(o => o.final_payment > avgPayment * 1.5).length;

    // 채널별 주문 수 집계
    const channelStats = {};
    orderList.forEach(order => {
      const channel = order.utm_source || 'Direct';
      if (!channelStats[channel]) {
        channelStats[channel] = 0;
      }
      channelStats[channel]++;
    });

    // 최고 성과 채널
    const topChannel = Object.entries(channelStats)
      .sort((a, b) => b[1] - a[1])[0];

    // 트렌드 계산 (임시: 이전 기간 대비)
    const trend = {
      current: orderList.length,
      previous: Math.floor(orderList.length * 0.8), // 임시값
      percentage: 20 // 임시값
    };

    setInsights({
      topChannel: topChannel ? { name: topChannel[0], count: topChannel[1], percentage: Math.round((topChannel[1] / orderList.length) * 100) } : null,
      highValueOrders,
      trend,
      avgPayment: Math.round(avgPayment),
    });
  };

  useEffect(() => {
    fetchOrders();
    
    // 사용자 정의 매핑 로드
    fetch(`${API_URL}/api/mappings/lookup`)
      .then(res => res.json())
      .then(data => setUserMappings(data))
      .catch(err => console.error('매핑 로드 실패:', err));
  }, [dateRange, deviceFilter]);

  // 모달 열기/닫기
  const handleOpenModal = (orderId) => {
    setSelectedOrderId(orderId);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedOrderId(null);
    fetchOrders();
  };

  // 스마트 필터 프리셋
  const applyPreset = (preset) => {
    setActivePreset(preset);
    
    let filtered = [...orders];
    
    switch(preset) {
      case 'highValue':
        filtered = orders.filter(o => o.final_payment > insights.avgPayment * 1.5);
        break;
      case 'firstPurchase':
        filtered = orders.filter(o => !o.purchase_count || o.purchase_count === 1);
        break;
      case 'metaAds':
        filtered = orders.filter(o => o.utm_source && o.utm_source.toLowerCase().includes('meta'));
        break;
      case 'returning':
        filtered = orders.filter(o => o.purchase_count && o.purchase_count > 1);
        break;
      default:
        setActivePreset(null);
        return;
    }
    
    setOrders(filtered);
    setTotalOrders(filtered.length);
  };

  const resetFilter = () => {
    setActivePreset(null);
    fetchOrders();
  };

  // 차트 데이터 준비
  const channelChartData = React.useMemo(() => {
    const stats = {};
    orders.forEach(order => {
      const channel = order.utm_source || 'Direct';
      if (!stats[channel]) {
        stats[channel] = 0;
      }
      stats[channel]++;
    });
    
    return Object.entries(stats).map(([name, value]) => ({
      name,
      value,
      percentage: Math.round((value / orders.length) * 100)
    }));
  }, [orders]);

  const COLORS = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2'];

  // 시간대별 데이터
  const hourlyChartData = React.useMemo(() => {
    const hourlyStats = {};
    for (let i = 0; i < 24; i++) {
      hourlyStats[i] = 0;
    }
    
    orders.forEach(order => {
      const hour = dayjs(order.timestamp).hour();
      hourlyStats[hour]++;
    });
    
    return Object.entries(hourlyStats).map(([hour, count]) => ({
      hour: `${hour}시`,
      count
    }));
  }, [orders]);

  // 테이블 컬럼 정의
  const columns = [
    {
      title: '주문 정보',
      key: 'info',
      width: 300,
      render: (_, record) => {
        const isHighValue = record.final_payment > insights.avgPayment * 1.5;
        const isFirst = !record.purchase_count || record.purchase_count === 1;
        const isReturning = record.purchase_count && record.purchase_count >= 3;
        
        return (
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            {/* 뱃지 */}
            <Space size={4} wrap>
              {isHighValue && <Tag color="gold">💎 고액</Tag>}
              {isFirst && <Tag color="green">🎉 첫구매</Tag>}
              {isReturning && <Tag color="blue">🔄 단골</Tag>}
            </Space>
            
            {/* 상품명 */}
            <Text strong style={{ fontSize: '13px' }}>{record.product_name}</Text>
            
            {/* 시간 */}
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {dayjs(record.timestamp).format('MM-DD HH:mm')} ({dayjs(record.timestamp).fromNow()})
            </Text>
          </Space>
        );
      }
    },
    {
      title: '금액',
      key: 'amount',
      width: 150,
      align: 'right',
      render: (_, record) => {
        const isHighValue = record.final_payment > insights.avgPayment * 1.5;
        const ratio = insights.avgPayment > 0 ? (record.final_payment / insights.avgPayment).toFixed(1) : 1;
        
        return (
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: isHighValue ? '#fa8c16' : '#1890ff' }}>
              {record.final_payment.toLocaleString()}원
            </div>
            {isHighValue && (
              <Text type="secondary" style={{ fontSize: '11px' }}>
                평균의 {ratio}배
              </Text>
            )}
          </div>
        );
      }
    },
    {
      title: '광고',
      key: 'ad',
      width: 150,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Tag color={record.utm_source ? 'blue' : 'default'}>
            {record.utm_source || 'Direct'}
          </Tag>
          {record.utm_campaign && (
            <Text type="secondary" style={{ fontSize: '11px' }} ellipsis>
              {record.utm_campaign}
            </Text>
          )}
        </Space>
      )
    },
    {
      title: '고객',
      key: 'customer',
      width: 120,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Text style={{ fontSize: '13px' }}>
            {record.device_type === 'mobile' ? '📱' : '💻'} {record.device_type === 'mobile' ? 'Mobile' : 'PC'}
          </Text>
          {record.purchase_count > 1 && (
            <Text type="secondary" style={{ fontSize: '11px' }}>
              {record.purchase_count}번째 구매
            </Text>
          )}
        </Space>
      )
    },
    {
      title: '액션',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Button 
          type="primary" 
          size="small"
          onClick={() => handleOpenModal(record.order_id)}
        >
          상세보기
        </Button>
      )
    }
  ];

  // 행 스타일 (하이라이트)
  const getRowClassName = (record) => {
    const isHighValue = record.final_payment > insights.avgPayment * 1.5;
    const isFirst = !record.purchase_count || record.purchase_count === 1;
    const isReturning = record.purchase_count && record.purchase_count >= 3;
    
    if (isHighValue) return 'row-highlight-gold';
    if (isFirst) return 'row-highlight-green';
    if (isReturning) return 'row-highlight-blue';
    return '';
  };

  return (
    <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
      {/* 헤더 */}
      <Card style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2} style={{ margin: 0 }}>
              📊 주문 분석 대시보드
            </Title>
            <Text type="secondary" style={{ fontSize: '13px' }}>
              인사이트 중심 분석 - 데이터가 알려주는 이야기
            </Text>
          </div>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={fetchOrders}
            loading={loading}
          >
            새로고침
          </Button>
        </div>
      </Card>

      {/* 🎯 핵심 인사이트 카드 */}
      <Row gutter={16} style={{ marginBottom: '16px' }}>
        {/* 카드 1: 최고 성과 광고 */}
        <Col xs={24} sm={24} md={8}>
          <Card hoverable>
            <Statistic
              title={<span style={{ fontSize: '14px' }}>⭐ 최고 성과 광고</span>}
              value={insights.topChannel?.name || 'N/A'}
              valueStyle={{ fontSize: '20px', fontWeight: 700, color: '#1890ff' }}
            />
            {insights.topChannel && (
              <>
                <div style={{ marginTop: 12, fontSize: '14px', color: '#52c41a' }}>
                  {totalOrders}건 중 {insights.topChannel.count}건 유입 ({insights.topChannel.percentage}%)
                </div>
                <Progress 
                  percent={insights.topChannel.percentage} 
                  strokeColor="#52c41a"
                  style={{ marginTop: 8 }}
                />
                <Button 
                  type="primary" 
                  size="small" 
                  style={{ marginTop: 12 }}
                  onClick={() => applyPreset('metaAds')}
                  disabled={!insights.topChannel.name.toLowerCase().includes('meta')}
                >
                  상세 보기 →
                </Button>
              </>
            )}
          </Card>
        </Col>

        {/* 카드 2: 고액 구매 */}
        <Col xs={24} sm={24} md={8}>
          <Card hoverable>
            <Statistic
              title={<span style={{ fontSize: '14px' }}>💰 고액 구매</span>}
              value={insights.highValueOrders}
              suffix="건"
              valueStyle={{ fontSize: '20px', fontWeight: 700, color: '#fa8c16' }}
            />
            <div style={{ marginTop: 12, fontSize: '14px' }}>
              평균 구매액: {insights.avgPayment.toLocaleString()}원
            </div>
            <div style={{ marginTop: 4, fontSize: '13px', color: '#8c8c8c' }}>
              평균의 1.5배 이상 주문
            </div>
            <Button 
              type="primary" 
              size="small" 
              style={{ marginTop: 12 }}
              onClick={() => applyPreset('highValue')}
            >
              고액 주문만 보기 →
            </Button>
          </Card>
        </Col>

        {/* 카드 3: 트렌드 */}
        <Col xs={24} sm={24} md={8}>
          <Card hoverable>
            <Statistic
              title={<span style={{ fontSize: '14px' }}>📈 기간 내 주문</span>}
              value={totalOrders}
              suffix="건"
              valueStyle={{ fontSize: '20px', fontWeight: 700, color: '#52c41a' }}
            />
            {insights.trend && (
              <>
                <div style={{ marginTop: 12, fontSize: '14px', color: '#52c41a' }}>
                  <RiseOutlined /> 지난 기간 대비 {insights.trend.percentage}% 증가
                </div>
                <div style={{ marginTop: 4, fontSize: '13px', color: '#8c8c8c' }}>
                  이전: {insights.trend.previous}건 → 현재: {insights.trend.current}건
                </div>
              </>
            )}
          </Card>
        </Col>
      </Row>

      {/* 📈 시각화 요약 */}
      <Row gutter={16} style={{ marginBottom: '16px' }}>
        {/* 광고 플랫폼별 주문 수 */}
        <Col xs={24} md={12}>
          <Card title="📢 광고 플랫폼별 주문 비율" size="small">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={channelChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => `${name} (${percentage}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {channelChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
            {insights.topChannel && (
              <Alert
                message={`💡 ${insights.topChannel.name} 광고가 가장 효과적이에요!`}
                type="success"
                showIcon
                style={{ marginTop: 12 }}
              />
            )}
          </Card>
        </Col>

        {/* 시간대별 주문 */}
        <Col xs={24} md={12}>
          <Card title="⏰ 시간대별 주문 분포" size="small">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={hourlyChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                <YAxis />
                <RechartsTooltip />
                <Bar dataKey="count" fill="#1890ff" />
              </BarChart>
            </ResponsiveContainer>
            <Alert
              message="💡 주문이 많은 시간대에 광고를 집중하면 효율이 올라가요"
              type="info"
              showIcon
              style={{ marginTop: 12 }}
            />
          </Card>
        </Col>
      </Row>

      {/* 필터 & 스마트 프리셋 */}
      <Card style={{ marginBottom: '16px' }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Text strong>📅 기간 및 디바이스</Text>
            <div style={{ marginTop: 8 }}>
              <Space wrap>
                <RangePicker
                  value={dateRange}
                  onChange={(dates) => dates && setDateRange(dates)}
                  format="YYYY-MM-DD"
                />
                <Select
                  value={deviceFilter}
                  onChange={setDeviceFilter}
                  style={{ width: 120 }}
                >
                  <Select.Option value="all">전체</Select.Option>
                  <Select.Option value="pc">PC</Select.Option>
                  <Select.Option value="mobile">Mobile</Select.Option>
                </Select>
              </Space>
            </div>
          </div>

          <div>
            <Text strong>🎯 스마트 필터 프리셋</Text>
            <div style={{ marginTop: 8 }}>
              <Space wrap>
                <Button
                  icon={<TrophyOutlined />}
                  type={activePreset === 'highValue' ? 'primary' : 'default'}
                  onClick={() => applyPreset('highValue')}
                >
                  💰 고액 주문만
                </Button>
                <Button
                  icon={<StarOutlined />}
                  type={activePreset === 'firstPurchase' ? 'primary' : 'default'}
                  onClick={() => applyPreset('firstPurchase')}
                >
                  🎉 첫 구매 고객
                </Button>
                <Button
                  icon={<ThunderboltOutlined />}
                  type={activePreset === 'metaAds' ? 'primary' : 'default'}
                  onClick={() => applyPreset('metaAds')}
                >
                  📢 Meta 광고 유입
                </Button>
                <Button
                  icon={<ShoppingOutlined />}
                  type={activePreset === 'returning' ? 'primary' : 'default'}
                  onClick={() => applyPreset('returning')}
                >
                  🔄 재구매 고객
                </Button>
                {activePreset && (
                  <Button onClick={resetFilter}>
                    초기화
                  </Button>
                )}
              </Space>
            </div>
          </div>

          {activePreset && (
            <Alert
              message={`필터 적용 중: ${
                activePreset === 'highValue' ? '고액 주문' :
                activePreset === 'firstPurchase' ? '첫 구매 고객' :
                activePreset === 'metaAds' ? 'Meta 광고 유입' :
                '재구매 고객'
              }`}
              type="info"
              closable
              onClose={resetFilter}
            />
          )}
        </Space>
      </Card>

      {/* 📋 주문 목록 테이블 */}
      <Card title={
        <Space>
          <span>📋 주문 목록</span>
          <Tag color="blue">총 {totalOrders}건</Tag>
          {activePreset && <Tag color="orange">필터 적용 중</Tag>}
        </Space>
      }>
        <Table 
          columns={columns}
          dataSource={orders}
          rowKey="order_id"
          loading={loading}
          rowClassName={getRowClassName}
          pagination={{
            pageSize: 20,
            total: totalOrders,
            showTotal: (total) => `총 ${total}건`,
            showSizeChanger: true
          }}
          scroll={{ x: 900 }}
          size="small"
        />
      </Card>

      {/* 주문 상세 모달 */}
      <Modal
        title="🔍 고객 여정 분석"
        open={isModalOpen}
        onCancel={handleCloseModal}
        footer={null}
        width="90vw"
        style={{ top: 20, maxWidth: 1200 }}
        styles={{ body: { padding: 0, maxHeight: '85vh', overflow: 'auto' } }}
        destroyOnClose={true}
      >
        {selectedOrderId && (
          <OrderDetailPageContent orderId={selectedOrderId} userMappings={userMappings} />
        )}
      </Modal>

      {/* CSS for row highlighting */}
      <style>{`
        .row-highlight-gold {
          background-color: #fff7e6 !important;
          border-left: 4px solid #fa8c16;
        }
        .row-highlight-green {
          background-color: #f6ffed !important;
          border-left: 4px solid #52c41a;
        }
        .row-highlight-blue {
          background-color: #e6f7ff !important;
          border-left: 4px solid #1890ff;
        }
        .row-highlight-gold:hover,
        .row-highlight-green:hover,
        .row-highlight-blue:hover {
          background-color: #fafafa !important;
        }
      `}</style>
    </div>
  );
}

export default OrderAnalysis2Page;

