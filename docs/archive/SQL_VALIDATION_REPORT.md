# 📊 SQL 쿼리 검증 보고서

**실행일**: 2025-11-18
**검증 대상**: 프로덕션 데이터베이스 (최근 7-30일)
**참고**: `.cursor/rules/data-validation.mdc`

---

## 🎯 검증 요약

### ✅ 정상

- **구매 금액** (conversions): 모든 값이 정상 범위 (22,800원 ~ 248,000원)
- **stats.js order-detail API**: 체류시간 600초 제한 적용됨

### ⚠️ 문제 발견

- **세션 지속시간** (sessions): 최대 27.7시간 비정상 값 발견
- **페이지 체류시간** (pageviews): 최대 13.4시간 비정상 값 발견
- **tables.js API**: 필터링 없이 원시 데이터 반환

---

## 📈 데이터 검증 결과

### 1. Sessions 테이블 - 세션 지속시간

**쿼리 결과 (최근 7일):**

| 항목 | 값 | 상태 |
|------|-----|------|
| 총 세션 수 | 192개 | - |
| 최소 지속시간 | 0초 | ✅ |
| **최대 지속시간** | **99,709초 (27.7시간)** | ❌ 비정상 |
| 평균 지속시간 | 804초 (13.4분) | ⚠️ 약간 높음 |
| 중앙값 | 119초 (2분) | ✅ 정상 |
| 의심 세션 (30분 이상) | 1개 (0.5%) | ⚠️ |
| 비정상 세션 (2시간 이상) | 1개 (0.5%) | ❌ |

**임계값 기준 (data-validation.mdc):**
```
✅ 정상: 1분 ~ 30분 (1,800초)
⚠️ 의심: 30분 ~ 2시간 (7,200초)
❌ 비정상: 2시간 이상 → 필터링 필수
```

**비정상 세션 상세:**

```
session_id: fd8b4aeb-c7a0-4dcb-a059-339ae994d9ea
시작: 2025-11-17 00:00:00
종료: 2025-11-18 03:41:49
지속시간: 99,709초 (27.7시간)
페이지뷰: 43개
구매 여부: 미구매
```

**원인 분석:**
- 사용자가 세션을 종료하지 않고 27시간 이상 유지
- 쿠키가 삭제되지 않아 세션이 계속 연장됨
- 실제로 27시간 동안 활동했을 가능성 거의 없음

---

### 2. Pageviews 테이블 - 체류시간

**쿼리 결과 (최근 7일):**

| 항목 | 값 | 상태 |
|------|-----|------|
| 총 페이지뷰 | 1,130개 | - |
| 최소 체류시간 | 0초 | ✅ |
| **최대 체류시간** | **48,257초 (13.4시간)** | ❌ 비정상 |
| 평균 체류시간 | 137초 (2.3분) | ✅ 정상 |
| 중앙값 | 11초 | ✅ 정상 |
| 의심 (10분 이상) | 32개 (2.8%) | ⚠️ |
| 비정상 (1시간 이상) | 3개 (0.3%) | ❌ |

**임계값 기준 (data-validation.mdc):**
```
✅ 정상: 1초 ~ 10분 (600초)
⚠️ 의심: 10분 ~ 1시간 (3,600초)
❌ 비정상: 1시간 이상 → 필터링 필수
```

**비정상 체류시간 TOP 3 (모두 같은 세션):**

1. **13.4시간** - 상품 페이지 (`/product/특별할인-종합-관리-set/131/`)
2. **3.0시간** - QA 게시판 (`/article/상품-qa/6/9537/`)
3. **2.9시간** - 상품 목록 (`/product/list.html?cate_no=24&page=1`)

**원인 분석:**
- 같은 비정상 세션 (fd8b4aeb-c7a0-4dcb-a059-339ae994d9ea)에서 발생
- 사용자가 페이지를 열어두고 장시간 방치
- 실제로 페이지를 보고 있었을 가능성 거의 없음

---

### 3. Conversions 테이블 - 구매 금액

**쿼리 결과 (최근 30일):**

| 항목 | 값 | 상태 |
|------|-----|------|
| 총 주문 수 | 19개 | - |
| 최소 금액 | 22,800원 | ✅ 정상 |
| 최대 금액 | 248,000원 | ✅ 정상 |
| 평균 금액 | 89,306원 | ✅ 정상 |
| 중앙값 | 59,400원 | ✅ 정상 |
| 의심 (10,000원 미만) | 0개 | ✅ |
| 비정상 (1,000,000원 이상) | 0개 | ✅ |

**임계값 기준 (data-validation.mdc):**
```
✅ 정상: 10,000원 ~ 500,000원
⚠️ 의심: 1원 ~ 10,000원 (테스트 주문)
❌ 비정상: 0원 이하, 1,000,000원 이상
```

**결론:** ✅ 구매 금액 데이터는 모두 정상 범위 내에 있습니다.

---

## 🔍 코드 검증 결과

### 1. stats.js - Order Detail API

**파일:** `backend/src/routes/stats.js:1325-1358`

**purchase_journey 쿼리:**
```sql
CASE
  WHEN next_timestamp IS NOT NULL THEN
    LEAST(
      EXTRACT(EPOCH FROM (next_timestamp - timestamp))::INTEGER,
      600  -- 최대 10분으로 제한
    )
  ELSE 0
END as time_spent_seconds
```

