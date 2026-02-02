// ============================================================================
// 광고 소재 성과 분석 - 인사이트 카드 (Top 5 랭킹)
// ============================================================================

import React, { useMemo } from 'react';
import { Card, Row, Col, Empty } from 'antd';
import { Trophy, TrendingUp, Settings } from 'lucide-react';
import { calculateTrafficScores, formatCurrency } from '../utils/formatters';



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
 * 인사이트 카드 컴포넌트
 * @param {Array} data - 전체 광고 데이터
 * @param {Object|null} scoreSettings - 모수 평가 점수 설정
 */
function InsightCards({ data, scoreSettings }) {
  // Top 5 데이터 계산
  const { trafficTop5, valueTop5, maxValue } = useMemo(() => {
    if (!data || data.length === 0) {
      return { trafficTop5: [], valueTop5: [], maxValue: 0 };
    }

    // 1. 모수 품질 Top 5 계산 (설정이 있을 때만)
    let trafficTop5 = [];
    if (scoreSettings) {
      const trafficScores = calculateTrafficScores(data, scoreSettings);
      const trafficData = data.map(item => {
        const key = `${item.utm_source || ''}_${item.utm_campaign || ''}_${item.utm_medium || ''}_${item.creative_name || ''}`;
        const scoreInfo = trafficScores.get(key);
        return {
          ...item,
          trafficScore: scoreInfo ? scoreInfo.score : 0
        };
      });

      // 점수가 null이 아닌 것만 필터링 후 내림차순 정렬
      const trafficSorted = [...trafficData]
        .filter(item => item.trafficScore !== null && item.trafficScore > 0)
        .sort((a, b) => b.trafficScore - a.trafficScore);
      trafficTop5 = trafficSorted.slice(0, 5);
    }

    // 2. 유입당 가치 Top 5 계산
    // 유입당 가치 = 기여한 결제액 / 방문자 수 (테이블 "1명당 유입 가치" 컬럼과 동일한 계산)
    // 방문자 수가 너무 적으면(예: 10명 미만) 통계적 의미가 적으므로 제외하거나 후순위로 밀 수 있음 -> 여기선 단순 계산
    const valueData = data.map(item => {
      const attributedRevenue = item.attributed_revenue || 0;
      const visitors = item.unique_visitors || 0;
      const valuePerVisitor = visitors > 0 ? Math.round(attributedRevenue / visitors) : 0;
      
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
  }, [data, scoreSettings]);

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
                <span>모수 평가 점수 Top 5</span>
              </div>
              <span style={{ fontSize: '12px', color: '#8c8c8c', fontWeight: 'normal' }}>점수 기준</span>
            </div>
          }
          bodyStyle={{ padding: '0 24px 12px' }}
          bordered={false}
          style={{ height: '100%', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
        >
          {!scoreSettings ? (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              padding: '32px 16px',
              color: '#8c8c8c'
            }}>
              <Settings size={32} style={{ marginBottom: '12px', color: '#d9d9d9' }} />
              <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>
                모수 평가 기준을 설정해주세요
              </div>
              <div style={{ fontSize: '12px', color: '#bfbfbf' }}>
                상단 필터 영역의 "점수 설정" 버튼을 클릭하세요
              </div>
            </div>
          ) : trafficTop5.length > 0 ? (
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
                <span>1명당 유입 가치 Top 5</span>
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
    </Row>
  );
}

export default InsightCards;
