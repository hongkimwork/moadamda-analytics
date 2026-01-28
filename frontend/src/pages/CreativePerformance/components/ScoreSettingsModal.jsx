// ============================================================================
// 모수 평가 기준 설정 모달
// ============================================================================

import React, { useState, useEffect } from 'react';
import { Modal, Steps, Button, Slider, InputNumber, Alert, message, Tooltip, Collapse } from 'antd';
import { 
  BarChart2, 
  TrendingUp, 
  Info, 
  Settings, 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  Save, 
  RotateCcw,
  MousePointerClick,
  Eye,
  Clock,
  Plus,
  Trash2
} from 'lucide-react';
import { saveScoreSettings, deleteScoreSettings } from '../services/scoreSettingsApi';

const { Step } = Steps;
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
  { key: 'scroll', field: 'weight_scroll', configField: 'scroll_config', label: '평균 스크롤', icon: <MousePointerClick size={16} />, unit: { relative: '%', absolute: 'px' } },
  { key: 'pv', field: 'weight_pv', configField: 'pv_config', label: '평균 PV', icon: <Eye size={16} />, unit: { relative: '%', absolute: '개' } },
  { key: 'duration', field: 'weight_duration', configField: 'duration_config', label: '평균 체류시간', icon: <Clock size={16} />, unit: { relative: '%', absolute: '초' } },
  { key: 'view', field: 'weight_view', configField: 'view_config', label: 'View', icon: <BarChart2 size={16} />, unit: { relative: '%', absolute: '회' } },
  { key: 'uv', field: 'weight_uv', configField: 'uv_config', label: 'UV', icon: <TrendingUp size={16} />, unit: { relative: '%', absolute: '명' } }
];

// 기본 설정값
const DEFAULT_SETTINGS = {
  evaluation_type: null,
  relative_mode: 'range', // 'range' (구간 점수) 또는 'percentile' (백분위)
  weight_scroll: 30,
  weight_pv: 35,
  weight_duration: 35,
  weight_view: 0,
  weight_uv: 0,
  scroll_config: { boundaries: [10, 30, 60], scores: [100, 80, 50, 20] },
  pv_config: { boundaries: [10, 30, 60], scores: [100, 80, 50, 20] },
  duration_config: { boundaries: [10, 30, 60], scores: [100, 80, 50, 20] },
  view_config: { boundaries: [10, 30, 60], scores: [100, 80, 50, 20] },
  uv_config: { boundaries: [10, 30, 60], scores: [100, 80, 50, 20] },
  enabled_metrics: ['scroll', 'pv', 'duration']
};

// 절대평가 기본 경계값
const ABSOLUTE_DEFAULTS = {
  scroll_config: { boundaries: [3000, 1500, 500], scores: [100, 80, 50, 20] },
  pv_config: { boundaries: [5, 3, 2], scores: [100, 80, 50, 20] },
  duration_config: { boundaries: [120, 60, 30], scores: [100, 80, 50, 20] },
  view_config: { boundaries: [1000, 500, 100], scores: [100, 80, 50, 20] },
  uv_config: { boundaries: [500, 200, 50], scores: [100, 80, 50, 20] }
};

/**
 * 모수 평가 기준 설정 모달
 */
