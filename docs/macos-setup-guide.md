# 🍎 macOS 환경 설정 가이드

> Moadamda Analytics를 macOS에서 개발하고 Supabase + Vercel로 배포하기

---

## 📋 준비물

### 필수 설치 항목
- ✅ **Git** (코드 관리)
- ✅ **Node.js 18+** (백엔드/프론트엔드)
- ✅ **Docker Desktop** (로컬 개발)
- ✅ **Supabase 계정** (데이터베이스)
- ✅ **Vercel 계정** (배포)
- ✅ **GitHub 계정** (코드 저장소)

---

## 🚀 1단계: 기본 환경 설치

### 1-1. Homebrew 설치 (패키지 관리자)
```bash
# 터미널에서 실행
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 1-2. Git 설치
```bash
brew install git

# 설치 확인
git --version
```

### 1-3. Node.js 설치
```bash
brew install node@18

# 설치 확인
node --version  # v18 이상이어야 함
npm --version
```

### 1-4. Docker Desktop 설치
1. https://www.docker.com/products/docker-desktop 접속
2. "Download for Mac" 클릭 (Apple Silicon 또는 Intel 선택)
3. 다운로드한 .dmg 파일 실행하여 설치
4. Docker Desktop 실행 후 로그인

```bash
# 설치 확인
docker --version
docker-compose --version
```

---

## 📦 2단계: 프로젝트 Clone

```bash
# 1. 작업할 디렉토리로 이동
cd ~/Documents  # 또는 원하는 경로

# 2. GitHub에서 프로젝트 Clone
git clone https://github.com/hongkimwork/moadamda-analytics.git
cd moadamda-analytics

# 3. 브랜치 확인
git branch
# * main (또는 master)
```

---

## 🗄️ 3단계: Supabase 데이터베이스 설정

### 3-1. Supabase 프로젝트 생성

1. **https://supabase.com** 접속
2. "Start your project" 클릭
3. GitHub 계정으로 로그인
4. "New project" 클릭
5. 프로젝트 설정:
   - Name: `moadamda-analytics` (또는 원하는 이름)
   - Database Password: 강력한 비밀번호 생성 (저장해두기!)
   - Region: `Northeast Asia (Seoul)` 선택 (한국 서버)
   - Plan: `Free` 선택

### 3-2. 데이터베이스 연결 정보 확인

1. 생성된 프로젝트 클릭
2. 좌측 메뉴 **Settings** > **Database** 클릭
3. "Connection string" 섹션에서 **Connection pooling** 탭 선택
4. 다음 정보 복사:
   ```
   Host: db.xxxxxxxxxxxxx.supabase.co
   Port: 5432
   Database: postgres
   User: postgres
   Password: [생성 시 입력한 비밀번호]
   ```

### 3-3. 데이터베이스 초기화 (마이그레이션 실행)

1. Supabase Dashboard에서 **SQL Editor** 클릭
2. 다음 파일들을 **순서대로** 열어서 내용 복사 → SQL Editor에 붙여넣기 → "Run" 클릭:

```
순서  파일명
────────────────────────────────────────────────────
1     backend/migrations/init.sql
2     backend/migrations/create_url_mappings.sql
3     backend/migrations/add_excluded_flag.sql
4     backend/migrations/add_source_type.sql
5     backend/migrations/add_url_conditions.sql
6     backend/migrations/add_utm_sessions.sql
7     backend/migrations/add_payment_details.sql
8     backend/migrations/add_ip_tracking.sql
9     backend/migrations/create_ad_spend_simple.sql
10    backend/migrations/add_order_status.sql
11    backend/migrations/add_cafe24_token.sql
12    backend/migrations/add_dynamic_utm_params.sql
```

**✅ 확인 방법**:
- 좌측 메뉴 **Table Editor** 클릭
- 다음 테이블들이 생성되어 있는지 확인:
  - visitors
  - sessions
  - pageviews
  - events
  - conversions
  - url_mappings
  - utm_sessions
  - ad_spend
  - cafe24_token
  - realtime_visitors

---

## 🔧 4단계: 로컬 환경 설정

### 4-1. 환경 파일 생성

```bash
# backend/.env.local 파일 생성
cd ~/Documents/moadamda-analytics/backend

