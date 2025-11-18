---
name: feature-refactor
description: Cursor에서 개발한 기능을 리팩토링하고 오류를 파악합니다
---

# 기능 리팩토링 Skill

## 목적

Cursor에서 구현한 기능의 코드 품질을 개선하고 잠재적 오류를 찾습니다.
Moadamda Analytics 프로젝트의 패턴과 규칙을 준수하는지 검증합니다.

## 작업 프로세스

### 1. 변경사항 파악

```bash
# Git 상태 확인
git status
git diff

# 최근 커밋 확인
git log -1 --stat
```

**분석 항목:**
- 수정된 파일 목록
- 추가/삭제된 코드 라인
- 변경 패턴 (프론트엔드/백엔드/DB)

### 2. 관련 파일 분석

**의존성 추적:**
- 수정된 파일이 import/require하는 모듈
- 수정된 파일을 사용하는 다른 파일
- API 엔드포인트 변경 시 → 프론트엔드 호출부 확인
- 프론트엔드 변경 시 → 백엔드 API 확인

**Moadamda Analytics 특화 체크:**
- 백엔드 변경 시: `backend/src/routes/*.js` 영향도
- 프론트엔드 변경 시: `frontend/src/pages/*.jsx` 일관성
- DB 관련: `backend/migrations/*.sql` 스키마 확인

### 3. 코드 리뷰 체크리스트

#### 백엔드 (Node.js/Express)

**✅ API 응답 형식**
```javascript
// ✅ 올바른 형식
res.json({ data: [...], summary: {...} });

// ❌ 잘못된 형식
res.send(data);
```

**✅ 에러 핸들링**
```javascript
// ✅ 올바른 에러 처리
try {
  const result = await db.query(...);
  res.json({ data: result.rows });
} catch (error) {
  console.error('Error:', error);
  res.status(500).json({ error: 'Database error' });
}

// ❌ 에러 처리 없음
const result = await db.query(...);
res.json(result.rows);
```

**✅ SQL 쿼리 검증** (필수!)
- @data-validation.mdc 참조
- 실제 프로덕션 데이터로 테스트
- 합리성 체크:
  - 체류시간: 0-600초 (10분 상한)
  - 세션 지속시간: 1-30분
  - 구매 금액: 10,000-500,000원

```sql
-- ✅ 안전한 쿼리 (WITH 절 사용)
WITH validated_data AS (
  SELECT *,
    CASE
      WHEN time_spent > 600 THEN 600  -- 10분 상한
      ELSE time_spent
    END as safe_time_spent
  FROM sessions
  WHERE time_spent > 0
)
SELECT AVG(safe_time_spent) FROM validated_data;

-- ❌ 검증 없는 쿼리
SELECT AVG(time_spent) FROM sessions;
```

#### 프론트엔드 (React)

**✅ 디자인 가이드라인**
```jsx
// ✅ Ant Design 아이콘 사용
<Button icon={<ReloadOutlined />}>새로고침</Button>

// ❌ 이모지 사용 금지
<Button>🔄 새로고침</Button>
```

