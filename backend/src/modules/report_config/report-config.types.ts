import { z } from 'zod';

/**
 * Cấu hình nội dung chuẩn báo cáo (Q1) & danh mục thiết bị dự án (Q5).
 * Báo cáo chỉ in nội dung lấy từ cấu hình này – không còn văn bản khuôn mẫu tự sinh trong code.
 */

const BilingualTextSchema = z.object({
  vi: z.string().trim().min(1, 'Nội dung tiếng Việt không được để trống').max(2000),
  en: z.string().trim().max(2000).default(''),
});

export const StandardTextContentSchema = z.object({
  recommendations: z.array(BilingualTextSchema).max(20),
  pendingItems: z.array(BilingualTextSchema).max(20),
  calibrationNote: BilingualTextSchema.nullable(),
  asteriskFootnote: BilingualTextSchema.nullable(),
});

export type BilingualText = z.infer<typeof BilingualTextSchema>;
export type StandardTextContent = z.infer<typeof StandardTextContentSchema>;

export const CreateStandardTextVersionDto = z.object({
  content: StandardTextContentSchema,
  changeReason: z.string().trim().min(5, 'Lý do thay đổi tối thiểu 5 ký tự').max(1000),
});

const optionalText = z
  .string()
  .trim()
  .max(200)
  .nullish()
  .transform((v) => (v ? v : null));

export const EquipmentInputDto = z.object({
  sortOrder: z.number().int().min(0).max(999).default(0),
  nameVi: z.string().trim().min(2, 'Tên thiết bị tối thiểu 2 ký tự').max(200),
  nameEn: z.string().trim().max(200).default(''),
  specificationVi: z.string().trim().max(300).default(''),
  specificationEn: z.string().trim().max(300).default(''),
  purposeVi: z.string().trim().max(300).default(''),
  purposeEn: z.string().trim().max(300).default(''),
  model: optionalText,
  serialNo: optionalText,
  calibrationCertNo: optionalText,
  calibrationValidTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày hiệu lực dạng YYYY-MM-DD')
    .nullish()
    .transform((v) => v || null),
});

export type EquipmentInput = z.infer<typeof EquipmentInputDto>;

export interface SurveyEquipmentItem {
  id: string;
  sortOrder: number;
  nameVi: string;
  nameEn: string;
  specificationVi: string;
  specificationEn: string;
  purposeVi: string;
  purposeEn: string;
  model: string | null;
  serialNo: string | null;
  calibrationCertNo: string | null;
  /** YYYY-MM-DD */
  calibrationValidTo: string | null;
}

export interface StandardTextVersion {
  id: string;
  versionNumber: number;
  content: StandardTextContent;
  changeReason: string;
  createdByUserId: string | null;
  createdByName: string | null;
  createdAt: string;
}

/** Cấu hình dùng để render 1 báo cáo (bản nháp: hiệu lực hiện hành; bản FINAL: bản đã ghim khi phát hành). */
export interface ReportContentConfig {
  standardTextVersionId: string | null;
  standardTextVersionNumber: number | null;
  standardText: StandardTextContent;
  equipment: SurveyEquipmentItem[];
}

/** Dùng khi CSDL chưa có cấu hình (chưa chạy migration): không in văn bản khuôn mẫu nào. */
export const EMPTY_STANDARD_TEXT: StandardTextContent = {
  recommendations: [],
  pendingItems: [],
  calibrationNote: null,
  asteriskFootnote: null,
};
