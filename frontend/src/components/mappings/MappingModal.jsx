import React from 'react';
import { Modal, Form, Input, Button, Space, Typography } from 'antd';

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
