@echo off
chcp 65001 > nul
echo ============================================================
echo 🔍 현재 상태 확인 및 테스트 실행
echo ============================================================
echo.

cd /d C:\analysis\moadamda-analytics

echo [1/5] Docker 컨테이너 상태 확인...
docker-compose ps
echo.

echo [2/5] Backend 컨테이너에 테스트 파일이 있는지 확인...
docker exec ma-backend ls -la test-utm-scenario.js 2>nul
if errorlevel 1 (
    echo ❌ 테스트 파일이 없습니다. Backend를 재빌드해야 합니다.
    echo.
    echo [3/5] Backend 재빌드 중... 시간이 걸릴 수 있습니다.
    docker-compose build backend --no-cache
    if errorlevel 1 (
        echo ❌ Backend 빌드 실패
        pause
        exit /b 1
    )
    
    echo.
    echo [4/5] Backend 재시작 중...
    docker-compose up -d backend
    if errorlevel 1 (
        echo ❌ Backend 시작 실패
        pause
        exit /b 1
    )
    
    echo.
    echo [5/5] 10초 대기 중...
    timeout /t 10 /nobreak > nul
) else (
    echo ✅ 테스트 파일이 존재합니다.
    echo.
    echo [3/5] 건너뜀
    echo [4/5] 건너뜀
    echo [5/5] 5초 대기 중...
    timeout /t 5 /nobreak > nul
)

echo.
echo ============================================================
echo 🚀 테스트 실행 중...
echo ============================================================
echo.

docker exec ma-backend node test-utm-scenario.js

echo.
echo ============================================================
echo ✅ 완료!
echo ============================================================
echo.
echo 대시보드 확인: http://218.238.83.154:3030/
echo 날짜를 "오늘" (2025-10-17)로 선택하세요.
echo.
pause

