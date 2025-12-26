import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, Card, DatePicker, Button, Space, message, Tag, Badge } from 'antd';
import { ReloadOutlined, FacebookOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import MetaTable from './components/MetaTable';

const { RangePicker } = DatePicker;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3003';

/**
 * 메타 성과 조회 페이지
 * Phase 2: 컬럼 커스터마이징 + 너비 조절 + localStorage 저장
 */
function MetaInsights() {
  const [activeTab, setActiveTab] = useState('campaigns');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // 날짜 범위 (기본: 최근 30일)
  const [dateRange, setDateRange] = useState([
    dayjs().subtract(30, 'day'),
    dayjs()
  ]);

  // 데이터
  const [campaigns, setCampaigns] = useState([]);
  const [adSets, setAdSets] = useState([]);
  const [ads, setAds] = useState([]);

  // 선택된 항목 (계층 필터링용)
  const [selectedCampaignIds, setSelectedCampaignIds] = useState([]);
  const [selectedAdSetIds, setSelectedAdSetIds] = useState([]);

  // 요약 정보
  const [summary, setSummary] = useState({ campaigns: 0, adSets: 0, ads: 0 });

  /**
   * 캠페인 데이터 로드
   */
  const loadCampaigns = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        status: 'ACTIVE',
        dateFrom: dateRange[0].format('YYYY-MM-DD'),
        dateTo: dateRange[1].format('YYYY-MM-DD')
      });

      const res = await fetch(`${API_BASE}/api/meta/campaigns?${params}`);
      const data = await res.json();

      if (data.success) {
        setCampaigns(data.data);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Failed to load campaigns:', error);
      message.error('캠페인 데이터를 불러오는데 실패했습니다.');
    }
  }, [dateRange]);

  /**
   * 광고 세트 데이터 로드
   */
  const loadAdSets = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        status: 'ACTIVE',
        dateFrom: dateRange[0].format('YYYY-MM-DD'),
        dateTo: dateRange[1].format('YYYY-MM-DD')
      });

      if (selectedCampaignIds.length > 0) {
        params.set('campaignIds', selectedCampaignIds.join(','));
      }

      const res = await fetch(`${API_BASE}/api/meta/adsets?${params}`);
      const data = await res.json();

      if (data.success) {
        setAdSets(data.data);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Failed to load ad sets:', error);
      message.error('광고 세트 데이터를 불러오는데 실패했습니다.');
    }
  }, [dateRange, selectedCampaignIds]);

  /**
   * 광고 데이터 로드
   */
  const loadAds = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        status: 'ACTIVE',
        dateFrom: dateRange[0].format('YYYY-MM-DD'),
        dateTo: dateRange[1].format('YYYY-MM-DD')
      });

      if (selectedAdSetIds.length > 0) {
        params.set('adSetIds', selectedAdSetIds.join(','));
      } else if (selectedCampaignIds.length > 0) {
        params.set('campaignIds', selectedCampaignIds.join(','));
      }

      const res = await fetch(`${API_BASE}/api/meta/ads?${params}`);
      const data = await res.json();

      if (data.success) {
        setAds(data.data);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Failed to load ads:', error);
      message.error('광고 데이터를 불러오는데 실패했습니다.');
    }
  }, [dateRange, selectedAdSetIds, selectedCampaignIds]);

  /**
   * 요약 정보 로드
   */
  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/meta/summary?status=ACTIVE`);
      const data = await res.json();
      if (data.success) {
        setSummary(data.data);
      }
    } catch (error) {
      console.error('Failed to load summary:', error);
    }
  }, []);

  /**
   * 현재 탭에 맞는 데이터 로드
   */
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'campaigns') {
        await loadCampaigns();
      } else if (activeTab === 'adsets') {
        await loadAdSets();
      } else if (activeTab === 'ads') {
        await loadAds();
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab, loadCampaigns, loadAdSets, loadAds]);

  /**
   * 새로고침 (캐시 초기화)
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch(`${API_BASE}/api/meta/refresh`, { method: 'POST' });
      await loadData();
      await loadSummary();
      message.success('데이터를 새로고침했습니다.');
    } catch (error) {
      message.error('새로고침에 실패했습니다.');
    } finally {
      setRefreshing(false);
    }
  };

  // 초기 로드
  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  // 탭 변경 또는 날짜 변경 시 데이터 로드
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 캠페인 선택 변경 시
  useEffect(() => {
    if (activeTab === 'adsets') {
      loadAdSets();
    }
    if (activeTab === 'ads') {
      loadAds();
    }
  }, [selectedCampaignIds, activeTab, loadAdSets, loadAds]);

  // 광고 세트 선택 변경 시
  useEffect(() => {
    if (activeTab === 'ads') {
      loadAds();
    }
  }, [selectedAdSetIds, activeTab, loadAds]);

  /**
   * 필터 알림 메시지 생성
   */
  const getFilterAlert = (tabType) => {
    if (tabType === 'adsets' && selectedCampaignIds.length > 0) {
      return '선택된 캠페인의 광고 세트만 표시됩니다';
    }
    if (tabType === 'ads') {
      if (selectedAdSetIds.length > 0) {
        return '선택된 광고 세트의 광고만 표시됩니다';
      }
      if (selectedCampaignIds.length > 0) {
        return '선택된 캠페인의 광고만 표시됩니다';
      }
    }
    return null;
  };

  /**
   * 탭 아이템 정의
   */
  const tabItems = [
    {
      key: 'campaigns',
      label: (
        <Space>
          <span>캠페인</span>
          <Badge count={summary.campaigns} style={{ backgroundColor: '#1877F2' }} />
          {selectedCampaignIds.length > 0 && (
            <Tag color="blue">{selectedCampaignIds.length}개 선택</Tag>
          )}
        </Space>
      ),
      children: (
        <MetaTable
          tabType="campaign"
          data={campaigns}
          loading={loading}
          selectedIds={selectedCampaignIds}
          onSelectionChange={setSelectedCampaignIds}
        />
      )
    },
    {
      key: 'adsets',
      label: (
        <Space>
          <span>광고 세트</span>
          <Badge count={summary.adSets} style={{ backgroundColor: '#1877F2' }} />
          {selectedAdSetIds.length > 0 && (
            <Tag color="blue">{selectedAdSetIds.length}개 선택</Tag>
          )}
        </Space>
      ),
      children: (
        <MetaTable
          tabType="adset"
          data={adSets}
          loading={loading}
          selectedIds={selectedAdSetIds}
          onSelectionChange={setSelectedAdSetIds}
          filterAlert={getFilterAlert('adsets')}
        />
      )
    },
    {
      key: 'ads',
      label: (
        <Space>
          <span>광고</span>
          <Badge count={summary.ads} style={{ backgroundColor: '#1877F2' }} />
        </Space>
      ),
      children: (
        <MetaTable
          tabType="ad"
          data={ads}
          loading={loading}
          filterAlert={getFilterAlert('ads')}
        />
      )
    }
  ];

  return (
    <div style={{ padding: '24px', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      {/* 헤더 */}
      <Card style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <FacebookOutlined style={{ fontSize: '24px', color: '#1877F2' }} />
            <h2 style={{ margin: 0 }}>메타 성과 조회</h2>
            <Tag color="blue">ACTIVE 항목만</Tag>
          </Space>
          
          <Space>
            <RangePicker
              value={dateRange}
              onChange={(dates) => dates && setDateRange(dates)}
              format="YYYY-MM-DD"
              presets={[
                { label: '오늘', value: [dayjs(), dayjs()] },
                { label: '어제', value: [dayjs().subtract(1, 'day'), dayjs().subtract(1, 'day')] },
                { label: '최근 7일', value: [dayjs().subtract(7, 'day'), dayjs()] },
                { label: '최근 30일', value: [dayjs().subtract(30, 'day'), dayjs()] },
                { label: '이번 달', value: [dayjs().startOf('month'), dayjs()] },
                { label: '지난 달', value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] }
              ]}
            />
            <Button
              icon={<ReloadOutlined spin={refreshing} />}
              onClick={handleRefresh}
              loading={refreshing}
            >
              새로고침
            </Button>
          </Space>
        </div>
      </Card>

      {/* 탭 */}
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          size="large"
        />
      </Card>
    </div>
  );
}

export default MetaInsights;
