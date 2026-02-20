import React, { useState, useEffect, useRef } from 'react';
import { Button, Dropdown, Space } from 'antd';
import { PlusOutlined, CloseCircleFilled } from '@ant-design/icons';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

// 기본 그룹 정의 (고정, 제거 불가)
const SOURCE_GROUPS = [
  { key: 'all', label: '전체', sources: [] }, // 전체는 모든 그룹 선택
  { key: 'kakao', label: '카카오', sources: ['kakao', 'kakaotalk', 'kakaochannel'] },
  { key: 'meta', label: '메타', sources: ['meta', 'instagram', 'ig'] },
  { key: 'google', label: '구글', sources: ['google', 'youtube'] },
  { key: 'naver', label: '네이버', sources: ['naver'] },
  { key: 'tiktok', label: '틱톡', sources: ['tiktok'] },
  { key: 'ownmall', label: '자사몰', sources: ['ownmall'] },
];

// 그룹에 속한 모든 소스 목록
const ALL_GROUPED_SOURCES = SOURCE_GROUPS
  .filter(g => g.key !== 'all')
  .flatMap(g => g.sources);

// 제외할 소스 목록 (utm_content가 없어서 광고 소재 분석에서 데이터 없음)
const EXCLUDED_SOURCES = ['viral'];

/**
 * UtmSourceQuickFilter
 * UTM Source 퀵 필터 버튼 컴포넌트
 * UTM 필터의 보조 역할 — 버튼으로 소스를 빠르게 선택하는 도우미
 * 
 * @param {function} onFilterChange - 버튼 클릭 시 콜백 (선택된 소스 배열 전달)
 * @param {boolean} loading - 로딩 상태
 * @param {Array|null} currentSources - 현재 UTM 필터의 source 값 (실시간 동기화용)
 */
