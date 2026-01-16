// ============================================================================
// 광고 소재 퍼포먼스 테이블
// ============================================================================

import React, { useMemo } from 'react';
import { Card, Table, Tooltip, Dropdown, Button, message, Select } from 'antd';
import { ShoppingCart, Network } from 'lucide-react';
import { formatDuration, formatCurrency, formatNumber, calculateTrafficScores } from '../utils/formatters';
import { getRowKey } from '../utils/helpers';

// 이상치 기준 옵션 생성 (5분~2시간30분, 5분 단위)
const durationOptions = [];
for (let minutes = 5; minutes <= 150; minutes += 5) {
  const seconds = minutes * 60;
  const label = minutes < 60 
    ? `${minutes}분` 
    : minutes % 60 === 0 
      ? `${Math.floor(minutes / 60)}시간`
      : `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`;
  durationOptions.push({ value: seconds, label });
}

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
  onTableChange,
  onPageChange,
  onViewOrders,
  onViewJourney,
  maxDuration,
  onMaxDurationChange
}) {
  // 모수 평가 점수 계산 (필터된 데이터 기준)
  const trafficScores = useMemo(() => calculateTrafficScores(data), [data]);

  // 점수에 따른 색상 반환
  const getScoreColor = (score) => {
    if (score >= 80) return '#389e0d'; // 녹색 (우수)
    if (score >= 60) return '#1890ff'; // 파란색 (양호)
    if (score >= 40) return '#faad14'; // 주황색 (보통)
    return '#ff4d4f'; // 빨간색 (개선 필요)
  };

  // 점수에 따른 등급 텍스트
  const getScoreGrade = (score) => {
    if (score >= 80) return '우수';
    if (score >= 60) return '양호';
    if (score >= 40) return '보통';
    return '개선필요';
  };

  const columns = [
    {
      title: <div style={{ whiteSpace: 'pre-line', lineHeight: '1.3' }}>UTM<br />Source</div>,
      dataIndex: 'utm_source',
      key: 'utm_source',
      width: 70,
      align: 'center',
      ellipsis: true,
      render: (text) => (
        <span style={{ fontSize: '13px' }} title={text}>
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
      width: 75,
      align: 'center',
      ellipsis: true,
      render: (text) => (
        <span style={{ fontSize: '13px' }} title={text}>
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
      width: 70,
      align: 'center',
      ellipsis: true,
      render: (text) => (
        <span style={{ fontSize: '13px' }} title={text}>
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
      width: 200,
      align: 'center',
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
            textAlign: 'center',
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
      title: 'View',
      dataIndex: 'total_views',
      key: 'total_views',
      width: 60,
      align: 'center',
      render: (num) => <span style={{ fontWeight: 500, fontSize: '13px', color: '#6b7280' }}>{formatNumber(num)}</span>,
      sorter: true,
      showSorterTooltip: false
    },
    {
      title: 'UV',
      dataIndex: 'unique_visitors',
      key: 'unique_visitors',
      width: 55,
      align: 'center',
      render: (num) => <span style={{ fontWeight: 600, fontSize: '13px', color: '#374151' }}>{formatNumber(num)}</span>,
      sorter: true,
      showSorterTooltip: false
    },
    {
      title: '평균PV',
      dataIndex: 'avg_pageviews',
      key: 'avg_pageviews',
      width: 60,
      align: 'center',
      render: (num) => <span style={{ fontSize: '13px', color: '#4b5563', fontWeight: 500 }}>{num ? num.toFixed(1) : '0.0'}</span>,
      sorter: true,
      showSorterTooltip: false
    },
    {
      title: (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span style={{ whiteSpace: 'pre-line', lineHeight: '1.3' }}>평균<br />체류시간</span>
          <Select
            size="small"
            value={maxDuration}
            onChange={onMaxDurationChange}
            options={durationOptions}
            style={{ width: 85, fontSize: 11 }}
            onClick={(e) => e.stopPropagation()}
            popupMatchSelectWidth={false}
          />
        </div>
      ),
      dataIndex: 'avg_duration_seconds',
      key: 'avg_duration_seconds',
      width: 85,
      align: 'center',
      render: (seconds) => <span style={{ fontSize: '13px', color: '#4b5563', fontWeight: 500 }}>{formatDuration(seconds)}</span>,
      sorter: true,
      showSorterTooltip: false
    },
    {
      title: (
        <Tooltip
          title={
            <div style={{ padding: '4px' }}>
              <div style={{ marginBottom: '8px', fontWeight: 600, fontSize: '14px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
                📏 평균 스크롤이란?
              </div>
              <div style={{ fontSize: '13px', lineHeight: '1.6', marginBottom: '12px' }}>
                이 광고로 유입된 방문자들이<br/>
                세션 동안 <strong>평균적으로 스크롤한 거리</strong>입니다.
              </div>
              <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '4px', marginBottom: '12px' }}>
                <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '12px', marginBottom: '4px' }}>측정 방식</div>
                <div style={{ fontSize: '13px' }}>각 페이지에서 최대로 스크롤한 위치(px)의 평균</div>
              </div>
              <div style={{ color: '#d9f7be', fontWeight: 600, fontSize: '13px' }}>
                💡 숫자가 높을수록 콘텐츠에 관심을 가지고 탐색한 것
              </div>
            </div>
          }
          overlayStyle={{ maxWidth: '320px' }}
        >
          <div style={{ whiteSpace: 'pre-line', lineHeight: '1.3', cursor: 'help' }}>
            평균<br />스크롤
          </div>
        </Tooltip>
      ),
      dataIndex: 'avg_scroll_px',
      key: 'avg_scroll_px',
      width: 75,
      align: 'center',
      render: (px) => (
        <span style={{ 
          fontSize: '13px', 
          color: px > 0 ? '#4b5563' : '#9ca3af', 
          fontWeight: 500 
        }}>
          {px > 0 ? `${formatNumber(px)}px` : '-'}
        </span>
      ),
      sorter: true,
      showSorterTooltip: false
    },
    {
      title: (
        <Tooltip
          title={
            <div style={{ padding: '4px' }}>
              <div style={{ marginBottom: '12px', fontWeight: 600, fontSize: '14px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
                📊 모수 평가 점수 기준
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '12px', marginBottom: '6px' }}>계산 방식 (상대 평가)</div>
                <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '2px 12px 2px 0' }}>• 평균 스크롤</td>
                      <td style={{ padding: '2px 0', fontWeight: 700, textAlign: 'right', color: '#ffc069' }}>30%</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '2px 12px 2px 0' }}>• 평균 PV</td>
                      <td style={{ padding: '2px 0', fontWeight: 700, textAlign: 'right', color: '#bae7ff' }}>35%</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '2px 12px 2px 0' }}>• 체류시간</td>
                      <td style={{ padding: '2px 0', fontWeight: 700, textAlign: 'right', color: '#d9f7be' }}>35%</td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ marginTop: '8px', fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
                  * 스크롤 0인 경우 해당 항목 0점 처리
                </div>
              </div>

              <div>
                <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '12px', marginBottom: '6px' }}>등급 가이드</div>
                <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <td style={{ padding: '6px 0' }}><span style={{ color: '#52c41a', marginRight: '6px' }}>●</span> 우수</td>
                      <td style={{ padding: '6px 0', textAlign: 'right' }}>80점 ~</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <td style={{ padding: '6px 0' }}><span style={{ color: '#1890ff', marginRight: '6px' }}>●</span> 양호</td>
                      <td style={{ padding: '6px 0', textAlign: 'right' }}>60점 ~</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <td style={{ padding: '6px 0' }}><span style={{ color: '#faad14', marginRight: '6px' }}>●</span> 보통</td>
                      <td style={{ padding: '6px 0', textAlign: 'right' }}>40점 ~</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '6px 0' }}><span style={{ color: '#ff4d4f', marginRight: '6px' }}>●</span> 개선</td>
                      <td style={{ padding: '6px 0', textAlign: 'right' }}>~ 39점</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          }
          overlayStyle={{ maxWidth: '300px' }}
        >
          <div style={{ whiteSpace: 'pre-line', lineHeight: '1.3', cursor: 'help' }}>
            모수<br />평가점수
          </div>
        </Tooltip>
      ),
      key: 'traffic_score',
      width: 75,
      align: 'center',
      render: (_, record) => {
        const key = `${record.utm_source || ''}_${record.utm_campaign || ''}_${record.utm_medium || ''}_${record.creative_name || ''}`;
        const scoreData = trafficScores.get(key);
        const score = scoreData?.score || 0;
        const color = getScoreColor(score);
        // const grade = getScoreGrade(score); // 미사용 변수 제거

        return (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4px 10px',
            borderRadius: '12px',
            backgroundColor: `${color}15`,
            border: `1px solid ${color}40`
          }}>
            <span style={{
              fontSize: '13px',
              fontWeight: 700,
              color: color
            }}>
              {score}
            </span>
          </div>
        );
      },
      sorter: (a, b) => {
        const keyA = `${a.utm_source || ''}_${a.utm_campaign || ''}_${a.utm_medium || ''}_${a.creative_name || ''}`;
        const keyB = `${b.utm_source || ''}_${b.utm_campaign || ''}_${b.utm_medium || ''}_${b.creative_name || ''}`;
        const scoreA = trafficScores.get(keyA)?.score || 0;
        const scoreB = trafficScores.get(keyB)?.score || 0;
        return scoreA - scoreB;
      },
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
              fontSize: '13px',
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
      width: 70,
      align: 'center',
      render: (num) => (
        <span style={{
          color: num > 0 ? '#389e0d' : '#9ca3af',
          fontWeight: num > 0 ? 600 : 400,
          fontSize: '13px'
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
      width: 60,
      align: 'center',
      render: (num) => (
        <span style={{
          color: num > 0 ? '#0958d9' : '#9ca3af',
          fontWeight: num > 0 ? 600 : 400,
          fontSize: '13px'
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
                background: 'linear-gradient(90deg, rgba(56, 158, 13, 0.12) 0%, rgba(82, 196, 26, 0.18) 100%)',
                borderRadius: '4px',
                transition: 'width 0.3s ease'
              }}
            />
            <span style={{
              color: amount > 0 ? '#389e0d' : '#9ca3af',
              fontWeight: amount > 0 ? 600 : 400,
              fontSize: '13px',
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
            <div style={{ padding: '4px' }}>
              <div style={{ marginBottom: '12px', fontWeight: 600, fontSize: '14px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
                💎 1명당 유입 가치란?
              </div>
              
              <div style={{ marginBottom: '16px', fontSize: '13px', lineHeight: '1.6' }}>
                이 광고를 통해 유입된 방문자 1명당<br/>
                기여한 <strong>평균 매출</strong>입니다.
              </div>

              <div style={{ marginBottom: '16px', backgroundColor: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '4px' }}>
                <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '12px', marginBottom: '4px' }}>계산 방식</div>
                <div style={{ fontSize: '13px', fontFamily: 'monospace' }}>기여한 매출액 ÷ UV (순 방문자)</div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '12px', marginBottom: '6px' }}>예시</div>
                <div style={{ fontSize: '13px', paddingLeft: '8px', borderLeft: '2px solid rgba(255,255,255,0.2)' }}>
                  매출 100만원 / 방문자 100명<br/>
                  = <span style={{ color: '#bae7ff', fontWeight: 600 }}>1명당 10,000원 가치</span>
                </div>
              </div>

              <div>
                <div style={{ color: '#d9f7be', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>
                  💡 핵심 포인트
                </div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)' }}>
                  이 숫자가 높을수록 적은 방문자로도<br/>
                  높은 매출을 만드는 <strong>효율적인 광고</strong>입니다.
                </div>
              </div>
            </div>
          }
          overlayStyle={{ maxWidth: '400px' }}
        >
          <div style={{ whiteSpace: 'pre-line', lineHeight: '1.3' }}>
            1명당<br />유입 가치
          </div>
        </Tooltip>
      ),
      key: 'value_per_visitor',
      width: 80,
      align: 'center',
      render: (_, record) => {
        const uv = record.unique_visitors || 0;
        const revenue = record.attributed_revenue || 0;
        const valuePerVisitor = uv > 0 ? Math.round(revenue / uv) : 0;
        
        return (
          <span style={{
            color: valuePerVisitor > 0 ? '#722ed1' : '#9ca3af',
            fontWeight: valuePerVisitor > 0 ? 600 : 400,
            fontSize: '13px'
          }}>
            {formatCurrency(valuePerVisitor)}
          </span>
        );
      },
      sorter: (a, b) => {
        const uvA = a.unique_visitors || 0;
        const uvB = b.unique_visitors || 0;
        const revenueA = a.attributed_revenue || 0;
        const revenueB = b.attributed_revenue || 0;
        const valueA = uvA > 0 ? revenueA / uvA : 0;
        const valueB = uvB > 0 ? revenueB / uvB : 0;
        return valueA - valueB;
      },
      showSorterTooltip: false
    },
    {
      title: '상세',
      key: 'action',
      width: 65,
      align: 'center',
      fixed: 'right',
      render: (_, record) => {
        const menuItems = [
          {
            key: 'orders',
            label: '주문 보기',
            icon: <ShoppingCart size={16} />,
            disabled: record.contributed_orders_count === 0,
            onClick: () => onViewOrders(record)
          },
          {
            key: 'journey',
            label: '고객 여정',
            icon: <Network size={16} />,
            onClick: () => onViewJourney(record)
          }
        ];

        return (
          <Dropdown
            menu={{ items: menuItems }}
            trigger={['click']}
            placement="bottomRight"
          >
            <Button>
              보기
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
        className="creative-performance-table"
        columns={columns}
        dataSource={data}
        rowKey={(record) => getRowKey(record)}
        onRow={(record) => ({
          id: `row-${getRowKey(record)}`
        })}
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
        size="middle"
        rowClassName={(record, index) => {
          return index % 2 === 0 ? 'table-row-even' : 'table-row-odd';
        }}
        style={{
          borderRadius: '8px',
          overflow: 'hidden'
        }}
      />
      <style>{`
        /* 테이블 wrapper */
        .creative-performance-table .ant-table-tbody > tr {
          position: relative;
        }
        /* 줄무늬 배경 */
        .creative-performance-table .table-row-even td {
          background-color: #ffffff !important;
        }
        .creative-performance-table .table-row-odd td {
          background-color: #fafbfc !important;
        }
        /* 호버 효과 */
        .creative-performance-table .ant-table-tbody > tr:hover > td {
          background-color: #f5f5f5 !important;
        }
        /* 호버 시 왼쪽 파란 라인 */
        .creative-performance-table .ant-table-tbody > tr:hover > td:first-child {
          box-shadow: inset 3px 0 0 0 #1890ff;
        }
        /* 헤더 스타일 */
        .creative-performance-table .ant-table-thead > tr > th {
          background-color: #f5f7fa !important;
          font-weight: 600 !important;
          color: #1f2937 !important;
          border-bottom: 2px solid #d9d9d9 !important;
        }
        /* fixed 컬럼 헤더 */
        .creative-performance-table .ant-table-thead > tr > th.ant-table-cell-fix-left,
        .creative-performance-table .ant-table-thead > tr > th.ant-table-cell-fix-right {
          background-color: #f5f7fa !important;
        }
        /* fixed 컬럼 바디 셀 - 줄무늬 유지 */
        .creative-performance-table .table-row-even td.ant-table-cell-fix-left,
        .creative-performance-table .table-row-even td.ant-table-cell-fix-right {
          background-color: #ffffff !important;
        }
        .creative-performance-table .table-row-odd td.ant-table-cell-fix-left,
        .creative-performance-table .table-row-odd td.ant-table-cell-fix-right {
          background-color: #fafbfc !important;
        }
        /* fixed 컬럼 호버 */
        .creative-performance-table .ant-table-tbody > tr:hover > td.ant-table-cell-fix-left,
        .creative-performance-table .ant-table-tbody > tr:hover > td.ant-table-cell-fix-right {
          background-color: #f5f5f5 !important;
        }
        /* 셀 패딩 */
        .creative-performance-table .ant-table-tbody > tr > td {
          padding: 14px 12px !important;
        }
        /* 행 구분선 */
        .creative-performance-table .ant-table-tbody > tr > td {
          border-bottom: 1px solid #f0f0f0 !important;
        }
      `}</style>
    </Card>
  );
}

export default PerformanceTable;
