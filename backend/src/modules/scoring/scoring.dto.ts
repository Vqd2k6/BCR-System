import { z } from 'zod';

export const EngineeringJudgementDto = z.object({
  action: z.enum(['KEEP', 'UPGRADE', 'DOWNGRADE']),
  reason: z.string().min(5, 'Lý do can thiệp kỹ sư tối thiểu 5 ký tự'),
});
