import React from 'react';
import { Modal, Form, Input, Button, Space, Card, Typography, Divider, Tooltip } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  MinusCircleOutlined,
  InfoCircleOutlined,
  GlobalOutlined,
  LinkOutlined,
  SettingOutlined
} from '@ant-design/icons';

const { Text } = Typography;

/**
 * ManualAddModal - URL 수동 추가 모달
 *
 * @param {boolean} visible - 모달 표시 여부
 * @param {function} onClose - 모달 닫기 핸들러
 * @param {function} onSubmit - 저장 핸들러
 * @param {object} form - Ant Design Form 인스턴스
 * @param {boolean} submitting - 저장 중 여부
 * @param {array} urlGroups - URL 그룹 배열
 * @param {function} onUrlInputChange - URL 입력 변경 핸들러
 * @param {function} onUpdateBaseUrl - 베이스 URL 변경 핸들러
 * @param {function} onUpdateParam - 파라미터 변경 핸들러
 * @param {function} onAddParam - 파라미터 추가 핸들러
 * @param {function} onRemoveParam - 파라미터 제거 핸들러
 * @param {function} onAddUrlGroup - URL 그룹 추가 핸들러
 * @param {function} onRemoveUrlGroup - URL 그룹 제거 핸들러
 */
function ManualAddModal({
  visible,
  onClose,
  onSubmit,
  form,
  submitting,
  urlGroups,
  onUrlInputChange,
  onUpdateBaseUrl,
  onUpdateParam,
  onAddParam,
  onRemoveParam,
  onAddUrlGroup,
  onRemoveUrlGroup
}) {
  return (
    <Modal
      title={
        <Space>
          <PlusOutlined />
          <span>URL 수동 추가</span>
          <Tooltip
            title={
              <div>
                여러 URL을 OR 연산으로 묶을 수 있습니다.<br />
                아래 URL 중 하나라도 일치하면 매핑됩니다.<br /><br />
                <strong>예:</strong> 상품 A, B, C를 "프리미엄 상품군"으로 통합
              </div>
            }
          >
            <InfoCircleOutlined style={{ color: '#1890FF', cursor: 'help' }} />
          </Tooltip>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={800}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={onSubmit}
      >
        {urlGroups.map((group, groupIndex) => (
          <div key={groupIndex}>
            <Card
              size="small"
              style={{
                marginBottom: 16,
                background: '#F5F5F5',
                border: '1px solid #D9D9D9',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                borderRadius: 8
              }}
              title={
                <Space>
                  <Text strong>URL 조건 {groupIndex + 1}</Text>
                  {urlGroups.length > 1 && (
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => onRemoveUrlGroup(groupIndex)}
                    >
                      삭제
                    </Button>
                  )}
                </Space>
              }
            >
              {/* Full URL Input with Auto-Parse */}
              <div style={{
                marginBottom: 16,
                padding: 12,
                background: '#FFFFFF',
                border: '1px solid #D9D9D9',
                borderRadius: 6
              }}>
                <Space style={{ marginBottom: 4 }}>
                  <GlobalOutlined style={{ color: '#8C8C8C' }} />
                  <Text strong style={{ fontSize: '13px' }}>전체 URL</Text>
                  <Tooltip
                    title={
                      <div>
                        쿼리 파라미터 포함 URL을 입력하면<br />
                        자동으로 베이스 URL과 매개변수로 분리됩니다.<br /><br />
                        <strong>예:</strong> https://example.com/product?no=1001<br />
                        → 베이스: https://example.com/product<br />
                        → 매개변수: no = 1001
                      </div>
                    }
                  >
                    <InfoCircleOutlined style={{ color: '#8C8C8C', cursor: 'help', fontSize: '12px' }} />
                  </Tooltip>
                </Space>
                <Input
                  placeholder="예: https://m.moadamda.com/product/detail?no=1001"
                  onChange={(e) => onUrlInputChange(groupIndex, e.target.value)}
                />
              </div>

              {/* Base URL */}
              <div style={{
                marginBottom: 16,
                padding: 12,
                background: '#FFFFFF',
                border: '1px solid #D9D9D9',
                borderRadius: 6
              }}>
                <Space style={{ marginBottom: 4 }}>
                  <LinkOutlined style={{ color: '#8C8C8C' }} />
                  <Text strong style={{ fontSize: '13px' }}>베이스 URL <span style={{ color: 'red' }}>*</span></Text>
                </Space>
                <Input
                  value={group.baseUrl}
                  onChange={(e) => onUpdateBaseUrl(groupIndex, e.target.value)}
                  placeholder="예: https://m.moadamda.com/product/detail"
                />
              </div>

              {/* Parameters */}
              <div style={{
                padding: 16,
                background: '#FFFFFF',
                border: '1px solid #D9D9D9',
                borderRadius: 6
              }}>
                <Space style={{ marginBottom: 12 }}>
                  <SettingOutlined style={{ color: '#8C8C8C' }} />
                  <Text strong style={{ fontSize: '13px' }}>매개변수</Text>
                  <Tooltip
                    title={
                      <div>
                        모든 매개변수가 일치해야 합니다 (AND 연산)<br /><br />
                        <strong>예:</strong> no=1001 AND color=black<br />
                        → 두 조건 모두 만족하는 URL만 매핑
                      </div>
                    }
                  >
                    <InfoCircleOutlined style={{ color: '#8C8C8C', cursor: 'help', fontSize: '12px' }} />
                  </Tooltip>
                </Space>

                {group.params.map((param, paramIndex) => (
                  <Space key={paramIndex} style={{ width: '100%', marginBottom: 8 }} align="start">
                    <Input
                      placeholder="키 (예: no)"
                      value={param.key}
                      onChange={(e) => onUpdateParam(groupIndex, paramIndex, 'key', e.target.value)}
                      style={{ width: 150 }}
                    />
                    <Input
                      placeholder="값 (예: 1001)"
                      value={param.value}
                      onChange={(e) => onUpdateParam(groupIndex, paramIndex, 'value', e.target.value)}
                      style={{ width: 150 }}
                    />
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<MinusCircleOutlined />}
                      onClick={() => onRemoveParam(groupIndex, paramIndex)}
                      disabled={group.params.length === 1}
                    />
                  </Space>
                ))}

                <Button
                  type="dashed"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => onAddParam(groupIndex)}
                  block
                >
                  매개변수 추가
                </Button>
              </div>
            </Card>

            {groupIndex < urlGroups.length - 1 && (
              <div style={{
                textAlign: 'center',
                margin: '20px 0',
                padding: '12px',
                background: '#F5F5F5',
                border: '1px solid #D9D9D9',
                borderRadius: 8
              }}>
                <Text strong style={{
                  color: '#595959',
                  fontSize: '13px',
                  letterSpacing: '1px'
                }}>
                  OR 연산
                </Text>
              </div>
            )}
          </div>
        ))}

        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={onAddUrlGroup}
          block
          style={{
            marginBottom: 24,
            height: 40,
            fontSize: '14px',
            borderWidth: 2
          }}
        >
          URL 조건 추가
        </Button>

        <Divider style={{ margin: '24px 0' }} />

        {/* Korean Name */}
        <Form.Item
          name="korean_name"
          label={
            <Space>
              <Text strong>매핑명</Text>
              <span style={{ color: 'red' }}>*</span>
            </Space>
          }
          rules={[
            { required: true, message: '매핑명을 입력해주세요' },
            { whitespace: true, message: '공백만 입력할 수 없습니다' },
            { max: 255, message: '최대 255자까지 입력 가능합니다' }
          ]}
        >
          <Input
            placeholder="예: 프리미엄 상품군"
            size="large"
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
          <Space size="middle">
            <Button
              size="large"
              onClick={onClose}
            >
              취소
            </Button>
            <Button
              type="primary"
              size="large"
              htmlType="submit"
              loading={submitting}
              icon={<PlusOutlined />}
            >
              추가
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default ManualAddModal;
