// ============================================================================
// 모수 평가 기준 설정 모달
// ============================================================================

import React, { useState, useEffect } from 'react';
import { Modal, Steps, Button, Slider, InputNumber, Alert, message, Tooltip, Collapse } from 'antd';
import { BarChartOutlined, LineChartOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { saveScoreSettings, deleteScoreSettings } from '../services/scoreSettingsApi';

const { Step } = Steps;
const { Panel } = Collapse;

// 기본 설정값
const DEFAULT_SETTINGS = {
  evaluation_type: null,
  weight_scroll: 30,
  weight_pv: 35,
  weight_duration: 35,
  scroll_config: { boundaries: [10, 30, 60], scores: [100, 80, 50, 20] },
  pv_config: { boundaries: [10, 30, 60], scores: [100, 80, 50, 20] },
  duration_config: { boundaries: [10, 30, 60], scores: [100, 80, 50, 20] }
};

// 절대평가 기본 경계값
const ABSOLUTE_DEFAULTS = {
  scroll_config: { boundaries: [3000, 1500, 500], scores: [100, 80, 50, 20] },
  pv_config: { boundaries: [5, 3, 2], scores: [100, 80, 50, 20] },
  duration_config: { boundaries: [120, 60, 30], scores: [100, 80, 50, 20] }
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
        duration_config: { boundaries: [10, 30, 60], scores: [100, 80, 50, 20] }
      });
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

  // 유효성 검사
  const validate = () => {
    const newErrors = [];
    const newWarnings = [];

    // 가중치 합계 검사
    const weightSum = settings.weight_scroll + settings.weight_pv + settings.weight_duration;
    if (weightSum !== 100) {
      newErrors.push(`가중치 합계가 ${weightSum}%입니다. 100%가 되어야 합니다.`);
    }

    // 구간 설정 검사
    const configs = [
      { field: 'scroll_config', name: '스크롤' },
      { field: 'pv_config', name: 'PV' },
      { field: 'duration_config', name: '체류시간' }
    ];

    configs.forEach(({ field, name }) => {
      const config = settings[field];
      
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
    <div style={{ padding: '24px 0' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
          어떤 방식으로 점수를 평가할까요?
        </h3>
      </div>
      
      <div style={{ display: 'flex', gap: '24px', justifyContent: 'center' }}>
        {/* 상대평가 카드 */}
        <div
          onClick={() => handleSelectEvaluationType('relative')}
          style={{
            width: '220px',
            padding: '32px 24px',
            border: settings.evaluation_type === 'relative' ? '2px solid #1890ff' : '1px solid #d9d9d9',
            borderRadius: '12px',
            cursor: 'pointer',
            textAlign: 'center',
            background: settings.evaluation_type === 'relative' ? '#e6f7ff' : '#fff',
            transition: 'all 0.2s'
          }}
        >
          <BarChartOutlined style={{ fontSize: '48px', color: '#1890ff', marginBottom: '16px' }} />
          <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>상대평가</div>
          <div style={{ fontSize: '13px', color: '#666', lineHeight: '1.6' }}>
            다른 광고들과 비교해<br />
            순위로 점수 매김
          </div>
        </div>

        {/* 절대평가 카드 */}
        <div
          onClick={() => handleSelectEvaluationType('absolute')}
          style={{
            width: '220px',
            padding: '32px 24px',
            border: settings.evaluation_type === 'absolute' ? '2px solid #1890ff' : '1px solid #d9d9d9',
            borderRadius: '12px',
            cursor: 'pointer',
            textAlign: 'center',
            background: settings.evaluation_type === 'absolute' ? '#e6f7ff' : '#fff',
            transition: 'all 0.2s'
          }}
        >
          <LineChartOutlined style={{ fontSize: '48px', color: '#52c41a', marginBottom: '16px' }} />
          <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>절대평가</div>
          <div style={{ fontSize: '13px', color: '#666', lineHeight: '1.6' }}>
            내가 정한 기준으로<br />
            점수 매김
          </div>
        </div>
      </div>
    </div>
  );

  // 2단계: 세부 설정
  const renderStep2 = () => (
    <div style={{ padding: '16px 0' }}>
      {/* 가중치 설정 */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
          <span style={{ fontSize: '15px', fontWeight: 600 }}>📊 지표별 중요도</span>
          <span style={{ marginLeft: '8px', fontSize: '13px', color: '#666' }}>(합계 100%)</span>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[
            { field: 'weight_scroll', label: '평균 스크롤' },
            { field: 'weight_pv', label: '평균 PV' },
            { field: 'weight_duration', label: '평균 체류시간' }
          ].map(({ field, label }) => (
            <div key={field} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ width: '100px', fontSize: '14px' }}>{label}</span>
              <Slider
                style={{ flex: 1 }}
                min={0}
                max={100}
                value={settings[field]}
                onChange={(value) => handleWeightChange(field, value)}
              />
              <InputNumber
                style={{ width: '70px' }}
                min={0}
                max={100}
                value={settings[field]}
                onChange={(value) => handleWeightChange(field, value || 0)}
                formatter={value => `${value}%`}
                parser={value => value.replace('%', '')}
              />
            </div>
          ))}
        </div>
        
        {/* 합계 표시 */}
        <div style={{ 
          marginTop: '12px', 
          textAlign: 'right', 
          fontSize: '14px',
          color: (settings.weight_scroll + settings.weight_pv + settings.weight_duration) === 100 ? '#52c41a' : '#ff4d4f'
        }}>
          합계: {settings.weight_scroll + settings.weight_pv + settings.weight_duration}%
        </div>
      </div>

      {/* 구간 설정 */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
          <span style={{ fontSize: '15px', fontWeight: 600 }}>🎯 지표별 구간 설정</span>
          <Tooltip title={settings.evaluation_type === 'relative' ? '상위 몇 %에 해당하면 몇 점을 줄지 설정합니다.' : '수치가 얼마 이상이면 몇 점을 줄지 설정합니다.'}>
            <InfoCircleOutlined style={{ marginLeft: '8px', color: '#999' }} />
          </Tooltip>
        </div>

        <Collapse defaultActiveKey={['scroll_config']}>
          {[
            { field: 'scroll_config', label: '평균 스크롤', unit: settings.evaluation_type === 'relative' ? '%' : 'px' },
            { field: 'pv_config', label: '평균 PV', unit: settings.evaluation_type === 'relative' ? '%' : '개' },
            { field: 'duration_config', label: '평균 체류시간', unit: settings.evaluation_type === 'relative' ? '%' : '초' }
          ].map(({ field, label, unit }) => (
            <Panel header={label} key={field}>
              {renderConfigPanel(field, unit)}
            </Panel>
          ))}
        </Collapse>
      </div>

      {/* 에러/경고 표시 */}
      {errors.length > 0 && (
        <Alert
          type="error"
          message="입력 오류"
          description={
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              {errors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          }
          style={{ marginTop: '16px' }}
        />
      )}
      {warnings.length > 0 && errors.length === 0 && (
        <Alert
          type="warning"
          message="주의"
          description={
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              {warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          }
          style={{ marginTop: '16px' }}
        />
      )}
    </div>
  );

  // 구간 설정 패널
  const renderConfigPanel = (configField, unit) => {
    const config = settings[configField];
    const isRelative = settings.evaluation_type === 'relative';

    return (
      <div style={{ padding: '8px 0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #f0f0f0', width: '50%' }}>
                {isRelative ? '순위 구간' : '수치 구간'}
              </th>
              <th style={{ textAlign: 'center', padding: '8px', borderBottom: '1px solid #f0f0f0' }}>점수</th>
            </tr>
          </thead>
          <tbody>
            {/* 구간 1 (최상위) */}
            <tr>
              <td style={{ padding: '8px' }}>
                {isRelative ? (
                  <>상위 <InputNumber size="small" style={{ width: '60px' }} min={1} max={99} value={config.boundaries[0]} onChange={(v) => handleConfigChange(configField, 'boundaries', 0, v)} />% 이내</>
                ) : (
                  <><InputNumber size="small" style={{ width: '80px' }} min={1} value={config.boundaries[0]} onChange={(v) => handleConfigChange(configField, 'boundaries', 0, v)} />{unit} 이상</>
                )}
              </td>
              <td style={{ padding: '8px', textAlign: 'center' }}>
                <InputNumber size="small" style={{ width: '60px' }} min={0} max={100} value={config.scores[0]} onChange={(v) => handleConfigChange(configField, 'scores', 0, v)} />점
              </td>
            </tr>
            {/* 구간 2 */}
            <tr>
              <td style={{ padding: '8px' }}>
                {isRelative ? (
                  <>상위 <InputNumber size="small" style={{ width: '60px' }} min={1} max={99} value={config.boundaries[1]} onChange={(v) => handleConfigChange(configField, 'boundaries', 1, v)} />% 이내</>
                ) : (
                  <><InputNumber size="small" style={{ width: '80px' }} min={1} value={config.boundaries[1]} onChange={(v) => handleConfigChange(configField, 'boundaries', 1, v)} />{unit} 이상</>
                )}
              </td>
              <td style={{ padding: '8px', textAlign: 'center' }}>
                <InputNumber size="small" style={{ width: '60px' }} min={0} max={100} value={config.scores[1]} onChange={(v) => handleConfigChange(configField, 'scores', 1, v)} />점
              </td>
            </tr>
            {/* 구간 3 */}
            <tr>
              <td style={{ padding: '8px' }}>
                {isRelative ? (
                  <>상위 <InputNumber size="small" style={{ width: '60px' }} min={1} max={99} value={config.boundaries[2]} onChange={(v) => handleConfigChange(configField, 'boundaries', 2, v)} />% 이내</>
                ) : (
                  <><InputNumber size="small" style={{ width: '80px' }} min={1} value={config.boundaries[2]} onChange={(v) => handleConfigChange(configField, 'boundaries', 2, v)} />{unit} 이상</>
                )}
              </td>
              <td style={{ padding: '8px', textAlign: 'center' }}>
                <InputNumber size="small" style={{ width: '60px' }} min={0} max={100} value={config.scores[2]} onChange={(v) => handleConfigChange(configField, 'scores', 2, v)} />점
              </td>
            </tr>
            {/* 구간 4 (최하위) */}
            <tr>
              <td style={{ padding: '8px', color: '#666' }}>나머지</td>
              <td style={{ padding: '8px', textAlign: 'center' }}>
                <InputNumber size="small" style={{ width: '60px' }} min={0} max={100} value={config.scores[3]} onChange={(v) => handleConfigChange(configField, 'scores', 3, v)} />점
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  // 3단계: 확인
  const renderStep3 = () => (
    <div style={{ padding: '16px 0' }}>
      <div style={{ 
        background: '#fafafa', 
        borderRadius: '8px', 
        padding: '24px',
        border: '1px solid #f0f0f0'
      }}>
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>평가 방식</div>
          <div style={{ fontSize: '16px', fontWeight: 600 }}>
            {settings.evaluation_type === 'relative' ? '📊 상대평가' : '📏 절대평가'}
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>지표별 중요도</div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <span>스크롤 {settings.weight_scroll}%</span>
            <span>·</span>
            <span>PV {settings.weight_pv}%</span>
            <span>·</span>
            <span>체류시간 {settings.weight_duration}%</span>
          </div>
        </div>

        <div>
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>구간별 점수</div>
          {[
            { field: 'scroll_config', label: '스크롤', unit: settings.evaluation_type === 'relative' ? '%' : 'px' },
            { field: 'pv_config', label: 'PV', unit: settings.evaluation_type === 'relative' ? '%' : '개' },
            { field: 'duration_config', label: '체류시간', unit: settings.evaluation_type === 'relative' ? '%' : '초' }
          ].map(({ field, label, unit }) => {
            const config = settings[field];
            const isRelative = settings.evaluation_type === 'relative';
            return (
              <div key={field} style={{ marginBottom: '8px', fontSize: '13px' }}>
                <span style={{ fontWeight: 500 }}>{label}:</span>{' '}
                {isRelative ? (
                  <>상위 {config.boundaries[0]}%→{config.scores[0]}점, {config.boundaries[1]}%→{config.scores[1]}점, {config.boundaries[2]}%→{config.scores[2]}점, 나머지→{config.scores[3]}점</>
                ) : (
                  <>{config.boundaries[0]}{unit}↑→{config.scores[0]}점, {config.boundaries[1]}{unit}↑→{config.scores[1]}점, {config.boundaries[2]}{unit}↑→{config.scores[2]}점, 나머지→{config.scores[3]}점</>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {warnings.length > 0 && (
        <Alert
          type="warning"
          message="주의"
          description={
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              {warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          }
          style={{ marginTop: '16px' }}
        />
      )}
    </div>
  );

  // 푸터 버튼
  const renderFooter = () => {
    if (isViewMode) {
      return (
        <>
          <Button danger onClick={handleReset}>초기화</Button>
          <Button onClick={onClose}>닫기</Button>
          <Button type="primary" onClick={handleEdit}>수정</Button>
        </>
      );
    }

    return (
      <>
        {currentStep > 0 && <Button onClick={handlePrev}>← 이전</Button>}
        <Button onClick={onClose}>취소</Button>
        {currentStep < 2 ? (
          <Button type="primary" onClick={handleNext}>다음 →</Button>
        ) : (
          <Button type="primary" onClick={handleSave} loading={saving}>저장</Button>
        )}
      </>
    );
  };

  return (
    <Modal
      title="⚙️ 모수 평가 기준 설정"
      open={visible}
      onCancel={onClose}
      width={600}
      footer={renderFooter()}
      destroyOnClose
    >
      {/* 스텝 인디케이터 */}
      {!isViewMode && (
        <Steps current={currentStep} size="small" style={{ marginBottom: '24px' }}>
          <Step title="평가 방식" />
          <Step title="세부 설정" />
          <Step title="확인" />
        </Steps>
      )}

      {/* 단계별 컨텐츠 */}
      {currentStep === 0 && renderStep1()}
      {currentStep === 1 && renderStep2()}
      {currentStep === 2 && renderStep3()}
    </Modal>
  );
}

export default ScoreSettingsModal;
