# 유입 채널 성과 분석 개발 계획서

**작성일**: 2025-12-09  
**목적**: 방문자 분석 → 채널 성과 분석으로 전환하여 마케터가 실제 필요한 지표 제공

---

## 📋 현재 상태 (2025-12-09)

### ✅ 완료된 작업
- 기존 "방문자 분석" 카테고리 제거 (tracker 위젯 14개)
- 백엔드 API 엔드포인트 5개 제거 (`/api/stats/visitors/*`)
- 프론트엔드 LocalStorage 자동 필터링 적용
- 다른 기능 정상 작동 확인

### 🎯 다음 목표
"유입 채널 성과 분석" 기능 개발
- **핵심 가치**: "얼마나 많이 왔는가" → "어떤 채널이 돈을 벌어주는가"
- **타겟 사용자**: 마케터 (액션 가능한 인사이트 제공)

---

## 🎨 새로운 위젯 구성

### 카테고리명
- **ID**: `channel_performance`
- **표시명**: "유입 채널 성과"
- **아이콘**: `<FundOutlined>` (성장 차트)
- **설명**: "어떤 채널이 실제 매출을 만드는지 분석"

### 1️⃣ 숫자 카드 (KPI) - 4개

#### 1.1 방문자수 (UV)
```javascript
{
  id: 'total_visitors',
  label: '방문자수',
  icon: '👥',
  description: '선택 기간의 순 방문자 수',
  type: 'kpi',
  apiEndpoint: '/api/stats/channel/summary',
  dataKey: 'visitors',
  suffix: '명'
}
```

#### 1.2 전환율 ⭐ NEW
```javascript
{
  id: 'conversion_rate',
  label: '전환율',
  icon: '🎯',
  description: '방문자 중 구매한 비율',
  type: 'kpi',
  apiEndpoint: '/api/stats/channel/summary',
  dataKey: 'conversionRate',
  suffix: '%'
}
```

#### 1.3 평균 주문금액 (구매자 기준) ⭐ NEW
```javascript
{
  id: 'purchaser_aov',
  label: '구매자 평균금액',
  icon: '💰',
  description: '실제 구매한 고객의 평균 결제금액',
  type: 'kpi',
  apiEndpoint: '/api/stats/channel/summary',
  dataKey: 'purchaserAov',
  suffix: '원'
}
```

#### 1.4 신규 방문자 비율
```javascript
{
  id: 'new_visitor_rate',
  label: '신규 방문자 비율',
  icon: '🆕',
  description: '첫 방문 비율',
  type: 'kpi',
  apiEndpoint: '/api/stats/channel/summary',
  dataKey: 'newVisitorRate',
  suffix: '%'
}
```

---

### 2️⃣ 차트 - 4개

#### 2.1 채널별 전환율 비교 ⭐ NEW
```javascript
{
  id: 'channel_conversion',
  label: '채널별 전환율',
  icon: '📊',
  description: 'Google/Naver/Facebook 등 어떤 채널이 전환 잘 되는지',
  type: 'channel_bar',
  apiEndpoint: '/api/stats/channel/conversion',
  dataKey: 'channels',
  defaultWidth: 'medium',
  defaultHeight: 'medium'
}
```

**차트 데이터 구조:**
```json
{
  "channels": [
    {
      "name": "Google",
      "visitors": 1250,
      "conversions": 82,
      "conversionRate": 6.56,
      "revenue": 5234000
    },
    {
      "name": "Naver",
      "visitors": 980,
      "conversions": 45,
      "conversionRate": 4.59,
      "revenue": 2871000
    }
  ]
}
```

#### 2.2 유입 소스별 매출 기여도 ⭐ NEW
```javascript
{
  id: 'source_revenue',
  label: '유입 소스별 매출',
  icon: '💵',
  description: '어떤 채널이 실제 돈을 벌어주는지',
  type: 'revenue_bar',
  apiEndpoint: '/api/stats/channel/revenue',
  dataKey: 'sources',
  defaultWidth: 'medium',
  defaultHeight: 'medium'
}
```

