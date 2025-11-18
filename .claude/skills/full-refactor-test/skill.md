---
name: full-refactor-test
description: 전체 프로젝트 리팩토링 후 Playwright E2E 테스트를 진행합니다
---

# 전체 리팩토링 + E2E 테스트 Skill

## 목적

프로젝트 전체 코드베이스를 체계적으로 리팩토링하고, Playwright MCP를 사용하여 E2E 테스트로 검증합니다.

## 작업 프로세스

### Phase 1: 코드베이스 분석

#### 1.1 프로젝트 구조 파악

```bash
# 전체 파일 트리
find . -type f -not -path "*/node_modules/*" -not -path "*/.git/*" | head -50

# 파일 개수 통계
echo "백엔드:" && find backend/src -name "*.js" | wc -l
echo "프론트엔드:" && find frontend/src -name "*.jsx" | wc -l
echo "테이블:" && find backend/migrations -name "*.sql" | wc -l
```

**분석 항목:**
- 디렉토리 구조
- 파일 개수 및 크기
- 주요 엔트리 포인트
- 의존성 관계

#### 1.2 아키텍처 리뷰

**백엔드 (Node.js/Express)**
- 라우팅 구조: `backend/src/routes/`
  - track.js - 데이터 수집
  - stats.js - 분석 데이터 API
  - tables.js - 원본 데이터 뷰
  - mappings.js - URL/상품 매핑
  - creative-performance.js - 광고 소재 분석

**프론트엔드 (React)**
- 페이지 구조: `frontend/src/pages/`
  - App.jsx - 메인 대시보드
  - DataTables.jsx - 데이터 테이블
  - CreativePerformance.jsx - 광고 분석
  - OrderAnalysis.jsx - 고객 여정
  - PageMapping.jsx - URL 매핑

**데이터베이스 (PostgreSQL)**
- 핵심 테이블: `backend/migrations/init.sql`
  - visitors, sessions, pageviews
  - events, conversions
  - utm_sessions
  - realtime_visitors

#### 1.3 코드 품질 메트릭

**분석 항목:**
```bash
# 파일 크기 (500줄 이상은 분리 고려)
find backend/src -name "*.js" -exec wc -l {} + | sort -n -r | head -10
find frontend/src -name "*.jsx" -exec wc -l {} + | sort -n -r | head -10

# TODO/FIXME 주석
grep -r "TODO\|FIXME" backend/src frontend/src

# console.log (프로덕션 코드에서 제거 필요)
grep -r "console.log" backend/src frontend/src
```

**체크리스트:**
- [ ] 500줄 이상 파일 → 분리 필요
- [ ] TODO/FIXME → 해결 또는 이슈 등록
- [ ] console.log → 적절한 로깅으로 교체
- [ ] 중복 코드 → 유틸리티화
- [ ] 순환 의존성 → 제거

### Phase 2: 리팩토링 실행

#### 2.1 백엔드 리팩토링

**우선순위 1: SQL 쿼리 최적화**

@data-validation.mdc 참조하여 모든 쿼리 검증

```sql
-- ✅ 리팩토링된 쿼리 패턴
WITH validated_sessions AS (
  SELECT
    session_id,
    LEAST(duration, 1800) as safe_duration,  -- 30분 상한
    LEAST(time_spent, 600) as safe_time_spent  -- 10분 상한
  FROM sessions
  WHERE duration > 0
    AND time_spent > 0
),
aggregated_data AS (
  SELECT
    DATE(created_at) as date,
    COUNT(*) as session_count,
    AVG(safe_duration) as avg_duration,
    AVG(safe_time_spent) as avg_time_spent
  FROM validated_sessions
  GROUP BY DATE(created_at)
)
SELECT * FROM aggregated_data
ORDER BY date DESC;
```

**우선순위 2: 에러 핸들링 통일**

