import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Table, Statistic, Row, Col } from 'antd';

/**
 * 광고 캠페인 성과 요약 섹션
 */
export function UtmPerformanceSection({ utmPerformance }) {
  // 데이터가 없으면 렌더링하지 않음
  if (!utmPerformance || utmPerformance.campaigns.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>📢 광고 캠페인 성과 요약</CardTitle>
      </CardHeader>
      <CardContent>
        <Row gutter={[16, 16]} className="mb-6">
          <Col xs={12} sm={6}>
            <Statistic
              title="광고 유입 방문자"
              value={utmPerformance.total.visitors}
              suffix="명"
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="광고 주문"
              value={utmPerformance.total.orders}
              suffix="건"
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="광고 매출"
              value={utmPerformance.total.revenue.toLocaleString()}
              suffix="원"
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="광고 전환율"
              value={utmPerformance.total.conversion_rate}
              suffix="%"
              precision={2}
            />
          </Col>
        </Row>

        {/* Top 3 & Bottom 3 캠페인 */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-semibold mb-2 text-green-600">🏆 Top 3 캠페인</h4>
            <Table
              dataSource={utmPerformance.campaigns.slice(0, 3)}
              rowKey={(record) => `top_${record.utm_campaign}`}
              pagination={false}
              size="small"
              columns={[
                { title: '캠페인', dataIndex: 'utm_campaign', key: 'campaign' },
                { title: '매출', dataIndex: 'revenue', key: 'revenue', align: 'right', render: (val) => `${val.toLocaleString()}원` }
              ]}
            />
          </div>
          <div>
            <h4 className="font-semibold mb-2 text-red-600">⚠️ 개선 필요 캠페인</h4>
            <Table
              dataSource={utmPerformance.campaigns.filter(c => c.revenue === 0).slice(0, 3)}
              rowKey={(record) => `bottom_${record.utm_campaign}`}
              pagination={false}
              size="small"
              columns={[
                { title: '캠페인', dataIndex: 'utm_campaign', key: 'campaign' },
                { title: '방문자', dataIndex: 'visitors', key: 'visitors', align: 'right' },
                { title: '매출', dataIndex: 'revenue', key: 'revenue', align: 'right', render: () => '0원' }
              ]}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