**✅ 컬러 팔레트**
- Primary: `#1890ff` (파란색)
- Success: `#52c41a` (초록색)
- Warning: `#fa8c16` (주황색)
- Error: `#f5222d` (빨간색)
- 금액 > 0: 굵게, 파란색/초록색
- 금액 = 0: 회색 (#999)

**✅ API 호출**
```javascript
// ✅ 올바른 API 호출
const API_BASE = import.meta.env.DEV
  ? 'http://localhost:3003'
  : '';

const response = await axios.get(`${API_BASE}/api/stats/today`);

// ❌ 하드코딩된 URL
const response = await axios.get('http://localhost:3003/api/stats/today');
```

**✅ 데이터 검증**
```javascript
// ✅ 프론트엔드 필터링
const validPagePaths = data.page_path.filter(p =>
  p.time_spent_seconds > 0 &&
  p.time_spent_seconds <= 600  // 10분 제한
);

// ❌ 검증 없이 사용
const totalTime = data.page_path.reduce((sum, p) => sum + p.time_spent_seconds, 0);
```

### 4. 리팩토링 제안

**코드 중복 제거**
- 3회 이상 반복되는 로직 → 유틸리티 함수화
- 비슷한 컴포넌트 → 공통 컴포넌트 추출

**네이밍 개선**
- 변수명: 명확하고 설명적으로
- 함수명: 동사 + 명사 (예: `fetchOrderData`, `validateTimeSpent`)
- 컴포넌트명: PascalCase (예: `OrderAnalysisCard`)

**성능 최적화**
- 불필요한 useEffect 제거
- React.memo 활용
- DB 쿼리 인덱스 활용

### 5. 잠재적 오류 탐지

**필수 체크 항목:**
- [ ] Null/undefined 처리
- [ ] 빈 배열/객체 처리
- [ ] 비동기 에러 핸들링
- [ ] Race condition 가능성
- [ ] 메모리 누수 (이벤트 리스너 정리)
- [ ] SQL Injection 방지 (파라미터화된 쿼리)
- [ ] XSS 방지 (사용자 입력 검증)

### 6. 데이터 검증 (SQL이 있는 경우)

**⏸️ 작업 일시정지 → 프로덕션 데이터 테스트**

```bash
# 서버에서 쿼리 테스트
ssh root@49.50.139.223 'docker exec -i ma-postgres psql -U moadamda -d analytics -c "
  [작성한 쿼리]
"'
```

**검증 항목:**
- 결과가 도메인 상식에 맞는가?
- 예상 데이터 범위 내에 있는가?
- NULL이 예상치 못한 곳에 있는가?
- COUNT가 기대와 일치하는가?

### 7. 리포트 생성

**리팩토링 요약:**
```markdown
## 리팩토링 결과

### 변경 파일
- `backend/src/routes/stats.js` - 쿼리 최적화
- `frontend/src/pages/OrderAnalysis.jsx` - 컴포넌트 분리

### 개선 사항
1. SQL 쿼리 WITH 절로 재구성 → 가독성 향상
2. 체류시간 10분 상한 필터 추가 → 데이터 신뢰성 향상
3. 중복 코드 3곳 → 유틸 함수 1개로 통합

### 발견된 이슈
- ⚠️ 시간 검증 로직 누락 (수정 완료)
- ⚠️ 에러 핸들링 미흡 (try-catch 추가)

### 테스트 권장
- [ ] localhost:3030에서 수정된 페이지 동작 확인
- [ ] API 응답 형식 검증
- [ ] 엣지 케이스 테스트 (빈 데이터, 오류 상황)
```

## 사용 예시

### 예시 1: OrderAnalysis.jsx 수정 후

```
@feature-refactor

방금 Cursor에서 OrderAnalysis.jsx에 날짜 필터 기능을 추가했어.
관련된 모든 코드를 리뷰하고 리팩토링해줘.

수정 내용:
- DatePicker 컴포넌트 추가
- API 호출에 날짜 파라미터 추가
- 백엔드 stats.js에 날짜 필터링 로직 추가
```

### 예시 2: 백엔드 API 추가 후

```
@feature-refactor

stats.js에 /api/stats/revenue-by-utm 엔드포인트를 추가했어.
SQL 쿼리가 포함되어 있으니 데이터 검증도 필요해.
```

## 체크리스트

### 코드 분석
- [ ] Git 변경사항 확인
- [ ] 영향받는 파일 분석
- [ ] 의존성 추적

### 코드 리뷰
- [ ] API 응답 형식 검증
- [ ] 에러 핸들링 확인
- [ ] 디자인 가이드라인 준수
- [ ] 네이밍 컨벤션 확인

### 데이터 검증 (SQL 포함 시)
- [ ] 프로덕션 DB로 쿼리 테스트
- [ ] 결과 합리성 검사
- [ ] 도메인 임계값 적용

### 리팩토링
- [ ] 코드 중복 제거
- [ ] 네이밍 개선
- [ ] 성능 최적화 기회

### 오류 탐지
- [ ] Null/undefined 처리
- [ ] 보안 취약점 확인
- [ ] 메모리 누수 가능성

### 최종 리포트
- [ ] 변경 파일 목록
- [ ] 개선 사항 요약
- [ ] 발견된 이슈
- [ ] 테스트 권장사항
