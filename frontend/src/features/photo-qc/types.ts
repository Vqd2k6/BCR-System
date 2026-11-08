/** Kiểu dữ liệu Photo QC – khớp backend/src/modules/photo-qc/photo-qc.types.ts */

export type PhotoQcReportKind = 'HOUSE' | 'MASTER' | 'M' | 'U';
export type PhotoQcRecaptureLevel = 'NONE' | 'OUTDOOR_ONLY' | 'FULL';
export type PhotoQcRestampMode = 'NONE' | 'LOGO' | 'TEXT' | 'BOTH';
export type PhotoQcGroup = 'OUTDOOR' | 'INDOOR';
export type PhotoQcFlagStatus = 'OPEN' | 'ASSIGNED' | 'RESOLVED';
export type PhotoQcCropRatio = '4:3' | '3:4';
export type PhotoQcListFilter = 'ALL' | 'UNREVIEWED' | 'FLAGGED' | 'REVIEWED';

export interface PhotoQcCrop {
  x: number;
  y: number;
  w: number;
  h: number;
  ratio: PhotoQcCropRatio;
  rotationAtCrop: number;
}

export interface PhotoQcCropInput extends PhotoQcCrop {
  imageWidth: number;
  imageHeight: number;
}

export interface PhotoQcReportRow {
  reportId: string;
  zoneId: string | null;
  stationCode: string | null;
  coverSource: 'P04' | null;
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

export interface PhotoQcSlotView {
  photoKey: string;
  url: string;
  rotation: number;
  label: string;
  section: 'P' | 'DEFECT' | 'OVERVIEW';
  photoGroup: PhotoQcGroup;
  legacyWatermarked: boolean;
  qc: PhotoQcPhotoRow | null;
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
  suggestedLevel: PhotoQcRecaptureLevel;
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
  suggestedLevel: PhotoQcRecaptureLevel;
  appliesFromNextRevision: boolean;
}

export interface PhotoQcListParams {
  zone?: string;
  station?: string;
  kind?: PhotoQcReportKind;
  filter?: PhotoQcListFilter;
  q?: string;
  cursor?: string;
  limit?: number;
}

export interface PhotoQcPhotoUpdate {
  photoKey: string;
  photoUrl: string;
  crop?: PhotoQcCropInput | null;
  restampMode?: PhotoQcRestampMode;
  recapture?: boolean;
}

export interface PhotoQcReportUpdate {
  coverSource?: 'P04' | null;
  recaptureLevel?: PhotoQcRecaptureLevel;
  reviewed?: boolean;
}

/** Kích thước ảnh đã xoay EXIF (naturalWidth/Height của trình duyệt). */
export interface NaturalSize {
  width: number;
  height: number;
}

export const KIND_LABEL: Record<PhotoQcReportKind, string> = {
  HOUSE: 'Nhà dân',
  MASTER: 'Tòa mẹ',
  M: 'Khu vực chung',
  U: 'Căn hộ',
};

export const LEVEL_LABEL: Record<PhotoQcRecaptureLevel, string> = {
  NONE: 'Không cần',
  OUTDOOR_ONLY: 'Chỉ ảnh không cần chủ hộ',
  FULL: 'Toàn bộ (vào nhà)',
};

export const STATION_OPTIONS = ['ST02', 'ST04', 'ST05'] as const;
