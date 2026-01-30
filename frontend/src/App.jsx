import React, { useState, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Spin, ConfigProvider, Dropdown, Avatar, Space, message, Form, Input, Button } from 'antd';
import koKR from 'antd/locale/ko_KR';
import { 
  ShoppingOutlined, 
  DatabaseOutlined, 
  UserOutlined, 
  ClockCircleOutlined,
  EyeOutlined,
  ThunderboltOutlined,
  DollarOutlined,
  GlobalOutlined,
  LinkOutlined,
  ExperimentOutlined,
  BarChartOutlined,
  SettingOutlined,
  AppstoreOutlined,
  TeamOutlined,
  LogoutOutlined,
  KeyOutlined,
  DownOutlined
} from '@ant-design/icons';
import { BarChart3 } from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import './index.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// dayjs 전역 로케일 설정
dayjs.locale('ko');

// Lazy load pages for code splitting (reduces initial bundle size)
// Named exports from OrderAnalysis are wrapped to work with lazy loading
const OrderListPage = lazy(() => 
  import('./pages/OrderAnalysis').then(module => ({ default: module.OrderListPage }))
);
const OrderDetailPage = lazy(() => 
  import('./pages/OrderAnalysis').then(module => ({ default: module.OrderDetailPage }))
);
const DataTables = lazy(() => import('./pages/DataTables'));
const PageMapping = lazy(() => import('./pages/PageMapping'));
const CreativePerformance = lazy(() => import('./pages/CreativePerformance/index'));
const MyDashboard = lazy(() => import('./pages/MyDashboard/index'));
const MetaInsights = lazy(() => import('./pages/MetaInsights/index'));
const VisitorAnalysis = lazy(() => import('./pages/VisitorAnalysis/index'));
const OurDataCompare = lazy(() => import('./pages/OurDataCompare/index'));
const LoginPage = lazy(() => import('./pages/Login/index'));
const UserManagement = lazy(() => import('./pages/UserManagement/index'));

const { Sider, Content, Header } = Layout;

