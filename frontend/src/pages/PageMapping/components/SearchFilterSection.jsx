/**
 * SearchFilterSection Component
 * 
 * 검색 및 필터 섹션
 */

import React from 'react';
import { Input, Button, Select, Space, Typography, Tag } from 'antd';
import { SearchOutlined } from '@ant-design/icons';

const { Text } = Typography;
const { Option } = Select;

/**
 * 검색 필터 섹션 컴포넌트
 */
const SearchFilterSection = ({
  search,
  onSearchChange,
  onSearch,
  statusFilter,
  onStatusFilterChange,
  sortOrder,
  onSortOrderChange,
  total,
  statusFilterValue
}) => {
  return (
    <>
      {/* 검색 및 필터 */}
      <Space style={{ marginBottom: 16 }}>
        <Input
          placeholder="URL 검색"
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onPressEnter={onSearch}
          style={{ width: 300 }}
          allowClear
        />
        <Button onClick={onSearch}>검색</Button>
        <Select
          value={statusFilter}
          onChange={onStatusFilterChange}
          style={{ width: 120 }}
        >
          <Option value="all">전체 상태</Option>
          <Option value="completed">완료됨</Option>
          <Option value="uncompleted">미완료</Option>
        </Select>
        {/* 
        <Select
          value={sortOrder}
          onChange={onSortOrderChange}
          style={{ width: 140 }}
        >
          <Option value="recent">🕒 최신 방문순</Option>
          <Option value="frequency">🔥 방문 많은순</Option>
        </Select> 
        */}
      </Space>

      {/* 필터링된 결과 정보 */}
      {statusFilter !== 'all' && total > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">
            {statusFilter === 'completed' ? '완료된 URL' : '미완료 URL'}: <Tag>{total}개</Tag>
          </Text>
        </div>
      )}
    </>
  );
};

export default SearchFilterSection;
