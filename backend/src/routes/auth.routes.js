const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');

router.post('/login', authController.login);
router.get('/me', authenticateToken, authController.getMe);

module.exports = router;
