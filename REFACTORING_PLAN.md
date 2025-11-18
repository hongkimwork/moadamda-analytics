# 🔧 Moadamda Analytics 리팩토링 계획

**생성일**: 2025-11-18
**전체 리팩토링 실행**: @full-refactor-test 결과

---

## 📊 현재 상태

- **백엔드 파일**: 9개 (.js)
- **프론트엔드 파일**: 27개 (.jsx/.js)
- **총 라인 수**: ~12,900줄
- **대용량 파일**: 7개 (500줄 이상)
- **console.log**: 32개 (디버깅용)
- **TODO/FIXME**: 0개 ✅

---

## 🎯 리팩토링 우선순위

### ⭐ 우선순위 1: stats.js 파일 분리 (긴급)

**현재 문제:**
- 단일 파일 1,759줄
- 13개 엔드포인트가 모두 포함
- 유지보수 어려움

**분리 계획:**

```
backend/src/routes/stats/
├── index.js              # 라우터 통합 (새로 생성)
├── basic.js              # 기본 통계 엔드포인트
│   ├── GET /today
│   ├── GET /conversion
│   └── GET /products
├── range.js              # 기간별 통계
│   ├── GET /range
│   └── GET /daily
├── activity.js           # 활동 분석
│   ├── GET /recent-activity
│   └── GET /segments
├── utm.js                # UTM 분석
│   ├── GET /utm-performance
│   ├── GET /utm-attribution
│   ├── GET /utm-keys
│   └── GET /utm-values
└── orders.js             # 주문 분석
    ├── GET /orders
    └── GET /order-detail/:orderId
```

**실행 단계:**
1. `backend/src/routes/stats/` 디렉토리 생성
2. 각 파일로 엔드포인트 그룹 이동
3. `index.js`에서 모든 라우터 통합
4. `backend/src/server.js`에서 경로만 변경: `require('./routes/stats')` → `require('./routes/stats/index')`
5. 테스트: 모든 엔드포인트 정상 동작 확인

**예상 소요 시간**: 2-3시간
**위험도**: 중간 (충분한 테스트 필요)

---

### ⭐ 우선순위 2: DataTables.jsx 컴포넌트 분리

**현재 문제:**
- 단일 파일 1,412줄
- 헬퍼 컴포넌트 5개 + 메인 로직

**분리 계획:**

```
frontend/src/
├── components/
│   └── tables/
│       ├── ShortId.jsx         # ID 짧게 표시 컴포넌트
│       ├── ShortIp.jsx         # IP 짧게 표시 컴포넌트
│       ├── ShortUrl.jsx        # URL 짧게 표시 컴포넌트
│       ├── EllipsisText.jsx    # 텍스트 말줄임 컴포넌트
│       ├── DeviceText.jsx      # 디바이스 표시 컴포넌트
│       └── index.js            # 통합 export
└── pages/
    └── DataTables.jsx          # 메인 로직만 (약 1,000줄으로 감소)
```

**실행 단계:**
1. `frontend/src/components/tables/` 디렉토리 생성
2. 각 헬퍼 컴포넌트를 개별 파일로 추출
3. `index.js`에서 통합 export
4. `DataTables.jsx`에서 import 경로 변경
5. 테스트: UI 정상 동작 확인

**예상 소요 시간**: 1-2시간
**위험도**: 낮음 (컴포넌트 독립성 높음)

---

### ⭐ 우선순위 3: PageMapping.jsx 컴포넌트 분리

**현재 문제:**
- 단일 파일 1,379줄
- 여러 모달, 드로워, 테이블이 한 파일에

**분리 계획:**

```
frontend/src/
├── components/
│   └── page-mapping/
│       ├── MappingTable.jsx        # 메인 테이블
│       ├── UrlDetailsModal.jsx     # URL 상세 모달
│       ├── ProductMappingDrawer.jsx # 제품 매핑 드로워
│       ├── BulkActionsBar.jsx      # 일괄 작업 바
│       └── index.js
└── pages/
    └── PageMapping.jsx             # 상태 관리 + 통합
```

**예상 소요 시간**: 2시간
**위험도**: 중간

---

### ⭐ 우선순위 4: console.log 정리 (즉시 실행 가능)

**제거 대상: 32개**

#### 백엔드 (23개)

**제거할 디버깅 로그:**
- `track.js`: 186, 207, 224, 407줄
- `mappings.js`: 169, 184, 203, 204, 409, 410, 414, 416줄

