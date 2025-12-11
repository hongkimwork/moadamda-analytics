/**
 * ExcludedTable Component
 * 
 * 제외된 URL 목록 테이블
 */

import React from 'react';
import { Table, Typography, Space, Button } from 'antd';
import { LinkOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { decodeUrl } from '../utils/urlHelpers';

const { Text } = Typography;

/**
 * 제외된 URL 테이블 컴포넌트
 */
const ExcludedTable = ({
  data,
  loading,
  page,
  pageSize,
  total,
  onPageChange,
  onOpenUrl,
  onRestore
}) => {
  const columns = [
    {
      title: '순번',
      key: 'index',
      width: 60,
      align: 'center',
      render: (_, __, index) => (page - 1) * pageSize + index + 1
    },
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
      width: 600,
      ellipsis: true,
      render: (url) => (
        <Text
          style={{
            fontSize: '12px',
            fontFamily: 'monospace',
            wordBreak: 'break-all'
          }}
          title={decodeUrl(url)}
        >
          {decodeUrl(url)}
        </Text>
      )
    },
    {
      title: '제외일',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '액션',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<LinkOutlined />}
            onClick={() => onOpenUrl(record.url)}
          >
            새 탭으로 열기
          </Button>
          <Button
            type="primary"
            size="small"
            onClick={() => onRestore(record.id)}
          >
            제외 해제
          </Button>
        </Space>
      )
    }
  ];

  return (
    <Table
      columns={columns}
      dataSource={data}
      rowKey="id"
      loading={loading}
      pagination={{
        current: page,
        pageSize: pageSize,
        total: total,
        onChange: onPageChange,
        showSizeChanger: true,
        showTotal: (total) => `총 ${total}개`,
        pageSizeOptions: ['10', '20', '50', '100']
      }}
      size="small"
    />
  );
};

export default ExcludedTable;
