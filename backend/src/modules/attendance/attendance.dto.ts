import { z } from 'zod';

export const CheckInDto = z.object({
  zoneId: z.string().min(1, 'Mã phân khu Ga không được để trống'),
  gpsLatitude: z.number().min(-90).max(90),
  gpsLongitude: z.number().min(-180).max(180),
  selfiePhotoUrl: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const VerifyAttendanceDto = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'FLAG_WARNING']),
  notes: z.string().optional().nullable(),
});
