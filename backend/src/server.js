require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./utils/database');
const trackRoutes = require('./routes/track');
const statsRoutes = require('./routes/stats');
const tablesRoutes = require('./routes/tables');
const mappingsRoutes = require('./routes/mappings');
const creativePerformanceRoutes = require('./routes/creative-performance');
const cafe24Routes = require('./routes/cafe24');
const { startScheduler } = require('./scheduler/syncCafe24Orders');

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware - Allow all origins for CloudFlare Tunnel
// Updated: 2025-10-24 to fix CORS issues
app.use(cors({
  origin: true,  // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api', trackRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/tables', tablesRoutes);
app.use('/api/mappings', mappingsRoutes);
app.use('/api', creativePerformanceRoutes);
app.use('/', cafe24Routes);  // Cafe24 OAuth routes

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Moadamda Analytics Backend running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Test database connection
  db.query('SELECT NOW()', (err, result) => {
    if (err) {
      console.error('Database connection failed:', err);
    } else {
      console.log('Database connected successfully');
    }
  });

  // Start Cafe24 order sync scheduler (if token exists in DB)
  db.query('SELECT * FROM cafe24_token ORDER BY idx DESC LIMIT 1', (err, result) => {
    if (err) {
      console.log('[Cafe24] Failed to check token in DB:', err.message);
      console.log('[Cafe24] Scheduler disabled');
    } else if (result.rows.length > 0) {
      console.log('[Cafe24] Token found in database, starting order sync scheduler...');
      startScheduler();
    } else {
      console.log('[Cafe24] No token found in database, scheduler disabled');
      console.log('[Cafe24] Visit https://marketingzon.com/cafe24/auth to authorize');
    }
  });
});

