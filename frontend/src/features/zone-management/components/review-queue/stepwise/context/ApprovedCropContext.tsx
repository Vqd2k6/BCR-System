import { createContext, useContext } from 'react';

/** Khung crop đã được Thẩm định duyệt, tỉ lệ 0–1 trên ảnh SAU KHI XOAY `rotationAtCrop`. */
export interface ApprovedCropRect {
  x: number;
  y: number;
  w: number;
  h: number;
  rotationAtCrop: number;
}

/** URL ảnh gốc → crop đã duyệt (chỉ crop APPROVED, còn hiệu lực). Studio dùng để hiện ảnh giống bản in. */
export type ApprovedCropMap = ReadonlyMap<string, ApprovedCropRect>;

const EMPTY: ApprovedCropMap = new Map();

export const ApprovedCropContext = createContext<ApprovedCropMap>(EMPTY);

export function useApprovedCrop(url: string | undefined): ApprovedCropRect | null {
  const map = useContext(ApprovedCropContext);
  return url ? map.get(url) ?? null : null;
}

/** Dấu ảnh chụp lại trên một ảnh gốc (URL) của Studio. */
export interface StudioResurveyPhotoMark {
  state: 'NEED' | 'CAPTURED' | 'SUBMITTED' | 'APPLIED' | 'NA';
  newUrl: string | null;
  newRotation: number;
}

/** Trạng thái ảnh dùng chung cho mọi thẻ ảnh Studio (crop chờ duyệt, ảnh chụp lại, ảnh vừa cập nhật). */
export interface StudioPhotoStatus {
  /** URL ảnh → photoKey của ô có crop chờ duyệt hoặc quá hạn. */
  pendingCrops: ReadonlyMap<string, string>;
  /** URL ảnh gốc → trạng thái chụp lại. */
  resurvey: ReadonlyMap<string, StudioResurveyPhotoMark>;
  /** URL vừa đổi (duyệt crop / ảnh chụp lại) để thẻ ảnh nháy viền cho dễ thấy. */
  recent: ReadonlySet<string>;
  openCropReview: ((photoKey: string) => void) | null;
}

const EMPTY_STATUS: StudioPhotoStatus = { pendingCrops: new Map(), resurvey: new Map(), recent: new Set(), openCropReview: null };

export const StudioPhotoStatusContext = createContext<StudioPhotoStatus>(EMPTY_STATUS);

export function useStudioPhotoStatus(): StudioPhotoStatus {
  return useContext(StudioPhotoStatusContext);
}
