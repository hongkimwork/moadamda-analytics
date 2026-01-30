/**
 * Login Page
 * 이메일/비밀번호 로그인 폼
 */
import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, message, Space } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { BarChart3 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const { Title, Text } = Typography;

function LoginPage() {
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      await login(values.email, values.password);
      message.success('로그인되었습니다.');
    } catch (error) {
      const errorMessage = error.response?.data?.error || '로그인에 실패했습니다.';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #001529 0%, #003a70 100%)'
    }}>
      <Card
        style={{
          width: 400,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          borderRadius: 12
        }}
        bodyStyle={{ padding: '40px 32px' }}
      >
        {/* 로고 및 타이틀 */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Space align="center" size={12}>
            <BarChart3 size={36} color="#1890ff" />
            <Title level={3} style={{ margin: 0, color: '#001529' }}>
              Moadamda Analytics
            </Title>
          </Space>
          <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
            대시보드에 로그인하세요
          </Text>
        </div>

        {/* 로그인 폼 */}
        <Form
          name="login"
          onFinish={onFinish}
          layout="vertical"
          size="large"
        >
          <Form.Item
            name="email"
            rules={[
              { required: true, message: '이메일을 입력해주세요.' },
              { type: 'email', message: '유효한 이메일 형식이 아닙니다.' }
            ]}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="이메일"
              autoComplete="email"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: '비밀번호를 입력해주세요.' }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="비밀번호"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              style={{ height: 44 }}
            >
              로그인
            </Button>
          </Form.Item>
        </Form>

        {/* 안내 메시지 */}
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            계정이 없으신가요? 관리자에게 문의하세요.
          </Text>
        </div>
      </Card>
    </div>
  );
}

export default LoginPage;
