/**
 * Hình học Photo QC phía client: chỉ tính toán hiển thị, không encode ảnh (ảnh gốc giữ nguyên).
 * Toạ độ crop là tỉ lệ 0–1 trên ảnh ĐÃ XOAY theo chiều kim đồng hồ (đúng như report in).
 */
import type { NaturalSize, PhotoQcCropRatio, PhotoQcRestampMode } from '../types';

export interface NormRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function normalizeDeg(deg: number): number {
  return ((Math.round(Number(deg) || 0) % 360) + 360) % 360;
}

export function rotatedSize(size: NaturalSize, deg: number): NaturalSize {
  const d = normalizeDeg(deg);
  return d === 90 || d === 270 ? { width: size.height, height: size.width } : size;
}

const RATIO_TOLERANCE = 0.02;

/** Ảnh in đã đúng 4:3 / 3:4 chưa (sai số 2%). */
export function isStandardRatio(size: NaturalSize): boolean {
  if (!size.width || !size.height) return true;
  const r = size.width / size.height;
  return Math.abs(r - 4 / 3) / (4 / 3) <= RATIO_TOLERANCE || Math.abs(r - 3 / 4) / (3 / 4) <= RATIO_TOLERANCE;
}

export function ratioValue(ratio: PhotoQcCropRatio): number {
  return ratio === '4:3' ? 4 / 3 : 3 / 4;
}

export function ratioForSize(size: NaturalSize): PhotoQcCropRatio {
  return size.width >= size.height ? '4:3' : '3:4';
}

/** Khung lớn nhất đúng tỉ lệ, căn giữa ảnh đã xoay. */
export function defaultCrop(rot: NaturalSize, ratio: PhotoQcCropRatio): NormRect {
  const r = ratioValue(ratio);
  let wPx = rot.width;
  let hPx = wPx / r;
  if (hPx > rot.height) {
    hPx = rot.height;
    wPx = hPx * r;
  }
  const w = wPx / rot.width;
  const h = hPx / rot.height;
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
}

/** Quay một khung tỉ lệ trên ảnh gốc sang ảnh đã xoay `deg` theo chiều kim đồng hồ. */
export function rotateRectNorm(rect: NormRect, deg: number): NormRect {
  const d = normalizeDeg(deg);
  if (d === 90) return { x: 1 - rect.y - rect.h, y: rect.x, w: rect.h, h: rect.w };
  if (d === 180) return { x: 1 - rect.x - rect.w, y: 1 - rect.y - rect.h, w: rect.w, h: rect.h };
  if (d === 270) return { x: rect.y, y: 1 - rect.x - rect.w, w: rect.h, h: rect.w };
  return { ...rect };
}

/**
 * Vùng watermark cũ do FE dập vào pixel trước 03/10/2026 (frontend/src/utils/watermarkEngine.ts),
 * tính theo ảnh gốc W×H rồi quay sang ảnh in. Ảnh cũ dùng nhiều phiên bản dấu (logo từ ~0,44 đến ~0,72 cạnh ngắn),
 * nên vùng logo lấy theo cỡ lớn nhất đã gặp để gợi ý thận trọng; admin vẫn nhìn vùng viền vàng để quyết.
 */
export function legacyWatermarkZones(native: NaturalSize, deg: number): { logo: NormRect; text: NormRect } {
  const W = native.width;
  const H = native.height;
  const s = Math.min(W, H);
  const logoW = s * 0.74;
  const logoH = s * 0.2;
  const pad = s * 0.025;
  const glow = s * 0.007 * 2;
  const logo = {
    x: (W - pad - logoW - glow) / W,
    y: Math.max(0, pad - glow) / H,
    w: (logoW + 2 * glow) / W,
    h: (logoH + 2 * glow) / H,
  };

  const font = Math.max(22, Math.round(s * 0.031));
  const lineH = Math.round(font * 1.35);
  const padR = s * 0.03;
  const padB = s * 0.035;
  const textH = lineH + font * 1.25;
  const textW = Math.min(W - 2 * padR, font * 0.62 * 42);
  const text = {
    x: (W - padR - textW) / W,
    y: (H - padB - textH) / H,
    w: (textW + padR * 0.5) / W,
    h: (textH + padB * 0.6) / H,
  };
  return { logo: rotateRectNorm(clampRect(logo), deg), text: rotateRectNorm(clampRect(text), deg) };
}