**previous_visits 쿼리:**
```sql
CASE
  WHEN next_timestamp IS NOT NULL THEN
    LEAST(
      EXTRACT(EPOCH FROM (next_timestamp - timestamp))::INTEGER,
      600  -- 최대 10분으로 제한
    )
  ELSE 0
END as time_spent_seconds
```

**평가:** ✅ **정상** - `LEAST(..., 600)` 함수로 체류시간을 10분으로 제한하고 있습니다.

---

### 2. tables.js - Sessions API

**파일:** `backend/src/routes/tables.js:319-341`

**쿼리:**
```sql
SELECT
  s.session_id,
  s.visitor_id,
  s.duration_seconds,  -- 필터링 없이 반환
  ...
FROM sessions s
```

**평가:** ❌ **문제** - `duration_seconds`를 필터링 없이 반환하고 있습니다.
- 비정상 값 (99,709초)이 그대로 프론트엔드로 전달됨
- UI에서 27.7시간으로 표시될 수 있음

---

### 3. OrderAnalysis.jsx - 프론트엔드 검증

**파일:** `frontend/src/pages/OrderAnalysis.jsx:524-530`

**검증 로직:**
```javascript
// 데이터 검증 (백엔드가 제대로 처리했는지 확인)
if (totalSeconds > 3600) {
  console.warn('[데이터 검증] 비정상적으로 긴 총 체류시간:', totalSeconds, '초');
}
const overLimitPages = journeyPages.filter(p => p.time_spent_seconds > 600);
if (overLimitPages.length > 0) {
  console.warn('[데이터 검증] 10분 초과 페이지 발견:', overLimitPages);
}
```

**평가:** ⚠️ **부분적** - 경고만 표시하고 실제 필터링하지 않음
- console.warn만 출력
- 비정상 값이 UI에 그대로 표시됨

---

## 🚨 발견된 문제점 요약

### 1. 세션 지속시간 필터링 누락

**문제:**
- tables.js API에서 `duration_seconds` 필터링 없음
- 비정상 값 (27.7시간)이 프론트엔드로 전달됨

**영향:**
- DataTables.jsx에서 비정상 세션 지속시간 표시
- 통계 왜곡 가능성

**권장 해결책:**
```sql
-- tables.js sessions API 수정
SELECT
  ...
  LEAST(duration_seconds, 7200) as duration_seconds,  -- 최대 2시간
  ...
FROM sessions s
```

---

### 2. 프론트엔드 필터링 미적용

**문제:**
- OrderAnalysis.jsx에서 경고만 표시
- 실제 데이터 필터링하지 않음

**영향:**
- 비정상 체류시간이 UI에 표시됨
- 사용자 혼란 가능성

**권장 해결책:**
```javascript
// OrderAnalysis.jsx 수정
const validJourneyPages = journeyPages.map(page => ({
  ...page,
  time_spent_seconds: Math.min(page.time_spent_seconds || 0, 600)  // 최대 10분
}));

const totalSeconds = validJourneyPages.reduce(
  (sum, p) => sum + p.time_spent_seconds, 0
);
```

---

## 📋 권장 조치사항

### 즉시 조치 (High Priority)

1. **tables.js sessions API 수정**
   - `duration_seconds`에 `LEAST(..., 7200)` 적용
   - 파일: `backend/src/routes/tables.js:326`

2. **OrderAnalysis.jsx 필터링 추가**
   - 체류시간 600초 제한 적용
   - 파일: `frontend/src/pages/OrderAnalysis.jsx:515-530`

### 중기 조치 (Medium Priority)

3. **sessions 테이블 데이터 정리**
   - 비정상 세션 식별 및 플래그 추가
   - duration_seconds > 7200 세션 검토

4. **모니터링 추가**
   - 비정상 세션 발생 시 알림
   - 주기적 데이터 검증 쿼리 실행

---

## ✅ 체크리스트

### 데이터 검증
- [x] sessions 테이블 - 세션 지속시간 확인
- [x] pageviews 테이블 - 체류시간 확인
- [x] conversions 테이블 - 구매 금액 확인

### 코드 검증
- [x] stats.js - Order Detail API 쿼리 확인
- [x] tables.js - Sessions API 쿼리 확인
- [x] OrderAnalysis.jsx - 프론트엔드 검증 로직 확인

### 문제 발견
- [x] 비정상 세션 지속시간 (27.7시간) 발견
- [x] 비정상 체류시간 (13.4시간) 발견
- [x] tables.js 필터링 누락 확인
- [x] 프론트엔드 검증 로직 미흡 확인

---

## 📊 통계 요약

| 데이터 | 정상 비율 | 의심 비율 | 비정상 비율 |
|--------|----------|----------|------------|
| 세션 지속시간 | 99.5% | 0% | 0.5% (1개) |
| 페이지 체류시간 | 97.2% | 2.5% | 0.3% (3개) |
| 구매 금액 | 100% | 0% | 0% |

**전체 평가:** ⚠️ **대부분 정상, 일부 필터링 필요**

---

**보고서 생성일**: 2025-11-18
**검증 데이터 기간**: 2025-11-11 ~ 2025-11-18 (7일)
**참고 문서**: `.cursor/rules/data-validation.mdc`
