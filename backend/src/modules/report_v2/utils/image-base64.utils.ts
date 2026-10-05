/**
 * ============================================================================
 * IMAGE BASE64 UTILITIES
 * Chuyển đổi ảnh sang Base64 Data URI nhằm đảm bảo Zero Network Failure
 * khi Chromium render PDF.
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';

export class ImageBase64Utils {
  /**
   * Chuyển đổi file cục bộ sang Base64
   */
  public static localFileToBase64(filePath: string): string | null {
    try {
      if (!fs.existsSync(filePath)) return null;
      const ext = path.extname(filePath).toLowerCase();
      let mimeType = 'image/jpeg';
      if (ext === '.png') mimeType = 'image/png';
      else if (ext === '.webp') mimeType = 'image/webp';
      else if (ext === '.svg') mimeType = 'image/svg+xml';

      const fileBuffer = fs.readFileSync(filePath);
      return `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
    } catch {
      return null;
    }
  }

  /**
   * Tải ảnh từ URL (nếu là HTTP/HTTPS) hoặc đọc file (nếu là local/data:)
   */
  public static async resolveImageToBase64(urlOrPath: string): Promise<string> {
    if (!urlOrPath || typeof urlOrPath !== 'string') return '';
    if (urlOrPath.startsWith('data:')) return urlOrPath;

    // Nếu là file path cục bộ
    if (fs.existsSync(urlOrPath)) {
      const b64 = this.localFileToBase64(urlOrPath);
      if (b64) return b64;
    }

    // Nếu là HTTP / S3 Presigned URL
    if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(urlOrPath, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const buffer = await res.arrayBuffer();
          const contentType = res.headers.get('content-type') || 'image/jpeg';
          return `data:${contentType};base64,${Buffer.from(buffer).toString('base64')}`;
        }
      } catch {
        // Fallback: giữ lại URL gốc nếu fetch thất bại
      }
    }

    return urlOrPath;
  }
}
