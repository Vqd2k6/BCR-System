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

    // Kiểm tra trạng thái tài khoản & đồng bộ phân quyền thời gian thực trong CSDL để triệt tiêu Zombie/Stale Token 7 ngày
    const userRes = await Database.query<{
      id: string;
      username: string;
      full_name: string;
      role: 'SUPER_ADMIN' | 'ZONE_ADMIN' | 'SURVEYOR' | 'CONTRACTOR' | 'GUEST';
      assigned_zone_id: string | null;
      status: string;
      status_reason: string | null;
      deleted_at: Date | null;
    }>(
      `SELECT id, username, full_name, role, assigned_zone_id, status, status_reason, deleted_at FROM users WHERE id = $1 LIMIT 1;`,
      [decoded.userId]
    );

    const dbUser = userRes.rows[0];
    if (!dbUser || dbUser.deleted_at !== null) {
      return next(new UnauthorizedError('Tài khoản đã bị vô hiệu hóa hoặc không tồn tại trong hệ thống'));
    }

    if (dbUser.status === 'LOCKED' || dbUser.status === 'SUSPENDED') {
      const reasonSuffix = dbUser.status_reason ? ` - Lý do: ${dbUser.status_reason}` : '';
      return next(
        new UnauthorizedError(
          `Tài khoản đang ở trạng thái [${dbUser.status}], quyền truy cập đã bị thu hồi${reasonSuffix}`
        )
      );
    }

    req.user = {
      userId: dbUser.id,
      username: dbUser.username,
      role: dbUser.role,
      assignedZoneId: dbUser.assigned_zone_id,
      fullName: dbUser.full_name,
    };
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
export async function optionalAuthenticateJwt(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    const userRes = await Database.query<{
      id: string;
      username: string;
      full_name: string;
      role: 'SUPER_ADMIN' | 'ZONE_ADMIN' | 'SURVEYOR' | 'CONTRACTOR' | 'GUEST';
      assigned_zone_id: string | null;
      status: string;
      deleted_at: Date | null;
    }>(
      `SELECT id, username, full_name, role, assigned_zone_id, status, deleted_at FROM users WHERE id = $1 LIMIT 1;`,
      [decoded.userId]
    );

    const dbUser = userRes.rows[0];
    if (dbUser && dbUser.deleted_at === null && dbUser.status === 'ACTIVE') {
      req.user = {
        userId: dbUser.id,
        username: dbUser.username,
        role: dbUser.role,
        assignedZoneId: dbUser.assigned_zone_id,
        fullName: dbUser.full_name,
      };
    }
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
