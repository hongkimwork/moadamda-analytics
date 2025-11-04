@echo off
chcp 65001 > nul
echo ============================================================
echo 🎯 Phase 4.4 멀티터치 어트리뷰션 테스트 시작
echo ============================================================
echo.

cd /d C:\analysis\moadamda-analytics

echo [1/4] Backend 재빌드 중...
docker-compose build backend
if errorlevel 1 (
    echo ❌ Backend 빌드 실패
    pause
    exit /b 1
)

echo.
echo [2/4] Backend 재시작 중...
docker-compose up -d backend
if errorlevel 1 (
    echo ❌ Backend 시작 실패
    pause
    exit /b 1
)

echo.
echo [3/4] 5초 대기 중...
timeout /t 5 /nobreak > nul

echo.
echo [4/4] 테스트 실행 중...
docker exec ma-backend node test-utm-scenario.js

echo.
echo ============================================================
echo ✅ 테스트 완료!
echo ============================================================
echo.
echo 대시보드에서 확인하세요: http://218.238.83.154:3030/
echo 날짜를 "오늘"로 선택하면 테스트 데이터를 볼 수 있습니다.
echo.
pause

