/**
 * 주문 목록 필터 컴포넌트
 * 날짜 범위, 디바이스 필터 UI
 */

import React from 'react';
import { DatePicker, Select, Space, Tag } from 'antd';

const { RangePicker } = DatePicker;

/**
 * OrderFilters 컴포넌트
 * @param {Array} dateRange - 날짜 범위 [시작, 종료]
 * @param {Function} onDateRangeChange - 날짜 범위 변경 핸들러
 * @param {string} deviceFilter - 디바이스 필터 값
 * @param {Function} onDeviceFilterChange - 디바이스 필터 변경 핸들러
 * @param {number} totalOrders - 총 주문 수
 */
export function OrderFilters({
  dateRange,
  onDateRangeChange,
  deviceFilter,
  onDeviceFilterChange,
  totalOrders
}) {
  return (
    <Space size="middle">
      <span>기간:</span>
      <RangePicker
        value={dateRange}
        onChange={(dates) => dates && onDateRangeChange(dates)}
        format="YYYY-MM-DD"
      />

      <span>디바이스:</span>
      <Select
        value={deviceFilter}
        onChange={onDeviceFilterChange}
        style={{ width: 120 }}
      >
        <Select.Option value="all">전체</Select.Option>
        <Select.Option value="pc">PC</Select.Option>
        <Select.Option value="mobile">Mobile</Select.Option>
      </Select>

      <Tag color="blue">총 {totalOrders}건</Tag>
    </Space>
  );
}

export default OrderFilters;
