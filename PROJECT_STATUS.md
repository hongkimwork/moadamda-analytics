# 🎯 Moadamda Analytics - 프로젝트 현황

**마지막 업데이트**: 2025-11-13

---

## 📍 현재 상태

- **시스템 버전**: v047 (페이지매핑 복합 조건 기능 구현 완료)
- **Tracker 버전**: tracker-v042.js
- **배포 환경**: Supabase (DB) + Vercel (배포) 전환 예정 ⚠️
- **개발 환경**: macOS + Docker
- **상태**: 네이버 클라우드 해지, 기존 데이터 없음 (새로 시작)

---

## 📝 최근 작업 로그 (최신 15개)

| 날짜 | 작업 내용 | 수정 파일 |
|------|---------|----------|
| 2025-11-13 | DB 구조 문서 생성 | database-structure.md |
| 2025-11-13 | 복합 URL Badge+Popover 표시 | PageMapping.jsx |
| 2025-11-13 | 액션 컬럼 드롭다운 간소화 | PageMapping.jsx |
| 2025-11-13 | URL 카드 배경 회색/내부 흰색 | PageMapping.jsx |
| 2025-11-13 | URL 모달 색상 통일 (회색 팔레트) | PageMapping.jsx |
| 2025-11-13 | URL 모달 UI/UX 개선 (툴팁/계층) | PageMapping.jsx |
| 2025-11-13 | 필터 드롭다운 이모지 제거 | PageMapping.jsx |
| 2025-11-13 | 필터링 버그 수정 (서버 사이드) | mappings.js, PageMapping.jsx |
| 2025-11-13 | 페이지매핑 복합 조건 구현 | PageMapping.jsx, mappings.js |
| 2025-11-13 | 페이지매핑 수동등록 배포 | 서버 배포 완료 |
| 2025-11-13 | URL 수동 추가 기능 구현 | PageMapping.jsx, mappings.js |
| 2025-11-13 | 등록유형 컬럼 추가 | PageMapping.jsx, add_source_type.sql |
| 2025-11-13 | 매핑상태 필터 드롭다운 추가 | PageMapping.jsx |
| 2025-11-13 | URL→베이스URL 컬럼명 변경 | PageMapping.jsx |
| 2025-11-13 | 매핑 상태 배지 추가 | PageMapping.jsx |
| 2025-11-13 | nodemon 자동재시작 적용 | package.json |
| 2025-11-13 | 쿼리 파라미터 제거 설정 | urlCleaner.js |
| 2025-11-13 | 유입URL 보기 기능 추가 | PageMapping.jsx |
| 2025-11-13 | 제품 배지 시스템 구현 | OrderAnalysis.jsx |
| 2025-11-13 | 구매완료 색상 조건 제거 | OrderAnalysis.jsx |
| 2025-11-13 | 상세페이지 카드 구조 개편 | OrderAnalysis.jsx |
| 2025-11-13 | 상품명 색상 조건 제거 | OrderAnalysis.jsx |
| 2025-11-13 | 방문→유형 라벨 변경 | OrderAnalysis.jsx |
| 2025-11-12 | 1초 미만 체류 배지 추가 | OrderAnalysis.jsx |
| 2025-11-10 | 연속 중복 페이지 제거 로직 구현 | OrderAnalysis.jsx |
| 2025-11-10 | Cursor Rules 6개로 정리 (토큰 50% 절약) | .cursor/rules/ |
| 2025-11-10 | 로컬-서버 DB 직접 연결 구축 | server.js, vite.config.js |
| 2025-11-07 | 광고 소재 컬럼명 직관화 | CreativePerformance.jsx |
| 2025-11-06 | 체류시간 10분 상한 설정 | stats.js, OrderAnalysis.jsx |
| 2025-11-06 | 페이지 경로 분리 (구매당일/과거) | stats.js, OrderAnalysis.jsx |
| 2025-11-06 | 고객 여정 상단 UI/UX 개선 | OrderAnalysis.jsx |
| 2025-11-06 | 페이지 매핑 검색 기능 개선 | mappings.js, PageMapping.jsx |
| 2025-11-05 | Direct 방문 고객 안내 추가 | OrderAnalysis.jsx |
| 2025-11-05 | UTM 데이터 일관성 확보 | stats.js |
| 2025-11-05 | 고객 여정 모달 UTM 히스토리 개선 | stats.js, OrderAnalysis.jsx |
| 2025-11-05 | Cafe24 API 연동 제거 | cafe24.js 등 3개 파일 삭제 |
| 2025-10-31 | tracker-v042.js 배포 | tracker-v042.js |
| 2025-10-28 | HTTPS SSL 인증서 발급 완료 | nginx, certbot |

