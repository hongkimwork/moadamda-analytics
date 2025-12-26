import React, { useState } from 'react';
import { Tabs, Card, Tag, Badge, Switch, Button, Input, DatePicker, Space } from 'antd';
import { 
  SearchOutlined, 
  ReloadOutlined, 
  FilterOutlined,
  CheckCircleFilled,
  PauseCircleFilled
} from '@ant-design/icons';
import dayjs from 'dayjs';
import CampaignTable from './components/CampaignTable';

const { RangePicker } = DatePicker;

/**
 * 메타 광고 관리 메인 페이지
 * 1단계: 기본 뼈대 및 캠페인 리스트 UI 구현
 */
function MetaAdManagement() {
  const [activeTab, setActiveTab] = useState('campaigns');
  const [selectedCampaignIds, setSelectedCampaignIds] = useState([]);
  const [dateRange, setDateRange] = useState([dayjs().subtract(30, 'day'), dayjs()]);

  // 가짜 데이터 (Mock Data) - 사진의 데이터와 유사하게 구성
  const mockCampaigns = [
    {
      id: '1',
      status: 'ACTIVE',
      name: '다이어트(재고소진)_판매(전환)_논타겟_251106',
      delivery: '활동 중',
      delivery_sub: '성과가 좋음',
      strategy: '광고 세트 입찰 전략',
      budget: '광고 세트 예산 사용',
      attribution: '클릭 후 7일, 조회 후 1일',
      results: 298,
      reach: 77680,
      impressions: 201072,
      cost_per_result: 20257
    },
    {
      id: '2',
      status: 'ACTIVE',
      name: '건다피_연예인_판매(리타겟)_250925',
      delivery: '활동 중',
      strategy: '최고 볼륨',
      budget: '₩20,000 일일 평균',
      attribution: '클릭 후 7일, 조회 후 1일',
      results: 20,
      reach: 9560,
      impressions: 14124,
      cost_per_result: 30271
    },
    {
      id: '3',
      status: 'PAUSED',
      name: '건강_판매(전환)_251022',
      delivery: '꺼짐',
      strategy: '광고 세트 입찰 전략',
      budget: '광고 세트 예산 사용',
      attribution: '클릭 후 7일, 조회 후 1일',
      results: 0,
      reach: 0,
      impressions: 0,
      cost_per_result: 0
    }
  ];

  // 탭 레이블 구성 (선택된 항목 수 표시)
  const items = [
    {
      key: 'campaigns',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>캠페인</span>
          {selectedCampaignIds.length > 0 && (
            <Tag color="blue" style={{ margin: 0 }}>{selectedCampaignIds.length}개 선택됨</Tag>
          )}
        </div>
      ),
      children: <CampaignTable 
        data={mockCampaigns} 
        onSelectionChange={setSelectedCampaignIds} 
      />,
    },
    {
      key: 'adsets',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>광고 세트</span>
          {selectedCampaignIds.length > 0 && (
            <Tag color="blue" style={{ margin: 0 }}>캠페인 {selectedCampaignIds.length}개</Tag>
          )}
        </div>
      ),
      children: <div style={{ padding: '24px', textAlign: 'center' }}>광고 세트 리스트 준비 중 (2단계 예정)</div>,
    },
    {
      key: 'ads',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>광고</span>
          {selectedCampaignIds.length > 0 && (
            <Tag color="blue" style={{ margin: 0 }}>캠페인 {selectedCampaignIds.length}개</Tag>
          )}
        </div>
      ),
      children: <div style={{ padding: '24px', textAlign: 'center' }}>광고 리스트 준비 중 (2단계 예정)</div>,
    },
  ];

  return (
    <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
      {/* 1. 상단 컨트롤 바 */}
      <Card bordered={false} style={{ marginBottom: '16px', borderRadius: '8px' }} bodyStyle={{ padding: '12px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space size="middle">
            <Input 
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />} 
              placeholder="이름, ID 또는 지표로 검색하여 필터링" 
              style={{ width: 400 }}
              allowClear
            />
            <Button icon={<FilterOutlined />}>필터</Button>
          </Space>
          <Space size="middle">
            <RangePicker 
              value={dateRange} 
              onChange={setDateRange}
              style={{ width: 300 }}
            />
            <Button icon={<ReloadOutlined />} />
          </Space>
        </div>
      </Card>

      {/* 2. 메인 탭 영역 */}
      <Card bordered={false} style={{ borderRadius: '8px' }} bodyStyle={{ padding: 0 }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={items}
          style={{ padding: '0 24px' }}
          tabBarStyle={{ marginBottom: 0 }}
        />
      </Card>
    </div>
  );
}

export default MetaAdManagement;
