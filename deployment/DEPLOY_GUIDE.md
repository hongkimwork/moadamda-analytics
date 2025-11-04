# 🚀 Moadamda Analytics - 네이버 클라우드 배포 가이드

## 📋 서버 정보

```
서버 이름: moadamda-analytics
공인 IP: 211.188.53.220
OS: Ubuntu 24.04
사양: vCPU 2EA, Memory 8GB, SSD 50GB
위치: 네이버 클라우드 플랫폼 (한국 리전)
```

---

## 🎯 배포 프로세스

### Phase 1: 네이버 클라우드 설정 ✅ 완료
- [x] 서버 생성
- [x] 공인 IP 할당 (211.188.53.220)
- [x] ACG(방화벽) 규칙 설정

### Phase 2: 서버 초기 설정
- [ ] SSH 접속
- [ ] Docker 설치
- [ ] Docker Compose 설치
- [ ] Git 설치

### Phase 3: 프로젝트 배포
- [ ] 프로젝트 파일 업로드
- [ ] 환경 변수 설정
- [ ] Docker 빌드 및 실행
- [ ] 서비스 확인

### Phase 4: 트래커 업데이트
- [ ] 트래커 스크립트 URL 변경
- [ ] 카페24 FTP 업로드

---

## 📦 Phase 2: 서버 초기 설정

### 1. SSH 접속

**Windows (PowerShell):**
```powershell
# 인증키 파일 권한 설정 (처음 한 번만)
icacls C:\Users\HOTSELLER\Downloads\moadamda-key.pem /inheritance:r
icacls C:\Users\HOTSELLER\Downloads\moadamda-key.pem /grant:r "%USERNAME%:R"

# SSH 접속
ssh -i C:\Users\HOTSELLER\Downloads\moadamda-key.pem root@211.188.53.220
```

**처음 접속 시:**
- "Are you sure you want to continue connecting?" → `yes` 입력

### 2. 서버 초기 설정 스크립트 실행

서버 접속 후:
```bash
# 설정 스크립트 다운로드
curl -o setup-server.sh https://raw.githubusercontent.com/your-repo/moadamda-analytics/main/deployment/setup-server.sh

# 실행 권한 부여
chmod +x setup-server.sh

# 스크립트 실행
./setup-server.sh

# 완료 후 재로그인 (Docker 그룹 적용)
exit
ssh -i C:\Users\HOTSELLER\Downloads\moadamda-key.pem root@211.188.53.220
```

**또는 수동 설치:**
```bash
# Docker 설치
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Docker Compose 설치
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Git 설치
sudo apt-get update
sudo apt-get install -y git

# 재로그인
exit
ssh -i C:\Users\HOTSELLER\Downloads\moadamda-key.pem root@211.188.53.220
```

---

## 📦 Phase 3: 프로젝트 배포

### 방법 1: 로컬에서 파일 업로드 (추천)

**Windows (PowerShell)에서:**
```powershell
# 프로젝트 압축
cd C:\analysis
Compress-Archive -Path moadamda-analytics -DestinationPath moadamda-analytics.zip

# 서버로 전송
scp -i C:\Users\HOTSELLER\Downloads\moadamda-key.pem C:\analysis\moadamda-analytics.zip root@211.188.53.220:~/

# 서버에서 압축 해제 (SSH 접속 후)
ssh -i C:\Users\HOTSELLER\Downloads\moadamda-key.pem root@211.188.53.220
cd ~
apt-get install -y unzip
unzip moadamda-analytics.zip
cd moadamda-analytics
```

### 방법 2: Git Clone (GitHub 사용 시)

```bash
cd ~
git clone https://github.com/your-username/moadamda-analytics.git
cd moadamda-analytics
```

### 환경 변수 파일 생성

```bash
# 백엔드 환경 변수
cat > backend/.env.production << 'EOF'
NODE_ENV=production
PORT=3003
DB_HOST=postgres
DB_PORT=5432
DB_USER=moadamda
DB_PASSWORD=STRONG_PASSWORD_HERE
DB_NAME=analytics
CORS_ORIGINS=*
PUBLIC_IP=211.188.53.220
EOF

# 프론트엔드 환경 변수
cat > frontend/.env.production << 'EOF'
VITE_API_URL=
PUBLIC_IP=211.188.53.220
EOF

# ⚠️ 반드시 DB_PASSWORD를 강력한 비밀번호로 변경하세요!
nano backend/.env.production
```

### 프론트엔드 빌드 및 Docker 실행

```bash
# 프론트엔드 빌드
cd frontend
npm install
npm run build
cd ..

# Docker Compose 실행
docker-compose -f docker-compose.prod.yml up -d

# 상태 확인
docker-compose -f docker-compose.prod.yml ps

# 로그 확인
docker-compose -f docker-compose.prod.yml logs -f
```

