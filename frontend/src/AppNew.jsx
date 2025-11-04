import React, { useState, useEffect } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ko';
import { DashboardHeader } from './components/DashboardHeader';
import { MainTabs, OverviewTab, PerformanceTab, AudienceTab } from './components/MainTabs';
import { EnhancedMetricCard } from './components/EnhancedMetricCard';
import { InsightsPanel } from './components/InsightsPanel';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Users, Eye, ShoppingCart, DollarSign, TrendingUp, Package, Percent } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Table, Tag, Statistic, Row, Col, Select } from 'antd';

dayjs.extend(relativeTime);
dayjs.locale('ko');

const API_URL = import.meta.env.VITE_API_URL || '';

function AppNew() {
  const [stats, setStats] = useState(null);
  const [segments, setSegments] = useState(null);
  const [dailyData, setDailyData] = useState([]);
  const [recentActivity, setRecentActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState([dayjs(), dayjs()]);
  const [deviceFilter, setDeviceFilter] = useState('all');
  const [utmPerformance, setUtmPerformance] = useState(null); // Phase 4.3
  const [attributionData, setAttributionData] = useState(null); // Phase 4.4: Duration Based only
  const [ga4Data, setGa4Data] = useState(null); // GA4 Last Click data for comparison

  const fetchAllStats = async () => {
    try {
      setLoading(true);
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');
      
      const [rangeResponse, dailyResponse, segmentsResponse] = await Promise.all([
        axios.get(`${API_URL}/api/stats/range`, {
          params: { start: startDate, end: endDate, compare: 'true', device: deviceFilter }
        }),
        axios.get(`${API_URL}/api/stats/daily`, {
          params: { start: startDate, end: endDate, device: deviceFilter }
        }),
        axios.get(`${API_URL}/api/stats/segments`, {
          params: { start: startDate, end: endDate, device: deviceFilter }
        })
      ]);
      
      const data = rangeResponse.data;
      const daily = dailyResponse.data.daily_data;
      
      setStats({
        visitors: {
          total: data.visitors.total,  // ✅ count가 아니라 total
          new: data.visitors.new,
          returning: data.visitors.returning,
          change_percent: data.comparison?.visitors?.change_percent || 0
        },
        pageviews: {
          total: data.pageviews,  // ✅ 직접 숫자값
          change_percent: data.comparison?.pageviews?.change_percent || 0
        },
        revenue: {
          total: data.revenue.final,
          change_percent: data.comparison?.final_revenue?.change_percent || 0
        },
        orders: {
          count: data.orders.count,
          aov: data.orders.final_aov,
          change_percent: data.comparison?.orders?.change_percent || 0
        },
        conversion: {
          rate: parseFloat(data.conversion_rate),
          cart_abandonment: parseFloat(data.cart_abandonment_rate)
        },
        devices: data.devices,
        products: data.products
      });
      
      setDailyData(daily);
      setSegments(segmentsResponse.data);
      
      // Phase 4: Fetch UTM data separately (optional - won't break dashboard if it fails)
      try {
        const utmResponse = await axios.get(`${API_URL}/api/stats/utm-performance`, {
          params: { start: startDate, end: endDate, device: deviceFilter }
        });
        setUtmPerformance(utmResponse.data);
      } catch (utmError) {
        console.warn('UTM performance data unavailable:', utmError.message);
        setUtmPerformance(null);
      }

      // Phase 4.4: Fetch both GA4 (Last Click) and Duration Based data
      try {
        const [ga4Response, durationResponse] = await Promise.all([
          axios.get(`${API_URL}/api/stats/utm-attribution`, {
            params: { start: startDate, end: endDate, model: 'last_click' }
          }),
          axios.get(`${API_URL}/api/stats/utm-attribution`, {
            params: { start: startDate, end: endDate, model: 'duration_based' }
          })
        ]);
        setGa4Data(ga4Response.data);
        setAttributionData(durationResponse.data);
      } catch (attrError) {
        console.warn('Attribution data unavailable:', attrError.message);
        setGa4Data(null);
        setAttributionData(null);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      setLoading(false);
    }
  };

  const fetchRecentActivity = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/stats/recent-activity`);
      setRecentActivity(response.data);
    } catch (error) {
      console.error('Failed to fetch recent activity:', error);
    }
  };

  useEffect(() => {
    fetchAllStats();
    fetchRecentActivity();
  }, [dateRange, deviceFilter]);

  useEffect(() => {
    const activityInterval = setInterval(fetchRecentActivity, 180000); // 3분(180초)마다 갱신
    return () => clearInterval(activityInterval);
  }, []);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-lg font-medium">로딩 중...</div>
        </div>
      </div>
    );
  }

  // 스파크라인 데이터 생성 (안전한 접근)
  const revenueSparkline = dailyData?.length > 0 ? dailyData.map(d => ({ value: d.revenue || 0 })) : [];
  const visitorsSparkline = dailyData?.length > 0 ? dailyData.map(d => ({ value: d.visitors || 0 })) : [];

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        dateRange={dateRange}
        onDateRangeChange={(dates) => dates && setDateRange(dates)}
        deviceFilter={deviceFilter}
        onDeviceFilterChange={setDeviceFilter}
        onRefresh={fetchAllStats}
        loading={loading}
      />
      
      <div className="container mx-auto px-4 py-6">
        <MainTabs>
          {/* 개요 탭 */}
          <OverviewTab>
            <div className="space-y-6">
              {/* 🎯 Phase 4: 체류시간 기반 어트리뷰션 - GA4 단점 보완 */}
              {attributionData && ga4Data && attributionData.attributions.length > 0 && (
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
                          data={attributionData.attributions.slice(0, 5).map((item, idx) => {
                            const ga4Item = ga4Data.attributions.find(g => g.utm_campaign === item.utm_campaign);
                            return {
                              campaign: item.utm_campaign,
                              'GA4 (Last Click)': Math.round(ga4Item?.revenue || 0),
                              '체류시간 기반': Math.round(item.revenue)
                            };
                          })}
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
              )}

              {/* 📢 광고 캠페인 성과 요약 */}
              {utmPerformance && utmPerformance.campaigns.length > 0 && (
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
              )}

              {/* 핵심 KPI - 대형 */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <EnhancedMetricCard
                  title="총 방문자"
                  value={stats?.visitors?.total || 0}
                  subtitle={`신규: ${stats?.visitors?.new || 0} / 재방문: ${stats?.visitors?.returning || 0}`}
                  change={stats?.visitors?.change_percent || 0}
                  icon={Users}
                  sparklineData={visitorsSparkline}
                  status={(stats?.visitors?.change_percent || 0) > 0 ? 'good' : (stats?.visitors?.change_percent || 0) < 0 ? 'bad' : 'neutral'}
                />
                <EnhancedMetricCard
                  title="총 페이지뷰"
                  value={stats?.pageviews?.total || 0}
                  change={stats?.pageviews?.change_percent || 0}
                  icon={Eye}
                  status={(stats?.pageviews?.change_percent || 0) > 0 ? 'good' : 'neutral'}
                />
                <EnhancedMetricCard
                  title="총 매출"
                  value={stats?.revenue?.total || 0}
                  change={stats?.revenue?.change_percent || 0}
                  icon={DollarSign}
                  sparklineData={revenueSparkline}
                  format="currency"
                  status={(stats?.revenue?.change_percent || 0) > 10 ? 'good' : (stats?.revenue?.change_percent || 0) < -10 ? 'bad' : 'warning'}
                  size="large"
                />
                <EnhancedMetricCard
                  title="구매 전환율"
                  value={stats?.conversion?.rate || 0}
                  subtitle={`주문: ${stats?.orders?.count || 0}건`}
                  icon={Percent}
                  format="percent"
                  status={(stats?.conversion?.rate || 0) > 3 ? 'good' : (stats?.conversion?.rate || 0) < 1 ? 'bad' : 'warning'}
                />
              </div>

              {/* 인사이트 패널 */}
              <InsightsPanel />

              {/* 실시간 활동 */}
              {recentActivity && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                      실시간 활동
                      <span className="text-xs text-muted-foreground ml-auto">3분마다 자동 갱신</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <div className="font-medium mb-3 flex items-center justify-between">
                          <span>📦 최근 주문</span>
                          <span className="text-xs text-muted-foreground">최근 24시간 내</span>
                        </div>
                        <div className="space-y-2">
                          {recentActivity?.recent_orders?.length > 0 ? (
                            recentActivity.recent_orders.slice(0, 3).map((order, idx) => (
                              <div key={idx} className="text-sm p-2 bg-muted rounded flex justify-between items-center gap-2">
                                <span className="truncate flex-1">{order.product_name}</span>
                                <span className="text-xs text-muted-foreground whitespace-nowrap">{dayjs(order.timestamp).fromNow()}</span>
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-muted-foreground">최근 주문이 없습니다</div>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="font-medium mb-3 flex items-center justify-between">
                          <span>👀 인기 조회 상품</span>
                          <span className="text-xs text-muted-foreground">최근 1시간 내</span>
                        </div>
                        <div className="space-y-2">
                          {recentActivity?.recently_viewed?.length > 0 ? (
                            recentActivity.recently_viewed.slice(0, 3).map((product, idx) => (
                              <div key={idx} className="text-sm p-2 bg-muted rounded flex justify-between items-center gap-2">
                                <span className="truncate flex-1">{product.product_name}</span>
                                <span className="text-xs font-semibold text-blue-600">{product.view_count}회 조회</span>
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-muted-foreground">최근 조회 상품이 없습니다</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </OverviewTab>

          {/* 성과 탭 */}
          <PerformanceTab>
            <div className="space-y-6">
              {/* 트렌드 차트 */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>매출 트렌드</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={dailyData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickFormatter={(date) => dayjs(date).format('MM/DD')} />
                        <YAxis />
                        <Tooltip formatter={(value) => `${value.toLocaleString()}원`} />
                        <Legend />
                        <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} name="매출" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>방문자 & 주문</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={dailyData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickFormatter={(date) => dayjs(date).format('MM/DD')} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="visitors" fill="#10b981" name="방문자" />
                        <Bar dataKey="orders" fill="#f59e0b" name="주문" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* 상품 성과 테이블 */}
              <Card>
                <CardHeader>
                  <CardTitle>상품 성과 Top 10</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table
                    dataSource={stats?.products || []}
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
            </div>
          </PerformanceTab>

          {/* 고객 탭 */}
          <AudienceTab>
            <div className="space-y-6">
              {/* 세그먼트 비교 */}
              {segments && (
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="border-l-4 border-l-green-500">
                    <CardHeader>
                      <CardTitle>🆕 신규 방문자</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-muted-foreground">방문자</div>
                          <div className="text-2xl font-bold">{segments?.new_visitors?.visitor_count || 0}</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">전환율</div>
                          <div className="text-2xl font-bold">{segments?.new_visitors?.conversion_rate || 0}%</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">평균 페이지뷰</div>
                          <div className="text-xl font-semibold">{segments?.new_visitors?.avg_pageviews_per_session || 0}</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">매출</div>
                          <div className="text-xl font-semibold">{(segments?.new_visitors?.revenue || 0).toLocaleString()}원</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-l-4 border-l-blue-500">
                    <CardHeader>
                      <CardTitle>🔄 재방문 방문자</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-muted-foreground">방문자</div>
                          <div className="text-2xl font-bold">{segments?.returning_visitors?.visitor_count || 0}</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">전환율</div>
                          <div className="text-2xl font-bold">{segments?.returning_visitors?.conversion_rate || 0}%</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">평균 페이지뷰</div>
                          <div className="text-xl font-semibold">{segments?.returning_visitors?.avg_pageviews_per_session || 0}</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">매출</div>
                          <div className="text-xl font-semibold">{(segments?.returning_visitors?.revenue || 0).toLocaleString()}원</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* 디바이스 분석 */}
              <Card>
                <CardHeader>
                  <CardTitle>디바이스 분석</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <div className="text-3xl font-bold">{stats?.devices?.pc || 0}</div>
                      <div className="text-sm text-muted-foreground mt-1">PC</div>
                      <div className="text-xs text-muted-foreground mt-2">
                        {(stats?.visitors?.total > 0 ? ((stats.devices.pc / stats.visitors.total) * 100).toFixed(1) : 0)}%
                      </div>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <div className="text-3xl font-bold">{stats?.devices?.mobile || 0}</div>
                      <div className="text-sm text-muted-foreground mt-1">모바일</div>
                      <div className="text-xs text-muted-foreground mt-2">
                        {(stats?.visitors?.total > 0 ? ((stats.devices.mobile / stats.visitors.total) * 100).toFixed(1) : 0)}%
                      </div>
                    </div>
                    <div className="text-center p-4 bg-primary/10 rounded-lg">
                      <div className="text-3xl font-bold text-primary">{stats?.visitors?.total || 0}</div>
                      <div className="text-sm text-muted-foreground mt-1">전체</div>
                      <div className="text-xs text-muted-foreground mt-2">100%</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </AudienceTab>
        </MainTabs>
      </div>
    </div>
  );
}

export default AppNew;

