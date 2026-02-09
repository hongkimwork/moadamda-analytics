// ============================================================================
// 광고 소재 퍼포먼스 테이블
// ============================================================================

import React, { useMemo, useRef, useCallback } from 'react';
import { Card, Table, Tooltip, Dropdown, Button, message } from 'antd';
import { ShoppingCart, Link, AlertTriangle } from 'lucide-react';
import { formatDuration, formatCurrency, formatNumber, calculateTrafficScores } from '../utils/formatters';
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
  onTableChange,
  onPageChange,
  onViewOrders,
  onViewSessions,
  onViewEntries,
  onViewOriginalUrl,
  scoreSettings,
  isMetaFiltered,
  onCreativeClick,
  minUv = 0
}) {
  // 정렬 방향 추적 (클라이언트 정렬 시 UV 하단 고정 유지용)
  const sortDirectionRef = useRef(null);

  const handleTableChangeWrapped = useCallback((pagination, filters, sorter) => {
    sortDirectionRef.current = sorter.order || null;
    onTableChange(pagination, filters, sorter);
  }, [onTableChange]);

  // 모수 평가 점수 계산 (사용자 설정 기반)
  const trafficScores = useMemo(() => calculateTrafficScores(data, scoreSettings), [data, scoreSettings]);

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
      render: (text) => {
        // 메타 필터 적용 시에만 클릭 가능
        const isClickable = isMetaFiltered && onCreativeClick;
        
        return (
          <span
            style={{
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'block',
              wordBreak: 'break-all',
              lineHeight: '1.5',
              textAlign: 'center',
              color: isClickable ? '#1890ff' : '#1a1a1a',
              transition: 'color 0.2s ease',
              textDecoration: isClickable ? 'underline' : 'none'
            }}
            onClick={() => {
              if (isClickable) {
                onCreativeClick(text);
              }
            }}
            onDoubleClick={() => {
              navigator.clipboard.writeText(text);
              message.success('광고 소재 이름이 복사되었습니다');
            }}
            onMouseEnter={(e) => {
              e.target.style.color = isClickable ? '#40a9ff' : '#595959';
            }}
            onMouseLeave={(e) => {
              e.target.style.color = isClickable ? '#1890ff' : '#1a1a1a';
            }}
            title={isClickable ? '클릭: 미디어 보기 / 더블클릭: 복사' : '더블클릭하면 복사됩니다'}
          >
            {text || '-'}
          </span>
        );
      },
      sorter: true,
      showSorterTooltip: false
    },
    {
      title: 'View',
      dataIndex: 'total_views',
      key: 'total_views',
      width: 60,
      align: 'center',
      render: (num, record) => (
        <span 
          style={{ 
            fontWeight: 500, 
            fontSize: '13px', 
            color: '#1890ff',
            cursor: 'pointer',
            textDecoration: 'underline'
          }}
          onClick={() => onViewEntries && onViewEntries(record)}
          title="클릭하여 진입 목록 보기"
        >
          {formatNumber(num)}
        </span>
      ),
      sorter: true,
      showSorterTooltip: false
    },
    {
      title: 'UV',
      dataIndex: 'unique_visitors',
      key: 'unique_visitors',
      width: 55,
      align: 'center',
      render: (num, record) => (
        <span 
          style={{ 
            fontWeight: 600, 
            fontSize: '13px', 
            color: '#389e0d',
            cursor: 'pointer',
            textDecoration: 'underline'
          }}
          onClick={() => onViewSessions && onViewSessions(record)}
          title="클릭하여 세션 상세 보기"
        >
          {formatNumber(num)}
        </span>
      ),
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
        <div style={{ whiteSpace: 'pre-line', lineHeight: '1.3' }}>
          평균<br />체류시간
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
            scoreSettings ? (
              <div style={{ padding: '4px' }}>
                <div style={{ marginBottom: '12px', fontWeight: 600, fontSize: '14px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
                  📊 모수 평가 점수 기준
                </div>
                
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '12px', marginBottom: '6px' }}>
                    평가 방식: 절대평가
                  </div>
                  <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: '2px 12px 2px 0' }}>• 평균 스크롤</td>
                        <td style={{ padding: '2px 0', fontWeight: 700, textAlign: 'right', color: '#ffc069' }}>{scoreSettings.weight_scroll}%</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '2px 12px 2px 0' }}>• 평균 PV</td>
                        <td style={{ padding: '2px 0', fontWeight: 700, textAlign: 'right', color: '#bae7ff' }}>{scoreSettings.weight_pv}%</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '2px 12px 2px 0' }}>• 체류시간</td>
                        <td style={{ padding: '2px 0', fontWeight: 700, textAlign: 'right', color: '#d9f7be' }}>{scoreSettings.weight_duration}%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{ padding: '4px' }}>
                <div style={{ fontSize: '13px' }}>
                  모수 평가 기준이 설정되지 않았습니다.<br/>
                  상단의 "모수 평가 기준 설정" 버튼을 클릭하여 설정해주세요.
                </div>
              </div>
            )
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
        // 설정이 없으면 "-" 표시
        if (!scoreSettings) {
          return (
            <span style={{ fontSize: '13px', color: '#9ca3af' }}>-</span>
          );
        }

        const key = `${record.utm_source || ''}_${record.utm_campaign || ''}_${record.utm_medium || ''}_${record.creative_name || ''}`;
        const scoreData = trafficScores.get(key);
        
        // 데이터 부족
        if (!scoreData || scoreData.score === null) {
          return (
            <Tooltip title="데이터 부족">
              <span style={{ fontSize: '13px', color: '#9ca3af' }}>-</span>
            </Tooltip>
          );
        }

        const score = scoreData.score;
        const color = getScoreColor(score);
        
        // 툴팁용 점수 상세 정보 생성
        const metricLabels = {
          scroll: '평균 스크롤',
          pv: '평균 PV',
          duration: '평균 체류시간',
          view: 'View',
          uv: 'UV'
        };
        const metricUnits = {
          scroll: 'px',
          pv: '',
          duration: '초',
          view: '회',
          uv: '명'
        };
        
        const enabledMetrics = scoreData.enabledMetrics || ['scroll', 'pv', 'duration'];
        const tooltipContent = (
          <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
            <div style={{ fontWeight: 600, marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '6px' }}>
              점수 계산 상세
            </div>
            {enabledMetrics.map(metric => {
              const metricScore = scoreData.metricScores?.[metric] ?? 0;
              const weight = scoreData.weights?.[metric] ?? 0;
              const value = scoreData.metricValues?.[metric] ?? 0;
              const contribution = Math.round(metricScore * weight / 100);
              const unit = metricUnits[metric];
              
              return (
                <div key={metric} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.8)' }}>
                    {metricLabels[metric]} ({value.toLocaleString()}{unit})
                  </span>
                  <span style={{ fontWeight: 600, marginLeft: '12px' }}>
                    {metricScore}점 × {weight}% = <span style={{ color: '#69c0ff' }}>{contribution}</span>
                  </span>
                </div>
              );
            })}
            <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.2)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600 }}>최종 점수</span>
              <span style={{ fontWeight: 700, color: '#52c41a', fontSize: '14px' }}>{score}점</span>
            </div>
            {scoreData.hasWarning && (
              <div style={{ marginTop: '6px', color: '#faad14', fontSize: '11px' }}>
                ⚠️ {scoreData.warningMessage}
              </div>
            )}
          </div>
        );

        return (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px'
          }}>
            <Tooltip title={tooltipContent} overlayStyle={{ maxWidth: '320px' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px 10px',
                borderRadius: '12px',
                backgroundColor: `${color}15`,
                border: `1px solid ${color}40`,
                cursor: 'help'
              }}>
                <span style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: color
                }}>
                  {score}
                </span>
              </div>
            </Tooltip>
            {scoreData.hasWarning && (
              <Tooltip title={scoreData.warningMessage}>
                <span style={{ display: 'flex', alignItems: 'center', cursor: 'help' }}>
                  <AlertTriangle size={14} color="#faad14" />
                </span>
              </Tooltip>
            )}
          </div>
        );
      },
      sorter: (a, b) => {
        // UV 이하치 기준 미달 행은 하단 고정 (정렬 방향에 관계없이)
        if (minUv > 0) {
          const aAbove = (a.unique_visitors || 0) > minUv;
          const bAbove = (b.unique_visitors || 0) > minUv;
          if (aAbove !== bAbove) {
            const pin = aAbove ? -1 : 1;
            // Ant Design은 내림차순 시 결과를 반전하므로, 미리 반전하여 상쇄
            return sortDirectionRef.current === 'descend' ? -pin : pin;
          }
        }
        if (!scoreSettings) return 0;
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
            기여한<br />주문 수
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
            기여한<br />결제액
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
                기여한 <strong>평균 결제액</strong>입니다.
              </div>

              <div style={{ marginBottom: '16px', backgroundColor: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '4px' }}>
                <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '12px', marginBottom: '4px' }}>계산 방식</div>
                <div style={{ fontSize: '13px', fontFamily: 'monospace' }}>기여한 결제액 ÷ UV (순 방문자)</div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '12px', marginBottom: '6px' }}>예시</div>
                <div style={{ fontSize: '13px', paddingLeft: '8px', borderLeft: '2px solid rgba(255,255,255,0.2)' }}>
                  결제액 100만원 / 방문자 100명<br/>
                  = <span style={{ color: '#bae7ff', fontWeight: 600 }}>1명당 10,000원 가치</span>
                </div>
              </div>

              <div>
                <div style={{ color: '#d9f7be', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>
                  💡 핵심 포인트
                </div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)' }}>
                  이 숫자가 높을수록 적은 방문자로도<br/>
                  높은 결제액을 만드는 <strong>효율적인 광고</strong>입니다.
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
        // UV 이하치 기준 미달 행은 하단 고정 (정렬 방향에 관계없이)
        if (minUv > 0) {
          const aAbove = (a.unique_visitors || 0) > minUv;
          const bAbove = (b.unique_visitors || 0) > minUv;
          if (aAbove !== bAbove) {
            const pin = aAbove ? -1 : 1;
            return sortDirectionRef.current === 'descend' ? -pin : pin;
          }
        }
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
            key: 'originalUrl',
            label: '원본 URL 보기',
            icon: <Link size={16} />,
            onClick: () => onViewOriginalUrl && onViewOriginalUrl(record)
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
        onChange={handleTableChangeWrapped}
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
          const stripe = index % 2 === 0 ? 'table-row-even' : 'table-row-odd';
          const belowUv = minUv > 0 && (record.unique_visitors || 0) <= minUv ? 'table-row-below-uv' : '';
          return `${stripe} ${belowUv}`.trim();
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
        /* UV 이하치 기준 미달 행 (하단 배치, 연한 회색 처리) */
        .creative-performance-table .table-row-below-uv td {
          background-color: #f5f5f5 !important;
          opacity: 0.55;
        }
        .creative-performance-table .table-row-below-uv td.ant-table-cell-fix-left,
        .creative-performance-table .table-row-below-uv td.ant-table-cell-fix-right {
          background-color: #f5f5f5 !important;
          opacity: 0.55;
        }
        .creative-performance-table .table-row-below-uv:hover td,
        .creative-performance-table .table-row-below-uv:hover td.ant-table-cell-fix-left,
        .creative-performance-table .table-row-below-uv:hover td.ant-table-cell-fix-right {
          opacity: 0.8 !important;
          background-color: #ebebeb !important;
        }
      `}</style>
    </Card>
  );
}

export default PerformanceTable;
