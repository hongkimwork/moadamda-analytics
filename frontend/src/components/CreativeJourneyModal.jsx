import { Modal, Table, Typography, Spin, Empty, Row, Col, Card, Tooltip, Tag } from 'antd';
import { NodeIndexOutlined, AimOutlined, RocketOutlined, FlagOutlined, ClockCircleOutlined, TeamOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

const { Text } = Typography;
const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * CreativeJourneyModal - 광고 소재별 고객 여정 분석 모달
 *
 * @param {boolean} visible - 모달 표시 여부
 * @param {function} onClose - 모달 닫기 핸들러
 * @param {object} creative - 광고 소재 정보 { creative_name, utm_source, utm_medium, utm_campaign }
 * @param {object} dateRange - 조회 기간 { start, end }
 */
function CreativeJourneyModal({ visible, onClose, creative, dateRange }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  // 모달이 열릴 때 데이터 조회
  useEffect(() => {
    if (visible && creative) {
      fetchJourney();
    }
  }, [visible, creative]);

  const fetchJourney = async () => {
    if (!creative || !dateRange) return;

    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/creative-performance/journey`, {
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
      console.error('고객 여정 분석 조회 실패:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  // 숫자 포맷
  const formatNumber = (num) => {
    if (!num && num !== 0) return '0';
    return parseFloat(num).toLocaleString();
  };

  // 도넛 차트 데이터
  const pieData = data ? [
    { name: '첫 접점', value: data.role_distribution?.first_touch?.count || 0, color: '#1890ff' },
    { name: '중간 터치', value: data.role_distribution?.mid_touch?.count || 0, color: '#faad14' },
    { name: '막타', value: data.role_distribution?.last_touch?.count || 0, color: '#52c41a' }
  ].filter(item => item.value > 0) : [];

  // 도넛 차트 커스텀 툴팁
  const CustomPieTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0];
    return (
      <div style={{
        background: 'white',
        padding: '8px 12px',
        border: '1px solid #e8e8e8',
        borderRadius: '6px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
      }}>
        <div style={{ fontWeight: 600, color: item.payload.color }}>{item.name}</div>
        <div>{item.value}건 ({((item.value / pieData.reduce((s, i) => s + i.value, 0)) * 100).toFixed(1)}%)</div>
      </div>
    );
  };

  // 함께 본 광고 테이블 컬럼
  const coViewedColumns = [
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
      title: '광고 소재',
      dataIndex: 'creative_name',
      key: 'creative_name',
      ellipsis: true,
      render: (text, record) => (
        <div>
          <Text ellipsis={{ tooltip: text }} style={{ fontSize: 13, display: 'block' }}>
            {text}
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {record.utm_source}
          </Text>
        </div>
      )
    },
    {
      title: '동시 노출',
      dataIndex: 'co_view_count',
      key: 'co_view_count',
      width: 80,
      align: 'center',
      render: (val) => <Text strong>{formatNumber(val)}회</Text>
    },
    {
      title: '동시 전환율',
      dataIndex: 'co_conversion_rate',
      key: 'co_conversion_rate',
      width: 90,
      align: 'center',
      render: (val) => (
        <Text style={{ 
          color: val >= 10 ? '#52c41a' : val >= 5 ? '#faad14' : '#8c8c8c',
          fontWeight: 600
        }}>
          {val}%
        </Text>
      )
    }
  ];

  // 역할 아이콘 및 색상
  const roleConfig = {
    first_touch: { icon: <RocketOutlined />, label: '첫 접점', color: '#1890ff', bgColor: '#e6f4ff' },
    mid_touch: { icon: <NodeIndexOutlined />, label: '중간 터치', color: '#faad14', bgColor: '#fffbe6' },
    last_touch: { icon: <AimOutlined />, label: '막타', color: '#52c41a', bgColor: '#f6ffed' }
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <NodeIndexOutlined style={{ fontSize: '20px', color: '#722ed1' }} />
          <span>고객 여정 분석</span>
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
            background: 'linear-gradient(135deg, #f9f0ff 0%, #efdbff 100%)',
            borderRadius: '8px',
            border: '1px solid #d3adf7'
          }}>
            <div style={{ 
              fontSize: '15px', 
              fontWeight: 600, 
              color: '#531dab',
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
              <Col span={6}>
                <Card size="small" style={{ textAlign: 'center', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>
                    <TeamOutlined style={{ marginRight: 4 }} />
                    구매 고객
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#722ed1' }}>
                    {formatNumber(data.summary?.total_purchasers)}명
                  </div>
                  <div style={{ fontSize: 11, color: '#bfbfbf' }}>
                    전체 {formatNumber(data.summary?.total_visitors)}명 중
                  </div>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small" style={{ textAlign: 'center', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>
                    <NodeIndexOutlined style={{ marginRight: 4 }} />
                    평균 접촉 횟수
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#1890ff' }}>
                    {data.summary?.avg_touch_count || 0}회
                  </div>
                  <div style={{ fontSize: 11, color: '#bfbfbf' }}>
                    구매까지 본 광고 수
                  </div>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small" style={{ textAlign: 'center', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>
                    <ClockCircleOutlined style={{ marginRight: 4 }} />
                    평균 구매 소요
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#faad14' }}>
                    {data.summary?.avg_days_to_purchase || 0}일
                  </div>
                  <div style={{ fontSize: 11, color: '#bfbfbf' }}>
                    첫 접촉 → 구매
                  </div>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small" style={{ textAlign: 'center', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>
                    <FlagOutlined style={{ marginRight: 4 }} />
                    전환율
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#52c41a' }}>
                    {data.summary?.total_visitors > 0 
                      ? ((data.summary?.total_purchasers / data.summary?.total_visitors) * 100).toFixed(1)
                      : 0}%
                  </div>
                  <div style={{ fontSize: 11, color: '#bfbfbf' }}>
                    구매 고객 / 전체 방문
                  </div>
                </Card>
              </Col>
            </Row>

            {/* 광고 역할 분포 */}
            <Card 
              size="small" 
              style={{ marginBottom: '16px', borderRadius: 8 }}
              title={<span style={{ fontSize: 14, fontWeight: 600 }}>🎯 광고 역할 분포</span>}
            >
              <Row gutter={16}>
                <Col span={10}>
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={70}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip content={<CustomPieTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="데이터 없음" />
                  )}
                </Col>
                <Col span={14}>
                  <div style={{ padding: '8px 0' }}>
                    {['first_touch', 'mid_touch', 'last_touch'].map(role => {
                      const config = roleConfig[role];
                      const roleData = data.role_distribution?.[role] || { count: 0, ratio: 0 };
                      return (
                        <div 
                          key={role}
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            padding: '12px 16px',
                            marginBottom: 8,
                            background: config.bgColor,
                            borderRadius: 8,
                            border: `1px solid ${config.color}20`
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: config.color, fontSize: 16 }}>{config.icon}</span>
                            <span style={{ fontWeight: 500 }}>{config.label}</span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: 18, fontWeight: 700, color: config.color }}>
                              {roleData.ratio}%
                            </span>
                            <span style={{ fontSize: 12, color: '#8c8c8c', marginLeft: 8 }}>
                              ({roleData.count}건)
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ 
                    marginTop: 8, 
                    padding: '8px 12px', 
                    background: '#fafafa', 
                    borderRadius: 6,
                    fontSize: 12,
                    color: '#8c8c8c'
                  }}>
                    💡 <strong>첫 접점</strong>: 고객이 처음 본 광고 | 
                    <strong> 중간</strong>: 여정 중간에 노출 | 
                    <strong> 막타</strong>: 구매 직전 마지막 광고
                  </div>
                </Col>
              </Row>
            </Card>

            {/* 함께 본 광고 & 여정 패턴 */}
            <Row gutter={16}>
              <Col span={14}>
                <Card 
                  size="small" 
                  style={{ borderRadius: 8, height: '100%' }}
                  title={<span style={{ fontSize: 14, fontWeight: 600 }}>🤝 함께 본 광고 TOP 10</span>}
                >
                  {data.co_viewed_creatives?.length > 0 ? (
                    <Table
                      columns={coViewedColumns}
                      dataSource={data.co_viewed_creatives}
                      rowKey="rank"
                      size="small"
                      pagination={false}
                      scroll={{ y: 280 }}
                    />
                  ) : (
                    <Empty 
                      image={Empty.PRESENTED_IMAGE_SIMPLE} 
                      description="함께 본 광고가 없습니다 (단일 광고만 보고 구매)"
                      style={{ padding: '40px 0' }}
                    />
                  )}
                </Card>
              </Col>
              <Col span={10}>
                <Card 
                  size="small" 
                  style={{ borderRadius: 8, height: '100%' }}
                  title={<span style={{ fontSize: 14, fontWeight: 600 }}>🛤️ 주요 여정 패턴 TOP 5</span>}
                >
                  {data.journey_patterns?.length > 0 ? (
                    <div style={{ padding: '8px 0' }}>
                      {data.journey_patterns.map((pattern, index) => (
                        <div 
                          key={index}
                          style={{
                            padding: '10px 12px',
                            marginBottom: 8,
                            background: index === 0 ? '#fff7e6' : '#fafafa',
                            borderRadius: 8,
                            border: index === 0 ? '1px solid #ffd591' : '1px solid #f0f0f0'
                          }}
                        >
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            marginBottom: 6
                          }}>
                            <Tag color={index === 0 ? 'gold' : 'default'}>
                              #{index + 1}
                            </Tag>
                            <Text strong style={{ color: '#722ed1' }}>
                              {pattern.count}건
                            </Text>
                          </div>
                          <div style={{ 
                            fontSize: 12, 
                            color: '#595959',
                            lineHeight: 1.6,
                            wordBreak: 'break-all'
                          }}>
                            {pattern.pattern}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty 
                      image={Empty.PRESENTED_IMAGE_SIMPLE} 
                      description="여정 패턴 없음"
                      style={{ padding: '40px 0' }}
                    />
                  )}
                </Card>
              </Col>
            </Row>

            {/* 인사이트 */}
            {data.summary?.total_purchasers > 0 && (
              <Card 
                size="small" 
                style={{ marginTop: '16px', borderRadius: 8, background: '#f6ffed', border: '1px solid #b7eb8f' }}
              >
                <div style={{ fontSize: 13, color: '#389e0d' }}>
                  <strong>💡 인사이트:</strong> 이 광고를 본 고객 중{' '}
                  <strong>{((data.summary?.total_purchasers / data.summary?.total_visitors) * 100).toFixed(1)}%</strong>가 구매했습니다.
                  {data.summary?.avg_days_to_purchase > 3 && (
                    <> 평균 <strong>{data.summary?.avg_days_to_purchase}일</strong> 후 구매하므로, 리타겟팅 기간을 그에 맞게 설정하세요.</>
                  )}
                  {data.summary?.avg_touch_count > 2 && (
                    <> 구매까지 평균 <strong>{data.summary?.avg_touch_count}개</strong> 광고를 보므로, 다양한 소재 노출이 중요합니다.</>
                  )}
                  {data.role_distribution?.last_touch?.ratio >= 50 && (
                    <> 이 광고는 <strong>막타 역할</strong>이 강합니다. 구매 직전 노출에 효과적입니다.</>
                  )}
                  {data.role_distribution?.first_touch?.ratio >= 50 && (
                    <> 이 광고는 <strong>첫 접점 역할</strong>이 강합니다. 신규 고객 유입에 효과적입니다.</>
                  )}
                </div>
              </Card>
            )}
          </>
        ) : !loading && (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span style={{ color: '#8c8c8c' }}>
                여정 분석 데이터를 불러올 수 없습니다
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

export default CreativeJourneyModal;

