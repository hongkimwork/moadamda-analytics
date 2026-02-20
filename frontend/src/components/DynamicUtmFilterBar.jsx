import { useState, useEffect, useRef } from 'react';
import { Button, Select, Dropdown } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { X } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * DynamicUtmFilterBar
 * 동적으로 UTM 필터를 추가/제거할 수 있는 컴포넌트 (노션 스타일)
 * UTM 필터의 메인 컨트롤 — 데이터 조회의 실제 필터 값은 이 컴포넌트가 관리
 * 
 * @param {string} tableName - 테이블 이름 (visitors, sessions, utm_sessions, conversions)
 * @param {function} onFilterChange - 필터 변경 콜백 (activeFilters 배열 전달)
 * @param {boolean} loading - 로딩 상태
 * @param {Object} excludeValues - 특정 키에서 제외할 값 목록 { utm_source: ['viral'] }
 * @param {Array} syncedSources - 플랫폼 퀵필터에서 전달된 소스 배열 (utm_source 값 업데이트용)
 * @param {function} onSourceManualChange - 사용자가 UTM Source를 직접 변경했을 때 콜백
 */
function DynamicUtmFilterBar({ 
  tableName, 
  onFilterChange, 
  loading = false, 
  excludeValues = {},
  syncedSources = null,
  onSourceManualChange = null
}) {
  const [availableUtmKeys, setAvailableUtmKeys] = useState([]);
  const [activeFilters, setActiveFilters] = useState([]);
  const [utmValueOptions, setUtmValueOptions] = useState({});
  const [keysLoading, setKeysLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  // 플랫폼 퀵필터에 의한 동기화 변경인지 추적 (무한 루프 방지)
  const isSyncUpdate = useRef(false);

  useEffect(() => {
    if (tableName) {
      fetchAvailableUtmKeys();
    }
  }, [tableName]);

  useEffect(() => {
    if (onFilterChange) {
      onFilterChange(activeFilters);
    }
  }, [activeFilters]);

  // 플랫폼 퀵필터 동기화: syncedSources 변경 시 utm_source 필터 업데이트
  useEffect(() => {
    if (syncedSources === null) return;

    isSyncUpdate.current = true;

    if (syncedSources.length === 0) {
      setActiveFilters(prev => prev.filter(f => f.key !== 'utm_source'));
    } else {
      setActiveFilters(prev => {
        const existing = prev.find(f => f.key === 'utm_source');

        // 값이 동일하면 불필요한 업데이트 방지
        if (existing) {
          const currentValues = Array.isArray(existing.value) ? existing.value : [existing.value];
          const isSame = currentValues.length === syncedSources.length &&
            currentValues.every(v => syncedSources.includes(v));
          if (isSame) return prev;

          return prev.map(f => 
            f.key === 'utm_source' 
              ? { ...f, operator: 'in', value: syncedSources }
              : f
          );
        } else {
          return [...prev, {
            id: `utm_source_${Date.now()}`,
            key: 'utm_source',
            operator: 'in',
            value: syncedSources
          }];
        }
      });

      if (!utmValueOptions['utm_source']) {
        fetchUtmValues('utm_source').then(values => {
          if (values.length > 0) {
            setUtmValueOptions(prev => ({ ...prev, utm_source: values }));
          }
        });
      }
    }

    setTimeout(() => { isSyncUpdate.current = false; }, 0);
  }, [syncedSources]);

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
      setKeysLoading(false);
      setHasError(true);
    }
  };

  const fetchUtmValues = async (utmKey) => {
    try {
      const response = await axios.get(`${API_URL}/api/stats/utm-values`, {
        params: { 
          key: utmKey,
          table: tableName 
        }
      });
      
      let values = response.data.values || [];
      
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

  const handleAddFilter = async (utmKey) => {
    if (activeFilters.some(f => f.key === utmKey)) {
      return;
    }

    const values = await fetchUtmValues(utmKey);

    if (values.length === 0) {
      return;
    }

    setUtmValueOptions(prev => ({
      ...prev,
      [utmKey]: values
    }));

    // utm_source는 복수 선택이므로 operator 'in' + 빈 배열로 시작
    const isMultiSelect = utmKey === 'utm_source';
    const newFilter = {
      id: `${utmKey}_${Date.now()}`,
      key: utmKey,
      operator: isMultiSelect ? 'in' : 'equals',
      value: isMultiSelect ? [] : (values[0]?.value || '')
    };

    setActiveFilters(prev => [...prev, newFilter]);
  };

  const handleFilterValueChange = (filterId, newValue) => {
    const filter = activeFilters.find(f => f.id === filterId);
    
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

  const handleRemoveFilter = (filterId) => {
    const filter = activeFilters.find(f => f.id === filterId);
    
    if (filter?.key === 'utm_source' && !isSyncUpdate.current && onSourceManualChange) {
      onSourceManualChange([]);
    }

    setActiveFilters(prev => prev.filter(f => f.id !== filterId));
  };

  const formatUtmKeyName = (key) => {
    return key.replace('utm_', '').replace(/_/g, ' ').toUpperCase();
  };

  const filterMenuItems = availableUtmKeys
    .filter(key => !activeFilters.some(f => f.key === key))
    .map(key => ({
      key: key,
      label: formatUtmKeyName(key),
      onClick: () => handleAddFilter(key)
    }));

  if (hasError) {
    return null;
  }

  const isSourceFilter = (filter) => filter.key === 'utm_source';

  const getChipStyle = () => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    height: '32px',
    padding: '0 12px',
    borderRadius: '16px',
    border: '1px solid #d9d9d9',
    background: '#fff',
    fontSize: '13px',
    fontWeight: 600,
    color: '#0958d9',
    whiteSpace: 'nowrap',
  });

  const getRemoveButtonStyle = () => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
    padding: 0,
    border: 'none',
    background: '#fce8e6',
    color: '#c5221f',
    cursor: 'pointer',
    borderRadius: '50%',
    transition: 'all 0.15s ease',
    flexShrink: 0,
  });

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
      {activeFilters.map(filter => (
        <div key={filter.id} style={getChipStyle()}>
          <span style={{ 
            fontSize: '12px', 
            fontWeight: 600, 
            color: '#0958d9',
            letterSpacing: '0.02em'
          }}>
            {formatUtmKeyName(filter.key)}
          </span>
          {isSourceFilter(filter) ? (
            <Select
              mode="multiple"
              value={Array.isArray(filter.value) ? filter.value : [filter.value]}
              onChange={(values) => handleFilterValueChange(filter.id, values)}
              style={{ minWidth: 160, maxWidth: 360 }}
              size="small"
              variant="borderless"
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
            <Select
              value={filter.value}
              onChange={(value) => handleFilterValueChange(filter.id, value)}
              style={{ width: 150 }}
              size="small"
              variant="borderless"
              disabled={loading}
              showSearch
              optionFilterProp="label"
              options={utmValueOptions[filter.key]?.map(v => ({
                label: v.value,
                value: v.value
              }))}
            />
          )}
          <button
            style={getRemoveButtonStyle()}
            onClick={() => handleRemoveFilter(filter.id)}
            disabled={loading}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f4c7c3'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#fce8e6'; }}
          >
            <X size={11} strokeWidth={2.5} />
          </button>
        </div>
      ))}

      {filterMenuItems.length > 0 && (
        <Dropdown
          menu={{ items: filterMenuItems }}
          trigger={['click']}
          disabled={loading || keysLoading}
        >
          <Button
            icon={<PlusOutlined />}
            loading={keysLoading}
            disabled={loading}
            style={{
              borderRadius: '16px',
              padding: '4px 12px',
              height: '32px',
              fontSize: '13px',
              fontWeight: 500,
              border: '1px dashed #d9d9d9',
              background: '#fafafa',
              color: '#666',
            }}
          >
            필터 추가
          </Button>
        </Dropdown>
      )}

      {availableUtmKeys.length === 0 && !keysLoading && (
        <span style={{ color: '#999', fontSize: '12px' }}>
          수집된 UTM 데이터가 없습니다
        </span>
      )}
    </div>
  );
}

export default DynamicUtmFilterBar;
