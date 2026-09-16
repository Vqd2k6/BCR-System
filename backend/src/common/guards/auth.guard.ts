import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { UnauthorizedError, ForbiddenError } from '../errors/problem-details';

export interface JwtPayload {
  userId: string;
  username: string;
  role: 'SUPER_ADMIN' | 'ZONE_ADMIN' | 'SURVEYOR' | 'CONTRACTOR';
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
 * Middleware xác thực JWT Access Token
 */
export function authenticateJwt(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Thiếu hoặc sai định dạng Authorization Bearer token'));
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    req.user = decoded;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Token đã hết hạn, vui lòng refresh token hoặc đăng nhập lại'));
    }
    return next(new UnauthorizedError('Token không hợp lệ hoặc đã bị chỉnh sửa'));
  }
}

/**
 * Middleware kiểm tra quyền RBAC (Role-Based Access Control)
 */
export function requireRoles(...allowedRoles: Array<'SUPER_ADMIN' | 'ZONE_ADMIN' | 'SURVEYOR' | 'CONTRACTOR'>) {
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
