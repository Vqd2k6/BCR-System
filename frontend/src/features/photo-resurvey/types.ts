/**
 * Kiểu dữ liệu Khảo sát bổ sung (chụp lại ảnh ngoài nhà dân) – khớp backend `photo-resurvey.types.ts`.
 */

export type ResurveyStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED';
export type ResurveyAction = 'REPLACE' | 'ADD_EXTRA' | 'MARK_NA';
export type ResurveyApplyStatus = 'PENDING' | 'APPLIED' | 'DECLINED';
export type ResurveySlotCode = 'P-01' | 'P-02' | 'P-03' | 'P-04' | 'P-05' | 'P-06' | 'P-07';
export type ResurveyTime2Source = 'ORIGINAL' | 'INTERPOLATED' | 'DATE_ONLY' | 'ADMIN';
export type ResurveyMarkerState = 'PENDING' | 'SUBMITTED';

export interface ResurveySessionRow {
  id: string;
  reportId: string;
  parcelId: string;
  zoneId: string | null;
  status: ResurveyStatus;
  surveyorId: string | null;
  surveyorName: string | null;
  submittedAt: string | null;
  submittedSha256: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  rejectCount: number;
  approvedSha256: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResurveyItemRow {
  id: string;
  resurveyId: string;
  action: ResurveyAction;
  slotCode: ResurveySlotCode;
  photoKey: string | null;
  originalUrl: string | null;
  extraIndex: number | null;
  newUrl: string | null;
  newSha256: string | null;
  rotation: number;
  naReason: string | null;
  time2Text: string | null;
  time2At: string | null;
  time2Source: ResurveyTime2Source | null;
  capturedAtClient: string | null;
  receivedAt: string;
  captureLat: number | null;
  captureLng: number | null;
  captureAccuracyM: number | null;
  distanceToParcelM: number | null;
  /** Thẩm định quyết định Đưa vào report (chỉ APPLIED mới in). */
  applyStatus: ResurveyApplyStatus;
  applyDecidedAt: string | null;
  createdAt: string;
}

export interface ResurveySlotView {
  photoKey: string;
  slotCode: ResurveySlotCode;
  label: string;
  url: string;
  rotation: number;
  dateTimeText: string;
  flagged: boolean;
  flagStatus: 'OPEN' | 'ASSIGNED' | 'RESOLVED' | null;
}

export interface ResurveyIdentity {
  reportCode: string;
  reportStatus: string;
  projectParcelCode: string | null;
  officialCadastralCode: string | null;
  buildingName: string | null;
  address: string | null;
  ownerName: string | null;
  ownerPhone: string | null;
  objectGroup: string | null;
  chainage: string | null;
  metroOffsetDistance: string | null;
  clearanceOffsetDistance: string | null;
  gps: { lat: number; lng: number } | null;
  adjacent: Record<'left' | 'right' | 'back', { details: string | null; note: string | null }>;
  settlement: { level: number | null; position: string | null; notes: string | null };
  tilt: { level: number | null; xPermille: number | null; yPermille: number | null; direction: string | null; notes: string | null };
  abnormalNotes: string | null;
  surveyDate: string | null;
  zoneId: string | null;
}

export interface ResurveyExtraTimePreview {
  itemId: string;
  time2Text: string;
  time2At: string | null;
  source: ResurveyTime2Source;
}

export interface ResurveySessionView {
  reportId: string;
  parcelId: string;
  identity: ResurveyIdentity;
  slots: ResurveySlotView[];
  extraSlotCodes: ResurveySlotCode[];
  session: ResurveySessionRow | null;
  items: ResurveyItemRow[];
  extraTimes: ResurveyExtraTimePreview[];
  extraTimeError: string | null;
  appliesFromNextRevision: boolean;
  canEdit: boolean;
  canReview: boolean;
  /** Zone Admin / Super Admin đúng phân khu, phiên đã duyệt: được Đưa vào / Bỏ qua từng mục. */
  canApply: boolean;
}

export interface ResurveyTask {
  reportId: string;
  reportCode: string;
  parcelId: string;
  parcelCode: string | null;
  address: string | null;
  zoneId: string | null;
  lat: number | null;
  lng: number | null;
  state: ResurveyMarkerState;
  openOutdoorCount: number;
  sessionId: string | null;
  sessionStatus: ResurveyStatus | null;
  reviewNote: string | null;
  surveyorName: string | null;
  submittedAt: string | null;
}

/** Ảnh đã nén sẵn trên máy + Time 1 + vị trí chụp, gửi kèm khi tải lên. */
export interface CapturedPhoto {
  base64: string;
  capturedAtClient: string;
  lat?: number;
  lng?: number;
  accuracyM?: number;
}

export const SLOT_TITLE: Record<ResurveySlotCode, string> = {
  'P-01': 'P-01 • Biển số nhà / tên công trình',
  'P-02': 'P-02 • Mặt đứng chính diện',
  'P-03': 'P-03 • Mặt bên / mặt sau',
  'P-04': 'P-04 • Bối cảnh đường phố',
  'P-05': 'P-05 • Kiểm tra độ nghiêng',
  'P-06': 'P-06 • Lún móng & nền',
  'P-07': 'P-07 • Bất thường ngoại quan',
};

/** P-02 là mặt đứng chính và ảnh bìa: không được N/A (khớp backend). */
export const NA_FORBIDDEN: readonly ResurveySlotCode[] = ['P-02'];
export const NA_REASON_MIN = 5;
export const REJECT_NOTE_MIN = 10;

export const STATUS_LABEL: Record<ResurveyStatus, string> = {
  DRAFT: 'Đang chụp',
  SUBMITTED: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
};
