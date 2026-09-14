// Node 16 Crypto Polyfill for AWS SDK v3
const crypto = require('crypto');
if (!global.crypto) {
  global.crypto = crypto.webcrypto || {
    getRandomValues: (arr) => crypto.randomFillSync(arr),
  };
}

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth.routes');
const zonesRoutes = require('./routes/zones.routes');
const buildingsRoutes = require('./routes/buildings.routes');
const mediaRoutes = require('./routes/media.routes');
const errorHandler = require('./middlewares/error.middleware');

const app = express();
const PORT = process.env.PORT || 5050;

// Middlewares
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health Check API
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    project: 'KSQH Metro 2 - Building Condition Assessment Backend',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/zones', zonesRoutes);
app.use('/api/buildings', buildingsRoutes);
app.use('/api/media', mediaRoutes);

// Global Error Handler
app.use(errorHandler);

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 KSQH Metro 2 Backend API đang chạy tại: http://localhost:${PORT}`);
  console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`====================================================`);
});

module.exports = app;
