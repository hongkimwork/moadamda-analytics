# 🎯 Moadamda Analytics - 프로젝트 현황

**마지막 업데이트**: 2025-11-05 13:50

---

## 📍 현재 단계

**Phase 4: 코어 시스템 안정화 완료 (v044)**

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

---

## 🔄 진행 중

### 시스템 안정화 모니터링
- [x] Cafe24 API 제거 완료
- [x] 백엔드 정상 작동 확인
- [ ] 일반 결제 주문 추적 모니터링 (지속적)
- [ ] 대시보드 데이터 정합성 확인 (지속적)

---

## 📋 다음 할 일 (보류 중)

### Phase 5: 외부 결제 추적 개선 (선택적)
- [ ] 1. tracker-v042.js 개선
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

### Phase 6: 대시보드 고도화 (미정)
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
- **시스템 버전**: v044 (코어 시스템 안정화)
- **총 개발 기간**: 11일
- **완료된 Phase**: 4 / 5
- **다음 마일스톤**: 안정적 운영 모니터링
- **Git 태그**: v042 (tracker) → v043 (Cafe24 API 시도) → v044 (시스템 안정화)

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

