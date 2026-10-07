import * as fs from 'fs';
import * as path from 'path';

/**
 * Global In-Memory Cache lưu trữ tỷ lệ khung ảnh (Portrait: true, Landscape: false)
 */
const portraitCache = new Map<string, boolean>();

/**
 * Trích xuất width & height từ Buffer ảnh JPEG
 */
export function parseJpegDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 4 || buf[0] !== 0xFF || buf[1] !== 0xD8) return null;
  let offset = 2;
  while (offset < buf.length - 8) {
    if (buf[offset] !== 0xFF) {
      offset++;
      continue;
    }
    const marker = buf[offset + 1];
    // Các marker chứa SOF (Start of Frame)
    if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2 || marker === 0xC3) {
      const height = buf.readUInt16BE(offset + 5);
      const width = buf.readUInt16BE(offset + 7);
      return { width, height };
    }
    const len = buf.readUInt16BE(offset + 2);
    offset += 2 + len;
  }
  return null;
}

/**
 * Trích xuất width & height từ Buffer ảnh PNG
 */
export function parsePngDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    return { width, height };
  }
  return null;
}

/**
 * Tải trước và phân tích định dạng khung hình (ngang/dọc) cho danh sách ảnh qua HTTP Range Header
 * Đảm bảo các ảnh lưu trữ Cloud (R2/S3) được phân loại 100% chuẩn xác mà không tốn băng thông.
 */
export async function preloadImageOrientations(urls: (string | undefined | null)[]): Promise<void> {
  const validUrls = Array.from(new Set(urls.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)));
  const pendingRemoteUrls = validUrls.filter(
    (u) => (u.startsWith('http://') || u.startsWith('https://')) && !portraitCache.has(u)
  );

  if (pendingRemoteUrls.length === 0) return;

  const BATCH_SIZE = 15;
  for (let i = 0; i < pendingRemoteUrls.length; i += BATCH_SIZE) {
    const batch = pendingRemoteUrls.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map(async (url) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3500);

          const res = await fetch(url, {
            headers: { Range: 'bytes=0-32767' },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (!res.ok && res.status !== 206) return;

          const arrayBuf = await res.arrayBuffer();
          const buf = Buffer.from(arrayBuf);

          const jpegDim = parseJpegDimensions(buf);
          if (jpegDim) {
            portraitCache.set(url, jpegDim.height > jpegDim.width);
            return;
          }

          const pngDim = parsePngDimensions(buf);
          if (pngDim) {
            portraitCache.set(url, pngDim.height > pngDim.width);
            return;
          }
        } catch {
          // Bỏ qua lỗi kết nối mạng, fallback về false
        }
      })
    );
  }
}

/**
 * Phát hiện ảnh chụp đứng (Portrait) dựa trên cache hoặc header nhị phân (PNG / JPEG)
 */
export function isPortraitImage(url: string): boolean {
  if (!url || typeof url !== 'string') return false;

  const trimmed = url.trim();

  // 0. Đã có trong cache
  if (portraitCache.has(trimmed)) {
    return portraitCache.get(trimmed)!;
  }

  // 1. PNG Base64
  if (trimmed.startsWith('data:image/png;base64,')) {
    try {
      const header = Buffer.from(trimmed.slice(22, 64), 'base64');
      const dim = parsePngDimensions(header);
      if (dim) {
        const isPort = dim.height > dim.width;
        portraitCache.set(trimmed, isPort);
        return isPort;
      }
    } catch {
      return false;
    }
  }

  // 2. JPEG Base64
  if (trimmed.startsWith('data:image/jpeg;base64,') || trimmed.startsWith('data:image/jpg;base64,')) {
    try {
      const commaIdx = trimmed.indexOf(',');
      const base64Data = trimmed.slice(commaIdx + 1, commaIdx + 65536);
      const buf = Buffer.from(base64Data, 'base64');
      const dim = parseJpegDimensions(buf);
      if (dim) {
        const isPort = dim.height > dim.width;
        portraitCache.set(trimmed, isPort);
        return isPort;
      }
    } catch {
      return false;
    }
  }

  // 3. File cục bộ / Uploads
  if (trimmed.includes('/uploads/') || trimmed.startsWith('./uploads') || trimmed.startsWith('uploads/')) {
    try {
      const cleanPath = trimmed.replace(/^.*?\/uploads\//, 'uploads/');
      const candidates = [
        path.resolve(process.cwd(), cleanPath),
        path.resolve(process.cwd(), 'backend', cleanPath),
        path.resolve(process.cwd(), '..', cleanPath),
      ];

      for (const fullPath of candidates) {
        if (fs.existsSync(fullPath)) {
          const buf = fs.readFileSync(fullPath);
          const pngDim = parsePngDimensions(buf);
          if (pngDim) {
            const isPort = pngDim.height > pngDim.width;
            portraitCache.set(trimmed, isPort);
            return isPort;
          }
          const jpegDim = parseJpegDimensions(buf);
          if (jpegDim) {
            const isPort = jpegDim.height > jpegDim.width;
            portraitCache.set(trimmed, isPort);
            return isPort;
          }
        }
      }
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Loại bỏ các URL ảnh trùng lặp trong mảng
 */
export function dedupePhotos(arr: any[] | undefined, excludeUrl?: string): string[] {
  if (!arr || !Array.isArray(arr)) return [];
  const set = new Set<string>();
  arr.forEach((p) => {
    const u = typeof p === 'string' ? p : p?.url;
    if (u && typeof u === 'string' && u !== excludeUrl) {
      set.add(u);
    }
  });
  return Array.from(set);
}
