import React, { useState, useEffect } from 'react';
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
 * 
 * @param {function} onFilterChange - 필터 변경 콜백 (선택된 소스 배열 전달)
 * @param {boolean} loading - 로딩 상태
 */
function UtmSourceQuickFilter({ onFilterChange, loading = false, initialSources = null }) {
  // initialSources에서 선택된 그룹 계산
  const getGroupsFromSources = (sources) => {
    if (!sources || sources.length === 0) {
      return ['all']; // 빈 배열이면 전체 선택
    }
    // 각 그룹별로 소스가 포함되어 있는지 확인
    const groups = [];
    SOURCE_GROUPS.forEach(group => {
      if (group.key === 'all') return;
      const hasAllSources = group.sources.every(s => sources.includes(s));
      if (hasAllSources && group.sources.length > 0) {
        groups.push(group.key);
      }
    });
    return groups.length > 0 ? groups : ['meta']; // 매칭되는 그룹이 없으면 메타 기본값
  };
  
  // 선택된 그룹 키 목록 (기본값: 메타)
  const [selectedGroups, setSelectedGroups] = useState(['meta']);
  
  // 초기화 여부 추적 (최초 마운트 시에만 initialSources 적용)
  const [isInitialized, setIsInitialized] = useState(false);
  
  // initialSources가 전달되면 selectedGroups 업데이트 (최초 1회만)
  useEffect(() => {
    if (!isInitialized && initialSources !== null) {
      const groups = getGroupsFromSources(initialSources);
      setSelectedGroups(groups);
      setIsInitialized(true);
    }
  }, [initialSources, isInitialized]);
  
  // 사용자가 추가한 개별 소스 버튼
  const [customSources, setCustomSources] = useState([]);
  
  // 선택된 커스텀 소스
  const [selectedCustomSources, setSelectedCustomSources] = useState([]);
  
  // 드롭다운에 표시할 미등록 소스 목록
  const [ungroupedSources, setUngroupedSources] = useState([]);
  
  // 호버 중인 커스텀 버튼
  const [hoveredCustom, setHoveredCustom] = useState(null);

  // 컴포넌트 마운트 시 미등록 소스 조회
  useEffect(() => {
    fetchUngroupedSources();
  }, []);

  // 선택 상태 변경 시 부모에게 알림 (초기화 완료 후에만)
  useEffect(() => {
    // 초기화 전에는 부모에게 알리지 않음 (저장된 값을 덮어쓰지 않도록)
    if (!isInitialized) return;
    
    if (onFilterChange) {
      const sources = getSelectedSources();
      onFilterChange(sources);
    }
  }, [selectedGroups, selectedCustomSources, isInitialized]);

  // 미등록 소스 조회 (그룹에 속하지 않은 소스만)
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

  // 선택된 소스 목록 계산
  const getSelectedSources = () => {
    // "전체" 선택 시 빈 배열 반환 (필터 없음)
    if (selectedGroups.includes('all')) {
      return [];
    }

    const sources = new Set();
    
    // 선택된 그룹의 소스 추가
    selectedGroups.forEach(groupKey => {
      const group = SOURCE_GROUPS.find(g => g.key === groupKey);
      if (group) {
        group.sources.forEach(s => sources.add(s));
      }
    });
    
    // 선택된 커스텀 소스 추가
    selectedCustomSources.forEach(s => sources.add(s));
    
    return Array.from(sources);
  };

  // 그룹 버튼 클릭 핸들러
  const handleGroupClick = (groupKey) => {
    if (groupKey === 'all') {
      // "전체" 클릭: 모든 선택 초기화
      setSelectedGroups(['all']);
      setSelectedCustomSources([]);
    } else {
      setSelectedGroups(prev => {
        // "전체"가 선택되어 있으면 해제
        let newSelection = prev.filter(k => k !== 'all');
        
        if (newSelection.includes(groupKey)) {
          // 이미 선택됨 → 해제
          newSelection = newSelection.filter(k => k !== groupKey);
        } else {
          // 선택 추가
          newSelection = [...newSelection, groupKey];
        }
        
        // 아무것도 선택 안 됐으면 "전체"로 복귀
        if (newSelection.length === 0 && selectedCustomSources.length === 0) {
          return ['all'];
        }
        
        return newSelection;
      });
    }
  };

  // 커스텀 소스 버튼 클릭 핸들러
  const handleCustomSourceClick = (source) => {
    setSelectedCustomSources(prev => {
      if (prev.includes(source)) {
        // 이미 선택됨 → 해제
        const newSelection = prev.filter(s => s !== source);
        
        // 아무것도 선택 안 됐으면 "전체"로 복귀
        if (newSelection.length === 0 && selectedGroups.filter(k => k !== 'all').length === 0) {
          setSelectedGroups(['all']);
        }
        
        return newSelection;
      } else {
        // 선택 추가, "전체" 해제
        setSelectedGroups(prev => prev.filter(k => k !== 'all'));
        return [...prev, source];
      }
    });
  };

  // 커스텀 소스 추가 (드롭다운 선택 시)
  const handleAddCustomSource = (source) => {
    if (!customSources.includes(source)) {
      setCustomSources(prev => [...prev, source]);
      setUngroupedSources(prev => prev.filter(s => s !== source));
      // 추가 시 자동 선택
      setSelectedCustomSources(prev => [...prev, source]);
      setSelectedGroups(prev => prev.filter(k => k !== 'all'));
    }
  };

  // 커스텀 소스 제거
  const handleRemoveCustomSource = (source, e) => {
    e.stopPropagation(); // 버튼 클릭 이벤트 방지
    
    setCustomSources(prev => prev.filter(s => s !== source));
    setSelectedCustomSources(prev => prev.filter(s => s !== source));
    setUngroupedSources(prev => [...prev, source]);
    
    // 아무것도 선택 안 됐으면 "전체"로 복귀
    if (selectedGroups.filter(k => k !== 'all').length === 0 && 
        selectedCustomSources.filter(s => s !== source).length === 0) {
      setSelectedGroups(['all']);
    }
  };

  // 드롭다운 메뉴 아이템
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

  // 버튼 스타일 (선택 여부에 따라)
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
      {/* 기본 그룹 버튼 */}
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

      {/* 커스텀 소스 버튼 */}
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
          {/* 호버 시 X 버튼 표시 */}
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

      {/* 추가 버튼 (드롭다운) */}
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

