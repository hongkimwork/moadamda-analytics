/**
 * 더미 데이터 생성 유틸리티
 * 개발/테스트용
 */

import dayjs from 'dayjs';

/**
 * 위젯 타입에 맞는 더미 데이터 생성
 * @param {string} type - 위젯 타입 (kpi, line, bar, table, funnel, text)
 * @returns {*} - 더미 데이터
 */
export const generateDummyData = (type) => {
  switch (type) {
    case 'kpi':
      return {
        value: Math.floor(Math.random() * 100000) + 10000,
        change: (Math.random() * 40 - 20).toFixed(1),
        prefix: '',
        suffix: ''
      };

    case 'line':
      return Array.from({ length: 7 }, (_, i) => ({
        date: dayjs().subtract(6 - i, 'days').format('MM/DD'),
        value: Math.floor(Math.random() * 1000) + 500
      }));

    case 'bar':
      return [
        { name: '네이버', value: Math.floor(Math.random() * 5000) + 1000 },
        { name: '메타', value: Math.floor(Math.random() * 5000) + 1000 },
        { name: '구글', value: Math.floor(Math.random() * 5000) + 1000 },
        { name: '직접유입', value: Math.floor(Math.random() * 5000) + 1000 }
      ];

    case 'table':
      return [
        { campaign: '봄맞이 세일', visitors: 1234, orders: 56, revenue: 2340000 },
        { campaign: '신상품 런칭', visitors: 987, orders: 34, revenue: 1560000 },
        { campaign: '회원가입 이벤트', visitors: 756, orders: 23, revenue: 890000 }
      ];

    case 'funnel':
      return [
        { stage: '방문', value: 10000, rate: 100 },
        { stage: '상품조회', value: 6500, rate: 65 },
        { stage: '장바구니', value: 2100, rate: 21 },
        { stage: '구매완료', value: 850, rate: 8.5 }
      ];

    case 'text':
      return { title: '섹션 제목', content: '여기에 설명을 입력하세요' };

    default:
      return null;
  }
};
