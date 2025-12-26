// ============================================================================
// 인사이트 카드 컴포넌트
// 광고 소재 분석 페이지 상단에 표시되는 5가지 핵심 인사이트
// ============================================================================

import { useMemo } from 'react';
import { Typography, Tooltip, Skeleton } from 'antd';
import { Trophy, Target, Magnet, AlertTriangle, Lightbulb } from 'lucide-react';

const { Text } = Typography;

/**
 * 전환율 계산 (구매건수 / 방문자수 * 100)
 */
const calcConversionRate = (row) => {
  if (!row.unique_visitors || row.unique_visitors === 0) return 0;
  const purchases = row.last_touch_count || 0;
  return (purchases / row.unique_visitors) * 100;
};

/**
 * 객단가 계산 (매출 / 구매건수)
 */
const calcAOV = (row) => {
  const purchases = row.last_touch_count || 0;
  if (purchases === 0) return 0;
  return (row.total_revenue || 0) / purchases;
};

/**
 * 소재명 줄임 처리
 */
const truncateName = (name, maxLength = 20) => {
  if (!name || name === '-') return '데이터 없음';
  if (name.length <= maxLength) return name;
  return name.substring(0, maxLength) + '...';
};

/**
 * 금액 포맷팅 (원화 표기법 준수)
 */
const formatMoney = (value) => {
  return Math.round(value).toLocaleString();
};

/**
 * 개별 인사이트 카드 (주문 분석 페이지 스타일)
 */
