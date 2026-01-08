import { useState, useEffect } from 'react';
import { Modal, Table, DatePicker, Button, Space, Spin, Card } from 'antd';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const API_BASE = import.meta.env.VITE_API_URL || '';

function DailySalesModal({ open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({
    orderCount: 0, productCount: 0, totalAmount: 0, shippingFee: 0,
    discountAmount: 0, finalPayment: 0
  });
  const [dateRange, setDateRange] = useState([
    dayjs('2025-12-01'),
    dayjs('2025-12-31')
  ]);

  const fetchData = async (start, end) => {
    setLoading(true);
    try {
      const startDate = start.format('YYYY-MM-DD');
      const endDate = end.format('YYYY-MM-DD');
      const response = await fetch(
        `${API_BASE}/api/stats/validation/daily-sales?startDate=${startDate}&endDate=${endDate}`
      );
      const result = await response.json();
      setData(result.data || []);
      setSummary(result.summary || {
        orderCount: 0, productCount: 0, totalAmount: 0, shippingFee: 0,
        discountAmount: 0, finalPayment: 0
      });
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
      title: '일자',
      dataIndex: 'date',
      key: 'date',
      width: 110,
      fixed: 'left',
      sorter: (a, b) => {
        if (a.isTotal || b.isTotal) return 0;
        return new Date(a.date) - new Date(b.date);
      },
      render: (date, record) => record.isTotal ? '합계' : dayjs(date).format('YYYY-MM-DD')
    },
    {
      title: '주문수',
      dataIndex: 'orderCount',
      key: 'orderCount',
      width: 80,
      align: 'right',
      sorter: (a, b) => {
        if (a.isTotal || b.isTotal) return 0;
        return a.orderCount - b.orderCount;
      },
      render: (val) => val?.toLocaleString()
    },
    {
      title: '품목수',
      dataIndex: 'productCount',
      key: 'productCount',
      width: 80,
      align: 'right',
      sorter: (a, b) => {
        if (a.isTotal || b.isTotal) return 0;
        return a.productCount - b.productCount;
      },
      render: (val) => val?.toLocaleString()
    },
    {
      title: '상품구매금액',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 120,
      align: 'right',
      sorter: (a, b) => {
        if (a.isTotal || b.isTotal) return 0;
        return a.totalAmount - b.totalAmount;
      },
      render: (val) => val?.toLocaleString()
    },
    {
      title: '배송비',
      dataIndex: 'shippingFee',
      key: 'shippingFee',
      width: 90,
      align: 'right',
      render: (val) => val?.toLocaleString()
    },
    {
      title: '할인',
      dataIndex: 'discountAmount',
      key: 'discountAmount',
      width: 90,
      align: 'right',
      render: (val) => val?.toLocaleString()
    },
    {
      title: '결제합계',
      dataIndex: 'finalPayment',
      key: 'finalPayment',
      width: 120,
      align: 'right',
      sorter: (a, b) => {
        if (a.isTotal || b.isTotal) return 0;
        return a.finalPayment - b.finalPayment;
      },
      render: (val) => (
        <span style={{ color: '#1890ff', fontWeight: 500 }}>
          {val?.toLocaleString()}
        </span>
      )
    }
  ];

  const dataWithTotal = [
    ...data.map((item, index) => ({ ...item, key: index })),
    {
      key: 'total',
      isTotal: true,
      ...summary
    }
  ];

  return (
    <Modal
      title="💰 일별 매출 통계"
      open={open}
      onCancel={onClose}
      footer={null}
      width={1000}
      style={{ top: '2.5vh' }}
      styles={{ body: { height: 'calc(95vh - 55px)', overflowY: 'auto' } }}
    >
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
            <Button size="small" onClick={() => handleQuickSelect('lastMonth')}>전월</Button>
          </Space>
        </Space>
      </Card>

      <Spin spinning={loading}>
        <Table
          columns={columns}
          dataSource={dataWithTotal}
          pagination={false}
          size="small"
          rowClassName={(record) => record.isTotal ? 'total-row' : ''}
          scroll={{ x: 900, y: 'calc(95vh - 250px)' }}
        />
      </Spin>

      <style>{`
        .total-row {
          background-color: #e6f7ff !important;
          font-weight: bold;
        }
        .total-row td {
          background-color: #e6f7ff !important;
        }
      `}</style>
    </Modal>
  );
}

export default DailySalesModal;
