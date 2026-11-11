import { z } from 'zod';

const RATIO_TOLERANCE = 0.03;

export const PhotoQcCropSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().gt(0.01).max(1),
    h: z.number().gt(0.01).max(1),
    ratio: z.enum(['4:3', '3:4']),
    rotationAtCrop: z.number().int().refine((d) => ((d % 360) + 360) % 90 === 0, 'Góc xoay phải là bội số 90°'),
    /** Kích thước ảnh đã xoay tại lúc crop (px), để kiểm tỉ lệ khung thật sự là 4:3 / 3:4. */
    imageWidth: z.number().positive(),
    imageHeight: z.number().positive(),
  })
  .refine((c) => c.x + c.w <= 1.000001 && c.y + c.h <= 1.000001, 'Khung crop vượt ra ngoài ảnh')
  .refine((c) => {
    const target = c.ratio === '4:3' ? 4 / 3 : 3 / 4;
    const actual = (c.w * c.imageWidth) / (c.h * c.imageHeight);
    return Math.abs(actual - target) / target <= RATIO_TOLERANCE;
  }, 'Khung crop không đúng tỉ lệ 4:3 / 3:4');

export const UpdatePhotoQcReportSchema = z
  .object({
    coverSource: z.enum(['P04']).nullable().optional(),
    recaptureLevel: z.enum(['AUTO', 'NONE', 'OUTDOOR_ONLY', 'FULL']).optional(),
    reviewed: z.boolean().optional(),
  })
  .refine((b) => b.coverSource !== undefined || b.recaptureLevel !== undefined || b.reviewed !== undefined, 'Không có thay đổi nào');

export const UpdatePhotoQcPhotosSchema = z
  .array(
    z
      .object({
        photoKey: z.string().min(1).max(64),
        photoUrl: z.string().min(1).max(2048),
        crop: PhotoQcCropSchema.nullable().optional(),
        restampMode: z.enum(['NONE', 'LOGO', 'TEXT', 'BOTH']).optional(),
        recapture: z.boolean().optional(),
      })
      .refine((i) => i.crop !== undefined || i.restampMode !== undefined || i.recapture !== undefined, 'Ô ảnh không có thay đổi nào')
  )
  .min(1)
  .max(200);

export const ReviewPhotoQcCropsSchema = z
  .array(
    z.object({
      photoKey: z.string().min(1).max(64),
      photoUrl: z.string().min(1).max(2048),
      /** Khung crop admin đã xem: server chỉ ghi khi DB vẫn đúng khung này. */
      crop: z.object({
        x: z.number(),
        y: z.number(),
        w: z.number(),
        h: z.number(),
        rotationAtCrop: z.number().int(),
      }),
      decision: z.enum(['APPROVED', 'REJECTED', 'ADJUST']),
      /** Chỉ với ADJUST: khung crop Thẩm định vừa chỉnh, lưu là duyệt luôn. */
      newCrop: PhotoQcCropSchema.optional(),
    })
    .refine((i) => (i.decision === 'ADJUST') === Boolean(i.newCrop), 'ADJUST bắt buộc kèm khung crop mới (và chỉ ADJUST mới có)')
  )
  .min(1)
  .max(200);

export const PhotoQcListQuerySchema = z.object({
  station: z.string().max(16).optional(),
  zone: z.string().max(32).optional(),
  kind: z.enum(['HOUSE', 'MASTER', 'M', 'U']).optional(),
  filter: z.enum(['ALL', 'UNREVIEWED', 'FLAGGED', 'REVIEWED']).optional(),
  q: z.string().max(64).optional(),
  cursor: z.string().max(128).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const PhotoQcRecaptureQuerySchema = z.object({
  station: z.string().max(16).optional(),
  zone: z.string().max(32).optional(),
  level: z.enum(['OUTDOOR_ONLY', 'FULL']).optional(),
  format: z.enum(['json', 'xlsx']).optional(),
});

export type UpdatePhotoQcReportInput = z.infer<typeof UpdatePhotoQcReportSchema>;
export type UpdatePhotoQcPhotosInput = z.infer<typeof UpdatePhotoQcPhotosSchema>;
export type ReviewPhotoQcCropsInput = z.infer<typeof ReviewPhotoQcCropsSchema>;
export type PhotoQcListQuery = z.infer<typeof PhotoQcListQuerySchema>;
export type PhotoQcRecaptureQuery = z.infer<typeof PhotoQcRecaptureQuerySchema>;
