/**
 * MappingTable Component
 * 
 * 페이지 매핑 목록 테이블 (매핑됨 + 매핑 안됨)
 */

import React from 'react';
import { Table, Tag, Typography, Space, Button, Dropdown, Tooltip, Popover, Divider } from 'antd';
import {
  LinkOutlined,
  EditOutlined,
  CloseOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  RobotOutlined,
  MinusCircleOutlined,
  SettingOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { decodeUrl } from '../utils/urlHelpers';

const { Text } = Typography;

/**
 * 매핑 테이블 컴포넌트
 */
const MappingTable = ({
  data,
  loading,
  page,
  pageSize,
  total,
  onPageChange,
  onOpenUrl,
  onOpenMappingModal,
  onOpenOriginalUrlsModal,
  onUnmap,
  onExclude
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
      width: 400,
      ellipsis: true,
      render: (url, record) => {
        const urlConditions = record.url_conditions;
        const isComplex = urlConditions && urlConditions.groups && urlConditions.groups.length > 0;

        // Popover content for complex URL conditions
        const popoverContent = isComplex ? (
          <div style={{ maxWidth: 500 }}>
            <Text strong style={{ fontSize: '13px' }}>📋 URL 조건 상세 (OR 연산)</Text>
            <Divider style={{ margin: '12px 0' }} />
            {urlConditions.groups.map((group, index) => (
              <div key={index}>
                <Space direction="vertical" size={2} style={{ width: '100%' }}>
                  <Text strong style={{ fontSize: '12px' }}>🔗 조건 {index + 1}</Text>
                  <Text type="secondary" style={{ fontSize: '11px', fontFamily: 'monospace' }}>
                    베이스: {group.base_url || '-'}
                  </Text>
                  {group.params && group.params.conditions && group.params.conditions.length > 0 && (
                    <Text type="secondary" style={{ fontSize: '11px', fontFamily: 'monospace' }}>
                      매개변수: {group.params.conditions.map(p =>
                        `${p.key}=${p.value}`
                      ).join(' AND ')}
                    </Text>
                  )}
                </Space>
                {index < urlConditions.groups.length - 1 && (
                  <Divider style={{ margin: '12px 0', fontSize: '11px', color: '#8C8C8C' }}>OR</Divider>
                )}
              </div>
            ))}
          </div>
        ) : null;

        return (
          <Space size="small" style={{ width: '100%' }}>
            <Text
              style={{
                fontSize: '12px',
                fontFamily: 'monospace',
                wordBreak: 'break-all',
                flex: 1
              }}
              title={decodeUrl(url)}
            >
              {decodeUrl(url)}
            </Text>
            {isComplex && (
              <>
                <Tag color="orange" style={{ marginLeft: 4, fontSize: '11px' }}>
                  +{urlConditions.groups.length} OR
                </Tag>
                <Popover
                  content={popoverContent}
                  title={null}
                  trigger="click"
                  placement="bottomLeft"
                >
                  <InfoCircleOutlined
                    style={{
                      color: '#1890ff',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  />
                </Popover>
              </>
            )}
          </Space>
        );
      }
    },
    {
      title: '매핑상태',
      dataIndex: 'is_mapped',
      key: 'status',
      width: 90,
      align: 'center',
      render: (isMapped) => isMapped ? (
        <Tag color="success" icon={<CheckCircleOutlined />}>
          완료
        </Tag>
      ) : (
        <Tag color="default" icon={<CloseCircleOutlined />}>
          미완료
        </Tag>
      )
    },
    {
      title: '등록유형',
      dataIndex: 'source_type',
      key: 'source_type',
      width: 90,
      align: 'center',
      render: (type) => type === 'manual' ? (
        <Tag color="orange" icon={<EditOutlined />}>
          수동
        </Tag>
      ) : (
        <Tag color="blue" icon={<RobotOutlined />}>
          자동
        </Tag>
      )
    },
    {
      title: '매핑명',
      dataIndex: 'korean_name',
      key: 'korean_name',
      width: 250,
      ellipsis: {
        showTitle: false
      },
      render: (name) => (
        name ? (
          <Tooltip title={name} placement="topLeft">
            <Tag 
              color="blue" 
              style={{ 
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'inline-block'
              }}
            >
              {name}
            </Tag>
          </Tooltip>
        ) : (
          <Text type="secondary">-</Text>
        )
      )
    },
    {
      title: '제품 뱃지',
      key: 'product_badges',
      width: 180,
      ellipsis: {
        showTitle: false
      },
      render: (_, record) => {
        // 상품 페이지가 아니면 표시 안 함
        if (!record.is_product_page) {
          return <Text type="secondary">-</Text>;
        }

        // badges 배열 가져오기
        let badges = [];
        
        try {
          if (typeof record.badges === 'string') {
            badges = JSON.parse(record.badges);
          } else if (Array.isArray(record.badges)) {
            badges = record.badges;
          }
        } catch (e) {
          console.error('Failed to parse badges:', e);
          badges = [];
        }
        
        // 레거시: badge_text가 있으면 배열로 변환
        if (badges.length === 0 && record.badge_text) {
          badges = [{
            text: record.badge_text,
            color: record.badge_color || '#1677ff'
          }];
        }

        // 뱃지가 없으면 빈 값
        if (badges.length === 0) {
          return <Text type="secondary">-</Text>;
        }

        // 최대 4개 배지 표시
        const maxDisplay = 4;
        const displayBadges = badges.slice(0, maxDisplay);
        const remainingCount = Math.max(0, badges.length - maxDisplay);

        return (
          <Space size={4} wrap style={{ maxWidth: '100%', lineHeight: '1.2' }}>
            {displayBadges.map((badge, idx) => (
              <Tooltip key={idx} title={badge.text} placement="top">
                <span
                  style={{
                    display: 'inline-block',
                    margin: '2px 0',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontWeight: 600,
                    fontSize: '11px',
                    maxWidth: '80px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: badge.text_color || '#fff',
                    backgroundColor: badge.color || '#1677ff'
                  }}
                >
                  {badge.text}
                </span>
              </Tooltip>
            ))}
            {remainingCount > 0 && (
              <Tag
                color="default"
                style={{
                  margin: '2px 0',
                  fontSize: '11px',
                  padding: '2px 6px',
                  flexShrink: 0
                }}
              >
                +{remainingCount}
              </Tag>
            )}
          </Space>
        );
      }
    },
    {
      title: '액션',
      key: 'action',
      width: 100,
      align: 'center',
      render: (_, record) => {
        const menuItems = [
          {
            key: 'view-urls',
            icon: <EyeOutlined />,
            label: '유입URL 보기',
            onClick: () => onOpenOriginalUrlsModal(record.url, record.original_url)
          },
          {
            key: 'open-new-tab',
            icon: <LinkOutlined />,
            label: '새 탭으로 열기',
            onClick: () => onOpenUrl(record.url, record.original_url)
          },
          {
            key: 'edit',
            icon: <EditOutlined />,
            label: record.is_mapped ? '수정' : '매핑하기',
            onClick: () => onOpenMappingModal(record.url, record.original_url)
          },
          // "매핑 풀기" 옵션 - 매핑 완료된 URL만 표시
          ...(record.is_mapped ? [
            {
              key: 'unmap',
              icon: <MinusCircleOutlined />,
              label: '매핑 풀기',
              onClick: () => onUnmap(record.mapping_id, record.url)
            }
          ] : []),
          {
            type: 'divider'
          },
          {
            key: 'exclude',
            icon: <CloseOutlined />,
            label: '제외',
            danger: true,
            onClick: () => onExclude(record.url, record.original_url)
          }
        ];

        return (
          <Dropdown
            menu={{ items: menuItems }}
            trigger={['click']}
            placement="bottomRight"
          >
            <Button icon={<SettingOutlined />}>
              설정
            </Button>
          </Dropdown>
        );
      }
    }
  ];

  return (
    <Table
      columns={columns}
      dataSource={data}
      rowKey="url"
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

export default MappingTable;
