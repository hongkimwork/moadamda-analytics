import { Modal, Input, Button, Typography, Spin, Tag, Collapse, Statistic, Row, Col, Empty, Table, Alert } from 'antd';
import { FlaskConical, Search, Eye, DollarSign, Target, CheckCircle, XCircle } from 'lucide-react';
import { useState } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';

const { Text, Title } = Typography;
const { Panel } = Collapse;
const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * TestResultModal - 테스트 결과 확인 모달
 * 주문번호를 입력하면 해당 주문과 연결된 광고 정보를 확인
 *
 * @param {boolean} visible - 모달 표시 여부
 * @param {function} onClose - 모달 닫기 핸들러
 */
function TestResultModal({ visible, onClose }) {
  const [orderId, setOrderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [orderData, setOrderData] = useState(null);
  const [creativeStats, setCreativeStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState(null);

  // 주문 조회
  const handleSearch = async () => {
    if (!orderId.trim()) {
      setError('주문번호를 입력해주세요');
      return;
    }

    setLoading(true);
    setError(null);
    setOrderData(null);
    setCreativeStats(null);

    try {
      const response = await axios.get(`${API_URL}/api/stats/order-detail/${orderId.trim()}`);
      setOrderData(response.data);
      
      // 주문 데이터가 있고 UTM 히스토리가 있으면 광고 소재 분석 데이터도 조회
      if (response.data.utm_history && response.data.utm_history.length > 0) {
        await fetchCreativeStats(response.data);
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setError('해당 주문번호를 찾을 수 없습니다');
      } else {
        setError('주문 정보를 불러오는데 실패했습니다');
      }
    } finally {
      setLoading(false);
    }
  };

  // 광고 소재 분석 테이블 데이터 조회
  const fetchCreativeStats = async (orderInfo) => {
    setStatsLoading(true);
    try {
      const utmContents = orderInfo.utm_history
        .filter(u => u.utm_content)
        .map(u => u.utm_content);
      
      if (utmContents.length === 0) {
        setCreativeStats([]);
        return;
      }

      // 주문일 기준으로 조회 (당일)
      const orderDate = dayjs(orderInfo.order?.timestamp).format('YYYY-MM-DD');
      
      // 각 광고 소재별로 데이터 조회
      const statsPromises = utmContents.map(async (creativeName) => {
        try {
          const res = await axios.get(`${API_URL}/api/creative-performance`, {
            params: {
              start: orderDate,
              end: orderDate,
              search: creativeName,
              limit: 1
            }
          });
          
          if (res.data.success && res.data.data.length > 0) {
            const data = res.data.data[0];
            const isLastTouch = orderInfo.utm_history[orderInfo.utm_history.length - 1]?.utm_content === creativeName;
            return {
              creative_name: creativeName,
              is_last_touch: isLastTouch,
              ...data
            };
          }
          return {
            creative_name: creativeName,
            is_last_touch: orderInfo.utm_history[orderInfo.utm_history.length - 1]?.utm_content === creativeName,
            not_found: true
          };
        } catch {
          return {
            creative_name: creativeName,
            is_last_touch: orderInfo.utm_history[orderInfo.utm_history.length - 1]?.utm_content === creativeName,
            error: true
          };
        }
      });

      const results = await Promise.all(statsPromises);
      // 중복 제거 (같은 광고를 여러 번 본 경우)
      const uniqueResults = results.filter((item, index, self) =>
        index === self.findIndex(t => t.creative_name === item.creative_name)
      );
      setCreativeStats(uniqueResults);
    } catch (err) {
      console.error('광고 소재 분석 데이터 조회 실패:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  // 모달 닫을 때 초기화
  const handleClose = () => {
    setOrderId('');
    setOrderData(null);
    setCreativeStats(null);
    setError(null);
    onClose();
  };

  // 금액 포맷
  const formatCurrency = (amount) => {
    if (!amount) return '0원';
    return `${parseInt(amount).toLocaleString()}원`;
  };

  // 시간 포맷
  const formatDuration = (seconds) => {
    if (!seconds) return '0초';
    if (seconds < 60) return `${Math.round(seconds)}초`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}분 ${secs}초`;
  };

  // UTM 세션 테이블 컬럼
  const utmColumns = [
    {
      title: '유입 시간',
      dataIndex: 'entry_time',
      key: 'entry_time',
      width: 150,
      render: (ts) => <Text style={{ fontSize: '12px' }}>{dayjs(ts).format('MM-DD HH:mm:ss')}</Text>
    },
    {
      title: 'UTM Source',
      dataIndex: 'utm_source',
      key: 'utm_source',
      width: 100,
      render: (v) => <Tag color="blue">{v || 'direct'}</Tag>
    },
    {
      title: 'UTM Campaign',
      dataIndex: 'utm_campaign',
      key: 'utm_campaign',
      width: 120,
      render: (v) => v ? <Tag color="purple">{v}</Tag> : '-'
    },
    {
      title: 'UTM Medium',
      dataIndex: 'utm_medium',
      key: 'utm_medium',
      width: 100,
      render: (v) => v ? <Tag color="orange">{v}</Tag> : '-'
    },
    {
      title: 'UTM Content (광고 소재)',
      dataIndex: 'utm_content',
      key: 'utm_content',
      width: 200,
      render: (v) => v ? (
        <Text style={{ fontSize: '12px', fontWeight: 600, color: '#1890ff' }}>{v}</Text>
      ) : '-'
    },
    {
      title: '체류시간',
      dataIndex: 'total_duration',
      key: 'total_duration',
      width: 90,
      align: 'center',
      render: (sec) => <Text>{formatDuration(sec)}</Text>
    }
  ];

  // 구매 여정 페이지 테이블 컬럼
  const journeyColumns = [
    {
      title: '시간',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 130,
      render: (ts) => <Text style={{ fontSize: '12px' }}>{dayjs(ts).format('MM-DD HH:mm:ss')}</Text>
    },
    {
      title: '페이지',
      dataIndex: 'clean_url',
      key: 'clean_url',
      render: (url, record) => (
        <div>
          <Text style={{ fontSize: '12px' }}>{url}</Text>
          {record.page_title && (
            <div><Text type="secondary" style={{ fontSize: '11px' }}>{record.page_title}</Text></div>
          )}
        </div>
      )
    },
    {
      title: '체류',
      dataIndex: 'time_spent_seconds',
      key: 'time_spent_seconds',
      width: 80,
      align: 'center',
      render: (sec) => <Text>{formatDuration(sec)}</Text>
    }
  ];

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FlaskConical size={20} style={{ color: '#2f54eb' }} />
          <span>테스트 결과 확인</span>
        </div>
      }
      open={visible}
      onCancel={handleClose}
      footer={null}
      width={1000}
      destroyOnClose={true}
      style={{ top: '2vh' }}
      styles={{
        body: { 
          padding: '16px 24px',
          maxHeight: 'calc(96vh - 60px)',
          overflowY: 'auto'
        }
      }}
    >
      {/* 안내 메시지 */}
      <Alert
        message="테스트 방법"
        description={
          <div>
            <div>1. 인스타그램 광고를 클릭하여 사이트 방문</div>
            <div>2. 상품 구매 완료</div>
            <div>3. 주문번호를 아래에 입력하여 데이터 확인</div>
          </div>
        }
        type="info"
        showIcon
        style={{ marginBottom: '16px' }}
      />

      {/* 주문번호 입력 */}
      <div style={{ 
        display: 'flex', 
        gap: '12px', 
        marginBottom: '20px',
        padding: '16px',
        background: '#fafafa',
        borderRadius: '8px'
      }}>
        <Input
          placeholder="주문번호 입력 (예: 20250106-0001234)"
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          onPressEnter={handleSearch}
          style={{ flex: 1 }}
          size="large"
        />
        <Button
          type="primary"
          icon={<Search size={16} />}
          onClick={handleSearch}
          loading={loading}
          size="large"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          조회
        </Button>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <Alert
          message={error}
          type="error"
          showIcon
          style={{ marginBottom: '16px' }}
        />
      )}

      {/* 로딩 */}
      <Spin spinning={loading}>
        {orderData && (
          <div>
            {/* 주문 기본 정보 */}
            <div style={{
              padding: '16px',
              background: 'linear-gradient(135deg, #f0f5ff 0%, #e6f7ff 100%)',
              borderRadius: '8px',
              border: '1px solid #adc6ff',
              marginBottom: '16px'
            }}>
              <Row gutter={16}>
                <Col span={6}>
                  <Statistic
                    title="주문번호"
                    value={orderData.order?.order_id}
                    valueStyle={{ fontSize: '14px', fontFamily: 'monospace' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="주문일시"
                    value={dayjs(orderData.order?.timestamp).format('YYYY-MM-DD HH:mm')}
                    valueStyle={{ fontSize: '14px' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="결제금액"
                    value={formatCurrency(orderData.order?.final_payment)}
                    valueStyle={{ fontSize: '16px', color: '#1890ff', fontWeight: 600 }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="디바이스"
                    value={orderData.order?.device_type === 'mobile' ? '모바일' : 
                           orderData.order?.device_type === 'desktop' ? '데스크톱' : 
                           orderData.order?.device_type || '-'}
                    valueStyle={{ fontSize: '14px' }}
                  />
                </Col>
              </Row>
            </div>

            {/* 외부 결제 주문인 경우 */}
            {orderData.is_external_payment === false && orderData.message && (
              <Alert
                message={orderData.message}
                type="warning"
                showIcon
                style={{ marginBottom: '16px' }}
              />
            )}

            <Collapse defaultActiveKey={['utm', 'journey']} style={{ background: 'transparent', border: 'none' }}>
              {/* 광고 유입 정보 (UTM) */}
              <Panel
                header={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Target size={16} style={{ color: '#52c41a' }} />
                    <span style={{ fontWeight: 600 }}>광고 유입 정보 (내가 본 광고)</span>
                    {orderData.utm_history && (
                      <Tag color="green">{orderData.utm_history.length}건</Tag>
                    )}
                  </div>
                }
                key="utm"
                style={{ 
                  marginBottom: '12px', 
                  background: '#fff',
                  borderRadius: '8px',
                  border: '1px solid #f0f0f0'
                }}
              >
                {orderData.utm_history && orderData.utm_history.length > 0 ? (
                  <>
                    <div style={{
                      background: '#f6ffed',
                      border: '1px solid #b7eb8f',
                      borderRadius: '8px',
                      padding: '12px',
                      marginBottom: '16px'
                    }}>
                      <Text strong style={{ color: '#389e0d' }}>
                        ✅ 이 고객이 구매 전 본 광고 목록입니다
                      </Text>
                      <div style={{ marginTop: '8px', fontSize: '13px', color: '#595959' }}>
                        • UTM Content = 광고 소재 이름 (광고 성과 파악 테이블의 "광고 소재 이름" 컬럼과 매칭)
                      </div>
                    </div>
                    <Table
                      columns={utmColumns}
                      dataSource={orderData.utm_history}
                      rowKey={(r, i) => `utm-${i}`}
                      size="small"
                      pagination={false}
                      scroll={{ x: 800 }}
                    />
                  </>
                ) : (
                  <Empty 
                    description="UTM 유입 정보가 없습니다 (직접 방문 또는 추적 불가)"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                )}
              </Panel>

              {/* 구매 여정 */}
              <Panel
                header={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Eye size={16} style={{ color: '#1890ff' }} />
                    <span style={{ fontWeight: 600 }}>구매 여정 (방문한 페이지)</span>
                    {orderData.purchase_journey?.pages && (
                      <Tag color="blue">{orderData.purchase_journey.pages.length}페이지</Tag>
                    )}
                  </div>
                }
                key="journey"
                style={{ 
                  marginBottom: '12px', 
                  background: '#fff',
                  borderRadius: '8px',
                  border: '1px solid #f0f0f0'
                }}
              >
                {orderData.purchase_journey?.pages && orderData.purchase_journey.pages.length > 0 ? (
                  <>
                    <Row gutter={16} style={{ marginBottom: '16px' }}>
                      <Col span={8}>
                        <div style={{ background: '#e6f7ff', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                          <Statistic
                            title="총 페이지뷰"
                            value={orderData.purchase_journey.page_count}
                            suffix="페이지"
                            valueStyle={{ fontSize: '18px' }}
                          />
                        </div>
                      </Col>
                      <Col span={8}>
                        <div style={{ background: '#f9f0ff', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                          <Statistic
                            title="총 체류시간"
                            value={formatDuration(orderData.purchase_journey.total_duration)}
                            valueStyle={{ fontSize: '18px' }}
                          />
                        </div>
                      </Col>
                      <Col span={8}>
                        <div style={{ background: '#fff7e6', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                          <Statistic
                            title="유입 경로"
                            value={orderData.order?.utm_source || 'direct'}
                            valueStyle={{ fontSize: '16px' }}
                          />
                        </div>
                      </Col>
                    </Row>
                    <Table
                      columns={journeyColumns}
                      dataSource={orderData.purchase_journey.pages}
                      rowKey={(r, i) => `page-${i}`}
                      size="small"
                      pagination={{ pageSize: 10 }}
                      scroll={{ x: 600 }}
                    />
                  </>
                ) : (
                  <Empty 
                    description="구매 여정 데이터가 없습니다"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                )}
              </Panel>

              {/* 막타/기여 정보 안내 */}
              <Panel
                header={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <DollarSign size={16} style={{ color: '#722ed1' }} />
                    <span style={{ fontWeight: 600 }}>광고 성과 파악 테이블 반영 확인</span>
                    {creativeStats && (
                      <Tag color="purple">{creativeStats.length}개 광고</Tag>
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
                <Spin spinning={statsLoading}>
                  {/* 기여도 계산 설명 */}
                  <div style={{
                    background: '#fffbe6',
                    border: '1px solid #ffe58f',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '16px',
                    fontSize: '12px'
                  }}>
                    <strong>💡 기여도 계산 방식</strong>
                    <div style={{ marginTop: '4px', color: '#8c6d1f' }}>
                      • 광고 1개만 봤으면 → 해당 광고가 <strong>100%</strong> 기여
                      <br />
                      • 여러 광고를 봤으면 → 막타 <strong>50%</strong> + 나머지 어시 광고들이 <strong>50%</strong> 균등 분배
                    </div>
                  </div>

                  {creativeStats && creativeStats.length > 0 ? (
                    <>
                      {/* 막타 광고 테이블 */}
                      <div style={{ marginBottom: '20px' }}>
                        <Title level={5} style={{ margin: '0 0 12px 0', color: '#0958d9' }}>
                          🎯 막타 광고 (마지막으로 본 광고)
                        </Title>
                        <Table
                          columns={[
                            {
                              title: '광고 소재 이름',
                              dataIndex: 'creative_name',
                              key: 'creative_name',
                              width: 300,
                              render: (v) => (
                                <Text style={{ fontSize: '12px', fontWeight: 600 }}>{v}</Text>
                              )
                            },
                            {
                              title: '막타 결제액',
                              dataIndex: 'last_touch_revenue',
                              key: 'last_touch_revenue',
                              width: 120,
                              align: 'right',
                              render: (v, record) => record.not_found ? '-' : (
                                <Text strong style={{ color: '#0958d9' }}>{formatCurrency(v)}</Text>
                              )
                            },
                            {
                              title: '막타 횟수',
                              dataIndex: 'last_touch_count',
                              key: 'last_touch_count',
                              width: 100,
                              align: 'center',
                              render: (v, record) => record.not_found ? '-' : (
                                <Tag color="blue">{v}건</Tag>
                              )
                            },
                            {
                              title: '상태',
                              key: 'status',
                              width: 100,
                              align: 'center',
                              render: (_, record) => {
                                if (record.not_found) {
                                  return <Tag color="orange">데이터 없음</Tag>;
                                }
                                if (record.last_touch_count > 0) {
                                  return (
                                    <span style={{ color: '#52c41a', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                      <CheckCircle size={14} /> 정상 반영
                                    </span>
                                  );
                                }
                                return (
                                  <span style={{ color: '#ff4d4f', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                    <XCircle size={14} /> 미반영
                                  </span>
                                );
                              }
                            }
                          ]}
                          dataSource={creativeStats.filter(s => s.is_last_touch)}
                          rowKey="creative_name"
                          size="small"
                          pagination={false}
                          style={{ marginBottom: '8px' }}
                        />
                        <div style={{ fontSize: '12px', color: '#8c8c8c', paddingLeft: '8px' }}>
                          → 이 주문의 결제금액 <strong>{formatCurrency(orderData.order?.final_payment)}</strong>이 막타 결제액에 포함되어야 합니다
                        </div>
                      </div>

                      {/* 어시 광고 테이블 */}
                      <div>
                        <Title level={5} style={{ margin: '0 0 12px 0', color: '#389e0d' }}>
                          🤝 어시 광고 (영향 준 광고들)
                        </Title>
                        <Table
                          columns={[
                            {
                              title: '광고 소재 이름',
                              dataIndex: 'creative_name',
                              key: 'creative_name',
                              width: 300,
                              render: (v, record) => (
                                <div>
                                  <Text style={{ fontSize: '12px', fontWeight: 600 }}>{v}</Text>
                                  {record.is_last_touch && (
                                    <Tag color="blue" style={{ marginLeft: '8px', fontSize: '10px' }}>막타</Tag>
                                  )}
                                </div>
                              )
                            },
                            {
                              title: '기여한 주문 수',
                              dataIndex: 'contributed_orders_count',
                              key: 'contributed_orders_count',
                              width: 120,
                              align: 'center',
                              render: (v, record) => record.not_found ? '-' : (
                                <Tag color="green">{v}건</Tag>
                              )
                            },
                            {
                              title: '기여한 결제액',
                              dataIndex: 'attributed_revenue',
                              key: 'attributed_revenue',
                              width: 120,
                              align: 'right',
                              render: (v, record) => record.not_found ? '-' : (
                                <Text strong style={{ color: '#389e0d' }}>{formatCurrency(v)}</Text>
                              )
                            },
                            {
                              title: '상태',
                              key: 'status',
                              width: 100,
                              align: 'center',
                              render: (_, record) => {
                                if (record.not_found) {
                                  return <Tag color="orange">데이터 없음</Tag>;
                                }
                                if (record.contributed_orders_count > 0) {
                                  return (
                                    <span style={{ color: '#52c41a', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                      <CheckCircle size={14} /> 정상 반영
                                    </span>
                                  );
                                }
                                return (
                                  <span style={{ color: '#ff4d4f', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                    <XCircle size={14} /> 미반영
                                  </span>
                                );
                              }
                            }
                          ]}
                          dataSource={creativeStats}
                          rowKey="creative_name"
                          size="small"
                          pagination={false}
                          style={{ marginBottom: '8px' }}
                        />
                        <div style={{ fontSize: '12px', color: '#8c8c8c', paddingLeft: '8px' }}>
                          → 위 광고들의 "기여한 주문 수"에 이 주문이 +1 카운트되어야 합니다
                        </div>
                      </div>

                      {/* 기여 매출 계산 검증 */}
                      {creativeStats.length > 0 && !creativeStats.some(s => s.not_found) && (
                        <div style={{
                          background: '#f6ffed',
                          border: '1px solid #b7eb8f',
                          borderRadius: '8px',
                          padding: '16px',
                          marginTop: '16px'
                        }}>
                          <Title level={5} style={{ margin: 0, marginBottom: '8px', color: '#389e0d' }}>
                            ✅ 기여 매출 계산 검증
                          </Title>
                          <div style={{ fontSize: '13px', lineHeight: '1.8' }}>
                            {(() => {
                              const lastTouchAd = creativeStats.find(s => s.is_last_touch);
                              const assistAds = creativeStats.filter(s => !s.is_last_touch);
                              const orderAmount = orderData.order?.final_payment || 0;
                              
                              if (creativeStats.length === 1) {
                                return (
                                  <div>
                                    • 광고 1개만 봄 → <strong>{lastTouchAd?.creative_name?.substring(0, 30)}...</strong>이 100% 기여
                                    <br />
                                    • 기여 금액: <strong style={{ color: '#389e0d' }}>{formatCurrency(orderAmount)}</strong>
                                  </div>
                                );
                              }
                              
                              const lastTouchShare = Math.round(orderAmount * 0.5);
                              const assistShare = Math.round((orderAmount * 0.5) / assistAds.length);
                              
                              return (
                                <div>
                                  <div>• 막타 광고 (50%): <strong style={{ color: '#0958d9' }}>{formatCurrency(lastTouchShare)}</strong></div>
                                  <div>• 어시 광고 {assistAds.length}개 (각 {Math.round(50 / assistAds.length)}%): 각 <strong style={{ color: '#722ed1' }}>{formatCurrency(assistShare)}</strong></div>
                                  <div style={{ marginTop: '8px', borderTop: '1px dashed #b7eb8f', paddingTop: '8px' }}>
                                    합계: {formatCurrency(lastTouchShare)} + ({formatCurrency(assistShare)} × {assistAds.length}) = <strong style={{ color: '#389e0d' }}>{formatCurrency(orderAmount)}</strong> ✓
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      )}
                    </>
                  ) : orderData?.utm_history?.length > 0 ? (
                    <Empty 
                      description="UTM Content가 있는 광고가 없어 광고 성과 파악에 반영되지 않습니다"
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  ) : (
                    <Empty 
                      description="UTM 유입 정보가 없어 광고 성과 파악에 반영되지 않습니다"
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  )}
                </Spin>
              </Panel>
            </Collapse>
          </div>
        )}

        {/* 초기 상태 */}
        {!orderData && !error && !loading && (
          <Empty
            description="주문번호를 입력하고 조회 버튼을 클릭하세요"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </Spin>
    </Modal>
  );
}

export default TestResultModal;
