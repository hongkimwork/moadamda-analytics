/**
 * 주문 목록 페이지
 * 주문 목록 조회 및 필터링
 */

import { useState, useMemo, useEffect } from 'react';
import { Card, Table, Button, Tag, Typography, Modal } from 'antd';
import { ShoppingCart, RefreshCw, Clock, TrendingUp, Package, Check, X, RotateCcw } from 'lucide-react';
import dayjs from 'dayjs';
import { useOrderList } from '../../hooks/useOrderList';
import { useUserMappings } from '../../hooks/useUserMappings';
import OrderFilterBar from './components/OrderFilterBar';
import { OrderDetailPageContent } from './OrderDetailPage';

const { Title, Text } = Typography;

/**
 * 통계 카드 컴포넌트
 */
const StatCard = ({ icon: Icon, iconColor, label, value, suffix, subValue }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '20px 24px',
    background: '#fff',
    borderRadius: '12px',
    border: '1px solid #e8eaed',
    flex: 1,
    minWidth: '200px'
  }}>
    <div style={{
      width: '48px',
      height: '48px',
      borderRadius: '12px',
      background: `${iconColor}15`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <Icon size={24} style={{ color: iconColor }} />
    </div>
    <div>
      <Text style={{ fontSize: '14px', display: 'block', marginBottom: '4px', color: '#374151' }}>
        {label}
      </Text>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
        <span style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a' }}>
          {value}
        </span>
        {suffix && (
          <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: 500 }}>
            {suffix}
          </span>
        )}
      </div>
      {subValue && (
        <Text style={{ fontSize: '13px', color: '#4b5563' }}>
          {subValue}
        </Text>
      )}
    </div>
  </div>
);

/**
 * OrderListPage 컴포넌트
 */
