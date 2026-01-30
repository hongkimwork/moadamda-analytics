/**
 * User Management Routes
 * 사용자 목록 조회, 등록, 삭제
 */
const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../utils/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// 비밀번호 해싱 라운드
const SALT_ROUNDS = 10;

/**
 * GET /api/users
 * 사용자 목록 조회 (마스터, 관리자만)
 */
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, email, name, role, created_at, updated_at 
       FROM users 
       ORDER BY 
         CASE role 
           WHEN 'master' THEN 1 
           WHEN 'admin' THEN 2 
           ELSE 3 
         END,
         created_at DESC`
    );

    res.json({ users: result.rows });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: '사용자 목록 조회 중 오류가 발생했습니다.' });
  }
});

/**
 * POST /api/users
 * 새 사용자 등록 (마스터, 관리자만)
 * - 마스터: admin, user 등록 가능
 * - 관리자: user만 등록 가능
 */
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    const currentUser = req.user;

    // 필수 필드 검증
    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: '모든 필드를 입력해주세요.' });
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: '유효한 이메일 형식이 아닙니다.' });
    }

    // 비밀번호 길이 검증
    if (password.length < 6) {
      return res.status(400).json({ error: '비밀번호는 최소 6자 이상이어야 합니다.' });
    }

    // 권한 검증
    const allowedRoles = ['admin', 'user'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: '유효하지 않은 권한입니다.' });
    }

    // 관리자는 admin 등록 불가
    if (currentUser.role === 'admin' && role === 'admin') {
      return res.status(403).json({ error: '관리자는 다른 관리자를 등록할 수 없습니다.' });
    }

    // 이메일 중복 확인
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: '이미 사용 중인 이메일입니다.' });
    }

    // 비밀번호 해싱
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // 사용자 등록
    const result = await db.query(
      `INSERT INTO users (email, password_hash, name, role) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, email, name, role, created_at`,
      [email.toLowerCase().trim(), passwordHash, name.trim(), role]
    );

    res.status(201).json({ 
      message: '사용자가 등록되었습니다.',
      user: result.rows[0] 
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: '사용자 등록 중 오류가 발생했습니다.' });
  }
});

/**
 * DELETE /api/users/:id
 * 사용자 삭제
 * - 마스터: admin, user 삭제 가능
 * - 관리자: user만 삭제 가능
 * - 자기 자신은 삭제 불가
 * - master는 삭제 불가
 */
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    const currentUser = req.user;

    // 자기 자신 삭제 불가
    if (targetId === currentUser.id) {
      return res.status(400).json({ error: '자기 자신은 삭제할 수 없습니다.' });
    }

    // 대상 사용자 조회
    const targetResult = await db.query(
      'SELECT id, email, name, role FROM users WHERE id = $1',
      [targetId]
    );

    if (targetResult.rows.length === 0) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    const targetUser = targetResult.rows[0];

    // master 삭제 불가
    if (targetUser.role === 'master') {
      return res.status(403).json({ error: '마스터 계정은 삭제할 수 없습니다.' });
    }

    // 관리자는 admin 삭제 불가
    if (currentUser.role === 'admin' && targetUser.role === 'admin') {
      return res.status(403).json({ error: '관리자는 다른 관리자를 삭제할 수 없습니다.' });
    }

    // 삭제 실행
    await db.query('DELETE FROM users WHERE id = $1', [targetId]);

    res.json({ 
      message: '사용자가 삭제되었습니다.',
      deletedUser: {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name
      }
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: '사용자 삭제 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