**차트 데이터 구조:**
```json
{
  "sources": [
    {
      "name": "Google",
      "revenue": 5234000,
      "orders": 82,
      "share": 35.2
    },
    {
      "name": "직접 유입",
      "revenue": 4120000,
      "orders": 68,
      "share": 27.8
    }
  ]
}
```

#### 2.3 일별 방문 추이
```javascript
{
  id: 'daily_visitors',
  label: '일별 방문 추이',
  icon: '📈',
  description: '날짜별 방문자수 변화',
  type: 'visitor_line',
  apiEndpoint: '/api/stats/channel/daily',
  dataKey: 'daily',
  defaultWidth: 'medium',
  defaultHeight: 'medium'
}
```

#### 2.4 랜딩 페이지별 전환율 ⭐ NEW
```javascript
{
  id: 'landing_conversion',
  label: '랜딩 페이지별 전환율',
  icon: '🏠',
  description: '어떤 페이지에서 전환 잘 되는지',
  type: 'page_bar',
  apiEndpoint: '/api/stats/channel/landing',
  dataKey: 'pages',
  defaultWidth: 'medium',
  defaultHeight: 'medium'
}
```

---

### 3️⃣ 목록 (테이블) - 3개

#### 3.1 채널별 성과 종합 ⭐ NEW
```javascript
{
  id: 'channel_performance_table',
  label: '채널별 성과 종합',
  icon: '📋',
  description: '방문자 / 전환율 / 매출 통합 테이블',
  type: 'table',
  apiEndpoint: '/api/stats/channel/performance',
  dataKey: 'channels',
  defaultWidth: 'large',
  defaultHeight: 'tall'
}
```

**테이블 컬럼:**
| 순위 | 채널 | 방문자 | 전환율 | 주문수 | 매출 | 구매자AOV |
|------|------|--------|--------|--------|------|-----------|
| 1 | Google | 1,250 | 6.56% | 82 | 5,234,000원 | 63,829원 |
| 2 | 직접 유입 | 1,100 | 6.18% | 68 | 4,120,000원 | 60,588원 |

#### 3.2 전환 잘 되는 페이지 TOP ⭐ NEW
```javascript
{
  id: 'top_converting_pages',
  label: '전환 잘 되는 페이지',
  icon: '🏆',
  description: '페이지별 전환율 순위',
  type: 'table',
  apiEndpoint: '/api/stats/channel/top-pages',
  dataKey: 'pages',
  defaultWidth: 'medium',
  defaultHeight: 'tall'
}
```

**테이블 컬럼:**
| 순위 | 페이지 | 방문자 | 전환율 | 주문수 | 매출 |
|------|--------|--------|--------|--------|------|
| 1 | /product/129 | 850 | 15.76% | 134 | 8,551,280원 |
| 2 | /product/141 | 620 | 13.39% | 83 | 5,301,700원 |

#### 3.3 UTM 캠페인별 성과
```javascript
{
  id: 'utm_performance',
  label: 'UTM 캠페인별 성과',
  icon: '📢',
  description: '광고 캠페인별 방문자와 전환율',
  type: 'table',
  apiEndpoint: '/api/stats/channel/utm',
  dataKey: 'campaigns',
  defaultWidth: 'large',
  defaultHeight: 'tall'
}
```

---

## 🔧 백엔드 API 개발

### 필요한 API 엔드포인트 (총 6개)

#### 1. `/api/stats/channel/summary` - 종합 지표
**Query params:**
- `start`: YYYY-MM-DD
- `end`: YYYY-MM-DD

**Response:**
```json
{
  "period": {
    "start": "2025-12-01T00:00:00.000Z",
    "end": "2025-12-09T23:59:59.999Z"
  },
  "visitors": 4556,
  "conversions": 262,
  "conversionRate": 5.75,
  "revenue": 16719636,
  "purchaserAov": 63815,
  "newVisitors": 1577,
  "newVisitorRate": 34.6
}
```

