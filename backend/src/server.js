const express = require('express');
const cors = require('cors');
const db = require('./utils/database');
const trackRoutes = require('./routes/track');
const statsRoutes = require('./routes/stats');
const tablesRoutes = require('./routes/tables');
const mappingsRoutes = require('./routes/mappings');
const creativePerformanceRoutes = require('./routes/creative-performance');
const cafe24Routes = require('./routes/cafe24');

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
});

