const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'ksqh_metro2_jwt_super_secret_key_2026';

// Verify JWT Token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Không tìm thấy Token xác thực (401 Unauthorized)',
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Token không hợp lệ hoặc đã hết hạn (403 Forbidden)',
      });
    }
    req.user = user;
    next();
  });
}

// Role-Based Access Control (RBAC) Guard
function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Bạn không có quyền truy cập chức năng này. Quyền yêu cầu: [${allowedRoles.join(', ')}]`,
      });
    }
    next();
  };
}

module.exports = {
  authenticateToken,
  authorizeRoles,
};
