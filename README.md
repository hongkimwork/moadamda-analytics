# Moadamda Analytics System

GA4를 대체하는 Matomo 기반 쇼핑몰 특화 분석 플랫폼

## 시스템 요구사항

- Docker & Docker Compose
- Node.js 20+ (개발용)
- PostgreSQL 15
- 포트: 3003 (API), 3030 (Dashboard), 5432 (DB)

## 빠른 시작

### 1. Docker 컨테이너 실행

```bash
cd moadamda-analytics
docker-compose up -d
```

### 2. 컨테이너 상태 확인

```bash
docker-compose ps
```

모든 서비스가 `Up` 상태여야 합니다.

### 3. 데이터베이스 초기화 확인

```bash
docker-compose logs postgres
```

"database system is ready to accept connections" 메시지 확인

### 4. API 서버 테스트

```bash
curl http://localhost:3003/health
```

또는 브라우저에서: http://localhost:3003/health

예상 응답:
```json
{"status":"ok","timestamp":"2025-10-15T..."}
```

### 5. 추적 스크립트 카페24 업로드

1. `tracker/build/tracker.js` 파일을 카페24 FTP로 업로드
   - 경로: `/web/tracker.js`

2. 카페24 관리자 페이지에서 HTML 편집
   - **디자인 관리 > HTML 편집 > 공통 레이아웃 > `<head>` 영역**

3. 다음 코드 추가:

```html
<!-- Moadamda Analytics -->
<script src="/web/tracker.js" async></script>
```

### 6. 테스트

1. 모아담다 사이트 접속 (PC/모바일 모두)
2. 몇 개 페이지 클릭
3. API 서버 로그 확인:

```bash
docker-compose logs -f backend
```

4. 데이터 확인:

```bash
# 오늘의 통계
curl http://localhost:3003/api/stats/today

# 또는 외부 IP로
curl http://218.238.83.154:3003/api/stats/today
```

## Phase 1 완료 체크리스트

- [ ] Docker 컨테이너 3개 모두 실행 (postgres, backend, frontend)
- [ ] PostgreSQL 테이블 생성 확인
- [ ] API 서버 health check 통과
- [ ] tracker.js 카페24 업로드 완료
- [ ] 카페24 head 태그에 스크립트 삽입 완료
- [ ] 실제 사이트 접속 시 API로 데이터 수신
- [ ] PostgreSQL에 visitors, sessions, pageviews 데이터 저장 확인
- [ ] `/api/stats/today` 정상 응답 확인

## 데이터베이스 직접 확인

```bash
# PostgreSQL 컨테이너 접속
docker exec -it ma-postgres psql -U moadamda -d analytics

# 방문자 수 확인
SELECT COUNT(*) FROM visitors;

# 오늘의 페이지뷰
SELECT COUNT(*) FROM pageviews WHERE timestamp >= CURRENT_DATE;

# 실시간 접속자
SELECT * FROM realtime_visitors WHERE last_activity >= NOW() - INTERVAL '5 minutes';
```

## 문제 해결

### 컨테이너가 시작되지 않을 때

```bash
docker-compose down
docker-compose up -d --build
```

### 포트 충돌

다른 프로그램이 3003, 3030 포트를 사용 중일 수 있습니다:

```bash
# Windows
netstat -ano | findstr :3003
netstat -ano | findstr :3030
```

### 외부에서 접속 안 될 때

1. Windows 방화벽 인바운드 규칙 확인 (3003, 3030 포트)
2. 공유기 포트 포워딩 확인
3. Docker Desktop 설정 확인

## 개발 로드맵

### ✅ Phase 1: 기본 추적 시스템 (완료)
- [x] Visitor/Session 추적
- [x] Pageview 수집
- [x] Device Type 감지 (PC/Mobile/Tablet)
- [x] Referrer 분석
- [x] 실시간 방문자 추적
- [x] Docker 컨테이너화
- [x] PostgreSQL 데이터베이스 구축

### ✅ Phase 2: E-commerce 이벤트 추적 (완료)
- [x] Phase 2.1: 상품 조회 (view_product)
- [x] Phase 2.2: 장바구니 추가 (add_to_cart)
- [x] Phase 2.3: 결제 페이지 진입 (checkout)
- [x] Phase 2.4: 구매 완료 (purchase)
- [x] Phase 2.5: 전환율 및 ROAS 계산
- [x] Phase 2.6: 결제 상세 정보 (할인, 적립금, 배송비)

