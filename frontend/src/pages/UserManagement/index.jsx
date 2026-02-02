/**
 * User Management Page
 * 사용자 목록 조회, 등록, 삭제
 */
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Table, Button, Modal, Form, Input, Select, Space, Tag, 
  message, Popconfirm, Card, Typography, Row, Col, Statistic, Input as AntInput
} from 'antd';
import { 
  PlusOutlined, DeleteOutlined, UserOutlined, 
  CrownOutlined, SafetyOutlined, MailOutlined, 
  LockOutlined, SearchOutlined, TeamOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { useAuth } from '../../contexts/AuthContext';

const { Title, Text } = Typography;

// API 기본 URL
const API_BASE = import.meta.env.DEV ? 'http://localhost:3003' : '';

function UserManagement() {
  const { user: currentUser, getAuthHeaders, isMaster } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
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
      // confirmPassword 필드 제외하고 전송
      // eslint-disable-next-line no-unused-vars
      const { confirmPassword, ...submitData } = values;
      
      await axios.post(`${API_BASE}/api/users`, submitData, {
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
        return { icon: <CrownOutlined />, color: 'volcano', text: '마스터' };
      case 'admin':
        return { icon: <SafetyCertificateOutlined />, color: 'blue', text: '관리자' };
      default:
        return { icon: <UserOutlined />, color: 'green', text: '일반 사용자' };
    }
  };

  // 테이블 컬럼 정의
  const columns = [
    {
      title: '사용자 정보',
      key: 'userInfo',
      width: 300,
      render: (_, record) => (
        <Space>
          <div style={{ 
            width: 40, height: 40, borderRadius: '50%', 
            backgroundColor: '#e3f2fd', display: 'flex', // M3 tonal surface
            alignItems: 'center', justifyContent: 'center',
            color: '#1890ff', fontSize: 18
          }}>
            {record.name.charAt(0)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <Text strong style={{ fontSize: 16 }}>{record.name}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>{record.email}</Text>
          </div>
        </Space>
      )
    },
    {
      title: '권한',
      dataIndex: 'role',
      key: 'role',
      width: 150,
      render: (role) => {
        const { icon, color, text } = getRoleDisplay(role);
        return (
          <Tag icon={icon} color={color} style={{ padding: '4px 12px', borderRadius: 16, border: 'none' }}>
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
      render: (date) => (
        <Text type="secondary">
          {dayjs(date).format('YYYY-MM-DD')}
        </Text>
      )
    },
    {
      title: '관리',
      key: 'action',
      width: 100,
      align: 'center',
      render: (_, record) => (
        canDelete(record) ? (
          <Popconfirm
            title="사용자 삭제"
            description={
              <div>
                <Text strong>{record.name}</Text>님을 삭제하시겠습니까?<br/>
                <Text type="secondary" style={{ fontSize: 12 }}>이 작업은 되돌릴 수 없습니다.</Text>
              </div>
            }
            onConfirm={() => handleDelete(record.id)}
            okText="삭제"
            cancelText="취소"
            okButtonProps={{ danger: true, shape: 'round' }}
            cancelButtonProps={{ shape: 'round' }}
          >
            <Button 
              type="text" 
              danger 
              icon={<DeleteOutlined />}
              shape="circle"
            />
          </Popconfirm>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>-</Text>
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

  // 검색 필터링
  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchText.toLowerCase()) ||
    user.email.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto', fontFamily: 'Roboto, sans-serif' }}>
      {/* 상단 헤더 영역 */}
      <div style={{ marginBottom: 32 }}>
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col>
            <Title level={2} style={{ margin: 0, fontWeight: 400 }}>사용자 관리</Title>
            <Text type="secondary">시스템 접근 권한을 가진 사용자를 관리합니다.</Text>
          </Col>
          <Col>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              size="large"
              onClick={() => setModalVisible(true)}
              style={{ 
                borderRadius: 16, // M3 Extended FAB style
                height: 56,
                paddingLeft: 24,
                paddingRight: 24,
                boxShadow: '0 4px 8px rgba(0,0,0,0.12)'
              }}
            >
              새 사용자 등록
            </Button>
          </Col>
        </Row>
      </div>

      {/* 통계 및 검색 영역 */}
      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card 
            bordered={false} 
            bodyStyle={{ padding: 24 }}
            style={{ 
              borderRadius: 16, // M3 Card radius
              boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
              height: '100%'
            }}
          >
            <Statistic 
              title={<Text type="secondary">총 사용자</Text>}
              value={users.length} 
              prefix={<TeamOutlined style={{ color: '#1890ff' }} />} 
              suffix="명"
              valueStyle={{ fontWeight: 500 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={16}>
          <Card 
            bordered={false} 
            bodyStyle={{ padding: 24, height: '100%', display: 'flex', alignItems: 'center' }}
            style={{ 
              borderRadius: 16,
              boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
              height: '100%'
            }}
          >
            <div style={{ 
              width: '100%', 
              backgroundColor: '#f1f3f4', // M3 Surface Variant
              borderRadius: 28, // M3 Search Bar (Pill shape)
              padding: '4px 16px',
              display: 'flex',
              alignItems: 'center'
            }}>
              <SearchOutlined style={{ color: '#5f6368', fontSize: 20, marginRight: 12 }} />
              <AntInput
                size="large"
                placeholder="이름 또는 이메일로 검색"
                onChange={e => setSearchText(e.target.value)}
                style={{ 
                  width: '100%', 
                  border: 'none', 
                  boxShadow: 'none', 
                  padding: 0,
                  backgroundColor: 'transparent',
                  height: 48
                }}
                bordered={false}
              />
            </div>
          </Card>
        </Col>
      </Row>

      {/* 사용자 목록 테이블 */}
      <Card 
        bordered={false} 
        bodyStyle={{ padding: 0 }}
        style={{ 
          borderRadius: 16,
          boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
          overflow: 'hidden'
        }}
      >
        <Table
          columns={columns}
          dataSource={filteredUsers}
          rowKey="id"
          loading={loading}
          pagination={{ 
            pageSize: 10,
            showTotal: (total) => `총 ${total}명`,
            position: ['bottomCenter'],
            style: { padding: 16 }
          }}
        />
      </Card>

      {/* 사용자 등록 모달 */}
      <Modal
        title={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 16 }}>
            <div style={{ fontSize: 24, fontWeight: 400 }}>새 사용자 등록</div>
            <Text type="secondary" style={{ fontSize: 14, fontWeight: 400 }}>새로운 사용자의 정보를 입력해주세요.</Text>
          </div>
        }
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={400}
        centered
        style={{ borderRadius: 28, overflow: 'hidden', padding: 0 }}
        bodyStyle={{ padding: '0 24px 24px' }}
        maskStyle={{ backgroundColor: 'rgba(0, 0, 0, 0.32)' }} // M3 Scrim
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
          requiredMark={false}
        >
          <Form.Item
            name="name"
            rules={[{ required: true, message: '이름을 입력해주세요.' }]}
            style={{ marginBottom: 24 }}
          >
            <Input 
              prefix={<UserOutlined style={{ color: '#757575' }} />} 
              placeholder="이름" 
              size="large"
              style={{ borderRadius: 4, backgroundColor: '#f5f5f5', border: 'none', height: 56 }} // M3 Filled Text Field style
            />
          </Form.Item>

          <Form.Item
            name="email"
            rules={[
              { required: true, message: '이메일을 입력해주세요.' },
              { type: 'email', message: '유효한 이메일 형식이 아닙니다.' }
            ]}
            style={{ marginBottom: 24 }}
          >
            <Input 
              prefix={<MailOutlined style={{ color: '#757575' }} />} 
              placeholder="이메일" 
              size="large"
              style={{ borderRadius: 4, backgroundColor: '#f5f5f5', border: 'none', height: 56 }}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="password"
                rules={[
                  { required: true, message: '비밀번호를 입력해주세요.' },
                  { min: 6, message: '최소 6자 이상' }
                ]}
                style={{ marginBottom: 24 }}
              >
                <Input.Password 
                  prefix={<LockOutlined style={{ color: '#757575' }} />}
                  placeholder="비밀번호" 
                  size="large"
                  style={{ borderRadius: 4, backgroundColor: '#f5f5f5', border: 'none', height: 56 }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="confirmPassword"
                dependencies={['password']}
                rules={[
                  { required: true, message: '비밀번호를 다시 입력해주세요.' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('불일치'));
                    },
                  }),
                ]}
                style={{ marginBottom: 24 }}
              >
                <Input.Password 
                  prefix={<LockOutlined style={{ color: '#757575' }} />}
                  placeholder="확인" 
                  size="large"
                  style={{ borderRadius: 4, backgroundColor: '#f5f5f5', border: 'none', height: 56 }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="role"
            rules={[{ required: true, message: '권한을 선택해주세요.' }]}
            initialValue="user"
            style={{ marginBottom: 32 }}
          >
            <Select 
              placeholder="권한 선택" 
              size="large"
              options={roleOptions}
              style={{ height: 56 }}
              dropdownStyle={{ borderRadius: 4 }}
            />
          </Form.Item>

          <div style={{ 
            display: 'flex', 
            justifyContent: 'flex-end',
            gap: 8
          }}>
            <Button 
              type="text"
              size="large"
              onClick={() => {
                setModalVisible(false);
                form.resetFields();
              }}
              style={{ borderRadius: 20, fontWeight: 500, color: '#1890ff' }}
            >
              취소
            </Button>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={modalLoading}
              size="large"
              style={{ borderRadius: 20, paddingLeft: 24, paddingRight: 24, fontWeight: 500 }}
            >
              등록
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

export default UserManagement;
