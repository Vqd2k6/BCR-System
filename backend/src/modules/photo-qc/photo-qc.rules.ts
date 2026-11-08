/**
 * ============================================================================
 * PHOTO QC – QUY TẮC THUẦN (không I/O)
 * Dùng chung cho API rà soát và bước render report để hai nơi luôn khớp nhau.
 * ============================================================================
 */

import { createHash } from 'crypto';
import type {
  PhotoQcCrop,
  PhotoQcGroup,
  PhotoQcPhotoRow,
  PhotoQcRecaptureLevel,
  PhotoQcReportKind,
} from './photo-qc.types';

export function normalizeDeg(deg: unknown): number {
  const n = Number(deg);
  if (!Number.isFinite(n)) return 0;
  return ((Math.round(n) % 360) + 360) % 360;
}

export function resolveReportKind(reportType: string | null | undefined, unitType: string | null | undefined): PhotoQcReportKind {
  const type = String(reportType || '').toUpperCase();
  if (type === 'BUILDING_MASTER') return 'MASTER';
  if (type === 'CONDO_UNIT' || type === 'UNIT_CHILD') {
    return String(unitType || 'UNIT').toUpperCase() === 'MASTER' ? 'M' : 'U';
  }
  return 'HOUSE';
}

/** Đổi bìa sang P04 chỉ cho nhà dân và tòa mẹ: P-04 của hồ sơ căn hộ là cửa & hành lang, không phải bối cảnh đường phố. */
export function isCoverEligibleKind(kind: PhotoQcReportKind): boolean {
  return kind === 'HOUSE' || kind === 'MASTER';
}

/**
 * Khoá ô duy nhất trong một hồ sơ, theo đúng thứ tự mapper Phụ lục 1 đẩy ảnh.
 * Mapper dùng chung mã `P-03` cho nhiều ảnh mặt bên, nên lần xuất hiện thứ n (n ≥ 2) mang hậu tố `#n`.
 */
export function assignSlotKeys(photoCodes: string[]): string[] {
  const seen = new Map<string, number>();
  return photoCodes.map((raw) => {
    const code = (raw || 'P-??').trim();
    const count = (seen.get(code) ?? 0) + 1;
    seen.set(code, count);
    return count === 1 ? code : `${code}#${count}`;
  });
}

/** Ảnh không thuộc Phụ lục 1 khoá theo URL (băm ngắn), vì ô của chúng là khuyết tật / phòng. */
export function urlPhotoKey(url: string): string {
  return `U:${createHash('sha1').update(url.trim()).digest('hex').slice(0, 24)}`;
}

function baseCode(photoKey: string): string {
  return photoKey.split('#')[0].toUpperCase();
}

/**
 * Nhóm thu thập lại: OUTDOOR = chụp được mà không cần chủ hộ mở cửa.
 * - Căn hộ (U, M): P-01..P-04 (biển số phòng, cửa & hành lang…) là OUTDOOR.
 * - Nhà dân / tòa mẹ: ảnh định danh ngoài nhà Phụ lục 1 là OUTDOOR, trừ ảnh võng dầm/sàn (P-06B) chụp trong nhà.
 * - Còn lại (khuyết tật, phòng) là INDOOR.
 */
export function photoGroupFor(kind: PhotoQcReportKind, photoKey: string, section: 'P' | 'DEFECT' | 'OVERVIEW'): PhotoQcGroup {
  if (section !== 'P') return 'INDOOR';
  const code = baseCode(photoKey);
  if (kind === 'U' || kind === 'M') {
    return /^P-0[1-4]($|-)/.test(code) ? 'OUTDOOR' : 'INDOOR';
  }
  return code.startsWith('P-06B') ? 'INDOOR' : 'OUTDOOR';
}