---

## ⚠️ 알려진 이슈

### 1. 외부 결제 추적 불가 ❌
- **문제**: 카카오페이, 네이버페이 주문이 conversions 테이블에 기록 안 됨
- **원인**: 외부 결제 페이지에서 purchase 이벤트 미발생
- **영향**: 외부 결제 주문의 광고 효과 측정 불가
- **상태**: 일반 결제만 추적 중

### 2. Cafe24 API 연동 제거됨 (2025-11-05)
- **이유**: visitor_id 추출 불가능하여 실질적 효용 없음
- **영향**: 없음 (기존에도 데이터 수집 못 했음)

---

## 🛠️ 개발 환경 (macOS)

### 1️⃣ 최초 설정 (한 번만)

#### Supabase 프로젝트 생성
1. https://supabase.com 접속 및 회원가입
2. 새 프로젝트 생성 (무료 플랜 가능)
3. Settings > Database에서 연결 정보 확인
4. SQL Editor에서 마이그레이션 파일 순서대로 실행:
   - `backend/migrations/init.sql`
   - `backend/migrations/create_url_mappings.sql`
   - `backend/migrations/add_excluded_flag.sql`
   - `backend/migrations/add_source_type.sql`
   - `backend/migrations/add_url_conditions.sql`
   - `backend/migrations/add_utm_sessions.sql`
   - `backend/migrations/add_payment_details.sql`
   - `backend/migrations/add_ip_tracking.sql`
   - `backend/migrations/create_ad_spend_simple.sql`
   - `backend/migrations/add_order_status.sql`
   - `backend/migrations/add_cafe24_token.sql`
   - `backend/migrations/add_dynamic_utm_params.sql`

#### 환경 파일 생성
`backend/.env.local` 파일 생성 (Supabase 연결 정보):
```bash
DB_HOST=db.xxxxxxxxxxxxx.supabase.co
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=[Supabase에서 받은 비밀번호]
DB_NAME=postgres
```

### 2️⃣ 로컬 개발 실행

#### 방법 A: Docker 사용 (추천)
```bash
# 1. Docker로 전체 실행
docker-compose up -d

# 접속: http://localhost:3030
```

#### 방법 B: 직접 실행
```bash
# 터미널 1: 백엔드
cd backend
npm install
node src/server.js

# 터미널 2: 프론트엔드
cd frontend
npm install
npm run dev

# 접속: http://localhost:3030
```

### 3️⃣ Vercel 배포

#### 최초 배포 설정
```bash
# 1. Vercel CLI 설치
npm install -g vercel

# 2. 로그인
vercel login

# 3. 프로젝트 연결
vercel link

# 4. 환경변수 설정 (Vercel Dashboard)
# - DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
# - Supabase 연결 정보 입력

# 5. 배포
vercel --prod
```

#### 이후 배포
```bash
# 1. 로컬 커밋 & Push
git add .
git commit -m "메시지"
git push origin main

# 2. Vercel 자동 배포 (GitHub 연동 시)
# 또는 수동 배포:
vercel --prod
```

---

## 🔄 핵심 시스템 정보

### 정상 작동 기능
- ✅ tracker-v042.js (일반 결제 추적)
- ✅ UTM 기반 광고 효과 측정
- ✅ 고객 여정 분석 (구매당일/과거 분리)
- ✅ 체류시간 자동 필터링 (10분 상한)

### 데이터 흐름
```
고객 방문 (UTM 포함) → tracker-v042.js → pageview 기록
→ 상품 구매 (일반 결제만) → purchase 이벤트
→ conversions 테이블 저장 → 대시보드 조회
```

### 주요 파일
- Tracker: `tracker/build/tracker-v042.js`
- Backend: `backend/src/server.js`, `backend/src/routes/stats.js`
- Frontend: `frontend/src/pages/OrderAnalysis.jsx`
- DB: Supabase PostgreSQL (연결 정보는 .env.local 참조)

---

## 📚 참고 문서

- [START_GUIDE.md](./START_GUIDE.md) - 빠른 시작 가이드
- [deployment/DEPLOY_GUIDE.md](./deployment/DEPLOY_GUIDE.md) - 배포 가이드
- [Git 저장소](https://github.com/hongkimwork/moadamda-analytics)

---

**💡 Note**: 이 문서는 최근 작업 로그를 중심으로 간결하게 관리됩니다.
