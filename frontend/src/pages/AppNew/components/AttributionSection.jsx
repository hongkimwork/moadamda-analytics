import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Table } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { createAttributionComparisonData } from '../utils/dataTransforms';

/**
 * 체류시간 기반 어트리뷰션과 GA4 방식 비교 섹션
 */
export function AttributionSection({ attributionData, ga4Data }) {
  // 데이터가 없으면 렌더링하지 않음
  if (!attributionData || !ga4Data || attributionData.attributions.length === 0) {
    return null;
  }

  const chartData = createAttributionComparisonData(
    attributionData.attributions, 
    ga4Data.attributions, 
    5
  );

  return (
    <>
      {/* Hero Section */}
      <Card className="border-2 border-primary shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-green-50">
          <div className="text-center">
            <CardTitle className="text-3xl font-bold mb-2">
              🎯 체류시간 기반 어트리뷰션
            </CardTitle>
            <p className="text-muted-foreground text-base">
              사용자가 실제로 광고에 머문 시간을 기반으로 정확한 기여도를 측정합니다
            </p>
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
              <span className="text-lg">✅</span>
              GA4 Last Click 방식의 한계를 극복한 혁신적인 모델
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* GA4 vs 체류시간 기반 비교 */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* GA4 Last Click */}
        <Card className="border-2 border-red-200">
          <CardHeader className="bg-red-50">
            <CardTitle className="flex items-center gap-2">
              <span className="text-2xl">🔴</span>
              <span>GA4 방식 (Last Click)</span>
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              마지막 광고에만 100% 기여도 부여
            </p>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">총 매출</div>
                <div className="text-3xl font-bold text-red-600">
                  {ga4Data.total_revenue.toLocaleString()}원
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="text-sm font-semibold mb-2">캠페인별 기여도 Top 3</div>
                {ga4Data.attributions.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span className="font-medium text-sm">{item.utm_campaign}</span>
                    <span className="font-bold text-red-600">{Math.round(item.revenue).toLocaleString()}원</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="text-xs font-semibold text-red-700 mb-1">⚠️ 문제점</div>
                <p className="text-xs text-red-600">
                  5분 체류한 광고도 10초 체류한 광고도 구분 없이 마지막 광고만 평가됨
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Duration Based */}
        <Card className="border-2 border-green-500 shadow-lg">
          <CardHeader className="bg-gradient-to-br from-green-50 to-blue-50">
            <CardTitle className="flex items-center gap-2">
              <span className="text-2xl">✅</span>
              <span>체류시간 기반 (개선)</span>
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              실제 체류시간에 비례하여 기여도 분배
            </p>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="text-center p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">총 매출</div>
                <div className="text-3xl font-bold text-green-600">
                  {attributionData.total_revenue.toLocaleString()}원
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="text-sm font-semibold mb-2">캠페인별 기여도 Top 3</div>
                {attributionData.attributions.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-gradient-to-r from-green-50 to-blue-50 rounded">
                    <span className="font-medium text-sm">{item.utm_campaign}</span>
                    <span className="font-bold text-green-600">{Math.round(item.revenue).toLocaleString()}원</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-3 bg-green-50 border border-green-500 rounded-lg">
                <div className="text-xs font-semibold text-green-700 mb-1">✅ 장점</div>
                <p className="text-xs text-green-700">
                  사용자 관심도(체류시간)를 정확히 반영하여 실제 효과적인 광고를 식별
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 캠페인별 기여도 비교 차트 */}
      <Card>
        <CardHeader>
          <CardTitle>📊 캠페인별 기여도 비교: GA4 vs 체류시간 기반</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            같은 데이터를 다르게 해석하면 완전히 다른 결과가 나옵니다
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart 
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="campaign" 
                angle={-45}
                textAnchor="end"
                height={100}
              />
              <YAxis />
              <Tooltip formatter={(value) => `${Number(value).toLocaleString()}원`} />
              <Legend />
              <Bar dataKey="GA4 (Last Click)" fill="#ef4444" />
              <Bar dataKey="체류시간 기반" fill="#22c55e" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 상세 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle>📋 캠페인별 상세 기여도 (체류시간 기반)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table
            dataSource={attributionData.attributions}
            rowKey={(record) => `${record.utm_source}_${record.utm_campaign}`}
            pagination={{ pageSize: 10 }}
            columns={[
              { 
                title: '캠페인', 
                dataIndex: 'utm_campaign', 
                key: 'campaign',
                render: (text, record) => (
                  <div>
                    <div className="font-semibold">{text}</div>
                    <div className="text-xs text-muted-foreground">{record.utm_source}</div>
                  </div>
                ),
                width: 200,
              },
              { 
                title: '기여 주문', 
                dataIndex: 'orders', 
                key: 'orders', 
                align: 'right', 
                render: (val) => <span className="font-semibold">{val.toFixed(2)}건</span>,
                sorter: (a, b) => a.orders - b.orders,
              },
              { 
                title: '기여 매출', 
                dataIndex: 'revenue', 
                key: 'revenue', 
                align: 'right', 
                render: (val) => (
                  <span className="text-green-600 font-bold text-base">
                    {Math.round(val).toLocaleString()}원
                  </span>
                ),
                sorter: (a, b) => a.revenue - b.revenue,
                defaultSortOrder: 'descend'
              },
              { 
                title: '평균 주문가', 
                dataIndex: 'avg_order_value', 
                key: 'aov', 
                align: 'right', 
                render: (val) => `${Math.round(val).toLocaleString()}원`
              }
            ]}
          />
        </CardContent>
      </Card>

      {/* 설명 카드 */}
      <Card className="bg-gradient-to-r from-blue-50 via-green-50 to-blue-50">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div>
              <h3 className="font-bold text-lg mb-2">💡 체류시간 기반 모델이란?</h3>
              <p className="text-sm text-muted-foreground">
                사용자가 각 광고에서 실제로 머문 시간을 측정하여 기여도를 배분하는 모델입니다.
                예를 들어, 광고 A에서 5분, 광고 B에서 10초 체류했다면 광고 A가 훨씬 높은 기여도를 받습니다.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-4 bg-white rounded-lg shadow-sm">
                <div className="text-2xl mb-2">🎯</div>
                <div className="font-semibold mb-1">정확한 측정</div>
                <p className="text-xs text-muted-foreground">
                  클릭 수가 아닌 실제 관심도(체류시간) 기반
                </p>
              </div>
              <div className="p-4 bg-white rounded-lg shadow-sm">
                <div className="text-2xl mb-2">💰</div>
                <div className="font-semibold mb-1">예산 최적화</div>
                <p className="text-xs text-muted-foreground">
                  진짜 효과적인 광고에 예산 집중 가능
                </p>
              </div>
              <div className="p-4 bg-white rounded-lg shadow-sm">
                <div className="text-2xl mb-2">📈</div>
                <div className="font-semibold mb-1">장기 전략</div>
                <p className="text-xs text-muted-foreground">
                  브랜드 구축 효과까지 정확히 측정
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
