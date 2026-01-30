/**
 * Authentication Middleware
 * JWT 토큰 검증 및 권한 확인
 */
const jwt = require('jsonwebtoken');
const db = require('../utils/database');

// JWT 시크릿 키 (환경변수에서 가져오거나 기본값 사용)
const JWT_SECRET = process.env.JWT_SECRET || 'moadamda-analytics-secret-key-2026';
const JWT_EXPIRES_IN = '2h'; // 2시간

/**
 * JWT 토큰 생성
 */
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      name: user.name,
      role: user.role 
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

/**
 * JWT 토큰 검증 미들웨어
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '인증이 필요합니다.' });
    }

    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // 사용자가 아직 존재하는지 확인
      const result = await db.query(
        'SELECT id, email, name, role FROM users WHERE id = $1',
        [decoded.id]
      );
      
      if (result.rows.length === 0) {
        return res.status(401).json({ error: '사용자를 찾을 수 없습니다.' });
      }
      
      req.user = result.rows[0];
      next();
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ error: '세션이 만료되었습니다. 다시 로그인해주세요.' });
      }
      return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: '인증 처리 중 오류가 발생했습니다.' });
  }
};

/**
 * 권한 확인 미들웨어 생성 함수
 * @param {string[]} allowedRoles - 허용된 권한 목록
 */
const authorize = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: '인증이 필요합니다.' });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: '접근 권한이 없습니다.' });
    }
    
    next();
  };
};

/**
 * 마스터 또는 관리자만 허용
 */
const requireAdmin = authorize(['master', 'admin']);

/**
 * 마스터만 허용
 */
const requireMaster = authorize(['master']);

module.exports = {
  JWT_SECRET,
  JWT_EXPIRES_IN,
  generateToken,
  authenticate,
  authorize,
  requireAdmin,
  requireMaster
};
