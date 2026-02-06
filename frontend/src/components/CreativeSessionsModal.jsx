import { Modal, Table, Typography, Spin, Empty, Tag, Tooltip, Button } from 'antd';
import { TeamOutlined, QuestionCircleOutlined, BarChartOutlined, TableOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts';

const { Text } = Typography;
const API_URL = import.meta.env.VITE_API_URL || '';

// 차트 색상 팔레트
const COLORS = {
  blue: '#1677ff',
  green: '#389e0d',
  orange: '#fa8c16',
  purple: '#722ed1',
  cyan: '#13c2c2',
  red: '#f5222d',
  geekblue: '#2f54eb',
  gold: '#faad14'
};

const BAR_COLORS = ['#1677ff', '#389e0d', '#fa8c16', '#722ed1', '#13c2c2'];
const PIE_COLORS = ['#1677ff', '#389e0d', '#fa8c16', '#722ed1', '#13c2c2', '#f5222d'];

/**
 * 커스텀 차트 Tooltip
 */
const ChartTooltipContent = ({ active, payload, label, suffix = '개' }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: '#fff', padding: '8px 12px', border: '1px solid #e8e8e8', borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
      <div style={{ fontSize: 12, color: '#595959', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#1677ff' }}>
        {payload[0].value.toLocaleString()}{suffix}
      </div>
    </div>
  );
};

/**
 * 커스텀 Pie 라벨 (퍼센트 표시)
 */
const renderPieLabel = ({ name, percent }) => {
  if (percent < 0.03) return null;
  return `${name} ${(percent * 100).toFixed(0)}%`;
};

/**
 * 차트 뷰 컴포넌트
 */
function SessionsChartView({ chartData, loading, totalSessions }) {
  if (loading) {
    return <div style={{ textAlign: 'center', padding: '60px 0' }}><Spin size="large" /></div>;
  }

  if (!chartData || totalSessions === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="차트 데이터가 없습니다" />;
  }

  const { duration_distribution, device_distribution, conversion_distribution, pv_distribution, hourly_distribution } = chartData;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 1. 체류시간 분포 */}
      <div style={{ background: '#fafafa', borderRadius: 10, padding: '16px 20px', border: '1px solid #f0f0f0' }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#262626' }}>
          체류시간 분포
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 400, marginLeft: 8 }}>
            방문자가 얼마나 오래 머무는지
          </Text>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={duration_distribution} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="range" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <RechartsTooltip content={<ChartTooltipContent suffix="개 세션" />} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={60}>
              {duration_distribution.map((entry, index) => (
                <Cell key={index} fill={BAR_COLORS[index % BAR_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 2. 기기 분포 + 전환 비율 (나란히) */}
      <div style={{ display: 'flex', gap: 16 }}>
        {/* 기기 분포 */}
        <div style={{ flex: 1, background: '#fafafa', borderRadius: 10, padding: '16px 20px', border: '1px solid #f0f0f0' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#262626' }}>
            기기 분포
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={device_distribution}
                dataKey="count"
                nameKey="device"
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={75}
                label={renderPieLabel}
                labelLine={{ stroke: '#8c8c8c', strokeWidth: 1 }}
              >
                {device_distribution.map((entry, index) => (
                  <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              <RechartsTooltip
                formatter={(value, name) => [`${value.toLocaleString()}개 (${totalSessions > 0 ? ((value / totalSessions) * 100).toFixed(1) : 0}%)`, name]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 전환 비율 */}
        <div style={{ flex: 1, background: '#fafafa', borderRadius: 10, padding: '16px 20px', border: '1px solid #f0f0f0' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#262626' }}>
            전환 비율
            <Text type="secondary" style={{ fontSize: 12, fontWeight: 400, marginLeft: 8 }}>
              구매 vs 이탈
            </Text>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={conversion_distribution}
                dataKey="count"
                nameKey="type"
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={75}
                label={renderPieLabel}
                labelLine={{ stroke: '#8c8c8c', strokeWidth: 1 }}
              >
                <Cell fill={COLORS.green} />
                <Cell fill="#d9d9d9" />
              </Pie>
              <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              <RechartsTooltip
                formatter={(value, name) => {
                  const total = conversion_distribution.reduce((sum, d) => sum + d.count, 0);
                  return [`${value.toLocaleString()}개 (${total > 0 ? ((value / total) * 100).toFixed(1) : 0}%)`, name];
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. PV 분포 */}
      <div style={{ background: '#fafafa', borderRadius: 10, padding: '16px 20px', border: '1px solid #f0f0f0' }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#262626' }}>
          페이지뷰(PV) 분포
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 400, marginLeft: 8 }}>
            페이지를 몇 개나 보는지
          </Text>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={pv_distribution} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="range" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <RechartsTooltip content={<ChartTooltipContent suffix="개 세션" />} />
            <Bar dataKey="count" fill={COLORS.purple} radius={[4, 4, 0, 0]} maxBarSize={60}>
              {pv_distribution.map((entry, index) => (
                <Cell key={index} fill={['#722ed1', '#9254de', '#b37feb', '#d3adf7', '#efdbff'][index % 5]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 4. 시간대별 방문 분포 */}
      <div style={{ background: '#fafafa', borderRadius: 10, padding: '16px 20px', border: '1px solid #f0f0f0' }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#262626' }}>
          시간대별 방문 분포
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 400, marginLeft: 8 }}>
            언제 방문이 집중되는지
          </Text>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={hourly_distribution} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="range" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <RechartsTooltip content={<ChartTooltipContent suffix="개 세션" />} />
            <Bar dataKey="count" fill={COLORS.cyan} radius={[4, 4, 0, 0]} maxBarSize={60}>
              {hourly_distribution.map((entry, index) => {
                // 가장 많은 시간대 강조
                const maxCount = Math.max(...hourly_distribution.map(h => h.count));
                const isMax = entry.count === maxCount && maxCount > 0;
                return <Cell key={index} fill={isMax ? '#fa8c16' : '#13c2c2'} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * CreativeSessionsModal - 광고 소재별 방문자별 세션 상세 모달
 * UV(고유 방문자) 컬럼 클릭 시 열리는 모달
 * - 같은 방문자의 여러 세션을 같은 색상으로 그룹화하여 표시
 * - View 컬럼 클릭 시 열리는 CreativeEntriesModal(유입 기록 모달)과는 다른 모달임
 * - 차트 보기 버튼으로 테이블/차트 뷰 전환 가능
 */
function CreativeSessionsModal({ visible, onClose, creative, dateRange }) {
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0 });
  const [summary, setSummary] = useState({ uvCount: 0, totalSessions: 0 });
  // 서버사이드 정렬 상태 관리
  const [sortField, setSortField] = useState(null);
  const [sortOrder, setSortOrder] = useState(null);
  // 차트 뷰 상태 관리
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'chart'
  const [chartData, setChartData] = useState(null);
  const [chartLoading, setChartLoading] = useState(false);

  useEffect(() => {
    if (visible && creative && dateRange) {
      // 모달 열릴 때 정렬 초기화 + 테이블 뷰로 리셋
      setSortField(null);
      setSortOrder(null);
      setViewMode('table');
      setChartData(null);
      fetchSessions(1, null, null);
      // FIX (2026-02-06): 모달 열릴 때 차트 데이터도 미리 조회 (세션 내 구매 수 표시용)
      fetchChartData();
    }
  }, [visible, creative, dateRange]);

  // FIX (2026-02-05): ad_id 추가 (메인 테이블과 동일한 기준으로 조회)
  // FIX (2026-02-06): 서버사이드 정렬 파라미터 추가
  const fetchSessions = async (page = 1, field = sortField, order = sortOrder) => {
    if (!creative || !dateRange) return;
    setLoading(true);
    try {
      const requestBody = {
        ad_id: creative.ad_id,
        creative_name: creative.creative_name,
        utm_source: creative.utm_source,
        utm_medium: creative.utm_medium,
        utm_campaign: creative.utm_campaign,
        start: dateRange.start,
        end: dateRange.end,
        page,
        limit: 50
      };
      // 정렬 기준이 있을 때만 전달
      if (field && order) {
        requestBody.sortField = field;
        requestBody.sortOrder = order;
      }
      const response = await axios.post(`${API_URL}/api/creative-performance/sessions`, requestBody);
      if (response.data.success) {
        setSessions(response.data.data || []);
        setPagination(response.data.pagination || { page: 1, limit: 50, total: 0 });
        setSummary(response.data.summary || { uvCount: 0, totalSessions: 0 });
      }
    } catch (error) {
      console.error('세션 목록 조회 실패:', error);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  // 차트 데이터 조회
  const fetchChartData = async () => {
    if (!creative || !dateRange) return;
    setChartLoading(true);
    try {
      const requestBody = {
        ad_id: creative.ad_id,
        creative_name: creative.creative_name,
        utm_source: creative.utm_source,
        utm_medium: creative.utm_medium,
        utm_campaign: creative.utm_campaign,
        start: dateRange.start,
        end: dateRange.end
      };
      const response = await axios.post(`${API_URL}/api/creative-performance/sessions/chart`, requestBody);
      if (response.data.success) {
        setChartData(response.data);
      }
    } catch (error) {
      console.error('차트 데이터 조회 실패:', error);
      setChartData(null);
    } finally {
      setChartLoading(false);
    }
  };

  // 뷰 모드 전환
  const toggleViewMode = () => {
    const newMode = viewMode === 'table' ? 'chart' : 'table';
    setViewMode(newMode);
    // 차트 모드로 전환 시 데이터가 없으면 조회
    if (newMode === 'chart' && !chartData) {
      fetchChartData();
    }
  };

  // 테이블 정렬/페이지 변경 핸들러
  const handleTableChange = (pag, _filters, sorter) => {
    // 프론트엔드 dataIndex → 백엔드 정렬 필드명 매핑
    const fieldMapping = { duration_formatted: 'duration_seconds' };
    const rawField = sorter.order ? sorter.field : null;
    const newField = rawField ? (fieldMapping[rawField] || rawField) : null;
    const newOrder = sorter.order || null;
    const newPage = pag.current || 1;

    // 정렬 변경 시 1페이지로 이동
    const isSort = newField !== sortField || newOrder !== sortOrder;
    const targetPage = isSort ? 1 : newPage;

    setSortField(newField);
    setSortOrder(newOrder);
    fetchSessions(targetPage, newField, newOrder);
  };

  // 방문자 그룹 색상 적용 여부: 기본 정렬 또는 세션 시작 정렬일 때만 적용
  const isVisitorGrouped = !sortField || sortField === 'start_time';

  // 디바이스 타입 한글 변환
  const getDeviceKorean = (device) => {
    const deviceMap = {
      'mobile': '모바일',
      'desktop': 'PC',
      'tablet': '태블릿',
      'unknown': '알 수 없음'
    };
    return deviceMap[device] || device;
  };


  const columns = [
    {
      title: '세션 시작',
      dataIndex: 'start_time',
      key: 'start_time',
      width: 90,
      align: 'center',
      sorter: true,
      sortOrder: sortField === 'start_time' ? sortOrder : null,
      render: (time) => (
        <div style={{ lineHeight: '1.4' }}>
          <div style={{ fontSize: 11 }}>{dayjs(time).format('YYYY-MM-DD')}</div>
          <div style={{ fontSize: 11 }}>{dayjs(time).format('HH:mm:ss')}</div>
        </div>
      )
    },
    {
      title: '세션 종료',
      dataIndex: 'end_time',
      key: 'end_time',
      width: 90,
      align: 'center',
      render: (time) => time ? (
        <div style={{ lineHeight: '1.4' }}>
          <div style={{ fontSize: 11 }}>{dayjs(time).format('YYYY-MM-DD')}</div>
          <div style={{ fontSize: 11 }}>{dayjs(time).format('HH:mm:ss')}</div>
        </div>
      ) : <Text type="secondary">-</Text>
    },
    {
      title: (
        <Tooltip title="세션 동안 머문 시간">
          <span>체류시간 <QuestionCircleOutlined style={{ fontSize: 13 }} /></span>
        </Tooltip>
      ),
      dataIndex: 'duration_formatted',
      key: 'duration_formatted',
      width: 100,
      align: 'center',
      sorter: true,
      sortOrder: sortField === 'duration_seconds' ? sortOrder : null,
      render: (duration, record) => {
        const seconds = record.duration_seconds;
        let color = '#000000';
        let fontWeight = 400;
        
        // 10분 이상은 하이라이트
        if (seconds >= 600) {
          color = '#389e0d';
          fontWeight = 600;
        } else if (seconds >= 120) {
          color = '#1677ff';
          fontWeight = 500;
        }
        
        return (
          <Text style={{ fontSize: 13, color, fontWeight }}>
            {duration}
          </Text>
        );
      }
    },
    {
      title: 'PV',
      dataIndex: 'pageview_count',
      key: 'pageview_count',
      width: 60,
      align: 'center',
      sorter: true,
      sortOrder: sortField === 'pageview_count' ? sortOrder : null,
      render: (count) => (
        <Text style={{ 
          fontSize: 13, 
          color: count >= 5 ? '#389e0d' : count >= 2 ? '#1677ff' : '#000000',
          fontWeight: count >= 5 ? 600 : 400
        }}>
          {count}
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
          {getDeviceKorean(device)}
        </Tag>
      )
    },
    {
      title: '스크롤',
      dataIndex: 'total_scroll_px',
      key: 'total_scroll_px',
      width: 80,
      align: 'center',
      sorter: true,
      sortOrder: sortField === 'total_scroll_px' ? sortOrder : null,
      render: (px) => (
        <Text style={{ 
          fontSize: 13, 
          color: px > 0 ? '#4b5563' : '#9ca3af', 
          fontWeight: px > 1000 ? 500 : 400 
        }}>
          {px > 0 ? `${px.toLocaleString()}px` : '0px'}
        </Text>
      )
    },
    {
      title: '전환',
      dataIndex: 'is_converted',
      key: 'is_converted',
      width: 70,
      align: 'center',
      render: (converted) => (
        <Tag color={converted ? 'green' : 'default'}>
          {converted ? '구매' : '이탈'}
        </Tag>
      )
    }
  ];

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <TeamOutlined style={{ fontSize: 20, color: '#389e0d' }} />
          <span>방문자별 세션 상세</span>
          <Button
            type={viewMode === 'chart' ? 'primary' : 'default'}
            size="small"
            icon={viewMode === 'chart' ? <TableOutlined /> : <BarChartOutlined />}
            onClick={toggleViewMode}
            style={{ marginLeft: 8 }}
          >
            {viewMode === 'chart' ? '테이블 보기' : '차트 보기'}
          </Button>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={1000}
      style={{ top: '2.5vh' }}
      styles={{ body: { padding: '16px 24px', height: 'calc(95vh - 60px)', overflowY: 'auto' } }}
    >
      {/* 광고 소재 정보 */}
      {creative && (
        <div style={{ marginBottom: 16, padding: '12px 16px', background: 'linear-gradient(135deg, #f0f5ff 0%, #e6f4ff 100%)', borderRadius: 8, border: '1px solid #d6e4ff' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#1d39c4', marginBottom: 8 }}>{creative.creative_name}</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Tag color="blue">{creative.utm_source}</Tag>
              <Tag color="cyan">{creative.utm_medium}</Tag>
              <Tag color="purple">{creative.utm_campaign}</Tag>
            </div>
            <Text style={{ fontSize: 13, color: '#595959' }}>
              순 방문자(UV) <Text strong style={{ color: '#389e0d' }}>{summary.uvCount.toLocaleString()}명</Text>
              {' / '}
              총 <Text strong style={{ color: '#1890ff' }}>{summary.totalSessions.toLocaleString()}개</Text> 세션
            </Text>
          </div>
        </div>
      )}

      {/* 뷰 모드에 따라 테이블 또는 차트 표시 */}
      {viewMode === 'table' ? (
        <>
          {/* 안내 메시지 */}
          <div style={{ marginBottom: 12, padding: '8px 12px', background: '#f6ffed', borderRadius: 6, border: '1px solid #b7eb8f', fontSize: 12, color: '#389e0d' }}>
            같은 배경색은 같은 방문자의 세션입니다. 1명의 방문자가 여러 번 방문하면 여러 행으로 표시됩니다.
          </div>

          {/* UV 전환 구매 수 vs 막타 횟수 차이 안내 */}
          {(() => {
            const lastTouchCount = creative?.last_touch_count || 0;
            if (lastTouchCount === 0) return null;
            
            // 로딩 중: 스켈레톤 표시
            if (chartLoading || !chartData || !chartData.conversion_distribution || chartData.session_purchase_last_touch_count === null || chartData.session_purchase_last_touch_count === undefined) {
              return (
                <div style={{ marginBottom: 12, padding: '10px 14px', background: '#e6f7ff', borderRadius: 6, border: '1px solid #91d5ff', fontSize: 12, color: '#1890ff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Spin size="small" />
                    <span style={{ color: '#8c8c8c' }}>세션 내 구매 분석 중...</span>
                  </div>
                </div>
              );
            }
            
            const sessionPurchaseCount = chartData.conversion_distribution.find(d => d.type === '구매')?.count || 0;
            if (sessionPurchaseCount === 0 && lastTouchCount === 0) return null;
            if (sessionPurchaseCount === lastTouchCount) return null;
            const commonCount = chartData.session_purchase_last_touch_count;
            const otherLastTouchCount = sessionPurchaseCount - commonCount;
            const lastTouchNotInSession = Math.max(0, lastTouchCount - commonCount);
            return (
              <div style={{ marginBottom: 12, padding: '10px 14px', background: '#e6f7ff', borderRadius: 6, border: '1px solid #91d5ff', fontSize: 12, color: '#1890ff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                  <InfoCircleOutlined />
                  <span style={{ fontWeight: 600 }}>
                    세션 내 구매: {sessionPurchaseCount.toLocaleString()}건 / 막타 횟수: {lastTouchCount.toLocaleString()}건
                  </span>
                </div>
                <div style={{ color: '#595959', lineHeight: 1.9, paddingLeft: 2 }}>
                  <span style={{ fontWeight: 600, color: '#333' }}>왜 수치가 다를까요?</span><br />
                  이 광고를 클릭 → 바로 구매 + 마지막 본 광고도 이것 : <span style={{ fontWeight: 600, color: '#1890ff' }}>{commonCount.toLocaleString()}건</span> (공통)<br />
                  <span style={{ color: '#1890ff', fontWeight: 600 }}>(1)</span> 이 광고를 클릭해서 들어온 방문에서 구매했지만, 사기 직전에 <span style={{ fontWeight: 600 }}>다른 광고를 한 번 더 본 경우</span><br />
                  <span style={{ paddingLeft: 20, display: 'inline-block' }}>→ <span style={{ fontWeight: 600, color: '#1890ff' }}>{otherLastTouchCount.toLocaleString()}건</span>이 세션 내 구매에는 포함되지만, 막타에서는 빠짐</span><br />
                  <span style={{ color: '#1890ff', fontWeight: 600 }}>(2)</span> 이 광고를 본 후, <span style={{ fontWeight: 600 }}>나중에 직접 사이트에 들어와서 구매한 경우</span><br />
                  <span style={{ paddingLeft: 20, display: 'inline-block' }}>→ <span style={{ fontWeight: 600, color: '#1890ff' }}>{lastTouchNotInSession.toLocaleString()}건</span>이 세션 내 구매에서는 빠지지만, 막타에는 포함</span>
                </div>
              </div>
            );
          })()}

          {/* 세션 목록 테이블 */}
          <Spin spinning={loading}>
            {sessions.length > 0 ? (
              <Table
                columns={columns}
                dataSource={sessions}
                rowKey="session_id"
                size="small"
                onChange={handleTableChange}
                pagination={{
                  current: pagination.page,
                  pageSize: pagination.limit,
                  total: pagination.total,
                  showTotal: (total) => `총 ${total.toLocaleString()}개 세션`,
                  showSizeChanger: false
                }}
                rowClassName={(record) => {
                  // 방문자 그룹 색상: 기본 정렬 또는 세션 시작 정렬일 때만 적용
                  if (!isVisitorGrouped) return '';
                  const uniqueVisitors = [...new Set(sessions.map(s => s.visitor_id))];
                  const visitorIndex = uniqueVisitors.indexOf(record.visitor_id);
                  const colorIndex = visitorIndex % 6; // 6가지 색상 순환
                  return `visitor-group-${colorIndex}`;
                }}
              />
            ) : !loading && (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="해당 광고 소재로 유입된 세션이 없습니다" />
            )}
          </Spin>
        </>
      ) : (
        /* 차트 뷰 */
        <SessionsChartView
          chartData={chartData}
          loading={chartLoading}
          totalSessions={chartData?.totalSessions || 0}
        />
      )}

      {dateRange && (
        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 12, color: '#8c8c8c' }}>
          조회 기간: {dateRange.start} ~ {dateRange.end}
        </div>
      )}

      <style>{`
        /* 연한 파란색 */
        .visitor-group-0 td {
          background-color: #e6f4ff !important;
        }
        .visitor-group-0:hover td {
          background-color: #bae0ff !important;
        }
        
        /* 연한 초록색 */
        .visitor-group-1 td {
          background-color: #f6ffed !important;
        }
        .visitor-group-1:hover td {
          background-color: #d9f7be !important;
        }
        
        /* 연한 노란색 */
        .visitor-group-2 td {
          background-color: #fffbe6 !important;
        }
        .visitor-group-2:hover td {
          background-color: #fff1b8 !important;
        }
        
        /* 연한 보라색 */
        .visitor-group-3 td {
          background-color: #f9f0ff !important;
        }
        .visitor-group-3:hover td {
          background-color: #efdbff !important;
        }
        
        /* 연한 주황색 */
        .visitor-group-4 td {
          background-color: #fff7e6 !important;
        }
        .visitor-group-4:hover td {
          background-color: #ffe7ba !important;
        }
        
        /* 연한 청록색 */
        .visitor-group-5 td {
          background-color: #e6fffb !important;
        }
        .visitor-group-5:hover td {
          background-color: #b5f5ec !important;
        }
      `}</style>
    </Modal>
  );
}

export default CreativeSessionsModal;
