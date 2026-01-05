import { Modal, Table, Typography, Spin, Tag, Tooltip, Collapse, Statistic, Row, Col, Empty } from 'antd';
import { DatabaseOutlined, EyeOutlined, UserOutlined, ClockCircleOutlined, FileTextOutlined, DollarOutlined, AimOutlined, TeamOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';

const { Text, Title } = Typography;
const { Panel } = Collapse;
const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * RawDataModal - Raw Data 검증 모달
 * 광고 소재의 각 지표가 어떤 데이터를 기반으로 계산되었는지 확인
 *
 * @param {boolean} visible - 모달 표시 여부
 * @param {function} onClose - 모달 닫기 핸들러
 * @param {object} creative - 광고 소재 정보 { creative_name, utm_source, utm_medium, utm_campaign }
 * @param {object} dateRange - 조회 기간 { start, end }
 */
function RawDataModal({ visible, onClose, creative, dateRange }) {
  const [loading, setLoading] = useState(false);
  const [trafficData, setTrafficData] = useState(null);
  const [attributionData, setAttributionData] = useState(null);
  const [activeKey, setActiveKey] = useState(['traffic', 'attribution']);

  // 모달이 열릴 때 데이터 조회
  useEffect(() => {
    if (visible && creative) {
      fetchRawData();
    }
  }, [visible, creative]);

  const fetchRawData = async () => {
    if (!creative || !dateRange) return;

    setLoading(true);
    try {
      const requestBody = {
        creative_name: creative.creative_name,
        utm_source: creative.utm_source,
        utm_medium: creative.utm_medium,
        utm_campaign: creative.utm_campaign,
        start: dateRange.start,
        end: dateRange.end
      };

      const [trafficRes, attributionRes] = await Promise.all([
        axios.post(`${API_URL}/api/creative-performance/raw-traffic`, requestBody),
        axios.post(`${API_URL}/api/creative-performance/raw-attribution`, requestBody)
      ]);

      if (trafficRes.data.success) {
        setTrafficData(trafficRes.data);
      }
      if (attributionRes.data.success) {
        setAttributionData(attributionRes.data);
      }
    } catch (error) {
      console.error('Raw Data 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 금액 포맷
  const formatCurrency = (amount) => {
    if (!amount) return '0원';
    return `${parseInt(amount).toLocaleString()}원`;
  };

  // 시간 포맷
  const formatDuration = (seconds) => {
    if (!seconds) return '0초';
    if (seconds < 60) return `${seconds}초`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}분 ${secs}초`;
  };

  // 세션 목록 컬럼
  const sessionColumns = [
    {
      title: '유입 시간',
      dataIndex: 'entry_timestamp',
      key: 'entry_timestamp',
      width: 150,
      align: 'center',
      render: (ts) => <Text style={{ fontSize: '12px' }}>{dayjs(ts).format('MM-DD HH:mm:ss')}</Text>
    },
    {
      title: 'Visitor ID',
      dataIndex: 'visitor_id',
      key: 'visitor_id',
      width: 140,
      align: 'center',
      render: (id) => (
        <Text copyable={{ text: id }} style={{ fontSize: '11px', fontFamily: 'monospace' }}>
          {id?.substring(0, 8)}...
        </Text>
      )
    },
    {
      title: 'PV',
      dataIndex: 'pageview_count',
      key: 'pageview_count',
      width: 60,
      align: 'center',
      render: (pv) => <Tag color="blue">{pv}</Tag>
    },
    {
      title: '체류시간',
      dataIndex: 'duration_seconds',
      key: 'duration_seconds',
      width: 90,
      align: 'center',
      render: (sec) => <Text>{formatDuration(sec)}</Text>
    },
    {
      title: '디바이스',
      dataIndex: 'device_type',
      key: 'device_type',
      width: 80,
      align: 'center',
      render: (type) => (
        <Tag color={type === 'mobile' ? 'green' : type === 'desktop' ? 'purple' : 'default'}>
          {type === 'mobile' ? '모바일' : type === 'desktop' ? '데스크톱' : type}
        </Tag>
      )
    }
  ];

  // 주문 기여도 컬럼
  const orderColumns = [
    {
      title: '주문번호',
      dataIndex: 'order_id',
      key: 'order_id',
      width: 160,
      align: 'center',
      render: (id) => (
        <Text copyable={{ text: id }} style={{ fontSize: '12px', fontFamily: 'monospace' }}>
          {id}
        </Text>
      )
    },
    {
      title: '주문일시',
      dataIndex: 'order_date',
      key: 'order_date',
      width: 140,
      align: 'center',
      render: (date) => <Text style={{ fontSize: '12px' }}>{dayjs(date).format('MM-DD HH:mm')}</Text>
    },
    {
      title: '결제금액',
      dataIndex: 'final_payment',
      key: 'final_payment',
      width: 100,
      align: 'right',
      render: (amount) => <Text strong style={{ color: '#1890ff' }}>{formatCurrency(amount)}</Text>
    },
    {
      title: '역할',
      dataIndex: 'role',
      key: 'role',
      width: 70,
      align: 'center',
      render: (role) => (
        <Tag color={role === '막타' ? 'blue' : 'orange'} style={{ fontWeight: 600 }}>
          {role}
        </Tag>
      )
    },
    {
      title: (
        <Tooltip title="이 주문에서 고객이 본 광고 조합 수">
          <span>여정 수</span>
        </Tooltip>
      ),
      dataIndex: 'journey_count',
      key: 'journey_count',
      width: 70,
      align: 'center',
      render: (count) => <Text>{count}개</Text>
    },
    {
      title: '기여 비율',
      dataIndex: 'contribution_ratio',
      key: 'contribution_ratio',
      width: 80,
      align: 'center',
      render: (ratio) => (
        <Text strong style={{ color: ratio === 100 ? '#52c41a' : '#faad14' }}>
          {ratio}%
        </Text>
      )
    },
    {
      title: '기여 금액',
      dataIndex: 'attributed_amount',
      key: 'attributed_amount',
      width: 100,
      align: 'right',
      render: (amount) => (
        <Text strong style={{ color: '#52c41a' }}>
          {formatCurrency(amount)}
        </Text>
      )
    }
  ];

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <DatabaseOutlined style={{ fontSize: '20px', color: '#722ed1' }} />
          <span>Raw Data 검증</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={1000}
      style={{ top: '2vh' }}
      styles={{
        body: { 
          padding: '16px 24px',
          maxHeight: 'calc(96vh - 60px)',
          overflowY: 'auto'
        }
      }}
    >
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
            marginBottom: '8px'
          }}>
            {creative.creative_name}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Tag color="purple">{creative.utm_source}</Tag>
            <Tag color="magenta">{creative.utm_medium}</Tag>
            <Tag color="volcano">{creative.utm_campaign}</Tag>
          </div>
        </div>
      )}

      <Spin spinning={loading}>
        <Collapse 
          activeKey={activeKey} 
          onChange={setActiveKey}
          style={{ background: 'transparent', border: 'none' }}
        >
          {/* 트래픽 지표 섹션 */}
          <Panel 
            header={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <EyeOutlined style={{ color: '#1890ff' }} />
                <span style={{ fontWeight: 600 }}>트래픽 지표</span>
                {trafficData && (
                  <Text type="secondary" style={{ fontSize: '12px', marginLeft: 'auto' }}>
                    세션 {trafficData.sessions?.length || 0}건
                  </Text>
                )}
              </div>
            } 
            key="traffic"
            style={{ 
              marginBottom: '12px', 
              background: '#fff',
              borderRadius: '8px',
              border: '1px solid #f0f0f0'
            }}
          >
            {trafficData ? (
              <>
                {/* 트래픽 요약 */}
                <Row gutter={12} style={{ marginBottom: '16px' }}>
                  <Col span={6}>
                    <div style={{ background: '#f6ffed', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                      <Statistic
                        title={<span style={{ fontSize: '11px' }}>View (세션 수)</span>}
                        value={trafficData.summary?.total_views || 0}
                        prefix={<EyeOutlined style={{ color: '#52c41a' }} />}
                        valueStyle={{ fontSize: '18px', fontWeight: 600 }}
                      />
                    </div>
                  </Col>
                  <Col span={6}>
                    <div style={{ background: '#e6f7ff', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                      <Statistic
                        title={<span style={{ fontSize: '11px' }}>UV (순방문자)</span>}
                        value={trafficData.summary?.unique_visitors || 0}
                        prefix={<UserOutlined style={{ color: '#1890ff' }} />}
                        valueStyle={{ fontSize: '18px', fontWeight: 600 }}
                      />
                    </div>
                  </Col>
                  <Col span={6}>
                    <div style={{ background: '#fff7e6', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                      <Statistic
                        title={<span style={{ fontSize: '11px' }}>평균 PV</span>}
                        value={trafficData.summary?.avg_pageviews || 0}
                        prefix={<FileTextOutlined style={{ color: '#fa8c16' }} />}
                        valueStyle={{ fontSize: '18px', fontWeight: 600 }}
                        precision={1}
                      />
                    </div>
                  </Col>
                  <Col span={6}>
                    <div style={{ background: '#f9f0ff', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                      <Statistic
                        title={<span style={{ fontSize: '11px' }}>평균 체류시간</span>}
                        value={trafficData.summary?.avg_duration_seconds || 0}
                        suffix="초"
                        prefix={<ClockCircleOutlined style={{ color: '#722ed1' }} />}
                        valueStyle={{ fontSize: '18px', fontWeight: 600 }}
                      />
                    </div>
                  </Col>
                </Row>

                {/* 세션 목록 테이블 */}
                <div style={{ 
                  background: '#fafafa', 
                  padding: '12px', 
                  borderRadius: '8px',
                  marginBottom: '8px'
                }}>
                  <div style={{ 
                    fontSize: '13px', 
                    fontWeight: 600, 
                    marginBottom: '8px',
                    color: '#595959'
                  }}>
                    📋 세션 목록 (최대 500건)
                  </div>
                  <Table
                    columns={sessionColumns}
                    dataSource={trafficData.sessions || []}
                    rowKey="id"
                    size="small"
                    pagination={{ pageSize: 10, showTotal: (t) => `총 ${t}건` }}
                    scroll={{ x: 600 }}
                  />
                </div>
              </>
            ) : (
              <Empty description="데이터를 불러오는 중..." />
            )}
          </Panel>

          {/* 매출 지표 섹션 */}
          <Panel 
            header={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <DollarOutlined style={{ color: '#52c41a' }} />
                <span style={{ fontWeight: 600 }}>매출 지표</span>
                {attributionData && (
                  <Text type="secondary" style={{ fontSize: '12px', marginLeft: 'auto' }}>
                    기여 주문 {attributionData.summary?.contributed_orders_count || 0}건
                  </Text>
                )}
              </div>
            } 
            key="attribution"
            style={{ 
              background: '#fff',
              borderRadius: '8px',
              border: '1px solid #f0f0f0'
            }}
          >
            {attributionData ? (
              <>
                {/* 매출 요약 */}
                <Row gutter={12} style={{ marginBottom: '16px' }}>
                  <Col span={6}>
                    <div style={{ background: '#f6ffed', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                      <Statistic
                        title={<span style={{ fontSize: '11px' }}>영향 준 주문 수</span>}
                        value={attributionData.summary?.contributed_orders_count || 0}
                        suffix="건"
                        prefix={<TeamOutlined style={{ color: '#52c41a' }} />}
                        valueStyle={{ fontSize: '18px', fontWeight: 600 }}
                      />
                    </div>
                  </Col>
                  <Col span={6}>
                    <div style={{ background: '#e6f7ff', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                      <Statistic
                        title={<span style={{ fontSize: '11px' }}>막타 횟수</span>}
                        value={attributionData.summary?.last_touch_count || 0}
                        suffix="건"
                        prefix={<AimOutlined style={{ color: '#1890ff' }} />}
                        valueStyle={{ fontSize: '18px', fontWeight: 600 }}
                      />
                    </div>
                  </Col>
                  <Col span={6}>
                    <div style={{ background: '#fff1f0', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                      <Statistic
                        title={<span style={{ fontSize: '11px' }}>막타 결제액</span>}
                        value={attributionData.summary?.last_touch_revenue || 0}
                        prefix={<DollarOutlined style={{ color: '#cf1322' }} />}
                        valueStyle={{ fontSize: '16px', fontWeight: 600, color: '#cf1322' }}
                        formatter={(v) => `${parseInt(v).toLocaleString()}원`}
                      />
                    </div>
                  </Col>
                  <Col span={6}>
                    <div style={{ background: '#f9f0ff', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                      <Statistic
                        title={<span style={{ fontSize: '11px' }}>기여한 매출액</span>}
                        value={attributionData.summary?.attributed_revenue || 0}
                        prefix={<DollarOutlined style={{ color: '#722ed1' }} />}
                        valueStyle={{ fontSize: '16px', fontWeight: 600, color: '#722ed1' }}
                        formatter={(v) => `${parseInt(v).toLocaleString()}원`}
                      />
                    </div>
                  </Col>
                </Row>

                {/* 기여도 계산 설명 */}
                <div style={{
                  background: '#fffbe6',
                  border: '1px solid #ffe58f',
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: '16px',
                  fontSize: '12px',
                  color: '#8c6d1f'
                }}>
                  <strong>💡 기여도 계산 방식</strong>
                  <div style={{ marginTop: '4px' }}>
                    • 광고 1개만 봤으면 → 해당 광고가 <strong>100%</strong> 기여
                    <br />
                    • 여러 광고를 봤으면 → 막타 <strong>50%</strong> + 나머지 어시 광고들이 <strong>50%</strong> 균등 분배
                  </div>
                </div>

                {/* 주문 상세 테이블 */}
                {attributionData.orders?.length > 0 ? (
                  <div style={{ 
                    background: '#fafafa', 
                    padding: '12px', 
                    borderRadius: '8px'
                  }}>
                    <div style={{ 
                      fontSize: '13px', 
                      fontWeight: 600, 
                      marginBottom: '8px',
                      color: '#595959'
                    }}>
                      📋 기여 주문 상세
                    </div>
                    <Table
                      columns={orderColumns}
                      dataSource={attributionData.orders}
                      rowKey="order_id"
                      size="small"
                      pagination={{ pageSize: 10, showTotal: (t) => `총 ${t}건` }}
                      scroll={{ x: 800 }}
                      summary={() => (
                        <Table.Summary fixed>
                          <Table.Summary.Row style={{ background: '#f0f5ff' }}>
                            <Table.Summary.Cell index={0} colSpan={6}>
                              <Text strong>합계</Text>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={6} align="right">
                              <Text strong style={{ color: '#52c41a', fontSize: '14px' }}>
                                {formatCurrency(attributionData.summary?.attributed_revenue || 0)}
                              </Text>
                            </Table.Summary.Cell>
                          </Table.Summary.Row>
                        </Table.Summary>
                      )}
                    />
                  </div>
                ) : (
                  <Empty 
                    description="해당 광고 소재로 발생한 주문이 없습니다"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                )}
              </>
            ) : (
              <Empty description="데이터를 불러오는 중..." />
            )}
          </Panel>
        </Collapse>
      </Spin>

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
    </Modal>
  );
}

export default RawDataModal;

