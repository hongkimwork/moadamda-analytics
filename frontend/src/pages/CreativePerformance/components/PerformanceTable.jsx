// ============================================================================
// 광고 소재 퍼포먼스 테이블
// ============================================================================

import React from 'react';
import { Card, Table, Checkbox, Tooltip, Dropdown, Button, message } from 'antd';
import { ShoppingCartOutlined, BarChartOutlined, NodeIndexOutlined, FileSearchOutlined, SettingOutlined } from '@ant-design/icons';
import { formatDuration, formatCurrency, formatNumber } from '../utils/formatters';
import { getRowKey } from '../utils/helpers';

/**
 * 퍼포먼스 테이블 컴포넌트
 * @param {Object} props
 */
function PerformanceTable({
  data,
  loading,
  total,
  currentPage,
  pageSize,
  summaryStats,
  selectedCreatives,
  onTableChange,
  onPageChange,
  onSelectCreative,
  onSelectAll,
  onViewOrders,
  onViewAnalysis,
  onViewJourney,
  onViewLanding
}) {
  const isSelected = (record) => {
    const key = getRowKey(record);
    return selectedCreatives.some(item => item.key === key);
  };

  const columns = [
    {
      title: (
        <Checkbox
          checked={selectedCreatives.length > 0 && selectedCreatives.length === Math.min(data.length, 5)}
          indeterminate={selectedCreatives.length > 0 && selectedCreatives.length < Math.min(data.length, 5)}
          onChange={(e) => onSelectAll(e.target.checked)}
        />
      ),
      key: 'select',
      width: 50,
      align: 'center',
      fixed: 'left',
      render: (_, record) => (
        <Checkbox
          checked={isSelected(record)}
          onChange={(e) => onSelectCreative(record, e.target.checked)}
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
            onClick: () => onViewOrders(record)
          },
          {
            key: 'analysis',
            label: '성과 분석',
            icon: <BarChartOutlined />,
            onClick: () => onViewAnalysis(record)
          },
          {
            type: 'divider'
          },
          {
            key: 'journey',
            label: '고객 여정',
            icon: <NodeIndexOutlined />,
            onClick: () => onViewJourney(record)
          },
          {
            key: 'landing',
            label: '페이지 분석',
            icon: <FileSearchOutlined />,
            onClick: () => onViewLanding(record)
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
        onChange={onTableChange}
        pagination={{
          current: currentPage,
          pageSize: pageSize,
          total: total,
          showTotal: (total) => `총 ${total.toLocaleString()}개`,
          showSizeChanger: true,
          pageSizeOptions: ['100', '200', '500', '1000'],
          onChange: onPageChange
        }}
        size="small"
        style={{
          borderRadius: '8px',
          overflow: 'hidden'
        }}
      />
    </Card>
  );
}

export default PerformanceTable;
