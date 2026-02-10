import { useState, useEffect, useRef } from 'react';
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
 * @param {Object} excludeValues - 특정 키에서 제외할 값 목록 { utm_source: ['viral'] }
 * @param {Array} syncedSources - 플랫폼 필터에서 동기화된 소스 배열 (연결 상태일 때)
 * @param {function} onSourceManualChange - 사용자가 UTM Source를 수동 변경했을 때 콜백
 * @param {boolean} platformLinked - 플랫폼 필터와 연결 상태
 */
function DynamicUtmFilterBar({ 
  tableName, 
  onFilterChange, 
  loading = false, 
  excludeValues = {},
  syncedSources = null,
  onSourceManualChange = null,
  platformLinked = true
}) {
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

  // 동기화에 의한 변경인지 추적 (무한 루프 방지)
  const isSyncUpdate = useRef(false);

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

  // 플랫폼 동기화: syncedSources 변경 시 utm_source 필터 자동 반영
  useEffect(() => {
    if (!platformLinked || syncedSources === null) return;

    isSyncUpdate.current = true;

    if (syncedSources.length === 0) {
      // "전체" 선택 → utm_source 필터 제거
      setActiveFilters(prev => prev.filter(f => f.key !== 'utm_source'));
    } else {
      setActiveFilters(prev => {
        const existing = prev.find(f => f.key === 'utm_source');
        if (existing) {
          // 기존 utm_source 필터 값 업데이트
          return prev.map(f => 
            f.key === 'utm_source' 
              ? { ...f, operator: 'in', value: syncedSources }
              : f
          );
        } else {
          // utm_source 필터 새로 추가
          return [...prev, {
            id: `utm_source_${Date.now()}`,
            key: 'utm_source',
            operator: 'in',
            value: syncedSources
          }];
        }
      });

      // utm_source 값 옵션이 없으면 로드
      if (!utmValueOptions['utm_source']) {
        fetchUtmValues('utm_source').then(values => {
          if (values.length > 0) {
            setUtmValueOptions(prev => ({ ...prev, utm_source: values }));
          }
        });
      }
    }

    // 다음 틱에서 플래그 리셋
    setTimeout(() => { isSyncUpdate.current = false; }, 0);
  }, [syncedSources, platformLinked]);

  // 사용 가능한 UTM 키 목록 조회
  const fetchAvailableUtmKeys = async () => {
    try {
      setKeysLoading(true);
      const response = await axios.get(`${API_URL}/api/stats/utm-keys`, {
        params: { table: tableName }
      });
      
      setAvailableUtmKeys(response.data.keys || []);
      setKeysLoading(false);
      setHasError(false);
    } catch (error) {
      console.error('[DynamicUtmFilterBar] UTM 키 목록 조회 실패:', error);
      console.error('[DynamicUtmFilterBar] 테이블:', tableName);
      setKeysLoading(false);
      setHasError(true);
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
      
      let values = response.data.values || [];
      
      // excludeValues에 해당 키가 있으면 제외 처리
      if (excludeValues[utmKey] && Array.isArray(excludeValues[utmKey])) {
        const excludeList = excludeValues[utmKey].map(v => v.toLowerCase());
        values = values.filter(v => !excludeList.includes(v.value?.toLowerCase()));
      }
      
      return values;
    } catch (error) {
      console.error(`[DynamicUtmFilterBar] UTM 값 조회 실패 (${utmKey}):`, error);
      return [];
    }
  };

  // 필터 추가 핸들러
  const handleAddFilter = async (utmKey) => {
    // 이미 추가된 필터인지 확인
    if (activeFilters.some(f => f.key === utmKey)) {
      return;
    }

    // 해당 UTM 키의 값 목록 로드
    const values = await fetchUtmValues(utmKey);

    if (values.length === 0) {
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
  };

  // 필터 값 변경 핸들러
  const handleFilterValueChange = (filterId, newValue) => {
    const filter = activeFilters.find(f => f.id === filterId);
    
    // utm_source 필터를 사용자가 수동 변경한 경우 → 연결 해제 알림
    if (filter?.key === 'utm_source' && !isSyncUpdate.current && onSourceManualChange) {
      onSourceManualChange(newValue);
    }

    setActiveFilters(prev => 
      prev.map(f => 
        f.id === filterId 
          ? { ...f, value: newValue }
          : f
      )
    );
  };

  // 필터 제거 핸들러
  const handleRemoveFilter = (filterId) => {
    const filter = activeFilters.find(f => f.id === filterId);
    
    // utm_source 필터를 사용자가 수동 제거한 경우 → 연결 해제 알림
    if (filter?.key === 'utm_source' && !isSyncUpdate.current && onSourceManualChange) {
      onSourceManualChange([]);
    }

    setActiveFilters(prev => prev.filter(f => f.id !== filterId));
  };

  // 모든 필터 초기화
  const handleClearAllFilters = () => {
    // utm_source 필터가 있었으면 연결 해제 알림
    const hadSourceFilter = activeFilters.some(f => f.key === 'utm_source');
    if (hadSourceFilter && !isSyncUpdate.current && onSourceManualChange) {
      onSourceManualChange([]);
    }
    setActiveFilters([]);
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
    return null;
  }

  // utm_source 필터인지 확인 (멀티셀렉트 렌더링 분기용)
  const isSourceFilter = (filter) => filter.key === 'utm_source';

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
                backgroundColor: isSourceFilter(filter) && platformLinked ? '#f0f5ff' : '#e6f7ff',
                border: isSourceFilter(filter) && platformLinked ? '1px solid #adc6ff' : '1px solid #91d5ff',
                color: '#0050b3'
              }}
            >
              {formatUtmKeyName(filter.key)}
              {isSourceFilter(filter) && platformLinked && (
                <span style={{ fontSize: '10px', marginLeft: '4px', color: '#597ef7' }}>🔗</span>
              )}
            </Button>
            {isSourceFilter(filter) ? (
              // utm_source: 멀티셀렉트
              <Select
                mode="multiple"
                value={Array.isArray(filter.value) ? filter.value : [filter.value]}
                onChange={(values) => handleFilterValueChange(filter.id, values)}
                style={{ minWidth: 200, maxWidth: 400 }}
                size="small"
                disabled={loading}
                showSearch
                optionFilterProp="label"
                maxTagCount={3}
                maxTagPlaceholder={(omittedValues) => `+${omittedValues.length}`}
                options={utmValueOptions[filter.key]?.map(v => ({
                  label: v.value,
                  value: v.value
                }))}
              />
            ) : (
              // 기타 UTM 필터: 단일 셀렉트 (기존 동작)
              <Select
                value={filter.value}
                onChange={(value) => handleFilterValueChange(filter.id, value)}
                style={{ width: 180 }}
                size="small"
                disabled={loading}
                showSearch
                optionFilterProp="label"
                options={utmValueOptions[filter.key]?.map(v => ({
                  label: v.value,
                  value: v.value
                }))}
              />
            )}
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
