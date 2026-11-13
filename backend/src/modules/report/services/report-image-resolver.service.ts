/**
 * ============================================================================
 * REPORT IMAGE RESOLVER SERVICE
 * Phân giải đường dẫn ảnh (Local /Uploads hoặc Remote Cloud R2/S3) sang chuỗi
 * Data URI Base64 chuẩn để đảm bảo Puppeteer / HTML Preview không bao giờ bị lỗi ảnh.
 * Hỗ trợ xoay ảnh vật lý (90 / 180 / 270 độ) bằng Sharp.
 *
 * Trong một lượt render (runWithRenderImageScope) mọi ảnh nằm trong kho riêng của lượt đó,
 * không bị đuổi. Cache tĩnh bên dưới chỉ là tầng phụ để đỡ tải lại giữa các lượt.
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { StorageService } from '../../../common/services/storage.service';
import { currentRenderImageScope, type ImageLoadFailure, type ImageLoadFailureKind } from './report-image-scope';

const STRICT_FETCH_ATTEMPTS = 3;
const STRICT_FETCH_TIMEOUT_MS = 20000;
const PRELOAD_CONCURRENCY = 8;

/** Lỗi đọc ảnh có phân loại, để báo cho Thẩm định đúng nguyên nhân và cách khắc phục. */
export class ImageLoadError extends Error {
  constructor(public readonly failure: ImageLoadFailure) {
    super(failure.message);
    this.name = 'ImageLoadError';
  }
}

function normDegOf(rotationDeg: unknown): number {
  return ((Number(rotationDeg) || 0) % 360 + 360) % 360;
}