**SQL 쿼리:**
```sql
WITH period_stats AS (
  SELECT 
    COUNT(DISTINCT p.visitor_id) as total_visitors,
    COUNT(DISTINCT CASE WHEN v.visit_count = 1 THEN p.visitor_id END) as new_visitors
  FROM pageviews p
  LEFT JOIN visitors v ON p.visitor_id = v.visitor_id
  WHERE p.timestamp >= $1 AND p.timestamp <= $2
),
conversion_stats AS (
  SELECT 
    COUNT(*) as total_orders,
    SUM(final_amount) as total_revenue,
    COUNT(DISTINCT visitor_id) as unique_purchasers
  FROM conversions
  WHERE timestamp >= $1 AND timestamp <= $2
    AND payment_status NOT IN ('cancelled', 'refunded')
)
SELECT 
  ps.total_visitors,
  ps.new_visitors,
  ROUND((ps.new_visitors::decimal / ps.total_visitors * 100), 1) as new_visitor_rate,
  cs.total_orders,
  cs.unique_purchasers,
  ROUND((cs.unique_purchasers::decimal / ps.total_visitors * 100), 2) as conversion_rate,
  cs.total_revenue,
  ROUND(cs.total_revenue::decimal / cs.unique_purchasers) as purchaser_aov
FROM period_stats ps, conversion_stats cs;
```

---

#### 2. `/api/stats/channel/conversion` - 채널별 전환율
**Query params:**
- `start`: YYYY-MM-DD
- `end`: YYYY-MM-DD
- `limit`: number (기본 10)

**Response:**
```json
{
  "channels": [
    {
      "name": "Google",
      "visitors": 1250,
      "conversions": 82,
      "conversionRate": 6.56,
      "revenue": 5234000
    }
  ]
}
```

**SQL 쿼리:**
```sql
WITH channel_visitors AS (
  SELECT 
    CASE 
      WHEN referrer IS NULL OR referrer = '' THEN '직접 유입'
      WHEN referrer LIKE '%google%' THEN 'Google'
      WHEN referrer LIKE '%naver%' THEN 'Naver'
      WHEN referrer LIKE '%facebook%' OR referrer LIKE '%fb.%' THEN 'Facebook'
      WHEN referrer LIKE '%instagram%' THEN 'Instagram'
      WHEN referrer LIKE '%kakao%' THEN 'KakaoTalk'
      ELSE '기타'
    END as channel,
    COUNT(DISTINCT visitor_id) as visitors
  FROM pageviews
  WHERE timestamp >= $1 AND timestamp <= $2
  GROUP BY channel
),
channel_conversions AS (
  SELECT 
    CASE 
      WHEN v.referrer IS NULL OR v.referrer = '' THEN '직접 유입'
      WHEN v.referrer LIKE '%google%' THEN 'Google'
      WHEN v.referrer LIKE '%naver%' THEN 'Naver'
      WHEN v.referrer LIKE '%facebook%' OR v.referrer LIKE '%fb.%' THEN 'Facebook'
      WHEN v.referrer LIKE '%instagram%' THEN 'Instagram'
      WHEN v.referrer LIKE '%kakao%' THEN 'KakaoTalk'
      ELSE '기타'
    END as channel,
    COUNT(*) as conversions,
    SUM(c.final_amount) as revenue
  FROM conversions c
  LEFT JOIN visitors v ON c.visitor_id = v.visitor_id
  WHERE c.timestamp >= $1 AND c.timestamp <= $2
    AND c.payment_status NOT IN ('cancelled', 'refunded')
  GROUP BY channel
)
SELECT 
  cv.channel as name,
  cv.visitors,
  COALESCE(cc.conversions, 0) as conversions,
  ROUND((COALESCE(cc.conversions, 0)::decimal / cv.visitors * 100), 2) as conversion_rate,
  COALESCE(cc.revenue, 0) as revenue
FROM channel_visitors cv
LEFT JOIN channel_conversions cc ON cv.channel = cc.channel
ORDER BY conversion_rate DESC
LIMIT $3;
```

