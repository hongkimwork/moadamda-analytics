const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  user: process.env.DB_USER || 'moadamda',
  password: process.env.DB_PASSWORD,  // .env 파일 필수
  database: process.env.DB_NAME || 'analytics',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Cleanup realtime visitors periodically
setInterval(async () => {
  try {
    await pool.query('SELECT cleanup_realtime_visitors()');
  } catch (err) {
    console.error('Realtime cleanup error:', err);
  }
}, 60000); // Every minute

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};