function mimeOf(contentType: string, url: string): string {
  const lowerUrl = url.toLowerCase().split('?')[0];
  if (contentType.includes('png') || lowerUrl.endsWith('.png')) return 'image/png';
  if (contentType.includes('webp') || lowerUrl.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

/**
 * Giới hạn số request tải ảnh đồng thời cho CẢ tiến trình (mọi lượt render dùng chung).
 * Tên miền công khai r2.dev trả 429 khi bị dội nhiều request cùng lúc (đo 13/11/2026: 3 lượt render song song
 * × 8 luồng → gần như mọi ảnh 429). Giữ dưới ngưỡng và chờ khi bị giới hạn.
 */
const MAX_PROCESS_FETCHES = Math.max(1, Number(process.env.REPORT_IMAGE_FETCH_CONCURRENCY) || 6);
let activeFetches = 0;
const fetchWaiters: Array<() => void> = [];

export async function withFetchSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (activeFetches >= MAX_PROCESS_FETCHES) {
    await new Promise<void>((resolve) => fetchWaiters.push(resolve));
  }
  activeFetches += 1;
  try {
    return await fn();
  } finally {
    activeFetches -= 1;
    fetchWaiters.shift()?.();
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Thời gian chờ trước lần thử lại: theo Retry-After (giây, tối đa 15s), không có thì 1,5s × số lần đã thử. */
function retryDelayMs(retryAfter: string | null, attempt: number): number {
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(15000, seconds * 1000);
  return 1500 * attempt;
}

function classifyFetchError(err: unknown): { kind: ImageLoadFailureKind; message: string } {
  const message = err instanceof Error ? err.message : String(err);
  if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) return { kind: 'TIMEOUT', message };
  return { kind: 'NETWORK', message };
}

export class ReportImageResolver {
  private static remoteBase64Cache = new Map<string, string>();
  private static rotatedBase64Cache = new Map<string, string>();
  private static MAX_CACHE_SIZE = 300;
  /**
   * Ảnh đã xoay sẵn → ảnh gốc + góc xoay. Watermark dập lên ảnh gốc rồi mới xoay,
   * để dấu luôn bám theo chiều gốc của ảnh (xoay cùng vật thể khi dàn trang).
   */
  private static rotationOrigin = new Map<string, { nativeUri: string; deg: number }>();

  private static rememberGlobal<V>(map: Map<string, V>, key: string, value: V, limit: number): void {
    if (map.size >= limit && !map.has(key)) {
      const firstKey = map.keys().next().value;
      if (firstKey !== undefined) map.delete(firstKey);
    }
    map.set(key, value);
  }

  public static getRotationOrigin(uri?: string | null): { nativeUri: string; deg: number } | undefined {
    if (!uri) return undefined;
    return currentRenderImageScope()?.rotationOrigin.get(uri) ?? this.rotationOrigin.get(uri);
  }

  /** Lý do ảnh nạp lỗi trong lượt render hiện tại (null nếu không lỗi hoặc không ở trong lượt render). */
  public static getLoadFailure(url?: string | null): ImageLoadFailure | null {
    if (!url) return null;
    return currentRenderImageScope()?.failures.get(url.trim()) ?? null;
  }

  /** Xoay trực tiếp bằng Sharp, không qua cache (khóa cache theo đầu chuỗi dễ trùng giữa các JPEG đã dập dấu). */
  public static async rotateUncached(dataUri: string, rotationDeg: number): Promise<string> {
    const normDeg = normDegOf(rotationDeg);
    if (normDeg === 0 || !dataUri || !dataUri.startsWith('data:image/')) return dataUri;
    const commaIdx = dataUri.indexOf(',');
    if (commaIdx === -1) return dataUri;
    const buf = Buffer.from(dataUri.slice(commaIdx + 1), 'base64');
    const isPng = dataUri.startsWith('data:image/png');
    const pipeline = sharp(buf).rotate(normDeg);
    const outBuf = isPng ? await pipeline.png().toBuffer() : await pipeline.jpeg({ quality: 92 }).toBuffer();
    return `data:${isPng ? 'image/png' : 'image/jpeg'};base64,${outBuf.toString('base64')}`;
  }

  /** Ảnh gốc đã nạp (kho của lượt render trước, rồi cache tĩnh). */
  private static nativeLoaded(url: string): string | undefined {
    return currentRenderImageScope()?.native.get(url) ?? this.remoteBase64Cache.get(url);
  }

  /**
   * Nạp ảnh từ xa. Trong lượt render: dùng đường đọc có thử lại + đọc R2 có xác thực khi URL công khai lỗi,
   * ghi ảnh vào kho của lượt (không đuổi) và ghi lý do lỗi. Ngoài lượt render: chỉ cache tĩnh, vẫn log lỗi.
   */
  public static async preloadRemoteImages(urls: (string | undefined | null)[]): Promise<void> {
    const scope = currentRenderImageScope();
    const validUrls = Array.from(
      new Set(
        urls
          .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
          .map((u) => u.trim())
          .filter((u) => u.startsWith('http://') || u.startsWith('https://'))
      )
    );

    const pending = validUrls.filter((u) => {
      if (scope?.native.has(u)) return false;
      const cached = this.remoteBase64Cache.get(u);
      if (cached) {
        if (scope) scope.native.set(u, cached);
        return false;
      }
      const localTry = this.resolveLocalUpload(u);
      if (localTry.startsWith('data:image/')) {
        if (scope) scope.native.set(u, localTry);
        else this.rememberGlobal(this.remoteBase64Cache, u, localTry, this.MAX_CACHE_SIZE);
        return false;
      }
      return true;
    });
    if (pending.length === 0) return;

    let cursor = 0;
    const worker = async (): Promise<void> => {
      while (cursor < pending.length) {
        const url = pending[cursor++];
        try {
          const { buffer, mime } = await this.readImageBytesStrict(url);
          const uri = `data:${mime};base64,${buffer.toString('base64')}`;
          if (scope) {
            scope.native.set(url, uri);
            scope.failures.delete(url);
          }
          this.rememberGlobal(this.remoteBase64Cache, url, uri, this.MAX_CACHE_SIZE);
        } catch (err) {
          const failure: ImageLoadFailure =
            err instanceof ImageLoadError ? err.failure : { kind: 'NETWORK', httpStatus: null, message: String(err) };
          scope?.failures.set(url, failure);
          console.error(`[ReportImageResolver:load] Không nạp được ảnh (${failure.kind}${failure.httpStatus ? ` ${failure.httpStatus}` : ''}): ${url}`, err);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(PRELOAD_CONCURRENCY, pending.length) }, worker));
  }

  public static async preloadAndResolveAll(
    items: Array<string | { url: string; rotation?: number }>,
    rotationsMap?: Record<string, number>
  ): Promise<void> {
    const scope = currentRenderImageScope();
    const normalizedItems = items.map((i) => (typeof i === 'string' ? { url: i } : i));
    await this.preloadRemoteImages(normalizedItems.map((i) => i.url));

    for (const item of normalizedItems) {
      if (!item.url) continue;
      const trimmed = item.url.trim();
      const normDeg = normDegOf(item.rotation ?? rotationsMap?.[trimmed] ?? 0);
      if (normDeg === 0) continue;
      const key = `${normDeg}::url::${trimmed}`;
      if (scope?.rotated.has(key)) continue;
      const baseUri = this.nativeLoaded(trimmed) ?? (trimmed.startsWith('data:image/') ? trimmed : this.resolveLocalUpload(trimmed));
      if (!baseUri || !baseUri.startsWith('data:image/')) continue;
      let rotated: string;
      try {
        rotated = await this.rotateUncached(baseUri, normDeg);
      } catch (err) {
        console.error(`[ReportImageResolver:preloadRotate] Không thể xoay ảnh ${trimmed} (${normDeg}°)`, err);
        scope?.failures.set(trimmed, { kind: 'UNREADABLE', httpStatus: null, message: `Không xoay được ảnh ${normDeg}°` });
        continue;
      }
      if (scope) {
        scope.rotated.set(key, rotated);
        scope.rotationOrigin.set(rotated, { nativeUri: baseUri, deg: normDeg });
      } else {
        this.rememberGlobal(this.rotatedBase64Cache, key, rotated, this.MAX_CACHE_SIZE);
        this.rememberGlobal(this.rotationOrigin, rotated, { nativeUri: baseUri, deg: normDeg }, this.MAX_CACHE_SIZE * 2);
      }
    }
  }

  /**
   * Nạp ảnh cho tài liệu pháp lý: không qua cache tĩnh để không giữ RAM trong xuất mẻ, và ném lỗi
   * thay vì bỏ qua.
   * Hỗ trợ tự động xoay đứng (ensurePortrait: true):
   * Sau khi xoay theo rotationDeg ban đầu, nếu ảnh vẫn có width > height (ảnh nằm ngang),
   * hệ thống sẽ tự động xoay thêm 90 độ để chuyển thành khổ dọc phủ kín trang A4.
   */
  public static async loadImageStrict(
    photoUrl: string,
    rotationDeg: number = 0,
    options?: { ensurePortrait?: boolean }
  ): Promise<string> {
    const trimmed = photoUrl.trim();
    const normDeg = normDegOf(rotationDeg);
    const { buffer, mime } = await this.readImageBytesStrict(trimmed);

    let pipeline = sharp(buffer);
    if (normDeg !== 0) {
      pipeline = pipeline.rotate(normDeg);
    }

    let shouldRotatePortrait = false;
    if (options?.ensurePortrait) {
      const meta = await pipeline.metadata();
      if (meta.width && meta.height && meta.width > meta.height) {
        shouldRotatePortrait = true;
        pipeline = pipeline.rotate(90);
      }
    }

    if (normDeg === 0 && !shouldRotatePortrait) {
      return `data:${mime};base64,${buffer.toString('base64')}`;
    }

    const isPng = mime === 'image/png';
    const rotated = isPng ? await pipeline.png().toBuffer() : await pipeline.jpeg({ quality: 95 }).toBuffer();
    return `data:${isPng ? 'image/png' : 'image/jpeg'};base64,${rotated.toString('base64')}`;
  }

  /**
   * Bytes gốc của ảnh (chưa xoay, chưa dập). Dùng ảnh đã nạp sẵn nếu có,
   * không thì tải chặt chẽ (thử lại nhiều lần). Ném lỗi nếu không đọc được.
   */
  public static async getImageBuffer(url: string): Promise<Buffer> {
    const trimmed = url.trim();
    const cached = this.nativeLoaded(trimmed);
    const match = cached?.match(/^data:image\/[a-z+.-]+;base64,(.+)$/i);
    if (match) return Buffer.from(match[1], 'base64');
    return (await this.readImageBytesStrict(trimmed)).buffer;
  }

  /**
   * Đọc bytes ảnh, ném ImageLoadError có phân loại:
   * 1. URL công khai, thử lại STRICT_FETCH_ATTEMPTS lần.
   * 2. Vẫn lỗi → đọc thẳng R2 có xác thực theo key của URL (cùng một file, không đổi nguồn ảnh).
   * 3. R2 không có key → NOT_FOUND (file đã mất, cần Admin thay ảnh).
   */
  private static async readImageBytesStrict(trimmed: string): Promise<{ buffer: Buffer; mime: string }> {
    const dataUriMatch = trimmed.match(/^data:(image\/[a-z+.-]+);base64,(.+)$/i);
    if (dataUriMatch) {
      return { buffer: Buffer.from(dataUriMatch[2], 'base64'), mime: dataUriMatch[1] };
    }

    if (!/^https?:\/\//i.test(trimmed)) {
      const local = this.resolveLocalUpload(trimmed);
      const localMatch = local.match(/^data:(image\/[a-z+.-]+);base64,(.+)$/i);
      if (!localMatch) {
        throw new ImageLoadError({ kind: 'NOT_FOUND', httpStatus: null, message: `Không đọc được ảnh nội bộ: ${trimmed}` });
      }
      return { buffer: Buffer.from(localMatch[2], 'base64'), mime: localMatch[1] };
    }

    let last: ImageLoadFailure = { kind: 'NETWORK', httpStatus: null, message: 'Chưa thử tải' };
    let attempts = 0;
    for (let attempt = 1; attempt <= STRICT_FETCH_ATTEMPTS; attempt++) {
      attempts = attempt;
      try {
        const res = await withFetchSlot(() => fetch(trimmed, { signal: AbortSignal.timeout(STRICT_FETCH_TIMEOUT_MS) }));
        if (!res.ok) {
          last = { kind: res.status === 404 ? 'NOT_FOUND' : 'HTTP', httpStatus: res.status, message: `HTTP ${res.status}` };
          // 404 không đổi khi thử lại: sang ngay bước đọc R2 có xác thực.
          if (res.status === 404) break;
          // r2.dev giới hạn tốc độ (429) / CDN quá tải (5xx): chờ rồi mới thử lại, không dội thêm request.
          if (attempt < STRICT_FETCH_ATTEMPTS && (res.status === 429 || res.status >= 500)) {
            await sleep(retryDelayMs(res.headers.get('retry-after'), attempt));
          }
          continue;
        }
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length < 64) {
          last = { kind: 'EMPTY', httpStatus: res.status, message: 'Tệp ảnh rỗng' };
          continue;
        }
        return { buffer, mime: mimeOf(res.headers.get('content-type') || '', trimmed) };
      } catch (err) {
        const c = classifyFetchError(err);
        last = { kind: c.kind, httpStatus: null, message: c.message };
      }
    }

    // URL công khai lỗi: thử đọc đúng file đó qua kết nối có xác thực (CDN chập chờn, 403 tạm thời).
    const bucket = StorageService.getPhotoBucket();
    const key = StorageService.keyFromPublicUrl(trimmed);
    if (bucket && key) {
      try {
        const buffer = await StorageService.getObjectBuffer(key, bucket);
        if (buffer && buffer.length >= 64) {
          console.warn(`[ReportImageResolver:r2Fallback] URL công khai lỗi (${last.message}), đã đọc trực tiếp R2: ${key}`);
          return { buffer, mime: mimeOf('', trimmed) };
        }
        last = { kind: 'NOT_FOUND', httpStatus: last.httpStatus, message: `Không còn file trên R2 (key ${key})` };
      } catch (err) {
        console.error(`[ReportImageResolver:r2Fallback] Đọc R2 có xác thực thất bại: ${key}`, err);
      }
    }
    throw new ImageLoadError({
      ...last,
      message: `Không tải được ảnh sau ${attempts} lần thử: ${trimmed} (${last.message})`,
    });
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

  /**
   * Đồng bộ: trả data URI nếu ảnh đã nạp, không thì trả lại URL (ảnh chưa nạp).
   * Trong lượt render, ảnh chưa nạp được ghi vào danh sách cần nạp (lượt dò) và KHÔNG bao giờ
   * trả ảnh chưa xoay thay cho ảnh đã xoay.
   */
  public static resolveToBase64(photoUrl?: string | null, rotationDeg: number = 0): string {
    if (!photoUrl || typeof photoUrl !== 'string') return '';

    const trimmed = photoUrl.trim();
    if (!trimmed) return '';

    const scope = currentRenderImageScope();
    const normDeg = normDegOf(rotationDeg);
    if (normDeg !== 0) {
      const key = `${normDeg}::url::${trimmed}`;
      const preRotated = scope?.rotated.get(key) ?? this.rotatedBase64Cache.get(key);
      if (preRotated) return preRotated;
      if (scope && !trimmed.startsWith('data:image/')) {
        scope.noteRequested(trimmed, normDeg);
        return trimmed;
      }
    }

    if (trimmed.startsWith('data:image/')) {
      return trimmed;
    }

    const loaded = this.nativeLoaded(trimmed);
    if (loaded) return loaded;

    const localResolved = this.resolveLocalUpload(trimmed);
    if (localResolved.startsWith('data:image/')) {
      if (scope) scope.native.set(trimmed, localResolved);
      return localResolved;
    }

    scope?.noteRequested(trimmed, 0);
    return trimmed;
  }
}
