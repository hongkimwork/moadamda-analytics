# 🎯 Moadamda Analytics - 프로젝트 현황

**마지막 업데이트**: 2025-11-11 10:15

---

## 📍 현재 단계

**Phase 5: 로컬 개발 환경 개선 완료 (v045)**

---

## ✅ 완료된 작업

### Phase 1: 기본 시스템 구축 (완료: 2025-10-25)
- [x] tracker.js 기본 구현 (pageview, purchase, cart, click 이벤트)
- [x] Node.js + Express 백엔드 API 구축
- [x] PostgreSQL 데이터베이스 설계 및 구축
- [x] React + Vite 대시보드 개발
- [x] Docker + Docker Compose 환경 구성
- [x] 로컬 개발 환경 구축 완료

### Phase 2: 네이버 클라우드 배포 (완료: 2025-10-28)
- [x] 네이버 클라우드 서버 프로비저닝 (VPC, Subnet, ACG 설정)
- [x] 공인 IP 할당 (211.188.53.220)
- [x] SSH 접속 설정 및 보안 키 관리
- [x] Docker 환경 서버 구축
- [x] 프로젝트 파일 서버 업로드
- [x] PostgreSQL 데이터베이스 마이그레이션
- [x] 도메인 구매 (marketingzon.com)
- [x] Naver Cloud Global DNS 설정
  - marketingzon.com → 211.188.53.220 (Backend)
  - dashboard.marketingzon.com → 211.188.53.220 (Frontend)
- [x] DNS 네임서버 변경 (ns1-1.ns-ncloud.com, ns1-2.ns-ncloud.com)
- [x] Let's Encrypt SSL 인증서 발급 (Certbot)
- [x] Nginx SSL 설정 (두 도메인 모두)
- [x] HTTPS 적용 완료

### Phase 3: tracker-v042.js 개발 (완료: 2025-10-31)
- [x] visitor_id 자동 주입 로직 구현
  - Cafe24 추가옵션(`add_option_name`, `add_option_input`)에 자동 삽입
  - 네이버페이, 카카오페이, 일반 주문 모두 지원
- [x] 주문서 폼 자동 감지 및 hidden input 생성
- [x] tracker-v042.js 파일 생성 및 배포
- [x] Cafe24 관리자에 tracker-v042.js 설치
- [x] VERSION.txt 업데이트

### Phase 4: 코어 시스템 안정화 (완료: 2025-11-05)
- [x] 1. Cafe24 API 연동 시도 (2025-11-04)
  - OAuth 인증 구현 완료
  - Access Token 발급 성공
  - 주문 동기화 스케줄러 구현
  - **결과**: visitor_id를 추출할 수 없어 실질적 효용 없음 확인
- [x] 2. Cafe24 API 연동 제거 (2025-11-05)
  - `backend/src/routes/cafe24.js` 삭제
  - `backend/src/utils/cafe24Client.js` 삭제  
  - `backend/src/scheduler/syncCafe24Orders.js` 삭제
  - `backend/src/server.js` 정리
  - 불필요한 API 호출 제거 (24회/일 → 0회)
  - 코드베이스 708줄 감소
- [x] 3. tracker-v042.js 검증
  - 일반 결제 주문 정상 추적 확인
  - UTM 파라미터 수집 정상 작동
  - conversions 테이블 데이터 저장 정상
  - 광고 소재 분석 페이지 정상 작동
- [x] 4. 시스템 문서화
  - PROJECT_STATUS.md 업데이트
  - Rules 파일 현행화 (order-status-sync-plan.mdc)
  - 알려진 제한사항 명확히 정리

### 고객 여정 모달 개선 (완료: 2025-11-05)
- [x] 1. UTM 히스토리 데이터 정확성 개선
  - utm_params JSONB에서 누락된 utm_source/medium/campaign 복구
  - utm_content (광고 소재 이름) 추출 및 표시
  - 같은 광고 소재의 중복 세션 병합 (5분 이내)
- [x] 2. 프론트엔드 UI 개선
  - 광고 소재 이름(utm_content) 표시 추가
  - 긴 소재명에 대한 Tooltip 지원
  - 오렌지 배경으로 소재 정보 강조
- [x] 3. 데이터 노이즈 제거
  - 1분 내 3개 접촉 → 12분 1개 접촉으로 병합
  - 마케터가 이해하기 쉬운 의미있는 접촉만 표시
  - Direct로 잘못 표시되던 Meta 광고 정확히 표시

