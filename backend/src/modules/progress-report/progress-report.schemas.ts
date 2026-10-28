import { z } from 'zod';

export const progressQuerySchema = z
  .object({
    zoneId: z.string().trim().min(1).max(32).optional(),
    timeMode: z.enum(['TODAY', 'DATE_RANGE', 'ALL_TIME']).default('ALL_TIME'),
    fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'fromDate phải dạng YYYY-MM-DD').optional(),
    toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'toDate phải dạng YYYY-MM-DD').optional(),
    templateId: z.string().trim().max(64).optional(),
    format: z.enum(['xlsx']).default('xlsx'),
  })
  .superRefine((v, ctx) => {
    if (v.timeMode !== 'DATE_RANGE') return;
    if (!v.fromDate || !v.toDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['fromDate'], message: 'Chế độ DATE_RANGE yêu cầu fromDate và toDate' });
      return;
    }
    if (v.fromDate > v.toDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['toDate'], message: 'toDate phải lớn hơn hoặc bằng fromDate' });
    }
  });

export type ProgressQuery = z.infer<typeof progressQuerySchema>;