```javascript
// ✅ 표준 에러 핸들링 패턴
async function fetchStats(req, res) {
  try {
    const result = await db.query(VALIDATED_QUERY);

    if (!result.rows || result.rows.length === 0) {
      return res.json({ data: [], summary: {} });
    }

    res.json({
      data: result.rows,
      summary: calculateSummary(result.rows)
    });
  } catch (error) {
    console.error('Error in fetchStats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

**우선순위 3: 중복 코드 유틸리티화**

```javascript
// backend/src/utils/queryHelpers.js
function validateTimeSpent(seconds) {
  return Math.min(Math.max(seconds, 0), 600); // 0-600초
}

function validateSessionDuration(seconds) {
  return Math.min(Math.max(seconds, 0), 1800); // 0-30분
}

function buildDateFilter(startDate, endDate) {
  return `timestamp >= '${startDate}' AND timestamp < '${endDate}'`;
}
```

#### 2.2 프론트엔드 리팩토링

**우선순위 1: 컴포넌트 분리 (500줄 이상)**

```jsx
// ❌ Before: OrderAnalysis.jsx (800줄)
function OrderAnalysis() {
  // 모든 로직이 한 파일에...
}

// ✅ After: 컴포넌트 분리
// OrderAnalysis.jsx (300줄)
import OrderFilters from './components/OrderFilters';
import CustomerJourneyCard from './components/CustomerJourneyCard';
import UTMHistoryTable from './components/UTMHistoryTable';

function OrderAnalysis() {
  return (
    <>
      <OrderFilters onFilterChange={handleFilter} />
      <CustomerJourneyCard data={orderData} />
      <UTMHistoryTable sessions={utmSessions} />
    </>
  );
}
```

**우선순위 2: 커스텀 훅 추출**

```javascript
// frontend/src/hooks/useOrderData.js
function useOrderData(orderId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchOrderData(orderId)
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [orderId]);

  return { data, loading, error };
}
```

**우선순위 3: 디자인 시스템 일관성**

@design-guidelines.mdc 준수

```jsx
// ✅ 통일된 스타일 패턴
const styles = {
  primary: '#1890ff',
  success: '#52c41a',
  warning: '#fa8c16',
  error: '#f5222d',
  positiveAmount: { fontWeight: 'bold', color: '#52c41a' },
  zeroAmount: { color: '#999' }
};
```

#### 2.3 공통 리팩토링

**네이밍 컨벤션 통일**
- 파일명: kebab-case (예: `order-analysis.jsx`)
- 컴포넌트명: PascalCase (예: `OrderAnalysis`)
- 함수/변수명: camelCase (예: `fetchOrderData`)
- 상수명: UPPER_SNAKE_CASE (예: `API_BASE_URL`)

**주석 정리**
- JSDoc 형식 사용
- 복잡한 로직에만 주석 추가
- 명확한 코드는 주석 불필요

**사용하지 않는 코드 제거**
- 미사용 import 제거
- 주석 처리된 코드 삭제
- 미사용 함수/변수 제거

### Phase 3: E2E 테스트 (Playwright MCP)

#### 3.1 테스트 환경 설정

**로컬 서버 실행 확인**
```bash
# 백엔드
lsof -i :3003

# 프론트엔드
lsof -i :3030
```

서버가 실행 중이 아니면:
```bash
# 터미널 1
cd backend && npm run dev

# 터미널 2
cd frontend && npm run dev
```

#### 3.2 테스트 시나리오 작성

**핵심 사용자 플로우**

1. **메인 대시보드 로드**
   - URL: http://localhost:3030
   - 검증: 주요 메트릭 카드 표시
   - 검증: 차트 렌더링
   - 검증: UTM 성과 테이블

2. **주문 분석 페이지**
   - URL: http://localhost:3030 → "주문 분석" 클릭
   - 검증: 주문 번호 입력 필드
   - 검증: 고객 여정 카드
   - 검증: UTM 히스토리

3. **페이지 매핑 관리**
   - URL: http://localhost:3030 → "페이지 매핑" 클릭
   - 검증: URL 목록 테이블
   - 검증: 필터 드롭다운
   - 검증: 수동 추가 버튼

4. **데이터 테이블**
   - URL: http://localhost:3030 → "데이터 테이블" 클릭
   - 검증: 탭 전환
   - 검증: 테이블 렌더링
   - 검증: 페이지네이션

#### 3.3 Playwright 테스트 실행

**테스트 코드 예시**

```javascript
// tests/e2e/dashboard.spec.js
import { test, expect } from '@playwright/test';

