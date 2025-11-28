/**
 * 제품 배지 컴포넌트
 * 상품 페이지 방문 시 제품명을 배지로 표시
 */

import React from 'react';

/**
 * ProductBadge 컴포넌트
 * @param {Array} badges - 배지 배열 [{ text: string, color: string, text_color?: string }]
 * @param {string} label - 라벨 텍스트 (기본: "제품:")
 */
export function ProductBadge({ badges, label = '제품:' }) {
  if (!badges || badges.length === 0) {
    return null;
  }

  return (
    <div style={{
      fontSize: '10px',
      marginBottom: '6px',
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      flexWrap: 'wrap'
    }}>
      <span style={{
        color: '#6b7280',
        fontWeight: '500',
        fontSize: '10px'
      }}>
        {label}
      </span>
      {badges.map((badge, idx) => (
        <span
          key={idx}
          style={{
            display: 'inline-block',
            padding: '1px 6px',
            borderRadius: '3px',
            fontSize: '10px',
            fontWeight: '600',
            color: badge.text_color || '#fff',
            backgroundColor: badge.color,
            boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
          }}
        >
          {badge.text}
        </span>
      ))}
    </div>
  );
}

export default ProductBadge;
