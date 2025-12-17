import { Modal, Form, Input, Button, Space, Typography, Switch, Popover, message } from 'antd';
import { SketchPicker } from 'react-color';
import { useState, useEffect, useRef } from 'react';

const { Text } = Typography;

// API base URL
const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * ColorPickerInput - 색상값 클릭 시 피커 팝업 표시
 */
function ColorPickerInput({ color, onChange, label }) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div style={{ flex: 1 }}>
      <div style={{ marginBottom: '8px', fontSize: '13px', color: 'rgba(0, 0, 0, 0.65)' }}>{label}</div>
      <Popover
        content={
          <SketchPicker
            color={color}
            onChange={(c) => onChange(c.hex)}
            disableAlpha={true}
            styles={{
              default: {
                picker: {
                  boxShadow: 'none',
                  padding: '10px',
                  width: '220px'
                }
              }
            }}
          />
        }
        trigger="click"
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        placement="bottomLeft"
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 10px',
            border: '1px solid #d9d9d9',
            borderRadius: '6px',
            cursor: 'pointer',
            background: '#fff',
            transition: 'border-color 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = '#4096ff'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = '#d9d9d9'}
        >
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '4px',
              backgroundColor: color,
              border: '1px solid rgba(0,0,0,0.1)',
              flexShrink: 0
            }}
          />
          <span style={{ 
            fontSize: '13px', 
            fontFamily: 'monospace',
            color: '#374151',
            textTransform: 'uppercase'
          }}>
            {color}
          </span>
        </div>
      </Popover>
    </div>
  );
}

/**
 * MappingModal - 페이지 매핑 모달
 */
