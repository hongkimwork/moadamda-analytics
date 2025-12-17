/**
 * 주문 목록 페이지
 * 주문 목록 조회 및 필터링
 */

import React, { useState, useMemo } from 'react';
import { Card, Table, Button, Tag, Space, Typography, Modal } from 'antd';
import { ShoppingCart, RefreshCw, XCircle } from 'lucide-react';
import dayjs from 'dayjs';
import { useOrderList } from '../../hooks/useOrderList';
import { useUserMappings } from '../../hooks/useUserMappings';
import SearchFilterBar from '../../components/SearchFilterBar';
import { OrderDetailPageContent } from './OrderDetailPage';

const { Title } = Typography;

/**
 * 주문 상태 뱃지 렌더링 (결제상태 + 취소/반품 상태)
 */
const OrderStatusBadge = ({ order }) => {
  const { order_status, canceled, paid } = order;
  
  // 1순위: 취소 상태 (취소된 주문은 paid 상태와 관계없이 취소로 표시)
  if (canceled === 'T' || order_status === 'cancelled') {
    return <Tag color="red" icon={<XCircle size={10} />} style={{ margin: 0 }}>취소</Tag>;
  }
  
  // 2순위: 반품 상태
  if (order_status === 'refunded') {
    return <Tag color="orange" style={{ margin: 0 }}>반품</Tag>;
  }
  
  // 3순위: 입금대기 상태 (paid = 'F')
  if (paid === 'F') {
    return <Tag color="gold" style={{ margin: 0 }}>입금대기</Tag>;
  }
  
  return null;
};

/**
 * OrderListPage 컴포넌트
 */
export function OrderListPage() {
  const {
    orders,
    loading,
    dateRange,
    setDateRange,
    deviceFilter,
    setDeviceFilter,
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

  // 필터 변경 핸들러 (SearchFilterBar용)
  const handleFilterChange = (filters) => {
    if (filters.dateRange && filters.dateRange[0] && filters.dateRange[1]) {
      setDateRange(filters.dateRange);
    } else if (!filters.dateRange) {
      // dateRange가 없으면 오늘 날짜로 기본값 설정
      setDateRange([dayjs(), dayjs()]);
    }
    if (filters.device !== undefined) {
      setDeviceFilter(filters.device);
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
      width: 200,
      fixed: 'left',
      sorter: () => 0,
      sortOrder: getSortOrder('order_id'),
      showSorterTooltip: false,
      render: (text) => (
        <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{text}</span>
      )
    },
    {
      title: '주문시간',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      sorter: () => 0,
      sortOrder: getSortOrder('timestamp'),
      showSorterTooltip: false,
      render: (timestamp) => dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '결제상태',
      dataIndex: 'paid',
      key: 'paid',
      width: 90,
      align: 'center',
      render: (paid, record) => {
        const { order_status, canceled } = record;
        
        // 1순위: 취소 (취소된 주문은 paid 상태와 관계없이 취소로 표시)
        if (canceled === 'T' || order_status === 'cancelled') {
          return <Tag color="red">취소</Tag>;
        }
        // 2순위: 반품
        if (order_status === 'refunded') {
          return <Tag color="orange">반품</Tag>;
        }
        // 3순위: 입금대기
        if (paid === 'F') {
          return <Tag color="gold">입금대기</Tag>;
        }
        // 4순위: 입금완료
        return <Tag color="green">입금완료</Tag>;
      }
    },
    {
      title: '총 주문금액',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 110,
      align: 'right',
      sorter: () => 0,
      sortOrder: getSortOrder('total_amount'),
      showSorterTooltip: false,
      render: (amount) => `${(amount || 0).toLocaleString()}원`
    },
    {
      title: '실 결제금액',
      dataIndex: 'final_payment',
      key: 'final_payment',
      width: 110,
      align: 'right',
      sorter: () => 0,
      sortOrder: getSortOrder('final_payment'),
      showSorterTooltip: false,
      render: (amount) => `${(amount || 0).toLocaleString()}원`
    },
    {
      title: '상품명',
      dataIndex: 'product_name',
      key: 'product_name',
      width: 280,
      ellipsis: true,
      sorter: () => 0,
      sortOrder: getSortOrder('product_name'),
      showSorterTooltip: false
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
      title: '디바이스',
      dataIndex: 'device_type',
      key: 'device_type',
      width: 90,
      sorter: () => 0,
      sortOrder: getSortOrder('device_type'),
      showSorterTooltip: false,
      render: (device) => (
        <Tag color={device === 'mobile' ? 'blue' : 'green'}>
          {device === 'mobile' ? 'Mobile' : 'PC'}
        </Tag>
      )
    },
    {
      title: '재구매',
      dataIndex: 'is_repurchase',
      key: 'is_repurchase',
      width: 70,
      align: 'center',
      sorter: () => 0,
      sortOrder: getSortOrder('is_repurchase'),
      showSorterTooltip: false,
      render: (isRepurchase) => {
        if (isRepurchase === null || isRepurchase === undefined) {
          return <Tag color="default">-</Tag>;
        }
        return isRepurchase
          ? <Tag color="purple">재구매</Tag>
          : <Tag color="cyan">신규</Tag>;
      }
    },
    {
      title: 'UTM',
      dataIndex: 'utm_source',
      key: 'utm_source',
      width: 100,
      sorter: () => 0,
      sortOrder: getSortOrder('utm_source'),
      showSorterTooltip: false,
      render: (source) => source ? <Tag>{source}</Tag> : '-'
    },
    {
      title: '상세',
      key: 'action',
      width: 70,
      fixed: 'right',
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
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
              <div style={{ 
                color: '#6b7280', 
                fontSize: '14px', 
                marginTop: '8px',
                fontWeight: 400,
                lineHeight: '1.5'
              }}>
                주문 목록을 조회하고 고객 여정을 분석합니다
              </div>
            </div>
            <Button
                icon={<RefreshCw size={16} />}
                onClick={refetch}
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
          </div>
          <Tag 
            color="blue" 
            style={{
              padding: '4px 12px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 500,
              border: 'none',
              background: '#e6f4ff',
              color: '#0958d9'
            }}
          >
            총 {totalOrders.toLocaleString()}건 주문
          </Tag>
        </Space>
      </Card>

      {/* 검색 및 필터 */}
      <SearchFilterBar
        searchPlaceholder="주문번호 또는 상품명으로 검색..."
        onSearch={handleSearch}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
        showDeviceFilter={false}
        showBrowserFilter={false}
        showOsFilter={false}
        showBouncedFilter={false}
        showConvertedFilter={false}
        showDateFilter={true}
        showCancelledFilter={true}
        includeCancelled={includeCancelled}
        onCancelledChange={setIncludeCancelled}
        showPendingFilter={true}
        includePending={includePending}
        onPendingChange={setIncludePending}
        defaultActiveQuickDate="today"
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
          scroll={{ x: 1450 }}
          size="small"
          style={{
            borderRadius: '8px',
            overflow: 'hidden'
          }}
        />
      </Card>

      {/* 푸터 */}
      <div style={{ 
        marginTop: '24px', 
        textAlign: 'center', 
        color: '#9ca3af',
        fontSize: '13px',
        fontWeight: 500,
        paddingBottom: '16px'
      }}>
        마지막 갱신: {dayjs().format('YYYY-MM-DD HH:mm:ss')}
      </div>

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
