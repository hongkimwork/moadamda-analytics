# CLAUDE.md

이 파일은 Claude Code (claude.ai/code)가 이 저장소에서 작업할 때 참고하는 가이드입니다.

## 프로젝트 개요

**Moadamda Analytics**는 GA4를 대체하기 위해 자체 개발한 전자상거래 특화 분석 플랫폼입니다. 방문자 행동, 전자상거래 이벤트를 추적하고, 온라인 쇼핑몰을 위한 고급 마케팅 어트리뷰션 분석을 제공합니다.

- **프로덕션 서버**: 49.50.139.223 (네이버 클라우드)
- **프로덕션 URL**:
  - 프론트엔드 대시보드: https://marketingzon.com
  - 백엔드 API: https://moadamda-analytics.co.kr
- **로컬 개발**:
  - 백엔드 API: http://localhost:3003
  - 프론트엔드 대시보드: http://localhost:3030
- **현재 트래커 버전**: tracker-v048.js
- **시스템 버전**: v051

## 시스템 아키텍처

### 3계층 아키텍처

1. **트래커 (클라이언트 사이드 JavaScript)**
   - 소스: `tracker/src/tracker.js`
   - 빌드: `tracker/build/tracker-v048.js` (배포 버전)
   - Cafe24 쇼핑몰에 배포되는 순수 JavaScript 추적 스크립트
   - 페이지뷰, 세션, 전자상거래 이벤트(view_product, add_to_cart, checkout, purchase) 추적
   - POST 요청을 통해 백엔드 API로 데이터 전송
   - v048 신규 기능: 인앱 브라우저 감지, sendBeacon fallback, 실패 이벤트 재시도

2. **백엔드 (Node.js API)**
   - 위치: `backend/src/`
   - 기술 스택: Node.js, Express, PostgreSQL, node-cron
   - 주요 라우트:
     - `/api/track` - 데이터 수집 엔드포인트 (track.js)
     - `/api/stats/*` - 분석 데이터 엔드포인트 (stats.js)
     - `/api/tables/*` - 원본 데이터 테이블 뷰 (tables.js)
     - `/api/mappings/*` - URL/상품 매핑 관리 (mappings.js)
     - `/api/creative-performance/*` - 광고 소재 분석 (creative-performance.js)
     - `/api/cafe24/*` - Cafe24 주문 API 연동 (cafe24.js)
   - 백그라운드 스크립트:
     - `scripts/adScheduler.js` - 매일 오전 6시 광고 데이터 자동 동기화
     - `scripts/syncMetaAds.js` - Meta(Facebook/Instagram) 광고 데이터 수집
     - `scripts/syncNaverAdInfo.js` - 네이버 검색광고 정보 수집
     - `scripts/syncNaverAdStats.js` - 네이버 검색광고 성과 수집

3. **프론트엔드 (React 대시보드)**
   - 위치: `frontend/src/`
   - 기술 스택: React, Vite, Ant Design, Recharts, TailwindCSS, React Grid Layout, Radix UI
   - 주요 페이지:
     - `App.jsx` - 메인 애플리케이션 및 라우팅
     - `MyDashboard.jsx` - **신규** 드래그 가능한 위젯 기반 커스텀 대시보드
     - `OrderAnalysis/` - 주문 분석 페이지 (리스트/상세)
       - `OrderListPage.jsx` - 주문 목록 및 필터링
       - `OrderDetailPage.jsx` - 개별 주문 여정 분석
     - `CreativePerformance.jsx` - 광고 소재 모수 분석
     - `DataTables.jsx` - 원본 데이터 테이블 뷰
     - `PageMapping.jsx` - URL과 상품명 매핑 관리

### 데이터베이스 스키마 (PostgreSQL)

`backend/migrations/init.sql`의 핵심 테이블:

