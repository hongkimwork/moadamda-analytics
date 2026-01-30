/**
 * User Management Page
 * 사용자 목록 조회, 등록, 삭제
 */
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Table, Button, Modal, Form, Input, Select, Space, Tag, 
  message, Popconfirm, Card, Typography 
} from 'antd';
import { 
  PlusOutlined, DeleteOutlined, UserOutlined, 
  CrownOutlined, SafetyOutlined 
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { useAuth } from '../../contexts/AuthContext';

const { Title } = Typography;

// API 기본 URL
const API_BASE = import.meta.env.DEV ? 'http://localhost:3003' : '';

function UserManagement() {
  const { user: currentUser, getAuthHeaders, isMaster } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [form] = Form.useForm();

  // 사용자 목록 조회
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/api/users`, {
        headers: getAuthHeaders()
      });
      setUsers(response.data.users);
    } catch (error) {
      const errorMessage = error.response?.data?.error || '사용자 목록 조회에 실패했습니다.';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // 사용자 등록
  const handleCreate = async (values) => {
    setModalLoading(true);
    try {
      await axios.post(`${API_BASE}/api/users`, values, {
        headers: getAuthHeaders()
      });
      message.success('사용자가 등록되었습니다.');
      setModalVisible(false);
      form.resetFields();
      fetchUsers();
    } catch (error) {
      const errorMessage = error.response?.data?.error || '사용자 등록에 실패했습니다.';
      message.error(errorMessage);
    } finally {
      setModalLoading(false);
    }
  };

  // 사용자 삭제
  const handleDelete = async (userId) => {
    try {
      await axios.delete(`${API_BASE}/api/users/${userId}`, {
        headers: getAuthHeaders()
      });
      message.success('사용자가 삭제되었습니다.');
      fetchUsers();
    } catch (error) {
      const errorMessage = error.response?.data?.error || '사용자 삭제에 실패했습니다.';
      message.error(errorMessage);
    }
  };

  // 삭제 가능 여부 확인
  const canDelete = (targetUser) => {
    // 자기 자신은 삭제 불가
    if (targetUser.id === currentUser.id) return false;
    // 마스터는 삭제 불가
    if (targetUser.role === 'master') return false;
    // 관리자는 다른 관리자 삭제 불가
    if (currentUser.role === 'admin' && targetUser.role === 'admin') return false;
    return true;
  };

  // 권한 아이콘 및 색상
  const getRoleDisplay = (role) => {
    switch (role) {
      case 'master':
        return { icon: <CrownOutlined />, color: 'red', text: '마스터' };
      case 'admin':
        return { icon: <SafetyOutlined />, color: 'blue', text: '관리자' };
      default:
        return { icon: <UserOutlined />, color: 'green', text: '일반 사용자' };
    }
  };

  // 테이블 컬럼 정의
  const columns = [
    {
      title: '이름',
      dataIndex: 'name',
      key: 'name',
      width: 150
    },
    {
      title: '이메일',
      dataIndex: 'email',
      key: 'email',
      width: 250
    },
    {
      title: '권한',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (role) => {
        const { icon, color, text } = getRoleDisplay(role);
        return (
          <Tag icon={icon} color={color}>
            {text}
          </Tag>
        );
      }
    },
    {
      title: '등록일',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '작업',
      key: 'action',
      width: 100,
      render: (_, record) => (
        canDelete(record) ? (
          <Popconfirm
            title="사용자 삭제"
            description={`${record.name}님을 삭제하시겠습니까?`}
            onConfirm={() => handleDelete(record.id)}
            okText="삭제"
            cancelText="취소"
            okButtonProps={{ danger: true }}
          >
            <Button 
              type="text" 
              danger 
              icon={<DeleteOutlined />}
              size="small"
            >
              삭제
            </Button>
          </Popconfirm>
        ) : (
          <span style={{ color: '#ccc', fontSize: 12 }}>-</span>
        )
      )
    }
  ];

  // 등록 가능한 권한 옵션
  const roleOptions = isMaster()
    ? [
        { value: 'admin', label: '관리자' },
        { value: 'user', label: '일반 사용자' }
      ]
    : [
        { value: 'user', label: '일반 사용자' }
      ];

  return (
    <div style={{ padding: 24 }}>
      <Card>
        {/* 헤더 */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: 24
        }}>
          <Title level={4} style={{ margin: 0 }}>사용자 관리</Title>
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => setModalVisible(true)}
          >
            새 사용자 등록
          </Button>
        </div>

        {/* 사용자 목록 테이블 */}
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
          size="middle"
        />
      </Card>

      {/* 사용자 등록 모달 */}
      <Modal
        title="새 사용자 등록"
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={400}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="name"
            label="이름"
            rules={[{ required: true, message: '이름을 입력해주세요.' }]}
          >
            <Input placeholder="홍길동" />
          </Form.Item>

          <Form.Item
            name="email"
            label="이메일"
            rules={[
              { required: true, message: '이메일을 입력해주세요.' },
              { type: 'email', message: '유효한 이메일 형식이 아닙니다.' }
            ]}
          >
            <Input placeholder="user@example.com" />
          </Form.Item>

          <Form.Item
            name="password"
            label="임시 비밀번호"
            rules={[
              { required: true, message: '비밀번호를 입력해주세요.' },
              { min: 6, message: '최소 6자 이상 입력해주세요.' }
            ]}
          >
            <Input.Password placeholder="최소 6자 이상" />
          </Form.Item>

          <Form.Item
            name="role"
            label="권한"
            rules={[{ required: true, message: '권한을 선택해주세요.' }]}
          >
            <Select placeholder="권한 선택" options={roleOptions} />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => {
                setModalVisible(false);
                form.resetFields();
              }}>
                취소
              </Button>
              <Button type="primary" htmlType="submit" loading={modalLoading}>
                등록
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default UserManagement;
