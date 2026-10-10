import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import {
  CreateUserDto,
  UpdateUserDto,
  UpdateUserStatusDto,
  ResetPasswordDto,
} from './auth.dto';
import { BadRequestError } from '../../common/errors/problem-details';

export class UserAdminController {
  static async listUsers(req: Request, res: Response, next: NextFunction) {
    try {
      let zoneId = req.query.zoneId as string;
      // Nếu là ZONE_ADMIN, bắt buộc chỉ được xem nhân sự thuộc Ga/Zone của mình
      if ((req as any).user?.role === 'ZONE_ADMIN') {
        zoneId = (req as any).user.assignedZoneId || 'NONE';
      }

      const filters = {
        role: req.query.role as string,
        zoneId,
        status: req.query.status as string,
        search: req.query.search as string,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
      };

      const result = await AuthService.listUsers(filters);
      res.status(200).json({
        success: true,
        data: result.users,
        pagination: {
          total: result.total,
          limit: filters.limit,
          offset: filters.offset,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getUserById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const user = await AuthService.getUserById(id);
      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  static async createUser(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = CreateUserDto.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(
          'Dữ liệu tạo người dùng không hợp lệ',
          parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))
        );
      }

      const createdByUserId = parsed.data.createdByUserId || (req as any).user?.userId || (req as any).user?.id || null;
      const user = await AuthService.createUser({
        ...parsed.data,
        createdByUserId,
      });
      res.status(201).json({
        success: true,
        message: 'Cấp tài khoản mới thành công',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const parsed = UpdateUserDto.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(
          'Dữ liệu cập nhật người dùng không hợp lệ',
          parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))
        );
      }

      const currentUserId = (req as any).user?.userId || (req as any).user?.id;
      // Chốt chặn tự hạ quyền: SuperAdmin không thể tự đổi vai trò của mình thành role khác
      if (id === currentUserId && parsed.data.role && parsed.data.role !== 'SUPER_ADMIN') {
        throw new BadRequestError('Không thể tự hạ quyền quản trị tối cao của chính mình');
      }

      const user = await AuthService.updateUser(id, parsed.data, currentUserId);
      res.status(200).json({
        success: true,
        message: 'Cập nhật thông tin tài khoản thành công',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const parsed = UpdateUserStatusDto.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(
          'Trạng thái không hợp lệ',
          parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))
        );
      }

      const currentUserId = (req as any).user?.userId || (req as any).user?.id;
      // Chốt chặn tự khóa: SuperAdmin không thể tự khóa/tạm ngưng tài khoản của chính mình
      if (id === currentUserId) {
        throw new BadRequestError('Không thể tự khóa hoặc tạm ngưng tài khoản của chính mình');
      }

      const user = await AuthService.updateStatus(id, parsed.data.status, parsed.data.reason, currentUserId);
      res.status(200).json({
        success: true,
        message: `Đã cập nhật trạng thái tài khoản thành [${parsed.data.status}]`,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  static async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const parsed = ResetPasswordDto.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(
          'Mật khẩu mới không hợp lệ',
          parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))
        );
      }

      const currentUserId = (req as any).user?.userId || (req as any).user?.id;
      const result = await AuthService.resetPassword(id, parsed.data.newPassword, currentUserId);
      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const currentUserId = (req as any).user?.userId || (req as any).user?.id;
      // Chốt chặn tự xóa: SuperAdmin không thể tự vô hiệu hóa tài khoản của chính mình
      if (id === currentUserId) {
        throw new BadRequestError('Không thể tự vô hiệu hóa tài khoản của chính mình');
      }

      const result = await AuthService.deleteUser(id, currentUserId);
      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }
}