# 파일 생성 (텍스트 에디터로)
nano .env.local
```

**파일 내용** (Supabase 정보 입력):
```bash
DB_HOST=db.xxxxxxxxxxxxx.supabase.co
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_supabase_password_here
DB_NAME=postgres
```

**저장 방법** (nano 에디터):
- `Ctrl + O` → Enter (저장)
- `Ctrl + X` (종료)

### 4-2. 패키지 설치

```bash
# 백엔드 패키지 설치
cd ~/Documents/moadamda-analytics/backend
npm install

# 프론트엔드 패키지 설치
cd ~/Documents/moadamda-analytics/frontend
npm install
```

---

## ▶️ 5단계: 로컬 실행

### 방법 A: Docker 사용 (추천)

```bash
# 프로젝트 루트 디렉토리에서
cd ~/Documents/moadamda-analytics

# Docker로 전체 실행
docker-compose up -d

# 로그 확인
docker-compose logs -f

# 브라우저에서 접속
# http://localhost:3030
```

**중지 방법**:
```bash
docker-compose down
```

### 방법 B: 직접 실행

**터미널 1** (백엔드):
```bash
cd ~/Documents/moadamda-analytics/backend
node src/server.js

# 출력: "Moadamda Analytics Backend running on port 3003"
```

**터미널 2** (프론트엔드):
```bash
cd ~/Documents/moadamda-analytics/frontend
npm run dev

# 출력: "Local: http://localhost:3030"
```

**브라우저에서 접속**:
```
http://localhost:3030
```

---

## 🚀 6단계: Vercel 배포

### 6-1. Vercel CLI 설치

```bash
npm install -g vercel

# 설치 확인
vercel --version
```

### 6-2. Vercel 로그인

```bash
vercel login

# 브라우저가 열리면 GitHub 계정으로 로그인
```

### 6-3. 프로젝트 배포

```bash
cd ~/Documents/moadamda-analytics

# 프로젝트 연결 (최초 1회)
vercel link

# 질문에 답변:
# ? Set up and deploy? Yes
# ? Which scope? [Your GitHub username]
# ? Link to existing project? No
# ? What's your project's name? moadamda-analytics
# ? In which directory is your code located? ./
```

### 6-4. 환경 변수 설정

**Vercel Dashboard에서 설정** (추천):
1. https://vercel.com 접속
2. 프로젝트 클릭
3. **Settings** > **Environment Variables** 클릭
4. 다음 변수 추가:

| Key | Value | Environment |
|-----|-------|-------------|
| `DB_HOST` | `db.xxxxx.supabase.co` | Production |
| `DB_PORT` | `5432` | Production |
| `DB_USER` | `postgres` | Production |
| `DB_PASSWORD` | `[Supabase 비밀번호]` | Production |
| `DB_NAME` | `postgres` | Production |

**또는 CLI로 설정**:
```bash
vercel env add DB_HOST
# 값 입력: db.xxxxx.supabase.co
# Environment: Production

vercel env add DB_PORT
# 값 입력: 5432

vercel env add DB_USER
# 값 입력: postgres

vercel env add DB_PASSWORD
# 값 입력: [Supabase 비밀번호]

vercel env add DB_NAME
# 값 입력: postgres
```

### 6-5. 프로덕션 배포

```bash
vercel --prod

# 배포 완료 후 URL 출력:
# ✅ Production: https://moadamda-analytics-xxxxx.vercel.app
```

---

## 🔄 7단계: 개발 워크플로우

### 일상적인 개발 작업

```bash
# 1. 최신 코드 받기
git pull origin main