**유지할 로그:**
- `server.js`: 서버 시작, DB 연결 로그 (50, 51, 58줄)
- 에러 로깅 (`console.error`)

#### 프론트엔드 (9개)

**제거할 디버깅 로그:**
- `DynamicUtmFilterBar.jsx`: 88, 96, 115, 132, 138, 157줄
- `CreativePerformance.jsx`: 96, 100, 101줄

**실행 단계:**
```bash
# 백엔드
# track.js에서 4개 제거
# mappings.js에서 8개 제거

# 프론트엔드
# DynamicUtmFilterBar.jsx에서 6개 제거
# CreativePerformance.jsx에서 3개 제거
```

**예상 소요 시간**: 15-30분
**위험도**: 없음

---

### ⭐ 우선순위 5: SQL 쿼리 검증 (@data-validation.mdc)

**검증 필요 쿼리:**

#### 1. stats.js의 체류시간 계산

**문제 가능성:**
- 체류시간 상한 (10분) 적용 여부
- 세션 지속시간 상한 (30분) 적용 여부

**검증 방법:**
```sql
-- 서버에서 실행
ssh root@49.50.139.223 'docker exec -i ma-postgres psql -U moadamda -d analytics -c "
  SELECT
    MAX(time_spent_seconds) as max_time_spent,
    AVG(time_spent_seconds) as avg_time_spent
  FROM (
    SELECT
      EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp))) as time_spent_seconds
    FROM pageviews
    WHERE session_id IN (
      SELECT session_id FROM sessions ORDER BY created_at DESC LIMIT 100
    )
    GROUP BY session_id
  ) sub;
"'
```

**예상 소요 시간**: 1시간
**위험도**: 낮음 (읽기 전용 검증)

---

## 📅 권장 실행 일정

### 1단계 (즉시 - 30분)
- [ ] console.log 정리 (우선순위 4)

### 2단계 (이번 주 - 3-4시간)
- [ ] DataTables.jsx 컴포넌트 분리 (우선순위 2)
- [ ] SQL 쿼리 검증 (우선순위 5)

### 3단계 (다음 주 - 4-5시간)
- [ ] stats.js 파일 분리 (우선순위 1)
- [ ] PageMapping.jsx 컴포넌트 분리 (우선순위 3)

---

## 🎯 기대 효과

### 코드 품질
- **파일당 평균 줄 수**: 500줄 이하로 감소
- **유지보수성**: 관련 코드를 빠르게 찾을 수 있음
- **테스트 용이성**: 작은 단위로 테스트 가능

### 개발 생산성
- **신규 기능 추가**: 해당 모듈만 수정하면 됨
- **버그 수정**: 영향 범위가 명확해짐
- **팀 협업**: 파일 충돌 가능성 감소

### 성능
- **번들 크기**: 코드 스플리팅 가능
- **로딩 속도**: 필요한 컴포넌트만 로드

---

## ⚠️ 주의사항

### 리팩토링 전 필수 작업
1. **Git 커밋**: 현재 작동하는 코드 커밋
2. **백업**: 수정할 파일들 백업
3. **테스트 계획**: 리팩토링 후 테스트 시나리오 작성

### 리팩토링 중
1. **한 번에 하나씩**: 여러 파일을 동시에 수정하지 않기
2. **중간 커밋**: 각 단계마다 커밋하여 롤백 가능하게
3. **테스트**: 수정 후 즉시 테스트

### 리팩토링 후
1. **전체 테스트**: 모든 기능 정상 동작 확인
2. **성능 측정**: 로딩 속도 등 성능 저하 없는지 확인
3. **배포**: 스테이징 환경에서 먼저 테스트 후 프로덕션 배포

---

## 📌 빠른 실행 가이드

### 즉시 실행 가능 (console.log 정리)

```bash
# 1. 백엔드 - track.js
# 186, 207, 224, 407줄의 console.log 제거

# 2. 백엔드 - mappings.js
# 169, 184, 203, 204, 409, 410, 414, 416줄의 console.log 제거

# 3. 프론트엔드 - DynamicUtmFilterBar.jsx
# 88, 96, 115, 132, 138, 157줄의 console.log 제거

# 4. 프론트엔드 - CreativePerformance.jsx
# 96, 100, 101줄의 console.log 제거

# 5. 테스트
npm run dev  # 로컬에서 정상 동작 확인

# 6. 커밋
git add .
git commit -m "[Refactor] Remove debugging console.log statements"
```

---

**다음 단계**: 우선순위 4 (console.log 정리)를 먼저 실행하시겠습니까?
