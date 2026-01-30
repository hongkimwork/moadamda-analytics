import { Modal, Table, Typography, Spin, Empty, Tag, Tooltip } from 'antd';
import { EyeOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';

const { Text } = Typography;
const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * CreativeEntriesModal - 광고 소재별 유입 기록 모달
 * 광고 클릭 → 자사몰 유입 시점을 시간순으로 표시
 */
function CreativeEntriesModal({ visible, onClose, creative, dateRange }) {
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0 });

  useEffect(() => {
    if (visible && creative && dateRange) {
      fetchEntries(1);
    }
  }, [visible, creative, dateRange]);

  const fetchEntries = async (page = 1) => {
    if (!creative || !dateRange) return;
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/creative-performance/entries`, {
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
        setEntries(response.data.data || []);
        setPagination(response.data.pagination || { page: 1, limit: 50, total: 0 });
      }
    } catch (error) {
      console.error('유입 기록 조회 실패:', error);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: '유입 시간',
      dataIndex: 'entry_timestamp',
      key: 'entry_timestamp',
      width: 160,
      align: 'center',
      render: (time) => (
        <div style={{ lineHeight: '1.4' }}>
          <div style={{ fontSize: 12, fontWeight: 500 }}>{dayjs(time).format('YYYY-MM-DD')}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1677ff' }}>{dayjs(time).format('HH:mm:ss')}</div>
        </div>
      )
    },
    {
      title: (
        <Tooltip title="같은 방문자가 이 광고를 다시 클릭한 간격">
          <span>재클릭 간격 <QuestionCircleOutlined style={{ fontSize: 12 }} /></span>
        </Tooltip>
      ),
      dataIndex: 'gap_formatted',
      key: 'gap_formatted',
      width: 110,
      align: 'center',
      render: (gap, record) => {
        if (gap === '-' || record.gap_seconds === null) {
          return <Tag color="blue">첫 유입</Tag>;
        }
        
        // 간격에 따른 색상
        let color = '#000000';
        let fontWeight = 400;
        const seconds = record.gap_seconds;
        
        if (seconds < 10) {
          color = '#8c8c8c';  // 10초 미만: 회색 (새로고침 추정)
        } else if (seconds < 60) {
          color = '#faad14';  // 1분 미만: 주황
          fontWeight = 500;
        } else if (seconds < 300) {
          color = '#1677ff';  // 5분 미만: 파랑
          fontWeight = 500;
        } else {
          color = '#389e0d';  // 5분 이상: 녹색
          fontWeight = 600;
        }
        
        return (
          <Text style={{ fontSize: 13, color, fontWeight }}>
            {gap}
          </Text>
        );
      }
    }
  ];

  // visitor별 그룹 색상
  const getVisitorColor = (visitorId) => {
    const uniqueVisitors = [...new Set(entries.map(e => e.visitor_id))];
    const index = uniqueVisitors.indexOf(visitorId);
    return index % 6;
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <EyeOutlined style={{ fontSize: 20, color: '#1890ff' }} />
          <span>이 광고로 들어온 기록</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={800}
      style={{ top: '5vh' }}
      styles={{ body: { padding: '16px 24px', maxHeight: 'calc(90vh - 60px)', overflowY: 'auto' } }}
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

      {/* 안내 메시지 */}
      <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fffbe6', borderRadius: 6, border: '1px solid #ffe58f', fontSize: 12, color: '#ad8b00' }}>
        광고를 클릭해서 자사몰에 들어온 기록입니다. 같은 배경색은 같은 방문자입니다.
      </div>

      {/* 진입 목록 테이블 */}
      <Spin spinning={loading}>
        {entries.length > 0 ? (
          <Table
            columns={columns}
            dataSource={entries}
            rowKey="id"
            size="small"
            pagination={{
              current: pagination.page,
              pageSize: pagination.limit,
              total: pagination.total,
              showTotal: (total) => `총 ${total.toLocaleString()}회 유입`,
              showSizeChanger: false,
              onChange: (page) => fetchEntries(page)
            }}
            rowClassName={(record) => {
              const colorIndex = getVisitorColor(record.visitor_id);
              return `visitor-group-${colorIndex}`;
            }}
          />
        ) : !loading && (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="해당 광고로 유입된 기록이 없습니다" />
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

export default CreativeEntriesModal;