function ScoreSettingsModal({ visible, onClose, currentSettings, onSaveSuccess }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [errors, setErrors] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [saving, setSaving] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);

  // 모달 열릴 때 초기화
  useEffect(() => {
    if (visible) {
      if (currentSettings) {
        // 기존 설정이 있으면 확인 모드로 시작
        setSettings(currentSettings);
        setCurrentStep(2);
        setIsViewMode(true);
      } else {
        // 새 설정
        setSettings(DEFAULT_SETTINGS);
        setCurrentStep(0);
        setIsViewMode(false);
      }
      setErrors([]);
      setWarnings([]);
    }
  }, [visible, currentSettings]);

  // 평가 방식 선택
  const handleSelectEvaluationType = (type) => {
    if (type === 'absolute') {
      setSettings({
        ...settings,
        evaluation_type: type,
        ...ABSOLUTE_DEFAULTS
      });
    } else {
      setSettings({
        ...settings,
        evaluation_type: type,
        scroll_config: { boundaries: [10, 30, 60], scores: [100, 80, 50, 20] },
        pv_config: { boundaries: [10, 30, 60], scores: [100, 80, 50, 20] },
        duration_config: { boundaries: [10, 30, 60], scores: [100, 80, 50, 20] },
        view_config: { boundaries: [10, 30, 60], scores: [100, 80, 50, 20] },
        uv_config: { boundaries: [10, 30, 60], scores: [100, 80, 50, 20] }
      });
    }
  };

  // 지표 활성화/비활성화 토글
  const handleToggleMetric = (metricKey) => {
    const enabledMetrics = settings.enabled_metrics || ['scroll', 'pv', 'duration'];
    const isEnabled = enabledMetrics.includes(metricKey);
    
    if (isEnabled) {
      // 비활성화 시도
      if (enabledMetrics.length <= MIN_METRICS) {
        message.warning(`최소 ${MIN_METRICS}개의 지표를 선택해야 합니다.`);
        return;
      }
      // 해당 지표 제거 (가중치는 유지하여 합계 부족 경고 표시)
      setSettings(prev => ({
        ...prev,
        enabled_metrics: enabledMetrics.filter(m => m !== metricKey)
      }));
    } else {
      // 활성화 (0%로 추가)
      if (enabledMetrics.length >= MAX_METRICS) {
        message.warning(`최대 ${MAX_METRICS}개의 지표만 선택할 수 있습니다.`);
        return;
      }
      const metricDef = METRIC_DEFINITIONS.find(m => m.key === metricKey);
      setSettings(prev => ({
        ...prev,
        enabled_metrics: [...enabledMetrics, metricKey],
        [metricDef.field]: 0 // 0%로 추가
      }));
    }
    
    // 에러 초기화
    if (errors.length > 0) {
      setErrors([]);
    }
  };

  // 가중치 변경
  const handleWeightChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
    // 값 변경 시 에러 초기화
    if (errors.length > 0) {
      setErrors([]);
    }
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
    // 값 변경 시 에러 초기화
    if (errors.length > 0) {
      setErrors([]);
    }
  };

  // 구간 추가
  const handleAddBoundary = (configField) => {
    setSettings(prev => {
      const config = prev[configField];
      const currentCount = config.boundaries.length;
      
      // 최대 개수 체크
      if (currentCount >= MAX_BOUNDARIES) {
        message.warning(`최대 ${MAX_BOUNDARIES}개까지만 추가할 수 있습니다.`);
        return prev;
      }

      // 새 경계값 계산 (마지막 경계값의 절반 또는 적절한 기본값)
      const isRelative = prev.evaluation_type === 'relative';
      const lastBoundary = config.boundaries[currentCount - 1];
      let newBoundary;
      
      if (isRelative) {
        // 상대평가: 마지막 값 + 10 (최대 99)
        newBoundary = Math.min(lastBoundary + 10, 99);
      } else {
        // 절대평가: 마지막 값의 절반
        newBoundary = Math.max(Math.floor(lastBoundary / 2), 1);
      }

      // 새 점수 계산 (마지막 점수 - 10)
      const lastScore = config.scores[currentCount - 1];
      const remainderScore = config.scores[currentCount]; // 그 외 나머지 점수
      const newScore = Math.max(lastScore - 10, remainderScore + 5);

      return {
        ...prev,
        [configField]: {
          boundaries: [...config.boundaries, newBoundary],
          scores: [...config.scores.slice(0, -1), newScore, remainderScore]
        }
      };
    });

    if (errors.length > 0) {
      setErrors([]);
    }
  };

  // 구간 삭제
  const handleRemoveBoundary = (configField, index) => {
    setSettings(prev => {
      const config = prev[configField];
      
      // 최소 개수 체크
      if (config.boundaries.length <= MIN_BOUNDARIES) {
        message.warning(`최소 ${MIN_BOUNDARIES}개의 구간은 유지해야 합니다.`);
        return prev;
      }

      // 해당 인덱스의 경계값과 점수 제거
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

    if (errors.length > 0) {
      setErrors([]);
    }
  };

  // 유효성 검사
  const validate = () => {
    const newErrors = [];
    const newWarnings = [];
    const enabledMetrics = settings.enabled_metrics || ['scroll', 'pv', 'duration'];

    // 활성화된 지표 수 검사
    if (enabledMetrics.length < MIN_METRICS) {
      newErrors.push(`최소 ${MIN_METRICS}개의 지표를 선택해야 합니다.`);
    }

    // 선택된 지표의 가중치 합계 검사
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

    // 활성화된 지표의 구간 설정 검사
    enabledMetrics.forEach(metricKey => {
      const metricDef = METRIC_DEFINITIONS.find(m => m.key === metricKey);
      if (!metricDef) return;

      const config = settings[metricDef.configField];
      const name = metricDef.label;
      
      // 최소 구간 개수 검사
      if (!config || !config.boundaries || config.boundaries.length < MIN_BOUNDARIES) {
        newErrors.push(`${name}에 최소 ${MIN_BOUNDARIES}개의 구간이 필요합니다.`);
        return;
      }

      // 최대 구간 개수 검사
      if (config.boundaries.length > MAX_BOUNDARIES) {
        newErrors.push(`${name}은 최대 ${MAX_BOUNDARIES}개 구간까지만 가능합니다.`);
        return;
      }

      // 점수 개수 검사 (경계값 + 1 = 점수 개수)
      if (config.scores.length !== config.boundaries.length + 1) {
        newErrors.push(`${name}의 점수 개수가 올바르지 않습니다.`);
        return;
      }
      
      // 경계값 순서 검사
      if (settings.evaluation_type === 'relative') {
        // 상대평가: 오름차순 (10 < 30 < 60)
        for (let i = 0; i < config.boundaries.length - 1; i++) {
          if (config.boundaries[i] >= config.boundaries[i + 1]) {
            newErrors.push(`${name} 경계값은 순서대로 커야 합니다.`);
            break;
          }
        }
      } else {
        // 절대평가: 내림차순 (120 > 60 > 30)
        for (let i = 0; i < config.boundaries.length - 1; i++) {
          if (config.boundaries[i] <= config.boundaries[i + 1]) {
            newErrors.push(`${name} 경계값은 순서대로 작아져야 합니다.`);
            break;
          }
        }
      }

      // 점수 순서 검사 (내림차순)
      for (let i = 0; i < config.scores.length - 1; i++) {
        if (config.scores[i] <= config.scores[i + 1]) {
          newErrors.push(`${name} 점수는 순서대로 작아져야 합니다.`);
          break;
        }
      }

      // 최고 점수 경고
      if (config.scores[0] !== 100) {
        newWarnings.push(`${name}의 최고 점수가 ${config.scores[0]}점입니다.`);
      }
    });

    setErrors(newErrors);
    setWarnings(newWarnings);
    return newErrors.length === 0;
  };

  // 다음 단계
  const handleNext = () => {
    if (currentStep === 0 && !settings.evaluation_type) {
      message.warning('평가 방식을 선택해주세요.');
      return;
    }
    if (currentStep === 1) {
      if (!validate()) {
        return;
      }
    }
    setCurrentStep(prev => prev + 1);
  };

  // 이전 단계
  const handlePrev = () => {
    setCurrentStep(prev => prev - 1);
    setIsViewMode(false);
  };

  // 저장
  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await saveScoreSettings(settings);
      if (result.success) {
        message.success('설정이 저장되었습니다.');
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
      content: '모든 설정이 삭제되고 기본 상태로 돌아갑니다.',
      okText: '초기화',
      cancelText: '취소',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const result = await deleteScoreSettings();
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

  // 수정 모드로 전환
  const handleEdit = () => {
    setCurrentStep(0);
    setIsViewMode(false);
  };

  // 1단계: 평가 방식 선택
  const renderStep1 = () => (
    <div className="py-8">
      <div className="text-center mb-8">
        <h3 className="text-lg font-semibold text-gray-800 m-0">
          어떤 방식으로 점수를 평가할까요?
        </h3>
        <p className="text-gray-500 mt-2 text-sm">
          광고 성과를 판단할 기준을 선택해주세요.
        </p>
      </div>
      
      <div className="flex gap-6 justify-center">
        {/* 상대평가 카드 */}
        <div
          onClick={() => handleSelectEvaluationType('relative')}
          className={`
            w-[270px] p-6 rounded-xl cursor-pointer text-center transition-all duration-200 border-2 flex flex-col items-center justify-center
            ${settings.evaluation_type === 'relative' 
              ? 'border-blue-500 bg-blue-50 shadow-md transform -translate-y-1' 
              : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'}
          `}
        >
          <div className={`
            w-16 h-16 mb-4 rounded-full flex items-center justify-center
            ${settings.evaluation_type === 'relative' ? 'bg-blue-100' : 'bg-gray-100'}
          `}>
            <BarChart2 
              size={32} 
              className={settings.evaluation_type === 'relative' ? 'text-blue-600' : 'text-gray-400'} 
            />
          </div>
          <div className="text-lg font-bold text-gray-800 mb-2">상대평가</div>
          <div className="text-sm text-gray-500 leading-relaxed break-keep">
            다른 광고들과 비교해<br />
            <span className="font-medium text-blue-600">순위(백분위)</span>로 점수를 매깁니다.
          </div>
        </div>

        {/* 절대평가 카드 */}
        <div
          onClick={() => handleSelectEvaluationType('absolute')}
          className={`
            w-[270px] p-6 rounded-xl cursor-pointer text-center transition-all duration-200 border-2 flex flex-col items-center justify-center
            ${settings.evaluation_type === 'absolute' 
              ? 'border-green-500 bg-green-50 shadow-md transform -translate-y-1' 
              : 'border-gray-200 bg-white hover:border-green-300 hover:shadow-sm'}
          `}
        >
          <div className={`
            w-16 h-16 mb-4 rounded-full flex items-center justify-center
            ${settings.evaluation_type === 'absolute' ? 'bg-green-100' : 'bg-gray-100'}
          `}>
            <TrendingUp 
              size={32} 
              className={settings.evaluation_type === 'absolute' ? 'text-green-600' : 'text-gray-400'} 
            />
          </div>
          <div className="text-lg font-bold text-gray-800 mb-2">절대평가</div>
          <div className="text-sm text-gray-500 leading-relaxed break-keep">
            내가 정한 <span className="font-medium text-green-600">목표 수치</span>를 기준으로<br />
            점수를 매깁니다.
          </div>
        </div>
      </div>

      {/* 상대평가 세부 방식 선택 */}
      {settings.evaluation_type === 'relative' && (
        <div className="mt-8 max-w-[560px] mx-auto">
          <div className="bg-blue-50 rounded-xl p-5 border border-blue-200">
            <div className="text-sm font-semibold text-blue-800 mb-4 flex items-center gap-2">
              <Settings size={16} />
              상대평가 세부 방식 선택
            </div>
            <div className="flex flex-col gap-3">
              {/* 구간 점수 방식 */}
              <label 
                className={`flex items-start gap-3 p-4 rounded-lg cursor-pointer transition-all border-2 ${
                  settings.relative_mode === 'range' 
                    ? 'bg-white border-blue-500 shadow-sm' 
                    : 'bg-white/50 border-transparent hover:bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="relative_mode"
                  value="range"
                  checked={settings.relative_mode === 'range'}
                  onChange={() => setSettings(prev => ({ ...prev, relative_mode: 'range' }))}
                  className="mt-1 w-4 h-4 text-blue-600"
                />
                <div>
                  <div className="font-medium text-gray-800">구간 점수 방식</div>
                  <div className="text-xs text-gray-500 mt-1">
                    상위 10% → 100점, 상위 30% → 80점... (직접 구간과 점수 설정)
                  </div>
                </div>
              </label>

              {/* 백분위 방식 */}
              <label 
                className={`flex items-start gap-3 p-4 rounded-lg cursor-pointer transition-all border-2 ${
                  settings.relative_mode === 'percentile' 
                    ? 'bg-white border-blue-500 shadow-sm' 
                    : 'bg-white/50 border-transparent hover:bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="relative_mode"
                  value="percentile"
                  checked={settings.relative_mode === 'percentile'}
                  onChange={() => setSettings(prev => ({ ...prev, relative_mode: 'percentile' }))}
                  className="mt-1 w-4 h-4 text-blue-600"
                />
                <div>
                  <div className="font-medium text-gray-800">
                    백분위 방식
                    <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">추천</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    상위 1% → 99점, 상위 50% → 50점 (순위에 따라 자동 계산)
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // 선택된 지표의 가중치 합계 계산
  const getEnabledWeightSum = () => {
    const enabledMetrics = settings.enabled_metrics || ['scroll', 'pv', 'duration'];
    return enabledMetrics.reduce((sum, metricKey) => {
      const metricDef = METRIC_DEFINITIONS.find(m => m.key === metricKey);
      return sum + (metricDef ? (settings[metricDef.field] || 0) : 0);
    }, 0);
  };

  // 2단계: 세부 설정
  const renderStep2 = () => {
    const enabledMetrics = settings.enabled_metrics || ['scroll', 'pv', 'duration'];
    const weightSum = getEnabledWeightSum();

    return (
    <div className="py-4">
      {/* 가중치 설정 */}
      <div className="mb-8 bg-white p-5 rounded-lg border border-gray-100 shadow-sm">
        <div className="flex items-center mb-4">
          <div className="bg-blue-100 p-1.5 rounded-md mr-2">
            <Settings size={18} className="text-blue-600" />
          </div>
          <span className="text-base font-bold text-gray-800">지표별 중요도 설정</span>
          <span className="ml-2 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">합계 100%</span>
        </div>
        
        {/* 안내 문구 */}
        <div className="mb-4 p-3 bg-blue-50 rounded-lg text-xs text-blue-700 flex items-start gap-2">
          <Info size={14} className="mt-0.5 flex-shrink-0" />
          <span>체크박스로 평가에 사용할 지표를 선택하세요. 최소 {MIN_METRICS}개, 최대 {MAX_METRICS}개까지 선택 가능합니다.</span>
        </div>
        
        <div className="flex flex-col gap-4 px-2">
          {METRIC_DEFINITIONS.map(({ key, field, label, icon }) => {
            const isEnabled = enabledMetrics.includes(key);
            return (
              <div key={field} className={`flex items-center gap-4 p-2 rounded-lg transition-colors ${isEnabled ? 'bg-white' : 'bg-gray-50'}`}>
                {/* 체크박스 */}
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={() => handleToggleMetric(key)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                />
                <div className={`w-32 flex items-center gap-2 text-sm font-medium ${isEnabled ? 'text-gray-700' : 'text-gray-400'}`}>
                  {icon} {label}
                </div>
                <div className="flex-1">
                  <Slider
                    min={0}
                    max={100}
                    value={settings[field] || 0}
                    onChange={(value) => handleWeightChange(field, value)}
                    disabled={!isEnabled}
                    trackStyle={{ backgroundColor: isEnabled ? '#3b82f6' : '#d1d5db' }}
                    handleStyle={{ borderColor: isEnabled ? '#3b82f6' : '#d1d5db', boxShadow: 'none' }}
                  />
                </div>
                <div className="w-20">
                  <InputNumber
                    className="w-full"
                    min={0}
                    max={100}
                    value={settings[field] || 0}
                    onChange={(value) => handleWeightChange(field, value || 0)}
                    disabled={!isEnabled}
                    formatter={value => `${value}%`}
                    parser={value => value.replace('%', '')}
                  />
                </div>
              </div>
            );
          })}
        </div>
        
        {/* 합계 표시 */}
        <div className={`
          mt-6 text-right text-sm font-medium flex justify-end items-center gap-2
          ${weightSum === 100 ? 'text-green-600' : 'text-red-500'}
        `}>
          <span>선택된 지표 합계: {weightSum}%</span>
          {weightSum === 100 ? (
            <CheckCircle2 size={16} />
          ) : (
            <AlertCircle size={16} />
          )}
        </div>
      </div>

      {/* 구간 설정 또는 백분위 안내 */}
      {settings.evaluation_type === 'relative' && settings.relative_mode === 'percentile' ? (
        /* 백분위 방식 안내 */
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 shadow-sm p-6">
          <div className="flex items-center mb-4">
            <div className="bg-blue-100 p-1.5 rounded-md mr-2">
              <BarChart2 size={18} className="text-blue-600" />
            </div>
            <span className="text-base font-bold text-gray-800">백분위 점수 안내</span>
          </div>
          
          <div className="bg-white rounded-lg p-4 border border-blue-100">
            <div className="text-sm text-gray-600 mb-4">
              백분위 방식은 순위에 따라 <span className="font-semibold text-blue-600">자동으로 점수가 계산</span>됩니다.
              <br />별도의 구간 설정이 필요하지 않습니다.
            </div>
            
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                <span className="text-gray-600">상위 1%</span>
                <span className="font-bold text-blue-700">99점</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                <span className="text-gray-600">상위 10%</span>
                <span className="font-bold text-blue-700">90점</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                <span className="text-gray-600">상위 25%</span>
                <span className="font-bold text-blue-700">75점</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                <span className="text-gray-600">상위 50%</span>
                <span className="font-bold text-blue-700">50점</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span className="text-gray-600">상위 75%</span>
                <span className="font-bold text-gray-600">25점</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span className="text-gray-600">하위 1%</span>
                <span className="font-bold text-gray-600">1점</span>
              </div>
            </div>
            
            <div className="mt-4 text-xs text-gray-500 flex items-start gap-1.5">
              <Info size={12} className="mt-0.5 flex-shrink-0" />
              <span>공식: 백분위 점수 = (1 - 순위/전체 광고 수) × 100</span>
            </div>
          </div>
        </div>
      ) : (
        /* 구간 점수 방식 또는 절대평가 */
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50">
            <div className="flex items-center">
              <div className="bg-purple-100 p-1.5 rounded-md mr-2">
                <BarChart2 size={18} className="text-purple-600" />
              </div>
              <span className="text-base font-bold text-gray-800">지표별 구간 상세 설정</span>
              <span className="ml-2 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">선택된 지표만</span>
            </div>
            <Tooltip title={settings.evaluation_type === 'relative' ? '상위 몇 %에 해당하면 몇 점을 줄지 설정합니다.' : '수치가 얼마 이상이면 몇 점을 줄지 설정합니다.'}>
              <div className="flex items-center gap-1 text-xs text-gray-500 cursor-help bg-white px-2 py-1 rounded border border-gray-200">
                <Info size={14} />
                <span>도움말</span>
              </div>
            </Tooltip>
          </div>

          <Collapse 
            defaultActiveKey={enabledMetrics.length > 0 ? [METRIC_DEFINITIONS.find(m => m.key === enabledMetrics[0])?.configField] : []} 
            ghost 
            expandIcon={({ isActive }) => <ChevronRight size={16} className={`text-gray-400 transition-transform ${isActive ? 'rotate-90' : ''}`} />}
            className="bg-white"
          >
            {METRIC_DEFINITIONS
              .filter(m => enabledMetrics.includes(m.key))
              .map(({ key, configField, label, unit }) => (
                <Panel header={<span className="font-medium text-gray-700">{label}</span>} key={configField} className="border-b border-gray-50 last:border-0">
                  {renderConfigPanel(configField, settings.evaluation_type === 'relative' ? unit.relative : unit.absolute)}
                </Panel>
              ))}
          </Collapse>
        </div>
      )}

      {/* 에러/경고 표시 */}
      {errors.length > 0 && (
        <Alert
          type="error"
          message="입력 값을 확인해주세요"
          description={
            <ul className="list-disc pl-5 m-0 text-sm">
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
            <ul className="list-disc pl-5 m-0 text-sm">
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
    const isRelative = settings.evaluation_type === 'relative';
    const boundaryCount = config.boundaries.length;
    const canAdd = boundaryCount < MAX_BOUNDARIES;
    const canRemove = boundaryCount > MIN_BOUNDARIES;

    // 구간 번호에 따른 색상 (그라데이션)
    const getBadgeColor = (idx) => {
      const colors = [
        'bg-blue-600', 'bg-blue-500', 'bg-blue-400', 'bg-blue-300', 'bg-blue-200',
        'bg-indigo-400', 'bg-indigo-300', 'bg-indigo-200', 'bg-purple-300', 'bg-purple-200'
      ];
      return colors[Math.min(idx, colors.length - 1)];
    };

    return (
      <div className="py-2 px-2">
        <div className="grid grid-cols-12 gap-4 mb-2 text-xs font-medium text-gray-500 border-b border-gray-100 pb-2">
          <div className="col-span-7 pl-2">{isRelative ? '순위 구간 (상위 %)' : `수치 구간 (${unit})`}</div>
          <div className="col-span-3 text-center">부여 점수</div>
          <div className="col-span-2 text-center">삭제</div>
        </div>
        
        <div className="space-y-3">
          {/* 동적 구간 렌더링 */}
          {config.boundaries.map((boundary, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-4 items-center">
              <div className="col-span-7 flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${getBadgeColor(idx)}`}>
                  {idx + 1}
                </div>
                {isRelative ? (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <span>상위</span>
                    <InputNumber 
                      size="small" 
                      className="w-16" 
                      min={1} 
                      max={99} 
                      value={boundary} 
                      onChange={(v) => handleConfigChange(configField, 'boundaries', idx, v)} 
                    />
                    <span>% 이내</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <InputNumber 
                      size="small" 
                      className="w-20" 
                      min={1} 
                      value={boundary} 
                      onChange={(v) => handleConfigChange(configField, 'boundaries', idx, v)} 
                    />
                    <span>{unit} 이상</span>
                  </div>
                )}
              </div>
              <div className="col-span-3 flex items-center justify-center gap-1">
                <InputNumber 
                  size="small" 
                  className="w-16" 
                  min={0} 
                  max={100} 
                  value={config.scores[idx]} 
                  onChange={(v) => handleConfigChange(configField, 'scores', idx, v)} 
                />
                <span className="text-sm text-gray-500">점</span>
              </div>
              <div className="col-span-2 flex justify-center">
                <Button
                  type="text"
                  size="small"
                  danger
                  disabled={!canRemove}
                  icon={<Trash2 size={14} />}
                  onClick={() => handleRemoveBoundary(configField, idx)}
                  className="flex items-center justify-center"
                />
              </div>
            </div>
          ))}
          
          {/* 그 외 나머지 (항상 마지막) */}
          <div className="grid grid-cols-12 gap-4 items-center pt-3 mt-2 border-t-2 border-dashed border-gray-200 bg-gray-50 -mx-2 px-4 pb-3 rounded-b">
            <div className="col-span-7 flex items-center gap-2 pl-8">
              <span className="text-sm font-medium text-gray-600">그 외 나머지</span>
            </div>
            <div className="col-span-3 flex items-center justify-center gap-1">
              <InputNumber 
                size="small" 
                className="w-16" 
                min={0} 
                max={100} 
                value={config.scores[boundaryCount]} 
                onChange={(v) => handleConfigChange(configField, 'scores', boundaryCount, v)} 
              />
              <span className="text-sm text-gray-500">점</span>
            </div>
            <div className="col-span-2"></div>
          </div>

          {/* 안내 문구 */}
          <div className="text-xs text-gray-400 mt-2 pl-2 flex items-center gap-1">
            <Info size={12} />
            <span>"그 외 나머지"는 위 구간에 해당하지 않는 모든 값에 적용됩니다.</span>
          </div>

          {/* 구간 추가 버튼 */}
          <div className="flex justify-center pt-2">
            <Button
              type="dashed"
              size="small"
              disabled={!canAdd}
              icon={<Plus size={14} />}
              onClick={() => handleAddBoundary(configField)}
              className="flex items-center gap-1 text-gray-500 hover:text-blue-500 hover:border-blue-400"
            >
              구간 추가 ({boundaryCount}/{MAX_BOUNDARIES})
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // 3단계: 확인
  const renderStep3 = () => {
    const enabledMetrics = settings.enabled_metrics || ['scroll', 'pv', 'duration'];
    
    // 지표별 색상 매핑
    const metricColors = {
      scroll: 'bg-blue-100 text-blue-700',
      pv: 'bg-purple-100 text-purple-700',
      duration: 'bg-green-100 text-green-700',
      view: 'bg-orange-100 text-orange-700',
      uv: 'bg-teal-100 text-teal-700'
    };
    
    const metricIconColors = {
      scroll: 'text-blue-500',
      pv: 'text-purple-500',
      duration: 'text-green-500',
      view: 'text-orange-500',
      uv: 'text-teal-500'
    };
    
    return (
    <div className="py-6">
      <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
        <div className="flex flex-col gap-6 mb-6 pb-6 border-b border-gray-200">
          <div className="flex items-start gap-8">
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">평가 방식</div>
              <div className="flex items-center gap-2 text-lg font-bold text-gray-800">
                {settings.evaluation_type === 'relative' ? (
                  <><BarChart2 className="text-blue-500" /> 상대평가</>
                ) : (
                  <><TrendingUp className="text-green-500" /> 절대평가</>
                )}
              </div>
            </div>
            
            <div className="flex-1">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">지표별 중요도 ({enabledMetrics.length}개 선택)</div>
              <div className="flex gap-2 flex-wrap">
                {METRIC_DEFINITIONS
                  .filter(m => enabledMetrics.includes(m.key))
                  .map(m => (
                    <div key={m.key} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${metricColors[m.key]}`}>
                      {m.label} <span className="font-bold ml-1">{settings[m.field] || 0}%</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">구간별 점수 상세</div>
          <div className="flex flex-col gap-3">
            {METRIC_DEFINITIONS
              .filter(m => enabledMetrics.includes(m.key))
              .map(({ key, configField, label, icon, unit }) => {
                const config = settings[configField];
                const isRelative = settings.evaluation_type === 'relative';
                const boundaryCount = config?.boundaries?.length || 0;
                const unitStr = isRelative ? unit.relative : unit.absolute;
              
                // 동적 구간 텍스트 생성 헬퍼
                const getRangeText = (index) => {
                  if (!config || !config.boundaries) return '';
                  if (index >= boundaryCount) {
                    // 그 외 나머지
                    if (isRelative) {
                      return `상위 ${parseInt(config.boundaries[boundaryCount - 1]) + 1} ~ 100%`;
                    } else {
                      return `${config.boundaries[boundaryCount - 1]}${unitStr} 미만`;
                    }
                  }
                  
                  if (isRelative) {
                    // 상대평가 (오름차순)
                    if (index === 0) return `상위 1 ~ ${config.boundaries[0]}%`;
                    return `상위 ${parseInt(config.boundaries[index - 1]) + 1} ~ ${config.boundaries[index]}%`;
                  } else {
                    // 절대평가 (내림차순)
                    if (index === 0) return `${config.boundaries[0]}${unitStr} 이상`;
                    return `${config.boundaries[index]} ~ ${config.boundaries[index - 1]} 미만`;
                  }
                };

                if (!config) return null;

                return (
                  <div key={configField} className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm flex flex-col">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 font-bold text-gray-700 text-sm flex justify-between items-center">
                      <span className="flex items-center gap-1.5">
                        <span className={metricIconColors[key]}>{icon}</span>
                        {label}
                        <span className="text-xs font-normal text-gray-400">({boundaryCount}개 구간)</span>
                      </span>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50/50 text-gray-500 text-xs border-b border-gray-100">
                          <th className="px-4 py-2 text-left font-medium w-2/3 whitespace-nowrap">실제 구간</th>
                          <th className="px-4 py-2 text-center font-medium w-1/3 border-l border-gray-100 whitespace-nowrap">점수</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {/* 동적 구간 + 그 외 나머지 */}
                        {[...Array(boundaryCount + 1)].map((_, idx) => (
                          <tr key={idx} className={`hover:bg-gray-50/50 transition-colors ${idx === boundaryCount ? 'bg-gray-50' : ''}`}>
                            <td className="px-4 py-2 text-gray-600 text-xs whitespace-nowrap">
                              {idx === boundaryCount ? <span className="font-medium">그 외 나머지</span> : getRangeText(idx)}
                            </td>
                            <td className="px-4 py-2 text-center font-bold text-gray-800 border-l border-gray-50 whitespace-nowrap">
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
      </div>

      {warnings.length > 0 && (
        <Alert
          type="warning"
          message="주의사항이 있습니다"
          description={
            <ul className="list-disc pl-5 m-0 text-sm">
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

  // 푸터 버튼
  const renderFooter = () => {
    if (isViewMode) {
      return (
        <div className="flex justify-between w-full">
          <Button danger icon={<RotateCcw size={14} />} onClick={handleReset} className="flex items-center gap-1">초기화</Button>
          <div className="flex gap-2">
            <Button onClick={onClose}>닫기</Button>
            <Button type="primary" icon={<Settings size={14} />} onClick={handleEdit} className="flex items-center gap-1 bg-blue-600">수정</Button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex justify-between w-full">
        <div>
          {currentStep > 0 && (
            <Button onClick={handlePrev} icon={<ChevronLeft size={14} />} className="flex items-center gap-1">이전</Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={onClose}>취소</Button>
          {currentStep < 2 ? (
            <Button type="primary" onClick={handleNext} className="flex items-center gap-1 bg-blue-600">
              다음 <ChevronRight size={14} />
            </Button>
          ) : (
            <Button type="primary" onClick={handleSave} loading={saving} icon={<Save size={14} />} className="flex items-center gap-1 bg-blue-600">
              저장
            </Button>
          )}
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
      width={640}
      footer={renderFooter()}
      destroyOnClose
      centered
      className="score-settings-modal"
      styles={{
        body: {
          height: 'calc(85vh - 120px)',
          maxHeight: '600px',
          overflowY: 'auto',
          padding: '24px',
        }
      }}
    >
      {/* 스텝 인디케이터 */}
      {!isViewMode && (
        <div className="mb-6 px-4">
          <Steps 
            current={currentStep} 
            size="small" 
            items={[
              { title: '평가 방식' },
              { title: '세부 설정' },
              { title: '확인' }
            ]}
          />
        </div>
      )}

      {/* 단계별 컨텐츠 */}
      <div className="min-h-[300px]">
        {currentStep === 0 && renderStep1()}
        {currentStep === 1 && renderStep2()}
        {currentStep === 2 && renderStep3()}
      </div>
    </Modal>
  );
}

export default ScoreSettingsModal;