// ============================================================================
// 메인 레이아웃 컴포넌트
// ============================================================================

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout, isAdmin } = useAuth();

  // 현재 경로에서 선택된 메뉴 키 계산
  const getSelectedKeys = () => {
    const path = location.pathname;
    if (path === '/creative-performance') return ['creative-performance'];
    if (path === '/our-data-compare') return ['our-data-compare'];
    if (path === '/visitor-analysis') return ['visitor-analysis'];
    if (path === '/my-dashboard') return ['my-dashboard'];
    if (path === '/meta-insights') return ['meta-insights'];
    if (path === '/page-mapping') return ['page-mapping'];
    if (path === '/user-management') return ['user-management'];
    if (path.startsWith('/order/')) return ['orders'];
    if (path === '/' || path.startsWith('/order')) return ['orders'];
    if (path.startsWith('/data/')) return [path];
    return ['orders'];
  };

  // 로그아웃 처리
  const handleLogout = async () => {
    try {
      await logout();
      message.success('로그아웃되었습니다.');
    } catch (error) {
      message.error('로그아웃 중 오류가 발생했습니다.');
    }
  };

  // 권한 표시 텍스트
  const getRoleText = (role) => {
    switch (role) {
      case 'master': return '마스터';
      case 'admin': return '관리자';
      default: return '일반 사용자';
    }
  };

  // 프로필 드롭다운 메뉴
  const profileMenuItems = [
    {
      key: 'info',
      icon: <UserOutlined />,
      label: '내 정보',
      onClick: () => navigate('/my-profile')
    },
    {
      key: 'password',
      icon: <KeyOutlined />,
      label: '비밀번호 변경',
      onClick: () => navigate('/change-password')
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '로그아웃',
      onClick: handleLogout
    }
  ];

  // 메뉴 아이템 정의
  const menuItems = [
    {
      key: 'lab',
      icon: <ExperimentOutlined />,
      label: '실험실',
      children: [
        {
          key: 'orders',
          icon: <ShoppingOutlined />,
          label: '주문 분석',
          onClick: () => navigate('/')
        },
        {
          key: 'meta-insights',
          icon: <GlobalOutlined />,
          label: '메타 성과 조회',
          onClick: () => navigate('/meta-insights')
        },
        {
          key: 'my-dashboard',
          icon: <AppstoreOutlined />,
          label: '나만의 대시보드',
          onClick: () => navigate('/my-dashboard')
        },
        {
          key: 'creative-performance',
          icon: <BarChartOutlined />,
          label: '광고 성과 파악',
          onClick: () => navigate('/creative-performance')
        },
        {
          key: 'our-data-compare',
          icon: <DatabaseOutlined />,
          label: '카페24 Data 비교',
          onClick: () => navigate('/our-data-compare')
        },
        {
          key: 'visitor-analysis',
          icon: <UserOutlined />,
          label: '방문자 분석',
          onClick: () => navigate('/visitor-analysis')
        }
      ]
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '설정',
      children: [
        {
          key: 'page-mapping',
          icon: <LinkOutlined />,
          label: '페이지 매핑',
          onClick: () => navigate('/page-mapping')
        }
      ]
    },
    {
      key: 'data',
      icon: <DatabaseOutlined />,
      label: '데이터 테이블',
      children: [
        {
          key: '/data/visitors',
          icon: <UserOutlined />,
          label: '방문자',
          onClick: () => navigate('/data/visitors')
        },
        {
          key: '/data/sessions',
          icon: <ClockCircleOutlined />,
          label: '세션',
          onClick: () => navigate('/data/sessions')
        },
        {
          key: '/data/pageviews',
          icon: <EyeOutlined />,
          label: '페이지뷰',
          onClick: () => navigate('/data/pageviews')
        },
        {
          key: '/data/events',
          icon: <ThunderboltOutlined />,
          label: '이벤트',
          onClick: () => navigate('/data/events')
        },
        {
          key: '/data/conversions',
          icon: <DollarOutlined />,
          label: '구매전환',
          onClick: () => navigate('/data/conversions')
        },
        {
          key: '/data/utm-sessions',
          icon: <GlobalOutlined />,
          label: 'UTM 세션',
          onClick: () => navigate('/data/utm-sessions')
        }
        // 실시간 방문자 메뉴 숨김 처리
        // {
        //   key: '/data/realtime-visitors',
        //   icon: <UserOutlined />,
        //   label: '실시간 방문자',
        //   onClick: () => navigate('/data/realtime-visitors')
        // }
      ]
    },
    // 사용자 관리 메뉴 (마스터/관리자만 표시)
    ...(isAdmin() ? [{
      key: 'admin',
      icon: <TeamOutlined />,
      label: '관리',
      children: [
        {
          key: 'user-management',
          icon: <TeamOutlined />,
          label: '사용자 관리',
          onClick: () => navigate('/user-management')
        }
      ]
    }] : [])
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 사이드바 */}
      <Sider 
        collapsible 
        collapsed={collapsed} 
        onCollapse={setCollapsed}
        width={250}
                            style={{ 
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
        }}
      >
        {/* 로고/타이틀 */}
        <div style={{ 
          height: '64px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: 'white',
          fontSize: collapsed ? '18px' : '16px',
          fontWeight: 'bold',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          gap: '8px'
        }}>
          {collapsed ? (
            <BarChart3 size={20} />
          ) : (
            <>
              <BarChart3 size={20} />
              <span>Moadamda Analytics</span>
            </>
          )}
              </div>

        {/* 메뉴 */}
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={getSelectedKeys()}
          defaultOpenKeys={['data', 'lab', 'settings']}
          items={menuItems}
          style={{ borderRight: 0 }}
        />
      </Sider>

      {/* 컨텐츠 영역 */}
      <Layout style={{ marginLeft: collapsed ? 80 : 250, transition: 'margin-left 0.2s' }}>
        {/* 상단 헤더 - 프로필 영역 */}
        <Header style={{ 
          background: '#fff', 
          padding: '0 24px', 
          display: 'flex', 
          justifyContent: 'flex-end', 
          alignItems: 'center',
          boxShadow: '0 1px 4px rgba(0, 0, 0, 0.08)',
          position: 'sticky',
          top: 0,
          zIndex: 10
        }}>
          <Dropdown menu={{ items: profileMenuItems }} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar 
                style={{ backgroundColor: user?.role === 'master' ? '#f5222d' : user?.role === 'admin' ? '#1890ff' : '#52c41a' }}
                icon={<UserOutlined />} 
              />
              <span style={{ fontWeight: 500 }}>{user?.name}</span>
              <span style={{ color: '#999', fontSize: 12 }}>({getRoleText(user?.role)})</span>
              <DownOutlined style={{ fontSize: 10, color: '#999' }} />
            </Space>
          </Dropdown>
        </Header>

        <Content style={{ minHeight: 'calc(100vh - 64px)' }}>
          <Suspense fallback={
            <div style={{ padding: '50px', textAlign: 'center' }}>
              <Spin size="large" tip="로딩 중..." />
            </div>
          }>
            <Routes>
              {/* 주문 분석 */}
              <Route path="/" element={<OrderListPage />} />
              <Route path="/order/:orderId" element={<OrderDetailPage />} />
              
              {/* 광고 소재 분석 */}
              <Route path="/creative-performance" element={<CreativePerformance />} />
              
              {/* 카페24 Data 비교 */}
              <Route path="/our-data-compare" element={<OurDataCompare />} />
              
              {/* 방문자 분석 */}
              <Route path="/visitor-analysis" element={<VisitorAnalysis />} />
              
              {/* 나만의 대시보드 */}
              <Route path="/my-dashboard" element={<MyDashboard />} />
              
              {/* 메타 성과 조회 */}
              <Route path="/meta-insights" element={<MetaInsights />} />
              
              {/* 페이지 매핑 */}
              <Route path="/page-mapping" element={<PageMapping />} />
              
              {/* 데이터 테이블 */}
              <Route path="/data/:tableName" element={<DataTables />} />

              {/* 사용자 관리 (마스터/관리자만) */}
              <Route path="/user-management" element={<UserManagement />} />

              {/* 내 프로필 */}
              <Route path="/my-profile" element={<MyProfilePage />} />
              <Route path="/change-password" element={<ChangePasswordPage />} />
            </Routes>
          </Suspense>
        </Content>
      </Layout>
    </Layout>
  );
}

