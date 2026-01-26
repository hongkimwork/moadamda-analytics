// ============================================================================
// 모수 평가 기준 설정 카드/버튼
// ============================================================================

import React from 'react';
import { Button } from 'antd';
import { SettingOutlined } from '@ant-design/icons';

/**
 * 모수 평가 기준 설정 버튼/카드
 * - 미설정: 버튼 표시
 * - 설정됨: 요약 카드 표시
 */
function ScoreSettingsCard({ settings, onClick }) {
  // 미설정 상태: 버튼
  if (!settings) {
    return (
      <Button
        icon={<SettingOutlined />}
        onClick={onClick}
        style={{
          borderStyle: 'dashed',
          borderColor: '#d9d9d9',
          color: '#666',
          height: 'auto',
          padding: '8px 16px'
        }}
      >
        모수 평가 기준 설정
      </Button>
    );
  }

  // 설정됨 상태: 요약 카드
  const isRelative = settings.evaluation_type === 'relative';

  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px 16px',
        background: '#fff',
        border: '1px solid #d9d9d9',
        borderRadius: '8px',
        cursor: 'pointer',
        minWidth: '280px',
        transition: 'all 0.2s'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#1890ff';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(24, 144, 255, 0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#d9d9d9';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
        <span style={{ fontSize: '14px', fontWeight: 600 }}>
          {isRelative ? '📊 상대평가' : '📏 절대평가'}
        </span>
      </div>
      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
        스크롤 {settings.weight_scroll}% · PV {settings.weight_pv}% · 체류 {settings.weight_duration}%
      </div>
      <div style={{ fontSize: '11px', color: '#999' }}>
        ··· 세부 사항을 보려면 클릭하세요
      </div>
    </div>
  );
}

export default ScoreSettingsCard;