### UTM 데이터 일관성 및 사용자 안내 개선 (완료: 2025-11-05)
- [x] 1. 주문 목록과 상세보기 UTM 불일치 해결
  - 주문 목록 API에서 utm_sessions 테이블 우선 조회
  - visitors 테이블을 fallback으로 사용
  - 데이터 소스 일관성 확보
- [x] 2. Direct 방문 고객 안내 추가
  - UTM 히스토리 섹션 항상 표시
  - 광고 없이 방문한 고객에 대한 명확한 안내 메시지
  - InfoCircleOutlined 아이콘으로 시각적 구분

### 페이지 매핑 검색 기능 개선 (완료: 2025-11-06)
- [x] 1. 검색 필터 로직 개선
  - `/api/mappings/all` 엔드포인트에 한국어 이름 검색 추가
  - URL과 매핑된 한국어 이름 모두 검색 가능
  - 대소문자 구분 없이 검색
  - 매핑 완료된 URL도 검색에서 누락되지 않음

### 고객 여정 분석 상단 UI/UX 개선 (완료: 2025-11-06)
- [x] 1. 마케터 관점 정보 우선순위 재구성
  - 2단 구조 설계 (핵심 비즈니스 지표 / 마케팅 효과 측정)
  - 재구매 여부 표시 (N번째 구매 뱃지)
  - 구매 결정 기간 추가 (첫 방문 후 X일 만에 구매)
  - 접촉 횟수 표시 (총 N번 접촉)
  - UTM 통합 표시 (source/medium/campaign)
- [x] 2. 불필요한 정보 제거
  - IP 주소, 주문번호 제거 (참고 영역 삭제)
  - Browser/OS 미사용 (마케팅 관련 없음)
- [x] 3. 정보 밀도 및 가독성 개선
  - 시각적 계층 구조 강화 (15-18px vs 11-12px)
  - 구분선과 구분자로 명확한 레이아웃
  - 이모티콘 제거, 텍스트만으로 깔끔하게 표현

### 데이터 정확성 개선 및 검증 체계 구축 (완료: 2025-11-06)
- [x] 1. 프론트엔드 데이터 검증 강화
  - UTM Last-Touch Attribution 적용 (최종 접촉 기준)
  - 체류시간 필터링 (10분 초과 값 제외)
  - 시간 포맷 개선 (formatDuration 함수)
  - 레이블 추가 (구매금액, 상품, 주문시간, 구매여정, 접촉, 유입, 페이지 체류)
- [x] 2. 백엔드 쿼리 로직 재설계
  - 중복 제거 로직 완전 제거 (모든 pageview 시간순 표시)
  - 세션 경계 검증 추가 (30분 이상 간격 = 세션 분리)
  - 체류시간 상한 설정 (최대 10분)
  - 652,119초(7.5일) → 정상 범위로 수정
- [x] 3. 데이터 검증 규칙 문서화
  - data-validation.mdc 작성
  - 도메인별 합리성 기준 정의
  - 개발 프로세스 체계화 (3단계 검증)
  - Agent 모드 개발 가이드라인 추가

### 페이지 이동 경로 분리 및 개선 (완료: 2025-11-06)
- [x] 1. 백엔드 API 재설계
  - purchase_journey: 구매 직전 경로 (광고 클릭 후 ~ 구매)
  - previous_visits: 과거 방문 이력 (날짜별 그룹화)
  - SQL 쿼리 실제 데이터로 검증 (⏸️ 일시정지 규칙 준수)
  - 기존 page_path 호환성 유지 (deprecated)
- [x] 2. 프론트엔드 UI 개선
  - "구매 당일 경로" 제목으로 변경 (광고 효과 명확화)
  - 이전 방문 접기/펼치기 기능 추가
  - 과거 방문은 회색 톤으로 시각적 구분
  - 날짜별 방문 통계 표시 (페이지 수, 체류시간, 구매 여부)
  - 기존 타임라인 디자인 완전 유지

### 광고 소재 분석 컬럼명 개선 (완료: 2025-11-07)
- [x] 1. 기여도 컬럼명 직관화 (최종)
  - "결제건 기여 포함 수" → "영향 준 주문 수"
  - "결제건 기여금액" → "기여한 매출액"
  - "기여 결제건 총 결제금액" → "영향 준 주문 총액"
