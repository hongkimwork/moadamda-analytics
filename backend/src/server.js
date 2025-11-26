// Load environment variables from .env.local (development) or .env (production)
const envFile = process.env.NODE_ENV === 'production' ? '.env' : '.env.local';
require('dotenv').config({ path: require('path').join(__dirname, '..', envFile) });
const express = require('express');
const cors = require('cors');
const db = require('./utils/database');
const trackRoutes = require('./routes/track');
const statsRoutes = require('./routes/stats');
const tablesRoutes = require('./routes/tables');
const mappingsRoutes = require('./routes/mappings');
const creativePerformanceRoutes = require('./routes/creative-performance');
const cafe24Routes = require('./routes/cafe24');
const cafe24Client = require('./utils/cafe24');

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
app.use('/api', cafe24Routes);

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
      
      // Start Cafe24 token refresh background task
      if (process.env.CAFE24_AUTH_KEY) {
        cafe24Client.startTokenRefreshTask();
        cafe24Client.startAutoSyncTask();
      } else {
        console.log('Cafe24 integration disabled (CAFE24_AUTH_KEY not set)');
      }
    }
  });
});

