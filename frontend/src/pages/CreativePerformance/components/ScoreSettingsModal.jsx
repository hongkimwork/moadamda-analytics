// ============================================================================
// 모수 평가 기준 설정 모달 (3분할 레이아웃 + 프리셋 지원)
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Button, Slider, InputNumber, Alert, message, Tooltip, Collapse, Input } from 'antd';
import { 
  BarChart2, 
  TrendingUp, 
  Info, 
  Settings, 
  AlertCircle, 
  CheckCircle2, 
  Save, 
  RotateCcw,
  MousePointerClick,
  Eye,
  Clock,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  FolderOpen
} from 'lucide-react';
// Check, X는 프리셋 이름 수정 시 사용
import { 
  fetchAllPresets,
  fetchActivePreset,
  createAndApplyPreset,
  saveAndApplyPreset,
  updatePresetName,
  deletePreset,
  resetActivePreset
} from '../services/scoreSettingsApi';

const { Panel } = Collapse;

// 최대 구간 수 (그 외 나머지 제외)
const MAX_BOUNDARIES = 10;
// 최소 구간 수
const MIN_BOUNDARIES = 1;
// 최소/최대 선택 지표 수
const MIN_METRICS = 3;
const MAX_METRICS = 5;

// 지표 정의
const METRIC_DEFINITIONS = [
  { key: 'scroll', field: 'weight_scroll', configField: 'scroll_config', label: '평균 스크롤', icon: <MousePointerClick size={16} />, unit: 'px' },
  { key: 'pv', field: 'weight_pv', configField: 'pv_config', label: '평균 PV', icon: <Eye size={16} />, unit: '개' },
  { key: 'duration', field: 'weight_duration', configField: 'duration_config', label: '평균 체류시간', icon: <Clock size={16} />, unit: '초' },
  { key: 'view', field: 'weight_view', configField: 'view_config', label: 'View', icon: <BarChart2 size={16} />, unit: '회' },
  { key: 'uv', field: 'weight_uv', configField: 'uv_config', label: 'UV', icon: <TrendingUp size={16} />, unit: '명' }
];

// 기본 설정값
const DEFAULT_SETTINGS = {
  evaluation_type: 'absolute',
  weight_scroll: 30,
  weight_pv: 35,
  weight_duration: 35,
  weight_view: 0,
  weight_uv: 0,
  scroll_config: { boundaries: [3000, 1500, 500], scores: [100, 80, 50, 20] },
  pv_config: { boundaries: [5, 3, 2], scores: [100, 80, 50, 20] },
  duration_config: { boundaries: [120, 60, 30], scores: [100, 80, 50, 20] },
  view_config: { boundaries: [1000, 500, 100], scores: [100, 80, 50, 20] },
  uv_config: { boundaries: [500, 200, 50], scores: [100, 80, 50, 20] },
  enabled_metrics: ['scroll', 'pv', 'duration']
};

/**
 * 모수 평가 기준 설정 모달 (3분할)
 */
