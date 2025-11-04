@echo off
REM ================================================
REM Moadamda Analytics - Upload to Naver Cloud
REM Server IP: 211.188.53.220
REM ================================================

echo ================================================
echo Moadamda Analytics - Upload to Server
echo ================================================
echo.

REM Check if project exists
if not exist "C:\analysis\moadamda-analytics" (
    echo Error: Project not found at C:\analysis\moadamda-analytics
    pause
    exit /b 1
)

REM Check if key file exists
if not exist "C:\Users\HOTSELLER\Downloads\moadamda-key.pem" (
    echo Error: SSH key not found at C:\Users\HOTSELLER\Downloads\moadamda-key.pem
    pause
    exit /b 1
)

echo [1/4] Creating project archive...
cd C:\analysis
powershell -Command "Compress-Archive -Path moadamda-analytics -DestinationPath moadamda-analytics.zip -Force"

echo.
echo [2/4] Uploading to server...
scp -i C:\Users\HOTSELLER\Downloads\moadamda-key.pem C:\analysis\moadamda-analytics.zip root@211.188.53.220:~/

echo.
echo [3/4] Cleaning local archive...
del C:\analysis\moadamda-analytics.zip

echo.
echo ================================================
echo Upload Complete!
echo ================================================
echo.
echo Next steps on server (SSH):
echo   1. ssh -i C:\Users\HOTSELLER\Downloads\moadamda-key.pem root@211.188.53.220
echo   2. cd ~
echo   3. apt-get install -y unzip
echo   4. unzip moadamda-analytics.zip
echo   5. cd moadamda-analytics
echo   6. ./deployment/deploy.sh
echo.
echo ================================================
pause

