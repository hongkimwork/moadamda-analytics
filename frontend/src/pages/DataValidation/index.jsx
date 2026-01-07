import React, { useState, useEffect } from 'react';
import { Card, Typography, Table, DatePicker, Button, Space, Statistic, Row, Col, Spin } from 'antd';
import { CheckCircleOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title } = Typography;
const { RangePicker } = DatePicker;

const API_BASE = import.meta.env.VITE_API_URL || 'https://moadamda-analytics.co.kr';

function DataValidation() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({ totalVisits: 0, uniqueVisitors: 0, returningVisitors: 0 });
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
        `${API_BASE}/api/stats/validation/daily-visits?startDate=${startDate}&endDate=${endDate}`
      );
      const result = await response.json();
      setData(result.data || []);
      setSummary(result.summary || { totalVisits: 0, uniqueVisitors: 0, returningVisitors: 0 });
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (dateRange[0] && dateRange[1]) {
      fetchData(dateRange[0], dateRange[1]);
    }
  }, []);

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

  const columns = [
    {
      title: '날짜',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      render: (date) => dayjs(date).format('YYYY-MM-DD')
    },
    {
      title: '전체방문',
      dataIndex: 'totalVisits',
      key: 'totalVisits',
      width: 100,
      align: 'right',
      render: (val) => val?.toLocaleString()
    },
    {
      title: '순방문수',
      dataIndex: 'uniqueVisitors',
      key: 'uniqueVisitors',
      width: 100,
      align: 'right',
      render: (val) => (
        <span style={{ backgroundColor: '#fffde7', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
          {val?.toLocaleString()}
        </span>
      )
    },
    {
      title: '재방문수',
      dataIndex: 'returningVisitors',
      key: 'returningVisitors',
      width: 100,
      align: 'right',
      render: (val) => val?.toLocaleString()
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

  // 합계 행 추가
  const dataWithTotal = [
    ...data,
    {
      key: 'total',
      date: '합계',
      totalVisits: summary.totalVisits,
      uniqueVisitors: summary.uniqueVisitors,
      returningVisitors: summary.returningVisitors,
      compareValue: null,
      change: null,
      isTotal: true
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>
        <CheckCircleOutlined style={{ marginRight: '12px' }} />
        데이터 검증
      </Title>

      {/* 기간 선택 */}
      <Card style={{ marginBottom: '16px' }}>
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
            <Button onClick={() => handleQuickSelect('today')}>오늘</Button>
            <Button onClick={() => handleQuickSelect('yesterday')}>어제</Button>
            <Button onClick={() => handleQuickSelect('week')}>일주일</Button>
            <Button onClick={() => handleQuickSelect('1month')}>1개월</Button>
            <Button onClick={() => handleQuickSelect('3months')}>3개월</Button>
            <Button onClick={() => handleQuickSelect('6months')}>6개월</Button>
            <Button onClick={() => handleQuickSelect('lastMonth')}>전월</Button>
          </Space>
        </Space>
      </Card>

      {/* 요약 통계 */}
      <Card title="요약 통계" style={{ marginBottom: '16px' }}>
        <Row gutter={24}>
          <Col span={8}>
            <Statistic title="전체방문" value={summary.totalVisits} />
          </Col>
          <Col span={8}>
            <Statistic 
              title="순방문" 
              value={summary.uniqueVisitors}
              valueStyle={{ backgroundColor: '#fffde7', padding: '0 8px', borderRadius: '4px' }}
            />
          </Col>
          <Col span={8}>
            <Statistic title="재방문" value={summary.returningVisitors} />
          </Col>
        </Row>
      </Card>

      {/* 일별 통계 표 */}
      <Card title="상세통계 - 전체">
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={dataWithTotal}
            rowKey={(record) => record.isTotal ? 'total' : record.date}
            pagination={false}
            size="middle"
            rowClassName={(record) => record.isTotal ? 'total-row' : ''}
            scroll={{ y: 500 }}
          />
        </Spin>
      </Card>

      <style>{`
        .total-row {
          background-color: #e6f7ff !important;
          font-weight: bold;
        }
        .total-row td {
          background-color: #e6f7ff !important;
        }
      `}</style>
    </div>
  );
}

export default DataValidation;