**분석 데이터 (Tracker 수집)**:
- `visitors` - 디바이스 정보, UTM 파라미터가 포함된 고유 방문자
- `sessions` - 지속시간, 이탈율, 전환 플래그가 있는 사용자 세션
- `pageviews` - 타임스탬프가 있는 개별 페이지 뷰
- `events` - 전자상거래 이벤트 (view_product, add_to_cart 등)
- `conversions` - 주문 상세 정보가 있는 구매 트랜잭션 (Tracker + Cafe24 API)
- `utm_sessions` - 멀티터치 어트리뷰션을 위한 UTM 추적 이력
- `realtime_visitors` - 현재 활동 중인 방문자

**광고 데이터 (API 연동)**:
- **Meta 광고** (`create_meta_ad_tables.sql`):
  - `meta_campaigns` - Meta 캠페인 정보
  - `meta_adsets` - 광고세트 정보
  - `meta_ads` - 개별 광고 정보
  - `meta_ad_stats` - 일별 광고 성과 데이터
- **네이버 검색광고** (`create_naver_ad_tables.sql`):
  - `naver_campaigns` - 네이버 캠페인 정보
  - `naver_adgroups` - 광고그룹 정보
  - `naver_keywords` - 키워드 정보
  - `naver_ad_stats` - 일별 광고 성과 데이터

**기타**:
- `url_mappings` - URL과 상품명 매핑 테이블
- `cafe24_token` - Cafe24 API 토큰 저장소

## 개발 명령어

### 로컬 개발 환경 설정

**중요**: 로컬 개발 환경은 서버(49.50.139.223)의 프로덕션 데이터베이스에 직접 연결됩니다.

#### 1. 초기 설정

프로덕션 데이터베이스 연결 정보가 담긴 `backend/.env` 파일 생성:

```env
DB_HOST=49.50.139.223
DB_PORT=5432
DB_USER=moadamda
DB_PASSWORD=MoaDamDa2025!Secure#Analytics
DB_NAME=analytics
NODE_ENV=development
PORT=3003
```

#### 2. 개발 서버 시작

```bash
# 터미널 1: 백엔드
cd backend
npm install
npm run dev

# 터미널 2: 프론트엔드
cd frontend
npm install
npm run dev
```

대시보드 접속: http://localhost:3030

#### 3. 실행 중인 서비스 확인

```bash
# 포트 사용 확인
lsof -i :3030 -i :3003

# 서버 중지: Ctrl+C 또는 프로세스 종료
kill -9 <PID>
```

### 데이터베이스 작업

SSH를 통해 프로덕션 PostgreSQL에 연결:

```bash
# 데이터베이스 연결
ssh root@49.50.139.223 'docker exec -i ma-postgres psql -U moadamda -d analytics'

# 일반적인 쿼리
ssh root@49.50.139.223 'docker exec -i ma-postgres psql -U moadamda -d analytics -c "
  SELECT COUNT(*) FROM visitors;
"'

ssh root@49.50.139.223 'docker exec -i ma-postgres psql -U moadamda -d analytics -c "
  SELECT COUNT(*) FROM pageviews WHERE timestamp >= CURRENT_DATE;
"'

ssh root@49.50.139.223 'docker exec -i ma-postgres psql -U moadamda -d analytics -c "
  SELECT * FROM conversions ORDER BY timestamp DESC LIMIT 10;
"'
```

### 프론트엔드 빌드

```bash
cd frontend

# 프로덕션 빌드 (배포 전 필수)
npm run build

# 프로덕션 빌드 로컬 미리보기
npm run preview
```

## Git 기반 배포 워크플로우

**중요**: 이 프로젝트는 Git 기반 배포를 사용합니다. 항상 로컬에서 커밋하고 GitHub에 푸시한 다음, 서버에서 pull합니다.

### 표준 배포 (모든 변경사항)

**배포 프로세스는 변경된 내용과 관계없이 항상 백엔드와 프론트엔드를 완전히 재빌드합니다**. 이를 통해 일관성을 보장하고 배포 문제를 방지합니다.

