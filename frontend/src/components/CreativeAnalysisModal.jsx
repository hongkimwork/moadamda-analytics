import { Modal, Table, Typography, Spin, Empty, Row, Col, Card, Progress, Segmented } from 'antd';
import { BarChart3, Smartphone, ShoppingBag, User, Users } from 'lucide-react';
import { useState, useEffect } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const { Text, Title } = Typography;
const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * CreativeAnalysisModal - 광고 소재별 상세 성과 분석 모달
 *
 * @param {boolean} visible - 모달 표시 여부
 * @param {function} onClose - 모달 닫기 핸들러
 * @param {object} creative - 광고 소재 정보 { creative_name, utm_source, utm_medium, utm_campaign }
 * @param {object} dateRange - 조회 기간 { start, end }
 */
function CreativeAnalysisModal({ visible, onClose, creative, dateRange }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [chartMetric, setChartMetric] = useState('revenue');

  // 모달이 열릴 때 데이터 조회
  useEffect(() => {
    if (visible && creative) {
      fetchAnalysis();
    }
  }, [visible, creative]);

  const fetchAnalysis = async () => {
    if (!creative || !dateRange) return;

    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/creative-performance/analysis`, {
        creative_name: creative.creative_name,
        utm_source: creative.utm_source,
        utm_medium: creative.utm_medium,
        utm_campaign: creative.utm_campaign,
        start: dateRange.start,
        end: dateRange.end
      });

      if (response.data.success) {
        setData(response.data);
      }
    } catch (error) {
      console.error('성과 분석 조회 실패:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  // 금액 포맷
  const formatCurrency = (amount) => {
    if (!amount) return '0원';
    return `${parseInt(amount).toLocaleString()}원`;
  };

  // 숫자 포맷
  const formatNumber = (num) => {
    if (!num) return '0';
    return parseInt(num).toLocaleString();
  };

  // 차트 데이터 포맷
  const chartData = data?.daily_trend?.map(item => ({
    ...item,
    date: dayjs(item.date).format('MM/DD'),
    fullDate: dayjs(item.date).format('YYYY-MM-DD')
  })) || [];

  // 차트 툴팁 커스텀
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;

    const dataPoint = payload[0]?.payload;
    return (
      <div style={{
        background: 'white',
        padding: '12px 16px',
        border: '1px solid #e8e8e8',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
      }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>{dataPoint?.fullDate}</div>
        <div style={{ color: '#1890ff', marginBottom: 4 }}>UV: {formatNumber(dataPoint?.uv)}</div>
        <div style={{ color: '#52c41a', marginBottom: 4 }}>전환: {formatNumber(dataPoint?.orders)}건</div>
        <div style={{ color: '#389e0d' }}>매출: {formatCurrency(dataPoint?.revenue)}</div>
      </div>
    );
  };

  // 디바이스 테이블 컬럼
  const deviceColumns = [
    {
      title: '디바이스',
      dataIndex: 'device_type_korean',
      key: 'device_type',
      width: 100,
      render: (text, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Smartphone size={16} style={{ 
            color: record.device_type === 'mobile' ? '#1890ff' : 
                   record.device_type === 'desktop' ? '#52c41a' : '#faad14'
          }} />
          <span style={{ fontWeight: 500 }}>{text}</span>
        </div>
      )
    },
    {
      title: 'UV',
      dataIndex: 'uv',
      key: 'uv',
      width: 80,
      align: 'right',
      render: (val) => <Text strong>{formatNumber(val)}</Text>
    },
    {
      title: '전환',
      dataIndex: 'orders',
      key: 'orders',
      width: 70,
      align: 'right',
      render: (val) => <Text style={{ color: '#52c41a', fontWeight: 500 }}>{formatNumber(val)}건</Text>
    },
    {
      title: '전환율',
      dataIndex: 'conversion_rate',
      key: 'conversion_rate',
      width: 80,
      align: 'right',
      render: (val) => (
        <Text style={{ 
          color: val >= 5 ? '#52c41a' : val >= 2 ? '#faad14' : '#8c8c8c',
          fontWeight: 600
        }}>
          {val}%
        </Text>
      )
    }
  ];

  // 상품 테이블 컬럼
  const productColumns = [
    {
      title: '순위',
      dataIndex: 'rank',
      key: 'rank',
      width: 50,
      align: 'center',
      render: (rank) => (
        <div style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: rank <= 3 ? (rank === 1 ? '#faad14' : rank === 2 ? '#bfbfbf' : '#d48806') : '#f0f0f0',
          color: rank <= 3 ? 'white' : '#595959',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 600
        }}>
          {rank}
        </div>
      )
    },
    {
      title: '상품명',
      dataIndex: 'product_name',
      key: 'product_name',
      ellipsis: true,
      render: (text) => (
        <Text ellipsis={{ tooltip: text }} style={{ fontSize: 13 }}>
          {text}
        </Text>
      )
    },
    {
      title: '수량',
      dataIndex: 'order_count',
      key: 'order_count',
      width: 60,
      align: 'center',
      render: (val) => <Text>{val}건</Text>
    },
    {
      title: '매출액',
      dataIndex: 'revenue',
      key: 'revenue',
      width: 100,
      align: 'right',
      render: (val) => <Text strong style={{ color: '#0958d9' }}>{formatCurrency(val)}</Text>
    }
  ];

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <BarChart3 size={20} style={{ color: '#1890ff' }} />
          <span>광고 소재 성과 분석</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={1000}
      style={{ top: '2.5vh' }}
      styles={{
        body: { 
          padding: '16px 24px', 
          height: 'calc(95vh - 60px)',
          overflowY: 'auto' 
        }
      }}
    >
      <Spin spinning={loading}>
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
              marginBottom: '4px'
            }}>
              {creative.creative_name}
            </div>
            <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
              {creative.utm_source} / {creative.utm_medium} / {creative.utm_campaign}
            </div>
          </div>
        )}

        {data ? (
          <>
            {/* 요약 통계 */}
            <Row gutter={12} style={{ marginBottom: '20px' }}>
              <Col span={8}>
                <Card size="small" style={{ textAlign: 'center', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>총 UV</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#1890ff' }}>
                    {formatNumber(data.summary?.total_uv)}
                  </div>
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" style={{ textAlign: 'center', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>총 전환</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#52c41a' }}>
                    {formatNumber(data.summary?.total_orders)}건
                  </div>
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" style={{ textAlign: 'center', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>총 매출</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#389e0d' }}>
                    {formatCurrency(data.summary?.total_revenue)}
                  </div>
                </Card>
              </Col>
            </Row>

            {/* 기간별 추이 차트 */}
            <Card 
              size="small" 
              style={{ marginBottom: '16px', borderRadius: 8 }}
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>📈 기간별 추이</span>
                  <Segmented
                    size="small"
                    value={chartMetric}
                    onChange={setChartMetric}
                    options={[
                      { label: '매출', value: 'revenue' },
                      { label: '전환', value: 'orders' },
                      { label: 'UV', value: 'uv' }
                    ]}
                  />
                </div>
              }
            >
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 11 }} 
                      tickLine={false}
                      axisLine={{ stroke: '#e8e8e8' }}
                    />
                    <YAxis 
                      tick={{ fontSize: 11 }} 
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => chartMetric === 'revenue' ? `${(val/10000).toFixed(0)}만` : val}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line 
                      type="monotone" 
                      dataKey={chartMetric} 
                      stroke={chartMetric === 'uv' ? '#1890ff' : chartMetric === 'orders' ? '#52c41a' : '#389e0d'}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="데이터 없음" />
              )}
            </Card>

            {/* 디바이스별 성과 & 신규/재방문 */}
            <Row gutter={16} style={{ marginBottom: '16px' }}>
              <Col span={14}>
                <Card 
                  size="small" 
                  style={{ borderRadius: 8, height: '100%' }}
                  title={<span style={{ fontSize: 14, fontWeight: 600 }}>📱 디바이스별 성과</span>}
                >
                  <Table
                    columns={deviceColumns}
                    dataSource={data.device_stats || []}
                    rowKey="device_type"
                    size="small"
                    pagination={false}
                  />
                </Card>
              </Col>
              <Col span={10}>
                <Card 
                  size="small" 
                  style={{ borderRadius: 8, height: '100%' }}
                  title={<span style={{ fontSize: 14, fontWeight: 600 }}>👥 신규 / 재방문</span>}
                >
                  <div style={{ padding: '8px 0' }}>
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <User size={16} style={{ color: '#1890ff' }} />
                          <span>신규 방문자</span>
                        </span>
                        <span style={{ fontWeight: 600 }}>
                          {formatNumber(data.visitor_type?.new_visitors)}명 ({data.visitor_type?.new_ratio}%)
                        </span>
                      </div>
                      <Progress 
                        percent={data.visitor_type?.new_ratio || 0} 
                        showInfo={false}
                        strokeColor="#1890ff"
                        trailColor="#e6f4ff"
                      />
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Users size={16} style={{ color: '#52c41a' }} />
                          <span>재방문자</span>
                        </span>
                        <span style={{ fontWeight: 600 }}>
                          {formatNumber(data.visitor_type?.returning_visitors)}명 ({data.visitor_type?.returning_ratio}%)
                        </span>
                      </div>
                      <Progress 
                        percent={data.visitor_type?.returning_ratio || 0} 
                        showInfo={false}
                        strokeColor="#52c41a"
                        trailColor="#f6ffed"
                      />
                    </div>
                  </div>
                </Card>
              </Col>
            </Row>

            {/* 상품별 매출 TOP 10 */}
            <Card 
              size="small" 
              style={{ borderRadius: 8 }}
              title={
                <span style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShoppingBag size={16} style={{ color: '#faad14' }} />
                  상품별 매출 TOP 10
                </span>
              }
            >
              {data.product_sales?.length > 0 ? (
                <Table
                  columns={productColumns}
                  dataSource={data.product_sales}
                  rowKey="rank"
                  size="small"
                  pagination={false}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="판매 데이터 없음" />
              )}
            </Card>
          </>
        ) : !loading && (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span style={{ color: '#8c8c8c' }}>
                분석 데이터를 불러올 수 없습니다
              </span>
            }
            style={{ padding: '60px 0' }}
          />
        )}

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
      </Spin>
    </Modal>
  );
}

export default CreativeAnalysisModal;