function ScoreSettingsModal({ visible, onClose, currentSettings, onSaveSuccess }) {
  // 프리셋 관련 상태
  const [presets, setPresets] = useState([]);
  const [selectedPresetId, setSelectedPresetId] = useState(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [editingNameId, setEditingNameId] = useState(null);
  const [editingName, setEditingName] = useState('');
  
  // 설정값 상태
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [errors, setErrors] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // 중앙/우측 활성화 상태
  const isEditorEnabled = selectedPresetId !== null || isCreatingNew;

  // 모달 열릴 때 프리셋 목록 로드
  useEffect(() => {
    if (visible) {
      loadPresets();
    }
  }, [visible]);

  // 프리셋 목록 로드
  const loadPresets = async () => {
    setLoading(true);
    try {
      const [presetsResult, activeResult] = await Promise.all([
        fetchAllPresets(),
        fetchActivePreset()
      ]);
      
      if (presetsResult.success) {
        setPresets(presetsResult.data || []);
      }
      
      // 적용 중인 프리셋이 있으면 자동 선택
      if (activeResult.success && activeResult.data) {
        setSelectedPresetId(activeResult.data.id);
        setSettings(activeResult.data);
        setIsCreatingNew(false);
      } else {
        // 프리셋이 없으면 초기 상태
        setSelectedPresetId(null);
        setSettings(DEFAULT_SETTINGS);
        setIsCreatingNew(false);
      }
    } catch (error) {
      message.error('프리셋 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
      setErrors([]);
      setWarnings([]);
    }
  };

  // 프리셋 선택 (불러오기)
  const handleSelectPreset = (preset) => {
    setSelectedPresetId(preset.id);
    setSettings(preset);
    setIsCreatingNew(false);
    setErrors([]);
    setWarnings([]);
  };

  // 새 프리셋 만들기 시작
  const handleStartNewPreset = () => {
    setIsCreatingNew(true);
    setNewPresetName('');
    setSelectedPresetId(null);
    setSettings(DEFAULT_SETTINGS);
    setErrors([]);
    setWarnings([]);
  };

  // 프리셋 이름 수정 시작
  const handleStartEditName = (preset) => {
    setEditingNameId(preset.id);
    setEditingName(preset.name);
  };

  // 프리셋 이름 수정 확정
  const handleConfirmEditName = async () => {
    if (!editingName.trim()) {
      message.warning('프리셋 이름을 입력해주세요.');
      return;
    }
    
    try {
      const result = await updatePresetName(editingNameId, editingName.trim());
      if (result.success) {
        message.success('프리셋 이름이 변경되었습니다.');
        loadPresets();
      } else {
        message.error(result.errors?.[0] || '이름 변경에 실패했습니다.');
      }
    } catch (error) {
      message.error('이름 변경 중 오류가 발생했습니다.');
    } finally {
      setEditingNameId(null);
      setEditingName('');
    }
  };

  // 프리셋 이름 수정 취소
  const handleCancelEditName = () => {
    setEditingNameId(null);
    setEditingName('');
  };

  // 프리셋 삭제
  const handleDeletePreset = async (presetId) => {
    Modal.confirm({
      title: '프리셋을 삭제하시겠습니까?',
      content: '삭제된 프리셋은 복구할 수 없습니다.',
      okText: '삭제',
      cancelText: '취소',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const result = await deletePreset(presetId);
          if (result.success) {
            message.success('프리셋이 삭제되었습니다.');
            if (selectedPresetId === presetId) {
              setSelectedPresetId(null);
              setSettings(DEFAULT_SETTINGS);
            }
            loadPresets();
          } else {
            message.error(result.errors?.[0] || '삭제에 실패했습니다.');
          }
        } catch (error) {
          message.error('삭제 중 오류가 발생했습니다.');
        }
      }
    });
  };

  // 지표 활성화/비활성화 토글
  const handleToggleMetric = (metricKey) => {
    const enabledMetrics = settings.enabled_metrics || ['scroll', 'pv', 'duration'];
    const isEnabled = enabledMetrics.includes(metricKey);
    
    if (isEnabled) {
      if (enabledMetrics.length <= MIN_METRICS) {
        message.warning(`최소 ${MIN_METRICS}개의 지표를 선택해야 합니다.`);
        return;
      }
      setSettings(prev => ({
        ...prev,
        enabled_metrics: enabledMetrics.filter(m => m !== metricKey)
      }));
    } else {
      if (enabledMetrics.length >= MAX_METRICS) {
        message.warning(`최대 ${MAX_METRICS}개의 지표만 선택할 수 있습니다.`);
        return;
      }
      const metricDef = METRIC_DEFINITIONS.find(m => m.key === metricKey);
      setSettings(prev => ({
        ...prev,
        enabled_metrics: [...enabledMetrics, metricKey],
        [metricDef.field]: 0
      }));
    }
    
    if (errors.length > 0) setErrors([]);
  };

  // 가중치 변경
  const handleWeightChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    if (errors.length > 0) setErrors([]);
  };

  // 구간 설정 변경
  const handleConfigChange = (configField, type, index, value) => {
    setSettings(prev => ({
      ...prev,
      [configField]: {
        ...prev[configField],
        [type]: prev[configField][type].map((v, i) => i === index ? value : v)
      }
    }));
    if (errors.length > 0) setErrors([]);
  };

  // 구간 추가
  const handleAddBoundary = (configField) => {
    setSettings(prev => {
      const config = prev[configField];
      const currentCount = config.boundaries.length;
      
      if (currentCount >= MAX_BOUNDARIES) {
        message.warning(`최대 ${MAX_BOUNDARIES}개까지만 추가할 수 있습니다.`);
        return prev;
      }

      const lastBoundary = config.boundaries[currentCount - 1];
      const newBoundary = Math.max(Math.floor(lastBoundary * 0.9), 1);
      const lastScore = config.scores[currentCount - 1];
      const remainderScore = config.scores[currentCount];
      const newScore = Math.max(lastScore - 10, remainderScore + 5);

      return {
        ...prev,
        [configField]: {
          boundaries: [...config.boundaries, newBoundary],
          scores: [...config.scores.slice(0, -1), newScore, remainderScore]
        }
      };
    });

    if (errors.length > 0) setErrors([]);
  };

  // 구간 삭제
  const handleRemoveBoundary = (configField, index) => {
    setSettings(prev => {
      const config = prev[configField];
      
      if (config.boundaries.length <= MIN_BOUNDARIES) {
        message.warning(`최소 ${MIN_BOUNDARIES}개의 구간은 유지해야 합니다.`);
        return prev;
      }

      const newBoundaries = config.boundaries.filter((_, i) => i !== index);
      const newScores = config.scores.filter((_, i) => i !== index);

      return {
        ...prev,
        [configField]: {
          boundaries: newBoundaries,
          scores: newScores
        }
      };
    });

    if (errors.length > 0) setErrors([]);
  };

  // 유효성 검사
  const validate = () => {
    const newErrors = [];
    const newWarnings = [];
    const enabledMetrics = settings.enabled_metrics || ['scroll', 'pv', 'duration'];

    if (enabledMetrics.length < MIN_METRICS) {
      newErrors.push(`최소 ${MIN_METRICS}개의 지표를 선택해야 합니다.`);
    }

    let weightSum = 0;
    enabledMetrics.forEach(metricKey => {
      const metricDef = METRIC_DEFINITIONS.find(m => m.key === metricKey);
      if (metricDef) {
        weightSum += (settings[metricDef.field] || 0);
      }
    });
    
    if (weightSum !== 100) {
      newErrors.push(`선택된 지표의 가중치 합계가 ${weightSum}%입니다. 100%가 되어야 합니다.`);
    }

    enabledMetrics.forEach(metricKey => {
      const metricDef = METRIC_DEFINITIONS.find(m => m.key === metricKey);
      if (!metricDef) return;

      const config = settings[metricDef.configField];
      const name = metricDef.label;
      
      if (!config || !config.boundaries || config.boundaries.length < MIN_BOUNDARIES) {
        newErrors.push(`${name}에 최소 ${MIN_BOUNDARIES}개의 구간이 필요합니다.`);
        return;
      }

      if (config.boundaries.length > MAX_BOUNDARIES) {
        newErrors.push(`${name}은 최대 ${MAX_BOUNDARIES}개 구간까지만 가능합니다.`);
        return;
      }

      if (config.scores.length !== config.boundaries.length + 1) {
        newErrors.push(`${name}의 점수 개수가 올바르지 않습니다.`);
        return;
      }
      
      for (let i = 0; i < config.boundaries.length - 1; i++) {
        if (config.boundaries[i] <= config.boundaries[i + 1]) {
          newErrors.push(`${name} 경계값은 순서대로 작아져야 합니다.`);
          break;
        }
      }

      for (let i = 0; i < config.scores.length - 1; i++) {
        if (config.scores[i] <= config.scores[i + 1]) {
          newErrors.push(`${name} 점수는 순서대로 작아져야 합니다.`);
          break;
        }
      }

      if (config.scores[0] !== 100) {
        newWarnings.push(`${name}의 최고 점수가 ${config.scores[0]}점입니다.`);
      }
    });

    setErrors(newErrors);
    setWarnings(newWarnings);
    return newErrors.length === 0;
  };

  // 선택된 지표의 가중치 합계 계산
  const getEnabledWeightSum = () => {
    const enabledMetrics = settings.enabled_metrics || ['scroll', 'pv', 'duration'];
    return enabledMetrics.reduce((sum, metricKey) => {
      const metricDef = METRIC_DEFINITIONS.find(m => m.key === metricKey);
      return sum + (metricDef ? (settings[metricDef.field] || 0) : 0);
    }, 0);
  };

  // 저장 및 적용
  const handleSaveAndApply = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      let result;
      
      if (isCreatingNew) {
        // 새 프리셋 생성 및 적용
        result = await createAndApplyPreset({
          ...settings,
          name: newPresetName.trim()
        });
      } else if (selectedPresetId) {
        // 기존 프리셋 저장 및 적용
        result = await saveAndApplyPreset(selectedPresetId, settings);
      } else {
        message.warning('프리셋을 선택하거나 새로 만들어주세요.');
        setSaving(false);
        return;
      }

      if (result.success) {
        message.success('설정이 저장 및 적용되었습니다.');
        if (result.warnings && result.warnings.length > 0) {
          result.warnings.forEach(w => message.warning(w));
        }
        onSaveSuccess(result.data);
        onClose();
      } else {
        setErrors(result.errors || ['저장에 실패했습니다.']);
      }
    } catch (error) {
      message.error('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 초기화
  const handleReset = async () => {
    Modal.confirm({
      title: '설정을 초기화하시겠습니까?',
      content: '현재 적용된 설정이 해제됩니다.',
      okText: '초기화',
      cancelText: '취소',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const result = await resetActivePreset();
          if (result.success) {
            message.success('설정이 초기화되었습니다.');
            onSaveSuccess(null);
            onClose();
          }
        } catch (error) {
          message.error('초기화 중 오류가 발생했습니다.');
        }
      }
    });
  };

  // 좌측: 프리셋 목록
  const renderPresetList = () => {
    const activePreset = presets.find(p => p.is_active);
    
    return (
      <div className="h-full flex flex-col border-r border-gray-200">
        <div className="p-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
            <FolderOpen size={16} className="text-blue-500" />
            프리셋
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3">
          {/* 새 프리셋 만들기 버튼 */}
          {!isCreatingNew ? (
            <button
              onClick={handleStartNewPreset}
              className="w-full mb-3 p-3 rounded-lg border-2 border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              <span className="text-sm font-medium">새 프리셋</span>
            </button>
          ) : (
            <div className="mb-3 p-3 rounded-lg border-2 border-blue-400 bg-blue-50">
              <Input
                placeholder="프리셋 이름 입력"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                autoFocus
              />
              <div className="text-xs text-blue-600 mt-2">
                설정 후 [저장 및 적용] 클릭
              </div>
            </div>
          )}
          
          {/* 프리셋 목록 */}
          {presets.length === 0 && !isCreatingNew ? (
            <div className="text-center text-gray-400 text-sm py-8">
              저장된 프리셋이 없습니다
            </div>
          ) : (
            <div className="space-y-2">
              {presets.map(preset => (
                <div
                  key={preset.id}
                  className={`
                    p-3 rounded-lg border cursor-pointer transition-all
                    ${selectedPresetId === preset.id && !isCreatingNew
                      ? 'border-blue-500 bg-blue-50 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}
                  `}
                  onClick={() => handleSelectPreset(preset)}
                >
                  <div className="flex items-center justify-between">
                    {editingNameId === preset.id ? (
                      <div className="flex-1 flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Input
                          size="small"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onPressEnter={handleConfirmEditName}
                          autoFocus
                          className="flex-1"
                        />
                        <Button size="small" type="text" icon={<Check size={12} />} onClick={handleConfirmEditName} />
                        <Button size="small" type="text" icon={<X size={12} />} onClick={handleCancelEditName} />
                      </div>
                    ) : (
                      <>
                        <div className="flex-1">
                          <div className="font-medium text-gray-800 text-sm">{preset.name}</div>
                          {preset.is_active && (
                            <div className="text-xs text-green-600 mt-1 flex items-center gap-1">
                              <CheckCircle2 size={10} />
                              적용 중
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button 
                            type="text" 
                            size="small" 
                            icon={<Edit3 size={12} />}
                            onClick={() => handleStartEditName(preset)}
                            className="text-gray-400 hover:text-blue-500"
                          />
                          <Button 
                            type="text" 
                            size="small" 
                            danger
                            icon={<Trash2 size={12} />}
                            onClick={() => handleDeletePreset(preset.id)}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // 중앙: 세부 점수 설정
  const renderEditor = () => {
    const enabledMetrics = settings.enabled_metrics || ['scroll', 'pv', 'duration'];
    const weightSum = getEnabledWeightSum();

    if (!isEditorEnabled) {
      return (
        <div className="h-full flex items-center justify-center bg-gray-50">
          <div className="text-center text-gray-400">
            <Settings size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">좌측에서 프리셋을 선택하거나</p>
            <p className="text-sm">새 프리셋을 만들어주세요</p>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full overflow-y-auto p-4">
        {/* 가중치 설정 */}
        <div className="mb-6 bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
          <div className="flex items-center mb-3">
            <div className="bg-blue-100 p-1.5 rounded-md mr-2">
              <Settings size={16} className="text-blue-600" />
            </div>
            <span className="text-sm font-bold text-gray-800">지표별 중요도 설정</span>
            <span className="ml-2 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">합계 100%</span>
          </div>
          
          <div className="mb-3 p-2 bg-blue-50 rounded-lg text-xs text-blue-700 flex items-start gap-2">
            <Info size={12} className="mt-0.5 flex-shrink-0" />
            <span>체크박스로 평가에 사용할 지표를 선택하세요. 최소 {MIN_METRICS}개, 최대 {MAX_METRICS}개</span>
          </div>
          
          <div className="flex flex-col gap-3">
            {METRIC_DEFINITIONS.map(({ key, field, label, icon }) => {
              const isEnabled = enabledMetrics.includes(key);
              return (
                <div 
                  key={field} 
                  className={`
                    flex items-center gap-4 p-3 rounded-xl border transition-all duration-200
                    ${isEnabled 
                      ? 'bg-white border-blue-200 shadow-sm' 
                      : 'bg-gray-50 border-transparent opacity-60 hover:opacity-100'}
                  `}
                >
                  <div className="flex items-center gap-3 min-w-[120px]">
                    <div className={`
                      w-8 h-8 rounded-lg flex items-center justify-center transition-colors
                      ${isEnabled ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-400'}
                    `}>
                      {icon}
                    </div>
                    <div className="flex flex-col">
                      <span className={`text-sm font-semibold ${isEnabled ? 'text-gray-800' : 'text-gray-500'}`}>
                        {label}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 flex items-center gap-4">
                    <Slider
                      className="flex-1"
                      min={0}
                      max={100}
                      value={settings[field] || 0}
                      onChange={(value) => handleWeightChange(field, value)}
                      disabled={!isEnabled}
                      trackStyle={{ backgroundColor: isEnabled ? '#3b82f6' : '#d1d5db' }}
                      handleStyle={{ 
                        borderColor: isEnabled ? '#3b82f6' : '#d1d5db',
                        boxShadow: 'none',
                        opacity: isEnabled ? 1 : 0
                      }}
                    />
                    <div className="w-20">
                      <InputNumber
                        className={`w-full ${isEnabled ? 'font-bold text-blue-600' : 'text-gray-400'}`}
                        size="middle"
                        min={0}
                        max={100}
                        value={settings[field] || 0}
                        onChange={(value) => handleWeightChange(field, value || 0)}
                        disabled={!isEnabled}
                        formatter={value => `${value}%`}
                        parser={value => value.replace('%', '')}
                        bordered={isEnabled}
                      />
                    </div>
                  </div>

                  <div className="pl-2 border-l border-gray-100">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => handleToggleMetric(key)}
                      className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer accent-blue-600"
                    />
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className={`mt-4 text-right text-xs font-medium flex justify-end items-center gap-2 ${weightSum === 100 ? 'text-green-600' : 'text-red-500'}`}>
            <span>선택된 지표 합계: {weightSum}%</span>
            {weightSum === 100 ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          </div>
        </div>

        {/* 구간 설정 */}
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
            <div className="flex items-center">
              <div className="bg-purple-100 p-1.5 rounded-md mr-2">
                <BarChart2 size={16} className="text-purple-600" />
              </div>
              <span className="text-sm font-bold text-gray-800">지표별 구간 상세 설정</span>
            </div>
          </div>

          <Collapse 
            defaultActiveKey={enabledMetrics.length > 0 ? [METRIC_DEFINITIONS.find(m => m.key === enabledMetrics[0])?.configField] : []} 
            ghost 
            className="bg-white"
          >
            {METRIC_DEFINITIONS
              .filter(m => enabledMetrics.includes(m.key))
              .map(({ key, configField, label, unit }) => (
                <Panel header={<span className="font-medium text-gray-700 text-sm">{label}</span>} key={configField}>
                  {renderConfigPanel(configField, unit)}
                </Panel>
              ))}
          </Collapse>
        </div>

        {/* 에러/경고 표시 */}
        {errors.length > 0 && (
          <Alert
            type="error"
            message="입력 값을 확인해주세요"
            description={
              <ul className="list-disc pl-5 m-0 text-xs">
                {errors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            }
            showIcon
            icon={<AlertCircle className="text-red-500" />}
            className="mt-4 border-red-100 bg-red-50"
          />
        )}
        {warnings.length > 0 && errors.length === 0 && (
          <Alert
            type="warning"
            message="주의"
            description={
              <ul className="list-disc pl-5 m-0 text-xs">
                {warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            }
            showIcon
            icon={<AlertCircle className="text-orange-500" />}
            className="mt-4 border-orange-100 bg-orange-50"
          />
        )}
      </div>
    );
  };

  // 구간 설정 패널
  const renderConfigPanel = (configField, unit) => {
    const config = settings[configField];
    const boundaryCount = config.boundaries.length;
    const canAdd = boundaryCount < MAX_BOUNDARIES;
    const canRemove = boundaryCount > MIN_BOUNDARIES;

    const getBadgeColor = (idx) => {
      const colors = ['bg-blue-600', 'bg-blue-500', 'bg-blue-400', 'bg-blue-300', 'bg-blue-200'];
      return colors[Math.min(idx, colors.length - 1)];
    };

    return (
      <div className="py-2 px-1">
        <div className="grid grid-cols-12 gap-3 mb-3 text-xs font-semibold text-gray-500 px-2">
          <div className="col-span-6 pl-1">구간 기준 ({unit})</div>
          <div className="col-span-4 text-center">부여 점수</div>
          <div className="col-span-2 text-center">관리</div>
        </div>
        
        <div className="space-y-2">
          {config.boundaries.map((boundary, idx) => (
            <div 
              key={idx} 
              className="grid grid-cols-12 gap-3 items-center p-2 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all group"
            >
              <div className="col-span-6 flex items-center gap-3">
                <div className={`
                  w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm
                  ${getBadgeColor(idx)}
                `}>
                  {idx + 1}
                </div>
                <div className="flex items-center bg-white border border-gray-200 rounded-md px-2 py-1 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-100 transition-all w-full max-w-[140px]">
                  <InputNumber 
                    size="small" 
                    className="w-full !border-none !shadow-none !bg-transparent [&_.ant-input-number-handler-wrap]:hidden text-right pr-1" 
                    min={1} 
                    value={boundary} 
                    onChange={(v) => handleConfigChange(configField, 'boundaries', idx, v)} 
                    controls={false}
                  />
                  <span className="text-xs text-gray-500 whitespace-nowrap bg-gray-50 px-1.5 py-0.5 rounded ml-1">{unit} 이상</span>
                </div>
              </div>
              
              <div className="col-span-4 flex items-center justify-center">
                <div className="flex items-center bg-white border border-gray-200 rounded-md px-2 py-1 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-100 transition-all w-[100px]">
                  <InputNumber 
                    size="small" 
                    className="w-full !border-none !shadow-none !bg-transparent [&_.ant-input-number-handler-wrap]:hidden text-right pr-1 font-bold text-gray-700" 
                    min={0} 
                    max={100} 
                    value={config.scores[idx]} 
                    onChange={(v) => handleConfigChange(configField, 'scores', idx, v)}
                    controls={false} 
                  />
                  <span className="text-xs text-gray-400 ml-1">점</span>
                </div>
              </div>
              
              <div className="col-span-2 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  type="text"
                  size="small"
                  danger
                  disabled={!canRemove}
                  icon={<Trash2 size={14} />}
                  onClick={() => handleRemoveBoundary(configField, idx)}
                  className="hover:bg-red-50 rounded-full w-8 h-8 flex items-center justify-center"
                />
              </div>
            </div>
          ))}
          
          {/* 그 외 나머지 */}
          <div className="grid grid-cols-12 gap-3 items-center mt-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <div className="col-span-6 flex items-center gap-3 pl-1">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-gray-200 text-gray-500">
                etc
              </div>
              <span className="text-sm font-medium text-gray-600">그 외 나머지 구간</span>
            </div>
            <div className="col-span-4 flex items-center justify-center">
              <div className="flex items-center bg-white border border-gray-200 rounded-md px-2 py-1 w-[100px]">
                <InputNumber 
                  size="small" 
                  className="w-full !border-none !shadow-none !bg-transparent [&_.ant-input-number-handler-wrap]:hidden text-right pr-1 font-bold text-gray-500" 
                  min={0} 
                  max={100} 
                  value={config.scores[boundaryCount]} 
                  onChange={(v) => handleConfigChange(configField, 'scores', boundaryCount, v)}
                  controls={false}
                />
                <span className="text-xs text-gray-400 ml-1">점</span>
              </div>
            </div>
            <div className="col-span-2"></div>
          </div>

          {/* 구간 추가 버튼 */}
          <div className="flex justify-center pt-4">
            <Button
              type="dashed"
              disabled={!canAdd}
              icon={<Plus size={14} />}
              onClick={() => handleAddBoundary(configField)}
              className={`
                w-full h-9 flex items-center justify-center gap-1 text-sm transition-all
                ${!canAdd ? 'opacity-50' : 'hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50'}
              `}
            >
              새로운 구간 추가하기 ({boundaryCount}/{MAX_BOUNDARIES})
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // 우측: 설정 요약
  const renderSummary = () => {
    const enabledMetrics = settings.enabled_metrics || ['scroll', 'pv', 'duration'];
    
    const metricColors = {
      scroll: 'bg-blue-100 text-blue-700',
      pv: 'bg-purple-100 text-purple-700',
      duration: 'bg-green-100 text-green-700',
      view: 'bg-orange-100 text-orange-700',
      uv: 'bg-teal-100 text-teal-700'
    };

    if (!isEditorEnabled) {
      return (
        <div className="h-full flex items-center justify-center bg-gray-50">
          <div className="text-center text-gray-400">
            <BarChart2 size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">설정 요약이</p>
            <p className="text-sm">여기에 표시됩니다</p>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full overflow-y-auto p-4 bg-gray-50">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">설정 요약</div>
        
        {/* 기본 정보 */}
        <div className="bg-white rounded-lg p-3 border border-gray-200 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-green-500" />
            <span className="text-sm font-bold text-gray-800">절대평가</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {METRIC_DEFINITIONS
              .filter(m => enabledMetrics.includes(m.key))
              .map(m => (
                <div key={m.key} className={`px-2 py-1 rounded text-xs font-medium ${metricColors[m.key]}`}>
                  {m.label} {settings[m.field] || 0}%
                </div>
              ))}
          </div>
        </div>

        {/* 구간별 점수 상세 */}
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">구간별 점수 상세</div>
        <div className="space-y-2">
          {METRIC_DEFINITIONS
            .filter(m => enabledMetrics.includes(m.key))
            .map(({ key, configField, label, icon, unit }) => {
              const config = settings[configField];
              const boundaryCount = config?.boundaries?.length || 0;
            
              const getRangeText = (index) => {
                if (!config || !config.boundaries) return '';
                if (index >= boundaryCount) {
                  return `${config.boundaries[boundaryCount - 1]}${unit} 미만`;
                }
                if (index === 0) return `${config.boundaries[0]}${unit} 이상`;
                return `${config.boundaries[index]} ~ ${config.boundaries[index - 1]} 미만`;
              };

              if (!config) return null;

              return (
                <div key={configField} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 px-3 py-2 border-b border-gray-100 font-bold text-gray-700 text-xs flex items-center gap-1">
                    {icon}
                    {label}
                    <span className="font-normal text-gray-400">({boundaryCount}개 구간)</span>
                  </div>
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-gray-50">
                      {[...Array(boundaryCount + 1)].map((_, idx) => (
                        <tr key={idx} className={idx === boundaryCount ? 'bg-gray-50' : ''}>
                          <td className="px-3 py-1.5 text-gray-600">
                            {idx === boundaryCount ? <span className="font-medium">그 외</span> : getRangeText(idx)}
                          </td>
                          <td className="px-3 py-1.5 text-right font-bold text-gray-800">
                            {config.scores[idx]}점
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
        </div>
      </div>
    );
  };

  // 푸터 버튼
  const renderFooter = () => {
    return (
      <div className="flex justify-between w-full">
        <Button danger icon={<RotateCcw size={14} />} onClick={handleReset} className="flex items-center gap-1">
          초기화
        </Button>
        <div className="flex gap-2">
          <Button onClick={onClose}>취소</Button>
          <Button 
            type="primary" 
            icon={<Save size={14} />} 
            onClick={handleSaveAndApply} 
            loading={saving}
            disabled={!isEditorEnabled}
            className="flex items-center gap-1 bg-blue-600"
          >
            저장 및 적용
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2 text-gray-800">
          <Settings className="text-blue-600" size={20} />
          <span>모수 평가 기준 설정</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      width="95vw"
      footer={renderFooter()}
      destroyOnClose
      centered
      className="score-settings-modal-v2"
      styles={{
        body: {
          height: 'calc(90vh - 120px)',
          maxHeight: '800px',
          padding: 0,
          overflow: 'hidden',
        }
      }}
    >
      <div className="flex h-full">
        {/* 좌측: 프리셋 목록 (20%) */}
        <div className="w-1/5 min-w-[200px] max-w-[280px]">
          {renderPresetList()}
        </div>
        
        {/* 중앙: 세부 설정 (50%) */}
        <div className="flex-1 border-r border-gray-200">
          {renderEditor()}
        </div>
        
        {/* 우측: 설정 요약 (30%) */}
        <div className="w-[30%] min-w-[250px] max-w-[400px]">
          {renderSummary()}
        </div>
      </div>
    </Modal>
  );
}

export default ScoreSettingsModal;
