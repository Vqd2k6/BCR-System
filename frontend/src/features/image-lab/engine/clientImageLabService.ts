/**
 * ============================================================================
 * CLIENT-SIDE FORENSIC IMAGE LAB SERVICE (WEB WORKER + RAM PIXEL CACHE)
 * - Giải mã ảnh đúng 1 lần duy nhất vào RAM (DecodedPhotoSessionCache - LRU 12 ảnh).
 * - Khi người dùng đổi chế độ (Auto / Nổi nứt v1 / Nổi nứt v2 / Cứu thiếu sáng)
 *   hoặc kéo thanh trượt Tăng/Giảm sáng & Tăng nét: chạy 100% trong Web Worker
 *   từ bộ đệm RAM trong ~60ms - 120ms (0ms độ trễ mạng, không tải lại ảnh).
 * - Tự động vượt rào cản CORS của Cloudflare R2 qua cơ chế Direct Fetch + Raw Stream Proxy.
 * ============================================================================
 */

import { api } from '../../../services/api';
import {
  analyzeLuminanceQuality,
  computeCleanRoiPercentiles,
  resolveClientEnhancementParams,
  runClientLuminancePipeline,
} from './imageLabDspCore';
import type {
  ImageLabWorkerRequest,
  ImageLabWorkerResponse,
} from './imageLab.worker';
import type {
  ImageLabPreset,
  ImageEnhancementParams,
  ImageQualityMetrics,
  ImageLabProcessResult,
} from '../ForensicImageLabModal';

interface DecodedPhotoSession {
  sessionKey: string;
  width: number;
  height: number;
  origWidth: number;
  origHeight: number;
  format: string;
  sizeBytes: number;
  rgbOrig: Uint8Array;
  lumOrig: Uint8Array;
  lowClip: number;
  highClip: number;
  beforeMetrics: ImageQualityMetrics;
  originalPreviewBase64: string;
  registeredInWorker: boolean;
  lastUsedAt: number;
}

const MAX_CACHED_SESSIONS = 12;
const MAX_WORKING_DIMENSION = 1920; // Đủ sắc nét để soi thước đo 600% và đạt tốc độ xử lý < 100ms

export class ClientImageLabService {
  private static sessionCache = new Map<string, DecodedPhotoSession>();
  private static workerInstance: Worker | null = null;
  private static workerFailed = false;
  private static requestSeq = 1;
  private static pendingRequests = new Map<
    number,
    {
      resolve: (res: ImageLabWorkerResponse) => void;
      reject: (err: Error) => void;
    }
  >();

  private static workCanvas: HTMLCanvasElement | null = null;

  private static getWorkCanvas(width: number, height: number): HTMLCanvasElement {
    if (!this.workCanvas) {
      this.workCanvas = document.createElement('canvas');
    }
    if (this.workCanvas.width !== width) this.workCanvas.width = width;
    if (this.workCanvas.height !== height) this.workCanvas.height = height;
    return this.workCanvas;
  }

  /**
   * Khởi tạo Web Worker xử lý ảnh (Singleton)
   */
  private static getWorker(): Worker | null {
    if (this.workerFailed || typeof Worker === 'undefined') {
      return null;
    }
    if (!this.workerInstance) {
      try {
        this.workerInstance = new Worker(
          new URL('./imageLab.worker.ts', import.meta.url),
          { type: 'module' }
        );
        this.workerInstance.onmessage = (event: MessageEvent<ImageLabWorkerResponse>) => {
          const data = event.data;
          if (!data || typeof data.requestId !== 'number') return;
          const pending = this.pendingRequests.get(data.requestId);
          if (!pending) return;
          this.pendingRequests.delete(data.requestId);

          if (data.type === 'WORKER_ERROR') {
            pending.reject(new Error(data.errorMessage));
          } else {
            pending.resolve(data);
          }
        };
        this.workerInstance.onerror = (err) => {
          console.warn('[ClientImageLabService] Web Worker gặp lỗi, tự động chuyển sang luồng dự phòng:', err);
          this.workerFailed = true;
          for (const [, p] of this.pendingRequests.entries()) {
            p.reject(new Error('WORKER_CRASHED'));
          }
          this.pendingRequests.clear();
        };
      } catch (err: unknown) {
        console.warn('[ClientImageLabService] Không thể khởi tạo Web Worker, dùng luồng chính:', err);
        this.workerFailed = true;
        return null;
      }
    }
    return this.workerInstance;
  }

