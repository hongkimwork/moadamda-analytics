import React from 'react';
import { Modal, Table, Tag, Button, Typography, Statistic, Space, Spin } from 'antd';
import { EyeOutlined, BarChartOutlined, ClockCircleOutlined, LinkOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;

/**
 * OriginalUrlsModal - 유입 URL 상세 보기 모달
 *
 * @param {boolean} visible - 모달 표시 여부
 * @param {function} onClose - 모달 닫기 핸들러
 * @param {string} cleanedUrl - 정제된 URL
 * @param {array} data - 원본 URL 목록
 * @param {boolean} loading - 로딩 상태
 * @param {object} stats - 통계 정보 { total, totalVisits }
 * @param {function} decodeUrl - URL 디코딩 함수
 */
function OriginalUrlsModal({
  visible,
  onClose,
  cleanedUrl,
  data,
  loading,
  stats,
  decodeUrl
}) {
  const columns = [
    {
      title: '순번',
      key: 'index',
      width: 60,
      align: 'center',
      render: (_, __, index) => index + 1
    },
    {
      title: '원본 URL',
      dataIndex: 'url',
      key: 'url',
      ellipsis: true,
      render: (url) => (
        <Text
          style={{
            fontSize: '11px',
            fontFamily: 'monospace',
            wordBreak: 'break-all'
          }}
          copyable
          title={decodeUrl(url)}
        >
          {decodeUrl(url)}
        </Text>
      )
    },
    {
      title: '방문 횟수',
      dataIndex: 'visit_count',
      key: 'visit_count',
      width: 100,
      align: 'right',
      render: (count) => (
        <Tag color={count > 100 ? 'green' : count > 10 ? 'blue' : 'default'}>
          {count.toLocaleString()}회
        </Tag>
      ),
      sorter: (a, b) => a.visit_count - b.visit_count
    },
    {
      title: '최근 방문',
      dataIndex: 'latest_visit',
      key: 'latest_visit',
      width: 150,
      render: (date) => (
        <div>
          <ClockCircleOutlined style={{ marginRight: 4 }} />
          {dayjs(date).fromNow()}
          <br />
          <Text type="secondary" style={{ fontSize: '10px' }}>
            {dayjs(date).format('YYYY-MM-DD HH:mm')}
          </Text>
        </div>
      ),
      sorter: (a, b) => new Date(a.latest_visit) - new Date(b.latest_visit)
    },
    {
      title: '액션',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            icon={<LinkOutlined />}
            onClick={() => window.open(record.url, '_blank', 'noopener,noreferrer')}
            title="새 탭으로 열기"
          >
            열기
          </Button>
        </Space>
      )
    }
  ];

  return (
    <Modal
      title={
        <div>
          <EyeOutlined style={{ marginRight: 8 }} />
          유입 URL 상세 보기
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          닫기
        </Button>
      ]}
      width={1000}
    >
      {/* Header: Cleaned URL */}
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary">정제된 URL:</Text>
        <div style={{
          marginTop: 8,
          padding: '8px 12px',
          background: '#e6f7ff',
          borderRadius: 4,
          fontFamily: 'monospace',
          fontSize: '12px',
          wordBreak: 'break-all',
          border: '1px solid #91d5ff'
        }}>
          {decodeUrl(cleanedUrl)}
        </div>
      </div>

      {/* Statistics */}
      <div style={{
        display: 'flex',
        gap: 16,
        marginBottom: 16,
        padding: '16px',
        background: '#fafafa',
        borderRadius: 4
      }}>
        <Statistic
          title="원본 URL 개수"
          value={stats.total}
          prefix={<BarChartOutlined />}
        />
        <Statistic
          title="총 방문 횟수"
          value={stats.totalVisits}
          prefix={<EyeOutlined />}
        />
      </div>

      {/* Tip */}
      <div style={{
        marginBottom: 16,
        padding: '8px 12px',
        background: '#fffbe6',
        border: '1px solid #ffe58f',
        borderRadius: 4
      }}>
        <Text style={{ fontSize: '12px' }}>
          <strong>TIP:</strong> 방문 횟수가 적고 test, admin, debug 같은 파라미터가 있으면
          내부 테스트일 가능성이 높습니다. 제외 처리를 고려해보세요.
        </Text>
      </div>

      {/* Original URLs Table */}
      <Spin spinning={loading}>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="url"
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `총 ${total}개`,
            pageSizeOptions: ['10', '20', '50', '100']
          }}
          size="small"
          scroll={{ y: 400 }}
        />
      </Spin>
    </Modal>
  );
}

export default OriginalUrlsModal;