function MappingModal({ visible, onClose, onSubmit, url, form, submitting, initialBadges = [] }) {
  // 다중 배지 관리
  const [badges, setBadges] = useState([]);
  const [draggedIndex, setDraggedIndex] = useState(null);
  
  // 배경색/글자색 상태
  const [bgColor, setBgColor] = useState('#1677ff');
  const [textColor, setTextColor] = useState('#ffffff');
  
  // 최근 사용 배지 프리셋
  const [badgePresets, setBadgePresets] = useState([]);
  const [loadingPresets, setLoadingPresets] = useState(false);
  const [hoveredPresetId, setHoveredPresetId] = useState(null);

  // 최근 사용 배지 조회
  const fetchBadgePresets = async () => {
    try {
      setLoadingPresets(true);
      const response = await fetch(`${API_BASE}/api/mappings/badge-presets`);
      const data = await response.json();
      if (data.success) {
        setBadgePresets(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch badge presets:', error);
    } finally {
      setLoadingPresets(false);
    }
  };

  // 배지 프리셋 저장
  const saveBadgePreset = async (text, bg_color, text_color) => {
    try {
      await fetch(`${API_BASE}/api/mappings/badge-presets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, bg_color, text_color })
      });
      // 저장 후 목록 갱신
      fetchBadgePresets();
    } catch (error) {
      console.error('Failed to save badge preset:', error);
    }
  };

  // 배지 프리셋 삭제
  const deleteBadgePreset = async (id) => {
    try {
      await fetch(`${API_BASE}/api/mappings/badge-presets/${id}`, {
        method: 'DELETE'
      });
      // 삭제 후 목록 갱신
      setBadgePresets(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      console.error('Failed to delete badge preset:', error);
    }
  };

  // 모달이 열릴 때마다 초기화
  useEffect(() => {
    if (visible) {
      fetchBadgePresets();
      // 초기 배지 로드 (수정 모드)
      if (initialBadges && initialBadges.length > 0) {
        setBadges(initialBadges);
        // 첫 배지의 색상으로 초기화
        if (initialBadges[0]) {
          setBgColor(initialBadges[0].color || '#1677ff');
          setTextColor(initialBadges[0].text_color || '#ffffff');
        }
      } else {
        setBadges([]);
        setBgColor('#1677ff');
        setTextColor('#ffffff');
      }
    } else {
      setBadges([]);
      setBgColor('#1677ff');
      setTextColor('#ffffff');
    }
  }, [visible, initialBadges]);

  // 배지 드래그 핸들러
  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const newBadges = [...badges];
    const draggedBadge = newBadges[draggedIndex];
    newBadges.splice(draggedIndex, 1);
    newBadges.splice(index, 0, draggedBadge);
    
    const reorderedBadges = newBadges.map((badge, idx) => ({
      ...badge,
      order: idx + 1
    }));
    
    setBadges(reorderedBadges);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // 배지 추가
  const handleAddBadge = () => {
    const text = form.getFieldValue('badge_text');
    
    if (!text || !text.trim()) {
      return;
    }
    
    if (badges.length >= 10) {
      message.warning('배지는 최대 10개까지 등록 가능합니다');
      return;
    }
    
    const newBadge = {
      text: text.trim(),
      color: bgColor,
      text_color: textColor,
      order: badges.length + 1
    };
    
    setBadges([...badges, newBadge]);
    form.setFieldsValue({ badge_text: '' });
    
    // 배지 프리셋 저장
    saveBadgePreset(text.trim(), bgColor, textColor);
  };

  // 프리셋 클릭 - 텍스트와 색상 적용
  const handlePresetClick = (preset) => {
    form.setFieldsValue({ badge_text: preset.text });
    setBgColor(preset.bg_color);
    setTextColor(preset.text_color);
  };

  // 폼 제출 핸들러
  const handleSubmit = async (values) => {
    const submitData = {
      ...values,
      badge_color: bgColor,
      badges: badges.length > 0 ? badges : null
    };
    
    await onSubmit(submitData);
  };

  return (
    <Modal
      title="페이지 매핑"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={680}
      style={{ top: 20 }}
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
          {url}
        </div>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          is_product_page: false
        }}
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

        {/* 페이지 분류 */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          marginBottom: '16px'
        }}>
          <label 
            htmlFor="is_product_page" 
            style={{ 
              fontSize: '14px', 
              color: 'rgba(0, 0, 0, 0.88)',
              fontWeight: '500',
              margin: 0
            }}
          >
            페이지 분류
          </label>
          <Form.Item
            name="is_product_page"
            valuePropName="checked"
            style={{ margin: 0 }}
          >
            <Switch
              checkedChildren="상품 페이지"
              unCheckedChildren="일반 페이지"
            />
          </Form.Item>
        </div>

        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) => prevValues.is_product_page !== currentValues.is_product_page}
        >
          {({ getFieldValue }) =>
            getFieldValue('is_product_page') ? (
              <div style={{
                padding: '20px',
                background: '#f8fafc',
                borderRadius: '12px',
                marginBottom: '16px',
                border: '1px solid #e2e8f0'
              }}>
                <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 16, fontSize: '15px', color: '#334155', fontWeight: 600 }}>
                  📦 제품 배지 설정
                </Typography.Title>

                {/* 뱃지 텍스트 입력 */}
                <Form.Item
                  name="badge_text"
                  label="뱃지 텍스트 입력"
                  rules={[
                    {
                      validator: (_, value) => {
                        if (badges.length > 0) return Promise.resolve();
                        if (!value || !value.trim()) {
                          return Promise.reject(new Error('뱃지 텍스트를 입력해주세요'));
                        }
                        return Promise.resolve();
                      }
                    }
                  ]}
                  style={{ marginBottom: 16 }}
                >
                  <Input
                    placeholder="예: 모로실"
                    maxLength={10}
                    style={{ width: '100%' }}
                  />
                </Form.Item>

                {/* 최근 사용한 배지 */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ marginBottom: '8px', fontSize: '13px', color: 'rgba(0, 0, 0, 0.65)' }}>
                    📌 최근 사용한 배지 (클릭 시 자동 적용)
                  </div>
                  <div style={{
                    padding: '12px',
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    minHeight: '48px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    alignItems: 'center'
                  }}>
                    {loadingPresets ? (
                      <span style={{ color: '#9ca3af', fontSize: '12px' }}>로딩 중...</span>
                    ) : badgePresets.length === 0 ? (
                      <span style={{ color: '#9ca3af', fontSize: '12px' }}>
                        아직 저장된 배지가 없습니다. 배지를 추가하면 여기에 표시됩니다.
                      </span>
                    ) : (
                      badgePresets.map((preset) => (
                        <div
                          key={preset.id}
                          style={{ position: 'relative', display: 'inline-block' }}
                          onMouseEnter={() => setHoveredPresetId(preset.id)}
                          onMouseLeave={() => setHoveredPresetId(null)}
                        >
                          <span
                            onClick={() => handlePresetClick(preset)}
                            style={{
                              display: 'inline-block',
                              padding: '4px 12px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: '600',
                              color: preset.text_color,
                              backgroundColor: preset.bg_color,
                              cursor: 'pointer',
                              transition: 'transform 0.15s, box-shadow 0.15s',
                              boxShadow: hoveredPresetId === preset.id ? '0 2px 8px rgba(0,0,0,0.15)' : '0 1px 2px rgba(0,0,0,0.1)',
                              transform: hoveredPresetId === preset.id ? 'scale(1.05)' : 'scale(1)'
                            }}
                          >
                            {preset.text}
                          </span>
                          {hoveredPresetId === preset.id && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteBadgePreset(preset.id);
                              }}
                              style={{
                                position: 'absolute',
                                top: '-6px',
                                right: '-6px',
                                width: '18px',
                                height: '18px',
                                borderRadius: '50%',
                                background: '#ef4444',
                                color: '#fff',
                                border: 'none',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                lineHeight: 1,
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                              }}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 배경색 / 글자색 선택 */}
                <div style={{ display: 'flex', gap: '16px', marginBottom: 20 }}>
                  <ColorPickerInput
                    color={bgColor}
                    onChange={setBgColor}
                    label="배경색"
                  />
                  <ColorPickerInput
                    color={textColor}
                    onChange={setTextColor}
                    label="글자색"
                  />
                </div>

                {/* 미리보기 + 배지 추가 버튼 */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '16px',
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  marginBottom: 16
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#6b7280' }}>미리보기:</span>
                    <span style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>제품:</span>
                    <Form.Item shouldUpdate noStyle>
                      {({ getFieldValue }) => {
                        const text = getFieldValue('badge_text') || '뱃지 텍스트';
                        return (
                          <div style={{
                            display: 'flex',
                            height: 36,
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                            padding: '4px 12px',
                            borderRadius: '4px',
                            fontSize: '13px',
                            fontWeight: '600',
                            color: textColor,
                            backgroundColor: bgColor,
                            boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                          }}>
                            {text}
                          </div>
                        );
                      }}
                    </Form.Item>
                  </div>
                  <Button
                    type="primary"
                    size="small"
                    onClick={handleAddBadge}
                    disabled={badges.length >= 10}
                    style={{ fontWeight: '600' }}
                  >
                    + 배지 추가
                  </Button>
                </div>

                {/* 등록된 배지 리스트 */}
                <div style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  background: '#fff'
                }}>
                  <div style={{
                    padding: '10px 12px',
                    borderBottom: '1px solid #e2e8f0',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#374151',
                    background: '#f9fafb'
                  }}>
                    📋 등록된 배지 ({badges.length}개)
                  </div>
                  
                  <div style={{ padding: '8px', maxHeight: '150px', overflow: 'auto' }}>
                    {badges.length === 0 ? (
                      <div style={{
                        textAlign: 'center',
                        padding: '20px',
                        color: '#9ca3af',
                        fontSize: '12px'
                      }}>
                        등록된 배지가 없습니다
                      </div>
                    ) : (
                      badges.map((badge, idx) => (
                        <div
                          key={idx}
                          draggable
                          onDragStart={() => handleDragStart(idx)}
                          onDragOver={(e) => handleDragOver(e, idx)}
                          onDragEnd={handleDragEnd}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px',
                            marginBottom: '4px',
                            background: draggedIndex === idx ? '#e0e7ff' : '#f9fafb',
                            border: '1px solid #e5e7eb',
                            borderRadius: '6px',
                            cursor: 'move',
                            opacity: draggedIndex === idx ? 0.5 : 1,
                            transition: 'all 0.2s'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: '#9ca3af', fontSize: '16px', cursor: 'grab' }}>⋮⋮</span>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: '600',
                                color: badge.text_color || '#fff',
                                backgroundColor: badge.color
                              }}
                            >
                              {badge.text}
                            </span>
                          </div>
                          <Button
                            type="text"
                            danger
                            size="small"
                            onClick={() => {
                              const newBadges = badges.filter((_, i) => i !== idx);
                              setBadges(newBadges.map((b, i) => ({ ...b, order: i + 1 })));
                            }}
                            style={{ padding: '0 8px' }}
                          >
                            ×
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : null
          }
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
          <Space>
            <Button onClick={onClose}>
              취소
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
            >
              저장
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default MappingModal;
