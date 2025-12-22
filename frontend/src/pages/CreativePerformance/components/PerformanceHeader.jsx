// ============================================================================
// 광고 소재 퍼포먼스 페이지 헤더
// ============================================================================

import React from 'react';
import { Card, Typography, Space, Button, Tag } from 'antd';
import { BarChart3, RefreshCw, GitCompare } from 'lucide-react';

const { Title } = Typography;

/**
 * 퍼포먼스 페이지 헤더 컴포넌트
 * @param {Object} props
 * @param {number} props.total - 전체 광고 소재 개수
 * @param {Array} props.selectedCreatives - 선택된 광고 소재 목록
 * @param {Function} props.onRefresh - 새로고침 핸들러
 * @param {Function} props.onCompare - 소재 비교 핸들러
 * @param {boolean} props.loading - 로딩 상태
 */
function PerformanceHeader({ 
  total, 
  selectedCreatives, 
  onRefresh, 
  onCompare, 
  loading 
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
              광고 소재 분석
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
                onClick={onCompare}
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
  );
}

export default PerformanceHeader;