```bash
# 1. 로컬: GitHub에 커밋 및 푸시
git add .
git commit -m "변경사항 설명"
git push origin main  # 또는 feature 브랜치

# 2. 서버: 단일 SSH 명령으로 배포 (1-2분 소요)
ssh root@49.50.139.223 '
  cd /root/moadamda-analytics &&
  git checkout main &&
  git pull origin main &&
  docker-compose -f docker-compose.prod.yml up -d --build backend &&
  cd frontend && npm run build
'
```

**특정 브랜치 배포:**

```bash
ssh root@49.50.139.223 '
  cd /root/moadamda-analytics &&
  git checkout feature/my-branch &&
  git pull origin feature/my-branch &&
  docker-compose -f docker-compose.prod.yml up -d --build backend &&
  cd frontend && npm run build
'
```

**배포 후 검증:**

```bash
# 로그 확인
ssh root@49.50.139.223 'cd /root/moadamda-analytics && docker-compose -f docker-compose.prod.yml logs backend --tail 50'

# API 상태 테스트
curl https://moadamda-analytics.co.kr/health

# 브라우저: 강력 새로고침 (Ctrl+Shift+R 또는 Cmd+Shift+R)
# 프론트엔드는 dist/의 정적 파일을 제공하므로 브라우저 캐시를 지워야 함
```

**서버에서 파일을 직접 수정하지 마세요** - 항상 Git 워크플로우를 사용하세요.

## 핵심 개발 규칙

### 1. 데이터 검증 (필수)

**배포 전 항상 프로덕션 데이터베이스로 데이터를 검증하세요**. 자세한 내용은 `.cursor/rules/data-validation.mdc`를 참조하세요.

- 검증 없이 쿼리 결과를 신뢰하지 마세요
- 실제 프로덕션 데이터로 모든 SQL 쿼리를 테스트하세요
- 도메인별 합리성 검사 적용:
  - 체류시간: 0-600초 (최대 10분)
  - 세션 지속시간: 1-30분
  - 구매 금액: 10,000-500,000원

**다음 상황에서 개발을 일시정지하고 사용자 검증을 요청하세요**:
- 새로운 SQL 쿼리 작성 시
- 예상치 못한 값 발견 시 (예: 22일 체류시간)
- 익숙하지 않은 테이블 작업 시

### 2. 디자인 가이드라인

**이모지 사용 금지** - 대신 Ant Design 아이콘 사용:
```jsx
// 좋음
<Button icon={<ReloadOutlined />}>새로고침</Button>

// 나쁨
<Button>🔄 새로고침</Button>
```

