const express = require('express');
const router = express.Router();
const cafe24Client = require('../utils/cafe24Client');

/**
 * Cafe24 OAuth Callback Endpoint
 * 
 * Flow:
 * 1. User clicks authorization link
 * 2. Cafe24 redirects to this endpoint with authorization code
 * 3. Exchange code for access token
 * 4. Save tokens to .env or database
 */
router.get('/cafe24/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.status(400).json({ 
        error: 'Authorization code not provided',
        message: 'Cafe24 did not return an authorization code'
      });
    }

    console.log('[Cafe24 OAuth] Received authorization code:', code.substring(0, 10) + '...');

    // Exchange authorization code for access token
    const tokens = await cafe24Client.getAccessToken(code);

    console.log('[Cafe24 OAuth] Access token received successfully');
    console.log('[Cafe24 OAuth] Access Token:', tokens.access_token.substring(0, 20) + '...');
    console.log('[Cafe24 OAuth] Refresh Token:', tokens.refresh_token.substring(0, 20) + '...');
    console.log('[Cafe24 OAuth] Expires in:', tokens.expires_at);

    // Success response with instructions
    res.send(`
      <html>
        <head>
          <title>Cafe24 인증 완료</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
            .success { background: #d4edda; border: 1px solid #c3e6cb; padding: 20px; border-radius: 5px; }
            .token { background: #f8f9fa; padding: 10px; border-radius: 3px; margin: 10px 0; font-family: monospace; word-break: break-all; }
            .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin-top: 20px; }
            code { background: #e9ecef; padding: 2px 5px; border-radius: 3px; }
          </style>
        </head>
        <body>
          <div class="success">
            <h1>✅ Cafe24 OAuth 인증 완료!</h1>
            <p>Access Token이 성공적으로 발급되었습니다.</p>
          </div>

          <h2>📋 발급된 토큰 정보</h2>
          <p><strong>Access Token:</strong></p>
          <div class="token">${tokens.access_token}</div>
          
          <p><strong>Refresh Token:</strong></p>
          <div class="token">${tokens.refresh_token}</div>

          <p><strong>만료 시간:</strong> ${tokens.expires_at}</p>

          <div class="warning">
            <h3>⚠️ 다음 단계 (수동 설정 필요)</h3>
            <p>다음 파일을 열어서 토큰을 저장해주세요:</p>
            <code>C:\\analysis\\moadamda-analytics\\backend\\.env</code>
            
            <p>다음 두 줄을 찾아서 값을 채워주세요:</p>
            <pre>
CAFE24_ACCESS_TOKEN=${tokens.access_token}
CAFE24_REFRESH_TOKEN=${tokens.refresh_token}
            </pre>

            <p>저장 후 백엔드를 재시작하면 Cafe24 API 연동이 활성화됩니다.</p>
          </div>

          <p style="margin-top: 30px;">
            <a href="https://dashboard.marketingzon.com">← 대시보드로 돌아가기</a>
          </p>
        </body>
      </html>
    `);

  } catch (error) {
    console.error('[Cafe24 OAuth] Error:', error.message);
    res.status(500).send(`
      <html>
        <head>
          <title>Cafe24 인증 실패</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
            .error { background: #f8d7da; border: 1px solid #f5c6cb; padding: 20px; border-radius: 5px; }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>❌ Cafe24 OAuth 인증 실패</h1>
            <p><strong>오류:</strong> ${error.message}</p>
            <p>Cafe24 개발자센터에서 앱 설정을 확인해주세요.</p>
          </div>
        </body>
      </html>
    `);
  }
});

/**
 * Generate Cafe24 OAuth Authorization URL
 * 
 * Usage:
 * Visit: https://marketingzon.com/cafe24/auth
 * Click the link to authorize the app
 */
router.get('/cafe24/auth', (req, res) => {
  const authUrl = cafe24Client.getAuthorizationUrl();
  
  res.send(`
    <html>
      <head>
        <title>Cafe24 OAuth 인증</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
          .info { background: #d1ecf1; border: 1px solid #bee5eb; padding: 20px; border-radius: 5px; }
          .btn { display: inline-block; padding: 15px 30px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          .btn:hover { background: #0056b3; }
        </style>
      </head>
      <body>
        <div class="info">
          <h1>🔐 Cafe24 OAuth 인증</h1>
          <p>Cafe24 API를 사용하기 위해 앱 권한을 승인해야 합니다.</p>
          <p>아래 버튼을 클릭하면 Cafe24 인증 페이지로 이동합니다.</p>
        </div>

        <a href="${authUrl}" class="btn">Cafe24 앱 권한 승인하기 →</a>

        <h3>📋 승인 후 진행 절차</h3>
        <ol>
          <li>위 버튼 클릭 → Cafe24 관리자 로그인</li>
          <li>"승인" 버튼 클릭</li>
          <li>자동으로 콜백 페이지로 이동</li>
          <li>발급된 토큰을 .env 파일에 저장</li>
          <li>백엔드 재시작</li>
        </ol>

        <p><strong>인증 URL:</strong></p>
        <pre style="background: #f8f9fa; padding: 10px; border-radius: 3px; overflow-x: auto;">${authUrl}</pre>
      </body>
    </html>
  `);
});

module.exports = router;

