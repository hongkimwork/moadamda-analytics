@echo off
chcp 65001 > nul
echo ============================================================
echo 🔧 Frontend 재빌드 (Phase 4 코드 적용)
echo ============================================================
echo.

cd /d C:\analysis\moadamda-analytics

echo [1/3] Frontend 캐시 없이 재빌드 중...
echo (시간이 좀 걸릴 수 있습니다)
docker-compose build frontend --no-cache
if errorlevel 1 (
    echo ❌ Frontend 빌드 실패
    pause
    exit /b 1
)

echo.
echo [2/3] Frontend 재시작 중...
docker-compose up -d frontend
if errorlevel 1 (
    echo ❌ Frontend 시작 실패
    pause
    exit /b 1
)

echo.
echo [3/3] 5초 대기 중...
timeout /t 5 /nobreak > nul

echo.
echo ============================================================
echo ✅ Frontend 재빌드 완료!
echo ============================================================
echo.
echo 대시보드에서 Ctrl+F5 (강력 새로고침)을 눌러주세요!
echo.
echo 확인할 위치:
echo   1. "개요" 탭 맨 아래에 "📢 광고 성과 (UTM 추적)" 섹션
echo   2. 그 아래에 "🎯 멀티터치 어트리뷰션 분석" 섹션
echo.
echo 만약 아직도 안 보인다면:
echo   - 테스트 스크립트를 실행하지 않았을 수 있습니다.
echo   - CHECK_AND_TEST.bat 파일을 먼저 실행하세요.
echo.
pause