---

#### 3. `/api/stats/channel/revenue` - 유입 소스별 매출
**Query params:**
- `start`: YYYY-MM-DD
- `end`: YYYY-MM-DD
- `limit`: number (기본 10)

**Response:**
```json
{
  "sources": [
    {
      "name": "Google",
      "revenue": 5234000,
      "orders": 82,
      "share": 35.2
    }
  ],
  "totalRevenue": 14870000
}
```

**SQL 쿼리:**
```sql
WITH total AS (
  SELECT SUM(final_amount) as total_revenue
  FROM conversions
  WHERE timestamp >= $1 AND timestamp <= $2
    AND payment_status NOT IN ('cancelled', 'refunded')
),
source_revenue AS (
  SELECT 
    CASE 
      WHEN v.referrer IS NULL OR v.referrer = '' THEN '직접 유입'
      WHEN v.referrer LIKE '%google%' THEN 'Google'
      WHEN v.referrer LIKE '%naver%' THEN 'Naver'
      WHEN v.referrer LIKE '%facebook%' OR v.referrer LIKE '%fb.%' THEN 'Facebook'
      WHEN v.referrer LIKE '%instagram%' THEN 'Instagram'
      WHEN v.referrer LIKE '%kakao%' THEN 'KakaoTalk'
      ELSE '기타'
    END as source,
    COUNT(*) as orders,
    SUM(c.final_amount) as revenue
  FROM conversions c
  LEFT JOIN visitors v ON c.visitor_id = v.visitor_id
  WHERE c.timestamp >= $1 AND c.timestamp <= $2
    AND c.payment_status NOT IN ('cancelled', 'refunded')
  GROUP BY source
)
SELECT 
  sr.source as name,
  sr.revenue,
  sr.orders,
  ROUND((sr.revenue::decimal / t.total_revenue * 100), 1) as share
FROM source_revenue sr, total t
ORDER BY revenue DESC
LIMIT $3;
```

---

#### 4. `/api/stats/channel/daily` - 일별 방문자 추이
**Query params:**
- `start`: YYYY-MM-DD
- `end`: YYYY-MM-DD

**Response:**
```json
{
  "daily": [
    {
      "date": "2025-12-01",
      "visitors": 450,
      "conversions": 28
    }
  ]
}
```

**SQL 쿼리:**
```sql
WITH daily_visitors AS (
  SELECT 
    DATE(timestamp) as date,
    COUNT(DISTINCT visitor_id) as visitors
  FROM pageviews
  WHERE timestamp >= $1 AND timestamp <= $2
  GROUP BY DATE(timestamp)
),
daily_conversions AS (
  SELECT 
    DATE(timestamp) as date,
    COUNT(*) as conversions
  FROM conversions
  WHERE timestamp >= $1 AND timestamp <= $2
    AND payment_status NOT IN ('cancelled', 'refunded')
  GROUP BY DATE(timestamp)
)
SELECT 
  dv.date,
  dv.visitors,
  COALESCE(dc.conversions, 0) as conversions
FROM daily_visitors dv
LEFT JOIN daily_conversions dc ON dv.date = dc.date
ORDER BY dv.date ASC;
```

---

#### 5. `/api/stats/channel/landing` - 랜딩 페이지별 전환율
**Query params:**
- `start`: YYYY-MM-DD
- `end`: YYYY-MM-DD
- `limit`: number (기본 10)

**Response:**
```json
{
  "pages": [
    {
      "url": "/product/129",
      "title": "★리뉴얼★ [반값특가] 건강을 모아담다",
      "visitors": 850,
      "conversions": 134,
      "conversionRate": 15.76,
      "revenue": 8551280
    }
  ]
}
```

