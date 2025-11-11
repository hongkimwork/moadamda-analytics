# API 동기화 검증 스크립트
# 로컬과 서버의 API 응답 비교

Write-Host "`n=== API 동기화 검증 시작 ===" -ForegroundColor Cyan

# 테스트할 주문 번호
$orderIds = @(
    "20251111-0000137",
    "20251111-0000141"
)

foreach ($orderId in $orderIds) {
    Write-Host "`n--- 주문번호: $orderId ---" -ForegroundColor Yellow
    
    try {
        # 로컬 API 호출
        Write-Host "로컬 API 호출 중..." -ForegroundColor Gray
        $local = Invoke-RestMethod -Uri "http://localhost:3001/api/stats/order-detail/$orderId" -ErrorAction Stop
        
        # 서버 API 호출
        Write-Host "서버 API 호출 중..." -ForegroundColor Gray
        $server = Invoke-RestMethod -Uri "https://marketingzon.com/api/stats/order-detail/$orderId" -ErrorAction Stop
        
        # previous_visits 비교
        $localCount = $local.previous_visits.Count
        $serverCount = $server.previous_visits.Count
        
        Write-Host "`n결과:" -ForegroundColor White
        Write-Host "  로컬 previous_visits 개수: $localCount"
        Write-Host "  서버 previous_visits 개수: $serverCount"
        
        if ($localCount -eq $serverCount) {
            Write-Host "  ✅ 동일합니다!" -ForegroundColor Green
            
            # 상세 비교
            if ($localCount -gt 0) {
                Write-Host "`n  상세 비교:"
                for ($i = 0; $i -lt $localCount; $i++) {
                    $localDate = $local.previous_visits[$i].date
                    $serverDate = $server.previous_visits[$i].date
                    
                    if ($localDate -eq $serverDate) {
                        Write-Host "    [$($i+1)] $localDate ✅" -ForegroundColor Green
                    } else {
                        Write-Host "    [$($i+1)] 로컬: $localDate | 서버: $serverDate ❌" -ForegroundColor Red
                    }
                }
            } else {
                Write-Host "  (둘 다 이전 방문 없음)" -ForegroundColor Gray
            }
        } else {
            Write-Host "  ❌ 다릅니다!" -ForegroundColor Red
            
            # 차이점 상세 출력
            Write-Host "`n  로컬 날짜들:"
            $local.previous_visits | ForEach-Object { Write-Host "    - $($_.date)" -ForegroundColor Yellow }
            
            Write-Host "`n  서버 날짜들:"
            $server.previous_visits | ForEach-Object { Write-Host "    - $($_.date)" -ForegroundColor Yellow }
        }
        
    } catch {
        Write-Host "  ❌ 오류 발생: $_" -ForegroundColor Red
    }
    
    Write-Host "`n" + ("-" * 60)
}

Write-Host "`n=== 검증 완료 ===" -ForegroundColor Cyan
Write-Host "`n힌트: 로컬 백엔드를 재시작했는지 확인하세요!" -ForegroundColor Gray

