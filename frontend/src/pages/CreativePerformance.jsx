import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Table, Tag, Typography, Space, Button, Alert, message, Tooltip, Divider, Dropdown, Checkbox } from 'antd';
import { BarChartOutlined, ShoppingCartOutlined, SettingOutlined, NodeIndexOutlined, FileSearchOutlined, SwapOutlined } from '@ant-design/icons';
import { Search, BarChart3, RefreshCw, Layers, GitCompare } from 'lucide-react';
import axios from 'axios';
import dayjs from 'dayjs';
import SearchFilterBar from '../components/SearchFilterBar';
import DynamicUtmFilterBar from '../components/DynamicUtmFilterBar';
import UtmSourceQuickFilter from '../components/UtmSourceQuickFilter';
import CreativeOrdersModal from '../components/CreativeOrdersModal';
import CreativeAnalysisModal from '../components/CreativeAnalysisModal';
import CreativeJourneyModal from '../components/CreativeJourneyModal';
import CreativeLandingModal from '../components/CreativeLandingModal';
import CreativeCompareModal from '../components/CreativeCompareModal';

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
  // URL 쿼리 파라미터 읽기 (광고 클릭 카드에서 이동 시 search 파라미터 사용)
  const [searchParams] = useSearchParams();
  const initialSearchTerm = searchParams.get('search') || '';

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(500);
  const [error, setError] = useState(null);

  // 검색 및 필터 state (URL 쿼리 파라미터 우선)
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
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
  
  // UTM Source 퀵 필터 state
  const [quickFilterSources, setQuickFilterSources] = useState([]);

  // 주문 보기 모달 state
  const [ordersModalVisible, setOrdersModalVisible] = useState(false);
  const [selectedCreative, setSelectedCreative] = useState(null);

  // 성과 분석 모달 state
  const [analysisModalVisible, setAnalysisModalVisible] = useState(false);
  const [analysisCreative, setAnalysisCreative] = useState(null);

  // 고객 여정 모달 state
  const [journeyModalVisible, setJourneyModalVisible] = useState(false);
  const [journeyCreative, setJourneyCreative] = useState(null);

  // 페이지 분석 모달 state
  const [landingModalVisible, setLandingModalVisible] = useState(false);
  const [landingCreative, setLandingCreative] = useState(null);

  // 소재 비교 선택 state
  const [selectedCreatives, setSelectedCreatives] = useState([]);
  const [compareModalVisible, setCompareModalVisible] = useState(false);

  // 주문 보기 버튼 클릭 핸들러
  const handleViewOrders = (record) => {
    setSelectedCreative({
      creative_name: record.creative_name,
      utm_source: record.utm_source,
      utm_medium: record.utm_medium,
      utm_campaign: record.utm_campaign
    });
    setOrdersModalVisible(true);
  };

  // 성과 분석 버튼 클릭 핸들러
  const handleViewAnalysis = (record) => {
    setAnalysisCreative({
      creative_name: record.creative_name,
      utm_source: record.utm_source,
      utm_medium: record.utm_medium,
      utm_campaign: record.utm_campaign
    });
    setAnalysisModalVisible(true);
  };

  // 고객 여정 버튼 클릭 핸들러
  const handleViewJourney = (record) => {
    setJourneyCreative({
      creative_name: record.creative_name,
      utm_source: record.utm_source,
      utm_medium: record.utm_medium,
      utm_campaign: record.utm_campaign
    });
    setJourneyModalVisible(true);
  };

  // 페이지 분석 버튼 클릭 핸들러
  const handleViewLanding = (record) => {
    setLandingCreative({
      creative_name: record.creative_name,
      utm_source: record.utm_source,
      utm_medium: record.utm_medium,
      utm_campaign: record.utm_campaign
    });
    setLandingModalVisible(true);
  };

  // 소재 선택 핸들러 (비교용)
  const getRowKey = (record) => `${record.creative_name}||${record.utm_source}||${record.utm_campaign}`;
  
  const handleSelectCreative = (record, checked) => {
    const key = getRowKey(record);
    if (checked) {
      if (selectedCreatives.length < 5) {
        setSelectedCreatives([...selectedCreatives, { key, ...record }]);
      } else {
        message.warning('최대 5개까지 선택할 수 있습니다');
      }
    } else {
      setSelectedCreatives(selectedCreatives.filter(item => item.key !== key));
    }
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      const firstFive = data.slice(0, 5).map(record => ({ key: getRowKey(record), ...record }));
      setSelectedCreatives(firstFive);
      if (data.length > 5) {
        message.info('최대 5개까지 선택되었습니다');
      }
    } else {
      setSelectedCreatives([]);
    }
  };

  const isSelected = (record) => {
    const key = getRowKey(record);
    return selectedCreatives.some(item => item.key === key);
  };

  // 소재 비교 모달 열기
  const handleOpenCompare = () => {
    if (selectedCreatives.length < 2) {
      message.warning('비교하려면 최소 2개 이상 선택해주세요');
      return;
    }
    setCompareModalVisible(true);
  };

  // 요약 통계 계산 (현재 페이지 기준)
  const summaryStats = React.useMemo(() => {
    if (!data || data.length === 0) return { totalRevenue: 0, totalOrders: 0, totalUV: 0, maxRevenue: 0 };

    return data.reduce((acc, curr) => {
      acc.totalRevenue += (curr.total_contributed_revenue || 0);
      acc.totalOrders += (curr.contributed_orders_count || 0);
      acc.totalUV += (curr.unique_visitors || 0);
      acc.maxRevenue = Math.max(acc.maxRevenue, curr.total_contributed_revenue || 0, curr.attributed_revenue || 0);
      return acc;
    }, { totalRevenue: 0, totalOrders: 0, totalUV: 0, maxRevenue: 0 });
  }, [data]);

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

      // 동적 UTM 필터 + 퀵 필터 병합
      const combinedFilters = [...activeUtmFilters];
      
      // 퀵 필터가 있으면 utm_source IN 조건 추가
      if (quickFilterSources.length > 0) {
        combinedFilters.push({
          key: 'utm_source',
          operator: 'in',
          value: quickFilterSources
        });
      }
      
      if (combinedFilters.length > 0) {
        params.utm_filters = JSON.stringify(combinedFilters);
      }

      const response = await axios.get(`${API_URL}/api/creative-performance`, { params });

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
  }, [currentPage, pageSize, filters, searchTerm, sortField, sortOrder, activeUtmFilters, quickFilterSources]);

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
      title: (
        <Checkbox
          checked={selectedCreatives.length > 0 && selectedCreatives.length === Math.min(data.length, 5)}
          indeterminate={selectedCreatives.length > 0 && selectedCreatives.length < Math.min(data.length, 5)}
          onChange={(e) => handleSelectAll(e.target.checked)}
        />
      ),
      key: 'select',
      width: 50,
      align: 'center',
      fixed: 'left',
      render: (_, record) => (
        <Checkbox
          checked={isSelected(record)}
          onChange={(e) => handleSelectCreative(record, e.target.checked)}
        />
      )
    },
    {
      title: <div style={{ whiteSpace: 'pre-line', lineHeight: '1.3' }}>UTM<br />Source</div>,
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
      sorter: true,
      showSorterTooltip: false
    },
    {
      title: <div style={{ whiteSpace: 'pre-line', lineHeight: '1.3' }}>UTM<br />Campaign</div>,
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
      sorter: true,
      showSorterTooltip: false
    },
    {
      title: <div style={{ whiteSpace: 'pre-line', lineHeight: '1.3' }}>UTM<br />Medium</div>,
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
      sorter: true,
      showSorterTooltip: false
    },
    {
      title: '광고 소재 이름',
      dataIndex: 'creative_name',
      key: 'creative_name',
      width: 250,
      fixed: 'left',
      render: (text) => (
        <span
          style={{
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'block',
            wordBreak: 'break-all',
            lineHeight: '1.5',
            textAlign: 'left',
            color: '#1a1a1a',
            transition: 'color 0.2s ease'
          }}
          onDoubleClick={() => {
            navigator.clipboard.writeText(text);
            message.success('광고 소재 이름이 복사되었습니다');
          }}
          onMouseEnter={(e) => e.target.style.color = '#595959'}
          onMouseLeave={(e) => e.target.style.color = '#1a1a1a'}
          title="더블클릭하면 복사됩니다"
        >
          {text || '-'}
        </span>
      ),
      sorter: true,
      showSorterTooltip: false
    },
    {
      title: 'UV',
      dataIndex: 'unique_visitors',
      key: 'unique_visitors',
      width: 60,
      align: 'center',
      render: (num) => <span style={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>{formatNumber(num)}</span>,
      sorter: true,
      showSorterTooltip: false
    },
    {
      title: '평균PV',
      dataIndex: 'avg_pageviews',
      key: 'avg_pageviews',
      width: 70,
      align: 'center',
      render: (num) => <span style={{ fontSize: '12px', color: '#4b5563', fontWeight: 500 }}>{num ? num.toFixed(1) : '0.0'}</span>,
      sorter: true,
      showSorterTooltip: false
    },
    {
      title: <div style={{ whiteSpace: 'pre-line', lineHeight: '1.3' }}>평균<br />체류시간</div>,
      dataIndex: 'avg_duration_seconds',
      key: 'avg_duration_seconds',
      width: 75,
      align: 'center',
      render: (seconds) => <span style={{ fontSize: '12px', color: '#4b5563', fontWeight: 500 }}>{formatDuration(seconds)}</span>,
      sorter: true,
      showSorterTooltip: false
    },

    {
      title: (
        <Tooltip
          title={
            <div style={{ whiteSpace: 'pre-line' }}>
              {`구매 직전 마지막으로 본 광고로서 발생한 결제금액의 합계입니다.
다른 광고를 봤더라도 마지막에 이 광고를 보고 구매했다면 결제금액이 합산됩니다.

예시: 철수가 10만원 구매
• 광고 여정: A 광고 → B 광고 → C 광고 → 구매
• 결과: A 광고 0원, B 광고 0원, C 광고 +10만원

💡 이 숫자가 높으면?
→ 이 광고가 구매 결정의 마지막 터치포인트로서 큰 매출을 이끌었다는 의미`}
            </div>
          }
          overlayStyle={{ maxWidth: '420px' }}
        >
          <div style={{ whiteSpace: 'pre-line', lineHeight: '1.3' }}>
            막타<br />결제액
          </div>
        </Tooltip>
      ),
      dataIndex: 'total_revenue',
      key: 'total_revenue',
      width: 85,
      align: 'center',
      render: (amount) => {
        const percent = summaryStats.maxRevenue > 0 ? (amount / summaryStats.maxRevenue) * 100 : 0;
        return (
          <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: '10%',
                height: '80%',
                width: `${percent}%`,
                background: 'linear-gradient(90deg, rgba(9, 88, 217, 0.12) 0%, rgba(22, 119, 255, 0.18) 100%)',
                borderRadius: '4px',
                transition: 'width 0.3s ease'
              }}
            />
            <span style={{
              color: amount > 0 ? '#0958d9' : '#9ca3af',
              fontWeight: amount > 0 ? 600 : 400,
              fontSize: '11px',
              position: 'relative',
              zIndex: 1,
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}>
              {formatCurrency(amount)}
            </span>
          </div>
        );
      },
      sorter: true,
      showSorterTooltip: false
    },
    {
      title: (
        <Tooltip
          title={
            <div style={{ whiteSpace: 'pre-line' }}>
              {`이 광고를 본 적 있는 고객이 구매한 주문 건수입니다.
다른 광고도 함께 봤더라도 모두 카운트됩니다.

예시: 철수가 10만원 구매
• 철수의 광고 여정: A 광고 → B 광고 → 구매
• 결과: A 광고 +1건, B 광고 +1건

💡 이 숫자가 높으면?
→ 많은 구매 고객이 이 광고를 거쳐갔다는 의미`}
            </div>
          }
          overlayStyle={{ maxWidth: '380px' }}
        >
          <div style={{ whiteSpace: 'pre-line', lineHeight: '1.3' }}>
            영향 준<br />주문 수
          </div>
        </Tooltip>
      ),
      dataIndex: 'contributed_orders_count',
      key: 'contributed_orders_count',
      width: 80,
      align: 'center',
      render: (num) => (
        <span style={{
          color: num > 0 ? '#389e0d' : '#9ca3af',
          fontWeight: num > 0 ? 600 : 400,
          fontSize: '12px'
        }}>
          {formatNumber(num)}
        </span>
      ),
      sorter: true,
      showSorterTooltip: false
    },
    {
      title: (
        <Tooltip
          title={
            <div style={{ whiteSpace: 'pre-line' }}>
              {`구매 직전 마지막으로 본 광고로서 구매한 횟수입니다.
다른 광고를 봤더라도 마지막에 이 광고를 보고 구매했다면 카운트됩니다.

예시: 철수가 10만원 구매
• 광고 여정: A 광고 → B 광고 → C 광고 → 구매
• 결과: A 광고 0건, B 광고 0건, C 광고 +1건

💡 이 숫자가 높으면?
→ 이 광고가 구매 결정의 마지막 터치포인트로 많이 작용했다는 의미`}
            </div>
          }
          overlayStyle={{ maxWidth: '420px' }}
        >
          <div style={{ whiteSpace: 'pre-line', lineHeight: '1.3' }}>
            막타<br />횟수
          </div>
        </Tooltip>
      ),
      dataIndex: 'last_touch_count',
      key: 'last_touch_count',
      width: 70,
      align: 'center',
      render: (num) => (
        <span style={{
          color: num > 0 ? '#cf1322' : '#9ca3af',
          fontWeight: num > 0 ? 600 : 400,
          fontSize: '12px'
        }}>
          {formatNumber(num)}
        </span>
      ),
      sorter: true,
      showSorterTooltip: false
    },
    {
      title: (
        <Tooltip
          title={
            <div style={{ whiteSpace: 'pre-line' }}>
              {`구매 금액을 각 광고의 기여도에 따라 나눈 금액입니다.

계산 방식:
• 광고 1개만 봤으면 → 그 광고가 100% 가져감
• 여러 광고 봤으면 → 마지막 광고 50% + 나머지 광고들이 50% 나눔

예시: 철수가 10만원 구매
• 광고 여정: A 광고 → B 광고 → 구매
• 결과: A 광고 5만원, B 광고 5만원

💡 이 숫자가 높으면?
→ 이 광고가 실제 매출에 크게 기여했다는 의미`}
            </div>
          }
          overlayStyle={{ maxWidth: '400px' }}
        >
          <div style={{ whiteSpace: 'pre-line', lineHeight: '1.3' }}>
            기여한<br />매출액
          </div>
        </Tooltip>
      ),
      dataIndex: 'attributed_revenue',
      key: 'attributed_revenue',
      width: 85,
      align: 'center',
      render: (amount) => {
        const percent = summaryStats.maxRevenue > 0 ? (amount / summaryStats.maxRevenue) * 100 : 0;
        return (
          <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: '10%',
                height: '80%',
                width: `${percent}%`,
                background: 'linear-gradient(90deg, rgba(255, 85, 0, 0.12) 0%, rgba(255, 122, 69, 0.18) 100%)',
                borderRadius: '4px',
                transition: 'width 0.3s ease'
              }}
            />
            <span style={{
              color: amount > 0 ? '#d4380d' : '#9ca3af',
              fontWeight: amount > 0 ? 600 : 400,
              fontSize: '11px',
              position: 'relative',
              zIndex: 1,
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}>
              {formatCurrency(amount)}
            </span>
          </div>
        );
      },
      sorter: true,
      showSorterTooltip: false
    },
    {
      title: (
        <Tooltip
          title={
            <div style={{ whiteSpace: 'pre-line' }}>
              {`이 광고를 본 고객들이 결제한 금액의 총합입니다.
기여도로 나누지 않고, 구매 금액 전체를 그대로 합산합니다.

예시: 철수가 10만원 구매
• 광고 여정: A 광고 → B 광고 → 구매
• 결과: A 광고 +10만원, B 광고 +10만원 (둘 다 전액)

💡 "기여한 매출액"과의 차이
• 기여한 매출액: 나눠서 계산 (A 5만 + B 5만 = 10만원)
• 영향 준 주문 총액: 전액 합산 (A 10만 + B 10만 = 20만원)

💡 이 숫자가 높으면?
→ 이 광고를 본 고객들의 전체 구매력이 크다는 의미`}
            </div>
          }
          overlayStyle={{ maxWidth: '420px' }}
        >
          <div style={{ whiteSpace: 'pre-line', lineHeight: '1.3' }}>
            영향 준<br />주문 총액
          </div>
        </Tooltip>
      ),
      dataIndex: 'total_contributed_revenue',
      key: 'total_contributed_revenue',
      width: 95,
      align: 'center',
      render: (amount) => {
        const percent = summaryStats.maxRevenue > 0 ? (amount / summaryStats.maxRevenue) * 100 : 0;
        return (
          <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: '10%',
                height: '80%',
                width: `${percent}%`,
                background: 'linear-gradient(90deg, rgba(114, 46, 209, 0.12) 0%, rgba(146, 84, 222, 0.18) 100%)',
                borderRadius: '4px',
                transition: 'width 0.3s ease'
              }}
            />
            <span style={{
              color: amount > 0 ? '#722ed1' : '#9ca3af',
              fontWeight: amount > 0 ? 600 : 400,
              fontSize: '11px',
              position: 'relative',
              zIndex: 1,
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}>
              {formatCurrency(amount)}
            </span>
          </div>
        );
      },
      sorter: true,
      showSorterTooltip: false
    },
    {
      title: '상세 분석',
      key: 'action',
      width: 100,
      align: 'center',
      fixed: 'right',
      render: (_, record) => {
        const menuItems = [
          {
            key: 'orders',
            label: '주문 보기',
            icon: <ShoppingCartOutlined />,
            disabled: record.contributed_orders_count === 0,
            onClick: () => handleViewOrders(record)
          },
          {
            key: 'analysis',
            label: '성과 분석',
            icon: <BarChartOutlined />,
            onClick: () => handleViewAnalysis(record)
          },
          {
            type: 'divider'
          },
          {
            key: 'journey',
            label: '고객 여정',
            icon: <NodeIndexOutlined />,
            onClick: () => handleViewJourney(record)
          },
          {
            key: 'landing',
            label: '페이지 분석',
            icon: <FileSearchOutlined />,
            onClick: () => handleViewLanding(record)
          }
        ];

        return (
          <Dropdown
            menu={{ items: menuItems }}
            trigger={['click']}
            placement="bottomRight"
          >
            <Button icon={<SettingOutlined />}>
              상세 분석
            </Button>
          </Dropdown>
        );
      }
    }
  ];

  return (
    <div style={{ padding: '24px', background: '#f5f7fa', minHeight: '100vh' }}>

      {/* 헤더 */}
      <Card 
        style={{ 
          marginBottom: '20px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          border: '1px solid #e8eaed'
        }}
      >
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Title 
                level={2} 
                style={{ 
                  margin: 0, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px',
                  fontSize: '24px',
                  fontWeight: 700,
                  color: '#1a1a1a'
                }}
              >
                <BarChart3 size={28} strokeWidth={2.5} style={{ color: '#1890ff' }} />
                광고 소재 모수 분석
              </Title>
              <div style={{ 
                color: '#6b7280', 
                fontSize: '14px', 
                marginTop: '8px',
                fontWeight: 400,
                lineHeight: '1.5'
              }}>
                각 광고 소재의 방문자 수, 페이지뷰, 체류시간, 구매 전환을 분석합니다
              </div>
            </div>
            <Space>
              {selectedCreatives.length > 0 && (
                <Button
                  type="primary"
                  icon={<GitCompare size={16} />}
                  onClick={handleOpenCompare}
                  disabled={selectedCreatives.length < 2}
                  style={{
                    height: '40px',
                    borderRadius: '8px',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: selectedCreatives.length >= 2 ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : undefined
                  }}
                >
                  소재 비교 ({selectedCreatives.length}개)
                </Button>
              )}
              <Button
                icon={<RefreshCw size={16} />}
                onClick={fetchData}
                loading={loading}
                style={{
                  height: '40px',
                  borderRadius: '8px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                새로고침
              </Button>
            </Space>
          </div>
          <Tag 
            color="blue" 
            style={{
              padding: '4px 12px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 500,
              border: 'none',
              background: '#e6f4ff',
              color: '#0958d9'
            }}
          >
            총 {total.toLocaleString()}개 광고 소재
          </Tag>
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

      {/* UTM 필터 영역 (퀵 필터 + 동적 필터) */}
      <Card 
        size="small" 
        style={{ 
          marginBottom: '20px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          border: '1px solid #e8eaed'
        }}
      >
        <div style={{ 
          display: 'flex', 
          gap: '24px',
          flexWrap: 'wrap'
        }}>
          {/* 좌측: UTM Source 퀵 필터 */}
          <div style={{ flex: '1 1 45%', minWidth: '300px' }}>
            <div style={{ 
              marginBottom: '12px', 
              fontSize: '14px', 
              color: '#374151', 
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Layers size={18} strokeWidth={2} style={{ color: '#1890ff' }} />
              광고 플랫폼
            </div>
            <UtmSourceQuickFilter
              onFilterChange={setQuickFilterSources}
              loading={loading}
            />
          </div>

          {/* 구분선 */}
          <Divider type="vertical" style={{ height: 'auto', margin: '0' }} />

          {/* 우측: 동적 UTM 필터 */}
          <div style={{ flex: '1 1 45%', minWidth: '300px' }}>
            <div style={{ 
              marginBottom: '12px', 
              fontSize: '14px', 
              color: '#374151', 
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Search size={18} strokeWidth={2} style={{ color: '#1890ff' }} />
              UTM 필터
            </div>
            <DynamicUtmFilterBar
              tableName="utm-sessions"
              onFilterChange={setActiveUtmFilters}
              loading={loading}
              excludeValues={{ utm_source: ['viral'] }}
            />
          </div>
        </div>
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
      <Card
        style={{
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          border: '1px solid #e8eaed'
        }}
      >
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
          style={{
            borderRadius: '8px',
            overflow: 'hidden'
          }}
        />
      </Card>

      {/* 푸터 */}
      <div style={{ 
        marginTop: '24px', 
        textAlign: 'center', 
        color: '#9ca3af',
        fontSize: '13px',
        fontWeight: 500,
        paddingBottom: '16px'
      }}>
        마지막 갱신: {dayjs().format('YYYY-MM-DD HH:mm:ss')}
      </div>

      {/* 주문 보기 모달 */}
      <CreativeOrdersModal
        visible={ordersModalVisible}
        onClose={() => {
          setOrdersModalVisible(false);
          setSelectedCreative(null);
        }}
        creative={selectedCreative}
        dateRange={{
          start: filters.dateRange[0],
          end: filters.dateRange[1]
        }}
      />

      {/* 성과 분석 모달 */}
      <CreativeAnalysisModal
        visible={analysisModalVisible}
        onClose={() => {
          setAnalysisModalVisible(false);
          setAnalysisCreative(null);
        }}
        creative={analysisCreative}
        dateRange={{
          start: filters.dateRange[0],
          end: filters.dateRange[1]
        }}
      />

      {/* 고객 여정 모달 */}
      <CreativeJourneyModal
        visible={journeyModalVisible}
        onClose={() => {
          setJourneyModalVisible(false);
          setJourneyCreative(null);
        }}
        creative={journeyCreative}
        dateRange={{
          start: filters.dateRange[0],
          end: filters.dateRange[1]
        }}
      />

      {/* 페이지 분석 모달 */}
      <CreativeLandingModal
        visible={landingModalVisible}
        onClose={() => {
          setLandingModalVisible(false);
          setLandingCreative(null);
        }}
        creative={landingCreative}
        dateRange={{
          start: filters.dateRange[0],
          end: filters.dateRange[1]
        }}
      />

      {/* 소재 비교 모달 */}
      <CreativeCompareModal
        visible={compareModalVisible}
        onClose={() => setCompareModalVisible(false)}
        creatives={selectedCreatives}
        dateRange={{
          start: filters.dateRange[0],
          end: filters.dateRange[1]
        }}
      />
    </div>
  );
}

export default CreativePerformance;