**SQL 쿼리:**
```sql
WITH landing_visitors AS (
  SELECT 
    p.page_url,
    p.page_title,
    COUNT(DISTINCT p.visitor_id) as visitors
  FROM pageviews p
  INNER JOIN (
    SELECT visitor_id, MIN(timestamp) as first_visit
    FROM pageviews
    WHERE timestamp >= $1 AND timestamp <= $2
    GROUP BY visitor_id
  ) first ON p.visitor_id = first.visitor_id AND p.timestamp = first.first_visit
  GROUP BY p.page_url, p.page_title
),
page_conversions AS (
  SELECT 
    first_p.page_url,
    COUNT(DISTINCT c.visitor_id) as conversions,
    SUM(c.final_amount) as revenue
  FROM conversions c
  INNER JOIN (
    SELECT visitor_id, page_url, MIN(timestamp) as first_visit
    FROM pageviews
    WHERE timestamp >= $1 AND timestamp <= $2
    GROUP BY visitor_id, page_url
  ) first_p ON c.visitor_id = first_p.visitor_id
  WHERE c.timestamp >= $1 AND c.timestamp <= $2
    AND c.payment_status NOT IN ('cancelled', 'refunded')
  GROUP BY first_p.page_url
)
SELECT 
  lv.page_url as url,
  lv.page_title as title,
  lv.visitors,
  COALESCE(pc.conversions, 0) as conversions,
  ROUND((COALESCE(pc.conversions, 0)::decimal / lv.visitors * 100), 2) as conversion_rate,
  COALESCE(pc.revenue, 0) as revenue
FROM landing_visitors lv
LEFT JOIN page_conversions pc ON lv.page_url = pc.page_url
WHERE lv.visitors >= 10  -- 최소 방문자 수 필터
ORDER BY conversion_rate DESC
LIMIT $3;
```

---

#### 6. `/api/stats/channel/performance` - 채널별 성과 종합 테이블
**Query params:**
- `start`: YYYY-MM-DD
- `end`: YYYY-MM-DD
- `limit`: number (기본 10)

**Response:**
```json
{
  "channels": [
    {
      "rank": 1,
      "channel": "Google",
      "visitors": 1250,
      "conversionRate": 6.56,
      "orders": 82,
      "revenue": 5234000,
      "purchaserAov": 63829
    }
  ]
}
```

**SQL 쿼리:**
```sql
-- 채널별 전환율 + revenue 통합 쿼리 (위 2, 3번 조합)
```

---

#### 7. `/api/stats/channel/top-pages` - 전환 잘 되는 페이지 TOP
**Query params:**
- `start`: YYYY-MM-DD
- `end`: YYYY-MM-DD
- `limit`: number (기본 10)

**Response:**
```json
{
  "pages": [
    {
      "rank": 1,
      "url": "/product/129",
      "title": "★리뉴얼★ [반값특가] 건강을 모아담다",
      "visitors": 850,
      "conversionRate": 15.76,
      "orders": 134,
      "revenue": 8551280
    }
  ]
}
```

---

#### 8. `/api/stats/channel/utm` - UTM 캠페인별 성과
**Query params:**
- `start`: YYYY-MM-DD
- `end`: YYYY-MM-DD
- `limit`: number (기본 10)

**Response:**
```json
{
  "campaigns": [
    {
      "rank": 1,
      "source": "google",
      "medium": "cpc",
      "campaign": "summer_sale",
      "visitors": 450,
      "conversionRate": 8.22,
      "orders": 37,
      "revenue": 2368500
    }
  ]
}
```