test.describe('메인 대시보드', () => {
  test('대시보드 로드 및 주요 메트릭 표시', async ({ page }) => {
    await page.goto('http://localhost:3030');

    // 페이지 제목 확인
    await expect(page).toHaveTitle(/Moadamda Analytics/);

    // 주요 메트릭 카드 확인
    await expect(page.locator('text=오늘 방문자')).toBeVisible();
    await expect(page.locator('text=총 매출')).toBeVisible();
    await expect(page.locator('text=전환율')).toBeVisible();

    // UTM 성과 테이블 확인
    await expect(page.locator('text=광고 성과')).toBeVisible();
  });

  test('날짜 필터 동작', async ({ page }) => {
    await page.goto('http://localhost:3030');

    // DatePicker 클릭
    await page.click('.ant-picker');

    // 오늘 날짜 선택
    await page.click('.ant-picker-cell-today');

    // 데이터 로딩 대기
    await page.waitForTimeout(1000);

    // 메트릭 업데이트 확인
    const visitorCount = await page.locator('text=오늘 방문자').locator('..').locator('.ant-statistic-content-value');
    await expect(visitorCount).not.toBeEmpty();
  });
});

test.describe('주문 분석', () => {
  test('주문 번호 검색 및 여정 표시', async ({ page }) => {
    await page.goto('http://localhost:3030');

    // 주문 분석 메뉴 클릭
    await page.click('text=주문 분석');

    // URL 확인
    await expect(page).toHaveURL(/order-analysis/);

    // 주문 번호 입력
    await page.fill('input[placeholder*="주문번호"]', '20241118-0001');

    // 검색 버튼 클릭
    await page.click('button:has-text("검색")');

    // 로딩 대기
    await page.waitForSelector('.customer-journey-card', { timeout: 5000 });

    // 고객 여정 카드 확인
    await expect(page.locator('text=구매 완료')).toBeVisible();
    await expect(page.locator('text=페이지 경로')).toBeVisible();
  });
});

test.describe('페이지 매핑', () => {
  test('URL 목록 표시 및 필터링', async ({ page }) => {
    await page.goto('http://localhost:3030');

    // 페이지 매핑 메뉴 클릭
    await page.click('text=페이지 매핑');

    // 테이블 로딩 대기
    await page.waitForSelector('.ant-table', { timeout: 5000 });

    // 필터 드롭다운 확인
    await expect(page.locator('text=매핑 상태')).toBeVisible();

    // 미매핑 필터 선택
    await page.click('text=매핑 상태');
    await page.click('text=미매핑');

    // 테이블 업데이트 대기
    await page.waitForTimeout(1000);

    // 결과 확인
    const rows = await page.locator('.ant-table-tbody tr');
    expect(await rows.count()).toBeGreaterThan(0);
  });
});
```

**MCP를 통한 테스트 실행**

```bash
# Playwright MCP 사용
# Claude Code가 자동으로 MCP를 통해 테스트 실행
```

#### 3.4 테스트 결과 분석

**수집 데이터:**
- 통과/실패 테스트 개수
- 실패 원인 (스크린샷, 에러 로그)
- 페이지 로딩 시간
- API 응답 시간
- 메모리 사용량

**성능 메트릭:**
```javascript
test('대시보드 성능 측정', async ({ page }) => {
  const startTime = Date.now();

  await page.goto('http://localhost:3030');
  await page.waitForLoadState('networkidle');

  const loadTime = Date.now() - startTime;

  // 3초 이내 로딩
  expect(loadTime).toBeLessThan(3000);

  console.log(`대시보드 로딩 시간: ${loadTime}ms`);
});
```

### Phase 4: 리포트 및 배포 준비

#### 4.1 리팩토링 요약

```markdown
## 전체 리팩토링 결과

### 📊 통계
- 수정된 파일: 23개
- 추가된 코드: +458줄
- 제거된 코드: -892줄
- 순 감소: -434줄 (32.7% 감소)

