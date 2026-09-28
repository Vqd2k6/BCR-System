import * as fs from 'fs';
import * as path from 'path';

/**
 * Phát hiện ảnh chụp đứng (Portrait) dựa trên header nhị phân (PNG / JPEG) mà không cần nạp thư viện nặng
 */
export function isPortraitImage(url: string): boolean {
  if (!url || typeof url !== 'string') return false;

  // 1. PNG Base64
  if (url.startsWith('data:image/png;base64,')) {
    try {
      const header = Buffer.from(url.slice(22, 64), 'base64');
      if (header.length >= 24) {
        const width = header.readUInt32BE(16);
        const height = header.readUInt32BE(20);
        return height > width;
      }
    } catch {
      return false;
    }
  }

  // 2. JPEG Base64
  if (url.startsWith('data:image/jpeg;base64,') || url.startsWith('data:image/jpg;base64,')) {
    try {
      const commaIdx = url.indexOf(',');
      const base64Data = url.slice(commaIdx + 1, commaIdx + 65536);
      const buf = Buffer.from(base64Data, 'base64');
      let offset = 2;
      while (offset < buf.length - 8) {
        if (buf[offset] !== 0xFF) {
          offset++;
          continue;
        }
        const marker = buf[offset + 1];
        if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2 || marker === 0xC3) {
          const height = buf.readUInt16BE(offset + 5);
          const width = buf.readUInt16BE(offset + 7);
          return height > width;
        }
        const len = buf.readUInt16BE(offset + 2);
        offset += 2 + len;
      }
    } catch {
      return false;
    }
  }

  // 3. File cục bộ / Uploads
  if (url.includes('/uploads/') || url.startsWith('./uploads') || url.startsWith('uploads/')) {
    try {
      const cleanPath = url.replace(/^.*?\/uploads\//, 'uploads/');
      const fullPath = path.resolve(process.cwd(), cleanPath);
      if (fs.existsSync(fullPath)) {
        const buf = fs.readFileSync(fullPath);
        if (buf[0] === 0x89 && buf[1] === 0x50 && buf.length >= 24) {
          const width = buf.readUInt32BE(16);
          const height = buf.readUInt32BE(20);
          return height > width;
        } else if (buf[0] === 0xFF && buf[1] === 0xD8) {
          let offset = 2;
          while (offset < buf.length - 8) {
            if (buf[offset] !== 0xFF) { offset++; continue; }
            const marker = buf[offset + 1];
            if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2 || marker === 0xC3) {
              const height = buf.readUInt16BE(offset + 5);
              const width = buf.readUInt16BE(offset + 7);
              return height > width;
            }
            const len = buf.readUInt16BE(offset + 2);
            offset += 2 + len;
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
