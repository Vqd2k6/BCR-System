import { compressCleanImage } from '../../../utils/cleanImageCompressor';
import type { CapturedPhoto } from '../types';

/** Nén vừa đủ trên máy (cạnh dài 2048px, JPEG 85%) – dập watermark làm ở backend khi xuất report. */
const MAX_DIMENSION = 2048;
const QUALITY = 0.85;
const GPS_TIMEOUT_MS = 8000;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Không đọc được ảnh đã nén'));
    reader.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

/** Vị trí lúc chụp (không bắt buộc): lỗi/từ chối quyền thì bỏ qua, có log. */
function readGps(): Promise<{ lat: number; lng: number; accuracyM: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: pos.coords.accuracy }),
      (err) => {
        console.error('[PhotoResurvey:gps] Không lấy được vị trí lúc chụp, vẫn tải ảnh', err);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: GPS_TIMEOUT_MS, maximumAge: 30000 }
    );
  });
}

/**
 * Chuẩn bị ảnh để tải: nén, ghi Time 1 (giờ máy lúc chụp) và vị trí.
 * `capturedAt` lấy từ lúc chọn tệp; ảnh chọn từ thư viện dùng lastModified của tệp nếu có.
 */
export async function prepareCapturedPhoto(source: File | Blob, capturedAt?: Date): Promise<CapturedPhoto> {
  const fileTime = source instanceof File && source.lastModified ? new Date(source.lastModified) : null;
  const when = capturedAt ?? fileTime ?? new Date();
  const [compressed, gps] = await Promise.all([
    compressCleanImage(source, { maxDimension: MAX_DIMENSION, quality: QUALITY, mimeType: 'image/jpeg' }),
    readGps(),
  ]);
  const base64 = await blobToDataUrl(compressed.blob);
  return {
    base64,
    capturedAtClient: when.toISOString(),
    ...(gps ? { lat: gps.lat, lng: gps.lng, accuracyM: gps.accuracyM } : {}),
  };
}
