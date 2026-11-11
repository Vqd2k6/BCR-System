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
