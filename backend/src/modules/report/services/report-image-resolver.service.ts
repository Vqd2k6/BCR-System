/**
 * ============================================================================
 * REPORT IMAGE RESOLVER SERVICE
 * Phân giải đường dẫn ảnh (Local /Uploads hoặc Remote Cloud R2/S3) sang chuỗi
 * Data URI Base64 chuẩn để đảm bảo Puppeteer / HTML Preview không bao giờ bị lỗi ảnh.
 * Hỗ trợ xoay ảnh vật lý (90 / 180 / 270 độ) bằng Sharp.
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

export class ReportImageResolver {
  private static remoteBase64Cache = new Map<string, string>();
  private static rotatedBase64Cache = new Map<string, string>();
  private static MAX_CACHE_SIZE = 300;

  public static async rotateBase64Image(dataUri: string, rotationDeg: number): Promise<string> {
    const normDeg = ((Number(rotationDeg) || 0) % 360 + 360) % 360;
    if (normDeg === 0 || !dataUri || !dataUri.startsWith('data:image/')) {
      return dataUri;
    }

    const cacheKey = `${normDeg}::${dataUri.slice(0, 120)}::${dataUri.length}`;
    if (this.rotatedBase64Cache.has(cacheKey)) {
      return this.rotatedBase64Cache.get(cacheKey)!;
    }

    try {
      const commaIdx = dataUri.indexOf(',');
      if (commaIdx === -1) return dataUri;
      const buf = Buffer.from(dataUri.slice(commaIdx + 1), 'base64');

      const isPng = dataUri.startsWith('data:image/png');
      const pipeline = sharp(buf).rotate(normDeg);
      const outBuf = isPng ? await pipeline.png().toBuffer() : await pipeline.jpeg({ quality: 92 }).toBuffer();
      const outMime = isPng ? 'image/png' : 'image/jpeg';
      const rotatedUri = `data:${outMime};base64,${outBuf.toString('base64')}`;

      if (this.rotatedBase64Cache.size >= this.MAX_CACHE_SIZE) {
        const firstKey = this.rotatedBase64Cache.keys().next().value;
        if (firstKey) this.rotatedBase64Cache.delete(firstKey);
      }
      this.rotatedBase64Cache.set(cacheKey, rotatedUri);
      return rotatedUri;
    } catch (err) {
      console.warn(`⚠️ [ReportImageResolver] Không thể xoay ảnh (${normDeg}°):`, err);
      return dataUri;
    }
  }

  public static async preloadRemoteImages(urls: (string | undefined | null)[]): Promise<void> {
    const validUrls = Array.from(
      new Set(
        urls.filter(
          (u): u is string =>
            typeof u === 'string' &&
            u.trim().length > 0 &&
            (u.trim().startsWith('http://') || u.trim().startsWith('https://'))
        )
      )
    );

    const pending = validUrls.filter((u) => {
      const trimmed = u.trim();
      if (this.remoteBase64Cache.has(trimmed)) return false;
      const localTry = this.resolveLocalUpload(trimmed);
      if (localTry.startsWith('data:image/')) {
        this.remoteBase64Cache.set(trimmed, localTry);
        return false;
      }
      return true;
    });

    if (pending.length === 0) return;

    const BATCH_SIZE = 10;
    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const batch = pending.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map(async (url) => {
          const trimmed = url.trim();
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            const res = await fetch(trimmed, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!res.ok) return;

            const contentType = res.headers.get('content-type') || '';
            const arrayBuf = await res.arrayBuffer();
            const buf = Buffer.from(arrayBuf);
            if (buf.length < 64) return;

            let mime = 'image/jpeg';
            if (contentType.includes('png') || trimmed.toLowerCase().endsWith('.png')) {
              mime = 'image/png';
            } else if (contentType.includes('webp') || trimmed.toLowerCase().endsWith('.webp')) {
              mime = 'image/webp';
            }

            if (this.remoteBase64Cache.size >= this.MAX_CACHE_SIZE) {
              const firstKey = this.remoteBase64Cache.keys().next().value;
              if (firstKey) this.remoteBase64Cache.delete(firstKey);
            }

            this.remoteBase64Cache.set(trimmed, `data:${mime};base64,${buf.toString('base64')}`);
          } catch {
            // Bỏ qua nếu mạng lỗi, giữ nguyên URL
          }
        })
      );
    }
  }

  public static async preloadAndResolveAll(
    items: Array<string | { url: string; rotation?: number }>,
    rotationsMap?: Record<string, number>
  ): Promise<void> {
    const normalizedItems = items.map((i) => (typeof i === 'string' ? { url: i } : i));
    const rawUrls = normalizedItems.map((i) => i.url);
    await this.preloadRemoteImages(rawUrls);

    for (const item of normalizedItems) {
      if (!item.url) continue;
      const trimmed = item.url.trim();
      const deg = item.rotation ?? rotationsMap?.[trimmed] ?? 0;
      const normDeg = ((Number(deg) || 0) % 360 + 360) % 360;
      if (normDeg !== 0) {
        const baseUri = this.resolveToBase64(trimmed, 0);
        if (baseUri && baseUri.startsWith('data:image/')) {
          const rotated = await this.rotateBase64Image(baseUri, normDeg);
          this.rotatedBase64Cache.set(`${normDeg}::url::${trimmed}`, rotated);
        }
      }
    }
  }

  private static resolveLocalUpload(trimmed: string): string {
    if (trimmed.includes('/uploads/') || trimmed.startsWith('./uploads') || trimmed.startsWith('uploads/')) {
      try {
        const cleanRelPath = trimmed.replace(/^.*?\/uploads\//, 'uploads/').split('?')[0];
        const candidates = [
          path.resolve(process.cwd(), cleanRelPath),
          path.resolve(process.cwd(), 'backend', cleanRelPath),
          path.resolve(process.cwd(), '..', cleanRelPath),
        ];

        for (const fullPath of candidates) {
          if (fs.existsSync(fullPath)) {
            const ext = path.extname(fullPath).toLowerCase();
            const mime =
              ext === '.png'
                ? 'image/png'
                : ext === '.webp'
                ? 'image/webp'
                : ext === '.svg'
                ? 'image/svg+xml'
                : 'image/jpeg';
            const fileBuffer = fs.readFileSync(fullPath);
            return `data:${mime};base64,${fileBuffer.toString('base64')}`;
          }
        }
      } catch (err) {
        console.warn(`⚠️ [ReportImageResolver] Không thể đọc ảnh tại ${trimmed}:`, err);
      }
    }
    return trimmed;
  }

  public static resolveToBase64(photoUrl?: string | null, rotationDeg: number = 0): string {
    if (!photoUrl || typeof photoUrl !== 'string') return '';

    const trimmed = photoUrl.trim();
    if (!trimmed) return '';

    const normDeg = ((Number(rotationDeg) || 0) % 360 + 360) % 360;
    if (normDeg !== 0) {
      const preRotated = this.rotatedBase64Cache.get(`${normDeg}::url::${trimmed}`);
      if (preRotated) return preRotated;
    }

    if (trimmed.startsWith('data:image/')) {
      return trimmed;
    }

    if (this.remoteBase64Cache.has(trimmed)) {
      return this.remoteBase64Cache.get(trimmed)!;
    }

    const localResolved = this.resolveLocalUpload(trimmed);
    if (localResolved.startsWith('data:image/')) {
      return localResolved;
    }

    return trimmed;
  }
}

