import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { AuthRepository, UserEntity } from './auth.repository';
import { CryptoUtils } from '../../common/utils/crypto.utils';
import {
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
  ConflictError,
} from '../../common/errors/problem-details';
import { JwtPayload } from '../../common/guards/auth.guard';
import { Database } from '../../database/db';

export interface SafeUserDto {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: 'SUPER_ADMIN' | 'ZONE_ADMIN' | 'SURVEYOR' | 'CONTRACTOR' | 'GUEST';
  assignedZoneId: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'LOCKED';
  statusReason: string | null;
  avatarUrl: string | null;
  signatureImageUrl: string | null;
  surveyorCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toSafeUserDto(user: any): SafeUserDto {
  return {
    id: user.id,
    username: user.username,
    fullName: user.full_name || user.fullName || '',
    email: user.email || null,
    phone: user.phone || null,
    role: user.role,
    assignedZoneId: user.assigned_zone_id || user.assignedZoneId || null,
    status: user.status,
    statusReason: user.status_reason || user.statusReason || null,
    avatarUrl: user.avatar_url || user.avatarUrl || null,
    signatureImageUrl: user.signature_image_url || user.signatureImageUrl || null,
    surveyorCode: user.surveyor_code || user.surveyorCode || null,
    createdAt: user.created_at ? new Date(user.created_at).toISOString() : new Date().toISOString(),
    updatedAt: user.updated_at ? new Date(user.updated_at).toISOString() : new Date().toISOString(),
  };
}

export class AuthService {
  static async login(
    username: string,
    password: string,
    clientIp?: string,
    userAgent?: string
  ) {
    let user = await AuthRepository.findByUsername(username);

    // If user not in database, check demo accounts list and auto-seed
    if (!user) {
      // Kiểm tra xem tài khoản có bị soft-delete không trước khi thử auto-seed
      const existingDeleted = await AuthRepository.findRawByUsername(username);
      if (existingDeleted && existingDeleted.deleted_at !== null) {
        throw new UnauthorizedError('Tài khoản đã bị vô hiệu hóa hoặc thu hồi quyền truy cập');
      }

      const demoUsersMap: Record<string, { id: string; fullName: string; role: any; zoneId: string | null; defaultPass: string }> = {
        surveyor_s9_01: {
          id: 'b0000000-0000-0000-0000-000000000003',
          fullName: 'Nguyễn Văn Khảo Sát',
          role: 'SURVEYOR',
          zoneId: 'ZONE_S9',
          defaultPass: 'Password@123',
        },
        surveyor_s9_02: {
          id: 'b0000000-0000-0000-0000-000000000004',
          fullName: 'Trần Văn B',
          role: 'SURVEYOR',
          zoneId: 'ZONE_S9',
          defaultPass: 'Password@123',
        },
        zoneadmin_s9: {
          id: 'b0000000-0000-0000-0000-000000000002',
          fullName: 'Trần Văn Tổ Trưởng (Ga S9)',
          role: 'ZONE_ADMIN',
          zoneId: 'ZONE_S9',
          defaultPass: 'Admin@123',
        },
        zoneadmin: {
          id: 'b0000000-0000-0000-0000-000000000006',
          fullName: 'Trần Văn Tổ Trưởng (Zone Admin)',
          role: 'ZONE_ADMIN',
          zoneId: 'ALL',
          defaultPass: 'Admin@123',
        },
        superadmin: {
          id: 'b0000000-0000-0000-0000-000000000001',
          fullName: 'Nguyễn Văn Tổng (MAUR)',
          role: 'SUPER_ADMIN',
          zoneId: null,
          defaultPass: 'Admin@123',
        },
        contractor_guest: {
          id: 'b0000000-0000-0000-0000-000000000005',
          fullName: 'Đại diện Nhà Thầu TBM',
          role: 'CONTRACTOR',
          zoneId: null,
          defaultPass: 'Password@123',
        },
      };

      const demo = demoUsersMap[username.toLowerCase().trim()];
      if (demo) {
        try {
          const passHash = await CryptoUtils.hashPassword(demo.defaultPass);
          user = await AuthRepository.createUser({
            username,
            passwordHash: passHash,
            fullName: demo.fullName,
            role: demo.role,
            assignedZoneId: demo.zoneId,
          });
        } catch (_err) {
          user = {
            id: demo.id,
            username,
            password_hash: '',
            full_name: demo.fullName,
            email: null,
            phone: null,
            role: demo.role,
            assigned_zone_id: demo.zoneId,
            status: 'ACTIVE',
            status_reason: null,
            avatar_url: null,
            created_at: new Date(),
            updated_at: new Date(),
            deleted_at: null,
          };
        }
      }
    }

    if (!user) {
      throw new UnauthorizedError('Tên đăng nhập hoặc mật khẩu không chính xác');
    }

    if (user.status === 'LOCKED' || user.status === 'SUSPENDED') {
      throw new UnauthorizedError(
        `Tài khoản đang ở trạng thái [${user.status}] - ${user.status_reason || 'Liên hệ Quản trị viên để được hỗ trợ'}`
      );
    }

    let isMatch = false;
    if (user.password_hash) {
      isMatch = await CryptoUtils.comparePassword(password, user.password_hash);
    }

    if (!isMatch) {
      throw new UnauthorizedError('Tên đăng nhập hoặc mật khẩu không chính xác');
    }

    const payload: JwtPayload = {
      userId: user.id,
      username: user.username,
      role: user.role,
      assignedZoneId: user.assigned_zone_id,
      fullName: user.full_name,
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn as any,
    });

