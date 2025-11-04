# Phase 4: UTM 기반 마케팅 분석 구현 계획

## 🎯 목표

**GA4의 주요 단점 해결:**
- 마지막 클릭에만 100% ROAS 몰리는 문제 해결
- 다양한 어트리뷰션 모델 지원
- 광고별 실제 기여도 정확한 측정

## 📊 현재 상태 분석

### ✅ 이미 구현된 기능

1. **Tracker (`tracker/src/tracker.js`)**
   - UTM 파라미터 수집: `utm_source`, `utm_medium`, `utm_campaign`
   - 페이지뷰 시 UTM 자동 추출
   
2. **Database (`backend/migrations/init.sql`)**
   - `visitors` 테이블: UTM 컬럼 존재
   - `conversions` 테이블: UTM 컬럼 존재 (하지만 사용 안 함)

3. **Backend (`backend/src/routes/track.js`)**
   - 방문 시 UTM 저장: `handlePageview` 함수

### ❌ 구현 필요 사항

1. **구매 시 UTM 연결 누락**
   - `conversions` 테이블에 UTM 저장 안 됨
   - 어떤 광고로 구매했는지 알 수 없음

2. **UTM 성과 분석 API 없음**
   - 매체별/캠페인별 매출 집계 불가
   - ROAS 계산 불가

3. **대시보드 UTM 화면 없음**
   - 광고 성과 시각화 없음

---

## 🚀 구현 단계

### Phase 4.1: UTM 추적 강화 (필수)

**목표:** 구매 시 어떤 광고를 보고 왔는지 저장

#### 작업 1: Backend - 구매 시 UTM 저장

**파일:** `backend/src/routes/track.js`

**수정 위치:** `handleEcommerceEvent` 함수 (119-192라인)