export function suggestRecaptureLevel(flags: Array<Pick<PhotoQcPhotoRow, 'recapture' | 'photoGroup' | 'status'>>): PhotoQcRecaptureLevel {
  const open = flags.filter((f) => f.recapture && f.status !== 'RESOLVED');
  if (open.length === 0) return 'NONE';
  return open.some((f) => f.photoGroup === 'INDOOR') ? 'FULL' : 'OUTDOOR_ONLY';
}

/** Studio Img thay URL nhưng giữ cùng ảnh gốc: quy về URL gốc trước khi so hiệu lực. */
export function resolveOriginalUrl(url: string, studioEnhanced: Record<string, { originalUrl?: unknown }> | null | undefined): string {
  const info = studioEnhanced?.[url];
  return typeof info?.originalUrl === 'string' && info.originalUrl ? info.originalUrl : url;
}

export function isSameSourcePhoto(
  savedUrl: string,
  currentUrl: string,
  studioEnhanced?: Record<string, { originalUrl?: unknown }> | null
): boolean {
  if (savedUrl === currentUrl) return true;
  return resolveOriginalUrl(savedUrl, studioEnhanced) === resolveOriginalUrl(currentUrl, studioEnhanced);
}

/** Crop còn hiệu lực khi cùng ảnh nguồn và cùng góc xoay tại thời điểm crop. */
export function isCropApplicable(
  crop: PhotoQcCrop | null,
  savedUrl: string,
  currentUrl: string,
  currentRotation: number,
  studioEnhanced?: Record<string, { originalUrl?: unknown }> | null
): boolean {
  if (!crop) return false;
  if (!isSameSourcePhoto(savedUrl, currentUrl, studioEnhanced)) return false;
  return normalizeDeg(crop.rotationAtCrop) === normalizeDeg(currentRotation);
}

const EPS = 1e-6;

export function isValidCropGeometry(crop: PhotoQcCrop): boolean {
  const vals = [crop.x, crop.y, crop.w, crop.h];
  if (!vals.every((v) => Number.isFinite(v))) return false;
  if (crop.x < -EPS || crop.y < -EPS || crop.w <= 0.01 || crop.h <= 0.01) return false;
  return crop.x + crop.w <= 1 + EPS && crop.y + crop.h <= 1 + EPS;
}

export interface PixelRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Quy khung crop (tỉ lệ 0–1, toạ độ ảnh đã xoay `deg` theo chiều kim đồng hồ) về khung pixel trên ảnh gốc W×H.
 * Phép quy đổi chính xác với góc bội số 90°.
 */
export function cropToNativeRect(crop: Pick<PhotoQcCrop, 'x' | 'y' | 'w' | 'h'>, nativeW: number, nativeH: number, deg: number): PixelRect {
  const d = normalizeDeg(deg);
  const swapped = d === 90 || d === 270;
  const rotW = swapped ? nativeH : nativeW;
  const rotH = swapped ? nativeW : nativeH;
  const rx = crop.x * rotW;
  const ry = crop.y * rotH;
  const rw = crop.w * rotW;
  const rh = crop.h * rotH;

  let x: number;
  let y: number;
  let w: number;
  let h: number;
  if (d === 90) {
    x = ry; y = nativeH - rx - rw; w = rh; h = rw;
  } else if (d === 180) {
    x = nativeW - rx - rw; y = nativeH - ry - rh; w = rw; h = rh;
  } else if (d === 270) {
    x = nativeW - ry - rh; y = rx; w = rh; h = rw;
  } else {
    x = rx; y = ry; w = rw; h = rh;
  }

  const left = Math.max(0, Math.min(nativeW - 1, Math.round(x)));
  const top = Math.max(0, Math.min(nativeH - 1, Math.round(y)));
  const width = Math.max(1, Math.min(nativeW - left, Math.round(w)));
  const height = Math.max(1, Math.min(nativeH - top, Math.round(h)));
  return { left, top, width, height };
}

export function restampLayers(mode: string): { logo: boolean; text: boolean } {
  return { logo: mode === 'LOGO' || mode === 'BOTH', text: mode === 'TEXT' || mode === 'BOTH' };
}