export function OrderListPage() {
  const {
    orders,
    loading,
    setDateRange,
    totalOrders,
    refetch,
    handleSearch,
    handleSort,
    handleReset,
    sortField,
    sortOrder,
    includeCancelled,
    setIncludeCancelled,
    includePending,
    setIncludePending
  } = useOrderList();

  const { userMappings } = useUserMappings();

  // 마지막 갱신 시간 state
  const [lastUpdated, setLastUpdated] = useState(dayjs());

  // 새로고침 핸들러 (갱신 시간 업데이트 포함)
  const handleRefresh = () => {
    refetch();
    setLastUpdated(dayjs());
  };

  // 로딩 완료 시 갱신 시간 업데이트
  useEffect(() => {
    if (!loading && orders.length >= 0) {
      setLastUpdated(dayjs());
    }
  }, [loading]);

  // 통계 계산 (입금완료된 주문만)
  const stats = useMemo(() => {
    const paidOrders = orders.filter(order => 
      order.paid === 'T' && 
      order.canceled !== 'T' && 
      order.order_status !== 'cancelled' &&
      order.order_status !== 'refunded'
    );
    
    const totalRevenue = paidOrders.reduce((sum, order) => sum + (order.final_payment || 0), 0);
    const avgOrderValue = paidOrders.length > 0 ? Math.round(totalRevenue / paidOrders.length) : 0;
    
    return {
      totalRevenue,
      avgOrderValue,
      paidOrderCount: paidOrders.length
    };
  }, [orders]);

  // 모달 state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  // 모달 열기 핸들러
  const handleOpenModal = (orderId) => {
    setSelectedOrderId(orderId);
    setIsModalOpen(true);
  };

  // 모달 닫기 핸들러 (닫을 때 목록 새로고침)
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedOrderId(null);
    refetch(); // 목록 자동 새로고침
  };

  // 날짜 변경 핸들러 (OrderFilterBar용)
  const handleDateChange = (dates) => {
    if (dates && dates[0] && dates[1]) {
      setDateRange(dates);
    }
  };

  // 테이블 정렬 핸들러
  const handleTableChange = (pagination, filters, sorter) => {
    // sorter.order: 'ascend' | 'descend' | undefined (3번 클릭 시 정렬 해제)
    if (sorter.order) {
      // 오름차순 또는 내림차순 정렬
      const order = sorter.order === 'ascend' ? 'asc' : 'desc';
      handleSort(sorter.field, order);
    } else {
      // 정렬 해제 시 null로 설정 → 화살표 미표시, 서버 기본 정렬 사용
      handleSort(null, null);
    }
  };

  // 현재 정렬 상태를 Ant Design 형식으로 변환
  const getSortOrder = (field) => {
    if (sortField === field) {
      return sortOrder === 'asc' ? 'ascend' : 'descend';
    }
    return null;
  };

  // 주문 테이블 컬럼 정의
  // sorter: () => 0 으로 설정하여 클라이언트 정렬 비활성화 (서버 측 정렬만 사용)
  // useMemo로 감싸서 sortField/sortOrder 변경 시에만 재생성
  const columns = useMemo(() => [
    {
      title: '주문번호',
      dataIndex: 'order_id',
      key: 'order_id',
      width: 160,
      fixed: 'left',
      align: 'center',
      sorter: () => 0,
      sortOrder: getSortOrder('order_id'),
      showSorterTooltip: false,
      render: (text) => (
        <span style={{ fontFamily: 'monospace', fontSize: '13px', letterSpacing: '0.5px', color: '#374151' }}>{text}</span>
      )
    },
    {
      title: '주문시간',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 150,
      align: 'center',
      sorter: () => 0,
      sortOrder: getSortOrder('timestamp'),
      showSorterTooltip: false,
      render: (timestamp) => dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '결제상태',
      dataIndex: 'paid',
      key: 'paid',
      width: 105,
      align: 'center',
      render: (paid, record) => {
        const { order_status, canceled } = record;
        
        // 1순위: 취소 (취소된 주문은 paid 상태와 관계없이 취소로 표시)
        if (canceled === 'T' || order_status === 'cancelled') {
          return (
            <Tag color="red" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', margin: 0, fontSize: '12px' }}>
              <X size={12} /> 취소
            </Tag>
          );
        }
        // 2순위: 반품
        if (order_status === 'refunded') {
          return (
            <Tag color="orange" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', margin: 0, fontSize: '12px' }}>
              <RotateCcw size={12} /> 반품
            </Tag>
          );
        }
        // 3순위: 입금대기
        if (paid === 'F') {
          return (
            <Tag color="gold" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', margin: 0, fontSize: '12px' }}>
              <Clock size={12} /> 입금대기
            </Tag>
          );
        }
        // 4순위: 입금완료
        return (
          <Tag color="green" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', margin: 0, fontSize: '12px' }}>
            <Check size={12} /> 입금완료
          </Tag>
        );
      }
    },
    {
      title: '총 주문금액',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 130,
      align: 'center',
      sorter: () => 0,
      sortOrder: getSortOrder('total_amount'),
      showSorterTooltip: false,
      render: (amount) => (
        <span style={{ fontSize: '14px' }}>{(amount || 0).toLocaleString()}원</span>
      )
    },
    {
      title: '실 결제금액',
      dataIndex: 'final_payment',
      key: 'final_payment',
      width: 130,
      align: 'center',
      sorter: () => 0,
      sortOrder: getSortOrder('final_payment'),
      showSorterTooltip: false,
      render: (amount) => (
        <span style={{ fontSize: '15px', fontWeight: 700, color: '#1a1a1a' }}>{(amount || 0).toLocaleString()}원</span>
      )
    },
    {
      title: '상품명',
      dataIndex: 'product_name',
      key: 'product_name',
      width: 300,
      align: 'center',
      sorter: () => 0,
      sortOrder: getSortOrder('product_name'),
      showSorterTooltip: false,
      render: (text) => (
        <span style={{ fontSize: '13px', color: '#374151', display: 'block', textAlign: 'left' }}>{text}</span>
      )
    },
    {
      title: '상품수',
      dataIndex: 'product_count',
      key: 'product_count',
      width: 70,
      align: 'center',
      sorter: () => 0,
      sortOrder: getSortOrder('product_count'),
      showSorterTooltip: false,
      render: (count) => (
        <span style={{ fontWeight: 500 }}>{count || 1}개</span>
      )
    },
    {
      title: '재구매',
      dataIndex: 'is_repurchase',
      key: 'is_repurchase',
      width: 80,
      align: 'center',
      sorter: () => 0,
      sortOrder: getSortOrder('is_repurchase'),
      showSorterTooltip: false,
      render: (isRepurchase) => {
        if (isRepurchase === null || isRepurchase === undefined) {
          return <Tag color="default" style={{ margin: 0 }}>-</Tag>;
        }
        return isRepurchase
          ? <Tag color="purple" style={{ margin: 0 }}>재구매</Tag>
          : <Tag color="cyan" style={{ margin: 0 }}>신규</Tag>;
      }
    },
    {
      title: '상세',
      key: 'action',
      width: 60,
      fixed: 'right',
      align: 'center',
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          onClick={() => handleOpenModal(record.order_id)}
        >
          보기
        </Button>
      )
    }
  ], [sortField, sortOrder, handleOpenModal]);

  return (
    <div style={{ padding: '24px', background: '#f5f7fa', minHeight: '100vh' }}>
      {/* 헤더 */}
      <Card 
        style={{ 
          marginBottom: '20px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          border: '1px solid #e8eaed'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <Title 
              level={2} 
              style={{ 
                margin: 0, 
                display: 'flex', 
                alignItems: 'center', 
                gap: '10px',
                fontSize: '24px',
                fontWeight: 700,
                color: '#1a1a1a'
              }}
            >
              <ShoppingCart size={28} strokeWidth={2.5} style={{ color: '#1890ff' }} />
              주문 분석
            </Title>
            <Text type="secondary" style={{ 
              fontSize: '14px', 
              marginTop: '8px',
              display: 'block'
            }}>
              주문 목록을 조회하고 고객 여정을 분석합니다
            </Text>
          </div>
          
          {/* 새로고침 버튼 + 갱신 시간 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            <Button
              icon={<RefreshCw size={16} className={loading ? 'spin-animation' : ''} />}
              onClick={handleRefresh}
              loading={loading}
              style={{
                height: '40px',
                borderRadius: '8px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              새로고침
            </Button>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '4px',
              color: '#9ca3af',
              fontSize: '12px'
            }}>
              <Clock size={12} />
              <span>마지막 갱신: {lastUpdated.format('HH:mm:ss')}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* 통계 카드 영역 */}
      <div style={{ 
        display: 'flex', 
        gap: '16px',
        flexWrap: 'wrap',
        marginBottom: '20px'
      }}>
        <StatCard
          icon={Package}
          iconColor="#1890ff"
          label="총 주문"
          value={totalOrders.toLocaleString()}
          suffix="건"
        />
        <StatCard
          icon={TrendingUp}
          iconColor="#52c41a"
          label="총 매출"
          value={stats.totalRevenue.toLocaleString()}
          suffix="원"
          subValue={`입금완료 ${stats.paidOrderCount.toLocaleString()}건 (실결제)`}
        />
        <StatCard
          icon={ShoppingCart}
          iconColor="#722ed1"
          label="평균 주문금액"
          value={stats.avgOrderValue.toLocaleString()}
          suffix="원"
        />
      </div>

      {/* 검색 및 필터 */}
      <OrderFilterBar
        onSearch={handleSearch}
        onDateChange={handleDateChange}
        onCancelledChange={setIncludeCancelled}
        onPendingChange={setIncludePending}
        onReset={handleReset}
        includeCancelled={includeCancelled}
        includePending={includePending}
        defaultQuickDate="today"
        loading={loading}
      />

      {/* 주문 목록 테이블 */}
      <Card
        style={{
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          border: '1px solid #e8eaed'
        }}
      >
        <Table
          className="order-analysis-table"
          columns={columns}
          dataSource={orders}
          rowKey="order_id"
          loading={loading}
          onChange={handleTableChange}
          pagination={{
            pageSize: 20,
            total: totalOrders,
            showTotal: (total) => `총 ${total.toLocaleString()}건`,
            showSizeChanger: true,
            pageSizeOptions: ['20', '50', '100', '200']
          }}
          scroll={{ x: 1200 }}
          size="middle"
          rowClassName={(_, index) => index % 2 === 0 ? 'table-row-even' : 'table-row-odd'}
          style={{
            borderRadius: '8px',
            overflow: 'hidden'
          }}
        />
      </Card>

      {/* 주문 상세 모달 */}
      <Modal
        title={null}
        open={isModalOpen}
        onCancel={handleCloseModal}
        footer={null}
        width="95vw"
        style={{ top: '2.5vh', padding: 0, maxWidth: '95vw', margin: '0 auto', left: 0, right: 0 }}
        styles={{ body: { padding: 0, height: 'calc(95vh - 55px)', overflow: 'hidden' } }}
        destroyOnClose={true}
        closable={false}
      >
        {selectedOrderId && (
          <OrderDetailPageContent
            orderId={selectedOrderId}
            userMappings={userMappings}
            onClose={handleCloseModal}
          />
        )}
      </Modal>
    </div>
  );
}

export default OrderListPage;