- [x] 2. 의미적 일관성 확보
  - "영향" = 광고 접촉한 주문 (넓은 의미)
  - "기여" = 계산된 실제 매출 (좁은 의미)
- [x] 3. 상세 툴팁 작성 (스토리텔링 방식)
  - 실제 데이터 쿼리로 검증 후 작성
  - 예시 중심의 이해하기 쉬운 설명
  - 기여도 계산식 상세 설명 추가
  - 컬럼 간 차이점 명확화
- [x] 4. UI/UX 최적화
  - 컬럼 헤더 직접 호버 → 툴팁 (아이콘 없이)
  - 정렬 툴팁 제거 (showSorterTooltip: false)
  - 툴팁 최대 너비 500px 설정
  - 복사 기능 유지 (더블클릭)

### Phase 5: 로컬 개발 환경 개선 (완료: 2025-11-10)
- [x] 1. 네이버 클라우드 인프라 설정
  - ACG(방화벽) 설정 - PostgreSQL 포트 5432 개방
  - IP 화이트리스트 적용 (로컬 PC IP만 허용)
  - 보안 강화 (외부 접근 차단)
- [x] 2. 백엔드 환경별 설정 파일 분리
  - `.env.local` 파일 구조 도입
  - `backend/src/server.js` 환경 자동 감지 로직 추가
  - 개발 환경: `.env.local` 사용 (서버 DB 연결)
  - 프로덕션 환경: `.env` 사용 (기존 유지)
- [x] 3. 프론트엔드 API 프록시 설정
  - `frontend/vite.config.js` API 프록시 추가
  - 개발 서버에서 `/api` 요청 자동 라우팅
  - localhost:3003 백엔드로 프록시
- [x] 4. 로컬-서버 DB 직접 연결 구축
  - 서버 DB 직접 연결 방식 구축
  - 실제 데이터로 로컬 개발 및 테스트 가능
  - 백엔드/프론트엔드 로컬 실행 검증 완료
- [x] 5. 프로젝트 정리
  - Phase 4 완료 문서 9개 삭제
  - 테스트 스크립트 제거
  - 구버전 가이드 정리
- [x] 6. Cursor Rules 파일 정리 (2025-11-10)
  - 중복 파일 4개 삭제 (project-status-auto-update.mdc, project-tracker.mdc, order-status-sync-plan.mdc, project-reference.mdc)
  - 중복 파일 통합 → system-status.mdc 생성
  - data-validation.mdc 간소화 (617줄 → 280줄)
  - git-deployment.mdc 간소화 (398줄 → 270줄)
  - 결과: 9개 → 6개 파일로 정리, 가독성 및 유지보수성 향상
- [x] 7. Cursor Rules 최적화 - Agent Requestable 전략 (2025-11-10)
  - 초간결 규칙 생성: project-status-update.mdc (alwaysApply: true, 67줄)
  - 나머지 6개 규칙: alwaysApply: false + agent_requestable
  - 각 규칙 description 최적화 (Agent가 키워드로 자동 탐지)
  - 토큰 소모 최적화: 평균 200~500 토큰/대화 (이전 800~1200 대비 50% 절약)
  - 결과: 필수 규칙만 자동 로딩, 나머지는 Agent가 필요 시 자동 참조

### 고객 여정 연속 중복 페이지 제거 (완료: 2025-11-10)
- [x] 1. 연속 중복 제거 로직 개발
  - removeConcecutiveDuplicates 함수 구현
  - 같은 URL 연속 방문 시 하나로 통합
  - 체류시간 자동 합산 (예: 17초 + 5분22초 = 5분39초)
- [x] 2. 모든 여정에 자동 적용
  - 구매 당일 경로 적용
  - 과거 방문 이력 적용
  - 날짜별 통계 자동 재계산
- [x] 3. 의미있는 경로 시각화
  - 실제 의미있는 페이지 이동만 표시
  - 중복으로 인한 혼란 제거
  - 단계 번호 자동 재정렬

### 고객 여정 페이지 타입별 색상 구분 (완료: 2025-11-11)
- [x] 1. 페이지 타입 자동 감지 시스템
  - getPageType 함수 구현 (URL 및 한국어 이름 분석)
  - 상품 상세 / 장바구니 / 주문서 / 주문 완료 / 일반 페이지 구분
  - 다양한 URL 패턴 지원 (/product, /cart, /order, /complete 등)
