import { z } from 'zod';

export const CheckInDto = z
  .object({
    zoneId: z.string().min(1, 'Mã phân khu Ga không được để trống'),
    gpsLatitude: z.number().min(-90).max(90),
    gpsLongitude: z.number().min(-180).max(180),
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
  zoneId: z.string().optional().nullable(),
  gpsLatitude: z.number().min(-90).max(90),
  gpsLongitude: z.number().min(-180).max(180),
  selfiePhotoUrl: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  isCompanion: z.boolean().optional().default(false),
});

export const VerifyAttendanceDto = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'FLAG_WARNING']),
  notes: z.string().optional().nullable(),
});
