/**
 * 구매 완료 카드 컴포넌트
 * 고객 여정 타임라인의 마지막에 표시되는 구매 결과 카드
 * 구매 상품 목록 + 결제 상태만 간단히 표시
 */

import React from 'react';
import { CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';

/**
 * 금액 포맷 (콤마 추가)
 */
function formatPrice(amount) {
  if (!amount && amount !== 0) return '0';
  return parseInt(amount).toLocaleString();
}

/**
 * 주문 상태에 따른 스타일 및 텍스트
 */
function getStatusConfig(orderStatus, paid) {
  if (orderStatus === 'cancelled') {
    return { icon: <CloseCircleOutlined />, text: '주문 취소', color: '#dc2626' };
  }
  if (orderStatus === 'refunded') {
    return { icon: <ExclamationCircleOutlined />, text: '환불 완료', color: '#d97706' };
  }
  if (paid === 'F') {
    return { icon: <ClockCircleOutlined />, text: '입금 대기', color: '#9333ea' };
  }
  return { icon: <CheckCircleOutlined />, text: '결제 완료', color: '#16a34a' };
}

/**
 * PurchaseCompleteCard 컴포넌트
 * @param {object} order - 주문 정보
 */
export function PurchaseCompleteCard({ order }) {
  if (!order) return null;

  const {
    timestamp,
    final_payment = 0,
    payment_details = {},
    order_items = []
  } = order;

  const {
    payment_method = null,
    order_status = 'confirmed',
    paid = 'T'
  } = payment_details;

  const statusConfig = getStatusConfig(order_status, paid);
  
  const orderTime = timestamp ? new Date(timestamp).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }) : '';

  return (
    <div
      style={{
        borderRadius: '12px',
        padding: '14px 16px',
        background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
        border: '2px solid #93c5fd',
        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.12)',
        position: 'relative',
        overflow: 'hidden',
        width: '190px'
      }}
    >
      {/* 상단 장식 바 */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '3px',
        background: 'linear-gradient(90deg, #3b82f6, #60a5fa)'
      }} />

      {/* 헤더 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
        paddingBottom: '10px',
        borderBottom: '1px solid #bfdbfe'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '16px' }}>🎉</span>
          <span style={{
            fontSize: '13px',
            fontWeight: '700',
            color: '#1e40af'
          }}>
            구매 완료
          </span>
        </div>
        {orderTime && (
          <span style={{ fontSize: '10px', color: '#64748b' }}>
            {orderTime}
          </span>
        )}
      </div>

      {/* 구매 상품 목록 */}
      {order_items.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <div style={{
            fontSize: '10px',
            fontWeight: '600',
            color: '#475569',
            marginBottom: '6px'
          }}>
            📦 구매 상품
          </div>
          <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: '8px 10px',
            border: '1px solid #e2e8f0'
          }}>
            {order_items.map((item, idx) => (
              <div
                key={idx}
                style={{
                  padding: '4px 0',
                  borderBottom: idx < order_items.length - 1 ? '1px dashed #e2e8f0' : 'none'
                }}
              >
                <div style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  color: '#1e293b',
                  marginBottom: '2px',
                  lineHeight: '1.3',
                  wordBreak: 'break-word'
                }}>
                  {item.product_name}
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '10px'
                }}>
                  <span style={{ color: '#64748b' }}>× {item.quantity}개</span>
                  <span style={{ fontWeight: '600', color: '#334155' }}>
                    {formatPrice(item.product_price * item.quantity)}원
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 최종결제 + 상태 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 10px',
        background: 'white',
        borderRadius: '8px',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ fontSize: '10px', color: '#475569' }}>
          <span style={{ fontWeight: '600', color: '#1e40af', fontSize: '12px' }}>
            {formatPrice(final_payment)}원
          </span>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '3px',
          fontSize: '10px',
          fontWeight: '600',
          color: statusConfig.color
        }}>
          {statusConfig.icon}
          <span>{statusConfig.text}</span>
        </div>
      </div>
    </div>
  );
}

export default PurchaseCompleteCard;