**SQL 쿼리:**
```sql
WITH utm_visitors AS (
  SELECT 
    COALESCE(utm_source, '(없음)') as utm_source,
    COALESCE(utm_medium, '(없음)') as utm_medium,
    COALESCE(utm_campaign, '(없음)') as utm_campaign,
    COUNT(DISTINCT visitor_id) as visitors
  FROM utm_sessions
  WHERE entry_timestamp >= $1 AND entry_timestamp <= $2
    AND (utm_source IS NOT NULL OR utm_medium IS NOT NULL OR utm_campaign IS NOT NULL)
  GROUP BY utm_source, utm_medium, utm_campaign
),
utm_conversions AS (
  SELECT 
    COALESCE(us.utm_source, '(없음)') as utm_source,
    COALESCE(us.utm_medium, '(없음)') as utm_medium,
    COALESCE(us.utm_campaign, '(없음)') as utm_campaign,
    COUNT(*) as orders,
    SUM(c.final_amount) as revenue
  FROM conversions c
  INNER JOIN utm_sessions us ON c.visitor_id = us.visitor_id
  WHERE c.timestamp >= $1 AND c.timestamp <= $2
    AND c.payment_status NOT IN ('cancelled', 'refunded')
  GROUP BY us.utm_source, us.utm_medium, us.utm_campaign
)
SELECT 
  uv.utm_source as source,
  uv.utm_medium as medium,
  uv.utm_campaign as campaign,
  uv.visitors,
  COALESCE(uc.orders, 0) as orders,
  ROUND((COALESCE(uc.orders, 0)::decimal / uv.visitors * 100), 2) as conversion_rate,
  COALESCE(uc.revenue, 0) as revenue
FROM utm_visitors uv
LEFT JOIN utm_conversions uc ON 
  uv.utm_source = uc.utm_source 
  AND uv.utm_medium = uc.utm_medium 
  AND uv.utm_campaign = uc.utm_campaign
ORDER BY conversion_rate DESC
LIMIT $3;
```

---

## 📂 파일 구조

### 백엔드
```
backend/src/routes/stats/
├── channel.js              ⭐ NEW - 모든 채널 성과 API
└── index.js               (channel.js 라우터 추가)
```

### 프론트엔드
```
frontend/src/pages/
└── MyDashboard.jsx        (DATA_SOURCES에 channel_performance 추가)
                           (WIDGET_PRESETS에 channel_performance 추가)
```

---

## 🚀 개발 순서 (권장)

### Phase 1: 백엔드 API 개발 (우선순위 순)
1. ✅ **기본 종합 지표** (`/channel/summary`)
   - 방문자, 전환율, 구매자AOV 등
   - 다른 API 개발 전 테스트용

2. ✅ **채널별 전환율** (`/channel/conversion`)
   - 마케터가 가장 필요한 지표
   - 차트 렌더링 테스트

3. ✅ **유입 소스별 매출** (`/channel/revenue`)
   - ROI 계산 기반 데이터

4. ✅ **일별 추이** (`/channel/daily`)
   - 기존 코드 참고 가능

5. ✅ **랜딩 페이지 전환율** (`/channel/landing`)
   - 복잡한 쿼리 (first pageview 찾기)

6. ✅ **채널별 성과 종합** (`/channel/performance`)
   - 테이블용 (2+3 조합)

7. ✅ **전환 페이지 TOP** (`/channel/top-pages`)
   - 5번과 유사

8. ✅ **UTM 성과** (`/channel/utm`)
   - 기존 UTM 코드 참고

---

### Phase 2: 프론트엔드 위젯 개발
1. ✅ **DATA_SOURCES 추가**
   - `channel_performance` 카테고리 등록

2. ✅ **숫자 카드 위젯 4개**
   - 방문자수, 전환율, 구매자AOV, 신규 비율

3. ✅ **차트 위젯 2개 (우선)**
   - 채널별 전환율 막대 차트
   - 유입 소스별 매출 막대 차트

4. ✅ **테이블 위젯 1개 (우선)**
   - 채널별 성과 종합

5. 🔲 **나머지 차트/테이블 (선택)**
   - 일별 추이, 랜딩 페이지, UTM

---

### Phase 3: 테스트 및 배포
1. ✅ **로컬 테스트**
   - 모든 위젯 정상 작동 확인
   - 데이터 정합성 검증

2. ✅ **Git 커밋 및 푸시**
   - 커밋 메시지: `[Feature: 유입 채널 성과 분석] 기능 추가`

3. ✅ **서버 배포**
   ```bash
   ssh root@49.50.139.223 '
     cd /root/moadamda-analytics &&
     git pull origin main &&
     docker-compose -f docker-compose.prod.yml up -d --build backend &&
     cd frontend && npm run build
   '
   ```