function clampRect(r: NormRect): NormRect {
  const x = Math.max(0, Math.min(1, r.x));
  const y = Math.max(0, Math.min(1, r.y));
  return { x, y, w: Math.max(0, Math.min(1 - x, r.w)), h: Math.max(0, Math.min(1 - y, r.h)) };
}

export type ZoneCoverage = 'INSIDE' | 'PARTIAL' | 'OUTSIDE';

export function zoneCoverage(zone: NormRect, crop: NormRect): ZoneCoverage {
  const ix = Math.max(0, Math.min(zone.x + zone.w, crop.x + crop.w) - Math.max(zone.x, crop.x));
  const iy = Math.max(0, Math.min(zone.y + zone.h, crop.y + crop.h) - Math.max(zone.y, crop.y));
  const inter = ix * iy;
  const area = zone.w * zone.h;
  if (area <= 0 || inter <= 0) return 'OUTSIDE';
  return inter >= area * 0.98 ? 'INSIDE' : 'PARTIAL';
}

/** Khung cắt mất vùng nào (không còn trọn trong khung) thì gợi ý dập bù vùng đó. */
export function suggestRestamp(zones: { logo: NormRect; text: NormRect }, crop: NormRect): PhotoQcRestampMode {
  const logoCut = zoneCoverage(zones.logo, crop) !== 'INSIDE';
  const textCut = zoneCoverage(zones.text, crop) !== 'INSIDE';
  if (logoCut && textCut) return 'BOTH';
  if (logoCut) return 'LOGO';
  if (textCut) return 'TEXT';
  return 'NONE';
}

/** Cảnh báo chồng 2 lớp: vẫn còn (một phần) dấu cũ trong khung mà lại bật dập bù phần đó. */
export function doubleStampWarnings(zones: { logo: NormRect; text: NormRect }, crop: NormRect, mode: PhotoQcRestampMode): string[] {
  const out: string[] = [];
  if ((mode === 'LOGO' || mode === 'BOTH') && zoneCoverage(zones.logo, crop) !== 'OUTSIDE') {
    out.push('Khung còn giữ logo cũ mà vẫn dập bù logo: sẽ có 2 lớp logo.');
  }
  if ((mode === 'TEXT' || mode === 'BOTH') && zoneCoverage(zones.text, crop) !== 'OUTSIDE') {
    out.push('Khung còn giữ dòng giờ/mã cũ mà vẫn dập bù chữ: sẽ có 2 lớp chữ.');
  }
  return out;
}

/**
 * Khung lớn nhất đúng tỉ lệ (theo hướng ảnh in) nằm giữa dải không có dấu cũ:
 * dưới logo (góc trên phải) và trên dòng chữ (góc dưới phải) của ảnh gốc.
 */
export function cropAvoidingLegacyStamp(native: NaturalSize, deg: number): { rect: NormRect; ratio: PhotoQcCropRatio } {
  const d = normalizeDeg(deg);
  const rot = rotatedSize(native, d);
  const ratio = ratioForSize(rot);
  const zonesNative = legacyWatermarkZones(native, 0);
  const top = (zonesNative.logo.y + zonesNative.logo.h) * native.height;
  const bottom = zonesNative.text.y * native.height;
  const bandH = Math.max(1, bottom - top);
  const bandW = native.width;
  const rotatedRatio = ratioValue(ratio);
  const nativeRatio = d === 90 || d === 270 ? 1 / rotatedRatio : rotatedRatio;
  let w = bandW;
  let h = w / nativeRatio;
  if (h > bandH) {
    h = bandH;
    w = h * nativeRatio;
  }
  const x = (bandW - w) / 2;
  const y = top + (bandH - h) / 2;
  const nativeRect = { x: x / native.width, y: y / native.height, w: w / native.width, h: h / native.height };
  return { rect: rotateRectNorm(nativeRect, d), ratio };
}

/** Kéo/đổi cỡ khung giữ đúng tỉ lệ pixel và nằm trong ảnh. */
export function constrainCrop(rect: NormRect, rot: NaturalSize, ratio: PhotoQcCropRatio): NormRect {
  const r = ratioValue(ratio);
  let wPx = Math.max(24, rect.w * rot.width);
  let hPx = wPx / r;
  if (hPx > rot.height) {
    hPx = rot.height;
    wPx = hPx * r;
  }
  if (wPx > rot.width) {
    wPx = rot.width;
    hPx = wPx / r;
  }
  const w = wPx / rot.width;
  const h = hPx / rot.height;
  const x = Math.max(0, Math.min(1 - w, rect.x));
  const y = Math.max(0, Math.min(1 - h, rect.y));
  return { x, y, w, h };
}
