import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Typography, Space, Button, Alert, message, Tooltip } from 'antd';
import { ReloadOutlined, BarChartOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import SearchFilterBar from '../components/SearchFilterBar';
import DynamicUtmFilterBar from '../components/DynamicUtmFilterBar';

const { Title } = Typography;
const API_URL = import.meta.env.VITE_API_URL || '';

// ============================================================================
// 헬퍼 함수
// ============================================================================

// 체류시간 포맷팅 (초 → 분:초)
const formatDuration = (seconds) => {
  if (!seconds || seconds === 0) return '0초';
  
  const numSeconds = parseFloat(seconds);
  if (numSeconds < 60) {
    return `${Math.round(numSeconds)}초`;
  }
  
  const minutes = Math.floor(numSeconds / 60);
  const remainSeconds = Math.round(numSeconds % 60);
  
  if (remainSeconds === 0) {
    return `${minutes}분`;
  }
  
  return `${minutes}분 ${remainSeconds}초`;
};

// 금액 포맷팅
const formatCurrency = (amount) => {
  if (!amount || amount === 0) return '0원';
  return `${parseInt(amount).toLocaleString()}원`;
};

// 숫자 포맷팅
const formatNumber = (num) => {
  if (!num || num === 0) return '0';
  return parseInt(num).toLocaleString();
};

// ============================================================================
// CreativePerformance 컴포넌트
// ============================================================================
function CreativePerformance() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(500);
  const [error, setError] = useState(null);
  
  // 검색 및 필터 state
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    dateRange: [
      dayjs().subtract(30, 'days').format('YYYY-MM-DD'),
      dayjs().format('YYYY-MM-DD')
    ]
  });

  // 정렬 state
  const [sortField, setSortField] = useState('total_revenue');
  const [sortOrder, setSortOrder] = useState('desc');

  // 동적 UTM 필터 state
  const [activeUtmFilters, setActiveUtmFilters] = useState([]);

  // 데이터 조회
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setData([]); // 이전 데이터 초기화

    try {
      const params = {
        start: filters.dateRange[0],
        end: filters.dateRange[1],
        page: currentPage,
        limit: pageSize,
        search: searchTerm,
        sort_by: sortField,
        sort_order: sortOrder
      };

      // 동적 UTM 필터 추가
      if (activeUtmFilters.length > 0) {
        params.utm_filters = JSON.stringify(activeUtmFilters);
      }

      console.log('[CreativePerformance] Fetching with params:', params);

      const response = await axios.get(`${API_URL}/api/creative-performance`, { params });

      console.log('[CreativePerformance] Response total:', response.data.pagination?.total);
      console.log('[CreativePerformance] Response data count:', response.data.data?.length);

      if (response.data.success) {
        setData(response.data.data || []);
        setTotal(response.data.pagination.total || 0);
      } else {
        throw new Error(response.data.error || '데이터를 불러올 수 없습니다.');
      }
      
      setLoading(false);
    } catch (err) {
      console.error('광고 소재 분석 데이터 조회 실패:', err);
      setError(err.response?.data?.error || err.message || '데이터를 불러올 수 없습니다.');
      setData([]);
      setLoading(false);
    }
  };

  // 초기 로드 및 의존성 변경 시 재조회
  useEffect(() => {
    fetchData();
  }, [currentPage, pageSize, filters, searchTerm, sortField, sortOrder, activeUtmFilters]);

  // 검색 핸들러
  const handleSearch = (term) => {
    setSearchTerm(term);
    setCurrentPage(1);
  };

  // 필터 변경 핸들러
  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  // 초기화 핸들러
  const handleReset = () => {
    setSearchTerm('');
    setFilters({
      dateRange: [
        dayjs().subtract(30, 'days').format('YYYY-MM-DD'),
        dayjs().format('YYYY-MM-DD')
      ]
    });
    setSortField('total_revenue');
    setSortOrder('desc');
    setCurrentPage(1);
  };

  // 테이블 정렬 핸들러
  const handleTableChange = (pagination, filters, sorter) => {
    if (sorter.field) {
      setSortField(sorter.field);
      setSortOrder(sorter.order === 'ascend' ? 'asc' : 'desc');
    }
  };

  // 테이블 컬럼 정의
  const columns = [
    {
      title: 'UTM Source',
      dataIndex: 'utm_source',
      key: 'utm_source',
      width: 100,
      align: 'center',
      ellipsis: true,
      render: (text) => (
        <span style={{ fontSize: '12px' }} title={text}>
          {text || '-'}
        </span>
      ),
      sorter: true
    },
    {
      title: 'UTM Campaign',
      dataIndex: 'utm_campaign',
      key: 'utm_campaign',
      width: 120,
      align: 'center',
      ellipsis: true,
      render: (text) => (
        <span style={{ fontSize: '12px' }} title={text}>
          {text || '-'}
        </span>
      ),
      sorter: true
    },
    {
      title: 'UTM Medium',
      dataIndex: 'utm_medium',
      key: 'utm_medium',
      width: 100,
      align: 'center',
      ellipsis: true,
      render: (text) => (
        <span style={{ fontSize: '12px' }} title={text}>
          {text || '-'}
        </span>
      ),
      sorter: true
    },
    {
      title: '광고 소재 이름',
      dataIndex: 'creative_name',
      key: 'creative_name',
      width: 250,
      render: (text) => (
        <span 
          style={{ 
            fontSize: '11px',
            cursor: 'pointer',
            display: 'block',
            wordBreak: 'break-all',
            lineHeight: '1.4',
            textAlign: 'left'
          }} 
          onDoubleClick={() => {
            navigator.clipboard.writeText(text);
            message.success('광고 소재 이름이 복사되었습니다');
          }}
        >
          {text || '-'}
        </span>
      ),
      sorter: true
    },
    {
      title: 'UV',
      dataIndex: 'unique_visitors',
      key: 'unique_visitors',
      width: 60,
      align: 'center',
      render: (num) => <span style={{ fontWeight: 500, fontSize: '11px' }}>{formatNumber(num)}</span>,
      sorter: true
    },
    {
      title: '평균PV',
      dataIndex: 'avg_pageviews',
      key: 'avg_pageviews',
      width: 70,
      align: 'center',
      render: (num) => <span style={{ fontSize: '11px' }}>{num ? num.toFixed(1) : '0.0'}</span>,
      sorter: true
    },
    {
      title: <div style={{ whiteSpace: 'pre-line', lineHeight: '1.3' }}>평균<br/>체류시간</div>,
      dataIndex: 'avg_duration_seconds',
      key: 'avg_duration_seconds',
      width: 75,
      align: 'center',
      render: (seconds) => <span style={{ fontSize: '11px' }}>{formatDuration(seconds)}</span>,
      sorter: true
    },
    {
      title: '구매',
      dataIndex: 'purchase_count',
      key: 'purchase_count',
      width: 60,
      align: 'center',
      render: (num) => (
        <span style={{ 
          color: num > 0 ? '#52c41a' : '#999',
          fontWeight: num > 0 ? 600 : 400,
          fontSize: '11px'
        }}>
          {formatNumber(num)}
        </span>
      ),
      sorter: true
    },
    {
      title: '결제액',
      dataIndex: 'total_revenue',
      key: 'total_revenue',
      width: 85,
      align: 'center',
      render: (amount) => (
        <span style={{ 
          color: amount > 0 ? '#1890ff' : '#999',
          fontWeight: amount > 0 ? 600 : 400,
          fontSize: '10px'
        }}>
          {formatCurrency(amount)}
        </span>
      ),
      sorter: true
    },
    {
      title: <div style={{ whiteSpace: 'pre-line', lineHeight: '1.3' }}>결제건<br/>기여 포함 수</div>,
      dataIndex: 'contributed_orders_count',
      key: 'contributed_orders_count',
      width: 80,
      align: 'center',
      render: (num) => (
        <span style={{ 
          color: num > 0 ? '#52c41a' : '#999',
          fontWeight: num > 0 ? 500 : 400,
          fontSize: '11px'
        }}>
          {formatNumber(num)}
        </span>
      ),
      sorter: true
    },
    {
      title: <div style={{ whiteSpace: 'pre-line', lineHeight: '1.3' }}>결제건<br/>기여금액</div>,
      dataIndex: 'attributed_revenue',
      key: 'attributed_revenue',
      width: 85,
      align: 'center',
      render: (amount) => (
        <span style={{ 
          color: amount > 0 ? '#ff7a45' : '#999',
          fontWeight: amount > 0 ? 600 : 400,
          fontSize: '10px'
        }}>
          {formatCurrency(amount)}
        </span>
      ),
      sorter: true
    },
    {
      title: <div style={{ whiteSpace: 'pre-line', lineHeight: '1.3' }}>기여 결제건<br/>총 결제금액</div>,
      dataIndex: 'total_contributed_revenue',
      key: 'total_contributed_revenue',
      width: 95,
      align: 'center',
      render: (amount) => (
        <span style={{ 
          color: amount > 0 ? '#9254de' : '#999',
          fontWeight: amount > 0 ? 600 : 400,
          fontSize: '10px'
        }}>
          {formatCurrency(amount)}
        </span>
      ),
      sorter: true
    }
  ];

  return (
    <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
      
      {/* 헤더 */}
      <Card style={{ marginBottom: '16px' }}>
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Title level={2} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChartOutlined />
                광고 소재 모수 분석
              </Title>
              <div style={{ color: '#999', fontSize: '14px', marginTop: '4px' }}>
                각 광고 소재의 방문자 수, 페이지뷰, 체류시간, 구매 전환을 분석합니다
              </div>
            </div>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={fetchData}
              loading={loading}
            >
              새로고침
            </Button>
          </div>
          <Tag color="blue">총 {total.toLocaleString()}개 광고 소재</Tag>
        </Space>
      </Card>

      {/* 검색 및 필터 */}
      <SearchFilterBar
        searchPlaceholder="광고 소재 이름으로 검색..."
        onSearch={handleSearch}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
        filters={filters}
        showDeviceFilter={false}
        showBrowserFilter={false}
        showOsFilter={false}
        showBouncedFilter={false}
        showConvertedFilter={false}
        showUtmFilter={false}
        loading={loading}
      />

      {/* 동적 UTM 필터 */}
      <Card size="small" style={{ marginBottom: '16px' }}>
        <div style={{ marginBottom: '8px', fontSize: '13px', color: '#666', fontWeight: 500 }}>
          🔍 UTM 필터
        </div>
        <DynamicUtmFilterBar
          tableName="utm-sessions"
          onFilterChange={setActiveUtmFilters}
          loading={loading}
        />
      </Card>

      {/* 에러 표시 */}
      {error && (
        <Alert
          message="데이터 조회 실패"
          description={error}
          type="error"
          showIcon
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: '16px' }}
        />
      )}

      {/* 테이블 */}
      <Card>
        <Table
          columns={columns}
          dataSource={data}
          rowKey={(record) => `${record.creative_name}-${record.utm_source}-${record.utm_campaign}`}
          loading={loading}
          onChange={handleTableChange}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: total,
            showTotal: (total) => `총 ${total.toLocaleString()}개`,
            showSizeChanger: true,
            pageSizeOptions: ['100', '200', '500', '1000'],
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size);
            }
          }}
          size="small"
        />
      </Card>

      {/* 푸터 */}
      <div style={{ marginTop: '16px', textAlign: 'center', color: '#999' }}>
        마지막 갱신: {dayjs().format('YYYY-MM-DD HH:mm:ss')}
      </div>
    </div>
  );
}

export default CreativePerformance;