### ✅ Phase 3: 대시보드 UI (완료)
- [x] React + Ant Design 기반 대시보드
- [x] 일별/기간별 통계 조회
- [x] 실시간 활동 피드
- [x] 상품 성과 분석
- [x] 디바이스별 필터링
- [x] 신규/재방문 세그먼트 분석
- [x] 차트 및 시각화 (Recharts)

### ✅ Phase 4: 마케팅 분석 (UTM 기반) - **Phase 4.1-4.3 완료**

**목표:** GA4의 단점을 보완하는 유연한 광고 성과 추적

#### Phase 4.1: UTM 추적 강화 ✅
- [x] 구매 시 UTM 파라미터 저장 (conversions 테이블)
- [ ] 세션별 UTM 이력 관리 (중복 광고 노출 추적) - Phase 4.4
- [ ] 첫 번째/마지막 터치 UTM 구분 - Phase 4.4

**구현 내용:**
- `track.js`: `handleEcommerceEvent` 함수에서 구매 시 visitor의 UTM을 conversions에 저장
- `init.sql`: conversions 테이블의 utm_source, utm_campaign 컬럼 활용

#### Phase 4.2: UTM 성과 분석 API ✅
- [x] GET `/api/stats/utm-performance` - 캠페인별 성과
- [ ] GET `/api/stats/utm-attribution` - 어트리뷰션 모델 비교 - Phase 4.4

**응답 데이터:**
```json
{
  "campaigns": [
    {
      "utm_source": "instagram",
      "utm_medium": "ad",
      "utm_campaign": "summer_sale_1",
      "visitors": 150,
      "sessions": 180,
      "orders": 5,
      "revenue": 250000,
      "conversion_rate": 3.33,
      "aov": 50000,
      "roas": 5.0  // (광고비 입력 시)
    }
  ],
  "attribution_models": {
    "last_click": {...},
    "first_click": {...},
    "linear": {...}
  }
}
```

#### Phase 4.3: 대시보드 UTM 섹션 ✅
- [x] 광고 성과 테이블 (매체별/캠페인별)
- [x] 캠페인별 매출 비교 차트
- [ ] UTM 필터 기능 - 향후 추가
- [ ] 어트리뷰션 모델 선택 UI - Phase 4.4
- [ ] 광고비 입력 및 ROAS 계산 - Phase 4.5

**화면 구성:**
- "📢 광고 성과 (UTM)" 섹션
- 테이블: 매체/캠페인명, 방문자, 주문, 매출, 전환율, ROAS
- 차트: 캠페인별 매출 비교, 시간대별 UTM 유입

#### Phase 4.4: 고급 어트리뷰션
- [ ] 멀티터치 어트리뷰션 (한 사용자가 여러 광고 접촉)
- [ ] 시간 감쇠 모델 (Time Decay)
- [ ] 위치 기반 모델 (Position Based)
- [ ] 체류시간 가중치 모델 (Custom)

**시나리오 예시:**
```
사용자 A의 여정:
1. 인스타 광고1 클릭 → 3분 체류 → 이탈
2. 인스타 광고2 클릭 → 10초 체류 → 구매

어트리뷰션 결과:
- Last Click: 광고2 100%
- First Click: 광고1 100%
- Linear: 광고1 50%, 광고2 50%
- Time Decay: 광고1 30%, 광고2 70%
- Custom (체류시간): 광고1 96.7%, 광고2 3.3%
```

#### Phase 4.5: 광고비 관리
- [ ] 광고비 입력 테이블 (ad_spend)
- [ ] 일별/캠페인별 광고비 관리
- [ ] 자동 ROAS 계산
- [ ] 수익성 알림 (ROAS < 1.5 경고)

### 🎯 Phase 5: 고급 분석 (예정)
- [ ] Cohort 분석 (코호트별 LTV)
- [ ] Funnel 분석 (유입 → 상품조회 → 장바구니 → 구매)
- [ ] A/B 테스트 지원
- [ ] 사용자 행동 히트맵
- [ ] 이탈률 분석 및 예측

### 🔐 Phase 6: 보안 및 최적화 (예정)
- [ ] API 인증 (JWT)
- [ ] 데이터 암호화
- [ ] 성능 최적화 (인덱싱, 쿼리 최적화)
- [ ] 데이터 보관 정책 (GDPR 준수)
- [ ] 백업 및 복구 시스템

