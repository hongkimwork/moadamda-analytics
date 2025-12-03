/**
 * 구매 완료 타임라인 아이템 컴포넌트
 * 기존 페이지 카드와 동일한 스타일로 타임라인에 통합
 * 아이콘 없이 텍스트만으로 정보 표시
 */

import React from 'react';

/**
 * 금액 포맷 (콤마 추가)
 */
function formatPrice(amount) {
  if (!amount && amount !== 0) return '0';
  return parseInt(amount).toLocaleString();
}

/**
 * 결제 수단 한글화
 */
function getPaymentMethodText(method) {
  const methodMap = {
    'card': '신용카드',
    'cash': '무통장입금',
    'bank': '계좌이체',
    'phone': '휴대폰결제',
    'point': '포인트',
    'naverpay': '네이버페이',
    'kakaopay': '카카오페이',
    'payco': '페이코',
    'ssgpay': 'SSG페이',
    'lpay': 'L페이',
    'tosspay': '토스페이',
    'etc': '기타'
  };
  return methodMap[method?.toLowerCase()] || method || '-';
}

/**
 * 주문 상태 텍스트 및 색상
 */
function getStatusConfig(orderStatus, paid) {
  if (orderStatus === 'cancelled') {
    return { text: '주문 취소', color: '#dc2626' };
  }
  if (orderStatus === 'refunded') {
    return { text: '환불 완료', color: '#d97706' };
  }
  if (paid === 'F') {
    return { text: '입금 대기', color: '#9333ea' };
  }
  return { text: '결제 완료', color: '#16a34a' };
}

/**
 * 카드 스타일 (구매 완료용 - 파란색 테마)
 */
function getCardStyle() {
  return {
    borderRadius: '12px',
    padding: '14px 16px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.03)',
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    cursor: 'default',
    marginBottom: '14px',
    position: 'relative',
    border: '1px solid rgba(59, 130, 246, 0.25)',
    borderLeft: '4px solid #3b82f6',
    background: 'linear-gradient(135deg, #eff6ff 0%, #fff 100%)'
  };
}

/**
 * PurchaseTimelineItem 컴포넌트
 * @param {object} order - 주문 정보
 */
export function PurchaseTimelineItem({ order }) {
  if (!order) return null;

  const {
    timestamp,
    final_payment = 0,
    total_amount = 0,
    payment_details = {},
    order_items = []
  } = order;

  const {
    discount_amount = 0,
    mileage_used = 0,
    points_spent = 0,
    credits_spent = 0,
    shipping_fee = 0,
    payment_method = null,
    order_status = 'confirmed',
    paid = 'T'
  } = payment_details;

  // Cafe24 API 값 그대로 사용 (복잡한 계산 없이 표시)
  // 상품 금액 = total_amount - shipping_fee (Cafe24의 order_price_amount)
  const productAmount = total_amount - shipping_fee;

  // 할인/차감 항목 중 실제로 값이 있는 것만 필터링
  const deductions = [
    { label: '할인', value: discount_amount },
    { label: '마일리지', value: mileage_used },
    { label: '포인트', value: points_spent },
    { label: '적립금', value: credits_spent }
  ].filter(item => item.value > 0);

  const statusConfig = getStatusConfig(order_status, paid);

  // 주문 시간 포맷 (HH:MM:SS)
  const orderTime = timestamp ? new Date(timestamp).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }) : '';

  const cardStyle = getCardStyle();

  return (
    <div
      style={cardStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)';
        e.currentTarget.style.transform = 'translateY(-2px) translateX(2px)';
        e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.03)';
        e.currentTarget.style.transform = 'translateY(0) translateX(0)';
        e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.25)';
      }}
    >
      {/* 헤더: 구매 완료 + 주문 시간 */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{
            fontSize: '13px',
            fontWeight: '700',
            color: '#1e40af',
            letterSpacing: '-0.01em'
          }}>
            구매 완료
          </span>
          {orderTime && (
            <span style={{
              fontSize: '10px',
              color: '#64748b',
              fontWeight: '500'
            }}>
              {orderTime}
            </span>
          )}
        </div>
      </div>

      {/* 구매 상품 목록 */}
      {order_items.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{
            fontSize: '10px',
            fontWeight: '600',
            color: '#475569',
            marginBottom: '6px'
          }}>
            구매 상품
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
                  <span style={{ color: '#64748b' }}>{item.quantity}개</span>
                  <span style={{ fontWeight: '600', color: '#334155' }}>
                    {formatPrice(item.product_price * item.quantity)}원
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 결제 정보 */}
      <div style={{
        background: 'white',
        borderRadius: '8px',
        padding: '10px',
        border: '1px solid #e2e8f0'
      }}>
        {/* 상품 금액 (할인/차감 항목 또는 배송비가 있을 때만 표시) */}
        {(deductions.length > 0 || shipping_fee > 0) && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '4px'
          }}>
            <span style={{ fontSize: '10px', color: '#64748b' }}>
              상품 금액
            </span>
            <span style={{ fontSize: '10px', color: '#334155' }}>
              {formatPrice(productAmount)}원
            </span>
          </div>
        )}

        {/* 배송비 */}
        {shipping_fee > 0 && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '4px'
          }}>
            <span style={{ fontSize: '10px', color: '#64748b' }}>
              배송비
            </span>
            <span style={{ fontSize: '10px', color: '#334155' }}>
              +{formatPrice(shipping_fee)}원
            </span>
          </div>
        )}

        {/* 할인/차감 항목들 */}
        {deductions.map((item, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '4px'
            }}
          >
            <span style={{ fontSize: '10px', color: '#64748b' }}>
              {item.label}
            </span>
            <span style={{ fontSize: '10px', color: '#dc2626' }}>
              -{formatPrice(item.value)}원
            </span>
          </div>
        ))}

        {/* 최종 결제 금액 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: deductions.length > 0 || shipping_fee > 0 ? '6px' : '0',
          paddingTop: deductions.length > 0 || shipping_fee > 0 ? '6px' : '0',
          borderTop: deductions.length > 0 || shipping_fee > 0 ? '1px dashed #e2e8f0' : 'none'
        }}>
          <span style={{
            fontSize: '10px',
            fontWeight: '600',
            color: '#475569'
          }}>
            결제 금액
          </span>
          <span style={{
            fontSize: '13px',
            fontWeight: '700',
            color: '#1e40af'
          }}>
            {formatPrice(final_payment)}원
          </span>
        </div>

        {/* 결제 수단 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '6px'
        }}>
          <span style={{
            fontSize: '10px',
            color: '#64748b'
          }}>
            결제 수단
          </span>
          <span style={{
            fontSize: '11px',
            fontWeight: '600',
            color: '#334155'
          }}>
            {getPaymentMethodText(payment_method)}
          </span>
        </div>

        {/* 결제 상태 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '4px'
        }}>
          <span style={{
            fontSize: '10px',
            color: '#64748b'
          }}>
            결제 상태
          </span>
          <span style={{
            fontSize: '11px',
            fontWeight: '600',
            color: statusConfig.color
          }}>
            {statusConfig.text}
          </span>
        </div>
      </div>
    </div>
  );
}

export default PurchaseTimelineItem;

