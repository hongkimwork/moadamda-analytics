/**
 * Authentication Routes
 * 로그인, 로그아웃, 현재 사용자 정보, 비밀번호 변경
 */
const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../utils/database');
const { generateToken, authenticate } = require('../middleware/auth');

const router = express.Router();

// 비밀번호 해싱 라운드
const SALT_ROUNDS = 10;

/**
 * POST /api/auth/login
 * 로그인
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });
    }

    // 사용자 조회
    const result = await db.query(
      'SELECT id, email, password_hash, name, role FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 일치하지 않습니다.' });
    }

    const user = result.rows[0];

    // 비밀번호 확인
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 일치하지 않습니다.' });
    }

    // JWT 토큰 생성
    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '로그인 처리 중 오류가 발생했습니다.' });
  }
});

/**
 * POST /api/auth/logout
 * 로그아웃 (클라이언트에서 토큰 삭제)
 */
router.post('/logout', authenticate, (req, res) => {
  // JWT는 stateless이므로 서버에서 할 일이 없음
  // 클라이언트에서 토큰을 삭제하면 됨
  res.json({ message: '로그아웃되었습니다.' });
});

/**
 * GET /api/auth/me
 * 현재 로그인한 사용자 정보
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, email, name, role, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: '사용자 정보 조회 중 오류가 발생했습니다.' });
  }
});

/**
 * PUT /api/auth/password
 * 비밀번호 변경 (본인만)
 */
router.put('/password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: '현재 비밀번호와 새 비밀번호를 입력해주세요.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: '새 비밀번호는 최소 6자 이상이어야 합니다.' });
    }

    // 현재 비밀번호 확인
    const result = await db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    const isValidPassword = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: '현재 비밀번호가 일치하지 않습니다.' });
    }

    // 새 비밀번호 해싱 및 저장
    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    
    await db.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [newPasswordHash, req.user.id]
    );

    res.json({ message: '비밀번호가 변경되었습니다.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: '비밀번호 변경 중 오류가 발생했습니다.' });
  }
});

// 비밀번호 해싱 함수 export (사용자 생성 시 사용)
router.hashPassword = async (password) => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

module.exports = router;
