import React from 'react';
import { Table, Switch, Tooltip, Typography } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

/**
 * 캠페인 목록 테이블 컴포넌트
 */
function CampaignTable({ data, onSelectionChange }) {
  const columns = [
    {
      title: '해제/설정',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Switch 
          size="small" 
          checked={status === 'ACTIVE'} 
          style={{ backgroundColor: status === 'ACTIVE' ? '#1877F2' : undefined }}
        />
      ),
    },
    {
      title: '캠페인 이름',
      dataIndex: 'name',
      key: 'name',
      width: 350,
      render: (name) => (
        <Text style={{ color: '#1877F2', cursor: 'pointer', fontWeight: 500 }}>
          {name}
        </Text>
      ),
    },
    {
      title: '게재',
      dataIndex: 'delivery',
      key: 'delivery',
      width: 150,
      render: (text, record) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              backgroundColor: record.status === 'ACTIVE' ? '#52c41a' : '#bfbfbf' 
            }} />
            <span>{text}</span>
          </div>
          {record.delivery_sub && (
            <div style={{ fontSize: '12px', color: '#1877F2', marginLeft: '14px', fontStyle: 'italic' }}>
              📈 {record.delivery_sub}
            </div>
          )}
        </div>
      ),
    },
    {
      title: '입찰 전략',
      dataIndex: 'strategy',
      key: 'strategy',
      width: 150,
      render: (text) => <Text type="secondary">{text}</Text>,
    },
    {
      title: '예산',
      dataIndex: 'budget',
      key: 'budget',
      width: 180,
      render: (text) => (
        <div>
          <Text>{text}</Text>
          <div style={{ fontSize: '11px', color: '#8c8c8c' }}>일일 평균</div>
        </div>
      ),
    },
    {
      title: '기여 설정',
      dataIndex: 'attribution',
      key: 'attribution',
      width: 180,
      render: (text) => (
        <div>
          <Text>{text}</Text>
          <div style={{ fontSize: '11px', color: '#8c8c8c' }}>모든 전환</div>
        </div>
      ),
    },
    {
      title: '결과',
      dataIndex: 'results',
      key: 'results',
      width: 120,
      align: 'right',
      render: (val) => (
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 'bold' }}>{val > 0 ? val.toLocaleString() : '—'}</div>
          <div style={{ fontSize: '11px', color: '#8c8c8c' }}>웹사이트 구매</div>
        </div>
      ),
    },
    {
      title: '도달',
      dataIndex: 'reach',
      key: 'reach',
      width: 120,
      align: 'right',
      render: (val) => val > 0 ? val.toLocaleString() : '—',
    },
    {
      title: '노출',
      dataIndex: 'impressions',
      key: 'impressions',
      width: 120,
      align: 'right',
      render: (val) => val > 0 ? val.toLocaleString() : '—',
    },
    {
      title: '결과당 비용',
      dataIndex: 'cost_per_result',
      key: 'cost_per_result',
      width: 120,
      align: 'right',
      render: (val) => val > 0 ? `₩${val.toLocaleString()}` : '—',
    },
  ];

  // 체크박스 선택 설정
  const rowSelection = {
    onChange: (selectedRowKeys) => {
      onSelectionChange(selectedRowKeys);
    },
  };

  return (
    <Table
      rowSelection={{
        type: 'checkbox',
        ...rowSelection,
      }}
      columns={columns}
      dataSource={data.map(item => ({ ...item, key: item.id }))}
      pagination={false}
      scroll={{ x: 1500 }}
      style={{ borderTop: '1px solid #f0f0f0' }}
    />
  );
}

export default CampaignTable;
