# 2. 로컬 개발 서버 실행
docker-compose up -d
# 또는
# 터미널 1: cd backend && node src/server.js
# 터미널 2: cd frontend && npm run dev

# 3. 코드 수정 작업

# 4. 변경사항 커밋
git add .
git commit -m "작업 내용 요약"

# 5. GitHub에 Push
git push origin main

# 6. Vercel 자동 배포 (GitHub 연동 시 자동)
# 또는 수동 배포:
vercel --prod
```

### GitHub와 Vercel 자동 연동 (선택)

1. Vercel Dashboard > 프로젝트 > **Settings** > **Git**
2. "Connect Git Repository" 클릭
3. GitHub 저장소 선택: `hongkimwork/moadamda-analytics`
4. 연결 후:
   - `main` 브랜치에 Push하면 자동으로 프로덕션 배포
   - 다른 브랜치 Push 시 Preview 배포

---

## 🔍 8단계: 트러블슈팅

### 문제 1: Docker 실행 안 됨
```bash
# Docker Desktop이 실행 중인지 확인
# Spotlight 검색 (Cmd + Space) → "Docker" 입력 → Docker Desktop 실행

# 컨테이너 상태 확인
docker ps

# 컨테이너 재시작
docker-compose restart
```

### 문제 2: 포트 충돌 (Port already in use)
```bash
# 포트 사용 중인 프로세스 찾기
lsof -ti:3003  # 백엔드 포트
lsof -ti:3030  # 프론트엔드 포트

# 프로세스 종료 (PID 확인 후)
kill -9 [PID]

# 또는 Docker 재시작
docker-compose down
docker-compose up -d
```

### 문제 3: Supabase 연결 안 됨
```bash
# .env.local 파일 확인
cat backend/.env.local

# DB_HOST가 올바른지 확인 (Supabase Dashboard > Settings > Database)
# 방화벽 확인 (Supabase는 기본적으로 모든 IP 허용)

# 연결 테스트
cd backend
node -e "require('./src/config/database').query('SELECT NOW()')"
```

### 문제 4: npm install 실패
```bash
# Node.js 버전 확인
node --version  # v18 이상이어야 함

# npm 캐시 정리
npm cache clean --force

# 재설치
rm -rf node_modules package-lock.json
npm install
```

### 문제 5: Vercel 배포 실패
```bash
# 환경 변수 확인
vercel env ls

# 배포 로그 확인
vercel logs [deployment-url]

# 로컬에서 빌드 테스트
cd frontend
npm run build  # 빌드 에러 확인
```

---

## 📚 유용한 명령어 모음

### Git 관련
```bash
# 현재 상태 확인
git status

# 변경사항 취소
git checkout .

# 브랜치 생성
git checkout -b feature/new-feature

# 브랜치 병합
git checkout main
git merge feature/new-feature
```

### Docker 관련
```bash
# 컨테이너 목록
docker ps

# 로그 보기
docker-compose logs -f backend
docker-compose logs -f frontend

# 컨테이너 재시작
docker-compose restart backend

# 전체 정지 및 삭제
docker-compose down -v
```

### Vercel 관련
```bash
# 프로젝트 목록
vercel list

# 배포 목록
vercel ls

# 환경 변수 목록
vercel env ls

# 로그 보기
vercel logs
```

---

## 🎯 체크리스트

### 최초 설정 완료 확인
- [ ] Homebrew 설치됨
- [ ] Git 설치됨
- [ ] Node.js v18+ 설치됨
- [ ] Docker Desktop 실행 중
- [ ] Supabase 프로젝트 생성됨
- [ ] 마이그레이션 12개 실행 완료
- [ ] backend/.env.local 파일 생성됨
- [ ] 로컬 서버 실행 성공 (http://localhost:3030)
- [ ] Vercel 계정 생성됨
- [ ] Vercel 배포 성공

---

**작성**: 2025-11-13  
**업데이트**: Supabase + Vercel 환경 기준  
**대상**: macOS 사용자

