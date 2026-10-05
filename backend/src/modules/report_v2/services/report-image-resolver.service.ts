import fs from 'fs';
import path from 'path';

/**
 * ReportImageResolver: Dịch vụ giải quyết và nhúng trực tiếp hình ảnh hiện trường thành Base64 Data URL.
 * Đảm bảo 100% hình ảnh hiển thị mượt mà trong HTML Blob preview, iframe và xuất PDF không bị lỗi broken image / CORS.
 */
export class ReportImageResolver {
  private static cache = new Map<string, string>();

  /**
   * Chuyển đổi đường dẫn ảnh cục bộ (/uploads/...) hoặc URL thành chuỗi Base64 Data URL
   */
  public static resolveToBase64(url: string | null | undefined): string {
    if (!url || typeof url !== 'string' || url.trim() === '') {
      return '';
    }

    const trimmedUrl = url.trim();

    // 1. Đã là Base64 Data URL
    if (trimmedUrl.startsWith('data:image/')) {
      return trimmedUrl;
    }

    // Kiểm tra cache
    if (this.cache.has(trimmedUrl)) {
      return this.cache.get(trimmedUrl)!;
    }

    // 2. Đường dẫn cục bộ /uploads/...
    if (trimmedUrl.includes('/uploads/') || trimmedUrl.startsWith('uploads/')) {
      const cleanSubPath = trimmedUrl.replace(/^.*?\/uploads\//, 'uploads/');
      const candidates = [
        path.resolve(process.cwd(), cleanSubPath),
        path.resolve(process.cwd(), 'backend', cleanSubPath),
        path.resolve(process.cwd(), '..', cleanSubPath),
        path.resolve(__dirname, '../../../../', cleanSubPath),
        path.resolve(__dirname, '../../../../../', cleanSubPath),
      ];

      for (const filePath of candidates) {
        try {
          if (fs.existsSync(filePath)) {
            const ext = path.extname(filePath).toLowerCase();
            let mime = 'image/jpeg';
            if (ext === '.png') mime = 'image/png';
            else if (ext === '.webp') mime = 'image/webp';
            else if (ext === '.svg') mime = 'image/svg+xml';

            const buf = fs.readFileSync(filePath);
            const base64Data = `data:${mime};base64,${buf.toString('base64')}`;
            this.cache.set(trimmedUrl, base64Data);
            return base64Data;
          }
        } catch (e) {
          // Bỏ qua lỗi đọc file, thử đường dẫn tiếp theo
        }
      }
    }

    // 3. Nếu là blob: URL không thể giải quyết, trả về chuỗi rỗng để kích hoạt fallback placeholder
    if (trimmedUrl.startsWith('blob:')) {
      return '';
    }

    // 4. Nếu là URL mạng http/https hoặc không tìm thấy file, giữ nguyên URL để trình duyệt tải
    return trimmedUrl;
  }

  /**
   * Xóa bộ đệm ảnh
   */
  public static clearCache(): void {
    this.cache.clear();
  }
}
