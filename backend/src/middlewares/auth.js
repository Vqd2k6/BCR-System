const jwt = require('jsonwebtoken');

// Middleware xác thực Token JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
        return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập để truy cập tài nguyên.' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'metro2_super_secure_jwt_secret_key_2026', (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
        }
        req.user = user;
        next();
    });
};

// Middleware kiểm tra Phân quyền (RBAC)
const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Quyền truy cập bị từ chối. Yêu cầu một trong các vai trò: ${allowedRoles.join(', ')}`
            });
        }
        next();
    };
};

module.exports = {
    authenticateToken,
    authorizeRoles
};
