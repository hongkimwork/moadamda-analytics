# 🎯 Moadamda Analytics - 프로젝트 현황

**마지막 업데이트**: 2025-10-31 14:45

---

## 📍 현재 단계

**Phase 3: tracker-v042.js 개발 및 테스트 (visitor_id 주입)**

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

### Phase 3: tracker-v042.js 개발 (완료: 2025-10-31 14:30)
- [x] visitor_id 자동 주입 로직 구현
  - Cafe24 추가옵션(`add_option_name`, `add_option_input`)에 자동 삽입
  - 네이버페이, 카카오페이, 일반 주문 모두 지원
- [x] 주문서 폼 자동 감지 및 hidden input 생성
- [x] tracker-v042.js 파일 생성 및 로컬 저장
- [x] VERSION.txt 업데이트

---

## 🔄 진행 중 (Phase 3 계속)

### tracker-v042.js 테스트
- [x] 1. Cafe24 관리자 로그인 (완료: 2025-10-31)
- [x] 2. 스마트디자인 편집 → `</head>` 직전에 tracker-v042.js 삽입 (완료: 2025-10-31)
- [ ] 3. 테스트 주문 실행
  - [ ] 3-1. 신용카드 테스트 (일반 결제)
  - [ ] 3-2. 카카오페이 테스트 (외부 결제) ⭐ **핵심 테스트**
  - [ ] 3-3. 페이코 테스트 (선택)
- [ ] 4. Cafe24 관리자 → 주문 관리 → 주문 상세 → 추가옵션에서 `ma_visitor_id` 확인
- [ ] 5. visitor_id 값이 정상적으로 기록되는지 검증

---

## 📋 다음 할 일 (Phase 4 예정)

### Phase 4-A: 백엔드 Cafe24 API 연동
- [ ] 1. Cafe24 API OAuth 앱 등록
- [ ] 2. Access Token 발급
- [ ] 3. Node.js에서 Cafe24 API 호출 코드 작성
  - 주문 목록 조회 API (`/api/v2/admin/orders`)
  - 주문 상세 조회 API (추가옵션 포함)
- [ ] 4. `visitor_id` 추출 로직 구현
- [ ] 5. `conversions` 테이블에 `visitor_id` 컬럼 추가 (마이그레이션)
- [ ] 6. 주문 생성 시 `visitor_id` 자동 저장
- [ ] 7. 기존 주문 데이터에 `visitor_id` 매핑 (배치 작업)

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

### 1. 외부 결제 주문 누락 문제 (해결 진행 중)
- **문제**: 카카오페이/페이코 같은 외부 결제 주문이 `conversions` 테이블에 기록되지 않음
- **원인**: 
  - 외부 결제 페이지로 리다이렉트 → Cafe24 주문 완료 페이지(`order_result.html`)를 거치지 않음
  - tracker.js의 `purchase` 이벤트가 발생하지 않음
  - 예시: 2025-10-31 16:16:12 주문 (165,000원, 카카오페이 추정) - Clarity에는 있지만 우리 시스템에 없음
- **해결 전략 (2단계)**:
  - Phase 3 (현재): tracker-v042.js에서 visitor_id를 Cafe24 추가옵션에 주입 ✅
  - Phase 4 (다음): 백엔드에서 Cafe24 API로 주문 정보 가져오기 → visitor_id 추출 → conversions 테이블 저장
- **상태**: tracker-v042.js 개발 완료 ✅, Cafe24 업로드 완료 ✅, 테스트 대기 중

### 2. 대시보드 IP 주소 접속 문제 (해결 완료 ✅)
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
- **SSH 접속**: `ssh -i C:\Users\HOTSELLER\Downloads\moadamda-key.pem root@211.188.53.220`

### 배포 절차
```bash
# 1. 로컬: 프로젝트 압축
cd C:\analysis
tar -czf moadamda-analytics.tar.gz moadamda-analytics/

# 2. 서버 업로드
scp -i C:\Users\HOTSELLER\Downloads\moadamda-key.pem moadamda-analytics.tar.gz root@211.188.53.220:~/

# 3. 서버 접속 및 배포
ssh -i C:\Users\HOTSELLER\Downloads\moadamda-key.pem root@211.188.53.220
cd ~
tar -xzf moadamda-analytics.tar.gz
cd moadamda-analytics
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d

# 4. 로그 확인
docker-compose -f docker-compose.prod.yml logs -f
```

---

## 📊 프로젝트 통계

- **tracker 버전**: v042 (최신)
- **총 개발 기간**: 6일
- **완료된 Phase**: 2 / 5
- **다음 마일스톤**: Cafe24 API 연동 (Phase 4)

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

1. **tracker-v042.js 테스트 결과 확인**
   - visitor_id가 Cafe24 주문에 정상 기록되었는지 체크
   
2. **테스트 성공 시**:
   - Phase 4-A (Cafe24 API 연동) 시작
   
3. **테스트 실패 시**:
   - tracker-v042.js 디버깅
   - Cafe24 추가옵션 설정 확인

---

**💡 Tip**: 이 문서는 AI가 자동으로 관리합니다. 작업 완료 시 자동으로 체크리스트가 업데이트됩니다.

