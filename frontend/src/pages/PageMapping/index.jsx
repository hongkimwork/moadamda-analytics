/**
 * PageMapping Component
 * 
 * 페이지 매핑 관리 메인 컴포넌트
 * - 라우팅, 레이아웃, 상태 조립만 담당
 * - 데이터 로직은 커스텀 훅으로 분리
 * - UI는 별도 컴포넌트로 분리
 */

import React, { useState } from 'react';
import { Card, Tabs, Tag, Typography, Space, Button, Input, message, Form } from 'antd';
import { ReloadOutlined, SearchOutlined, PlusOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ko';

// Hooks
import { usePageMappings } from './hooks/usePageMappings';
import { useExcludedUrls } from './hooks/useExcludedUrls';
import { useOriginalUrls } from './hooks/useOriginalUrls';

// Components
import MappingTable from './components/MappingTable';
import ExcludedTable from './components/ExcludedTable';
import StatisticsSummary from './components/StatisticsSummary';
import SearchFilterSection from './components/SearchFilterSection';

// Modals (from shared components)
import { MappingModal, OriginalUrlsModal, ManualAddModal } from '../../components/mappings';

// Utils
import { parseUrl, createUrlConditions } from '../../utils/urlParser';
import { decodeUrl, parseBadges } from './utils/urlHelpers';

dayjs.extend(relativeTime);
dayjs.locale('ko');

const { Title, Text } = Typography;

/**
 * 페이지 매핑 메인 컴포넌트
 */
function PageMapping() {
  // Tab state
  const [activeTab, setActiveTab] = useState('all');
  const [lastUpdate, setLastUpdate] = useState(null);

  // Custom hooks for data management
  const pageMappings = usePageMappings();
  const excludedUrls = useExcludedUrls();
  const originalUrls = useOriginalUrls();

  // Mapping modal state
  const [mappingModalVisible, setMappingModalVisible] = useState(false);
  const [mappingUrl, setMappingUrl] = useState('');
  const [mappingSubmitting, setMappingSubmitting] = useState(false);
  const [initialBadges, setInitialBadges] = useState([]);
  const [form] = Form.useForm();

  // Manual add modal state
  const [manualAddModalVisible, setManualAddModalVisible] = useState(false);
  const [manualAddSubmitting, setManualAddSubmitting] = useState(false);
  const [manualAddForm] = Form.useForm();

  // URL Groups state for complex mapping
  const [urlGroups, setUrlGroups] = useState([
    { baseUrl: '', params: [{ key: '', value: '' }] }
  ]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * 새로고침
   */
  const handleRefresh = () => {
    if (activeTab === 'all') {
      pageMappings.fetchData();
    } else if (activeTab === 'excluded') {
      excludedUrls.fetchData();
    }
    setLastUpdate(new Date());
    message.success('새로고침 완료');
  };

  /**
   * URL을 새 탭으로 열기
   */
  const handleOpenUrl = (url, originalUrl) => {
    const urlToOpen = originalUrl || url;
    window.open(urlToOpen, '_blank', 'noopener,noreferrer');
  };

  /**
   * 매핑 모달 열기
   */
  const handleOpenMappingModal = (url, originalUrl) => {
    setMappingUrl(url);
    setMappingModalVisible(true);

    const existingMapping = pageMappings.data.find(item => item.url === url);
    if (existingMapping) {
      setMappingUrl(existingMapping.original_url || url);

      if (existingMapping.korean_name) {
        form.setFieldsValue({
          korean_name: existingMapping.korean_name,
          is_product_page: existingMapping.is_product_page || false,
          badge_text: existingMapping.badge_text || '',
          badge_color: existingMapping.badge_color || '#1677ff'
        });
        
        setInitialBadges(parseBadges(existingMapping.badges));
      } else {
        form.resetFields();
        setInitialBadges([]);
      }
    } else {
      form.resetFields();
      setInitialBadges([]);
    }
  };

  /**
   * 매핑 모달 닫기
   */
  const handleCloseMappingModal = () => {
    setMappingModalVisible(false);
    setMappingUrl('');
    form.resetFields();
    setInitialBadges([]);
  };

  /**
   * 매핑 제출
   */
  const handleSubmitMapping = async (values) => {
    try {
      setMappingSubmitting(true);

      const existingMapping = pageMappings.data.find(item =>
        (item.original_url || item.url) === mappingUrl
      );

      const result = await pageMappings.submitMapping(mappingUrl, values, existingMapping);

      if (result.success) {
        handleCloseMappingModal();
      }
    } finally {
      setMappingSubmitting(false);
    }
  };

  /**
   * URL 제외
   */
  const handleExcludeUrl = async (displayUrl, originalUrl) => {
    await pageMappings.excludeUrl(displayUrl, originalUrl);
  };

  /**
   * 매핑 해제
   */
  const handleUnmapUrl = async (mappingId, displayUrl) => {
    await pageMappings.unmapUrl(mappingId);
  };

  /**
   * 제외 해제 (복원)
   */
  const handleRestoreUrl = async (id) => {
    await excludedUrls.restoreUrl(id);
  };

  /**
   * URL 입력 변경 (자동 파싱)
   */
  const handleUrlInputChange = (groupIndex, value) => {
    const parsed = parseUrl(value);
    const newGroups = [...urlGroups];
    newGroups[groupIndex] = {
      baseUrl: parsed.baseUrl,
      params: parsed.params.length > 0 ? parsed.params : [{ key: '', value: '' }]
    };
    setUrlGroups(newGroups);
  };

  /**
   * URL 그룹 추가
   */
  const handleAddUrlGroup = () => {
    setUrlGroups([...urlGroups, { baseUrl: '', params: [{ key: '', value: '' }] }]);
  };

  /**
   * URL 그룹 제거
   */
  const handleRemoveUrlGroup = (groupIndex) => {
    if (urlGroups.length === 1) {
      message.warning('최소 1개의 URL이 필요합니다');
      return;
    }
    const newGroups = urlGroups.filter((_, index) => index !== groupIndex);
    setUrlGroups(newGroups);
  };

  /**
   * 파라미터 추가
   */
  const handleAddParam = (groupIndex) => {
    const newGroups = [...urlGroups];
    newGroups[groupIndex].params.push({ key: '', value: '' });
    setUrlGroups(newGroups);
  };

  /**
   * 파라미터 제거
   */
  const handleRemoveParam = (groupIndex, paramIndex) => {
    const newGroups = [...urlGroups];
    newGroups[groupIndex].params = newGroups[groupIndex].params.filter((_, i) => i !== paramIndex);
    if (newGroups[groupIndex].params.length === 0) {
      newGroups[groupIndex].params = [{ key: '', value: '' }];
    }
    setUrlGroups(newGroups);
  };

  /**
   * 파라미터 업데이트
   */
  const handleUpdateParam = (groupIndex, paramIndex, field, value) => {
    const newGroups = [...urlGroups];
    newGroups[groupIndex].params[paramIndex][field] = value;
    setUrlGroups(newGroups);
  };

  /**
   * 베이스 URL 업데이트
   */
  const handleUpdateBaseUrl = (groupIndex, value) => {
    const newGroups = [...urlGroups];
    newGroups[groupIndex].baseUrl = value;
    setUrlGroups(newGroups);
  };

  /**
   * 수동 URL 추가 제출
   */
  const handleManualAddSubmit = async (values) => {
    try {
      setManualAddSubmitting(true);

      // 최소 1개의 베이스 URL 검증
      const validGroups = urlGroups.filter(g => g.baseUrl.trim() !== '');
      if (validGroups.length === 0) {
        message.error('최소 1개의 베이스 URL을 입력해주세요');
        return;
      }

      // URL 조건 생성
      const urlConditions = validGroups.length > 1 || validGroups[0].params.some(p => p.key && p.value)
        ? createUrlConditions(validGroups, 'OR')
        : null;

      // 요청 바디 준비
      const requestBody = {
        korean_name: values.korean_name.trim(),
        source_type: 'manual'
      };

      if (urlConditions) {
        requestBody.url_conditions = urlConditions;
        requestBody.url = validGroups[0].baseUrl;
      } else {
        requestBody.url = validGroups[0].baseUrl;
      }

      const result = await pageMappings.addManualUrl(requestBody);

      if (result.success) {
        handleCloseManualAddModal();
      }
    } finally {
      setManualAddSubmitting(false);
    }
  };

  /**
   * 수동 추가 모달 닫기
   */
  const handleCloseManualAddModal = () => {
    setManualAddModalVisible(false);
    manualAddForm.resetFields();
    setUrlGroups([{ baseUrl: '', params: [{ key: '', value: '' }] }]);
  };

  // ============================================================================
  // Tab Items
  // ============================================================================

  const tabItems = [
    {
      key: 'all',
      label: (
        <span>
          📋 URL 매핑 관리
          {pageMappings.statistics.total > 0 && pageMappings.statusFilter === 'all' && (
            <span style={{ marginLeft: 8 }}>
              <Tag color="blue">{pageMappings.statistics.total}개</Tag>
              <Tag color="success" icon={<CheckCircleOutlined />}>{pageMappings.statistics.completed}</Tag>
              <Tag color="default" icon={<CloseCircleOutlined />}>{pageMappings.statistics.uncompleted}</Tag>
            </span>
          )}
          {pageMappings.total > 0 && pageMappings.statusFilter !== 'all' && (
            <span style={{ marginLeft: 8 }}>
              <Tag color="blue">{pageMappings.total}개</Tag>
            </span>
          )}
        </span>
      ),
      children: (
        <div>
          {/* Search and filters */}
          <SearchFilterSection
            search={pageMappings.search}
            onSearchChange={pageMappings.setSearch}
            onSearch={pageMappings.handleSearch}
            statusFilter={pageMappings.statusFilter}
            onStatusFilterChange={pageMappings.setStatusFilter}
            sortOrder={pageMappings.sortOrder}
            onSortOrderChange={pageMappings.setSortOrder}
            total={pageMappings.total}
          />

          {/* Statistics Summary */}
          <StatisticsSummary 
            statistics={pageMappings.statistics} 
            statusFilter={pageMappings.statusFilter}
          />

          {/* Table */}
          <MappingTable
            data={pageMappings.data}
            loading={pageMappings.loading}
            page={pageMappings.page}
            pageSize={pageMappings.pageSize}
            total={pageMappings.total}
            onPageChange={pageMappings.handlePageChange}
            onOpenUrl={handleOpenUrl}
            onOpenMappingModal={handleOpenMappingModal}
            onOpenOriginalUrlsModal={originalUrls.openModal}
            onUnmap={handleUnmapUrl}
            onExclude={handleExcludeUrl}
          />
        </div>
      )
    },
    {
      key: 'excluded',
      label: (
        <span>
          🚫 제외된 URL
          {excludedUrls.total > 0 && <Tag color="red" style={{ marginLeft: 8 }}>{excludedUrls.total}</Tag>}
        </span>
      ),
      children: (
        <div>
          {/* Search bar */}
          <Space style={{ marginBottom: 16 }}>
            <Input
              placeholder="URL 검색"
              prefix={<SearchOutlined />}
              value={excludedUrls.search}
              onChange={(e) => excludedUrls.setSearch(e.target.value)}
              onPressEnter={excludedUrls.handleSearch}
              style={{ width: 300 }}
              allowClear
            />
            <Button onClick={excludedUrls.handleSearch}>검색</Button>
          </Space>

          {/* Table */}
          <ExcludedTable
            data={excludedUrls.data}
            loading={excludedUrls.loading}
            page={excludedUrls.page}
            pageSize={excludedUrls.pageSize}
            total={excludedUrls.total}
            onPageChange={excludedUrls.handlePageChange}
            onOpenUrl={handleOpenUrl}
            onRestore={handleRestoreUrl}
          />
        </div>
      )
    }
  ];

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div style={{ padding: '24px', minHeight: '100vh', background: '#f0f2f5' }}>
      <Card>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24
        }}>
          <div>
            <Title level={3} style={{ margin: 0 }}>🗺️ 페이지 매핑</Title>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {lastUpdate && `마지막 업데이트: ${dayjs(lastUpdate).fromNow()}`}
            </Text>
          </div>
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setManualAddModalVisible(true)}
            >
              URL 추가
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
              loading={pageMappings.loading || excludedUrls.loading}
            >
              새로고침
            </Button>
          </Space>
        </div>

        {/* Tabs */}
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
        />
      </Card>

      {/* Mapping Modal */}
      <MappingModal
        visible={mappingModalVisible}
        onClose={handleCloseMappingModal}
        onSubmit={handleSubmitMapping}
        url={mappingUrl}
        form={form}
        submitting={mappingSubmitting}
        initialBadges={initialBadges}
      />

      {/* Original URLs Modal */}
      <OriginalUrlsModal
        visible={originalUrls.visible}
        onClose={originalUrls.closeModal}
        cleanedUrl={originalUrls.currentCleanedUrl}
        data={originalUrls.data}
        loading={originalUrls.loading}
        stats={originalUrls.stats}
        decodeUrl={decodeUrl}
      />

      {/* Manual Add URL Modal */}
      <ManualAddModal
        visible={manualAddModalVisible}
        onClose={handleCloseManualAddModal}
        onSubmit={handleManualAddSubmit}
        form={manualAddForm}
        submitting={manualAddSubmitting}
        urlGroups={urlGroups}
        onUrlInputChange={handleUrlInputChange}
        onUpdateBaseUrl={handleUpdateBaseUrl}
        onUpdateParam={handleUpdateParam}
        onAddParam={handleAddParam}
        onRemoveParam={handleRemoveParam}
        onAddUrlGroup={handleAddUrlGroup}
        onRemoveUrlGroup={handleRemoveUrlGroup}
      />
    </div>
  );
}

export default PageMapping;
