# HTTPS 문제 해결 가이드

## 문제 상황
- 모아담다: HTTPS (https://moadamda.com)
- API 서버: HTTP (http://218.238.83.154:3003)
- 브라우저가 Mixed Content로 차단

## 해결책 1: Cloudflare Tunnel (가장 빠름, 무료)

### 1. Cloudflare 가입
https://dash.cloudflare.com/sign-up

### 2. cloudflared 설치 (Windows)
https://github.com/cloudflare/cloudflared/releases/latest
- cloudflared-windows-amd64.exe 다운로드
- C:\cloudflared\ 폴더에 저장

### 3. Cloudflare 로그인
```powershell
cd C:\cloudflared
.\cloudflared.exe tunnel login
```
브라우저가 열리면 로그인

### 4. 터널 생성
```powershell
.\cloudflared.exe tunnel create moadamda-analytics
```

### 5. 설정 파일 생성 (config.yml)
```yaml
tunnel: <TUNNEL-ID>
credentials-file: C:\cloudflared\<TUNNEL-ID>.json

ingress:
  - hostname: analytics.yourdomain.com
    service: http://localhost:3003
  - service: http_status:404
```

### 6. DNS 설정
Cloudflare 대시보드에서:
- DNS > Add record
- Type: CNAME
- Name: analytics
- Target: <TUNNEL-ID>.cfargotunnel.com

### 7. 터널 실행
```powershell
.\cloudflared.exe tunnel run moadamda-analytics
```

이제 https://analytics.yourdomain.com 으로 접속 가능!

---

## 해결책 2: ngrok (가장 간단, 무료 제한 있음)

### 1. ngrok 설치
https://ngrok.com/download
- 가입 후 authtoken 받기

### 2. ngrok 실행
```powershell
ngrok http 3003
```

### 3. 출력된 HTTPS URL 사용
```
Forwarding  https://abc123.ngrok.io -> http://localhost:3003
```

tracker.js에서 API URL을:
```javascript
apiUrl: 'https://abc123.ngrok.io/api/track'
```

**단점:** 
- 무료는 URL이 매번 바뀜
- 유료($8/월)면 고정 도메인 가능

---

## 해결책 3: 카페24 PHP 프록시 (중간 단계)

카페24 서버에 간단한 PHP 파일 업로드:

### 1. proxy.php 생성
```php
<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');

$data = file_get_contents('php://input');

$ch = curl_init('http://218.238.83.154:3003/api/track');
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json'));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$response = curl_exec($ch);
curl_close($ch);

echo $response;
?>
```

### 2. 카페24에 업로드
/web/analytics-proxy.php

### 3. tracker.js 수정
```javascript
apiUrl: 'https://moadamda.com/web/analytics-proxy.php'
```

---

## 권장 방법

**테스트용:** ngrok (5분 안에 해결)
**장기 운영:** Cloudflare Tunnel (무료, 안정적)

## 임시 테스트 방법

개발자 도구 Console에서:
```javascript
// HTTPS 우회 테스트 (실제로는 작동 안함)
// 대신 ngrok이나 Cloudflare 사용 필요
```


