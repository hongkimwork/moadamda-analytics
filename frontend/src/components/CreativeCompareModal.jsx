import { Modal, Table, Typography, Spin, Empty, Row, Col, Card, Tag, Tooltip, Progress, Segmented } from 'antd';
import { ArrowLeftRight, Trophy, Rocket, GitBranch, Target, TrendingUp, TrendingDown } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import { 
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, Legend 
} from 'recharts';

const { Text } = Typography;
const API_URL = import.meta.env.VITE_API_URL || '';

// 색상 팔레트
const COLORS = ['#1890ff', '#52c41a', '#faad14', '#722ed1', '#eb2f96'];

/**
 * CreativeCompareModal - 광고 소재 비교 분석 모달
 *
 * @param {boolean} visible - 모달 표시 여부
 * @param {function} onClose - 모달 닫기 핸들러
 * @param {array} creatives - 비교할 광고 소재 목록
 * @param {object} dateRange - 조회 기간 { start, end }
 */
function CreativeCompareModal({ visible, onClose, creatives, dateRange }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [chartMetric, setChartMetric] = useState('uv');

  // 모달이 열릴 때 데이터 조회
  useEffect(() => {
    if (visible && creatives && creatives.length >= 2) {
      fetchCompareData();
    }
  }, [visible, creatives]);

  const fetchCompareData = async () => {
    if (!creatives || creatives.length < 2 || !dateRange) return;

    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/creative-performance/compare`, {
        creatives: creatives.map(c => ({
          creative_name: c.creative_name,
          utm_source: c.utm_source,
          utm_medium: c.utm_medium,
          utm_campaign: c.utm_campaign
        })),
        start: dateRange.start,
        end: dateRange.end
      });

      if (response.data.success) {
        setData(response.data);
      }
    } catch (error) {
      console.error('소재 비교 데이터 조회 실패:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  // 금액 포맷팅
  const formatCurrency = (amount) => {
    if (!amount) return '0원';
    if (amount >= 10000) {
      return `${(amount / 10000).toFixed(0)}만원`;
    }
    return `${parseInt(amount).toLocaleString()}원`;
  };

  // 숫자 포맷팅
  const formatNumber = (num) => {
    if (!num && num !== 0) return '0';
    return parseInt(num).toLocaleString();
  };

  // 시간 포맷팅
  const formatDuration = (seconds) => {
    if (!seconds || seconds === 0) return '0초';
    const numSeconds = parseInt(seconds);
    if (numSeconds < 60) return `${numSeconds}초`;
    const minutes = Math.floor(numSeconds / 60);
    const remainSeconds = numSeconds % 60;
    if (remainSeconds === 0) return `${minutes}분`;
    return `${minutes}분 ${remainSeconds}초`;
  };

  // 레이더 차트 데이터 생성
  const radarData = useMemo(() => {
    if (!data?.creatives_data) return [];

    const metrics = ['uv', 'conversion_rate', 'revenue', 'avg_duration', 'bounce_rate'];
    const metricLabels = {
      uv: 'UV',
      conversion_rate: '전환율',
      revenue: '매출',
      avg_duration: '체류시간',
      bounce_rate: '이탈률(역)'
    };

    // 각 지표별 최대값 계산
    const maxValues = {};
    metrics.forEach(metric => {
      maxValues[metric] = Math.max(...data.creatives_data.map(c => c[metric] || 0));
    });

    return metrics.map(metric => {
      const point = { metric: metricLabels[metric] };
      data.creatives_data.forEach((creative, idx) => {
        let value = creative[metric] || 0;
        // 정규화 (0-100)
        if (maxValues[metric] > 0) {
          // 이탈률은 낮을수록 좋으므로 역으로 계산
          if (metric === 'bounce_rate') {
            value = maxValues[metric] > 0 ? ((maxValues[metric] - value) / maxValues[metric]) * 100 : 0;
          } else {
            value = (value / maxValues[metric]) * 100;
          }
        }
        point[`creative_${idx}`] = Math.round(value);
      });
      return point;
    });
  }, [data]);

  // 기간별 추이 차트 데이터
  const trendData = useMemo(() => {
    if (!data?.daily_trends) return [];

    // 날짜별로 데이터 병합
    const dateMap = {};
    data.daily_trends.forEach((trend, creativeIdx) => {
      trend.forEach(item => {
        const dateKey = dayjs(item.date).format('MM/DD');
        if (!dateMap[dateKey]) {
          dateMap[dateKey] = { date: dateKey };
        }
        dateMap[dateKey][`creative_${creativeIdx}`] = item[chartMetric] || 0;
      });
    });

    return Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));
  }, [data, chartMetric]);

  // 최고 성과 소재 찾기
  const getBestCreative = (metric) => {
    if (!data?.creatives_data) return null;
    let bestIdx = 0;
    let bestValue = 0;
    data.creatives_data.forEach((c, idx) => {
      const value = c[metric] || 0;
      // 이탈률은 낮을수록 좋음
      if (metric === 'bounce_rate') {
        if (idx === 0 || value < bestValue) {
          bestValue = value;
          bestIdx = idx;
        }
      } else {
        if (value > bestValue) {
          bestValue = value;
          bestIdx = idx;
        }
      }
    });
    return bestIdx;
  };

  // 인사이트 생성
  const generateInsights = () => {
    if (!data?.creatives_data || data.creatives_data.length < 2) return [];

    const insights = [];
    const creativesData = data.creatives_data;

    // 전환율 최고 소재
    const bestConversionIdx = getBestCreative('conversion_rate');
    if (bestConversionIdx !== null && creativesData[bestConversionIdx]?.conversion_rate > 0) {
      insights.push({
        type: 'success',
        text: `"${creativesData[bestConversionIdx].creative_name.slice(0, 20)}..." 소재가 전환율 ${creativesData[bestConversionIdx].conversion_rate}%로 가장 높습니다.`
      });
    }

    // 매출 최고 소재
    const bestRevenueIdx = getBestCreative('revenue');
    if (bestRevenueIdx !== null && creativesData[bestRevenueIdx]?.revenue > 0) {
      insights.push({
        type: 'success',
        text: `막타 매출 기준 "${creativesData[bestRevenueIdx].creative_name.slice(0, 20)}..." 소재가 ${formatCurrency(creativesData[bestRevenueIdx].revenue)}로 최고입니다.`
      });
    }

    // 체류시간 대비 전환 분석
    creativesData.forEach((c, idx) => {
      if (c.avg_duration > 120 && c.conversion_rate < 2) {
        insights.push({
          type: 'warning',
          text: `"${c.creative_name.slice(0, 15)}..." 소재는 체류시간(${formatDuration(c.avg_duration)})은 길지만 전환율(${c.conversion_rate}%)이 낮습니다. 랜딩페이지 CTA 개선을 권장합니다.`
        });
      }
    });

    // 역할 보완성 분석
    if (data.role_comparison) {
      const hasFirstTouch = data.role_comparison.some(r => (r.first_touch_ratio || 0) >= 40);
      const hasLastTouch = data.role_comparison.some(r => (r.last_touch_ratio || 0) >= 40);
      if (hasFirstTouch && hasLastTouch) {
        insights.push({
          type: 'info',
          text: '선택한 소재들이 첫 접점과 막타 역할을 상호보완합니다. 함께 운영하면 시너지 효과가 기대됩니다.'
        });
      }
    }

    return insights.slice(0, 4); // 최대 4개
  };

  const insights = useMemo(() => generateInsights(), [data]);

  // 핵심 지표 테이블 컬럼
  const metricsColumns = [
    {
      title: '지표',
      dataIndex: 'metric',
      key: 'metric',
      width: 120,
      fixed: 'left',
      render: (text) => <Text strong style={{ fontSize: 13 }}>{text}</Text>
    },
    ...(data?.creatives_data || []).map((creative, idx) => ({
      title: (
        <div style={{ textAlign: 'center' }}>
          <Tag color={COLORS[idx]} style={{ marginBottom: 4 }}>소재 {idx + 1}</Tag>
          <div style={{ fontSize: 11, color: '#8c8c8c', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {creative.creative_name}
          </div>
        </div>
      ),
      dataIndex: `value_${idx}`,
      key: `value_${idx}`,
      width: 130,
      align: 'center',
      render: (value, record) => {
        const isBest = record.bestIdx === idx;
        return (
          <div style={{ 
            fontWeight: isBest ? 700 : 400,
            color: isBest ? COLORS[idx] : '#595959',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4
          }}>
            {value}
            {isBest && <Trophy size={14} style={{ color: '#faad14' }} />}
          </div>
        );
      }
    }))
  ];

  // 핵심 지표 테이블 데이터
  const metricsData = useMemo(() => {
    if (!data?.creatives_data) return [];

    const metrics = [
      { key: 'uv', label: 'UV (방문자 수)', format: formatNumber },
      { key: 'conversion_count', label: '전환 수', format: (v) => `${formatNumber(v)}건` },
      { key: 'conversion_rate', label: '전환율', format: (v) => `${v || 0}%`, reverse: false },
      { key: 'revenue', label: '막타 매출', format: formatCurrency },
      { key: 'attributed_revenue', label: '기여 매출', format: formatCurrency },
      { key: 'avg_duration', label: '평균 체류시간', format: formatDuration },
      { key: 'avg_pageviews', label: '평균 페이지뷰', format: (v) => `${(v || 0).toFixed(1)}` },
      { key: 'bounce_rate', label: '이탈률', format: (v) => `${v || 0}%`, reverse: true }
    ];

    return metrics.map(metric => {
      const row = { metric: metric.label, key: metric.key };
      let bestIdx = 0;
      let bestValue = metric.reverse ? Infinity : -Infinity;

      data.creatives_data.forEach((creative, idx) => {
        const value = creative[metric.key] || 0;
        row[`value_${idx}`] = metric.format(value);
        
        if (metric.reverse) {
          if (value < bestValue) {
            bestValue = value;
            bestIdx = idx;
          }
        } else {
          if (value > bestValue) {
            bestValue = value;
            bestIdx = idx;
          }
        }
      });

      row.bestIdx = bestIdx;
      return row;
    });
  }, [data]);

  // 커스텀 툴팁
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div style={{
        background: 'white',
        padding: '12px 16px',
        border: '1px solid #e8e8e8',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
      }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>{label}</div>
        {payload.map((entry, index) => (
          <div key={index} style={{ color: entry.color, marginBottom: 4, fontSize: 12 }}>
            소재 {index + 1}: {chartMetric === 'revenue' ? formatCurrency(entry.value) : formatNumber(entry.value)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ArrowLeftRight size={20} style={{ color: '#722ed1' }} />
          <span>소재 비교 분석</span>
          <Tag color="purple">{creatives?.length || 0}개 소재</Tag>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={1100}
      style={{ top: 20 }}
      styles={{
        body: { padding: '16px 24px', maxHeight: '85vh', overflowY: 'auto' }
      }}
    >
      <Spin spinning={loading}>
        {/* 선택된 소재 목록 */}
        <div style={{
          marginBottom: '16px',
          padding: '12px 16px',
          background: 'linear-gradient(135deg, #f5f0ff 0%, #ede7f6 100%)',
          borderRadius: '8px',
          border: '1px solid #d3adf7'
        }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {creatives?.map((creative, idx) => (
              <Tag 
                key={creative.key} 
                color={COLORS[idx]}
                style={{ 
                  padding: '4px 10px',
                  fontSize: 12,
                  maxWidth: 200,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {idx + 1}. {creative.creative_name}
              </Tag>
            ))}
          </div>
        </div>

        {data ? (
          <>
            {/* 섹션 1: 핵심 지표 비교 */}
            <Card 
              size="small" 
              style={{ marginBottom: '16px', borderRadius: 8 }}
              title={<span style={{ fontSize: 14, fontWeight: 600 }}>🎯 핵심 지표 비교</span>}
            >
              <Table
                columns={metricsColumns}
                dataSource={metricsData}
                rowKey="key"
                size="small"
                pagination={false}
                scroll={{ x: 'max-content' }}
              />
            </Card>

            {/* 섹션 2: 레이더 차트 + 기간별 추이 */}
            <Row gutter={16} style={{ marginBottom: '16px' }}>
              <Col span={10}>
                <Card 
                  size="small" 
                  style={{ borderRadius: 8, height: '100%' }}
                  title={<span style={{ fontSize: 14, fontWeight: 600 }}>🕸️ 다차원 비교</span>}
                >
                  {radarData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="#e8e8e8" />
                        <PolarAngleAxis 
                          dataKey="metric" 
                          tick={{ fontSize: 11, fill: '#595959' }}
                        />
                        <PolarRadiusAxis 
                          angle={90} 
                          domain={[0, 100]} 
                          tick={{ fontSize: 10 }}
                          tickCount={5}
                        />
                        {data.creatives_data.map((_, idx) => (
                          <Radar
                            key={idx}
                            name={`소재 ${idx + 1}`}
                            dataKey={`creative_${idx}`}
                            stroke={COLORS[idx]}
                            fill={COLORS[idx]}
                            fillOpacity={0.15}
                            strokeWidth={2}
                          />
                        ))}
                        <Legend 
                          wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="데이터 없음" />
                  )}
                </Card>
              </Col>
              <Col span={14}>
                <Card 
                  size="small" 
                  style={{ borderRadius: 8, height: '100%' }}
                  title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>📈 기간별 추이 비교</span>
                      <Segmented
                        size="small"
                        value={chartMetric}
                        onChange={setChartMetric}
                        options={[
                          { label: 'UV', value: 'uv' },
                          { label: '전환', value: 'conversion_count' },
                          { label: '매출', value: 'revenue' }
                        ]}
                      />
                    </div>
                  }
                >
                  {trendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
                        <RechartsTooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        {data.creatives_data.map((_, idx) => (
                          <Line 
                            key={idx}
                            type="monotone" 
                            dataKey={`creative_${idx}`}
                            name={`소재 ${idx + 1}`}
                            stroke={COLORS[idx]}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            activeDot={{ r: 5 }}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="추이 데이터 없음" />
                  )}
                </Card>
              </Col>
            </Row>

            {/* 섹션 3: 광고 역할 비교 */}
            <Card 
              size="small" 
              style={{ marginBottom: '16px', borderRadius: 8 }}
              title={<span style={{ fontSize: 14, fontWeight: 600 }}>🎭 광고 역할 비교</span>}
            >
              <div style={{ padding: '8px 0' }}>
                {data.role_comparison?.map((role, idx) => (
                  <div 
                    key={idx}
                    style={{ 
                      marginBottom: 16,
                      padding: '12px 16px',
                      background: '#fafafa',
                      borderRadius: 8,
                      border: `2px solid ${COLORS[idx]}20`
                    }}
                  >
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 8, 
                      marginBottom: 12 
                    }}>
                      <Tag color={COLORS[idx]} style={{ margin: 0 }}>소재 {idx + 1}</Tag>
                      <Text 
                        ellipsis={{ tooltip: role.creative_name }}
                        style={{ fontSize: 13, maxWidth: 300 }}
                      >
                        {role.creative_name}
                      </Text>
                      {role.dominant_role && (
                        <Tag 
                          color={
                            role.dominant_role === '막타형' ? 'green' : 
                            role.dominant_role === '첫 접점형' ? 'blue' : 'orange'
                          }
                          style={{ marginLeft: 'auto' }}
                        >
                          {role.dominant_role}
                        </Tag>
                      )}
                    </div>
                    <Row gutter={16}>
                      <Col span={8}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <Rocket size={16} style={{ color: '#1890ff' }} />
                          <span style={{ fontSize: 12 }}>첫 접점</span>
                          <span style={{ marginLeft: 'auto', fontWeight: 600, color: '#1890ff' }}>
                            {role.first_touch_ratio || 0}%
                          </span>
                        </div>
                        <Progress 
                          percent={role.first_touch_ratio || 0} 
                          showInfo={false}
                          strokeColor="#1890ff"
                          trailColor="#e6f4ff"
                          size="small"
                        />
                      </Col>
                      <Col span={8}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <GitBranch size={16} style={{ color: '#faad14' }} />
                          <span style={{ fontSize: 12 }}>중간 터치</span>
                          <span style={{ marginLeft: 'auto', fontWeight: 600, color: '#faad14' }}>
                            {role.mid_touch_ratio || 0}%
                          </span>
                        </div>
                        <Progress 
                          percent={role.mid_touch_ratio || 0} 
                          showInfo={false}
                          strokeColor="#faad14"
                          trailColor="#fffbe6"
                          size="small"
                        />
                      </Col>
                      <Col span={8}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <Target size={16} style={{ color: '#52c41a' }} />
                          <span style={{ fontSize: 12 }}>막타</span>
                          <span style={{ marginLeft: 'auto', fontWeight: 600, color: '#52c41a' }}>
                            {role.last_touch_ratio || 0}%
                          </span>
                        </div>
                        <Progress 
                          percent={role.last_touch_ratio || 0} 
                          showInfo={false}
                          strokeColor="#52c41a"
                          trailColor="#f6ffed"
                          size="small"
                        />
                      </Col>
                    </Row>
                  </div>
                ))}
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
                <strong> 중간 터치</strong>: 여정 중간에 노출 | 
                <strong> 막타</strong>: 구매 직전 마지막 광고
              </div>
            </Card>

            {/* 섹션 4: 인사이트 */}
            {insights.length > 0 && (
              <Card 
                size="small" 
                style={{ 
                  borderRadius: 8, 
                  background: 'linear-gradient(135deg, #fff7e6 0%, #fffbe6 100%)', 
                  border: '1px solid #ffe58f' 
                }}
                title={<span style={{ fontSize: 14, fontWeight: 600 }}>💡 비교 인사이트</span>}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {insights.map((insight, idx) => (
                    <div 
                      key={idx}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'flex-start', 
                        gap: 8,
                        padding: '8px 12px',
                        background: 'white',
                        borderRadius: 6,
                        border: '1px solid #f0f0f0'
                      }}
                    >
                      {insight.type === 'success' && <TrendingUp size={16} style={{ color: '#52c41a', marginTop: 2 }} />}
                      {insight.type === 'warning' && <TrendingDown size={16} style={{ color: '#faad14', marginTop: 2 }} />}
                      {insight.type === 'info' && <ArrowLeftRight size={16} style={{ color: '#1890ff', marginTop: 2 }} />}
                      <Text style={{ fontSize: 13, color: '#595959' }}>{insight.text}</Text>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        ) : !loading && (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span style={{ color: '#8c8c8c' }}>
                비교 분석 데이터를 불러올 수 없습니다
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

export default CreativeCompareModal;