    const rawRefreshToken = CryptoUtils.generateRandomToken(40);
    const refreshTokenHash = CryptoUtils.sha256(rawRefreshToken);
    const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 ngày

    try {
      await AuthRepository.saveSession({
        userId: user.id,
        refreshTokenHash,
        clientIp,
        userAgent,
        expiresAt: refreshExpiresAt,
      });
    } catch (_sessionErr) {
      // Non-critical session log error
    }

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: 604800, // 7 ngày tính theo giây
      user: toSafeUserDto(user),
    };
  }

  static async refreshToken(rawRefreshToken: string) {
    const refreshTokenHash = CryptoUtils.sha256(rawRefreshToken);
    const sessionRes = await Database.query<{
      user_id: string;
      is_revoked: boolean;
      expires_at: Date;
    }>(
      `SELECT user_id, is_revoked, expires_at FROM user_sessions WHERE refresh_token_hash = $1 LIMIT 1;`,
      [refreshTokenHash]
    );

    if (!sessionRes.rows[0] || sessionRes.rows[0].is_revoked || new Date(sessionRes.rows[0].expires_at) < new Date()) {
      throw new UnauthorizedError('Refresh token không hợp lệ hoặc đã hết hạn');
    }

    const user = await AuthRepository.findById(sessionRes.rows[0].user_id);
    if (!user || user.deleted_at !== null || user.status === 'LOCKED' || user.status === 'SUSPENDED') {
      throw new UnauthorizedError('Tài khoản người dùng đã bị khóa hoặc không tồn tại');
    }

    const payload: JwtPayload = {
      userId: user.id,
      username: user.username,
      role: user.role,
      assignedZoneId: user.assigned_zone_id,
      fullName: user.full_name,
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn as any,
    });

    return {
      accessToken,
      expiresIn: 604800,
    };
  }

  static async logout(rawRefreshToken?: string) {
    if (rawRefreshToken) {
      const refreshTokenHash = CryptoUtils.sha256(rawRefreshToken);
      await AuthRepository.revokeSession(refreshTokenHash);
    }
  }

  static async getProfile(userId: string) {
    const user = await AuthRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('Không tìm thấy thông tin người dùng');
    }
    return toSafeUserDto(user);
  }

  static async updateProfile(
    userId: string,
    data: {
      fullName?: string;
      email?: string | null;
      phone?: string | null;
      signatureImageUrl?: string | null;
    }
  ) {
    const user = await AuthRepository.updateUser(userId, data);
    if (!user) {
      throw new NotFoundError('Không tìm thấy tài khoản người dùng');
    }
    return toSafeUserDto(user);
  }

  // --- SUPER ADMIN USER LIFECYCLE ---

  static async listUsers(filters: any) {
    const result = await AuthRepository.listUsers(filters);
    return {
      users: result.users.map(toSafeUserDto),
      total: result.total,
    };
  }

  static async getUserById(id: string) {
    const user = await AuthRepository.findById(id);
    if (!user) {
      throw new NotFoundError(`Không tìm thấy tài khoản với ID: ${id}`);
    }
    return toSafeUserDto(user);
  }

  static async createUser(userData: {
    username: string;
    password: string;
    fullName: string;
    email?: string | null;
    phone?: string | null;
    role: string;
    assignedZoneId?: string | null;
    signatureImageUrl?: string | null;
    createdByUserId?: string | null;
  }) {
    const existing = await AuthRepository.findRawByUsername(userData.username);
    if (existing) {
      if (existing.deleted_at === null) {
        throw new ConflictError(`Tên đăng nhập [${userData.username}] đã tồn tại trong hệ thống`);
      }

      // PHƯƠNG ÁN B: Kích hoạt lại (Restore) tài khoản cũ đã bị soft-delete
      const passwordHash = await CryptoUtils.hashPassword(userData.password);
      let surveyorCode = existing.surveyor_code;
      if (userData.role === 'SURVEYOR' && !surveyorCode) {
        surveyorCode = await AuthRepository.generateUniqueSurveyorCode();
      } else if (userData.role !== 'SURVEYOR') {
        surveyorCode = null;
      }

      const restoredUser = await AuthRepository.restoreAndOverwriteUser(existing.id, {
        passwordHash,
        fullName: userData.fullName,
        email: userData.email,
        phone: userData.phone,
        role: userData.role,
        assignedZoneId: userData.assignedZoneId,
        signatureImageUrl: userData.signatureImageUrl || existing.signature_image_url || null,
        surveyorCode,
      });

      await AuthRepository.logSystemAudit({
        entityType: 'USER',
        entityId: existing.id,
        action: 'USER_RESTORED_ON_RECREATE',
        performedByUserId: userData.createdByUserId || null,
        diffPayload: { username: userData.username, role: userData.role, restored: true },
      });

      return toSafeUserDto(restoredUser);
    }

    const passwordHash = await CryptoUtils.hashPassword(userData.password);
    const user = await AuthRepository.createUser({
      username: userData.username,
      passwordHash,
      fullName: userData.fullName,
      email: userData.email,
      phone: userData.phone,
      role: userData.role,
      assignedZoneId: userData.assignedZoneId,
      signatureImageUrl: userData.signatureImageUrl,
      createdByUserId: userData.createdByUserId,
    });

    await AuthRepository.logSystemAudit({
      entityType: 'USER',
      entityId: user.id,
      action: 'USER_CREATED',
      performedByUserId: userData.createdByUserId || null,
      diffPayload: { username: user.username, role: user.role },
    });

    return toSafeUserDto(user);
  }

  static async updateUser(
    id: string,
    data: {
      fullName?: string;
      email?: string | null;
      phone?: string | null;
      role?: string;
      assignedZoneId?: string | null;
      signatureImageUrl?: string | null;
    },
    performedByUserId?: string | null
  ) {
    const user = await AuthRepository.updateUser(id, data);
    if (!user) {
      throw new NotFoundError(`Không tìm thấy tài khoản với ID: ${id}`);
    }

    await AuthRepository.logSystemAudit({
      entityType: 'USER',
      entityId: id,
      action: 'USER_UPDATED',
      performedByUserId: performedByUserId || null,
      diffPayload: data,
    });

    return toSafeUserDto(user);
  }

  static async updateStatus(id: string, status: string, reason?: string, performedByUserId?: string | null) {
    const user = await AuthRepository.updateStatus(id, status, reason);
    if (!user) {
      throw new NotFoundError(`Không tìm thấy tài khoản với ID: ${id}`);
    }
    if (status === 'LOCKED' || status === 'SUSPENDED') {
      await AuthRepository.revokeUserSessions(id);
    }

    await AuthRepository.logSystemAudit({
      entityType: 'USER',
      entityId: id,
      action: 'USER_STATUS_CHANGED',
      performedByUserId: performedByUserId || null,
      diffPayload: { status, reason },
    });

    return toSafeUserDto(user);
  }

  static async resetPassword(id: string, newPassword: string, performedByUserId?: string | null) {
    const user = await AuthRepository.findById(id);
    if (!user) {
      throw new NotFoundError(`Không tìm thấy tài khoản với ID: ${id}`);
    }
    const passwordHash = await CryptoUtils.hashPassword(newPassword);
    await AuthRepository.updatePassword(id, passwordHash);
    await AuthRepository.revokeUserSessions(id);

    await AuthRepository.logSystemAudit({
      entityType: 'USER',
      entityId: id,
      action: 'PASSWORD_RESET',
      performedByUserId: performedByUserId || null,
      diffPayload: { username: user.username },
    });

    return { message: 'Đặt lại mật khẩu thành công' };
  }

  static async deleteUser(id: string, performedByUserId?: string | null) {
    const user = await AuthRepository.findById(id);
    if (!user) {
      throw new NotFoundError(`Không tìm thấy tài khoản với ID: ${id}`);
    }
    await AuthRepository.softDeleteUser(id);
    await AuthRepository.revokeUserSessions(id);

    await AuthRepository.logSystemAudit({
      entityType: 'USER',
      entityId: id,
      action: 'USER_DELETED',
      performedByUserId: performedByUserId || null,
      diffPayload: { username: user.username },
    });

    return { message: 'Đã vô hiệu hóa tài khoản thành công (Bảo toàn lịch sử)' };
  }
}

