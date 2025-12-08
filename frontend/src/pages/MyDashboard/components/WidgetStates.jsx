/**
 * 위젯 상태 컴포넌트 (로딩, 에러, 데이터 없음)
 */

import React from 'react';
import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

export const LoadingState = ({ contentHeight }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: contentHeight
  }}>
    <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
  </div>
);

export const ErrorState = ({ contentHeight }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: contentHeight,
    color: '#ff4d4f',
    fontSize: 13
  }}>
    데이터를 불러올 수 없습니다
  </div>
);

export const EmptyState = ({ contentHeight }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: contentHeight,
    color: '#8c8c8c',
    fontSize: 13
  }}>
    데이터가 없습니다
  </div>
);