- [x] 2. 전환 퍼널 시각화 색상 적용
  - 상품 상세: 노란색 배경 (#fef3c7)
  - 장바구니: 초록색 배경 (#dcfce7)
  - 주문서 작성: 파란색 배경 (#dbeafe)
  - 주문 완료: 진한 파란색 배경 (#bfdbfe)
  - 일반 페이지: 흰색 배경 (깔끔한 디자인 유지)
- [x] 3. 이탈 지점 강조 시스템
  - 이탈 페이지 빨간색 배경 적용 (최우선)
  - 페이지 타입보다 이탈 여부 우선순위 높게 설정
  - 체류 시간 배지 회색 통일 (배경색이 의미 전달)
- [x] 4. 전환 흐름 한눈에 파악
  - 색상만으로 고객 전환 단계 즉시 확인
  - 노랑(관심) → 초록(담음) → 파랑(결정) → 진한파랑(완료) 흐름
  - 마케팅 개선 포인트 빠른 식별 가능

### 페이지 매핑 테이블 정렬 개선 (완료: 2025-11-11)
- [x] 1. 우선순위 정렬 로직 추가
  - 매핑 안 된 URL 최상단 표시
  - 매핑 완료된 URL 하단 표시
  - 프론트엔드 정렬로 빠른 적용
- [x] 2. 사용자 편의성 향상
  - 매핑 필요 항목 즉시 확인 가능
  - 스크롤 없이 작업 대상 파악
  - 검색/페이지네이션 기능 유지

---

## 🔄 진행 중

### 시스템 안정화 모니터링
- [x] Cafe24 API 제거 완료
- [x] 백엔드 정상 작동 확인
- [ ] 일반 결제 주문 추적 모니터링 (지속적)
- [ ] 대시보드 데이터 정합성 확인 (지속적)

---

## 📋 다음 할 일 (보류 중)

### Phase 6: 외부 결제 추적 개선 (선택적)
- [ ] 1. tracker-v043.js 개선
  - [ ] order_attempt 이벤트 추가 (주문 버튼 클릭 시)
  - [ ] 주문 시도 시간, 금액, 상품 정보 저장
- [ ] 2. Google Sheets API 연동
  - [ ] Cafe24 Recipe 데이터 읽기
  - [ ] 10분마다 자동 동기화
- [ ] 3. 시간 기반 매칭 로직 개발
  - [ ] order_attempts 테이블 생성
  - [ ] 시간 + 금액 + 상품 기반 매칭
  - [ ] conversions 테이블 업데이트
- [ ] 4. 주문 상태 동기화
  - [ ] Google Sheets에서 order_status 읽기
  - [ ] 취소/환불 주문 자동 업데이트

### Phase 7: 대시보드 고도화 (미정)
- [ ] 1. 광고 소재 분석 페이지 개선
- [ ] 2. visitor_id 기반 사용자 여정 추적
- [ ] 3. 전환 퍼널 분석
- [ ] 4. A/B 테스트 기능

---

## ⚠️ 알려진 이슈

### 1. 외부 결제 주문 추적 불가 (미해결 ⚠️)
- **문제**: 카카오페이/네이버페이 같은 외부 결제 주문이 `conversions` 테이블에 기록되지 않음
- **원인**: 
  - 외부 결제 페이지로 리다이렉트 → Cafe24 주문 완료 페이지(`order_result.html`)를 거치지 않음
  - tracker-v042.js의 `purchase` 이벤트가 발생하지 않음
  - Cafe24 API는 추가옵션에서 visitor_id를 제공하지 못함 (빈 문자열)
- **현재 상태**: 
  - ✅ 일반 결제 주문: 정상 추적
  - ❌ 외부 결제 주문: 추적 불가
- **향후 계획**: 
  - Google Sheets + 시간 기반 매칭 로직 (보류 중)
  - tracker에 order_attempt 이벤트 추가 고려

### 2. 과거 주문 데이터 없음 (정상 동작)
- **상황**: tracker-v042.js 설치 이전 주문들은 visitor_id가 없음
- **영향**: 과거 주문은 광고 분석 불가능 (예상된 동작)
- **대응**: tracker 설치 후 새 주문부터 광고 분석 가능

### 3. Cafe24 API 연동 제거 (2025-11-05)
- **이유**: visitor_id를 추출할 수 없어 실질적 효용이 없음
- **영향**: 없음 (기존에도 데이터 수집 못 했음)
- **결과**: 시스템 간소화, 불필요한 API 호출 제거

---

## 🛠️ 개발 환경

### 로컬 개발 (2가지 방식)

#### 방식 1: Docker Compose (독립 테스트 환경)
```bash
# 프로젝트 디렉토리로 이동
cd C:\analysis\moadamda-analytics

# Docker Compose 실행 (로컬 PostgreSQL 사용)
docker-compose up -d

# 접속
# - Dashboard: http://localhost:3030
# - Backend API: http://localhost:3003
# - PostgreSQL: localhost:5432 (로컬 DB)
```

**특징:**
- ✅ 로컬 PostgreSQL 사용 (독립된 데이터)
- ✅ 테스트 데이터로만 작업
- ✅ 서버 데이터에 영향 없음
- ❌ 실제 주문 데이터 확인 불가

#### 방식 2: 서버 DB 직접 연결 (실제 데이터) ⭐ 추천
```bash
# 사전 준비: backend/.env.local 파일 생성 (최초 1회)
# DB_HOST=211.188.53.220
# DB_PORT=5432
# DB_USER=moadamda
# DB_PASSWORD=analytics2024
# DB_NAME=analytics

# 1. 로컬 Docker 중지 (포트 충돌 방지)
cd C:\analysis\moadamda-analytics
docker-compose down

# 2. 백엔드 실행 (PowerShell 창 1)
cd backend
node src/server.js

# 3. 프론트엔드 실행 (PowerShell 창 2)
cd frontend
npm run dev

# 접속
# - Dashboard: http://localhost:3030
# - Backend API: http://localhost:3003
# - PostgreSQL: 211.188.53.220:5432 (서버 DB)
```

**특징:**
- ✅ 서버 DB 직접 연결 (실제 데이터)
- ✅ 실제 주문 데이터로 개발 및 테스트
- ✅ 코드 수정 시 자동 재시작 (개발 효율↑)
- ⚠️ 실제 데이터 수정 시 주의 필요

### 프로덕션 (네이버 클라우드)
- **서버 IP**: 211.188.53.220
- **Backend API**: https://marketingzon.com/api/track
- **Dashboard**: https://dashboard.marketingzon.com
- **SSH 접속**: `ssh -i C:\Users\HOTSELLER\Downloads\moadamda-key.pem root@211.188.53.220`

### Git 저장소
- **GitHub**: https://github.com/hongkimwork/moadamda-analytics
- **브랜치**: main
- **배포 방식**: Git 기반 자동화

### 배포 절차 (Git 기반)

#### 📋 **사전 준비** (최초 1회만)
```bash
# 로컬에서 GitHub 연결 확인
cd C:\analysis\moadamda-analytics
git remote -v
# origin  https://github.com/hongkimwork/moadamda-analytics.git 확인

# 서버에서 GitHub 연결 (최초 1회)
ssh root@211.188.53.220  # 비밀번호: L9=FEcbJN!Yd
cd /root/moadamda-analytics
git remote -v
# origin이 없으면:
git remote add origin https://github.com/hongkimwork/moadamda-analytics.git
```

#### 🚀 **배포 프로세스** (코드 변경 시마다)

**1️⃣ 로컬에서 코드 수정 및 GitHub 업로드**
```bash
# Windows 로컬 PC
cd C:\analysis\moadamda-analytics

# 수정한 파일 확인
git status

# 변경사항 커밋
git add .
git commit -m "변경 내용 설명"

# GitHub에 업로드
git push origin main
```

**2️⃣ 서버 SSH 접속**
```bash
# CMD 또는 PowerShell에서
ssh root@211.188.53.220
# 비밀번호: L9=FEcbJN!Yd
```

**3️⃣ 서버에서 최신 코드 다운로드**
```bash
cd /root/moadamda-analytics

# GitHub에서 최신 코드 받기
git pull origin main
```

**4️⃣ Docker 재빌드 및 재시작**
```bash
# 이미지 재빌드 + 컨테이너 재시작 (필수!)
docker-compose -f docker-compose.prod.yml up -d --build
```

**5️⃣ 배포 확인**
```bash
# 전체 로그 확인
docker-compose -f docker-compose.prod.yml logs backend --tail 50

# 실시간 로그 확인
docker-compose -f docker-compose.prod.yml logs backend -f

# Cafe24 스케줄러 확인
docker-compose -f docker-compose.prod.yml logs backend | grep "Cafe24"
```

#### ⚠️ **중요 사항**

1. **코드 변경 시 반드시 `--build` 옵션 사용!**
   - ❌ `docker-compose restart` (이미지 재빌드 안 됨)
   - ✅ `docker-compose up -d --build` (이미지 재빌드 됨)

2. **Git 기반 배포의 장점**
   - ✅ 로컬과 서버 코드가 항상 동기화
   - ✅ 변경 이력 자동 관리
   - ✅ 파일 하나하나 수동 수정 불필요
   - ✅ 롤백 쉬움 (git checkout)

3. **.env 파일은 Git에 포함되지 않음**
   - `.env` 파일은 `.gitignore`에 등록되어 있음
   - 서버에서 수동으로 관리해야 함
   - 위치: `/root/moadamda-analytics/backend/.env`

### 롤백 방법 (문제 발생 시)
```bash
# v042 (이전 버전)로 되돌리기
cd ~/moadamda-analytics
git checkout v042
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d --build
```

---

## 📊 프로젝트 통계

- **tracker 버전**: v042 (현재 사용 중)
- **시스템 버전**: v045 (로컬 개발 환경 개선)
- **총 개발 기간**: 16일
- **완료된 Phase**: 5 / 6
- **다음 마일스톤**: 안정적 운영 모니터링 및 선택적 기능 개발
- **Git 태그**: v042 (tracker) → v043 (Cafe24 API 시도) → v044 (시스템 안정화) → v045 (로컬 개발 환경)

---

## 📚 참고 문서

### 프로젝트 문서
- [START_GUIDE.md](./START_GUIDE.md) - 빠른 시작 가이드
- [ARCHITECTURE_ANALYSIS.md](./ARCHITECTURE_ANALYSIS.md) - 시스템 아키텍처 분석
- [FINAL_PLAN.md](./FINAL_PLAN.md) - 최종 기획안 (문제 해결 방안)
- [HTTPS_SETUP_GUIDE.md](./HTTPS_SETUP_GUIDE.md) - HTTPS SSL 설정 가이드

### 배포 관련
- [deployment/DEPLOY_GUIDE.md](./deployment/DEPLOY_GUIDE.md) - 네이버 클라우드 배포 가이드
- [docker-compose.prod.yml](./docker-compose.prod.yml) - 프로덕션 Docker Compose 설정

### 참고 자료
- Cafe24 API 문서: https://developers.cafe24.com/
- clarity-reference/: Microsoft Clarity 참고 코드 (구조 참고용)

---

## 🎯 다음 세션 시작 시 할 일

### 1. **시스템 안정성 모니터링**
   - 백엔드 로그 확인
   ```bash
   ssh -i C:\Users\HOTSELLER\Downloads\moadamda-key.pem root@211.188.53.220
   docker-compose -f ~/moadamda-analytics/docker-compose.prod.yml logs backend --tail 100
   ```
   - ✅ Cafe24 관련 로그 없어야 정상
   - ✅ "Database connected successfully" 확인
   
### 2. **conversions 테이블 데이터 확인**
   - 새 주문 (일반 결제만) 추적되는지 확인
   ```bash
   docker exec -i ma-postgres psql -U moadamda -d analytics -c "SELECT order_id, visitor_id, utm_source, total_amount, created_at FROM conversions ORDER BY created_at DESC LIMIT 10;"
   ```
   
### 3. **대시보드 정상 작동 확인**
   - https://dashboard.marketingzon.com
   - 주문 목록 페이지: 최근 주문 표시 확인
   - 광고 소재 분석 페이지: UTM 기반 집계 확인

### 4. **선택적: 외부 결제 추적 개선** (필요 시)
   - Google Sheets API 연동 검토
   - tracker-v042.js에 order_attempt 이벤트 추가 검토
   - 시간 기반 매칭 로직 설계

---

**💡 Tip**: 이 문서는 AI가 자동으로 관리합니다. 작업 완료 시 자동으로 체크리스트가 업데이트됩니다.

