import { Modal, Table, Typography, Spin, Empty, Tag, Tooltip } from 'antd';
import { TeamOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';

const { Text } = Typography;
const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * CreativeSessionsModal - 광고 소재별 방문자별 세션 상세 모달
 * UV(고유 방문자) 컬럼 클릭 시 열리는 모달
 * - 같은 방문자의 여러 세션을 같은 색상으로 그룹화하여 표시
 * - View 컬럼 클릭 시 열리는 CreativeEntriesModal(유입 기록 모달)과는 다른 모달임
 */
function CreativeSessionsModal({ visible, onClose, creative, dateRange }) {
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0 });
  const [summary, setSummary] = useState({ uvCount: 0, totalSessions: 0 });

  useEffect(() => {
    if (visible && creative && dateRange) {
      fetchSessions(1);
    }
  }, [visible, creative, dateRange]);

  // FIX (2026-02-05): ad_id 추가 (메인 테이블과 동일한 기준으로 조회)
  const fetchSessions = async (page = 1) => {
    if (!creative || !dateRange) return;
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/creative-performance/sessions`, {
        ad_id: creative.ad_id,
        creative_name: creative.creative_name,
        utm_source: creative.utm_source,
        utm_medium: creative.utm_medium,
        utm_campaign: creative.utm_campaign,
        start: dateRange.start,
        end: dateRange.end,
        page,
        limit: 50
      });
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
      sorter: (a, b) => (a.duration_seconds || 0) - (b.duration_seconds || 0),
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
      sorter: (a, b) => (a.pageview_count || 0) - (b.pageview_count || 0),
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
      sorter: (a, b) => (a.total_scroll_px || 0) - (b.total_scroll_px || 0),
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

      {/* 안내 메시지 */}
      <div style={{ marginBottom: 12, padding: '8px 12px', background: '#f6ffed', borderRadius: 6, border: '1px solid #b7eb8f', fontSize: 12, color: '#389e0d' }}>
        같은 배경색은 같은 방문자의 세션입니다. 1명의 방문자가 여러 번 방문하면 여러 행으로 표시됩니다.
      </div>

      {/* 세션 목록 테이블 */}
      <Spin spinning={loading}>
        {sessions.length > 0 ? (
          <Table
            columns={columns}
            dataSource={sessions}
            rowKey="session_id"
            size="small"
            pagination={{
              current: pagination.page,
              pageSize: pagination.limit,
              total: pagination.total,
              showTotal: (total) => `총 ${total.toLocaleString()}개 세션`,
              showSizeChanger: false,
              onChange: (page) => fetchSessions(page)
            }}
            rowClassName={(record) => {
              // visitor_id별로 다양한 배경색 적용
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
