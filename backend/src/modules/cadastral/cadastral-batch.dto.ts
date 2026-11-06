import { z } from 'zod';

/** Giới hạn mỗi lô để transaction FOR UPDATE không giữ khóa quá lâu. */
export const BATCH_MAX_PARCELS = 500;

const ParcelIdsSchema = z
  .array(z.string().uuid('Mã thửa đất không hợp lệ'))
  .min(1, 'Vui lòng chọn ít nhất 1 thửa đất')
  .max(BATCH_MAX_PARCELS, `Mỗi lô tối đa ${BATCH_MAX_PARCELS} thửa đất`)
  .transform((ids) => Array.from(new Set(ids)));

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const BatchLocalAuthorityDto = z.object({
  parcelIds: ParcelIdsSchema,
  name: z.string().trim().min(2, 'Họ tên đại diện tối thiểu 2 ký tự').max(128),
  role: optionalText(128),
  phone: optionalText(32),
});
export type BatchLocalAuthorityInput = z.infer<typeof BatchLocalAuthorityDto>;

export const BatchAddressPreviewDto = z.object({
  parcelIds: ParcelIdsSchema,
});

export const BatchParcelAddressItemDto = z.object({
  parcelId: z.string().uuid('Mã thửa đất không hợp lệ'),
  houseNumber: z.string().trim().max(64),
  street: z.string().trim().min(1, 'Tên đường không được để trống').max(128),
  ward: z.string().trim().min(1, 'Phường không được để trống').max(64),
  district: z.string().trim().max(64),
});
export type BatchParcelAddressItem = z.infer<typeof BatchParcelAddressItemDto>;

export const BatchSyncAddressDto = z.object({
  items: z
    .array(BatchParcelAddressItemDto)
    .min(1, 'Vui lòng chọn ít nhất 1 thửa đất để cập nhật')
    .max(BATCH_MAX_PARCELS, `Mỗi lô tối đa ${BATCH_MAX_PARCELS} thửa đất`)
    .refine((items) => new Set(items.map((i) => i.parcelId)).size === items.length, 'Danh sách có thửa đất bị trùng'),
});
export type BatchSyncAddressInput = z.infer<typeof BatchSyncAddressDto>;

export const BatchExcludeDto = z.object({
  parcelIds: ParcelIdsSchema,
  exclusionType: z.enum(['ROAD_TRAFFIC', 'VACANT_LAND', 'CLICK_MISTAKE', 'TRAINING_DEMO', 'DUPLICATE']),
  reason: z.string().trim().min(3, 'Lý do loại trừ tối thiểu 3 ký tự').max(500),
});
export type BatchExcludeInput = z.infer<typeof BatchExcludeDto>;

export const BatchRestoreDto = z.object({
  parcelIds: ParcelIdsSchema,
  reason: z.string().trim().min(3, 'Lý do khôi phục tối thiểu 3 ký tự').max(500),
});
export type BatchRestoreInput = z.infer<typeof BatchRestoreDto>;

export const LocalAuthoritySuggestionQueryDto = z.object({
  zoneId: z.string().trim().min(1, 'Thiếu mã phân khu').max(32),
});