function UtmSourceQuickFilter({ onFilterChange, loading = false, currentSources = null }) {
  // 외부 동기화에 의한 업데이트인지 추적 (onFilterChange 중복 호출 방지)
  const isExternalSync = useRef(false);
  const isInitialized = useRef(false);

  // 소스 배열에서 해당하는 그룹 키 목록 계산
  const getGroupsFromSources = (sources) => {
    if (!sources || sources.length === 0) {
      return ['all'];
    }
    const groups = [];
    SOURCE_GROUPS.forEach(group => {
      if (group.key === 'all') return;
      if (group.sources.every(s => sources.includes(s)) && group.sources.length > 0) {
        groups.push(group.key);
      }
    });
    return groups;
  };
  
  const [selectedGroups, setSelectedGroups] = useState(['meta']);
  const [customSources, setCustomSources] = useState([]);
  const [selectedCustomSources, setSelectedCustomSources] = useState([]);
  const [ungroupedSources, setUngroupedSources] = useState([]);
  const [hoveredCustom, setHoveredCustom] = useState(null);

  useEffect(() => {
    fetchUngroupedSources();
  }, []);

  // currentSources 변경 시 버튼 시각 상태 동기화
  useEffect(() => {
    if (currentSources === null) return;

    isExternalSync.current = true;

    if (currentSources.length === 0) {
      setSelectedGroups(['all']);
      setSelectedCustomSources([]);
    } else {
      const groups = getGroupsFromSources(currentSources);

      // 그룹에 속하지 않는 소스 → 커스텀 소스로 표시
      const groupedSourceSet = new Set();
      groups.forEach(key => {
        const group = SOURCE_GROUPS.find(g => g.key === key);
        if (group) group.sources.forEach(s => groupedSourceSet.add(s));
      });
      const customOnly = currentSources.filter(s =>
        !groupedSourceSet.has(s) && !ALL_GROUPED_SOURCES.includes(s)
      );

      if (groups.length === 0 && customOnly.length === 0) {
        setSelectedGroups(['all']);
      } else {
        setSelectedGroups(groups.length > 0 ? groups : []);
      }

      // 커스텀 소스가 목록에 없으면 추가
      customOnly.forEach(s => {
        setCustomSources(prev => prev.includes(s) ? prev : [...prev, s]);
      });
      setSelectedCustomSources(customOnly);
    }

    isInitialized.current = true;
    setTimeout(() => { isExternalSync.current = false; }, 0);
  }, [currentSources]);

  // 버튼 클릭에 의한 변경만 부모에게 알림 (외부 동기화 시에는 무시)
  useEffect(() => {
    if (!isInitialized.current) return;
    if (isExternalSync.current) return;
    
    if (onFilterChange) {
      const sources = getSelectedSources();
      onFilterChange(sources);
    }
  }, [selectedGroups, selectedCustomSources]);

  const fetchUngroupedSources = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/stats/utm-values`, {
        params: { key: 'utm_source', table: 'utm_sessions' }
      });
      
      const allSources = response.data.values || [];
      const ungrouped = allSources
        .map(v => v.value)
        .filter(source => 
          source && 
          !ALL_GROUPED_SOURCES.includes(source.toLowerCase()) &&
          !EXCLUDED_SOURCES.includes(source.toLowerCase()) &&
          !customSources.includes(source)
        );
      
      setUngroupedSources(ungrouped);
    } catch (error) {
      console.error('[UtmSourceQuickFilter] 미등록 소스 조회 실패:', error);
    }
  };

  const getSelectedSources = () => {
    if (selectedGroups.includes('all')) {
      return [];
    }

    const sources = new Set();
    
    selectedGroups.forEach(groupKey => {
      const group = SOURCE_GROUPS.find(g => g.key === groupKey);
      if (group) {
        group.sources.forEach(s => sources.add(s));
      }
    });
    
    selectedCustomSources.forEach(s => sources.add(s));
    
    return Array.from(sources);
  };

  const handleGroupClick = (groupKey) => {
    if (groupKey === 'all') {
      setSelectedGroups(['all']);
      setSelectedCustomSources([]);
    } else {
      setSelectedGroups(prev => {
        let newSelection = prev.filter(k => k !== 'all');
        
        if (newSelection.includes(groupKey)) {
          newSelection = newSelection.filter(k => k !== groupKey);
        } else {
          newSelection = [...newSelection, groupKey];
        }
        
        if (newSelection.length === 0 && selectedCustomSources.length === 0) {
          return ['all'];
        }
        
        return newSelection;
      });
    }
  };

  const handleCustomSourceClick = (source) => {
    setSelectedCustomSources(prev => {
      if (prev.includes(source)) {
        const newSelection = prev.filter(s => s !== source);
        
        if (newSelection.length === 0 && selectedGroups.filter(k => k !== 'all').length === 0) {
          setSelectedGroups(['all']);
        }
        
        return newSelection;
      } else {
        setSelectedGroups(prev => prev.filter(k => k !== 'all'));
        return [...prev, source];
      }
    });
  };

  const handleAddCustomSource = (source) => {
    if (!customSources.includes(source)) {
      setCustomSources(prev => [...prev, source]);
      setUngroupedSources(prev => prev.filter(s => s !== source));
      setSelectedCustomSources(prev => [...prev, source]);
      setSelectedGroups(prev => prev.filter(k => k !== 'all'));
    }
  };

  const handleRemoveCustomSource = (source, e) => {
    e.stopPropagation();
    
    setCustomSources(prev => prev.filter(s => s !== source));
    setSelectedCustomSources(prev => prev.filter(s => s !== source));
    setUngroupedSources(prev => [...prev, source]);
    
    if (selectedGroups.filter(k => k !== 'all').length === 0 && 
        selectedCustomSources.filter(s => s !== source).length === 0) {
      setSelectedGroups(['all']);
    }
  };

  const dropdownItems = ungroupedSources.length > 0
    ? ungroupedSources.map(source => ({
        key: source,
        label: source,
        onClick: () => handleAddCustomSource(source)
      }))
    : [{
        key: 'empty',
        label: '추가할 소스가 없습니다',
        disabled: true,
        style: { color: '#999', fontStyle: 'italic' }
      }];

  const getButtonStyle = (isSelected, isCustom = false) => ({
    borderRadius: '16px',
    padding: '4px 14px',
    height: '32px',
    fontSize: '13px',
    fontWeight: isSelected ? 600 : 500,
    border: isSelected ? '1px solid #1890ff' : '1px solid #d9d9d9',
    background: isSelected ? '#e6f4ff' : '#fff',
    color: isSelected ? '#0958d9' : '#374151',
    transition: 'all 0.2s ease',
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  });

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
      {SOURCE_GROUPS.map(group => (
        <Button
          key={group.key}
          style={getButtonStyle(
            group.key === 'all' 
              ? selectedGroups.includes('all') 
              : selectedGroups.includes(group.key)
          )}
          onClick={() => handleGroupClick(group.key)}
          disabled={loading}
        >
          {group.label}
        </Button>
      ))}

      {customSources.map(source => (
        <div
          key={source}
          style={{ position: 'relative', display: 'inline-flex' }}
          onMouseEnter={() => setHoveredCustom(source)}
          onMouseLeave={() => setHoveredCustom(null)}
        >
          <Button
            style={getButtonStyle(selectedCustomSources.includes(source), true)}
            onClick={() => handleCustomSourceClick(source)}
            disabled={loading}
          >
            {source}
          </Button>
          {hoveredCustom === source && (
            <CloseCircleFilled
              onClick={(e) => handleRemoveCustomSource(source, e)}
              style={{
                position: 'absolute',
                top: '-6px',
                right: '-6px',
                fontSize: '16px',
                color: '#ff4d4f',
                background: '#fff',
                borderRadius: '50%',
                cursor: 'pointer',
                zIndex: 10,
                transition: 'transform 0.2s ease',
              }}
              onMouseEnter={(e) => e.target.style.transform = 'scale(1.1)'}
              onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
            />
          )}
        </div>
      ))}

      <Dropdown
        menu={{ items: dropdownItems }}
        trigger={['click']}
        disabled={loading}
      >
        <Button
          icon={<PlusOutlined />}
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
          disabled={loading}
        >
          추가
        </Button>
      </Dropdown>
    </div>
  );
}

export default UtmSourceQuickFilter;
