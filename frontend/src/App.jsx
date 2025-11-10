import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu } from 'antd';
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
  SettingOutlined
} from '@ant-design/icons';
import { OrderListPage, OrderDetailPage } from './pages/OrderAnalysis';
import OrderAnalysis2Page from './pages/OrderAnalysis2';
import DataTables from './pages/DataTables';
import PageMapping from './pages/PageMapping';
import CreativePerformance from './pages/CreativePerformance';
import './index.css';

const { Sider, Content } = Layout;

// ============================================================================
// 메인 레이아웃 컴포넌트
// ============================================================================

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  // 현재 경로에서 선택된 메뉴 키 계산
  const getSelectedKeys = () => {
    const path = location.pathname;
    if (path === '/creative-performance') return ['creative-performance'];
    if (path === '/page-mapping') return ['page-mapping'];
    if (path === '/orders2') return ['orders2'];
    if (path.startsWith('/order/')) return ['orders'];
    if (path === '/' || path.startsWith('/order')) return ['orders'];
    if (path.startsWith('/data/')) return [path];
    return ['orders'];
  };

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
          key: 'orders2',
          icon: <ShoppingOutlined />,
          label: '주문 분석2 (개선)',
          onClick: () => navigate('/orders2')
        },
        {
          key: 'creative-performance',
          icon: <BarChartOutlined />,
          label: '광고 소재 모수 분석',
          onClick: () => navigate('/creative-performance')
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
    }
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
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          {collapsed ? '📊' : '📊 Moadamda Analytics'}
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
        <Content style={{ minHeight: '100vh' }}>
          <Routes>
            {/* 주문 분석 */}
            <Route path="/" element={<OrderListPage />} />
            <Route path="/order/:orderId" element={<OrderDetailPage />} />
            
            {/* 주문 분석2 (개선 버전) */}
            <Route path="/orders2" element={<OrderAnalysis2Page />} />
            
            {/* 광고 소재 모수 분석 */}
            <Route path="/creative-performance" element={<CreativePerformance />} />
            
            {/* 페이지 매핑 */}
            <Route path="/page-mapping" element={<PageMapping />} />
            
            {/* 데이터 테이블 */}
            <Route path="/data/:tableName" element={<DataTables />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

// ============================================================================
// 메인 App 컴포넌트
// ============================================================================
function App() {
  return (
    <Router>
      <AppLayout />
    </Router>
  );
}

export default App;
