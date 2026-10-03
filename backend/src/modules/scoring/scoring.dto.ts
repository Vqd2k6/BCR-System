import { z } from 'zod';

export const EngineeringJudgementDto = z.object({
  action: z.enum(['KEEP', 'UPGRADE', 'DOWNGRADE', 'CUSTOM_OVERRIDE']),
  reason: z.string().min(10, 'Lý do can thiệp kỹ sư tối thiểu 10 ký tự để đảm bảo căn cứ pháp lý'),
  engineerName: z.string().optional(),
  overrides: z
    .object({
      burlandGrade: z.number().min(0).max(5).optional(),
      totalEcs: z.number().min(0).max(24).optional(),
      ecsClass: z.enum(['GOOD', 'MEDIUM', 'DEFICIENT', 'CRITICAL']).optional(),
      importanceScore: z.number().min(0).max(4).optional(),
      avgVi: z.number().min(0).max(4).optional(),
      viClass: z.enum(['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH']).optional(),
      impactLevelI: z.number().min(1).max(3).optional(),
      bra: z.string().optional(),
    })
    .optional(),
});

