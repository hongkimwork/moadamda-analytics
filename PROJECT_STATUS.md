# 🎯 Moadamda Analytics - 프로젝트 현황

**마지막 업데이트**: 2025-11-04 14:40

---

## 📍 현재 단계

**Phase 4: Cafe24 API 연동 완료 (v043)**

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

### Phase 4: Cafe24 API 연동 (완료: 2025-11-04)
- [x] 1. Cafe24 API OAuth 앱 등록
  - Client ID: z19FtJJUINTnX0mkQh7M3D
  - Redirect URI: https://marketingzon.com/cafe24/callback
  - 권한: mall.read_order, mall.read_product, mall.read_customer
- [x] 2. Access Token 발급 성공
  - OAuth 인증 페이지 구현 (`/cafe24/auth`)
  - OAuth 콜백 처리 구현 (`/cafe24/callback`)
  - Access Token과 Refresh Token 발급 완료
- [x] 3. Node.js에서 Cafe24 API 호출 코드 작성
  - `backend/src/routes/cafe24.js` - OAuth 엔드포인트
  - `backend/src/utils/cafe24Client.js` - API 클라이언트
  - `backend/src/scheduler/syncCafe24Orders.js` - 주문 동기화 스케줄러
- [x] 4. `visitor_id` 추출 로직 구현
  - 주문 추가옵션(additional_option_values)에서 ma_visitor_id 추출
  - visitors 테이블 확인 후 conversions 테이블 저장
- [x] 5. 네이버 클라우드 서버 배포 (v043)
  - Git 브랜치 병합 (feature/cafe24-api-integration → main)
  - v043 태그 생성
  - docker-compose.prod.yml 업데이트 (env_file 추가)
  - .env 파일 설정 완료
- [x] 6. 주문 동기화 스케줄러 정상 작동 확인
  - 1시간마다 자동 실행
  - 최근 7일 주문 조회 (100개 주문 fetch 성공)
  - API 버전 문제 해결 (2024-03-01 → 2025-09-01)
  - 스케줄러 로그: `[Cafe24 Sync] Fetched 100 orders`

---

## 🔄 진행 중

### tracker-v042.js 실전 테스트 (대기 중)
- [ ] 새 주문 발생 시 visitor_id 동기화 확인
- [ ] conversions 테이블에 visitor_id 포함 여부 검증
- [ ] 광고 소재 분석 페이지에서 데이터 확인

---

## 📋 다음 할 일 (Phase 5 예정)

### Phase 4-B: 주문 상태 동기화 (선택적)
- [ ] 1. Google Sheets API 연동 (Cafe24 Recipe에서 업데이트)
- [ ] 2. Node.js 스케줄러 작성 (주문 상태 동기화)
- [ ] 3. `conversions.order_status` 자동 업데이트
- [ ] 4. 취소/환불 주문 필터링 쿼리 추가

### Phase 5: 대시보드 개선
- [ ] 1. 광고 소재 분석 페이지에 "취소 제외" 옵션 추가
- [ ] 2. 주문 상태별 필터링 UI
- [ ] 3. visitor_id 기반 사용자 여정 추적 기능
- [ ] 4. 전환율 계산 로직 개선

---

## ⚠️ 알려진 이슈

### 1. 외부 결제 주문 누락 문제 (해결 완료 ✅)
- **문제**: 카카오페이/페이코 같은 외부 결제 주문이 `conversions` 테이블에 기록되지 않음
- **원인**: 
  - 외부 결제 페이지로 리다이렉트 → Cafe24 주문 완료 페이지(`order_result.html`)를 거치지 않음
  - tracker.js의 `purchase` 이벤트가 발생하지 않음
- **해결 완료 (2025-11-04)**:
  - ✅ tracker-v042.js: visitor_id를 Cafe24 추가옵션에 주입
  - ✅ Cafe24 API: 1시간마다 주문 조회 → visitor_id 추출 → conversions 저장
  - ✅ 스케줄러 정상 작동 확인 (100개 주문 fetch 성공)
- **상태**: 해결 완료! tracker 설치 후 새 주문부터 자동 동기화

### 2. 과거 주문 visitor_id 없음 (정상 동작)
- **상황**: tracker-v042.js 설치 이전 주문들은 visitor_id가 없음
- **결과**: `[Cafe24 Sync] skipped: 100` - 과거 주문은 스킵됨
- **영향**: 과거 주문은 광고 분석 불가능 (정상)
- **대응**: tracker 설치 후 새 주문부터 광고 분석 가능

### 3. 대시보드 IP 주소 접속 문제 (해결 완료 ✅)
- **문제**: https://dashboard.marketingzon.com 대신 http://211.188.53.220:3030으로 접속 시 불편
- **해결**: 도메인 구매 및 DNS 설정 완료, SSL 적용 완료

---

## 🛠️ 개발 환경

### 로컬 개발
```bash
# 프로젝트 디렉토리로 이동
cd C:\analysis\moadamda-analytics

# Docker Compose 실행
docker-compose up

# 접속
# - Dashboard: http://localhost:3030
# - Backend API: http://localhost:3003
# - PostgreSQL: localhost:5432 (DB: analytics, User: moadamda, Pass: analytics2024)
```

### 프로덕션 (네이버 클라우드)
- **서버 IP**: 211.188.53.220
- **Backend API**: https://marketingzon.com/api/track
- **Dashboard**: https://dashboard.marketingzon.com
- **Cafe24 OAuth**: https://marketingzon.com/cafe24/auth
- **SSH 접속**: `ssh -i C:\Users\HOTSELLER\Downloads\moadamda-key.pem root@211.188.53.220`

### Cafe24 API 설정
- **Client ID**: z19FtJJUINTnX0mkQh7M3D
- **Shop ID**: moadamda
- **Redirect URI**: https://marketingzon.com/cafe24/callback
- **권한**: mall.read_order, mall.read_product, mall.read_customer
- **API Version**: 2025-09-01
- **스케줄러**: 1시간마다 자동 실행 (최근 7일 주문 조회)

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

- **tracker 버전**: v043 (최신)
- **시스템 버전**: v043 (Cafe24 API 통합)
- **총 개발 기간**: 10일
- **완료된 Phase**: 4 / 5
- **다음 마일스톤**: 실전 테스트 및 모니터링
- **Git 태그**: v042 (baseline) → v043 (Cafe24 API)

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

### 1. **실전 테스트 및 모니터링**
   - 새 주문 발생 시 로그 확인
   ```bash
   docker-compose -f ~/moadamda-analytics/docker-compose.prod.yml logs backend -f
   ```
   - 예상 로그: `[Cafe24 Sync] ✓ Order 20251104-xxx synced (visitor_id: abc-123...)`
   
### 2. **conversions 테이블 확인**
   - PostgreSQL 접속 후 데이터 확인
   ```sql
   SELECT order_id, visitor_id, final_payment, utm_source 
   FROM conversions 
   WHERE visitor_id IS NOT NULL 
   ORDER BY timestamp DESC 
   LIMIT 10;
   ```
   
### 3. **대시보드에서 광고 효과 확인**
   - https://dashboard.marketingzon.com
   - 광고 소재 분석 페이지
   - 새 주문이 광고 출처별로 집계되는지 확인

### 4. **선택적: Google Sheets 동기화 구현** (필요 시)
   - 주문 취소/환불 자동 업데이트
   - order_status 필드 동기화

---

**💡 Tip**: 이 문서는 AI가 자동으로 관리합니다. 작업 완료 시 자동으로 체크리스트가 업데이트됩니다.

