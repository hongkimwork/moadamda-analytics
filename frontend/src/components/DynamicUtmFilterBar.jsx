import React, { useState, useEffect } from 'react';
import { Button, Select, Space, Tag, Dropdown } from 'antd';
import { PlusOutlined, CloseOutlined, FilterOutlined } from '@ant-design/icons';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * DynamicUtmFilterBar
 * 동적으로 UTM 필터를 추가/제거할 수 있는 컴포넌트 (노션 스타일)
 * 
 * @param {string} tableName - 테이블 이름 (visitors, sessions, utm_sessions, conversions)
 * @param {function} onFilterChange - 필터 변경 콜백 (activeFilters 배열 전달)
 * @param {boolean} loading - 로딩 상태
 */
function DynamicUtmFilterBar({ tableName, onFilterChange, loading = false }) {
  // 사용 가능한 UTM 키 목록
  const [availableUtmKeys, setAvailableUtmKeys] = useState([]);
  
  // 활성화된 필터 목록
  const [activeFilters, setActiveFilters] = useState([]);
  
  // 각 UTM 키의 값 옵션 캐시
  const [utmValueOptions, setUtmValueOptions] = useState({});
  
  // 로딩 상태
  const [keysLoading, setKeysLoading] = useState(false);
  
  // 에러 상태 (에러 발생 시 컴포넌트 숨김)
  const [hasError, setHasError] = useState(false);

  // 컴포넌트 마운트 시 사용 가능한 UTM 키 로드
  useEffect(() => {
    if (tableName) {
      fetchAvailableUtmKeys();
    }
  }, [tableName]);

  // 필터 변경 시 부모 컴포넌트에 알림
  useEffect(() => {
    if (onFilterChange) {
      onFilterChange(activeFilters);
    }
  }, [activeFilters]);

  // 사용 가능한 UTM 키 목록 조회
  const fetchAvailableUtmKeys = async () => {
    try {
      setKeysLoading(true);
      const response = await axios.get(`${API_URL}/api/stats/utm-keys`, {
        params: { table: tableName }
      });
      
      setAvailableUtmKeys(response.data.keys || []);
      setKeysLoading(false);
      setHasError(false); // 성공 시 에러 상태 리셋
    } catch (error) {
      // 에러 발생 시 조용히 실패 처리 (알람 표시 X)
      console.error('[DynamicUtmFilterBar] UTM 키 목록 조회 실패:', error);
      console.error('[DynamicUtmFilterBar] 테이블:', tableName);
      setKeysLoading(false);
      setHasError(true); // 에러 상태 설정 → 컴포넌트 숨김
    }
  };

  // 특정 UTM 키의 값 목록 조회
  const fetchUtmValues = async (utmKey) => {
    try {
      const response = await axios.get(`${API_URL}/api/stats/utm-values`, {
        params: { 
          key: utmKey,
          table: tableName 
        }
      });
      
      return response.data.values || [];
    } catch (error) {
      // 에러 발생 시 조용히 실패 처리 (알람 표시 X)
      console.error(`[DynamicUtmFilterBar] UTM 값 조회 실패 (${utmKey}):`, error);
      return [];
    }
  };

  // 필터 추가 핸들러
  const handleAddFilter = async (utmKey) => {
    // 이미 추가된 필터인지 확인
    if (activeFilters.some(f => f.key === utmKey)) {
      console.log('[DynamicUtmFilterBar] 이미 추가된 필터:', utmKey);
      return;
    }

    // 해당 UTM 키의 값 목록 로드
    const values = await fetchUtmValues(utmKey);
    
    if (values.length === 0) {
      console.log('[DynamicUtmFilterBar] 데이터 없음:', utmKey);
      return;
    }

    // 값 옵션 캐시에 저장
    setUtmValueOptions(prev => ({
      ...prev,
      [utmKey]: values
    }));

    // 필터 추가
    const newFilter = {
      id: `${utmKey}_${Date.now()}`,
      key: utmKey,
      operator: 'equals',
      value: values[0]?.value || ''
    };

    setActiveFilters(prev => [...prev, newFilter]);
    console.log('[DynamicUtmFilterBar] 필터 추가됨:', utmKey);
  };

  // 필터 값 변경 핸들러
  const handleFilterValueChange = (filterId, newValue) => {
    setActiveFilters(prev => 
      prev.map(filter => 
        filter.id === filterId 
          ? { ...filter, value: newValue }
          : filter
      )
    );
  };

  // 필터 제거 핸들러
  const handleRemoveFilter = (filterId) => {
    setActiveFilters(prev => prev.filter(f => f.id !== filterId));
    console.log('[DynamicUtmFilterBar] 필터 제거됨:', filterId);
  };

  // 모든 필터 초기화
  const handleClearAllFilters = () => {
    setActiveFilters([]);
    console.log('[DynamicUtmFilterBar] 모든 필터 초기화됨');
  };

  // UTM 키 이름 포맷팅 (utm_source -> Source)
  const formatUtmKeyName = (key) => {
    return key.replace('utm_', '').replace(/_/g, ' ').toUpperCase();
  };

  // 필터 추가 드롭다운 메뉴 아이템
  const filterMenuItems = availableUtmKeys
    .filter(key => !activeFilters.some(f => f.key === key))  // 이미 추가된 필터 제외
    .map(key => ({
      key: key,
      label: formatUtmKeyName(key),
      onClick: () => handleAddFilter(key)
    }));

  // 에러 발생 시 컴포넌트 숨김 (silent fail)
  if (hasError) {
    console.log('[DynamicUtmFilterBar] 컴포넌트 숨김 (에러 발생)');
    return null;
  }

  return (
    <div style={{ marginBottom: '16px' }}>
      <Space wrap size="small">
        <FilterOutlined style={{ 
          color: activeFilters.length > 0 ? '#1890ff' : '#999', 
          fontSize: '16px' 
        }} />

        {/* 활성화된 필터 렌더링 */}
        {activeFilters.map(filter => (
          <Space.Compact key={filter.id} size="small">
            <Button 
              size="small" 
              style={{ 
                pointerEvents: 'none', 
                backgroundColor: '#e6f7ff', 
                border: '1px solid #91d5ff',
                color: '#0050b3'
              }}
            >
              {formatUtmKeyName(filter.key)}
            </Button>
            <Select
              value={filter.value}
              onChange={(value) => handleFilterValueChange(filter.id, value)}
              style={{ width: 180 }}
              size="small"
              disabled={loading}
              showSearch
              optionFilterProp="label"
              options={utmValueOptions[filter.key]?.map(v => ({
                label: `${v.value} (${v.count})`,
                value: v.value
              }))}
            />
            <Button 
              size="small" 
              danger 
              icon={<CloseOutlined />}
              onClick={() => handleRemoveFilter(filter.id)}
              disabled={loading}
            />
          </Space.Compact>
        ))}

        {/* 필터 추가 버튼 */}
        {filterMenuItems.length > 0 && (
          <Dropdown
            menu={{ items: filterMenuItems }}
            trigger={['click']}
            disabled={loading || keysLoading}
          >
            <Button 
              icon={<PlusOutlined />} 
              size="small"
              type="dashed"
              loading={keysLoading}
            >
              필터 추가
            </Button>
          </Dropdown>
        )}

        {/* 필터 활성화 상태 표시 */}
        {activeFilters.length > 0 && (
          <>
            <Tag color="blue">
              {activeFilters.length}개 필터 적용 중
            </Tag>
            <Button 
              size="small" 
              onClick={handleClearAllFilters}
              disabled={loading}
            >
              전체 초기화
            </Button>
          </>
        )}

        {/* 사용 가능한 필터가 없을 때 */}
        {availableUtmKeys.length === 0 && !keysLoading && (
          <span style={{ color: '#999', fontSize: '12px' }}>
            수집된 UTM 데이터가 없습니다
          </span>
        )}
      </Space>
    </div>
  );
}

export default DynamicUtmFilterBar;

