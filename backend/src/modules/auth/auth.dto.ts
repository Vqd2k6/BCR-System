import { z } from 'zod';

export const LoginDto = z.object({
  username: z.string().min(3, 'Tên đăng nhập phải có ít nhất 3 ký tự'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
});

export const RefreshTokenDto = z.object({
  refreshToken: z.string().min(10, 'Refresh token không hợp lệ'),
});

export const CreateUserDto = z.object({
  username: z.string().min(3, 'Tên đăng nhập phải từ 3 đến 64 ký tự').max(64),
  password: z.string().min(6, 'Mật khẩu phải từ 6 ký tự trở lên'),
  fullName: z.string().min(2, 'Họ tên không được để trống').max(128),
  email: z.string().email('Email không đúng định dạng').optional().nullable(),
  phone: z.string().min(8, 'Số điện thoại không hợp lệ').max(20).optional().nullable(),
  role: z.enum(['SUPER_ADMIN', 'ZONE_ADMIN', 'SURVEYOR', 'CONTRACTOR']),
  assignedZoneId: z.string().max(32).optional().nullable(),
  signatureImageUrl: z.string().optional().nullable(),
  createdByUserId: z.string().uuid().optional().nullable(),
});

export const UpdateUserDto = z.object({
  fullName: z.string().min(2).max(128).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().min(8).max(20).optional().nullable(),
  role: z.enum(['SUPER_ADMIN', 'ZONE_ADMIN', 'SURVEYOR', 'CONTRACTOR']).optional(),
  assignedZoneId: z.string().max(32).optional().nullable(),
  signatureImageUrl: z.string().optional().nullable(),
});

export const UpdateProfileDto = z.object({
  fullName: z.string().min(2, 'Họ tên phải từ 2 ký tự').max(128).optional(),
  email: z.string().email('Email không đúng định dạng').optional().nullable(),
  phone: z.string().min(8, 'Số điện thoại phải từ 8 số trở lên').max(20).optional().nullable(),
  signatureImageUrl: z.string().optional().nullable(),
});

export const UpdateUserStatusDto = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'LOCKED']),
  reason: z.string().min(3, 'Lý do thay đổi trạng thái phải từ 3 ký tự').optional(),
});

export const ResetPasswordDto = z.object({
  newPassword: z.string().min(6, 'Mật khẩu mới phải từ 6 ký tự trở lên'),
});