  private static postToWorker(
    payload: ImageLabWorkerRequest,
    transfer?: Transferable[]
  ): Promise<ImageLabWorkerResponse> {
    const worker = this.getWorker();
    if (!worker) {
      return Promise.reject(new Error('WORKER_UNAVAILABLE'));
    }
    return new Promise<ImageLabWorkerResponse>((resolve, reject) => {
      this.pendingRequests.set(payload.requestId, { resolve, reject });
      if (transfer && transfer.length > 0) {
        worker.postMessage(payload, transfer);
      } else {
        worker.postMessage(payload);
      }
    });
  }

  private static evictOldestSessionIfNeeded(): void {
    if (this.sessionCache.size < MAX_CACHED_SESSIONS) return;
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [k, v] of this.sessionCache.entries()) {
      if (v.lastUsedAt < oldestTime) {
        oldestTime = v.lastUsedAt;
        oldestKey = k;
      }
    }
    if (oldestKey) {
      this.sessionCache.delete(oldestKey);
    }
  }

  /**
   * Nạp Blob ảnh từ File hoặc URL (Tự động vượt rào cản CORS của Cloudflare R2)
   */
  private static async fetchImageBlob(file: File | null, imageUrl: string): Promise<Blob> {
    if (file) {
      return file;
    }

    const trimmed = imageUrl.trim();
    if (!trimmed) {
      throw new Error('Không có đường dẫn ảnh hợp lệ.');
    }

    // 1. Nếu là Data URI hoặc Blob URL hoặc đường dẫn nội bộ /uploads/...
    if (
      trimmed.startsWith('data:image/') ||
      trimmed.startsWith('blob:') ||
      trimmed.startsWith('/uploads/')
    ) {
      const resp = await fetch(trimmed);
      if (!resp.ok) {
        throw new Error(`Không thể đọc dữ liệu ảnh (HTTP ${resp.status}).`);
      }
      return await resp.blob();
    }

    // 2. Với đường dẫn tuyệt đối http/https (như Cloudflare R2), thử fetch CORS trực tiếp trước,
    // nếu bucket R2 chưa bật CORS header thì tự động đi qua cổng stream /image-lab/proxy-image (có Cache-Control 24h)
    try {
      const directResp = await fetch(trimmed, { mode: 'cors', credentials: 'omit' });
      if (directResp.ok) {
        return await directResp.blob();
      }
    } catch (corsErr: unknown) {
      console.info(
        '[ClientImageLabService:fetchImageBlob] Chuyển sang cổng stream CORS-safe cho ảnh R2:',
        corsErr instanceof Error ? corsErr.message : 'CORS blocked'
      );
    }

    const proxyRes = await api.get('/image-lab/proxy-image', {
      params: { url: trimmed },
      responseType: 'blob',
    });

    if (!(proxyRes.data instanceof Blob)) {
      throw new Error('Không thể tải luồng byte ảnh từ cổng proxy.');
    }
    return proxyRes.data;
  }

  /**
   * Giải mã Blob ảnh thành HTMLImageElement hoặc ImageBitmap
   */
  private static async decodeBlobToDrawable(blob: Blob): Promise<{
    drawable: CanvasImageSource;
    origWidth: number;
    origHeight: number;
    cleanup: () => void;
  }> {
    if (typeof createImageBitmap === 'function') {
      try {
        const bitmap = await createImageBitmap(blob);
        return {
          drawable: bitmap,
          origWidth: bitmap.width,
          origHeight: bitmap.height,
          cleanup: () => bitmap.close(),
        };
      } catch (bmpErr: unknown) {
        console.warn('[ClientImageLabService] Fallback sang HTMLImageElement:', bmpErr);
      }
    }

    const objectUrl = URL.createObjectURL(blob);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Không thể giải mã định dạng ảnh.'));
      el.src = objectUrl;
    });

    return {
      drawable: img,
      origWidth: img.naturalWidth || img.width,
      origHeight: img.naturalHeight || img.height,
      cleanup: () => URL.revokeObjectURL(objectUrl),
    };
  }

  /**
   * Giải mã ảnh 1 lần duy nhất và lưu vào RAM Cache + Đăng ký vào Web Worker
   */
  private static async getOrDecodeSession(
    file: File | null,
    imageUrl: string
  ): Promise<DecodedPhotoSession> {
    const sessionKey = file
      ? `file:${file.name}:${file.size}:${file.lastModified}`
      : `url:${imageUrl.trim()}`;

    const existing = this.sessionCache.get(sessionKey);
    if (existing) {
      existing.lastUsedAt = Date.now();
      return existing;
    }

    const blob = await this.fetchImageBlob(file, imageUrl);
    const sizeBytes = blob.size;
    const format = (blob.type || 'image/jpeg').replace('image/', '') || 'jpeg';

    const { drawable, origWidth, origHeight, cleanup } = await this.decodeBlobToDrawable(blob);
    try {
      const scale = Math.min(
        1.0,
        MAX_WORKING_DIMENSION / Math.max(1, Math.max(origWidth, origHeight))
      );
      const width = Math.max(16, Math.round(origWidth * scale));
      const height = Math.max(16, Math.round(origHeight * scale));

      const canvas = this.getWorkCanvas(width, height);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        throw new Error('Trình duyệt không hỗ trợ Canvas 2D Context.');
      }

      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(drawable, 0, 0, width, height);

      const originalPreviewBase64 = canvas.toDataURL('image/jpeg', 0.92);
      const imgData = ctx.getImageData(0, 0, width, height);
      const rgba = imgData.data;
      const totalPixels = width * height;

      const rgbOrig = new Uint8Array(totalPixels * 3);
      const lumOrig = new Uint8Array(totalPixels);

      for (let i = 0; i < totalPixels; i++) {
        const inOff = i * 4;
        const outOff = i * 3;
        const r = rgba[inOff];
        const g = rgba[inOff + 1];
        const b = rgba[inOff + 2];
        rgbOrig[outOff] = r;
        rgbOrig[outOff + 1] = g;
        rgbOrig[outOff + 2] = b;
        lumOrig[i] = (77 * r + 150 * g + 29 * b + 128) >> 8;
      }

      const { lowClip, highClip } = computeCleanRoiPercentiles(lumOrig, width, height);
      const beforeMetrics = analyzeLuminanceQuality(lumOrig, width, height, {
        origWidth,
        origHeight,
        format,
        sizeBytes,
      });

      this.evictOldestSessionIfNeeded();

      const session: DecodedPhotoSession = {
        sessionKey,
        width,
        height,
        origWidth,
        origHeight,
        format,
        sizeBytes,
        rgbOrig,
        lumOrig,
        lowClip,
        highClip,
        beforeMetrics,
        originalPreviewBase64,
        registeredInWorker: false,
        lastUsedAt: Date.now(),
      };

      this.sessionCache.set(sessionKey, session);
      return session;
    } finally {
      cleanup();
    }
  }

  /**
   * Đảm bảo phiên ảnh đã được nạp sẵn trong RAM của Web Worker
   */
  private static async ensureWorkerHasSession(session: DecodedPhotoSession): Promise<boolean> {
    if (session.registeredInWorker) return true;
    const worker = this.getWorker();
    if (!worker) return false;

    try {
      const rgbCopy = session.rgbOrig.slice().buffer as ArrayBuffer;
      const lumCopy = session.lumOrig.slice().buffer as ArrayBuffer;
      const requestId = this.requestSeq++;

      await this.postToWorker(
        {
          type: 'REGISTER_SESSION',
          requestId,
          sessionKey: session.sessionKey,
          width: session.width,
          height: session.height,
          origWidth: session.origWidth,
          origHeight: session.origHeight,
          format: session.format,
          sizeBytes: session.sizeBytes,
          rgbOrigBuffer: rgbCopy,
          lumOrigBuffer: lumCopy,
          lowClip: session.lowClip,
          highClip: session.highClip,
          beforeMetrics: session.beforeMetrics,
        },
        [rgbCopy, lumCopy]
      );
      session.registeredInWorker = true;
      return true;
    } catch (err: unknown) {
      console.warn('[ClientImageLabService] Không thể đăng ký session vào Worker:', err);
      return false;
    }
  }

  /**
   * Thực thi xử lý ảnh trực tiếp trên Frontend (Web Worker + RAM Cache)
   * Thời gian thực thi khi đã có trong RAM Cache: ~60ms - 120ms (0ms độ trễ mạng)
   */
  public static async processImage(options: {
    file: File | null;
    imageUrl: string;
    preset: ImageLabPreset;
    customParams?: Partial<ImageEnhancementParams>;
  }): Promise<ImageLabProcessResult> {
    const totalStart = performance.now();
    const session = await this.getOrDecodeSession(options.file, options.imageUrl);

    let rgbaOut: Uint8ClampedArray | null = null;
    let afterMetrics: ImageQualityMetrics | null = null;
    let appliedParams: ImageEnhancementParams | null = null;

    // 1. Ưu tiên chạy trên Web Worker (không khóa luồng giao diện)
    const workerReady = await this.ensureWorkerHasSession(session);
    if (workerReady) {
      try {
        const requestId = this.requestSeq++;
        const workerRes = await this.postToWorker({
          type: 'PROCESS_SESSION',
          requestId,
          sessionKey: session.sessionKey,
          preset: options.preset,
          customParams: options.customParams,
        });

        if (workerRes.type === 'PROCESS_SUCCESS') {
          rgbaOut = new Uint8ClampedArray(workerRes.rgbaOutBuffer);
          afterMetrics = workerRes.afterMetrics;
          appliedParams = workerRes.appliedParams;
        }
      } catch (workerErr: unknown) {
        console.warn('[ClientImageLabService] Worker xử lý lỗi, tự động chạy trực tiếp:', workerErr);
        session.registeredInWorker = false;
      }
    }

    // 2. Fallback an toàn ngay trên luồng hiện tại nếu trình duyệt không hỗ trợ Worker
    if (!rgbaOut || !afterMetrics || !appliedParams) {
      appliedParams = resolveClientEnhancementParams(
        options.preset,
        session.beforeMetrics,
        options.customParams
      );
      const out = runClientLuminancePipeline({
        width: session.width,
        height: session.height,
        rgbOrig: session.rgbOrig,
        lumOrig: session.lumOrig,
        lowClip: session.lowClip,
        highClip: session.highClip,
        beforeMetrics: session.beforeMetrics,
        preset: options.preset,
        appliedParams,
      });
      rgbaOut = out.rgbaOut;
      afterMetrics = analyzeLuminanceQuality(out.lumFinal, session.width, session.height, {
        origWidth: session.origWidth,
        origHeight: session.origHeight,
        format: session.format,
        sizeBytes: session.sizeBytes,
      });
    }

    // 3. Kết xuất mảng RGBA sau xử lý ra JPEG Data URI chất lượng cao
    const canvas = this.getWorkCanvas(session.width, session.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Không thể khởi tạo Canvas kết xuất ảnh sau xử lý.');
    }

    const outImageData = new ImageData(
      new Uint8ClampedArray(rgbaOut.buffer as ArrayBuffer, rgbaOut.byteOffset, rgbaOut.byteLength),
      session.width,
      session.height
    );
    ctx.putImageData(outImageData, 0, 0);
    const enhancedPreviewBase64 = canvas.toDataURL('image/jpeg', 0.93);

    const beforeMetrics = session.beforeMetrics;
    const processingTimeMs = Math.max(1, Math.round(performance.now() - totalStart));

    const sharpnessGainPercent =
      beforeMetrics.laplacianVariance > 0
        ? Math.round(
            ((afterMetrics.laplacianVariance - beforeMetrics.laplacianVariance) /
              beforeMetrics.laplacianVariance) *
              100
          )
        : 0;

    const edgeGainPercent =
      beforeMetrics.edgeGradientScore > 0
        ? Math.round(
            ((afterMetrics.edgeGradientScore - beforeMetrics.edgeGradientScore) /
              beforeMetrics.edgeGradientScore) *
              100
          )
        : 0;

    const contrastGainPercent =
      beforeMetrics.rmsContrast > 0
        ? Math.round(
            ((afterMetrics.rmsContrast - beforeMetrics.rmsContrast) / beforeMetrics.rmsContrast) *
              100
          )
        : 0;

    const cnrGainPercent =
      beforeMetrics.cnrScore > 0
        ? Math.round(
            ((afterMetrics.cnrScore - beforeMetrics.cnrScore) / beforeMetrics.cnrScore) * 100
          )
        : 0;

    const brightnessDelta = Number(
      (afterMetrics.meanLuminance - beforeMetrics.meanLuminance).toFixed(1)
    );

    return {
      originalPreviewBase64: session.originalPreviewBase64,
      enhancedPreviewBase64,
      beforeMetrics,
      afterMetrics,
      presetUsed: options.preset,
      appliedParams,
      processingTimeMs,
      improvementSummary: {
        sharpnessGainPercent,
        edgeGainPercent,
        contrastGainPercent,
        brightnessDelta,
        cnrGainPercent,
      },
    };
  }
}
