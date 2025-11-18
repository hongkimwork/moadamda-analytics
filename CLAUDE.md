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
- **현재 트래커 버전**: tracker-v044.js

## 시스템 아키텍처

### 3계층 아키텍처

1. **트래커 (클라이언트 사이드 JavaScript)**
   - 소스: `tracker/src/tracker.js`
   - 빌드: `tracker/build/tracker-v044.js` (배포 버전)
   - Cafe24 쇼핑몰에 배포되는 순수 JavaScript 추적 스크립트
   - 페이지뷰, 세션, 전자상거래 이벤트(view_product, add_to_cart, checkout, purchase) 추적
   - POST 요청을 통해 백엔드 API로 데이터 전송

2. **백엔드 (Node.js API)**
   - 위치: `backend/src/`
   - 기술 스택: Node.js, Express, PostgreSQL
   - 주요 라우트:
     - `/api/track` - 데이터 수집 엔드포인트 (track.js)
     - `/api/stats/*` - 분석 데이터 엔드포인트 (stats.js)
     - `/api/tables/*` - 원본 데이터 테이블 뷰 (tables.js)
     - `/api/mappings/*` - URL/상품 매핑 관리 (mappings.js)
     - `/api/creative-performance/*` - 광고 소재 분석 (creative-performance.js)

3. **프론트엔드 (React 대시보드)**
   - 위치: `frontend/src/`
   - 기술 스택: React, Vite, Ant Design, Recharts, TailwindCSS
   - 주요 페이지:
     - `App.jsx` - 메트릭, UTM 성과, 주문 분석이 포함된 메인 대시보드
     - `DataTables.jsx` - 원본 데이터 테이블 뷰
     - `CreativePerformance.jsx` - 광고 소재 모집단 분석
     - `OrderAnalysis.jsx` - 개별 주문 여정 분석
     - `PageMapping.jsx` - URL과 상품명 매핑 관리

### 데이터베이스 스키마 (PostgreSQL)

`backend/migrations/init.sql`의 핵심 테이블:
- `visitors` - 디바이스 정보, UTM 파라미터가 포함된 고유 방문자
- `sessions` - 지속시간, 이탈율, 전환 플래그가 있는 사용자 세션
- `pageviews` - 타임스탬프가 있는 개별 페이지 뷰
- `events` - 전자상거래 이벤트 (view_product, add_to_cart 등)
- `conversions` - 주문 상세 정보가 있는 구매 트랜잭션
- `utm_sessions` - 멀티터치 어트리뷰션을 위한 UTM 추적 이력
- `realtime_visitors` - 현재 활동 중인 방문자

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

현재 단계 컨텍스트 (v047 기준):
- Phase 1-3: 핵심 추적, 전자상거래 이벤트, 대시보드 UI ✅ 완료
- Phase 4: UTM 추적 기반 마케팅 분석 ✅ Phase 4.1-4.3 완료
  - conversions 테이블에 UTM 추적
  - UTM 성과 API (`/api/stats/utm-performance`)
  - 캠페인 성과 테이블이 있는 대시보드 UTM 섹션
- Phase 4.4+: 고급 어트리뷰션 모델 (계획)
- Phase 5+: 고급 분석 (코호트, 퍼널, A/B 테스팅) (계획)

**최근 주요 기능 (전체 로그는 PROJECT_STATUS.md 참조)**:
- 복합 URL 조건 페이지 매핑
- 수동 URL 등록
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

## 알려진 이슈

### 외부 결제 추적 미지원

**문제**: 외부 결제 게이트웨이(카카오페이, 네이버페이)를 통한 주문이 conversions 테이블에 추적되지 않음.

**원인**: 외부 결제 페이지에서 구매 이벤트 추적 스크립트가 실행되지 않음.

**영향**: 외부 결제 수단을 사용한 주문의 광고 효과 측정 불가. 일반 결제 구매만 추적됨.

**상태**: 현재 일반 결제만 추적 중. 알려진 제한사항임.

**해결 방법**: 없음. 일반 결제 전환율에 분석을 집중하세요.

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
