# 🎯 Moadamda Analytics - 프로젝트 현황

**마지막 업데이트**: 2025-11-13

---

## 📍 현재 상태

- **시스템 버전**: v047 (페이지매핑 복합 조건 기능 구현 완료)
- **Tracker 버전**: tracker-v044.js
- **배포 환경**: 네이버 클라우드 (프로덕션)
- **개발 환경**: macOS (로컬 개발 → 배포 서버 DB 연결)
- **서버 정보**:
  - IP: 49.50.139.223
  - SSH: root@49.50.139.223
  - 프론트: https://marketingzon.com
  - 백엔드: https://moadamda-analytics.co.kr
  - SSL: Let's Encrypt (자동 갱신)

---

## 📝 최근 작업 로그 (최신 15개)

| 날짜 | 작업 내용 | 수정 파일 |
|------|---------|----------|
| 2025-11-24 | Lucide 아이콘 적용 | OrderAnalysis.jsx |
| 2025-11-24 | 경로-구매상품 순서 변경 | OrderAnalysis.jsx |
| 2025-11-24 | 고객 여정 모달 디자인 개선 | OrderAnalysis.jsx |
| 2025-11-24 | 구매완료 정보 순서조정 | OrderAnalysis.jsx |
| 2025-11-24 | 구매 완료 뱃지-상품명 순서 변경 | OrderAnalysis.jsx |
| 2025-11-24 | 구매 완료 뱃지 위치 통일 | OrderAnalysis.jsx |
| 2025-11-24 | 제품 뱃지 위치 변경 | OrderAnalysis.jsx |
| 2025-11-24 | 라벨 표시 개선 | OrderAnalysis.jsx |
| 2025-11-24 | 단계 색상 통일 | OrderAnalysis.jsx |
| 2025-11-24 | 페이지 매핑 직접 연동 | OrderAnalysis.jsx |
| 2025-11-24 | 구매 상품 표시 정확도 개선 | OrderAnalysis.jsx |
| 2025-11-24 | 하드코딩 로직 제거 | OrderAnalysis.jsx |
| 2025-11-21 | 배지 UI/UX 개선 | MappingModal.jsx, colorHistory.js |
| 2025-11-21 | 제품 뱃지 컬럼 분리 | PageMapping.jsx |
| 2025-11-21 | 배지 미리보기 기능 복원 | MappingModal.jsx |
| 2025-11-21 | 다중 배지 시스템 구현 | MappingModal.jsx, mappings.js, OrderAnalysis.jsx |
| 2025-11-21 | 색상 히스토리 안내 문구 추가 | MappingModal.jsx |
| 2025-11-21 | 색상 히스토리 기능 추가 | colorHistory.js, MappingModal.jsx |
| 2025-11-21 | 배지 데이터 조회 버그 수정 | mappings.js, OrderAnalysis.jsx |
| 2025-11-21 | 배지 기능 서버 배포 | 전체 |
| 2025-11-20 | 배지 설정 UI 컴팩트화 | MappingModal.jsx |
| 2025-11-20 | 매핑 풀기 기능 추가 | PageMapping.jsx |
| 2025-11-20 | 페이지 매핑 정렬 최신순 변경 | urlCleaner.js, PageMapping.jsx |
| 2025-11-20 | 요약 대시보드 제거 | CreativePerformance.jsx |
| 2025-11-18 | 파일 구조 정리 | docs/, scripts/ |
| 2025-11-18 | 프론트엔드 최적화 (67% 감소) | App.jsx, vite.config.js |
| 2025-11-18 | 컴포넌트 모듈화 완료 | components/ 10개 |
| 2025-11-18 | 리팩토링 문서 작성 | docs/archive/ 3개 |
| 2025-11-18 | console.log 제거 (29개) | 백엔드/프론트 6개 |
| 2025-11-18 | 배포 매뉴얼 개선 | deploy.mdc |
| 2025-11-18 | 매핑 통계 표시 수정 | PageMapping.jsx |
| 2025-11-17 | Git 브랜치 관리 통합 | git-only.mdc |
| 2025-11-17 | 배포 Rules 재구성 | .cursor/rules/ |
| 2025-11-14 | tracker 파일 Git 포함 | .gitignore |
| 2025-11-13 | DB 구조 문서 생성 | database-structure.md |
| 2025-11-13 | 복합 URL Badge+Popover 표시 | PageMapping.jsx |
| 2025-11-13 | 액션 컬럼 드롭다운 간소화 | PageMapping.jsx |
| 2025-11-13 | URL 카드 배경 회색/내부 흰색 | PageMapping.jsx |
| 2025-11-13 | URL 모달 색상 통일 (회색 팔레트) | PageMapping.jsx |
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

### 1️⃣ 최초 설정

#### backend/.env 파일 생성 (배포 서버 DB 연결)
```bash
DB_HOST=49.50.139.223
DB_PORT=5432
DB_USER=moadamda
DB_PASSWORD=MoaDamDa2025!Secure#Analytics
DB_NAME=analytics
NODE_ENV=development
PORT=3003
```

### 2️⃣ 로컬 개발 시작

```bash
# @dev.mdc 첨부 → AI가 자동으로 서버 구동
```

**접속:** http://localhost:3030

### 3️⃣ 배포

```bash
# 자연어로 배포 요청 (예시)
"main 브랜치를 서버에 배포해"
"feature/stats 브랜치를 서버에 배포해"

# @deploy.mdc 참고하여 AI가 자동 실행
```

---

## 🔄 핵심 시스템 정보

### 정상 작동 기능
- ✅ tracker-v044.js (일반 결제 추적)
- ✅ UTM 기반 광고 효과 측정
- ✅ 고객 여정 분석 (구매당일/과거 분리)
- ✅ 체류시간 자동 필터링 (10분 상한)

### 데이터 흐름
```
고객 방문 (UTM 포함) → tracker-v044.js → pageview 기록
→ 상품 구매 (일반 결제만) → purchase 이벤트
→ conversions 테이블 저장 → 대시보드 조회
```

### 주요 파일
- Tracker: `tracker/build/tracker-v044.js`
- Backend: `backend/src/server.js`, `backend/src/routes/stats.js`
- Frontend: `frontend/src/pages/OrderAnalysis.jsx`
- DB: PostgreSQL @ 49.50.139.223 (연결 정보는 backend/.env 참조)

---

## 📚 참고 문서

### 핵심 가이드
- [.cursor/rules/dev.mdc](./.cursor/rules/dev.mdc) - 로컬 개발 환경
- [.cursor/rules/deploy.mdc](./.cursor/rules/deploy.mdc) - 서버 배포 매뉴얼
- [.cursor/rules/data-validation.mdc](./.cursor/rules/data-validation.mdc) - 데이터 검증

### 시작 가이드
- [docs/START_GUIDE.md](./docs/START_GUIDE.md) - Phase 1 시작 가이드
- [docs/HTTPS_SETUP_GUIDE.md](./docs/HTTPS_SETUP_GUIDE.md) - HTTPS 설정 가이드

### 작업 기록 (완료)
- [docs/archive/REFACTORING_REPORT.md](./docs/archive/REFACTORING_REPORT.md) - 리팩토링 보고서
- [docs/archive/SQL_VALIDATION_REPORT.md](./docs/archive/SQL_VALIDATION_REPORT.md) - SQL 검증 보고서

### 외부 링크
- [Git 저장소](https://github.com/hongkimwork/moadamda-analytics)

---

**💡 Note**: 이 문서는 최근 작업 로그를 중심으로 간결하게 관리됩니다.
