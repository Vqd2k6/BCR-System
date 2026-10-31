import { z } from 'zod';

export const ApproveReportDto = z.object({
  judgementNotes: z.string().optional(),
});

export const RejectReportDto = z.object({
  rejectionReason: z.string().min(5, 'Lý do trả về báo cáo phải từ 5 ký tự trở lên'),
});

export const RevertReportToDraftDto = z.object({
  unitId: z.string().optional().nullable(),
  reason: z.string().optional(),
});

export const BatchApproveUnitsDto = z.object({
  reportIds: z.array(z.string().uuid()).min(1, 'Cần chọn ít nhất 1 hồ sơ để duyệt').max(100, 'Tối đa 100 hồ sơ mỗi lần duyệt'),
  judgementNotes: z.string().optional(),
});

export const ApproveAbsenteeReportDto = z.object({
  judgementNotes: z.string().optional(),
});

export const ExecuteFinalSealDto = z.object({
  sealNotes: z.string().optional(),
});

export const RollbackVersionDto = z.object({
  adminPassword: z.string().min(1, 'Bắt buộc nhập mật khẩu tài khoản để xác thực quyền khôi phục'),
  rollbackReason: z.string().min(5, 'Lý do hoàn nguyên kỹ thuật phải từ 5 ký tự trở lên'),
  confirmZoneWipe: z.boolean().optional(),
});

export const AdminSurveyEditDto = z.object({
  adminPassword: z.string().min(1, 'Mật khẩu xác thực Zone Admin là bắt buộc'),
  editReason: z.string().min(5, 'Lý do điều chỉnh kỹ thuật phải từ 5 ký tự trở lên'),
  diffPayload: z
    .array(
      z.object({
        field: z.string(),
        label: z.string(),
        oldValue: z.unknown(),
        newValue: z.unknown(),
      })
    )
    .optional(),
  updates: z.record(z.unknown()),
  photoActions: z.array(z.unknown()).optional(),
});

export const AcquireLockDto = z.object({
  reportId: z.string().uuid().optional(),
});

export const ReleaseLockDto = z.object({
  force: z.boolean().optional(),
});

