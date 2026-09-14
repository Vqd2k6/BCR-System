const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/media.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');

router.post('/presigned-url', authenticateToken, mediaController.getPresignedUrl);

module.exports = router;
