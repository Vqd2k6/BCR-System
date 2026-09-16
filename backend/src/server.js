const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const apiRouter = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Utility Middlewares
app.use(helmet());
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('dev'));

// Root Health Check
app.get('/health', (req, res) => {
    res.json({
        status: 'UP',
        service: 'Metro 2 Survey & Planning Backend API',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Mount API v1 Routes
app.use('/api/v1', apiRouter);

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err.stack);
    res.status(500).json({
        success: false,
        message: 'Lỗi máy chủ nội bộ.',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start HTTP Server
app.listen(PORT, () => {
    console.log(`🚀 [Metro 2 Server] Backend API đang chạy tại: http://localhost:${PORT}`);
    console.log(`📡 [API Endpoints]: http://localhost:${PORT}/api/v1`);
});

module.exports = app;
