import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { UnauthorizedError, ForbiddenError } from '../errors/problem-details';
import { Database } from '../../database/db';

export interface JwtPayload {
  userId: string;
  username: string;
  role: 'SUPER_ADMIN' | 'ZONE_ADMIN' | 'SURVEYOR' | 'CONTRACTOR' | 'GUEST';
  assignedZoneId?: string | null;
  fullName: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Middleware xác thực JWT Access Token & Kiểm tra Trạng thái Tài khoản Thời gian thực
 */
export async function authenticateJwt(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Thiếu hoặc sai định dạng Authorization Bearer token'));
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;

    // Kiểm tra trạng thái tài khoản thời gian thực trong CSDL để triệt tiêu Zombie Token 7 ngày
    const userRes = await Database.query<{ status: string; deleted_at: Date | null }>(
      `SELECT status, deleted_at FROM users WHERE id = $1 LIMIT 1;`,
      [decoded.userId]
    );

    if (!userRes.rows[0] || userRes.rows[0].deleted_at !== null) {
      return next(new UnauthorizedError('Tài khoản đã bị vô hiệu hóa hoặc không tồn tại trong hệ thống'));
    }

    if (userRes.rows[0].status === 'LOCKED' || userRes.rows[0].status === 'SUSPENDED') {
      return next(new UnauthorizedError(`Tài khoản đang ở trạng thái [${userRes.rows[0].status}], quyền truy cập đã bị thu hồi`));
    }

    req.user = decoded;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Token đã hết hạn, vui lòng refresh token hoặc đăng nhập lại'));
    }
    if (error instanceof UnauthorizedError) {
      return next(error);
    }
    return next(new UnauthorizedError('Token không hợp lệ hoặc đã bị chỉnh sửa'));
  }
}

/**
 * Middleware xác thực JWT Access Token tùy chọn (Optional JWT)
 * Nếu có Authorization header hợp lệ, giải mã và gán req.user.
 * Nếu không có token hoặc token không hợp lệ, vẫn cho request đi tiếp mà không ném lỗi 401.
 */
export function optionalAuthenticateJwt(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    req.user = decoded;
  } catch (_error: any) {
    // Không ném lỗi nếu token không hợp lệ ở middleware tùy chọn
  }
  next();
}

/**
 * Middleware kiểm tra quyền RBAC (Role-Based Access Control)
 */
export function requireRoles(...allowedRoles: Array<'SUPER_ADMIN' | 'ZONE_ADMIN' | 'SURVEYOR' | 'CONTRACTOR' | 'GUEST'>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Người dùng chưa xác thực'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Vai trò [${req.user.role}] không được phép truy cập endpoint này. Yêu cầu: [${allowedRoles.join(', ')}]`
        )
      );
    }

    next();
  };
}
