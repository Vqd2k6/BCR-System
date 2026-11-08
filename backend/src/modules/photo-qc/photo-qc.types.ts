/**
 * ============================================================================
 * PHOTO QC – KIỂU DỮ LIỆU DÙNG CHUNG
 * ============================================================================
 */

/** HOUSE = nhà dân (STANDALONE), MASTER = tòa mẹ chung cư, M = khu vực chung, U = căn hộ con. */
export type PhotoQcReportKind = 'HOUSE' | 'MASTER' | 'M' | 'U';
export type PhotoQcCoverSource = 'P04';
export type PhotoQcRecaptureLevel = 'AUTO' | 'NONE' | 'OUTDOOR_ONLY' | 'FULL';
/** Mức thật sự áp dụng (AUTO đã quy về gợi ý). */
export type PhotoQcEffectiveLevel = Exclude<PhotoQcRecaptureLevel, 'AUTO'>;
export type PhotoQcSection = 'P' | 'DEFECT' | 'OVERVIEW' | 'DOCUMENT';
export type PhotoQcRestampMode = 'NONE' | 'LOGO' | 'TEXT' | 'BOTH';
export type PhotoQcGroup = 'OUTDOOR' | 'INDOOR';
export type PhotoQcFlagStatus = 'OPEN' | 'ASSIGNED' | 'RESOLVED';
export type PhotoQcCropRatio = '4:3' | '3:4';

/** Khung crop tỉ lệ 0–1 trên ảnh SAU KHI XOAY (đúng như hiển thị). */
export interface PhotoQcCrop {
  x: number;
  y: number;
  w: number;
  h: number;
  ratio: PhotoQcCropRatio;
  rotationAtCrop: number;
}

/** Trạng thái QC cần cho render report (cũng là phần đóng băng vào snapshot). */
export interface PhotoQcRenderPhoto {
  photoKey: string;
  photoUrl: string;
  crop: PhotoQcCrop | null;
  restampMode: PhotoQcRestampMode;
}

export interface PhotoQcRenderState {
  coverSource: PhotoQcCoverSource | null;
  photos: PhotoQcRenderPhoto[];
}

export interface PhotoQcReportRow {
  reportId: string;
  zoneId: string | null;
  stationCode: string | null;
  coverSource: PhotoQcCoverSource | null;
  recaptureLevel: PhotoQcRecaptureLevel;
  reviewed: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface PhotoQcPhotoRow {
  reportId: string;
  photoKey: string;
  photoUrl: string;
  photoLabel: string | null;
  crop: PhotoQcCrop | null;
  restampMode: PhotoQcRestampMode;
  recapture: boolean;
  photoGroup: PhotoQcGroup;
  status: PhotoQcFlagStatus;
  updatedAt: string | null;
}

/** Một ô ảnh như report sẽ in. */
export interface PhotoQcSlot {
  photoKey: string;
  url: string;
  rotation: number;
  label: string;
  section: PhotoQcSection;
  photoGroup: PhotoQcGroup;
  legacyWatermarked: boolean;
  /** Report hiện tại có in ảnh này không (ảnh chưa in vẫn rà và crop được, crop áp khi report in). */
  printed: boolean;
}

export interface PhotoQcSlotView extends PhotoQcSlot {
  qc: PhotoQcPhotoRow | null;
  /** Crop/cờ đã lưu nhưng ảnh đã đổi URL hoặc đổi góc xoay. */
  qcStale: boolean;
}

export interface PhotoQcListItem {
  reportId: string;
  reportCode: string;
  parcelCode: string | null;
  unitCode: string | null;
  kind: PhotoQcReportKind;
  status: string;
  zoneId: string | null;
  stationCode: string;
  coverEligible: boolean;
  pPhotos: PhotoQcSlotView[];
  qc: PhotoQcReportRow | null;
  openFlagCount: number;
  suggestedLevel: PhotoQcEffectiveLevel;
  effectiveLevel: PhotoQcEffectiveLevel;
  /** Hồ sơ không có ảnh P (khu vực chung M): ảnh đại diện để rà nhanh. */
  previewPhotos: PhotoQcSlotView[];
}

export interface PhotoQcListResult {
  items: PhotoQcListItem[];
  nextCursor: string | null;
}

export interface PhotoQcDetail {
  reportId: string;
  reportCode: string;
  kind: PhotoQcReportKind;
  status: string;
  coverEligible: boolean;
  hasP04: boolean;
  qc: PhotoQcReportRow | null;
  photos: PhotoQcSlotView[];
  suggestedLevel: PhotoQcEffectiveLevel;
  effectiveLevel: PhotoQcEffectiveLevel;
  /** Hồ sơ APPROVED: thay đổi chỉ in từ bản phát hành kế tiếp. */
  appliesFromNextRevision: boolean;
}

export interface PhotoQcRecaptureRow {
  stationCode: string;
  zoneId: string | null;
  reportId: string;
  reportCode: string;
  parcelCode: string | null;
  unitCode: string | null;
  kind: PhotoQcReportKind;
  recaptureLevel: PhotoQcEffectiveLevel;
  levelIsAuto: boolean;
  coverP04: boolean;
  address: string | null;
  photoKeys: string[];
  photos: Array<{ key: string; label: string; url: string }>;
  outdoorCount: number;
  indoorCount: number;
}