const InsightCard = ({ 
  icon: Icon, 
  iconColor, 
  title, 
  creativeName, 
  mainValue, 
  mainLabel,
  subValue,
  subLabel,
  tooltip,
  onClick,
  isEmpty
}) => (
  <Tooltip title={tooltip} placement="bottom">
    <div 
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '16px',
        padding: '20px 24px',
        background: '#fff',
        borderRadius: '12px',
        border: '1px solid #e8eaed',
        flex: 1,
        minWidth: '200px',
        cursor: isEmpty ? 'default' : 'pointer',
        transition: 'all 0.2s ease',
        opacity: isEmpty ? 0.6 : 1
      }}
      onMouseEnter={(e) => {
        if (!isEmpty) {
          e.currentTarget.style.borderColor = '#d9d9d9';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#e8eaed';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '12px',
        background: isEmpty ? '#f5f5f5' : `${iconColor}15`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        <Icon size={24} style={{ color: isEmpty ? '#9ca3af' : iconColor }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ 
          fontSize: '13px', 
          display: 'block', 
          marginBottom: '4px', 
          color: '#6b7280',
          fontWeight: 500
        }}>
          {title}
        </Text>
        <div style={{ 
          fontSize: '14px', 
          fontWeight: 600, 
          color: isEmpty ? '#9ca3af' : '#1a1a1a',
          marginBottom: '8px',
          lineHeight: 1.4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {creativeName}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <span style={{ 
            fontSize: '22px', 
            fontWeight: 700, 
            color: isEmpty ? '#9ca3af' : '#1a1a1a' 
          }}>
            {mainValue}
          </span>
          <span style={{ 
            fontSize: '13px', 
            color: '#6b7280',
            fontWeight: 500
          }}>
            {mainLabel}
          </span>
        </div>
        {subValue && (
          <Text style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', display: 'block' }}>
            {subLabel} {subValue}
          </Text>
        )}
      </div>
    </div>
  </Tooltip>
);

/**
 * 인사이트 카드 영역 컴포넌트
 */
function InsightCards({ data, loading, onCardClick }) {
  // 5가지 인사이트 계산
  const insights = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        mvp: null,
        bestAOV: null,
        bestConversion: null,
        needsAttention: null,
        hiddenGem: null,
        avgConversionRate: 0
      };
    }

    // 전체 평균 전환율 계산
    const totalVisitors = data.reduce((sum, r) => sum + (r.unique_visitors || 0), 0);
    const totalPurchases = data.reduce((sum, r) => sum + (r.last_touch_count || 0), 0);
    const avgConversionRate = totalVisitors > 0 ? (totalPurchases / totalVisitors) * 100 : 0;

    // 1. MVP: 매출 1위 (막타 매출 기준)
    const mvp = [...data]
      .filter(r => (r.total_revenue || 0) > 0)
      .sort((a, b) => (b.total_revenue || 0) - (a.total_revenue || 0))[0] || null;

    // 2. 객단가 최고: 구매 3건 이상 중 객단가 1위
    const bestAOV = [...data]
      .filter(r => (r.last_touch_count || 0) >= 3)
      .sort((a, b) => calcAOV(b) - calcAOV(a))[0] || null;

    // 3. 전환율 최고: 방문자 50명 이상 중 전환율 1위
    const bestConversion = [...data]
      .filter(r => (r.unique_visitors || 0) >= 50 && (r.last_touch_count || 0) > 0)
      .sort((a, b) => calcConversionRate(b) - calcConversionRate(a))[0] || null;

    // 4. 점검 필요: 방문자 100명 이상인데 전환율이 평균의 50% 미만
    const needsAttention = [...data]
      .filter(r => {
        const visitors = r.unique_visitors || 0;
        const convRate = calcConversionRate(r);
        return visitors >= 100 && convRate < avgConversionRate * 0.5;
      })
      .sort((a, b) => (b.unique_visitors || 0) - (a.unique_visitors || 0))[0] || null;

    // 5. 숨은 보석: 방문자 30~200명 사이, 전환율이 평균의 2배 이상
    const hiddenGem = [...data]
      .filter(r => {
        const visitors = r.unique_visitors || 0;
        const convRate = calcConversionRate(r);
        return visitors >= 30 && visitors <= 200 && convRate >= avgConversionRate * 2;
      })
      .sort((a, b) => calcConversionRate(b) - calcConversionRate(a))[0] || null;

    return { mvp, bestAOV, bestConversion, needsAttention, hiddenGem, avgConversionRate };
  }, [data]);

  if (loading) {
    return (
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{ flex: 1, minWidth: '200px' }}>
            <Skeleton.Button active block style={{ height: '160px', borderRadius: '16px' }} />
          </div>
        ))}
      </div>
    );
  }

  const { mvp, bestAOV, bestConversion, needsAttention, hiddenGem, avgConversionRate } = insights;

  return (
    <div style={{ 
      display: 'flex', 
      gap: '16px',
      flexWrap: 'wrap',
      marginBottom: '20px'
    }}>
      {/* 1. MVP */}
      <InsightCard
        icon={Trophy}
        iconColor="#f59e0b"
        title="🏆 이번 기간 MVP"
        creativeName={mvp ? truncateName(mvp.creative_name) : '데이터 없음'}
        mainValue={mvp ? `₩${formatMoney(mvp.total_revenue || 0)}` : '-'}
        mainLabel="매출"
        subValue={mvp ? `${calcConversionRate(mvp).toFixed(1)}%` : null}
        subLabel="전환율"
        tooltip={mvp ? `${mvp.creative_name}\n가장 많은 매출을 만든 소재입니다` : '매출 데이터가 없습니다'}
        onClick={() => mvp && onCardClick?.(mvp)}
        isEmpty={!mvp}
      />

      {/* 2. 객단가 최고 */}
      <InsightCard
        icon={Target}
        iconColor="#8b5cf6"
        title="💎 객단가 최고"
        creativeName={bestAOV ? truncateName(bestAOV.creative_name) : '데이터 없음'}
        mainValue={bestAOV ? `₩${formatMoney(calcAOV(bestAOV))}` : '-'}
        mainLabel="객단가"
        subValue={bestAOV ? `${bestAOV.last_touch_count}건` : null}
        subLabel="구매"
        tooltip={bestAOV ? `${bestAOV.creative_name}\n고가 상품 구매를 유도하는 소재입니다` : '구매 3건 이상인 소재가 없습니다'}
        onClick={() => bestAOV && onCardClick?.(bestAOV)}
        isEmpty={!bestAOV}
      />

      {/* 3. 전환율 최고 */}
      <InsightCard
        icon={Target}
        iconColor="#10b981"
        title="🎯 전환율 최고"
        creativeName={bestConversion ? truncateName(bestConversion.creative_name) : '데이터 없음'}
        mainValue={bestConversion ? `${calcConversionRate(bestConversion).toFixed(1)}%` : '-'}
        mainLabel={`(평균 ${avgConversionRate.toFixed(1)}%)`}
        subValue={bestConversion ? `${bestConversion.unique_visitors?.toLocaleString()}명` : null}
        subLabel="방문자"
        tooltip={bestConversion ? `${bestConversion.creative_name}\n방문자를 구매자로 가장 잘 바꾸는 소재입니다` : '방문자 50명 이상인 소재가 없습니다'}
        onClick={() => bestConversion && onCardClick?.(bestConversion)}
        isEmpty={!bestConversion}
      />

      {/* 4. 점검 필요 */}
      <InsightCard
        icon={AlertTriangle}
        iconColor="#ef4444"
        title="⚠️ 점검 필요"
        creativeName={needsAttention ? truncateName(needsAttention.creative_name) : '없음 👍'}
        mainValue={needsAttention ? `${calcConversionRate(needsAttention).toFixed(1)}%` : '-'}
        mainLabel="전환율"
        subValue={needsAttention ? `${needsAttention.unique_visitors?.toLocaleString()}명 방문` : null}
        subLabel=""
        tooltip={needsAttention ? `${needsAttention.creative_name}\n방문자는 많은데 구매가 적습니다. 랜딩페이지나 상품을 점검해보세요` : '점검이 필요한 소재가 없습니다'}
        onClick={() => needsAttention && onCardClick?.(needsAttention)}
        isEmpty={!needsAttention}
      />

      {/* 5. 숨은 보석 */}
      <InsightCard
        icon={Lightbulb}
        iconColor="#3b82f6"
        title="💡 숨은 보석"
        creativeName={hiddenGem ? truncateName(hiddenGem.creative_name) : '없음'}
        mainValue={hiddenGem ? `${calcConversionRate(hiddenGem).toFixed(1)}%` : '-'}
        mainLabel="전환율"
        subValue={hiddenGem ? `${hiddenGem.unique_visitors?.toLocaleString()}명 방문` : null}
        subLabel=""
        tooltip={hiddenGem ? `${hiddenGem.creative_name}\n방문자는 적지만 전환율이 높습니다. 예산을 늘려보세요!` : '숨은 보석 소재가 없습니다'}
        onClick={() => hiddenGem && onCardClick?.(hiddenGem)}
        isEmpty={!hiddenGem}
      />
    </div>
  );
}

export default InsightCards;
