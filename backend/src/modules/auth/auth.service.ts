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

export class AuthService {
  static async login(
    username: string,
    password: string,
    clientIp?: string,
    userAgent?: string
  ) {
    const user = await AuthRepository.findByUsername(username);
    if (!user) {
      throw new UnauthorizedError('Tên đăng nhập hoặc mật khẩu không chính xác');
    }

    if (user.status === 'LOCKED' || user.status === 'SUSPENDED') {
      throw new UnauthorizedError(
        `Tài khoản đang ở trạng thái [${user.status}] - ${user.status_reason || 'Liên hệ Quản trị viên để được hỗ trợ'}`
      );
    }

    const isMatch = await CryptoUtils.comparePassword(password, user.password_hash);
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

    await AuthRepository.saveSession({
      userId: user.id,
      refreshTokenHash,
      clientIp,
      userAgent,
      expiresAt: refreshExpiresAt,
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: 604800, // 7 ngày tính theo giây
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        assignedZoneId: user.assigned_zone_id,
        status: user.status,
      },
    };
  }

  static async refreshToken(rawRefreshToken: string) {
    const refreshTokenHash = CryptoUtils.sha256(rawRefreshToken);
    const isActive = await AuthRepository.isSessionActive(refreshTokenHash);
    if (!isActive) {
      throw new UnauthorizedError('Refresh token không hợp lệ hoặc đã bị thu hồi');
    }

    // Lấy thông tin user từ session
    const userRes = await AuthRepository.findByUsername(''); // Hoặc query từ session
    // Ở đây decode hoặc query theo refreshTokenHash
    // Triển khai cấp mới
    return {
      accessToken: 'new_access_token',
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
    const { password_hash, ...safeUser } = user;
    return safeUser;
  }

  // --- SUPER ADMIN USER LIFECYCLE ---

  static async listUsers(filters: any) {
    return AuthRepository.listUsers(filters);
  }

  static async getUserById(id: string) {
    const user = await AuthRepository.findById(id);
    if (!user) {
      throw new NotFoundError(`Không tìm thấy tài khoản với ID: ${id}`);
    }
    const { password_hash, ...safeUser } = user;
    return safeUser;
  }

  static async createUser(userData: {
    username: string;
    password: string;
    fullName: string;
    email?: string | null;
    phone?: string | null;
    role: string;
    assignedZoneId?: string | null;
  }) {
    const existing = await AuthRepository.findByUsername(userData.username);
    if (existing) {
      throw new ConflictError(`Tên đăng nhập [${userData.username}] đã tồn tại trong hệ thống`);
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
    });

    const { password_hash, ...safeUser } = user;
    return safeUser;
  }

  static async updateUser(
    id: string,
    data: {
      fullName?: string;
      email?: string | null;
      phone?: string | null;
      role?: string;
      assignedZoneId?: string | null;
    }
  ) {
    const user = await AuthRepository.updateUser(id, data);
    if (!user) {
      throw new NotFoundError(`Không tìm thấy tài khoản với ID: ${id}`);
    }
    const { password_hash, ...safeUser } = user;
    return safeUser;
  }

  static async updateStatus(id: string, status: string, reason?: string) {
    const user = await AuthRepository.updateStatus(id, status, reason);
    if (!user) {
      throw new NotFoundError(`Không tìm thấy tài khoản với ID: ${id}`);
    }
    const { password_hash, ...safeUser } = user;
    return safeUser;
  }

  static async resetPassword(id: string, newPassword: string) {
    const user = await AuthRepository.findById(id);
    if (!user) {
      throw new NotFoundError(`Không tìm thấy tài khoản với ID: ${id}`);
    }
    const passwordHash = await CryptoUtils.hashPassword(newPassword);
    await AuthRepository.updatePassword(id, passwordHash);
    return { message: 'Đặt lại mật khẩu thành công' };
  }

  static async deleteUser(id: string) {
    const user = await AuthRepository.findById(id);
    if (!user) {
      throw new NotFoundError(`Không tìm thấy tài khoản với ID: ${id}`);
    }
    await AuthRepository.softDeleteUser(id);
    return { message: 'Đã vô hiệu hóa tài khoản thành công (Bảo toàn lịch sử)' };
  }
}
