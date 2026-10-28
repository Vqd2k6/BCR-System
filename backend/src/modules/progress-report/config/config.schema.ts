import { z } from 'zod';

/**
 * Schema cấu hình module Progress Report (lưu append-only trong progress_report_config_versions).
 * Super Admin chỉnh trên UI; mọi bản lưu đều được validate bằng schema này.
 */

const argb = z.string().regex(/^[0-9A-Fa-f]{8}$/, 'Màu phải ở dạng ARGB 8 ký tự hex (VD: FFFFFF00)');

const riskRuleSchema = z.object({
  ecsClasses: z.array(z.string().min(1)).default([]),
  braValues: z.array(z.string().min(1)).default([]),
  burlandMin: z.number().int().min(0).max(5).nullable().default(null),
});

export const sideOverrideSchema = z.object({
  ward: z.string().trim().optional().default(''),
  street: z.string().trim().optional().default(''),
  houseNumbers: z.array(z.string().trim().min(1)).optional().default([]),
  side: z.enum(['RIGHT', 'LEFT']),
  force: z.boolean().default(false),
});

export const progressReportConfigSchema = z.object({
  titlePrefix: z.string().min(3).max(200),
  newBuildingMinYear: z.number().int().min(1900).max(2100),
  highRisk: riskRuleSchema,
  monitor: riskRuleSchema.extend({ includeMonitoringRequired: z.boolean().default(true) }),
  degraded: z.object({ ecsClasses: z.array(z.string().min(1)).default([]) }),
  includeNotSurveyedRows: z.boolean().default(false),
  labels: z.object({
    condition: z.object({
      NEW: z.string().min(1),
      OLD: z.string().min(1),
      DEGRADED: z.string().min(1),
      MONITOR: z.string().min(1),
      HIGH_RISK: z.string().min(1),
      INACCESSIBLE: z.string().min(1),
    }),
    surveyProgress: z.object({
      IN_PROGRESS: z.string().min(1),
      SURVEY_DONE_REPORTING: z.string().min(1),
      REPORT_DONE: z.string().min(1),
      REPORT_SIGNED: z.string().min(1),
    }),
    sideRight: z.string().min(1),
    sideLeft: z.string().min(1),
    sideUnknown: z.string(),
  }),
  colors: z.object({
    header: argb,
    legend: argb,
    total: argb,
    MONITOR: argb,
    HIGH_RISK: argb,
    INACCESSIBLE: argb,
  }),
  sideOverrides: z.array(sideOverrideSchema).default([]),
});

export type ProgressReportConfig = z.infer<typeof progressReportConfigSchema>;
export type SideOverride = z.infer<typeof sideOverrideSchema>;

export const saveConfigBodySchema = z.object({
  content: progressReportConfigSchema,
  changeReason: z.string().trim().min(5, 'Lý do thay đổi tối thiểu 5 ký tự'),
});

