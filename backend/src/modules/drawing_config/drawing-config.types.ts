import { z } from 'zod';
import { ZONE_SEGMENT_PREFIX_MAP } from '../../common/constants/zone-prefixes';

/**
 * Cấu hình khung tên bình đồ CAD theo Zone (Super Admin).
 * Thiếu bản ghi -> frontend dùng giá trị trên bản vẽ mẫu PDF; backend không tự bịa giá trị mặc định.
 */

export const ZoneCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine((code) => code in ZONE_SEGMENT_PREFIX_MAP, 'Mã Zone không tồn tại');

const personName = z.string().trim().max(80, 'Tối đa 80 ký tự');

export const UpdateTitleBlockDto = z.object({
  preparedBy: personName,
  reviewedBy: personName,
  approvedBy: personName,
  manager: personName,
  projectManager: personName,
  drawingNo: z.string().trim().max(60, 'Số bản vẽ tối đa 60 ký tự'),
});

export const CreateRevisionDto = z.object({
  issueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phát hành phải theo định dạng YYYY-MM-DD')
    .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'Ngày phát hành không hợp lệ'),
  description: z.string().trim().min(3, 'Nội dung sửa đổi tối thiểu 3 ký tự').max(200, 'Tối đa 200 ký tự'),
});

export type UpdateTitleBlockInput = z.infer<typeof UpdateTitleBlockDto>;
export type CreateRevisionInput = z.infer<typeof CreateRevisionDto>;

export interface ZoneDrawingTitleBlock extends UpdateTitleBlockInput {
  id: string;
  zoneCode: string;
  updatedByName: string | null;
  updatedAt: string;
}

export interface ZoneDrawingRevision {
  id: string;
  /** R00, R01, ... */
  revision: string;
  revisionNumber: number;
  /** YYYY-MM-DD */
  issueDate: string;
  description: string;
  createdByName: string | null;
  createdAt: string;
}

export interface ZoneDrawingConfig {
  zoneCode: string;
  /** null = Zone chưa có cấu hình, dùng giá trị bản vẽ mẫu */
  titleBlock: ZoneDrawingTitleBlock | null;
  revisions: ZoneDrawingRevision[];
}

export const formatRevisionLabel = (revisionNumber: number): string =>
  `R${String(revisionNumber).padStart(2, '0')}`;
