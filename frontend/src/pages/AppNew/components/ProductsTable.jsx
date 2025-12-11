import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Table, Tag } from 'antd';

/**
 * 상품 성과 Top 10 테이블
 */
export function ProductsTable({ products }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>상품 성과 Top 10</CardTitle>
      </CardHeader>
      <CardContent>
        <Table
          dataSource={products || []}
          columns={[
            { title: '상품명', dataIndex: 'product_name', key: 'product_name' },
            { title: '조회', dataIndex: 'views', key: 'views', sorter: (a, b) => a.views - b.views },
            { title: '장바구니', dataIndex: 'cart_adds', key: 'cart_adds', sorter: (a, b) => a.cart_adds - b.cart_adds },
            { title: '구매', dataIndex: 'purchases', key: 'purchases', sorter: (a, b) => a.purchases - b.purchases },
            { 
              title: '전환율', 
              dataIndex: 'conversion_rate', 
              key: 'conversion_rate',
              render: (rate) => (
                <Tag color={rate > 5 ? 'green' : rate > 2 ? 'orange' : 'red'}>
                  {rate}%
                </Tag>
              )
            }
          ]}
          pagination={{ pageSize: 10 }}
          size="small"
        />
      </CardContent>
    </Card>
  );
}