---

## 📦 Phase 4: 트래커 업데이트

### 1. 트래커 스크립트 URL 변경

**로컬 PC에서:**

`moadamda-analytics/tracker/build/tracker-v037.js` 파일을 열고:

```javascript
// 27번째 줄 수정:
apiUrl: 'http://211.188.53.220:3003/api/track',
```

### 2. 카페24 FTP 업로드

업데이트된 `tracker-v037.js` 파일을 카페24 FTP에 업로드

---

## 🔍 서비스 확인

### 브라우저에서 접속:

```
프론트엔드: http://211.188.53.220:3030
백엔드 헬스체크: http://211.188.53.220:3003/health
```

### 확인사항:
- [ ] 프론트엔드 페이지 로드 확인
- [ ] 주문 목록 표시 확인
- [ ] API 호출 정상 작동 확인
- [ ] 트래커 데이터 수집 확인

---

## 🛠️ 유용한 명령어

### Docker 관리

```bash
# 컨테이너 상태 확인
docker-compose -f docker-compose.prod.yml ps

# 로그 확인 (실시간)
docker-compose -f docker-compose.prod.yml logs -f

# 특정 서비스 로그만 보기
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f frontend

# 컨테이너 재시작
docker-compose -f docker-compose.prod.yml restart

# 컨테이너 중지
docker-compose -f docker-compose.prod.yml down

# 완전히 재빌드
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

### PostgreSQL 관리

```bash
# PostgreSQL 접속
docker exec -it ma-postgres psql -U moadamda -d analytics

# 데이터 확인
SELECT COUNT(*) FROM visitors;
SELECT COUNT(*) FROM pageviews;
\q
```

### 디스크 용량 확인

```bash
# 전체 디스크 사용량
df -h

# Docker 디스크 사용량
docker system df

# 불필요한 Docker 데이터 정리
docker system prune -a
```

---

## 🔐 보안 권장사항

### 1. DB 비밀번호 변경 (필수!)

```bash
# backend/.env.production 편집
nano backend/.env.production

# DB_PASSWORD를 강력한 비밀번호로 변경
# 예: aB3$kL9@pQ2#mN7!
```

### 2. SSH 포트 변경 (선택)

```bash
# SSH 기본 포트 22를 다른 포트로 변경하여 보안 강화
sudo nano /etc/ssh/sshd_config
# Port 22 → Port 2222 변경
sudo systemctl restart sshd

# ACG에서 포트 2222 추가, 포트 22 제거
```

### 3. 방화벽 강화 (운영 안정화 후)

```bash
# 개발용 포트 3003, 3030 닫기
# Nginx Reverse Proxy를 통해 포트 80, 443만 사용
```

---

## 📊 모니터링

### 서버 리소스 확인

```bash
# CPU, 메모리 사용률
htop

# 네트워크 연결 상태
netstat -tulpn

# Docker 컨테이너 리소스 사용
docker stats
```

---

## 🆘 문제 해결

### 서비스가 시작되지 않을 때

```bash
# 로그 확인
docker-compose -f docker-compose.prod.yml logs

# 특정 서비스 재시작
docker-compose -f docker-compose.prod.yml restart backend

# 컨테이너 완전 재시작
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
```

### 데이터베이스 연결 실패

```bash
# PostgreSQL 상태 확인
docker-compose -f docker-compose.prod.yml logs postgres

# 데이터베이스 재시작
docker-compose -f docker-compose.prod.yml restart postgres
```

---

## 📞 빠른 참조

### 서버 접속
```bash
ssh -i C:\Users\HOTSELLER\Downloads\moadamda-key.pem root@211.188.53.220
```

### 프로젝트 디렉토리 이동
```bash
cd ~/moadamda-analytics
```

### 서비스 재시작
```bash
docker-compose -f docker-compose.prod.yml restart
```

### 로그 확인
```bash
docker-compose -f docker-compose.prod.yml logs -f
```

---

## 🔄 업데이트 프로세스

### 코드 변경 후 재배포:

```bash
# 서버에 SSH 접속
ssh -i C:\Users\HOTSELLER\Downloads\moadamda-key.pem root@211.188.53.220

# 프로젝트 디렉토리로 이동
cd ~/moadamda-analytics

# 새 파일 업로드 또는 Git Pull
# (scp로 파일 업로드 또는 git pull)

# 재배포
./deployment/deploy.sh
```

---

**작성일**: 2025-10-29  
**버전**: 1.0  
**서버 IP**: 211.188.53.220

