import React, { useState, useEffect } from 'react';
import { Card, Tabs, Table, Button, Input, Space, Tag, message, Typography, Modal, Form, Spin, Statistic, Select, Divider, Tooltip, Dropdown, Popover } from 'antd';
import { ReloadOutlined, SearchOutlined, LinkOutlined, PlusOutlined, CloseOutlined, EyeOutlined, ClockCircleOutlined, BarChartOutlined, CheckCircleOutlined, CloseCircleOutlined, EditOutlined, RobotOutlined, MinusCircleOutlined, DeleteOutlined, InfoCircleOutlined, GlobalOutlined, SettingOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ko';
import { parseUrl, createUrlConditions } from '../utils/urlParser';
import { MappingModal, OriginalUrlsModal, ManualAddModal } from '../components/mappings';

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
  const [statusFilter, setStatusFilter] = useState('all'); // 기본값: 전체
  const [statistics, setStatistics] = useState({ total: 0, completed: 0, uncompleted: 0 });
  
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
      setStatistics(response.data.statistics || { total: 0, completed: 0, uncompleted: 0 });
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

  // Close manual add modal and reset
  const handleCloseManualAddModal = () => {
    setManualAddModalVisible(false);
    manualAddForm.resetFields();
    setUrlGroups([{ baseUrl: '', params: [{ key: '', value: '' }] }]);
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
      width: 180,
      render: (name) => name ? <Tag color="blue">{name}</Tag> : <Text type="secondary">-</Text>
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
            onClick: () => handleOpenOriginalUrlsModal(record.url, record.original_url)
          },
          {
            key: 'open-new-tab',
            icon: <LinkOutlined />,
            label: '새 탭으로 열기',
            onClick: () => handleOpenUrl(record.url, record.original_url)
          },
          {
            key: 'edit',
            icon: <EditOutlined />,
            label: record.is_mapped ? '수정' : '매핑하기',
            onClick: () => handleOpenMappingModal(record.url, record.original_url)
          },
          {
            type: 'divider'
          },
          {
            key: 'exclude',
            icon: <CloseOutlined />,
            label: '제외',
            danger: true,
            onClick: () => handleExcludeUrl(record.url, record.original_url)
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

  // Use statistics from backend (always reflects full data, not filtered)

  // Tab items
  const tabItems = [
    {
      key: 'all',
      label: (
        <span>
          📋 URL 매핑 관리
          {statistics.total > 0 && statusFilter === 'all' && (
            <span style={{ marginLeft: 8 }}>
              <Tag color="blue">{statistics.total}개</Tag>
              <Tag color="success" icon={<CheckCircleOutlined />}>{statistics.completed}</Tag>
              <Tag color="default" icon={<CloseCircleOutlined />}>{statistics.uncompleted}</Tag>
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
          {statistics.total > 0 && statusFilter === 'all' && (
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
                  <Tag color="blue" style={{ marginLeft: 8 }}>{statistics.total}개</Tag>
                </span>
                <span>
                  <Text type="secondary">완료</Text>
                  <Tag color="success" icon={<CheckCircleOutlined />} style={{ marginLeft: 8 }}>
                    {statistics.completed}개 ({statistics.total > 0 ? Math.round((statistics.completed / statistics.total) * 100) : 0}%)
                  </Tag>
                </span>
                <span>
                  <Text type="secondary">미완료</Text>
                  <Tag color="default" icon={<CloseCircleOutlined />} style={{ marginLeft: 8 }}>
                    {statistics.uncompleted}개 ({statistics.total > 0 ? Math.round((statistics.uncompleted / statistics.total) * 100) : 0}%)
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
      <MappingModal
        visible={mappingModalVisible}
        onClose={handleCloseMappingModal}
        onSubmit={handleSubmitMapping}
        url={mappingUrl}
        form={form}
        submitting={mappingSubmitting}
      />

      {/* Original URLs Modal */}
      <OriginalUrlsModal
        visible={originalUrlsModalVisible}
        onClose={handleCloseOriginalUrlsModal}
        cleanedUrl={currentCleanedUrl}
        data={originalUrlsData}
        loading={originalUrlsLoading}
        stats={originalUrlsStats}
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

