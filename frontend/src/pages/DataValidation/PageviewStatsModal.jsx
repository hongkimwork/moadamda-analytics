import React, { useState, useEffect } from 'react';
import { Modal, Table, DatePicker, Button, Space, Spin, Card, Typography } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title } = Typography;

const { RangePicker } = DatePicker;
const API_BASE = import.meta.env.VITE_API_URL || '';

const siteVersionLabels = {
  pc: 'PC 버전',
  mobile: '모바일 버전'
};

function PageviewStatsModal({ open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [dailyData, setDailyData] = useState([]);
  const [summary, setSummary] = useState({ pageviews: 0, firstSessions: 0, pvPerSession: 0 });
  const [dateRange, setDateRange] = useState([
    dayjs().subtract(1, 'month').startOf('month'),
    dayjs().subtract(1, 'month').endOf('month')
  ]);

  const fetchData = async (start, end) => {
    setLoading(true);
    try {
      const startDate = start.format('YYYY-MM-DD');
      const endDate = end.format('YYYY-MM-DD');
      const response = await fetch(
        `${API_BASE}/api/stats/validation/pageview-stats?startDate=${startDate}&endDate=${endDate}`
      );
      const result = await response.json();
      setData(result.data || []);
      setDailyData(result.dailyData || []);
      setSummary(result.summary || { pageviews: 0, firstSessions: 0, pvPerSession: 0 });
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && dateRange[0] && dateRange[1]) {
      fetchData(dateRange[0], dateRange[1]);
    }
  }, [open]);

  const handleSearch = () => {
    if (dateRange[0] && dateRange[1]) {
      fetchData(dateRange[0], dateRange[1]);
    }
  };

  const handleQuickSelect = (type) => {
    let start, end;
    const today = dayjs();
    
    switch (type) {
      case 'today':
        start = today.startOf('day');
        end = today.endOf('day');
        break;
      case 'yesterday':
        start = today.subtract(1, 'day').startOf('day');
        end = today.subtract(1, 'day').endOf('day');
        break;
      case 'week':
        start = today.subtract(6, 'day').startOf('day');
        end = today.endOf('day');
        break;
      case '1month':
        start = today.subtract(1, 'month').startOf('day');
        end = today.endOf('day');
        break;
      case '3months':
        start = today.subtract(3, 'month').startOf('day');
        end = today.endOf('day');
        break;
      case '6months':
        start = today.subtract(6, 'month').startOf('day');
        end = today.endOf('day');
        break;
      case 'lastMonth':
        start = today.subtract(1, 'month').startOf('month');
        end = today.subtract(1, 'month').endOf('month');
        break;
      default:
        return;
    }
    
    setDateRange([start, end]);
    fetchData(start, end);
  };

  // 기기별 요약 테이블 컬럼
  const siteVersionColumns = [
    {
      title: '구분',
      dataIndex: 'siteVersion',
      key: 'siteVersion',
      width: 120,
      render: (val, record) => record.isTotal ? '전체' : (siteVersionLabels[val] || val)
    },
    {
      title: '페이지뷰',
      dataIndex: 'pageviews',
      key: 'pageviews',
      width: 120,
      align: 'right',
      render: (val) => val?.toLocaleString()
    },
    {
      title: '처음접속수',
      dataIndex: 'firstSessions',
      key: 'firstSessions',
      width: 120,
      align: 'right',
      render: (val) => val?.toLocaleString()
    },
    {
      title: '처음접속당PV',
      dataIndex: 'pvPerSession',
      key: 'pvPerSession',
      width: 120,
      align: 'right',
      render: (val) => val?.toFixed(1)
    }
  ];

  // 일별 상세 테이블 컬럼
  const dailyColumns = [
    {
      title: '날짜',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      sorter: (a, b) => {
        if (a.isTotal || b.isTotal) return 0;
        return new Date(a.date) - new Date(b.date);
      },
      render: (date) => dayjs(date).format('YYYY-MM-DD')
    },
    {
      title: '페이지뷰',
      dataIndex: 'pageviews',
      key: 'pageviews',
      width: 100,
      align: 'right',
      sorter: (a, b) => {
        if (a.isTotal || b.isTotal) return 0;
        return a.pageviews - b.pageviews;
      },
      render: (val) => (
        <span style={{ backgroundColor: '#fffde7', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
          {val?.toLocaleString()}
        </span>
      )
    },
    {
      title: '처음접속수',
      dataIndex: 'firstSessions',
      key: 'firstSessions',
      width: 100,
      align: 'right',
      sorter: (a, b) => {
        if (a.isTotal || b.isTotal) return 0;
        return a.firstSessions - b.firstSessions;
      },
      render: (val) => val?.toLocaleString()
    },
    {
      title: '처음접속당PV',
      dataIndex: 'pvPerSession',
      key: 'pvPerSession',
      width: 110,
      align: 'right',
      sorter: (a, b) => {
        if (a.isTotal || b.isTotal) return 0;
        return a.pvPerSession - b.pvPerSession;
      },
      render: (val) => val?.toFixed(1)
    },
    {
      title: '비교값',
      dataIndex: 'compareValue',
      key: 'compareValue',
      width: 100,
      align: 'right',
      render: (val) => val !== null ? val?.toLocaleString() : '-'
    },
    {
      title: '증감',
      dataIndex: 'change',
      key: 'change',
      width: 100,
      align: 'right',
      sorter: (a, b) => {
        if (a.isTotal || b.isTotal) return 0;
        return (a.change || 0) - (b.change || 0);
      },
      render: (val) => {
        if (val === null) return '-';
        if (val > 0) {
          return (
            <span style={{ color: '#f5222d' }}>
              <ArrowUpOutlined /> {val}
            </span>
          );
        } else if (val < 0) {
          return (
            <span style={{ color: '#1890ff' }}>
              <ArrowDownOutlined /> {val}
            </span>
          );
        }
        return <span>0</span>;
      }
    }
  ];

  const dataWithTotal = [
    {
      key: 'total',
      siteVersion: '전체',
      pageviews: summary.pageviews,
      firstSessions: summary.firstSessions,
      pvPerSession: summary.pvPerSession,
      isTotal: true
    },
    ...data.map((item, index) => ({ ...item, key: index }))
  ];

  const dailyDataWithTotal = [
    ...dailyData.map((item, index) => ({ ...item, key: index })),
    {
      key: 'total',
      date: '합계',
      pageviews: summary.pageviews,
      firstSessions: summary.firstSessions,
      pvPerSession: summary.pvPerSession,
      compareValue: null,
      change: null,
      isTotal: true
    }
  ];

  return (
    <Modal
      title="페이지뷰 통계"
      open={open}
      onCancel={onClose}
      footer={null}
      width={900}
      style={{ top: '2.5vh' }}
      styles={{ body: { height: 'calc(95vh - 55px)', overflowY: 'auto' } }}
    >
      {/* 기간 선택 */}
      <Card size="small" style={{ marginBottom: '16px' }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Space wrap>
            <RangePicker
              value={dateRange}
              onChange={(dates) => setDateRange(dates)}
              format="YYYY-MM-DD"
            />
            <Button type="primary" onClick={handleSearch}>조회</Button>
          </Space>
          <Space wrap>
            <Button size="small" onClick={() => handleQuickSelect('today')}>오늘</Button>
            <Button size="small" onClick={() => handleQuickSelect('yesterday')}>어제</Button>
            <Button size="small" onClick={() => handleQuickSelect('week')}>일주일</Button>
            <Button size="small" onClick={() => handleQuickSelect('1month')}>1개월</Button>
            <Button size="small" onClick={() => handleQuickSelect('3months')}>3개월</Button>
            <Button size="small" onClick={() => handleQuickSelect('6months')}>6개월</Button>
            <Button size="small" onClick={() => handleQuickSelect('lastMonth')}>전월</Button>
          </Space>
        </Space>
      </Card>

      <Spin spinning={loading}>
        {/* 기기별 요약 테이블 */}
        <Title level={5} style={{ marginBottom: '12px' }}>📱 기기별 요약</Title>
        <Table
          columns={siteVersionColumns}
          dataSource={dataWithTotal}
          pagination={false}
          size="middle"
          rowClassName={(record) => record.isTotal ? 'total-row' : ''}
          style={{ marginBottom: '24px' }}
        />

        {/* 일별 상세 테이블 */}
        <Title level={5} style={{ marginBottom: '12px' }}>📅 일별 상세</Title>
        <Table
          columns={dailyColumns}
          dataSource={dailyDataWithTotal}
          rowKey={(record) => record.isTotal ? 'total' : record.date}
          pagination={false}
          size="small"
          rowClassName={(record) => record.isTotal ? 'total-row-blue' : ''}
          scroll={{ y: 'calc(95vh - 500px)' }}
        />
      </Spin>

      <style>{`
        .total-row {
          background-color: #fffde7 !important;
        }
        .total-row td {
          background-color: #fffde7 !important;
        }
        .total-row-blue {
          background-color: #e6f7ff !important;
          font-weight: bold;
        }
        .total-row-blue td {
          background-color: #e6f7ff !important;
        }
      `}</style>
    </Modal>
  );
}

export default PageviewStatsModal;