4. ✅ **프로덕션 검증**
   - https://marketingzon.com 접속
   - 나만의 대시보드에서 위젯 추가 테스트

---

## 📊 데이터 검증 체크리스트

### SQL 쿼리 검증 (필수)
- [ ] 전환율이 0-100% 범위인가?
- [ ] visitor_id가 NULL인 구매는 제외했는가?
- [ ] payment_status가 'cancelled', 'refunded'인 주문 제외했는가?
- [ ] 날짜 범위가 정확한가? (start 00:00:00, end 23:59:59)
- [ ] 최소 방문자 수 필터 적용했는가? (통계적 유의성)

### API 응답 검증
- [ ] 전환율 = (구매자 수 / 방문자 수) × 100
- [ ] 구매자AOV = 총 매출 / 구매자 수 (주문 수 아님!)
- [ ] 매출 점유율 합계가 100%에 근접한가?
- [ ] 채널명이 일관적인가? (대소문자, 띄어쓰기)

---

## 🎯 핵심 개선 포인트

### Before (방문자 분석)
- ❌ 쓸모없는 지표: 실시간 방문자, 시간대별 분포
- ❌ "얼마나 왔는가" 중심
- ❌ 액션 불가능한 데이터

### After (채널 성과 분석)
- ✅ **전환율**: 어떤 채널이 잘 팔리는가
- ✅ **매출 기여도**: 어떤 채널이 돈을 버는가
- ✅ **구매자 AOV**: 고객 가치 측정
- ✅ **랜딩 페이지 전환율**: 어떤 페이지가 효과적인가
- ✅ 마케터가 바로 의사결정 가능

---

## 💡 개발 팁

### 1. 기존 코드 참고
- `/api/stats/range` - 기간별 통계 구조
- `/api/stats/utm-performance` - UTM 어트리뷰션
- `/api/stats/orders` - 주문 통계

### 2. 공통 유틸리티 함수
```javascript
// 채널 분류 함수 (재사용)
const classifyChannel = (referrer) => {
  if (!referrer) return '직접 유입';
  if (referrer.includes('google')) return 'Google';
  if (referrer.includes('naver')) return 'Naver';
  if (referrer.includes('facebook') || referrer.includes('fb.')) return 'Facebook';
  if (referrer.includes('instagram')) return 'Instagram';
  if (referrer.includes('kakao')) return 'KakaoTalk';
  return '기타';
};
```

### 3. 에러 처리
```javascript
// 빈 데이터 처리
if (result.rows.length === 0) {
  return res.json({ 
    channels: [],
    message: 'No data available for the selected period' 
  });
}
```

### 4. 데이터 정렬
- 전환율: DESC (높은 순)
- 매출: DESC (높은 순)
- 날짜: ASC (오래된 순)

---

## 📝 다음 세션 시작 시

### 1. 이 문서 확인
```bash
cat CHANNEL_PERFORMANCE_PLAN.md
```

### 2. 현재 상태 확인
```bash
# 방문자 분석이 제거되었는지 확인
curl http://localhost:3003/api/stats/visitors/range
# → "Cannot GET" 에러가 정상

# 기존 기능 정상 작동 확인
curl "http://localhost:3003/api/stats/range?start=2025-12-01&end=2025-12-09"
# → 데이터 반환 확인
```

### 3. 개발 시작
```bash
# 1. 백엔드 개발
cd backend
touch src/routes/stats/channel.js

# 2. 프론트엔드 위젯 추가
# frontend/src/pages/MyDashboard.jsx 수정
```

---

## 🔗 참고 문서
- `PROJECT_STATUS.md` - 전체 프로젝트 현황
- `CLAUDE.md` - 프로젝트 가이드
- `backend/src/routes/stats/utm.js` - UTM 성과 분석 참고
- `backend/src/routes/stats/range.js` - 기간별 통계 참고

---

**작성자**: Claude (AI Assistant)  
**버전**: v1.0  
**다음 업데이트**: Phase 1 완료 후
