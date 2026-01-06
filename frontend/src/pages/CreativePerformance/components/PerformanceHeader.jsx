// ============================================================================
// 광고 소재 퍼포먼스 페이지 헤더
// 주문 분석 페이지 스타일과 통일
// ============================================================================

import React from 'react';
import { Card, Typography, Button } from 'antd';
import { BarChart3, RefreshCw, Clock } from 'lucide-react';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

/**
 * 퍼포먼스 페이지 헤더 컴포넌트
 * @param {Object} props
 * @param {Function} props.onRefresh - 새로고침 핸들러
 * @param {boolean} props.loading - 로딩 상태
 * @param {Object} props.lastUpdated - 마지막 갱신 시간 (dayjs 객체)
 */
function PerformanceHeader({ 
  onRefresh, 
  loading,
  lastUpdated
}) {
  return (
    <Card 
      style={{ 
        marginBottom: '20px',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        border: '1px solid #e8eaed'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
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
            광고 소재 분석
          </Title>
          <Text type="secondary" style={{ 
            fontSize: '14px', 
            marginTop: '8px',
            display: 'block'
          }}>
            각 광고 소재의 방문자 수, 페이지뷰, 체류시간, 구매 전환을 분석합니다
          </Text>
        </div>
        
        {/* 우측: 버튼 + 갱신 시간 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
          <Button
            icon={<RefreshCw size={16} className={loading ? 'spin-animation' : ''} />}
            onClick={onRefresh}
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
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '4px',
            color: '#9ca3af',
            fontSize: '12px'
          }}>
            <Clock size={12} />
            <span>마지막 갱신: {lastUpdated ? lastUpdated.format('HH:mm:ss') : dayjs().format('HH:mm:ss')}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default PerformanceHeader;