**현재 코드:**
```javascript
async function handleEcommerceEvent(event) {
  // ...
  if (event_type === 'purchase' && order_id) {
    await db.query(`
      INSERT INTO conversions (
        session_id, visitor_id, order_id, total_amount, 
        product_count, timestamp, discount_amount, 
        mileage_used, shipping_fee, final_payment
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      // ...
    `);
  }
}
```

**수정 후:**
```javascript
async function handleEcommerceEvent(event) {
  // ...
  if (event_type === 'purchase' && order_id) {
    // 1. visitor의 UTM 정보 조회
    const visitorUtm = await db.query(`
      SELECT utm_source, utm_medium, utm_campaign
      FROM visitors
      WHERE visitor_id = $1
    `, [visitor_id]);

    const utm = visitorUtm.rows[0] || {};

    // 2. 구매 시 UTM과 함께 저장
    await db.query(`
      INSERT INTO conversions (
        session_id, visitor_id, order_id, total_amount, 
        product_count, timestamp, discount_amount, 
        mileage_used, shipping_fee, final_payment,
        utm_source, utm_campaign
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (order_id) DO UPDATE SET
        discount_amount = EXCLUDED.discount_amount,
        mileage_used = EXCLUDED.mileage_used,
        shipping_fee = EXCLUDED.shipping_fee,
        final_payment = EXCLUDED.final_payment,
        utm_source = EXCLUDED.utm_source,
        utm_campaign = EXCLUDED.utm_campaign
    `, [
      session_id, visitor_id, order_id, total_amount,
      quantity || 1, eventTime,
      discount_amount || 0,
      mileage_used || 0,
      shipping_fee || 0,
      final_payment || 0,
      utm.utm_source || null,
      utm.utm_campaign || null
    ]);
  }
}
```

**검증 방법:**
```sql
-- PostgreSQL에서 확인
SELECT order_id, total_amount, utm_source, utm_campaign 
FROM conversions 
WHERE utm_source IS NOT NULL;
```

---

### Phase 4.2: UTM 성과 분석 API

**목표:** 광고 캠페인별 매출/전환율 조회

#### 작업 2: Backend - UTM 성과 API 추가

**파일:** `backend/src/routes/stats.js`

**새 엔드포인트:** `GET /api/stats/utm-performance`

**구현 코드:**
```javascript
// GET /api/stats/utm-performance - UTM 캠페인 성과
router.get('/utm-performance', async (req, res) => {
  try {
    const { start, end, device } = req.query;
    
    if (!start || !end) {
      return res.status(400).json({ 
        error: 'start and end dates are required (YYYY-MM-DD format)' 
      });
    }

    const startDate = new Date(start);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    // Device filter setup
    const deviceFilter = device && device !== 'all' ? 'AND v.device_type = $3' : '';
    const params = device && device !== 'all' 
      ? [startDate, endDate, device] 
      : [startDate, endDate];

    // 1. UTM별 방문자 및 세션 집계
    const utmQuery = `
      SELECT 
        v.utm_source,
        v.utm_medium,
        v.utm_campaign,
        COUNT(DISTINCT v.visitor_id) as visitors,
        COUNT(DISTINCT s.session_id) as sessions,
        COALESCE(SUM(CASE WHEN c.order_id IS NOT NULL THEN 1 ELSE 0 END), 0) as orders,
        COALESCE(SUM(c.final_payment), 0) as revenue,
        COALESCE(AVG(c.final_payment), 0) as avg_order_value
      FROM visitors v
      LEFT JOIN sessions s ON v.visitor_id = s.visitor_id 
        AND s.start_time >= $1 AND s.start_time <= $2
      LEFT JOIN conversions c ON v.visitor_id = c.visitor_id 
        AND c.timestamp >= $1 AND c.timestamp <= $2
      WHERE v.utm_source IS NOT NULL 
        AND v.first_visit >= $1 AND v.first_visit <= $2
        ${deviceFilter}
      GROUP BY v.utm_source, v.utm_medium, v.utm_campaign
      ORDER BY revenue DESC
    `;

    const result = await db.query(utmQuery, params);

    // 2. 응답 데이터 가공
    const campaigns = result.rows.map(row => {
      const visitors = parseInt(row.visitors);
      const orders = parseInt(row.orders);
      const revenue = parseInt(row.revenue);

      return {
        utm_source: row.utm_source,
        utm_medium: row.utm_medium || '',
        utm_campaign: row.utm_campaign || '',
        visitors,
        sessions: parseInt(row.sessions),
        orders,
        revenue,
        conversion_rate: visitors > 0 
          ? parseFloat(((orders / visitors) * 100).toFixed(2))
          : 0,
        aov: orders > 0 
          ? Math.round(revenue / orders)
          : 0
      };
    });

    // 3. 전체 통계 (UTM 있는 것만)
    const totalStats = campaigns.reduce((acc, campaign) => ({
      visitors: acc.visitors + campaign.visitors,
      sessions: acc.sessions + campaign.sessions,
      orders: acc.orders + campaign.orders,
      revenue: acc.revenue + campaign.revenue
    }), { visitors: 0, sessions: 0, orders: 0, revenue: 0 });

    res.json({
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      campaigns,
      total: {
        ...totalStats,
        conversion_rate: totalStats.visitors > 0 
          ? parseFloat(((totalStats.orders / totalStats.visitors) * 100).toFixed(2))
          : 0,
        aov: totalStats.orders > 0 
          ? Math.round(totalStats.revenue / totalStats.orders)
          : 0
      }
    });
  } catch (error) {
    console.error('UTM performance error:', error);
    res.status(500).json({ error: 'Failed to fetch UTM performance data' });
  }
});
```

**테스트 방법:**
```bash
# PowerShell
curl "http://localhost:3003/api/stats/utm-performance?start=2025-01-01&end=2025-01-31"
```

**예상 응답:**
```json
{
  "period": {
    "start": "2025-01-01T00:00:00.000Z",
    "end": "2025-01-31T23:59:59.999Z"
  },
  "campaigns": [
    {
      "utm_source": "instagram",
      "utm_medium": "ad",
      "utm_campaign": "winter_sale",
      "visitors": 250,
      "sessions": 310,
      "orders": 12,
      "revenue": 850000,
      "conversion_rate": 4.8,
      "aov": 70833
    },
    {
      "utm_source": "facebook",
      "utm_medium": "cpc",
      "utm_campaign": "retargeting",
      "visitors": 180,
      "sessions": 200,
      "orders": 8,
      "revenue": 420000,
      "conversion_rate": 4.44,
      "aov": 52500
    }
  ],
  "total": {
    "visitors": 430,
    "sessions": 510,
    "orders": 20,
    "revenue": 1270000,
    "conversion_rate": 4.65,
    "aov": 63500
  }
}
```

---

### Phase 4.3: 대시보드 UTM 섹션

**목표:** 광고 성과를 시각적으로 표시

#### 작업 3: Frontend - UTM 성과 테이블 추가

**파일:** `frontend/src/App.jsx`

**추가 위치:** 세그먼트 분석 아래 (612-717라인 이후)

**구현 코드:**
```jsx
// State 추가 (39라인 근처)
const [utmPerformance, setUtmPerformance] = useState(null);

// fetchAllStats 함수에 API 호출 추가 (50-125라인)
const fetchAllStats = async () => {
  try {
    setLoading(true);
    const startDate = dateRange[0].format('YYYY-MM-DD');
    const endDate = dateRange[1].format('YYYY-MM-DD');
    
    const [rangeResponse, dailyResponse, segmentsResponse, utmResponse] = await Promise.all([
      axios.get(`${API_URL}/api/stats/range`, {...}),
      axios.get(`${API_URL}/api/stats/daily`, {...}),
      axios.get(`${API_URL}/api/stats/segments`, {...}),
      // 새로 추가
      axios.get(`${API_URL}/api/stats/utm-performance`, {
        params: {
          start: startDate,
          end: endDate,
          device: deviceFilter
        }
      })
    ]);
    
    // ... 기존 코드 ...
    
    // UTM 데이터 설정
    setUtmPerformance(utmResponse.data);
    
  } catch (error) {
    console.error('Failed to fetch stats:', error);
  }
};

// JSX에 UTM 섹션 추가 (717라인 이후, 마지막 갱신 메시지 앞)
{/* UTM 광고 성과 */}
{utmPerformance && utmPerformance.campaigns.length > 0 && (
  <Row gutter={[16, 16]} style={{ marginTop: '20px' }}>
    <Col span={24}>
      <Title level={3}>📢 광고 성과 (UTM 추적)</Title>
    </Col>
    
    {/* 전체 통계 카드 */}
    <Col span={24}>
      <Card>
        <Row gutter={16}>
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
              valueStyle={{ color: '#cf1322' }}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="광고 전환율"
              value={utmPerformance.total.conversion_rate}
              suffix="%"
              valueStyle={{ color: '#3f8600' }}
            />
          </Col>
        </Row>
      </Card>
    </Col>

    {/* 캠페인별 상세 테이블 */}
    <Col span={24}>
      <Card title="캠페인별 성과">
        <Table 
          columns={[
            {
              title: '매체',
              dataIndex: 'utm_source',
              key: 'utm_source',
              render: (source) => (
                <Tag color="blue">{source}</Tag>
              ),
            },
            {
              title: '캠페인',
              dataIndex: 'utm_campaign',
              key: 'utm_campaign',
              render: (campaign) => campaign || '-',
            },
            {
              title: '방문자',
              dataIndex: 'visitors',
              key: 'visitors',
              align: 'right',
              sorter: (a, b) => a.visitors - b.visitors,
            },
            {
              title: '세션',
              dataIndex: 'sessions',
              key: 'sessions',
              align: 'right',
            },
            {
              title: '주문',
              dataIndex: 'orders',
              key: 'orders',
              align: 'right',
              sorter: (a, b) => a.orders - b.orders,
            },
            {
              title: '매출',
              dataIndex: 'revenue',
              key: 'revenue',
              align: 'right',
              render: (revenue) => `${revenue.toLocaleString()}원`,
              sorter: (a, b) => a.revenue - b.revenue,
            },
            {
              title: '전환율',
              dataIndex: 'conversion_rate',
              key: 'conversion_rate',
              align: 'right',
              render: (rate) => (
                <Tag color={rate >= 3 ? 'green' : rate >= 1 ? 'orange' : 'default'}>
                  {rate}%
                </Tag>
              ),
              sorter: (a, b) => a.conversion_rate - b.conversion_rate,
            },
            {
              title: 'AOV',
              dataIndex: 'aov',
              key: 'aov',
              align: 'right',
              render: (aov) => `${aov.toLocaleString()}원`,
            },
          ]}
          dataSource={utmPerformance.campaigns}
          rowKey={(record) => `${record.utm_source}_${record.utm_campaign}`}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 900 }}
        />
      </Card>
    </Col>

    {/* 차트: 캠페인별 매출 비교 */}
    <Col span={24}>
      <Card title="캠페인별 매출 비교">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={utmPerformance.campaigns.slice(0, 10)}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="utm_campaign" 
              tick={{ fontSize: 11 }}
              angle={-45}
              textAnchor="end"
              height={100}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
            />
            <Tooltip 
              formatter={(value) => `${value.toLocaleString()}원`}
              labelFormatter={(label) => `캠페인: ${label}`}
            />
            <Legend />
            <Bar 
              dataKey="revenue" 
              fill="#1890ff" 
              name="매출"
              radius={[8, 8, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </Col>
  </Row>
)}
```

---

### Phase 4.4: 고급 어트리뷰션 (선택)

**목표:** 한 사용자가 여러 광고를 본 경우 기여도 분배

#### 데이터베이스 수정 필요

**새 테이블:** `utm_sessions` (세션별 UTM 이력)

```sql
CREATE TABLE IF NOT EXISTS utm_sessions (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(36) REFERENCES sessions(session_id),
  visitor_id VARCHAR(36) REFERENCES visitors(visitor_id),
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  timestamp TIMESTAMP NOT NULL,
  duration_seconds INTEGER DEFAULT 0,
  sequence_order INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_utm_sessions_visitor ON utm_sessions(visitor_id);
CREATE INDEX idx_utm_sessions_session ON utm_sessions(session_id);
CREATE INDEX idx_utm_sessions_timestamp ON utm_sessions(timestamp);
```

**시나리오:**
```
사용자 A:
- 2025-01-10 10:00 → 인스타 광고1 클릭 → 3분 체류 → 이탈
- 2025-01-10 15:00 → 인스타 광고2 클릭 → 10초 체류 → 구매 (50,000원)

어트리뷰션 모델별 기여도:
┌─────────────────┬──────────┬──────────┐
│ Model           │ 광고1    │ 광고2    │
├─────────────────┼──────────┼──────────┤
│ Last Click      │ 0원      │ 50,000원 │ ← GA4 기본값
│ First Click     │ 50,000원 │ 0원      │
│ Linear          │ 25,000원 │ 25,000원 │
│ Time Decay      │ 15,000원 │ 35,000원 │
│ Position Based  │ 20,000원 │ 20,000원 │ (나머지 10,000원은 중간)
│ Engagement      │ 48,350원 │ 1,650원  │ ← 체류시간 가중치
└─────────────────┴──────────┴──────────┘
```

**API 엔드포인트:**
```
GET /api/stats/utm-attribution?start=2025-01-01&end=2025-01-31&model=linear
```

**구현은 Phase 4.4에서 진행 예정**

---

### Phase 4.5: 광고비 관리 (선택)

**새 테이블:** `ad_spend`

```sql
CREATE TABLE IF NOT EXISTS ad_spend (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  utm_source VARCHAR(100) NOT NULL,
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100) NOT NULL,
  spend_amount INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'KRW',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(date, utm_source, utm_campaign)
);

CREATE INDEX idx_ad_spend_date ON ad_spend(date);
CREATE INDEX idx_ad_spend_campaign ON ad_spend(utm_source, utm_campaign);
```

**ROAS 계산:**
```
ROAS = 광고 매출 / 광고비
예: 500,000원 매출 / 100,000원 광고비 = ROAS 5.0 (500% 수익)
```

---

## 📋 구현 우선순위

### 🔴 우선 순위 1 (필수)
- [x] Phase 4.1: UTM 추적 강화
- [x] Phase 4.2: UTM 성과 API
- [x] Phase 4.3: 대시보드 UTM 섹션

### 🟡 우선 순위 2 (권장)
- [ ] Phase 4.4: 멀티터치 어트리뷰션
- [ ] Phase 4.5: 광고비 관리

### 🟢 우선 순위 3 (향후)
- [ ] 시간 감쇠 모델
- [ ] 체류시간 가중치 모델
- [ ] ROAS 알림 시스템

---

## 🧪 테스트 시나리오

### 시나리오 1: 인스타그램 광고 2개 테스트

```bash
# 1. 광고 1 클릭 시뮬레이션
https://moadamda.com/?utm_source=instagram&utm_medium=ad&utm_campaign=winter_sale_1

# 3분 체류 후 이탈

# 2. 광고 2 클릭 시뮬레이션 (같은 사용자)
https://moadamda.com/?utm_source=instagram&utm_medium=ad&utm_campaign=winter_sale_2

# 10초 후 구매

# 3. 대시보드에서 확인
http://localhost:3030
→ "광고 성과 (UTM)" 섹션에서 winter_sale_2에 매출 100% 귀속 확인
```

### 시나리오 2: 다양한 매체 테스트

```
- Facebook: ?utm_source=facebook&utm_medium=cpc&utm_campaign=retargeting
- Google: ?utm_source=google&utm_medium=cpc&utm_campaign=brand
- Naver: ?utm_source=naver&utm_medium=cpc&utm_campaign=keyword
- Kakao: ?utm_source=kakao&utm_medium=display&utm_campaign=banner
```

---

## 📊 예상 결과

### Before (현재)
```
❌ 어떤 광고로 구매했는지 알 수 없음
❌ 광고 ROAS 측정 불가
❌ GA4처럼 마지막 클릭만 추적
```

### After (Phase 4.1-4.3 완료)
```
✅ 매체별/캠페인별 매출 정확히 집계
✅ 전환율, AOV 계산
✅ 대시보드에서 실시간 광고 성과 확인
✅ 어떤 광고가 효과적인지 데이터 기반 판단
```

### After (Phase 4.4-4.5 완료)
```
🚀 여러 광고 접촉 시 기여도 분배
🚀 체류시간 기반 가중치 적용
🚀 광고비 대비 수익률(ROAS) 자동 계산
🚀 GA4보다 훨씬 유연한 분석
```

---

## 🎯 다음 작업

**지금 시작할 작업:**
1. ✅ Phase 4.1 구현 (Backend 수정)
2. ✅ Phase 4.2 구현 (API 추가)
3. ✅ Phase 4.3 구현 (Frontend 추가)
4. 테스트 및 검증
5. 실제 광고 URL에 UTM 적용

**"진행해" 또는 "개발해"라고 말씀하시면 바로 시작합니다!**

