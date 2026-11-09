/**
 * ============================================================================
 * PHOTO RESURVEY – KIỂU DỮ LIỆU DÙNG CHUNG
 * Chụp lại ảnh ngoài nhà dân theo cờ Photo QC (giai đoạn 3).
 * ============================================================================
 */

export type ResurveyStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED';
export type ResurveyAction = 'REPLACE' | 'ADD_EXTRA' | 'MARK_NA';
export type ResurveySlotCode = 'P-01' | 'P-02' | 'P-03' | 'P-04' | 'P-05' | 'P-06' | 'P-07';
/**
 * Nguồn của Time 2 (chữ ngày giờ in watermark):
 * - ORIGINAL: đúng chữ đang in trên ảnh gốc bị thay.
 * - INTERPOLATED: ảnh phát sinh, chèn giữa 2 ảnh kề trên dòng thời gian.
 * - DATE_ONLY: report không có mốc giờ nào, in theo ngày khảo sát như ảnh khác.
 * - ADMIN: Admin chỉnh khi duyệt (vẫn trong khoảng hợp lệ).
 */
export type ResurveyTime2Source = 'ORIGINAL' | 'INTERPOLATED' | 'DATE_ONLY' | 'ADMIN';
/** Trạng thái thửa trên GIS: PENDING = còn ảnh cần chụp, SUBMITTED = chờ Admin duyệt. */
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
  createdAt: string;
}

/** Một ô ảnh ngoài nhà như report đang in (đọc từ ViewModel thật). */
export interface ResurveySlotView {
  photoKey: string;
  slotCode: ResurveySlotCode;
  label: string;
  url: string;
  rotation: number;
  /** Chữ ngày giờ đang in trên watermark của ảnh gốc. */
  dateTimeText: string;
  flagged: boolean;
  flagStatus: 'OPEN' | 'ASSIGNED' | 'RESOLVED' | null;
}

/** Thông tin Bước 1 hiển thị chỉ đọc cho KSV nhận diện đúng nhà. */
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

/** Giờ dự kiến của ảnh phát sinh (tính lại khi nộp, chốt khi Admin duyệt). */
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
  /** Mục cho phép chụp thêm: có ảnh bị gắn cờ và là mục nhiều ảnh (P-03, P-05, P-06, P-07). */
  extraSlotCodes: ResurveySlotCode[];
  session: ResurveySessionRow | null;
  items: ResurveyItemRow[];
  extraTimes: ResurveyExtraTimePreview[];
  /** Lỗi xếp giờ ảnh phát sinh (khoảng trống quá hẹp) – chặn nộp, báo Admin. */
  extraTimeError: string | null;
  /** Hồ sơ đã duyệt: kết quả chỉ in từ bản phát hành kế tiếp. */
  appliesFromNextRevision: boolean;
  canEdit: boolean;
  canReview: boolean;
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

/** Phần dùng khi render report (cũng là phần đóng băng vào snapshot). */
export interface ResurveyRenderItem {
  action: ResurveyAction;
  slotCode: ResurveySlotCode;
  photoKey: string | null;
  originalUrl: string | null;
  extraIndex: number | null;
  newUrl: string | null;
  rotation: number;
  time2Text: string | null;
}

export interface ResurveyRenderSession {
  sessionId: string;
  approvedAt: string | null;
  items: ResurveyRenderItem[];
}

/** Mọi phiên đã duyệt, theo thứ tự duyệt: phiên sau nhắm vào ảnh đang in sau khi áp các phiên trước. */
export interface ResurveyRenderState {
  sessions: ResurveyRenderSession[];
}
