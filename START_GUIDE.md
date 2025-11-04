# 🚀 Moadamda Analytics 시작 가이드

## Phase 1: 기본 추적 시스템 설치 및 테스트

### 1단계: Docker 환경 실행

```bash
# moadamda-analytics 폴더로 이동
cd C:\analysis\moadamda-analytics

# Docker 컨테이너 실행
docker-compose up -d

# 상태 확인 (모두 Up이어야 함)
docker-compose ps
```

예상 출력:
```
NAME            IMAGE                           STATUS
ma-backend      moadamda-analytics-backend     Up
ma-frontend     moadamda-analytics-frontend    Up
ma-postgres     postgres:15-alpine             Up (healthy)
```

### 2단계: API 서버 테스트

```bash
# Windows PowerShell에서
curl http://localhost:3003/health

# 또는 브라우저에서
# http://localhost:3003/health
```

정상 응답 예시:
```json
{"status":"ok","timestamp":"2025-10-15T12:34:56.789Z"}
```

### 3단계: 로컬 테스트 페이지 열기

1. 브라우저에서 열기:
   - `file:///C:/analysis/moadamda-analytics/test/test-page.html`

2. 페이지에서 확인:
   - ✅ "정상 작동" 메시지
   - Visitor ID와 Session ID 표시
   - "API 서버 확인" 버튼 클릭하여 연결 테스트

3. 3분 대기 후 대시보드 확인:
   - http://localhost:3030

### 4단계: 카페24에 설치

#### A. FTP로 파일 업로드

1. FileZilla 또는 카페24 FTP 접속
2. `moadamda-analytics/tracker/build/tracker.js` 파일을
3. 카페24 서버 `/web/tracker.js` 경로로 업로드

#### B. HTML 편집

1. 카페24 관리자 로그인
2. **쇼핑몰 설정** > **디자인 설정** > **HTML 편집**
3. **공통 레이아웃** 선택
4. `<head>` 태그 내부에 다음 코드 추가:

```html
<!-- Moadamda Analytics 추적 코드 -->
<script src="/web/tracker.js" async></script>
```

5. 저장 및 적용

### 5단계: 실제 사이트 테스트

1. **PC에서 테스트:**
   - https://moadamda.com 접속
   - 여러 페이지 클릭 (상품 페이지, 카테고리 등)
   - 3분 대기

2. **모바일에서 테스트:**
   - https://m.moadamda.com 접속
   - 여러 페이지 클릭
   - 3분 대기

3. **대시보드에서 확인:**
   - http://218.238.83.154:3030 접속
   - 방문자 수 증가 확인
   - PC/모바일 비율 확인
   - 실시간 접속자 확인

### 6단계: 데이터베이스 직접 확인 (선택)

```bash
# PostgreSQL 컨테이너 접속
docker exec -it ma-postgres psql -U moadamda -d analytics

# SQL 명령어
SELECT COUNT(*) FROM visitors;  -- 방문자 수
SELECT COUNT(*) FROM pageviews; -- 페이지뷰 수
SELECT * FROM realtime_visitors; -- 실시간 접속자

# 오늘의 통계
SELECT COUNT(DISTINCT visitor_id) as visitors,
       COUNT(*) as pageviews
FROM pageviews 
WHERE timestamp >= CURRENT_DATE;

# 종료
\q
```

### 7단계: 로그 확인

```bash
# Backend 로그 실시간 확인
docker-compose logs -f backend

# 데이터 수신 시 표시되는 로그:
# Track error 없이 정상 처리되면 OK
```

---

## ✅ Phase 1 완료 체크리스트

완료된 항목에 체크하세요:

- [ ] Docker 컨테이너 3개 모두 Up 상태
- [ ] API 서버 health check 통과 (`/health`)
- [ ] 로컬 테스트 페이지에서 추적 스크립트 정상 작동
- [ ] tracker.js 카페24 업로드 완료
- [ ] 카페24 head 태그에 스크립트 삽입 완료
- [ ] 실제 사이트 접속 시 백엔드 로그에 데이터 수신 확인
- [ ] PostgreSQL에 visitors 테이블에 데이터 저장 확인
- [ ] `/api/stats/today` API 호출 시 정상 응답
- [ ] 대시보드(`http://218.238.83.154:3030`)에서 데이터 표시 확인

---

## 🔧 문제 해결

### 문제 1: Docker 컨테이너가 시작되지 않음

```bash
# 컨테이너 중지 및 재시작
docker-compose down
docker-compose up -d --build

# 로그 확인
docker-compose logs
```

### 문제 2: "Cannot connect to database"

```bash
# PostgreSQL 컨테이너 상태 확인
docker-compose ps postgres

# PostgreSQL 로그 확인
docker-compose logs postgres

# 직접 연결 테스트
docker exec -it ma-postgres pg_isready -U moadamda
```

### 문제 3: 포트 충돌 (3003, 3030 이미 사용 중)

```powershell
# Windows에서 포트 사용 중인 프로세스 확인
netstat -ano | findstr :3003
netstat -ano | findstr :3030

# 프로세스 종료 (PID 확인 후)
taskkill /PID <PID번호> /F
```

### 문제 4: 외부에서 접속 안 됨 (218.238.83.154)

1. **Windows 방화벽 확인:**
   - 제어판 > Windows Defender 방화벽 > 고급 설정
   - 인바운드 규칙에 3003, 3030 포트 추가

2. **공유기 포트 포워딩 확인:**
   - 공유기 관리 페이지 접속
   - 포트 포워딩: 3003 → 192.168.0.114:3003
   - 포트 포워딩: 3030 → 192.168.0.114:3030

3. **Docker 네트워크 확인:**
   ```bash
   docker network ls
   docker network inspect moadamda-analytics_default
   ```

### 문제 5: 카페24에서 스크립트 작동 안 함

1. 브라우저 개발자 도구 열기 (F12)
2. Console 탭에서 에러 메시지 확인
3. Network 탭에서 `/web/tracker.js` 로드 확인
4. Mixed Content 에러 발생 시 → 정상 (HTTPS 사이트에서 HTTP 호출)
   - 해결: Beacon API는 Mixed Content 제한 없음

---

## 📊 다음 단계: Phase 2

Phase 1이 완료되면:

1. 모든 체크리스트 항목 완료 확인
2. 24시간 동안 데이터 수집하여 안정성 확인
3. Phase 2 시작: 쇼핑몰 이벤트 추적
   - 장바구니 추가 감지
   - 구매 완료 추적
   - 전환율 계산

---

## 📞 지원

문제가 발생하면:
1. `docker-compose logs` 전체 로그 확인
2. 브라우저 개발자 도구 (F12) Console 탭 확인
3. 이 가이드의 문제 해결 섹션 참조

