import { z } from 'zod';

const gpsAccuracy = z.number().min(0).max(100000).optional().nullable();

export const CheckInDto = z
  .object({
    zoneId: z.string().min(1, 'Mã phân khu Ga không được để trống'),
    gpsLatitude: z.number().min(-90).max(90),
    gpsLongitude: z.number().min(-180).max(180),
    gpsAccuracyMeters: gpsAccuracy,
    selfiePhotoUrl: z.string().min(1, 'Ảnh chụp selfie xác thực là bắt buộc'),
    notes: z.string().optional().nullable(),
    isCompanion: z.boolean().optional().default(false),
    companionName: z.string().max(128).optional().nullable(),
    companionRole: z.string().max(128).optional().nullable(),
    companionPhone: z.string().max(32).optional().nullable(),
  })
  .superRefine((val, ctx) => {
    if (val.isCompanion && (!val.companionName || !val.companionName.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['companionName'],
        message: 'Họ tên cán bộ đi kèm là bắt buộc khi điểm danh người đi cùng',
      });
    }
  });

export const CheckOutDto = z.object({
  checkInId: z.string().uuid('ID lượt chấm công không hợp lệ').optional().nullable(),
  /** Bản PWA cũ còn gửi zoneId: chấp nhận nhưng bỏ qua — Zone Check-out luôn là Zone của ca. */
  zoneId: z.string().optional().nullable(),
  gpsLatitude: z.number().min(-90).max(90),
  gpsLongitude: z.number().min(-180).max(180),
  gpsAccuracyMeters: gpsAccuracy,
  selfiePhotoUrl: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  isCompanion: z.boolean().optional().default(false),
});

export const VerifyAttendanceDto = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'FLAG_WARNING', 'RESET_PENDING']),
  notes: z.string().max(2000).optional().nullable(),
});

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải có dạng YYYY-MM-DD')
  .optional()
  .nullable();

export const BatchVerifyCleanDto = z.object({
  zoneId: z.string().optional().nullable(),
  fromDate: dateString,
  toDate: dateString,
  isCompanion: z.boolean().optional().nullable(),
  search: z.string().max(128).optional().nullable(),
  dryRun: z.boolean().optional().default(false),
});

const monthString = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Tháng phải có dạng YYYY-MM');

export const PeriodLockDto = z.object({
  zoneId: z.string().optional().nullable(),
  month: monthString,
});

export const PeriodUnlockDto = z.object({
  zoneId: z.string().optional().nullable(),
  month: monthString,
  reason: z.string().trim().min(5, 'Lý do mở khóa tối thiểu 5 ký tự').max(2000),
});

export const ATTENDANCE_STATUS_VALUES = ['PENDING_VERIFICATION', 'APPROVED', 'FLAGGED_WARNING', 'REJECTED'] as const;
export const ATTENDANCE_ANOMALY_FILTERS = [
  'ANY',
  'NONE',
  'DISTANCE_OVER_500M_IN',
  'DISTANCE_OVER_500M_OUT',
  'SHORT_DURATION',
  'ZONE_NOT_ASSIGNED',
  'MISSING_CHECKOUT',
] as const;
