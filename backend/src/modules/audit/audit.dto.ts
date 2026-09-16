import { z } from 'zod';

export const ApproveReportDto = z.object({
  judgementNotes: z.string().optional(),
});

export const RejectReportDto = z.object({
  rejectionReason: z.string().min(5, 'Lý do trả về báo cáo phải từ 5 ký tự trở lên'),
});
