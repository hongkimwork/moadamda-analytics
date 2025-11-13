import React, { useState, useEffect } from 'react';
import { Card, Tabs, Table, Button, Input, Space, Tag, message, Typography, Modal, Form, Spin, Statistic, Select, Divider, Tooltip } from 'antd';
import { ReloadOutlined, SearchOutlined, LinkOutlined, PlusOutlined, CloseOutlined, EyeOutlined, ClockCircleOutlined, BarChartOutlined, CheckCircleOutlined, CloseCircleOutlined, EditOutlined, RobotOutlined, MinusCircleOutlined, DeleteOutlined, InfoCircleOutlined, GlobalOutlined, SettingOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ko';
import { parseUrl, createUrlConditions } from '../utils/urlParser';

dayjs.extend(relativeTime);
dayjs.locale('ko');

const { Title, Text } = Typography;
const { Option } = Select;
const API_URL = import.meta.env.VITE_API_URL || '';

// ============================================================================
// PageMapping Component
// ============================================================================
function PageMapping() {
  const [activeTab, setActiveTab] = useState('all');
  const [lastUpdate, setLastUpdate] = useState(null);
  
  // All URLs state (mapped + unmapped)
  const [allData, setAllData] = useState([]);
  const [allLoading, setAllLoading] = useState(false);
  const [allTotal, setAllTotal] = useState(0);
  const [allPage, setAllPage] = useState(1);
  const [allPageSize, setAllPageSize] = useState(20);
  const [allSearch, setAllSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('completed'); // 기본값: 완료
  
  // Excluded URLs state
  const [excludedData, setExcludedData] = useState([]);
  const [excludedLoading, setExcludedLoading] = useState(false);
  const [excludedTotal, setExcludedTotal] = useState(0);
  const [excludedPage, setExcludedPage] = useState(1);
  const [excludedPageSize, setExcludedPageSize] = useState(20);
  const [excludedSearch, setExcludedSearch] = useState('');
  
  // Mapping modal state
  const [mappingModalVisible, setMappingModalVisible] = useState(false);
  const [mappingUrl, setMappingUrl] = useState('');
  const [mappingSubmitting, setMappingSubmitting] = useState(false);
  const [form] = Form.useForm();
  
  // Manual add modal state
  const [manualAddModalVisible, setManualAddModalVisible] = useState(false);
  const [manualAddSubmitting, setManualAddSubmitting] = useState(false);
  const [manualAddForm] = Form.useForm();
  
  // URL Groups state for complex mapping
  const [urlGroups, setUrlGroups] = useState([
    { baseUrl: '', params: [{ key: '', value: '' }] }
  ]);
  
  // Original URLs modal state
  const [originalUrlsModalVisible, setOriginalUrlsModalVisible] = useState(false);
  const [originalUrlsData, setOriginalUrlsData] = useState([]);
  const [originalUrlsLoading, setOriginalUrlsLoading] = useState(false);
  const [currentCleanedUrl, setCurrentCleanedUrl] = useState('');
  const [originalUrlsStats, setOriginalUrlsStats] = useState({
    total: 0,
    totalVisits: 0
  });

  // Fetch all URLs (mapped + unmapped)
  const fetchAllUrls = async () => {
    try {
      setAllLoading(true);
      const offset = (allPage - 1) * allPageSize;
      
      const response = await axios.get(`${API_URL}/api/mappings/all`, {
        params: {
          limit: allPageSize,
          offset: offset,
          search: allSearch,
          status: statusFilter  // 서버에서 필터링
        }
      });
      
      // Backend already sorts and filters data
      setAllData(response.data.data);
      setAllTotal(response.data.total);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to fetch all URLs:', error);
      message.error('URL 목록을 불러오는데 실패했습니다');
    } finally {
      setAllLoading(false);
    }
  };

  // Fetch excluded URLs
  const fetchExcludedUrls = async () => {
    try {
      setExcludedLoading(true);
      const offset = (excludedPage - 1) * excludedPageSize;
      
      const response = await axios.get(`${API_URL}/api/mappings/excluded`, {
        params: {
          limit: excludedPageSize,
          offset: offset,
          search: excludedSearch
        }
      });
      
      setExcludedData(response.data.data);
      setExcludedTotal(response.data.total);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to fetch excluded URLs:', error);
      message.error('제외된 URL 목록을 불러오는데 실패했습니다');
    } finally {
      setExcludedLoading(false);
    }
  };

  // Load data on mount and when dependencies change
  useEffect(() => {
    if (activeTab === 'all') {
      fetchAllUrls();
    } else if (activeTab === 'excluded') {
      fetchExcludedUrls();
    }
  }, [activeTab, allPage, allPageSize, excludedPage, excludedPageSize, statusFilter]);

  // Handle refresh
  const handleRefresh = () => {
    if (activeTab === 'all') {
      fetchAllUrls();
    } else if (activeTab === 'excluded') {
      fetchExcludedUrls();
    }
    message.success('새로고침 완료');
  };

  // Handle search for all URLs
  const handleAllSearch = () => {
    setAllPage(1);
    fetchAllUrls();
  };

  // Handle search for excluded URLs
  const handleExcludedSearch = () => {
    setExcludedPage(1);
    fetchExcludedUrls();
  };

  // Open URL in new tab
  const handleOpenUrl = (url, originalUrl) => {
    // Use original_url if available (for actual page access), otherwise use cleaned url
    const urlToOpen = originalUrl || url;
    window.open(urlToOpen, '_blank', 'noopener,noreferrer');
  };

  // Open mapping modal
  // Note: url is the decoded display URL, originalUrl is the encoded database URL
  const handleOpenMappingModal = (url, originalUrl) => {
    // Store both display URL and original URL
    setMappingUrl(url);
    setMappingModalVisible(true);
    
    // Store original URL in a ref or state for later use
    // We'll use the display URL to find the record, but original URL for API calls
    const existingMapping = allData.find(item => item.url === url);
    if (existingMapping) {
      // Store the original_url for API calls
      setMappingUrl(existingMapping.original_url || url);
      
      if (existingMapping.korean_name) {
        form.setFieldsValue({ korean_name: existingMapping.korean_name });
      } else {
        form.resetFields();
      }
    } else {
      form.resetFields();
    }
  };

  // Close mapping modal
  const handleCloseMappingModal = () => {
    setMappingModalVisible(false);
    setMappingUrl('');
    form.resetFields();
  };

  // Submit mapping
  const handleSubmitMapping = async (values) => {
    try {
      setMappingSubmitting(true);
      
      // mappingUrl is now the original_url (encoded) from handleOpenMappingModal
      // Find the record by matching original_url
      const existingMapping = allData.find(item => 
        (item.original_url || item.url) === mappingUrl
      );
      const isUpdate = existingMapping && existingMapping.is_mapped;
      
      let response;
      if (isUpdate) {
        // Update existing mapping
        response = await axios.put(`${API_URL}/api/mappings/${existingMapping.mapping_id}`, {
          korean_name: values.korean_name.trim()
        });
        message.success('페이지 매핑이 수정되었습니다');
      } else {
        // Create new mapping - use mappingUrl which is already the original_url
        response = await axios.post(`${API_URL}/api/mappings`, {
          url: mappingUrl,
          korean_name: values.korean_name.trim()
        });
        
          message.success('페이지 매핑이 완료되었습니다');
      }

      // Close modal
      handleCloseMappingModal();

      // Update the URL in the list - match by original_url
      setAllData(prevData => prevData.map(item => 
        (item.original_url || item.url) === mappingUrl 
          ? { 
              ...item, 
              korean_name: values.korean_name.trim(), 
              mapping_id: response.data.data.id, 
              is_mapped: true 
            }
          : item
      ));

    } catch (error) {
      console.error('Failed to save mapping:', error);
      
      if (error.response?.status === 409) {
        message.error('이미 매핑된 URL입니다');
      } else if (error.response?.status === 400) {
        // 백엔드에서 error.response.data.error로 메시지 전달
        message.error(error.response.data.error || error.response.data.message || '입력값을 확인해주세요');
      } else {
        message.error('매핑 저장에 실패했습니다');
      }
    } finally {
      setMappingSubmitting(false);
    }
  };

  // Exclude URL (mark as excluded, delete mapping info)
  // Note: originalUrl should be the encoded URL from database, not the decoded display URL
  const handleExcludeUrl = async (displayUrl, originalUrl) => {
    try {
      // Use original_url (encoded) for API call, not the decoded display URL
      const urlToExclude = originalUrl || displayUrl;
      await axios.post(`${API_URL}/api/mappings/exclude`, { url: urlToExclude });
      
      message.success('URL이 제외되었습니다');
      
      // Remove the excluded URL from all list (match by display URL)
      setAllData(prevData => prevData.filter(item => item.url !== displayUrl));
      setAllTotal(prevTotal => prevTotal - 1);
      
    } catch (error) {
      console.error('Failed to exclude URL:', error);
      
      if (error.response?.status === 409) {
        message.error(error.response.data.message || '이미 처리된 URL입니다');
      } else {
        message.error('URL 제외에 실패했습니다');
      }
    }
  };

  // Restore excluded URL (remove from excluded list)
  const handleRestoreUrl = async (id) => {
    try {
      await axios.delete(`${API_URL}/api/mappings/excluded/${id}`);
      
      message.success('제외가 해제되었습니다. 매핑하지 않은 URL 탭에서 다시 확인할 수 있습니다');
      
      // Remove from excluded list
      setExcludedData(prevData => prevData.filter(item => item.id !== id));
      setExcludedTotal(prevTotal => prevTotal - 1);
      
    } catch (error) {
      console.error('Failed to restore URL:', error);
      message.error('제외 해제에 실패했습니다');
    }
  };

  // Helper function to decode URL for display
  const decodeUrl = (url) => {
    try {
      return decodeURIComponent(url);
    } catch (e) {
      // If decoding fails, return original URL
      return url;
    }
  };

  // Fetch original URLs for a cleaned URL
  const fetchOriginalUrls = async (cleanedUrl) => {
    try {
      setOriginalUrlsLoading(true);
      const response = await axios.get(`${API_URL}/api/mappings/original-urls`, {
        params: { cleaned_url: cleanedUrl }
      });
      
      setOriginalUrlsData(response.data.original_urls);
      setOriginalUrlsStats({
        total: response.data.total_original_urls,
        totalVisits: response.data.total_visits
      });
    } catch (error) {
      console.error('Failed to fetch original URLs:', error);
      message.error('원본 URL 목록을 불러오는데 실패했습니다');
    } finally {
      setOriginalUrlsLoading(false);
    }
  };

  // Open original URLs modal
  const handleOpenOriginalUrlsModal = async (cleanedUrl, originalUrl) => {
    // Use original_url if available, otherwise use cleaned url
    const urlToFetch = originalUrl || cleanedUrl;
    setCurrentCleanedUrl(urlToFetch);
    setOriginalUrlsModalVisible(true);
    await fetchOriginalUrls(urlToFetch);
  };

  // Close original URLs modal
  const handleCloseOriginalUrlsModal = () => {
    setOriginalUrlsModalVisible(false);
    setOriginalUrlsData([]);
    setCurrentCleanedUrl('');
    setOriginalUrlsStats({ total: 0, totalVisits: 0 });
  };

  // Handle URL input change with auto-parsing
  const handleUrlInputChange = (groupIndex, value) => {
    const parsed = parseUrl(value);
    const newGroups = [...urlGroups];
    newGroups[groupIndex] = {
      baseUrl: parsed.baseUrl,
      params: parsed.params.length > 0 ? parsed.params : [{ key: '', value: '' }]
    };
    setUrlGroups(newGroups);
  };

  // Add new URL group
  const handleAddUrlGroup = () => {
    setUrlGroups([...urlGroups, { baseUrl: '', params: [{ key: '', value: '' }] }]);
  };

  // Remove URL group
  const handleRemoveUrlGroup = (groupIndex) => {
    if (urlGroups.length === 1) {
      message.warning('최소 1개의 URL이 필요합니다');
      return;
    }
    const newGroups = urlGroups.filter((_, index) => index !== groupIndex);
    setUrlGroups(newGroups);
  };

  // Add parameter to group
  const handleAddParam = (groupIndex) => {
    const newGroups = [...urlGroups];
    newGroups[groupIndex].params.push({ key: '', value: '' });
    setUrlGroups(newGroups);
  };

  // Remove parameter from group
  const handleRemoveParam = (groupIndex, paramIndex) => {
    const newGroups = [...urlGroups];
    newGroups[groupIndex].params = newGroups[groupIndex].params.filter((_, i) => i !== paramIndex);
    if (newGroups[groupIndex].params.length === 0) {
      newGroups[groupIndex].params = [{ key: '', value: '' }];
    }
    setUrlGroups(newGroups);
  };

  // Update parameter
  const handleUpdateParam = (groupIndex, paramIndex, field, value) => {
    const newGroups = [...urlGroups];
    newGroups[groupIndex].params[paramIndex][field] = value;
    setUrlGroups(newGroups);
  };

  // Update base URL
  const handleUpdateBaseUrl = (groupIndex, value) => {
    const newGroups = [...urlGroups];
    newGroups[groupIndex].baseUrl = value;
    setUrlGroups(newGroups);
  };

  // Submit manual URL add
  const handleManualAddSubmit = async (values) => {
    try {
      setManualAddSubmitting(true);
      
      // Validate that at least one URL has a base URL
      const validGroups = urlGroups.filter(g => g.baseUrl.trim() !== '');
      if (validGroups.length === 0) {
        message.error('최소 1개의 베이스 URL을 입력해주세요');
        return;
      }

      // Create URL conditions (Phase 1: URL OR operation)
      const urlConditions = validGroups.length > 1 || validGroups[0].params.some(p => p.key && p.value)
        ? createUrlConditions(validGroups, 'OR')
        : null;

      // Prepare request body
      const requestBody = {
        korean_name: values.korean_name.trim(),
        source_type: 'manual'
      };

      if (urlConditions) {
        requestBody.url_conditions = urlConditions;
        requestBody.url = validGroups[0].baseUrl; // Primary URL for indexing
      } else {
        requestBody.url = validGroups[0].baseUrl;
      }

      const response = await axios.post(`${API_URL}/api/mappings`, requestBody);
      
      message.success('URL이 수동으로 추가되었습니다');
      
      // Close modal and reset
      setManualAddModalVisible(false);
      manualAddForm.resetFields();
      setUrlGroups([{ baseUrl: '', params: [{ key: '', value: '' }] }]);
      
      // Refresh data
      await fetchAllUrls();
      
    } catch (error) {
      console.error('Failed to add URL manually:', error);
      
      if (error.response?.status === 409) {
        message.error('이미 존재하는 URL입니다');
      } else if (error.response?.status === 400) {
        message.error(error.response.data.message || '입력값을 확인해주세요');
      } else {
        message.error('URL 추가에 실패했습니다');
      }
    } finally {
      setManualAddSubmitting(false);
    }
  };

  // Columns for all URLs table
  const allColumns = [
    {
      title: '순번',
      key: 'index',
      width: 60,
      align: 'center',
      render: (_, __, index) => (allPage - 1) * allPageSize + index + 1
    },
    {
      title: '베이스URL',
      dataIndex: 'url',
      key: 'url',
      width: 350,
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
      width: 180,
      render: (name) => name ? <Tag color="blue">{name}</Tag> : <Text type="secondary">-</Text>
    },
    {
      title: '액션',
      key: 'action',
      width: 400,
      render: (_, record) => (
        <Space size="small" wrap>
          <Button 
            size="small" 
            icon={<EyeOutlined />}
            onClick={() => handleOpenOriginalUrlsModal(record.url, record.original_url)}
            title="이 URL로 유입된 원본 URL 목록을 확인합니다"
          >
            유입URL 보기
          </Button>
          <Button 
            size="small" 
            icon={<LinkOutlined />}
            onClick={() => handleOpenUrl(record.url, record.original_url)}
          >
            새 탭으로 열기
          </Button>
          {record.is_mapped ? (
            <Button 
              type="primary" 
              size="small"
              onClick={() => handleOpenMappingModal(record.url, record.original_url)}
            >
              수정
            </Button>
          ) : (
            <Button 
              type="primary" 
              size="small"
              icon={<PlusOutlined />}
              onClick={() => handleOpenMappingModal(record.url, record.original_url)}
            >
              매핑하기
            </Button>
          )}
          <Button 
            danger
            size="small"
            icon={<CloseOutlined />}
            onClick={() => handleExcludeUrl(record.url, record.original_url)}
            title="이 URL을 목록에서 제외합니다"
          >
            제외
          </Button>
        </Space>
      )
    }
  ];

  // Columns for excluded URLs table
  const excludedColumns = [
    {
      title: '순번',
      key: 'index',
      width: 60,
      align: 'center',
      render: (_, __, index) => (excludedPage - 1) * excludedPageSize + index + 1
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
            onClick={() => handleOpenUrl(record.url)}
          >
            새 탭으로 열기
          </Button>
          <Button 
            type="primary"
            size="small"
            onClick={() => handleRestoreUrl(record.id)}
          >
            제외 해제
          </Button>
        </Space>
      )
    }
  ];

  // Server-side filtering: no need for client-side filtering
  // Data is already filtered by the backend based on statusFilter

  // Calculate statistics (only accurate when statusFilter === 'all')
  const mappedCount = allData.filter(item => item.is_mapped).length;
  const unmappedCount = allData.filter(item => !item.is_mapped).length;

  // Tab items
  const tabItems = [
    {
      key: 'all',
      label: (
        <span>
          📋 URL 매핑 관리
          {allTotal > 0 && statusFilter === 'all' && (
            <span style={{ marginLeft: 8 }}>
              <Tag color="blue">{allTotal}개</Tag>
              <Tag color="success" icon={<CheckCircleOutlined />}>{mappedCount}</Tag>
              <Tag color="default" icon={<CloseCircleOutlined />}>{unmappedCount}</Tag>
            </span>
          )}
          {allTotal > 0 && statusFilter !== 'all' && (
            <span style={{ marginLeft: 8 }}>
              <Tag color="blue">{allTotal}개</Tag>
            </span>
          )}
        </span>
      ),
      children: (
        <div>
          {/* Search bar and filters */}
          <Space style={{ marginBottom: 16 }}>
            <Input
              placeholder="URL 검색"
              prefix={<SearchOutlined />}
              value={allSearch}
              onChange={(e) => setAllSearch(e.target.value)}
              onPressEnter={handleAllSearch}
              style={{ width: 300 }}
              allowClear
            />
            <Button onClick={handleAllSearch}>검색</Button>
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 120 }}
            >
              <Option value="all">전체</Option>
              <Option value="completed">완료</Option>
              <Option value="uncompleted">미완료</Option>
            </Select>
          </Space>

          {/* Statistics Summary - Only show when viewing all data */}
          {allTotal > 0 && statusFilter === 'all' && (
            <div style={{ 
              marginBottom: 16, 
              padding: '12px 16px', 
              background: '#f5f5f5', 
              borderRadius: 4,
              display: 'flex',
              gap: 24,
              alignItems: 'center'
            }}>
              <Text strong>📊 매핑 현황:</Text>
              <Space size="middle">
                <span>
                  <Text type="secondary">전체</Text>
                  <Tag color="blue" style={{ marginLeft: 8 }}>{allTotal}개</Tag>
                </span>
                <span>
                  <Text type="secondary">완료</Text>
                  <Tag color="success" icon={<CheckCircleOutlined />} style={{ marginLeft: 8 }}>
                    {mappedCount}개 ({allTotal > 0 ? Math.round((mappedCount / allTotal) * 100) : 0}%)
                  </Tag>
                </span>
                <span>
                  <Text type="secondary">미완료</Text>
                  <Tag color="default" icon={<CloseCircleOutlined />} style={{ marginLeft: 8 }}>
                    {unmappedCount}개 ({allTotal > 0 ? Math.round((unmappedCount / allTotal) * 100) : 0}%)
                  </Tag>
                </span>
              </Space>
            </div>
          )}

          {/* Filtered Results Info */}
          {statusFilter !== 'all' && allTotal > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary">
                {statusFilter === 'completed' ? '완료된 URL' : '미완료 URL'}: <Tag>{allTotal}개</Tag>
              </Text>
            </div>
          )}

          {/* Table */}
          <Table
            columns={allColumns}
            dataSource={allData}
            rowKey="url"
            loading={allLoading}
            pagination={{
              current: allPage,
              pageSize: allPageSize,
              total: allTotal,
              onChange: (page, pageSize) => {
                setAllPage(page);
                setAllPageSize(pageSize);
              },
              showSizeChanger: true,
              showTotal: (total) => `총 ${total}개`,
              pageSizeOptions: ['10', '20', '50', '100']
            }}
            size="small"
          />
        </div>
      )
    },
    {
      key: 'excluded',
      label: (
        <span>
          🚫 제외된 URL
          {excludedTotal > 0 && <Tag color="red" style={{ marginLeft: 8 }}>{excludedTotal}</Tag>}
        </span>
      ),
      children: (
        <div>
          {/* Search bar */}
          <Space style={{ marginBottom: 16 }}>
            <Input
              placeholder="URL 검색"
              prefix={<SearchOutlined />}
              value={excludedSearch}
              onChange={(e) => setExcludedSearch(e.target.value)}
              onPressEnter={handleExcludedSearch}
              style={{ width: 300 }}
              allowClear
            />
            <Button onClick={handleExcludedSearch}>검색</Button>
          </Space>

          {/* Table */}
          <Table
            columns={excludedColumns}
            dataSource={excludedData}
            rowKey="id"
            loading={excludedLoading}
            pagination={{
              current: excludedPage,
              pageSize: excludedPageSize,
              total: excludedTotal,
              onChange: (page, pageSize) => {
                setExcludedPage(page);
                setExcludedPageSize(pageSize);
              },
              showSizeChanger: true,
              showTotal: (total) => `총 ${total}개`,
              pageSizeOptions: ['10', '20', '50', '100']
            }}
            size="small"
          />
        </div>
      )
    }
  ];

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
              loading={allLoading || excludedLoading}
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
      <Modal
        title="페이지 매핑"
        open={mappingModalVisible}
        onCancel={handleCloseMappingModal}
        footer={null}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">URL:</Text>
          <div style={{ 
            marginTop: 8, 
            padding: '8px 12px', 
            background: '#f5f5f5', 
            borderRadius: 4,
            fontFamily: 'monospace',
            fontSize: '12px',
            wordBreak: 'break-all'
          }}>
            {mappingUrl}
          </div>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmitMapping}
        >
          <Form.Item
            name="korean_name"
            label="한국어 페이지명"
            rules={[
              { required: true, message: '한국어 페이지명을 입력해주세요' },
              { whitespace: true, message: '공백만 입력할 수 없습니다' },
              { max: 255, message: '최대 255자까지 입력 가능합니다' }
            ]}
          >
            <Input 
              placeholder="예: 모로실 다이어트&혈당관리를 모아담다"
              autoFocus
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={handleCloseMappingModal}>
                취소
              </Button>
              <Button 
                type="primary" 
                htmlType="submit"
                loading={mappingSubmitting}
              >
                저장
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Original URLs Modal */}
      <Modal
        title={
          <div>
            <EyeOutlined style={{ marginRight: 8 }} />
            유입 URL 상세 보기
          </div>
        }
        open={originalUrlsModalVisible}
        onCancel={handleCloseOriginalUrlsModal}
        footer={[
          <Button key="close" onClick={handleCloseOriginalUrlsModal}>
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
            {decodeUrl(currentCleanedUrl)}
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
            value={originalUrlsStats.total} 
            prefix={<BarChartOutlined />}
          />
          <Statistic 
            title="총 방문 횟수" 
            value={originalUrlsStats.totalVisits} 
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
            💡 <strong>TIP:</strong> 방문 횟수가 적고 test, admin, debug 같은 파라미터가 있으면 
            내부 테스트일 가능성이 높습니다. 제외 처리를 고려해보세요.
          </Text>
        </div>

        {/* Original URLs Table */}
        <Spin spinning={originalUrlsLoading}>
          <Table
            columns={[
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
            ]}
            dataSource={originalUrlsData}
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

      {/* Manual Add URL Modal - Phase 1: URL OR Operation */}
      <Modal
        title={
          <Space>
            <PlusOutlined />
            <span>URL 수동 추가</span>
            <Tooltip 
              title={
                <div>
                  여러 URL을 OR 연산으로 묶을 수 있습니다.<br/>
                  아래 URL 중 하나라도 일치하면 매핑됩니다.<br/><br/>
                  <strong>예:</strong> 상품 A, B, C를 "프리미엄 상품군"으로 통합
                </div>
              }
            >
              <InfoCircleOutlined style={{ color: '#1890FF', cursor: 'help' }} />
            </Tooltip>
          </Space>
        }
        open={manualAddModalVisible}
        onCancel={() => {
          setManualAddModalVisible(false);
          manualAddForm.resetFields();
          setUrlGroups([{ baseUrl: '', params: [{ key: '', value: '' }] }]);
        }}
        footer={null}
        width={800}
      >
        <Form
          form={manualAddForm}
          layout="vertical"
          onFinish={handleManualAddSubmit}
        >

          {urlGroups.map((group, groupIndex) => (
            <div key={groupIndex}>
              <Card 
                size="small" 
                style={{ 
                  marginBottom: 16, 
                  background: '#FFFFFF',
                  border: '1px solid #D9D9D9',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  borderRadius: 8
                }}
                title={
                  <Space>
                    <Text strong>URL 조건 {groupIndex + 1}</Text>
                    {urlGroups.length > 1 && (
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => handleRemoveUrlGroup(groupIndex)}
                      >
                        삭제
                      </Button>
                    )}
                  </Space>
                }
              >
                {/* Full URL Input with Auto-Parse */}
                <div style={{ 
                  marginBottom: 16, 
                  padding: 12, 
                  background: '#F0F2F5',
                  border: '1px dashed #D9D9D9',
                  borderRadius: 6
                }}>
                  <Space style={{ marginBottom: 4 }}>
                    <GlobalOutlined style={{ color: '#1890FF' }} />
                    <Text strong style={{ fontSize: '13px' }}>전체 URL</Text>
                    <Tooltip 
                      title={
                        <div>
                          쿼리 파라미터 포함 URL을 입력하면<br/>
                          자동으로 베이스 URL과 매개변수로 분리됩니다.<br/><br/>
                          <strong>예:</strong> https://example.com/product?no=1001<br/>
                          → 베이스: https://example.com/product<br/>
                          → 매개변수: no = 1001
                        </div>
                      }
                    >
                      <InfoCircleOutlined style={{ color: '#8C8C8C', cursor: 'help', fontSize: '12px' }} />
                    </Tooltip>
                  </Space>
                  <Input
                    placeholder="예: https://m.moadamda.com/product/detail?no=1001"
                    onChange={(e) => handleUrlInputChange(groupIndex, e.target.value)}
                  />
                </div>

                {/* Base URL */}
                <div style={{ 
                  marginBottom: 16, 
                  padding: 12, 
                  background: '#FAFAFA',
                  border: '1px solid #D9D9D9',
                  borderRadius: 6
                }}>
                  <Space style={{ marginBottom: 4 }}>
                    <LinkOutlined style={{ color: '#52C41A' }} />
                    <Text strong style={{ fontSize: '13px' }}>베이스 URL <span style={{ color: 'red' }}>*</span></Text>
                  </Space>
                  <Input
                    value={group.baseUrl}
                    onChange={(e) => handleUpdateBaseUrl(groupIndex, e.target.value)}
                    placeholder="예: https://m.moadamda.com/product/detail"
                  />
                </div>

                {/* Parameters */}
                <div style={{ 
                  padding: 16, 
                  background: '#E6F7FF',
                  border: '2px solid #91D5FF',
                  borderRadius: 6,
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)'
                }}>
                  <Space style={{ marginBottom: 12 }}>
                    <SettingOutlined style={{ color: '#1890FF' }} />
                    <Text strong style={{ fontSize: '13px' }}>매개변수</Text>
                    <Tooltip 
                      title={
                        <div>
                          모든 매개변수가 일치해야 합니다 (AND 연산)<br/><br/>
                          <strong>예:</strong> no=1001 AND color=black<br/>
                          → 두 조건 모두 만족하는 URL만 매핑
                        </div>
                      }
                    >
                      <InfoCircleOutlined style={{ color: '#595959', cursor: 'help', fontSize: '12px' }} />
                    </Tooltip>
                  </Space>
                  
                  {group.params.map((param, paramIndex) => (
                    <Space key={paramIndex} style={{ width: '100%', marginBottom: 8 }} align="start">
                      <Input
                        placeholder="키 (예: no)"
                        value={param.key}
                        onChange={(e) => handleUpdateParam(groupIndex, paramIndex, 'key', e.target.value)}
                        style={{ width: 150 }}
                      />
                      <Input
                        placeholder="값 (예: 1001)"
                        value={param.value}
                        onChange={(e) => handleUpdateParam(groupIndex, paramIndex, 'value', e.target.value)}
                        style={{ width: 150 }}
                      />
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<MinusCircleOutlined />}
                        onClick={() => handleRemoveParam(groupIndex, paramIndex)}
                        disabled={group.params.length === 1}
                      />
                    </Space>
                  ))}
                  
                  <Button
                    type="dashed"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => handleAddParam(groupIndex)}
                    block
                  >
                    매개변수 추가
                  </Button>
                </div>
              </Card>

              {groupIndex < urlGroups.length - 1 && (
                <div style={{ 
                  textAlign: 'center', 
                  margin: '20px 0',
                  padding: '12px',
                  background: 'linear-gradient(to right, #FF7A45, #FFA940)',
                  borderRadius: 8,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  <Text strong style={{ 
                    color: '#FFFFFF', 
                    fontSize: '14px',
                    letterSpacing: '2px'
                  }}>
                    OR 연산
                  </Text>
                </div>
              )}
            </div>
          ))}

          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={handleAddUrlGroup}
            block
            style={{ 
              marginBottom: 24,
              height: 40,
              fontSize: '14px',
              borderWidth: 2
            }}
          >
            URL 조건 추가
          </Button>

          <Divider style={{ margin: '24px 0' }} />

          {/* Korean Name */}
          <Form.Item
            name="korean_name"
            label={
              <Space>
                <Text strong>매핑명</Text>
                <span style={{ color: 'red' }}>*</span>
              </Space>
            }
            rules={[
              { required: true, message: '매핑명을 입력해주세요' },
              { whitespace: true, message: '공백만 입력할 수 없습니다' },
              { max: 255, message: '최대 255자까지 입력 가능합니다' }
            ]}
          >
            <Input 
              placeholder="예: 프리미엄 상품군"
              size="large"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space size="middle">
              <Button 
                size="large"
                onClick={() => {
                  setManualAddModalVisible(false);
                  manualAddForm.resetFields();
                  setUrlGroups([{ baseUrl: '', params: [{ key: '', value: '' }] }]);
                }}
              >
                취소
              </Button>
              <Button 
                type="primary" 
                size="large"
                htmlType="submit"
                loading={manualAddSubmitting}
                icon={<PlusOutlined />}
              >
                추가
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default PageMapping;

