/**
 * StatisticsSummary Component
 * 
 * 매핑 현황 통계 요약
 */

import React from 'react';
import { Typography, Tag, Space } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

/**
 * 통계 요약 컴포넌트
 */
const StatisticsSummary = ({ statistics, statusFilter }) => {
  // statusFilter가 'all'일 때만 표시
  if (statusFilter !== 'all' || statistics.total === 0) {
    return null;
  }

  const completedPercentage = statistics.total > 0 
    ? Math.round((statistics.completed / statistics.total) * 100) 
    : 0;
  
  const uncompletedPercentage = statistics.total > 0 
    ? Math.round((statistics.uncompleted / statistics.total) * 100) 
    : 0;

  return (
    <div style={{
      marginBottom: 16,
      padding: '12px 16px',
      background: '#f5f5f5',
      borderRadius: 4,
      display: 'flex',
      gap: 24,
      alignItems: 'center'
    }}>
      <Text strong>📊 매핑 현황:</Text>
      <Space size="middle">
        <span>
          <Text type="secondary">전체</Text>
          <Tag color="blue" style={{ marginLeft: 8 }}>{statistics.total}개</Tag>
        </span>
        <span>
          <Text type="secondary">완료</Text>
          <Tag color="success" icon={<CheckCircleOutlined />} style={{ marginLeft: 8 }}>
            {statistics.completed}개 ({completedPercentage}%)
          </Tag>
        </span>
        <span>
          <Text type="secondary">미완료</Text>
          <Tag color="default" icon={<CloseCircleOutlined />} style={{ marginLeft: 8 }}>
            {statistics.uncompleted}개 ({uncompletedPercentage}%)
          </Tag>
        </span>
      </Space>
    </div>
  );
};

export default StatisticsSummary;