### ✅ 개선 사항

#### 백엔드
- SQL 쿼리 15개 → WITH 절로 재구성
- 에러 핸들링 통일 (표준 패턴 적용)
- 중복 코드 제거 → utils/ 디렉토리 생성
- 데이터 검증 로직 강화 (10분/30분 상한)

#### 프론트엔드
- 컴포넌트 분리: 3개 파일 → 12개 파일
- 커스텀 훅 추출: 5개
- 디자인 시스템 일관성 확보
- console.log 제거 (프로덕션 코드)

#### 공통
- 네이밍 컨벤션 통일
- 미사용 코드 제거: 12개 파일
- JSDoc 주석 추가
- TODO 해결: 8개 → 0개
```

#### 4.2 테스트 결과

```markdown
## E2E 테스트 결과

### 📈 테스트 통계
- 총 테스트: 12개
- 통과: 11개 ✅
- 실패: 1개 ❌
- 건너뜀: 0개
- 성공률: 91.7%

### 실패한 테스트
❌ `주문 분석 > 주문 번호 검색 및 여정 표시`
- 원인: 타임아웃 (API 응답 지연)
- 해결: stats.js 쿼리 최적화 필요

### 성능 메트릭
- 대시보드 로딩: 1.2초 ✅
- 주문 분석 로딩: 2.8초 ✅
- 페이지 매핑 로딩: 4.5초 ⚠️ (최적화 필요)
```

#### 4.3 배포 준비

**변경사항 커밋**
```bash
git add .
git commit -m "[Refactor] 전체 코드베이스 리팩토링 및 E2E 테스트

- 백엔드: SQL 쿼리 최적화, 에러 핸들링 통일
- 프론트엔드: 컴포넌트 분리, 커스텀 훅 추출
- 테스트: E2E 테스트 12개 추가 (11개 통과)
- 코드 감소: -434줄 (32.7%)
"
```

**배포 체크리스트**
- [ ] 모든 테스트 통과 (또는 실패 원인 파악)
- [ ] @data-validation.mdc 검증 완료
- [ ] PROJECT_STATUS.md 업데이트
- [ ] CLAUDE.md 업데이트 (필요 시)
- [ ] 배포 전 로컬 테스트

**배포 실행**

사용자 승인 후:
```bash
@deploy.mdc
main 브랜치를 서버에 배포해줘
```

## 사용 예시

### 예시 1: 정기 리팩토링

```
@full-refactor-test

한 달간 개발한 내용을 정리하고 싶어.
전체 프로젝트를 리팩토링하고 E2E 테스트로 검증해줘.
```

### 예시 2: 배포 전 점검

```
@full-refactor-test

이번 주 금요일 배포 예정이야.
전체 코드를 점검하고 테스트 통과 여부를 확인해줘.
```

### 예시 3: 성능 개선

```
@full-refactor-test

대시보드 로딩이 느려진 것 같아.
전체 코드를 분석하고 성능 개선 포인트를 찾아줘.
E2E 테스트로 개선 전/후를 비교해줘.
```

## 체크리스트

### Phase 1: 분석
- [ ] 프로젝트 구조 파악
- [ ] 아키텍처 리뷰
- [ ] 코드 품질 메트릭

### Phase 2: 리팩토링
- [ ] 백엔드 SQL 쿼리 최적화
- [ ] 백엔드 에러 핸들링 통일
- [ ] 백엔드 중복 코드 제거
- [ ] 프론트엔드 컴포넌트 분리
- [ ] 프론트엔드 커스텀 훅 추출
- [ ] 디자인 시스템 일관성
- [ ] 네이밍 컨벤션 통일
- [ ] 미사용 코드 제거

### Phase 3: E2E 테스트
- [ ] 테스트 환경 설정
- [ ] 테스트 시나리오 작성
- [ ] Playwright 테스트 실행
- [ ] 결과 분석

### Phase 4: 리포트
- [ ] 리팩토링 요약
- [ ] 테스트 결과
- [ ] 배포 준비
