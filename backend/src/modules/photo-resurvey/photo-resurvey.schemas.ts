import { z } from 'zod';
import { NA_REASON_MIN_LENGTH, REJECT_NOTE_MIN_LENGTH, RESURVEY_SLOT_CODES } from './photo-resurvey.rules';

/** Ảnh JPEG đã nén phía client (cạnh dài ≤ 2048px): base64 tối đa ~12 MB. */
const MAX_BASE64_LENGTH = 16 * 1024 * 1024;

export const UuidSchema = z.string().uuid();

const SlotCodeSchema = z.enum(RESURVEY_SLOT_CODES as unknown as [string, ...string[]]);

const CaptureMetaSchema = z.object({
  /** Time 1 theo đồng hồ máy KSV (ISO). Server lưu thêm giờ nhận ảnh riêng. */
  capturedAtClient: z.string().datetime({ offset: true }).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  accuracyM: z.number().min(0).max(100000).optional(),
  rotation: z
    .number()
    .int()
    .refine((d) => ((d % 360) + 360) % 90 === 0, 'Góc xoay phải là bội số 90°')
    .optional(),
});

export const UploadResurveyPhotoSchema = z.discriminatedUnion('action', [
  CaptureMetaSchema.extend({
    action: z.literal('REPLACE'),
    photoKey: z.string().min(1).max(64),
    base64: z.string().min(100).max(MAX_BASE64_LENGTH),
  }),
  CaptureMetaSchema.extend({
    action: z.literal('ADD_EXTRA'),
    slotCode: SlotCodeSchema,
    base64: z.string().min(100).max(MAX_BASE64_LENGTH),
  }),
]);

export const MarkNaSchema = z.object({
  photoKey: z.string().min(1).max(64),
  reason: z.string().trim().min(NA_REASON_MIN_LENGTH, `Lý do N/A tối thiểu ${NA_REASON_MIN_LENGTH} ký tự`).max(500),
});

export const RotateItemSchema = z.object({
  rotation: z.number().int().refine((d) => ((d % 360) + 360) % 90 === 0, 'Góc xoay phải là bội số 90°'),
});

export const ApproveSchema = z.object({
  /** Admin chỉnh Time 2 của ảnh phát sinh: itemId → ISO, phải nằm trong khoảng hợp lệ. */
  time2Overrides: z.record(z.string().uuid(), z.string().datetime({ offset: true })).optional(),
  note: z.string().trim().max(1000).optional(),
});

export const RejectSchema = z.object({
  note: z.string().trim().min(REJECT_NOTE_MIN_LENGTH, `Lý do từ chối tối thiểu ${REJECT_NOTE_MIN_LENGTH} ký tự`).max(1000),
});

export const TaskQuerySchema = z.object({
  zone: z.string().max(32).optional(),
  state: z.enum(['PENDING', 'SUBMITTED']).optional(),
});

export type UploadResurveyPhotoInput = z.infer<typeof UploadResurveyPhotoSchema>;
export type MarkNaInput = z.infer<typeof MarkNaSchema>;
export type ApproveInput = z.infer<typeof ApproveSchema>;
export type RejectInput = z.infer<typeof RejectSchema>;
export type TaskQuery = z.infer<typeof TaskQuerySchema>;