// ============================================================================
// 내 프로필 페이지
// ============================================================================
function MyProfilePage() {
  const { user } = useAuth();
  
  const getRoleText = (role) => {
    switch (role) {
      case 'master': return '마스터';
      case 'admin': return '관리자';
      default: return '일반 사용자';
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <h2 style={{ marginBottom: 24 }}>내 정보</h2>
        <div style={{ background: '#fff', padding: 24, borderRadius: 8 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontWeight: 500, color: '#666' }}>이름</label>
            <div style={{ fontSize: 16, marginTop: 4 }}>{user?.name}</div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontWeight: 500, color: '#666' }}>이메일</label>
            <div style={{ fontSize: 16, marginTop: 4 }}>{user?.email}</div>
          </div>
          <div>
            <label style={{ fontWeight: 500, color: '#666' }}>권한</label>
            <div style={{ fontSize: 16, marginTop: 4 }}>{getRoleText(user?.role)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 비밀번호 변경 페이지
// ============================================================================
function ChangePasswordPage() {
  const { changePassword } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(false);

  const onFinish = async (values) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    setLoading(true);
    try {
      await changePassword(values.currentPassword, values.newPassword);
      message.success('비밀번호가 변경되었습니다.');
      navigate('/');
    } catch (error) {
      const errorMessage = error.response?.data?.error || '비밀번호 변경에 실패했습니다.';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ maxWidth: 400, margin: '0 auto' }}>
        <h2 style={{ marginBottom: 24 }}>비밀번호 변경</h2>
        <div style={{ background: '#fff', padding: 24, borderRadius: 8 }}>
          <Form layout="vertical" onFinish={onFinish}>
            <Form.Item
              name="currentPassword"
              label="현재 비밀번호"
              rules={[{ required: true, message: '현재 비밀번호를 입력해주세요.' }]}
            >
              <Input.Password />
            </Form.Item>
            <Form.Item
              name="newPassword"
              label="새 비밀번호"
              rules={[
                { required: true, message: '새 비밀번호를 입력해주세요.' },
                { min: 6, message: '최소 6자 이상 입력해주세요.' }
              ]}
            >
              <Input.Password />
            </Form.Item>
            <Form.Item
              name="confirmPassword"
              label="새 비밀번호 확인"
              rules={[{ required: true, message: '새 비밀번호를 다시 입력해주세요.' }]}
            >
              <Input.Password />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block>
                비밀번호 변경
              </Button>
            </Form.Item>
          </Form>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 인증 체크 래퍼
// ============================================================================
function AuthenticatedApp() {
  const { isAuthenticated, loading } = useAuth();

  // 로딩 중
  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f0f2f5'
      }}>
        <Spin size="large" tip="로딩 중..." />
      </div>
    );
  }

  // 로그인하지 않음
  if (!isAuthenticated) {
    return (
      <Suspense fallback={
        <div style={{ 
          minHeight: '100vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}>
          <Spin size="large" />
        </div>
      }>
        <LoginPage />
      </Suspense>
    );
  }

  // 로그인됨
  return <AppLayout />;
}

// ============================================================================
// 메인 App 컴포넌트
// ============================================================================
function App() {
  return (
    <ConfigProvider locale={koKR}>
      <Router>
        <AuthProvider>
          <AuthenticatedApp />
        </AuthProvider>
      </Router>
    </ConfigProvider>
  );
}

export default App;
