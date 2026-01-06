// ============================================================================
// 광고 소재 성과 분석 - 인사이트 카드 (Top 5 랭킹 + 체류시간 분포)
// ============================================================================

import React, { useMemo, useEffect, useState } from 'react';
import { Card, Row, Col, Typography, Empty, Spin } from 'antd';
import { Trophy, TrendingUp, Clock } from 'lucide-react';
import { calculateTrafficScores, formatCurrency } from '../utils/formatters';
import { fetchDurationDistribution } from '../services/creativePerformanceApi';

const { Text, Title } = Typography;

/**
 * Top 5 랭킹 리스트 아이템 컴포넌트
 */
const RankingItem = ({ rank, title, subText, score, value, type, maxValue }) => {
  // 점수에 따른 색상 (트래픽 품질용)
  const getScoreColor = (s) => {
    if (s >= 80) return '#389e0d'; // 녹색 (우수)
    if (s >= 60) return '#1890ff'; // 파란색 (양호)
    if (s >= 40) return '#faad14'; // 주황색 (보통)
    return '#ff4d4f'; // 빨간색 (개선 필요)
  };

  // 등급 텍스트
  const getGradeText = (s) => {
    if (s >= 80) return '매우 우수';
    if (s >= 60) return '우수';
    if (s >= 40) return '보통';
    return '개선 필요';
  };

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      padding: '12px 0', 
      borderBottom: '1px solid #f0f0f0',
      lastChild: { borderBottom: 'none' }
    }}>
      {/* 순위 뱃지 */}
      <div style={{ 
        width: '24px', 
        height: '24px', 
        borderRadius: '50%', 
        background: rank === 1 ? '#1890ff' : rank === 2 ? '#52c41a' : rank === 3 ? '#faad14' : '#f0f0f0', 
        color: rank <= 3 ? '#fff' : '#8c8c8c',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        fontWeight: 'bold',
        fontSize: '12px',
        marginRight: '12px',
        flexShrink: 0
      }}>
        {rank}
      </div>

      {/* 내용 */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ 
          whiteSpace: 'nowrap', 
          overflow: 'hidden', 
          textOverflow: 'ellipsis', 
          fontWeight: 500
        }}>
          {title}
        </div>
        {/* subText (현재 사용 안함, 필요시 부활 가능) */}
        {subText && (
          <div style={{ fontSize: '12px', color: '#8c8c8c', marginTop: '2px' }}>
            {subText}
          </div>
        )}
      </div>

      {/* 우측 값 영역 */}
      <div style={{ marginLeft: '12px', flexShrink: 0, minWidth: '80px', textAlign: 'right' }}>
        {type === 'traffic' ? (
          // 모수 품질: 점수 뱃지 (테이블과 동일한 스타일)
          <div style={{ 
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4px 10px',
            borderRadius: '12px',
            backgroundColor: `${getScoreColor(score)}15`,
            border: `1px solid ${getScoreColor(score)}40`
          }}>
            <span style={{ 
              fontSize: '12px', 
              fontWeight: 700,
              color: getScoreColor(score) 
            }}>
              {score}
            </span>
          </div>
        ) : (
          // 유입당 가치: 막대 그래프 + 금액 (테이블 스타일)
          <div style={{ position: 'relative', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
            {/* 배경 그래프 막대 */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: '4px',
                height: '20px',
                width: `${maxValue > 0 ? (value / maxValue) * 100 : 0}%`,
                background: 'linear-gradient(90deg, rgba(9, 88, 217, 0.12) 0%, rgba(22, 119, 255, 0.18) 100%)', // 파란색 계열 (막타 결제액 색상)
                borderRadius: '4px',
                transition: 'width 0.3s ease',
                zIndex: 0
              }}
            />
            {/* 금액 텍스트 */}
            <span style={{
              color: '#0958d9', // 파란색 (막타 결제액 색상)
              fontWeight: 600,
              fontSize: '13px',
              position: 'relative',
              zIndex: 1,
              paddingLeft: '4px',
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}>
              {formatCurrency(value)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 체류시간 분포 가로 막대 차트 컴포넌트 (주문 기준)
 */
const DurationDistributionChart = ({ distribution, stats, loading }) => {
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
        <Spin />
      </div>
    );
  }

  if (!distribution || stats?.total_orders === 0) {
    return <Empty description="주문 데이터가 없습니다" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  // 차트 색상 (시간이 길수록 진한 보라색)
  const colors = [
    '#ffd6e7', '#ffadd2', '#ff85c0', '#f759ab', '#eb2f96',  // 핑크 계열 (짧은 시간)
    '#d3adf7', '#b37feb', '#9254de', '#722ed1', '#531dab', '#391085', '#22075e'  // 보라 계열 (긴 시간)
  ];
  const ranges = [
    'range_0_30', 'range_30_60', 'range_60_180', 'range_180_300', 'range_300_600',
    'range_600_900', 'range_900_1200', 'range_1200_1800',
    'range_1800_2400', 'range_2400_3000', 'range_3000_3600', 'range_3600_7200'
  ];
  
  // 막대 차트 데이터 준비
  const total = stats.total_orders;
  const maxCount = Math.max(...ranges.map(r => distribution[r]?.count || 0));
  
  const bars = ranges.map((range, index) => {
    const item = distribution[range];
    return {
      ...item,
      range,
      color: colors[index],
      widthPercent: maxCount > 0 ? (item.count / maxCount) * 100 : 0
    };
  });

  return (
    <div style={{ padding: '8px 0' }}>
      {/* 상단 요약 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        marginBottom: '16px',
        padding: '12px 16px',
        background: 'linear-gradient(135deg, #f9f0ff 0%, #efdbff 100%)',
        borderRadius: '8px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: '#8c8c8c' }}>총 주문수</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#722ed1' }}>
            {stats.total_orders.toLocaleString()}건
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: '#8c8c8c' }}>평균 체류시간</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#722ed1' }}>
            {stats.avg_duration_formatted}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: '#8c8c8c' }}>중앙값</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#722ed1' }}>
            {stats.median_duration_formatted}
          </div>
        </div>
      </div>

      {/* 가로 막대 차트 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {bars.map((bar, index) => (
          <div 
            key={bar.range}
            style={{ 
              display: 'flex', 
              alignItems: 'center',
              gap: '12px'
            }}
          >
            {/* 라벨 */}
            <div style={{ 
              width: '80px', 
              fontSize: '13px', 
              color: '#595959',
              textAlign: 'right',
              flexShrink: 0
            }}>
              {bar.label}
            </div>
            
            {/* 막대 */}
            <div style={{ 
              flex: 1, 
              height: '24px', 
              background: '#f5f5f5', 
              borderRadius: '4px',
              overflow: 'hidden',
              position: 'relative'
            }}>
              <div style={{
                width: `${bar.widthPercent}%`,
                height: '100%',
                background: bar.color,
                borderRadius: '4px',
                transition: 'width 0.5s ease',
                minWidth: bar.count > 0 ? '4px' : '0'
              }} />
            </div>
            
            {/* 건수 & 비율 */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              minWidth: '100px',
              flexShrink: 0
            }}>
              <span style={{ 
                fontSize: '14px', 
                fontWeight: 600, 
                color: '#262626',
                minWidth: '50px',
                textAlign: 'right'
              }}>
                {bar.count.toLocaleString()}건
              </span>
              <span style={{ 
                fontSize: '12px', 
                color: '#8c8c8c',
                minWidth: '40px',
                textAlign: 'right'
              }}>
                ({bar.ratio}%)
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * 인사이트 카드 컴포넌트
 * @param {Array} data - 전체 광고 데이터
 * @param {Object} dateRange - 날짜 범위 { start, end }
 * @param {Array} utmFilters - UTM 필터 배열
 */
function InsightCards({ data, dateRange, utmFilters }) {
  // 체류시간 분포 데이터 상태
  const [durationData, setDurationData] = useState(null);
  const [durationLoading, setDurationLoading] = useState(false);

  // 체류시간 분포 데이터 조회
  useEffect(() => {
    const loadDurationData = async () => {
      if (!dateRange?.start || !dateRange?.end) return;
      
      setDurationLoading(true);
      try {
        const result = await fetchDurationDistribution({
          start: dateRange.start,
          end: dateRange.end,
          utm_filters: JSON.stringify(utmFilters || [])
        });
        if (result.success) {
          setDurationData(result);
        }
      } catch (error) {
        console.error('Failed to fetch duration distribution:', error);
      } finally {
        setDurationLoading(false);
      }
    };

    loadDurationData();
  }, [dateRange?.start, dateRange?.end, utmFilters]);
  // Top 5 데이터 계산
  const { trafficTop5, valueTop5, maxValue } = useMemo(() => {
    if (!data || data.length === 0) {
      return { trafficTop5: [], valueTop5: [], maxValue: 0 };
    }

    // 1. 모수 품질 Top 5 계산
    const trafficScores = calculateTrafficScores(data);
    const trafficData = data.map(item => {
      const key = `${item.utm_source || ''}_${item.utm_campaign || ''}_${item.utm_medium || ''}_${item.creative_name || ''}`;
      const scoreInfo = trafficScores.get(key);
      return {
        ...item,
        trafficScore: scoreInfo ? scoreInfo.score : 0
      };
    });

    // 점수 내림차순 정렬 후 상위 5개
    const trafficSorted = [...trafficData].sort((a, b) => b.trafficScore - a.trafficScore);
    const trafficTop5 = trafficSorted.slice(0, 5);

    // 2. 유입당 가치 Top 5 계산
    // 유입당 가치 = (직접 매출 + 기여 매출) / 방문자 수
    // 방문자 수가 너무 적으면(예: 10명 미만) 통계적 의미가 적으므로 제외하거나 후순위로 밀 수 있음 -> 여기선 단순 계산
    const valueData = data.map(item => {
      const totalRevenue = (item.total_revenue || 0) + (item.attributed_revenue || 0);
      const visitors = item.unique_visitors || 0;
      const valuePerVisitor = visitors > 0 ? Math.round(totalRevenue / visitors) : 0;
      
      return {
        ...item,
        valuePerVisitor
      };
    });

    // 가치 내림차순 정렬 (단, 매출이 0인 경우는 제외)
    const valueSorted = valueData
      .filter(item => item.valuePerVisitor > 0)
      .sort((a, b) => b.valuePerVisitor - a.valuePerVisitor);
    
    const valueTop5 = valueSorted.slice(0, 5);
    
    // 그래프 비율 계산을 위한 최대값 (Top 1의 값)
    const maxValue = valueTop5.length > 0 ? valueTop5[0].valuePerVisitor : 0;

    return { trafficTop5, valueTop5, maxValue };
  }, [data]);

  if (!data || data.length === 0) return null;

  const getDisplayName = (item) => {
    // 광고 이름이 있으면 사용, 없으면 캠페인명, 없으면 소스/매체 조합
    if (item.creative_name && item.creative_name !== '-') return item.creative_name;
    if (item.utm_campaign && item.utm_campaign !== '-') return item.utm_campaign;
    return `${item.utm_source} / ${item.utm_medium}`;
  };

  return (
    <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
      {/* 1. 모수 품질 Top 5 */}
      <Col xs={24} md={12}>
        <Card 
          title={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Trophy size={18} color="#faad14" />
                <span>모수(트래픽) 품질 Top 5</span>
              </div>
              <span style={{ fontSize: '12px', color: '#8c8c8c', fontWeight: 'normal' }}>점수 기준</span>
            </div>
          }
          bodyStyle={{ padding: '0 24px 12px' }}
          bordered={false}
          style={{ height: '100%', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
        >
          {trafficTop5.length > 0 ? (
            trafficTop5.map((item, index) => (
              <RankingItem
                key={index}
                rank={index + 1}
                title={getDisplayName(item)}
                type="traffic"
                score={item.trafficScore}
              />
            ))
          ) : (
            <Empty description="데이터가 없습니다" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Card>
      </Col>

      {/* 2. 유입당 가치 Top 5 */}
      <Col xs={24} md={12}>
        <Card 
          title={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={18} color="#1890ff" />
                <span>유입당 가치(객단가) Top 5</span>
              </div>
              <span style={{ fontSize: '12px', color: '#8c8c8c', fontWeight: 'normal' }}>방문자 1명당</span>
            </div>
          }
          bodyStyle={{ padding: '0 24px 12px' }}
          bordered={false}
          style={{ height: '100%', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
        >
          {valueTop5.length > 0 ? (
            valueTop5.map((item, index) => (
              <RankingItem
                key={index}
                rank={index + 1}
                title={getDisplayName(item)}
                type="value"
                value={item.valuePerVisitor}
                maxValue={maxValue}
              />
            ))
          ) : (
            <Empty description="매출 데이터가 없습니다" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Card>
      </Col>

      {/* 3. 구매자 체류시간 분포 (전체 너비) */}
      <Col xs={24}>
        <Card 
          title={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} color="#722ed1" />
                <span>구매자 체류시간 분포</span>
              </div>
              <span style={{ fontSize: '12px', color: '#8c8c8c', fontWeight: 'normal' }}>
                주문 건별 체류시간 기준
              </span>
            </div>
          }
          bodyStyle={{ padding: '16px 24px' }}
          bordered={false}
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
        >
          <DurationDistributionChart 
            distribution={durationData?.distribution}
            stats={durationData?.stats}
            loading={durationLoading}
          />
        </Card>
      </Col>
    </Row>
  );
}

export default InsightCards;