컬러 팔레트:
- Primary: `#1890ff` (파란색)
- Success: `#52c41a` (초록색)
- Warning: `#fa8c16` (주황색)
- Error: `#f5222d` (빨간색)
- 금액 > 0: 굵게, 파란색/초록색
- 금액 = 0: 회색 (#999)

### 3. 프로젝트 상태 추적

**매 세션 시작 시 PROJECT_STATUS.md를 먼저 읽어** 현재 단계와 진행 상황을 파악하세요.

현재 단계 컨텍스트 (v051 기준):
- Phase 1-3: 핵심 추적, 전자상거래 이벤트, 대시보드 UI ✅ 완료
- Phase 4: UTM 추적 기반 마케팅 분석 ✅ Phase 4.1-4.3 완료
  - conversions 테이블에 UTM 추적
  - UTM 성과 API (`/api/stats/utm-performance`)
  - 캠페인 성과 테이블이 있는 대시보드 UTM 섹션
- **Phase 5: 광고 API 연동** ✅ 완료
  - Meta (Facebook/Instagram) 광고 API 연동
  - 네이버 검색광고 API 연동
  - 자동 스케줄러 (매일 오전 6시 동기화)
- **Phase 6: 커스텀 대시보드** ✅ 완료
  - 드래그 가능한 위젯 기반 대시보드 (react-grid-layout)
  - 사용자 정의 레이아웃 및 위젯 설정

**최근 주요 기능 (최신순, 전체 로그는 PROJECT_STATUS.md 참조)**:
- 드래그 가능한 나만의 대시보드 (MyDashboard)
- Meta/네이버 광고 API 연동 및 자동 동기화
- 구매카드 결제정보 단순화
- 주문분석 UI 개선 (타임라인 통합, 결제금액 컬럼)
- 타임존 버그 수정 (UTC ↔ KST)
- 취소/반품 주문 필터
- 복합 URL 조건 페이지 매핑
- 제품 배지가 있는 주문 여정 분석
- 광고 소재 성과 분석

## 주요 기술 패턴

### 백엔드 API 응답 형식

```javascript
// 표준 성공 응답
res.json({ data: [...], summary: {...} });

// 오류 응답
res.status(500).json({ error: '오류 메시지' });
```

### 프론트엔드 데이터 가져오기

```javascript
// 개발 환경에서는 localhost:3003, 프로덕션에서는 /api 사용
const API_BASE = import.meta.env.DEV
  ? 'http://localhost:3003'
  : '';

const response = await axios.get(`${API_BASE}/api/stats/today`);
```

### SQL 쿼리 모범 사례

```sql
-- 단계별 검증을 위해 WITH 절 사용
WITH step1 AS (
  SELECT ... -- 첫 번째 변환
),
step2 AS (
  SELECT ... FROM step1 -- 두 번째 변환
)
SELECT * FROM step2;

-- 항상 합리성 필터 추가
WHERE time_spent_seconds > 0
  AND time_spent_seconds <= 600  -- 10분 제한
```

## 일반적인 문제와 해결책

### 배포 후 프론트엔드 변경사항이 반영되지 않음

**원인**: 프론트엔드는 `dist/`의 사전 빌드된 정적 파일을 제공하며, 브라우저 캐시 문제

**해결책**:
1. 서버에서 `npm run build`가 성공적으로 완료되었는지 확인
2. `frontend/dist/` 디렉토리가 존재하고 새 파일이 있는지 확인
3. 브라우저 강력 새로고침: Ctrl+Shift+R (Chrome/Firefox) 또는 Cmd+Shift+R (Mac)
4. 필요시 브라우저 캐시 지우기

### 로컬 개발 시 데이터베이스 연결 안 됨

**원인**: `backend/.env` 설정이 없거나 잘못됨

**해결책**:
1. `backend/.env`가 올바른 자격 증명으로 존재하는지 확인:
   ```env
   DB_HOST=49.50.139.223
   DB_PORT=5432
   DB_USER=moadamda
   DB_PASSWORD=MoaDamDa2025!Secure#Analytics
   DB_NAME=analytics
   ```
2. 프로덕션 서버로의 네트워크 연결 확인
3. 백엔드 재시작: Ctrl+C 후 `npm run dev` 다시 실행

### 배포 시 변경사항이 적용되지 않음

**원인**: 코드 변경사항이 커밋/푸시되지 않았거나 빌드 프로세스 실패

**해결책**:
1. 변경사항이 GitHub에 커밋 및 푸시되었는지 확인
2. 서버가 최신 코드를 가져왔는지 확인: 서버에서 `git log -1`
3. 항상 전체 재빌드 명령 사용 (배포 섹션 참조)
4. 빌드 오류 로그 확인

### UTM 어트리뷰션 혼동

시스템은 First-Touch (visitors.utm_*)와 Multi-Touch (utm_sessions 테이블) 어트리뷰션을 모두 추적합니다:
- **First-Touch**: 방문자가 처음 도착할 때의 UTM
- **Last-Touch**: 구매 전 가장 최근 UTM 세션
- **Multi-Touch**: utm_sessions 테이블의 전체 이력

항상 어떤 어트리뷰션 모델을 사용하는지 명시하세요.

### 타임존 처리 (중요)

**데이터베이스 타임존**: 모든 timestamp 데이터는 **KST (Asia/Seoul)**로 저장됩니다.

**주의사항**:
- Tracker는 브라우저의 로컬 시간을 KST로 변환하여 전송
- Cafe24 API는 UTC로 응답하므로 KST로 변환 필요
- Docker 백엔드 컨테이너는 `TZ=Asia/Seoul` 환경 변수 설정됨
- SQL 쿼리 시 날짜 비교는 항상 KST 기준

**예시**:
```javascript
// JavaScript에서 KST 변환
const kstDate = new Date(utcDate.getTime() + (9 * 60 * 60 * 1000));

// SQL에서 날짜 필터링 (이미 KST로 저장되어 있음)
WHERE DATE(timestamp) = '2025-12-08'  -- KST 기준
```

**최근 버그 수정**:
- 고객여정 분석 시 pageview timestamp(KST) vs order timestamp(UTC) 비교 오류 수정
- Cafe24 주문 데이터 UTC → KST 변환 추가
- 로컬/서버 환경 간 타임존 불일치 해결

## Cafe24 API 연동

### 주문 데이터 수집 아키텍처

주문 데이터는 두 가지 소스에서 수집됩니다:

1. **Tracker (tracker-v048.js)**: 자사몰에서 실행되어 visitor_id와 함께 구매 이벤트 수집
2. **Cafe24 API Sync**: Tracker가 놓친 주문을 보충 (1시간마다 토큰 자동 갱신)

```
주문 수집 흐름:
┌─────────────────┐     ┌─────────────────┐
│   Tracker       │ OR  │  Cafe24 API     │
│ (visitor_id ✅) │     │  (visitor_id ❌) │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     ▼
              conversions 테이블
```

### API 엔드포인트

- `GET /api/cafe24/orders?start_date=&end_date=` - 주문 목록 조회
- `GET /api/cafe24/token-info` - 토큰 상태 확인
- `POST /api/cafe24/sync` - 수동 주문 동기화

### 고객 여정 분석 제한

**Cafe24 API Sync로 가져온 주문**: visitor_id가 없어서 고객 여정 분석 불가
- `synced_at` 컬럼이 있으면 Cafe24 API Sync로 가져온 주문
- 상품명, 결제 정보는 Cafe24 API에서 조회 가능

**Tracker로 수집된 주문**: 전체 고객 여정 분석 가능
- visitor_id로 pageviews, events 테이블 조회

### 환경 변수 (backend/.env)

```env
# Database
DB_HOST=49.50.139.223
DB_PORT=5432
DB_USER=moadamda
DB_PASSWORD=MoaDamDa2025!Secure#Analytics
DB_NAME=analytics
NODE_ENV=development
PORT=3003

# Cafe24 API
CAFE24_AUTH_KEY=ZVl6QTBSUUdlMFJiR2dPQ3l3WEh0STpnejh4ZklpMEE2UkdQZUhSa0c0UHFE
CAFE24_MALL_ID=moadamda
CAFE24_API_VERSION=2025-09-01

# Meta (Facebook/Instagram) Ads API
META_ACCESS_TOKEN=<장기 토큰>
META_AD_ACCOUNT_ID=act_xxxxxxxx

# Naver Search Ads API
NAVER_API_KEY=<API 키>
NAVER_SECRET_KEY=<Secret 키>
NAVER_CUSTOMER_ID=<광고주 ID>
```

## 알려진 이슈

### Tracker 구매 이벤트 누락

**문제**: 일부 주문에서 Tracker의 trackPurchase()가 실행되지 않아 visitor_id가 없음

**가능한 원인**:
- 결제 완료 페이지 로드 전 사용자가 창 닫음
- EC_FRONT_EXTERNAL_SCRIPT_VARIABLE_DATA 객체 로드 지연 (30초 타임아웃)
- JavaScript 에러로 스크립트 실행 실패
- 광고 차단기 등 브라우저 확장 프로그램

**해결 방법**: Cafe24 API Sync로 누락된 주문 보충 (현재 구현됨)

## Meta/네이버 광고 API 연동

### 개요

광고 성과 데이터는 매일 자동으로 수집되어 데이터베이스에 저장됩니다. 이를 통해 광고비 대비 매출(ROAS), 전환율 등의 마케팅 지표를 분석할 수 있습니다.

### 자동 동기화 스케줄

`backend/src/scripts/adScheduler.js`가 백엔드 시작 시 자동으로 실행됩니다:

- **매일 오전 6시**: 네이버 + Meta 광고 데이터 동기화
- **매주 월요일 오전 5시**: Meta 토큰 갱신 확인

### 수동 동기화

개발 중 또는 테스트 시 수동으로 광고 데이터를 동기화할 수 있습니다:

```bash
# 네이버 검색광고 정보 + 성과 동기화
node backend/src/scripts/syncNaverAdInfo.js
node backend/src/scripts/syncNaverAdStats.js --days 30

# Meta 광고 동기화
node backend/src/scripts/syncMetaAds.js --days 30

# 또는 전체 한번에 실행
node backend/src/scripts/adScheduler.js --now
```

### Meta (Facebook/Instagram) Ads API

**필요한 설정**:
1. Meta Business Manager에서 앱 생성
2. 광고 계정 접근 권한 부여
3. 장기 액세스 토큰 발급 (60일 갱신)
4. `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID` 환경 변수 설정

**수집 데이터**:
- 캠페인, 광고세트, 광고 정보 (`meta_campaigns`, `meta_adsets`, `meta_ads`)
- 일별 성과: 노출수, 클릭수, 전환수, 광고비 (`meta_ad_stats`)

**토큰 갱신**:
```bash
# 토큰 갱신 (60일마다 필요)
node backend/src/scripts/exchangeMetaToken.js
```

### 네이버 검색광고 API

**필요한 설정**:
1. 네이버 광고 관리자에서 API 키 발급
2. `NAVER_API_KEY`, `NAVER_SECRET_KEY`, `NAVER_CUSTOMER_ID` 환경 변수 설정

**수집 데이터**:
- 캠페인, 광고그룹, 키워드 정보 (`naver_campaigns`, `naver_adgroups`, `naver_keywords`)
- 일별 성과: 노출수, 클릭수, 전환수, 광고비 (`naver_ad_stats`)

### 광고 성과 분석

광고 데이터는 conversions 테이블의 UTM 파라미터와 결합되어 분석됩니다:

```sql
-- 광고별 ROAS 계산 예시
SELECT
  utm_source,
  utm_medium,
  utm_campaign,
  SUM(total_amount) as revenue,
  -- 광고비는 meta_ad_stats 또는 naver_ad_stats에서 조회
  SUM(total_amount) / NULLIF(ad_spend, 0) as roas
FROM conversions
WHERE utm_source IN ('facebook', 'instagram', 'naver')
GROUP BY utm_source, utm_medium, utm_campaign;
```

## 프로젝트 문서

- `README.md` - 빠른 시작 가이드 및 단계별 로드맵
- `PROJECT_STATUS.md` - **매 세션마다 먼저 읽으세요** - 현재 개발 상태, 최근 작업 로그, 알려진 이슈
- `PHASE4_PLAN.md` - 마케팅 분석 (UTM) 기능 명세
- `.cursor/rules/` - 개발 규칙 및 가이드라인:
  - `dev.mdc` - 로컬 개발 환경 설정
  - `deploy.mdc` - 서버 배포 절차
  - `data-validation.mdc` - 데이터 품질 검증 규칙 (중요)
  - `tracker-versioning.mdc` - 트래커 버전 관리
  - `project-status-update.mdc` - 상태 추적 워크플로우

## GitHub 저장소

- URL: https://github.com/hongkimwork/moadamda-analytics
- 브랜치: main
- 접근: Private repository

---

**핵심 원칙**: "아무것도 신뢰하지 말고 모두 검증하라" - 배포 전 항상 프로덕션 데이터로 검증하세요.
