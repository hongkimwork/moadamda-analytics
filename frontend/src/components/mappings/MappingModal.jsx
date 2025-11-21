import { Modal, Form, Input, Button, Space, Typography, Switch } from 'antd';
import { SketchPicker } from 'react-color';

const { Text } = Typography;

/**
 * MappingModal - 페이지 매핑 모달
 *
 * @param {boolean} visible - 모달 표시 여부
 * @param {function} onClose - 모달 닫기 핸들러
 * @param {function} onSubmit - 매핑 저장 핸들러
 * @param {string} url - 매핑할 URL
 * @param {object} form - Ant Design Form 인스턴스
 * @param {boolean} submitting - 저장 중 여부
 */
function MappingModal({ visible, onClose, onSubmit, url, form, submitting }) {
  return (
    <Modal
      title="페이지 매핑"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={600}
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
        onFinish={onSubmit}
        initialValues={{
          is_product_page: false,
          badge_color: '#1677ff' // Default blue
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

        <Form.Item
          name="is_product_page"
          label="페이지 분류"
          valuePropName="checked"
          style={{ marginBottom: 24 }}
        >
          <Switch
            checkedChildren="상품 페이지"
            unCheckedChildren="일반 페이지"
          />
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) => prevValues.is_product_page !== currentValues.is_product_page}
        >
          {({ getFieldValue, setFieldsValue }) =>
            getFieldValue('is_product_page') ? (
              <div style={{
                padding: '20px',
                background: '#f8fafc',
                borderRadius: '12px',
                marginBottom: '24px',
                border: '1px solid #e2e8f0'
              }}>
                <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 16, fontSize: '15px', color: '#334155', fontWeight: 600 }}>
                  📦 제품 배지 설정
                </Typography.Title>

                {/* 뱃지 텍스트 - 상단 전체 너비 */}
                <Form.Item
                  name="badge_text"
                  label="뱃지 텍스트"
                  rules={[{ required: true, message: '뱃지 텍스트를 입력해주세요' }]}
                  style={{ marginBottom: 20 }}
                >
                  <Input
                    placeholder="예: 모로실"
                    maxLength={10}
                    style={{ width: '100%' }}
                  />
                </Form.Item>

                {/* 미리보기(좌측) + 색상 선택기(우측) 좌우 분할 */}
                <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                  {/* 좌측: 미리보기 */}
                  <div style={{ flex: 1 }}>
                    <div style={{ marginBottom: '8px', fontSize: '14px', color: 'rgba(0, 0, 0, 0.88)' }}>뱃지 미리보기</div>
                    <div style={{ 
                      background: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '24px',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      height: '320px'
                    }}>
                      <Form.Item shouldUpdate noStyle>
                        {({ getFieldValue }) => {
                          const text = getFieldValue('badge_text') || '뱃지 텍스트';
                          const color = getFieldValue('badge_color') || '#1677ff';

                          return (
                            <div style={{
                              padding: '16px 20px',
                              background: '#f9fafb',
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}>
                              <span style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>제품:</span>
                              <span style={{
                                display: 'inline-block',
                                padding: '4px 12px',
                                borderRadius: '4px',
                                fontSize: '13px',
                                fontWeight: '600',
                                color: '#fff',
                                backgroundColor: color,
                                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                              }}>
                                {text}
                              </span>
                            </div>
                          );
                        }}
                      </Form.Item>
                    </div>
                  </div>

                  {/* 우측: 뱃지 색상 선택기 */}
                  <div style={{ flex: '0 0 auto' }}>
                    <div style={{ marginBottom: '8px', fontSize: '14px', color: 'rgba(0, 0, 0, 0.88)' }}>뱃지 색상</div>
                    <Form.Item
                      name="badge_color"
                      noStyle
                      rules={[{ required: true, message: '색상을 선택해주세요' }]}
                    >
                      <Input type="hidden" />
                    </Form.Item>

                    <Form.Item shouldUpdate noStyle>
                      {({ getFieldValue }) => (
                        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', display: 'inline-block' }}>
                          <SketchPicker
                            color={getFieldValue('badge_color') || '#1677ff'}
                            onChange={(color) => setFieldsValue({ badge_color: color.hex })}
                            disableAlpha={true}
                            presetColors={[
                              '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981',
                              '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef',
                              '#f43f5e', '#64748b', '#1677ff'
                            ]}
                            styles={{
                              default: {
                                picker: {
                                  boxShadow: 'none',
                                  padding: '10px',
                                  background: '#fff',
                                  width: '220px',
                                  borderRadius: 0
                                }
                              }
                            }}
                          />
                        </div>
                      )}
                    </Form.Item>
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
